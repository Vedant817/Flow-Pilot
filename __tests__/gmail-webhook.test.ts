// __tests__/gmail-webhook.test.ts

import { POST } from '../app/api/webhook/gmail/route';
import { NextRequest } from 'next/server';
import { google } from 'googleapis';

jest.mock('../lib/analytics/rollup', () => ({
  applyOrderDelta: jest.fn(async () => undefined),
}));

jest.mock('../lib/ai/memory', () => ({
  ingestDocument: jest.fn(async () => undefined),
}));

jest.mock('../models/Order', () => ({ Order: class {
  _id = 'mock-id';
  products: Array<{ name: string; quantity: number }> = [];
  date = '';
  constructor(data: Record<string, unknown> = {}) { Object.assign(this, data); }
  async save() { return this; }
  set(data: Record<string, unknown>) { Object.assign(this, data); }
  static findOne() { return { sort: jest.fn(async () => null) }; }
} }));
jest.mock('../models/Feedback', () => ({ Feedback: class {
  _id = 'mock-id';
  constructor(data: Record<string, unknown> = {}) { Object.assign(this, data); }
  async save() { return this; }
} }));
jest.mock('../models/Error', () => ({ Error: class {
  _id = 'mock-id';
  constructor(data: Record<string, unknown> = {}) { Object.assign(this, data); }
  async save() { return this; }
} }));
jest.mock('../lib/mongodb', () => ({ __esModule: true, default: jest.fn(async () => undefined) }));

// Mock the googleapis library
jest.mock('googleapis', () => {
  const mockGmail = {
    users: {
      history: {
        list: jest.fn(),
      },
      messages: {
        get: jest.fn(),
        attachments: {
          get: jest.fn(),
        },
      },
    },
  };
  return {
    google: {
      auth: {
        OAuth2: jest.fn(() => ({
          setCredentials: jest.fn(),
        })),
      },
      gmail: jest.fn(() => mockGmail),
    },
  };
});

// Get a typed mock of the gmail object
const mockedGmail = google.gmail({ version: 'v1' });

describe('Gmail Webhook API', () => {
  let consoleSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Spy on console.log and console.error to track their calls
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console spies after each test
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  const mockWebhookRequest = (historyId: string) => {
    const webhookPayload = {
      message: {
        data: Buffer.from(JSON.stringify({ historyId })).toString('base64'),
      },
    };
    return {
      json: async () => webhookPayload,
    } as NextRequest;
  };

  const mockHistoryList = (messageId: string) => {
    (mockedGmail.users.history.list as jest.Mock).mockResolvedValue({
      data: {
        history: [
          {
            messagesAdded: [
              {
                message: {
                  id: messageId,
                },
              },
            ],
          },
        ],
      },
    });
  };

  it('should process a standard plain-text email with an attachment', async () => {
    // Arrange
    mockHistoryList('test-message-id-1');
    (mockedGmail.users.messages.get as jest.Mock).mockResolvedValue({
      data: {
        id: 'test-message-id-1',
        payload: {
          headers: [
            { name: 'From', value: '"Test Sender" <test@example.com>' },
            { name: 'Subject', value: 'Test Subject' },
          ],
          parts: [
            {
              mimeType: 'text/plain',
              body: {
                data: Buffer.from('This is the email body.').toString('base64'),
              },
            },
            {
              filename: 'test-attachment.pdf',
              body: {
                attachmentId: 'test-attachment-id',
              },
            },
          ],
        },
      },
    });
    (mockedGmail.users.messages.attachments.get as jest.Mock).mockResolvedValue({
      data: {
        data: 'attachment-data-in-base64',
      },
    });
    const request = mockWebhookRequest('12345');

    // Act
    await POST(request);

    // Assert
    expect(consoleSpy).toHaveBeenCalledWith('Email classified as: new_order');
  });

  it('should process an HTML-only email and strip HTML tags from the body', async () => {
    // Arrange
    mockHistoryList('test-message-id-2');
    (mockedGmail.users.messages.get as jest.Mock).mockResolvedValue({
      data: {
        id: 'test-message-id-2',
        payload: {
          headers: [
            { name: 'From', value: 'html-sender@example.com' },
            { name: 'Subject', value: 'HTML Email' },
          ],
          parts: [
            {
              mimeType: 'text/html',
              body: {
                data: Buffer.from('<body><p>This is <b>HTML</b> content.</p></body>').toString('base64'),
              },
            },
          ],
        },
      },
    });
    const request = mockWebhookRequest('12346');

    // Act
    await POST(request);

    // Assert
    expect(consoleSpy).toHaveBeenCalledWith('Email classified as: new_order');
  });

  it('should handle emails with no attachments gracefully', async () => {
    // Arrange
    mockHistoryList('test-message-id-3');
    (mockedGmail.users.messages.get as jest.Mock).mockResolvedValue({
      data: {
        id: 'test-message-id-3',
        payload: {
          headers: [
            { name: 'From', value: 'No Attachment <no-attach@example.com>' },
            { name: 'Subject', value: 'No Attachments Here' },
          ],
          parts: [
            {
              mimeType: 'text/plain',
              body: {
                data: Buffer.from('Just a plain email.').toString('base64'),
              },
            },
          ],
        },
      },
    });
    const request = mockWebhookRequest('12347');

    // Act
    await POST(request);

    // Assert
    expect(consoleSpy).toHaveBeenCalledWith('Email classified as: new_order');
  });

  it('should handle errors when fetching email details and continue processing', async () => {
    // Arrange
    mockHistoryList('failing-message-id');
    (mockedGmail.users.messages.get as jest.Mock).mockRejectedValue(new Error('API Error'));
    const request = mockWebhookRequest('12348');

    // Act
    await POST(request);

    // Assert
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to get email details for message failing-message-id:', expect.any(Error));
    // Ensure the failed message is not classified or persisted.
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Email classified as:'));
  });
});

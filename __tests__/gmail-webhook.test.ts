// __tests__/gmail-webhook.test.ts

import { POST } from '../app/api/webhook/gmail/route';
import { NextRequest } from 'next/server';
import { google } from 'googleapis';
import { applyOrderDelta } from '../lib/analytics/rollup';
import { classifyEmail } from '../lib/nlp/classify';

jest.mock('../lib/nlp/classify', () => ({
  classifyEmail: jest.fn(async () => 'new_order'),
}));

jest.mock('../lib/nlp/extract', () => ({
  extractOrderDetails: jest.fn(async () => ({
    name: 'Test Buyer',
    phone: '1234567890',
    products: [{ name: 'Widget', quantity: 2 }],
    date: '2025-01-15',
    time: '12:00',
  })),
  extractFeedbackDetails: jest.fn(async () => ({
    review: 'Great service',
    type: 'good',
  })),
}));

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
jest.mock('../lib/mongodb', () => ({
  __esModule: true,
  default: jest.fn(async () => ({
    connection: {
      db: {
        collection: jest.fn(() => ({
          findOne: jest.fn(async () => ({ historyId: '100' })),
          updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
        })),
      },
    },
  })),
}));
jest.mock('../lib/distributed-lock', () => ({
  acquireLock: jest.fn(async () => true),
  releaseLock: jest.fn(async () => undefined),
}));

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
    process.env.GMAIL_WEBHOOK_SECRET = 'test-webhook-secret';
    process.env.GMAIL_ORG_ID = 'org_test';
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
      headers: new Headers({
        'x-gmail-webhook-secret': 'test-webhook-secret',
      }),
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
    expect(classifyEmail).toHaveBeenCalledWith('This is the email body.');
    expect(applyOrderDelta).toHaveBeenCalledWith(
      'org_test',
      expect.any(String),
      expect.any(Array),
      1
    );
    expect(mockedGmail.users.history.list).toHaveBeenCalledWith(
      expect.objectContaining({
        startHistoryId: '100',
      })
    );
  });

  it('rejects webhook requests without valid authentication', async () => {
    const request = mockWebhookRequest('12345');
    request.headers.set('x-gmail-webhook-secret', 'wrong-secret');

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(mockedGmail.users.history.list).not.toHaveBeenCalled();
  });

  it('processes a repeated Gmail message only once per notification', async () => {
    (mockedGmail.users.history.list as jest.Mock).mockResolvedValue({
      data: {
        history: [
          { messagesAdded: [{ message: { id: 'duplicate-message' } }] },
          { messagesAdded: [{ message: { id: 'duplicate-message' } }] },
        ],
      },
    });
    (mockedGmail.users.messages.get as jest.Mock).mockResolvedValue({
      data: {
        payload: {
          headers: [{ name: 'From', value: 'buyer@example.com' }],
          body: { data: Buffer.from('Please place an order.').toString('base64') },
        },
      },
    });

    const response = await POST(mockWebhookRequest('12349'));

    expect(response.status).toBe(200);
    expect(mockedGmail.users.messages.get).toHaveBeenCalledTimes(1);
    expect(applyOrderDelta).toHaveBeenCalledTimes(1);
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
    expect(classifyEmail).toHaveBeenCalledWith('This is HTML content.');
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

  it('returns a retryable failure when fetching an email fails', async () => {
    // Arrange
    mockHistoryList('failing-message-id');
    (mockedGmail.users.messages.get as jest.Mock).mockRejectedValue(new Error('API Error'));
    const request = mockWebhookRequest('12348');

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(500);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error processing webhook:', expect.any(Error));
    // Ensure the failed message is not classified or persisted.
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Email classified as:'));
  });
});

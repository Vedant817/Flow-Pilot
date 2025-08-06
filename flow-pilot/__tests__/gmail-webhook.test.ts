// __tests__/gmail-webhook.test.ts

import { POST } from '../app/api/webhook/gmail/route';
import { NextRequest } from 'next/server';
import { google } from 'googleapis';
import axios from 'axios';

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

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

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
    mockedAxios.post.mockResolvedValue({ status: 200, data: 'ok' });

    const request = mockWebhookRequest('12345');

    // Act
    await POST(request);

    // Assert
    expect(consoleSpy).toHaveBeenCalledWith('--- New Email Received ---');
    expect(consoleSpy).toHaveBeenCalledWith('Sender Name:', 'Test Sender');
    expect(consoleSpy).toHaveBeenCalledWith('Sender Email:', 'test@example.com');
    expect(consoleSpy).toHaveBeenCalledWith('Body:', 'This is the email body.');
    expect(consoleSpy).toHaveBeenCalledWith('Attachments:', 'test-attachment.pdf');
    expect(mockedAxios.post).toHaveBeenCalledWith('http://localhost:3000/api/root', expect.any(Object));
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
    mockedAxios.post.mockResolvedValue({ status: 200, data: 'ok' });
    const request = mockWebhookRequest('12346');

    // Act
    await POST(request);

    // Assert
    expect(consoleSpy).toHaveBeenCalledWith('--- New Email Received ---');
    expect(consoleSpy).toHaveBeenCalledWith('Sender Name:', 'html-sender');
    expect(consoleSpy).toHaveBeenCalledWith('Sender Email:', 'html-sender@example.com');
    expect(consoleSpy).toHaveBeenCalledWith('Body:', 'This is HTML content.');
    expect(consoleSpy).toHaveBeenCalledWith('Attachments:', 'None');
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
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
    mockedAxios.post.mockResolvedValue({ status: 200, data: 'ok' });
    const request = mockWebhookRequest('12347');

    // Act
    await POST(request);

    // Assert
    expect(consoleSpy).toHaveBeenCalledWith('--- New Email Received ---');
    expect(consoleSpy).toHaveBeenCalledWith('Sender Name:', 'No Attachment');
    expect(consoleSpy).toHaveBeenCalledWith('Sender Email:', 'no-attach@example.com');
    expect(consoleSpy).toHaveBeenCalledWith('Body:', 'Just a plain email.');
    expect(consoleSpy).toHaveBeenCalledWith('Attachments:', 'None');
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
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
    // Ensure it doesn't try to log email details or call the internal API
    expect(consoleSpy).not.toHaveBeenCalledWith('--- New Email Received ---');
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
});
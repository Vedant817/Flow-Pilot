// __tests__/gmail-webhook.test.ts

import { POST } from '../app/api/webhook/gmail/route';
import { NextRequest } from 'next/server';
import { google } from 'googleapis';
import { applyOrderDelta } from '../lib/analytics/rollup';
import { classifyEmailWithScores as classifyEmail } from '../lib/nlp/classify';
import { Order } from '../models/Order';
import { EmailReview } from '../models/EmailReview';
import { InboundOrderDraft } from '../models/InboundOrderDraft';
import connectToDatabase from '../lib/mongodb';

jest.mock('../lib/nlp/classify', () => ({
  classifyEmailWithScores: jest.fn(),
}));
const mockClassify = classifyEmail as jest.Mock;
const mockScores = (label: string) => ({ label, confidence: 0.95, scores: { [label]: 0.95 } });
jest.mock('../models/EmailReview', () => ({ EmailReview: { updateOne: jest.fn(async () => ({})) } }));
jest.mock('../models/InboundOrderDraft', () => ({ InboundOrderDraft: {
  exists: jest.fn(async () => false), updateOne: jest.fn(async () => ({})),
} }));

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
  static exists() { return Promise.resolve(false); }
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
        collection: jest.fn((name: string) => ({
          findOne: jest.fn(async () => name === 'integration_cursors' ? { historyId: '100' } : null),
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
          verifyIdToken: jest.fn(),
        })),
      },
      gmail: jest.fn(() => mockGmail),
    },
  };
});

// Get a typed mock of the gmail object
const mockedGmail = google.gmail({ version: 'v1' });
const mockVerifyIdToken = (google.auth.OAuth2 as unknown as jest.Mock).mock.results[0].value.verifyIdToken as jest.Mock;

describe('Gmail Webhook API', () => {
  let consoleSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.GMAIL_WEBHOOK_SECRET = 'test-webhook-secret';
    process.env.GMAIL_ORG_ID = 'org_test';
    // Reset mocks before each test
    jest.clearAllMocks();
    // Deterministic webhook secret so verification is exercised, not skipped.
    process.env.GMAIL_WEBHOOK_SECRET = 'test-webhook-secret';
    process.env.GMAIL_ORG_ID = 'org_test';
    mockClassify.mockResolvedValue(mockScores('new_order'));
    delete process.env.GOOGLE_PUBSUB_AUDIENCE;
    delete process.env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL;
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
    mockClassify.mockResolvedValue(mockScores('new_order'));
    mockHistoryList('test-message-id-1');
    (mockedGmail.users.messages.get as jest.Mock).mockResolvedValue({
      data: {
        id: 'test-message-id-1',
        payload: {
          headers: [
            { name: 'From', value: '"Test Sender" <test@example.com>' },
            { name: 'Subject', value: 'Purchase Order PO-2214' },
          ],
          parts: [
            {
              mimeType: 'text/plain',
              body: {
                data: Buffer.from('Please process our purchase order:\nBasmati Rice 5kg x 50\nDelivery: 2026-10-05 at 10:00').toString('base64'),
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
    expect(classifyEmail).toHaveBeenCalledWith(
      'Please process our purchase order:\nBasmati Rice 5kg x 50\nDelivery: 2026-10-05 at 10:00', 'Purchase Order PO-2214'
    );
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

  it('prefers nested plain text over an earlier HTML alternative', async () => {
    mockHistoryList('nested-message');
    (mockedGmail.users.messages.get as jest.Mock).mockResolvedValue({
      data: { payload: {
        headers: [{ name: 'From', value: 'buyer@example.com' }],
        mimeType: 'multipart/mixed',
        parts: [
          { mimeType: 'text/html', body: { data: Buffer.from('<p>Wrong body</p>').toString('base64url') } },
          { mimeType: 'multipart/related', parts: [
            { mimeType: 'multipart/alternative', parts: [
              { mimeType: 'text/plain', body: { data: Buffer.from('Nested plain body').toString('base64url') } },
            ] },
          ] },
        ],
      } },
    });

    const response = await POST(mockWebhookRequest('12345'));

    expect(response.status).toBe(200);
    expect(classifyEmail).toHaveBeenCalledWith('Nested plain body', expect.any(String));
    expect(mockedGmail.users.messages.attachments.get).not.toHaveBeenCalled();
  });

  it('fetches attachment-backed text bodies', async () => {
    mockHistoryList('attachment-message');
    (mockedGmail.users.messages.get as jest.Mock).mockResolvedValue({
      data: { payload: {
        headers: [{ name: 'From', value: 'buyer@example.com' }],
        parts: [{ mimeType: 'multipart/alternative', parts: [
          { mimeType: 'text/plain', body: { attachmentId: 'body-attachment' } },
        ] }],
      } },
    });
    (mockedGmail.users.messages.attachments.get as jest.Mock).mockResolvedValue({
      data: { data: Buffer.from('Attachment plain body').toString('base64url') },
    });

    const response = await POST(mockWebhookRequest('12345'));

    expect(response.status).toBe(200);
    expect(mockedGmail.users.messages.attachments.get).toHaveBeenCalledWith({
      userId: 'me', messageId: 'attachment-message', id: 'body-attachment',
    });
    expect(classifyEmail).toHaveBeenCalledWith('Attachment plain body', expect.any(String));
  });

  it.each(['rejected', 'missing data'])('keeps the cursor retryable on attachment failure: %s', async (failure) => {
    const updateOne = jest.fn();
    (connectToDatabase as jest.Mock).mockResolvedValueOnce({
      connection: { db: { collection: (name: string) => ({
        findOne: jest.fn(async () => name === 'integration_cursors' ? { historyId: '100' } : null), updateOne,
      }) } },
    });
    mockHistoryList('attachment-failure');
    (mockedGmail.users.messages.get as jest.Mock).mockResolvedValue({
      data: { payload: {
        headers: [{ name: 'From', value: 'buyer@example.com' }],
        mimeType: 'text/plain',
        body: { attachmentId: 'failed-body' },
      } },
    });
    const attachmentGet = mockedGmail.users.messages.attachments.get as jest.Mock;
    if (failure === 'rejected') attachmentGet.mockRejectedValueOnce(new Error('Attachment API failed'));
    else attachmentGet.mockResolvedValueOnce({ data: {} });

    const response = await POST(mockWebhookRequest('12345'));

    expect(response.status).toBe(500);
    expect(updateOne).not.toHaveBeenCalled();
    expect(classifyEmail).not.toHaveBeenCalled();
    expect(applyOrderDelta).not.toHaveBeenCalled();
  });

  it('rejects webhook requests without valid authentication', async () => {
    const request = mockWebhookRequest('12345');
    request.headers.set('x-gmail-webhook-secret', 'wrong-secret');

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(mockedGmail.users.history.list).not.toHaveBeenCalled();
  });

  it('fails closed without an explicitly configured workspace', async () => {
    delete process.env.GMAIL_ORG_ID;
    expect((await POST(mockWebhookRequest('12345'))).status).toBe(503);
    expect(connectToDatabase).not.toHaveBeenCalled();
  });

  it('does not rewind the cursor on an old notification', async () => {
    const response = await POST(mockWebhookRequest('99'));
    expect(response.status).toBe(200);
    expect(mockedGmail.users.history.list).not.toHaveBeenCalled();
  });

  it('skips durably processed messages across notification retries', async () => {
    (connectToDatabase as jest.Mock).mockResolvedValueOnce({
      connection: { db: { collection: (name: string) => ({
        findOne: jest.fn(async () => name === 'integration_cursors'
          ? { historyId: '100' } : { _id: 'gmail:org_test:processed' }),
        updateOne: jest.fn(async () => ({})),
      }) } },
    });
    mockHistoryList('processed');
    expect((await POST(mockWebhookRequest('12345'))).status).toBe(200);
    expect(mockedGmail.users.messages.get).not.toHaveBeenCalled();
  });

  it('accepts only verified OIDC tokens from the configured service account', async () => {
    const verifyIdToken = mockVerifyIdToken;
    process.env.GOOGLE_PUBSUB_AUDIENCE = 'https://example.com/gmail';
    process.env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL = 'push@example.iam.gserviceaccount.com';
    const request = mockWebhookRequest('99');
    request.headers.delete('x-gmail-webhook-secret');
    request.headers.set('authorization', 'Bearer token');
    verifyIdToken.mockResolvedValueOnce({ getPayload: () => ({
      email_verified: false, email: process.env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL,
    }) });
    expect((await POST(request)).status).toBe(401);
    verifyIdToken.mockResolvedValueOnce({ getPayload: () => ({
      email_verified: true, email: process.env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL,
    }) });
    expect((await POST(request)).status).toBe(200);
    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'token', audience: 'https://example.com/gmail',
    });
  });

  it('processes a repeated Gmail message only once per notification', async () => {
    mockClassify.mockResolvedValue(mockScores('new_order'));
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
    expect(InboundOrderDraft.updateOne).toHaveBeenCalledTimes(1);
  });

  it('should process an HTML-only email and strip HTML tags from the body', async () => {
    // Arrange
    mockClassify.mockResolvedValue(mockScores('update_order'));
    const orderSave = jest.spyOn(Order.prototype, 'save');
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
    expect(consoleSpy).toHaveBeenCalledWith('Email classified as: update_order');
    expect(classifyEmail).toHaveBeenCalledWith('This is HTML content.', 'HTML Email');
    expect(orderSave).not.toHaveBeenCalled();
    expect(EmailReview.updateOne).toHaveBeenCalled();
  });

  it('should handle emails with no attachments gracefully', async () => {
    // Arrange
    mockClassify.mockResolvedValue(mockScores('feedback'));
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
    expect(consoleSpy).toHaveBeenCalledWith('Email classified as: feedback');
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

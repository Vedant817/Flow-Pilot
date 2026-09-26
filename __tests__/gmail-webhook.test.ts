// __tests__/gmail-webhook.test.ts

import { POST } from '../app/api/webhook/gmail/route';
import { NextRequest } from 'next/server';
import { google } from 'googleapis';
import { classifyEmailWithScores } from '../lib/nlp/classify';
import { Error as ErrorModel } from '../models/Error';
import { Order } from '../models/Order';
import { EmailReview } from '../models/EmailReview';
import { InboundOrderDraft } from '../models/InboundOrderDraft';

jest.mock('../models/EmailReview', () => ({
  EmailReview: { updateOne: jest.fn(async () => ({ upsertedCount: 1 })) },
}));
jest.mock('../models/InboundOrderDraft', () => ({
  InboundOrderDraft: { updateOne: jest.fn(async () => ({ upsertedCount: 1 })), exists: jest.fn(async () => false) },
}));

jest.mock('../lib/nlp/classify', () => ({
  classifyEmailWithScores: jest.fn(),
  classifyEmail: jest.fn(),
}));

const mockClassify = classifyEmailWithScores as jest.Mock;
const mockScores = (label: string) => ({
  label,
  confidence: 0.9,
  scores: { new_order: 0, update_order: 0, feedback: 0, other: 0, [label]: 0.9 },
});

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
jest.mock('../lib/mongodb', () => {
  const collectionStub = () => ({
    findOne: jest.fn(async () => null),
    updateOne: jest.fn(async () => ({})),
    insertOne: jest.fn(async () => ({})),
    find: jest.fn(() => ({ toArray: jest.fn(async () => []) })),
  });
  return {
    __esModule: true,
    default: jest.fn(async () => ({ connection: { db: { collection: collectionStub } } })),
  };
});

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
    // Deterministic webhook secret so verification is exercised, not skipped.
    process.env.GMAIL_WEBHOOK_SECRET = 'test-webhook-secret';
    process.env.GMAIL_ORG_ID = 'default';
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
      headers: new Headers({ 'x-webhook-secret': 'test-webhook-secret' }),
    } as unknown as NextRequest;
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
    expect(consoleSpy).toHaveBeenCalledWith('New order saved:', 'mock-id');
  });

  it('does not create a second order when a Gmail message is retried after saving', async () => {
    mockClassify.mockResolvedValue(mockScores('new_order'));
    const orderSave = jest.spyOn(Order.prototype, 'save');
    const exists = jest.spyOn(Order as unknown as { exists: (filter: unknown) => Promise<unknown> }, 'exists').mockResolvedValue(true);
    mockHistoryList('retry-message-id');
    (mockedGmail.users.messages.get as jest.Mock).mockResolvedValue({ data: {
      payload: {
        headers: [{ name: 'From', value: 'Buyer <buyer@example.com>' }, { name: 'Subject', value: 'Purchase Order' }],
        body: { data: Buffer.from('Please process our purchase order:\nBasmati Rice x 50\nDelivery 2026-10-05 at 10:00').toString('base64') },
      },
    } });
    await POST(mockWebhookRequest('12345'));
    expect(orderSave).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('Order already created from Gmail message:', 'retry-message-id');
    exists.mockRestore();
    orderSave.mockRestore();
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
    expect(consoleSpy).toHaveBeenCalledWith('Email queued for review: order change requires verification');
    expect(orderSave).not.toHaveBeenCalled();
    expect(EmailReview.updateOne).toHaveBeenCalledTimes(1);
    orderSave.mockRestore();
  });

  it('queues a classified order with no parseable products for review', async () => {
    mockClassify.mockResolvedValue(mockScores('new_order'));
    const orderSave = jest.spyOn(Order.prototype, 'save');
    mockHistoryList('incomplete-order');
    (mockedGmail.users.messages.get as jest.Mock).mockResolvedValue({
      data: {
        payload: {
          headers: [
            { name: 'From', value: 'Customer <buyer@example.com>' },
            { name: 'Subject', value: 'As discussed' },
          ],
          body: { data: Buffer.from('As discussed on call, please proceed.').toString('base64') },
        },
      },
    });
    await POST(mockWebhookRequest('12349'));
    expect(orderSave).not.toHaveBeenCalled();
    expect(EmailReview.updateOne).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith('Email queued for review: Purchase request is not explicit');
    orderSave.mockRestore();
  });

  it('captures an order without a delivery slot as a draft, not a fulfillment order', async () => {
    mockClassify.mockResolvedValue(mockScores('new_order'));
    const orderSave = jest.spyOn(Order.prototype, 'save');
    mockHistoryList('malformed-lines');
    (mockedGmail.users.messages.get as jest.Mock).mockResolvedValue({
      data: {
        payload: {
          headers: [
            { name: 'From', value: 'buyer@example.com' },
            { name: 'Subject', value: 'Purchase Order' },
          ],
          body: { data: Buffer.from('Please process our purchase order:\n50 x Basmati Rice').toString('base64') },
        },
      },
    });
    await POST(mockWebhookRequest('12350'));
    expect(orderSave).not.toHaveBeenCalled();
    expect(InboundOrderDraft.updateOne).toHaveBeenCalledTimes(1);
    expect(EmailReview.updateOne).not.toHaveBeenCalled();
    orderSave.mockRestore();
  });

  it('does not draft a change request when the model mislabels it as a new order', async () => {
    mockClassify.mockResolvedValue(mockScores('new_order'));
    const orderSave = jest.spyOn(Order.prototype, 'save');
    mockHistoryList('mislabelled-amendment');
    (mockedGmail.users.messages.get as jest.Mock).mockResolvedValue({ data: {
      payload: {
        headers: [{ name: 'From', value: 'Buyer <buyer@example.com>' }, { name: 'Subject', value: 'items kam kar do' }],
        body: { data: Buffer.from('sir list me se biscuits hata do, baaki bhej do.').toString('base64') },
      },
    } });
    await POST(mockWebhookRequest('12351'));
    expect(EmailReview.updateOne).toHaveBeenCalledTimes(1);
    expect(InboundOrderDraft.updateOne).not.toHaveBeenCalled();
    expect(orderSave).not.toHaveBeenCalled();
    orderSave.mockRestore();
  });

  it('should log unclassified email as a low-severity error', async () => {
    // Arrange
    mockClassify.mockResolvedValue(mockScores('other'));
    mockHistoryList('test-message-id-4');
    (mockedGmail.users.messages.get as jest.Mock).mockResolvedValue({
      data: {
        id: 'test-message-id-4',
        payload: {
          headers: [
            { name: 'From', value: 'newsletter@example.com' },
            { name: 'Subject', value: 'Festive offers' },
          ],
          parts: [
            {
              mimeType: 'text/plain',
              body: {
                data: Buffer.from('Check out our festive offers on the website.').toString('base64'),
              },
            },
          ],
        },
      },
    });
    const request = mockWebhookRequest('12348');

    // Act
    await POST(request);

    // Assert
    expect(consoleSpy).toHaveBeenCalledWith('Email classified as: other');
    expect(consoleSpy).toHaveBeenCalledWith('Unclassified email logged as error.');
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

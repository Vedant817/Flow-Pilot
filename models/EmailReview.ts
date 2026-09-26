import mongoose, { Schema, type Model } from 'mongoose';

export interface EmailReviewRecord {
  orgId: string;
  gmailMessageId: string;
  senderEmail: string;
  subject: string;
  body: string;
  classification: string;
  reason: string;
  proposedChanges: unknown[];
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  resolutionNote?: string;
  appliedOrderId?: string;
}

const EmailReviewSchema = new Schema<EmailReviewRecord>({
  orgId: { type: String, required: true },
  gmailMessageId: { type: String, required: true },
  senderEmail: { type: String, required: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  classification: { type: String, required: true },
  reason: { type: String, required: true },
  proposedChanges: { type: [Schema.Types.Mixed], default: [] },
  status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open' },
  createdAt: { type: Date, default: Date.now },
  reviewedAt: Date,
  reviewedBy: String,
  resolutionNote: String,
  appliedOrderId: String,
}, { collection: 'email_reviews' });

EmailReviewSchema.index({ orgId: 1, gmailMessageId: 1 }, { unique: true });
EmailReviewSchema.index({ orgId: 1, status: 1, createdAt: -1 });

export const EmailReview: Model<EmailReviewRecord> =
  mongoose.models.EmailReview || mongoose.model<EmailReviewRecord>('EmailReview', EmailReviewSchema);

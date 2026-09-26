import mongoose, { Schema, type Model } from 'mongoose';

export interface InboundOrderDraftRecord {
  orgId: string;
  gmailMessageId: string;
  senderEmail: string;
  senderName: string;
  subject: string;
  body: string;
  placedAt: Date;
  products: Array<{ name: string; quantity: number; evidence: string }>;
  requestedDeliveryDate?: string;
  requestedDeliveryTime?: string;
  status: 'draft' | 'confirmed' | 'dismissed';
  reason: string;
  createdAt: Date;
  confirmedOrderId?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
}

const DraftSchema = new Schema<InboundOrderDraftRecord>({
  orgId: { type: String, required: true },
  gmailMessageId: { type: String, required: true },
  senderEmail: { type: String, required: true },
  senderName: { type: String, required: true },
  subject: { type: String, default: '' },
  body: { type: String, required: true },
  placedAt: { type: Date, required: true },
  products: { type: [{ name: String, quantity: Number, evidence: String }], default: [] },
  requestedDeliveryDate: String,
  requestedDeliveryTime: String,
  status: { type: String, enum: ['draft', 'confirmed', 'dismissed'], default: 'draft' },
  reason: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  confirmedOrderId: String,
  resolvedBy: String,
  resolvedAt: Date,
}, { collection: 'inbound_order_drafts' });

DraftSchema.index({ orgId: 1, gmailMessageId: 1 }, { unique: true });
DraftSchema.index({ orgId: 1, status: 1, createdAt: -1 });

export const InboundOrderDraft: Model<InboundOrderDraftRecord> =
  mongoose.models.InboundOrderDraft || mongoose.model<InboundOrderDraftRecord>('InboundOrderDraft', DraftSchema);

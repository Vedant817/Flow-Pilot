import mongoose, { Schema, type Model } from 'mongoose';

export interface ReturnAuthorizationRecord {
  orgId: string; orderId: string; requestKey: string; requestHash: string;
  status: 'requested' | 'authorized' | 'rejected' | 'received';
  lines: Array<{ productId: string; quantity: number; received: number }>;
  reason: string; requestedBy: string; requestedAt: Date;
  decidedBy?: string; decidedAt?: Date; decisionNote?: string; receivedAt?: Date;
}
const ReturnSchema = new Schema<ReturnAuthorizationRecord>({
  orgId: { type: String, required: true, immutable: true }, orderId: { type: String, required: true, immutable: true },
  requestKey: { type: String, required: true, immutable: true }, requestHash: { type: String, required: true, immutable: true },
  status: { type: String, enum: ['requested', 'authorized', 'rejected', 'received'], default: 'requested' },
  lines: { type: [{ _id: false, productId: String, quantity: { type: Number, min: 1, validate: Number.isSafeInteger },
    received: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger } }], required: true },
  reason: { type: String, required: true, maxlength: 500 }, requestedBy: { type: String, required: true },
  requestedAt: { type: Date, default: Date.now }, decidedBy: String, decidedAt: Date,
  decisionNote: { type: String, maxlength: 500 }, receivedAt: Date,
}, { collection: 'return_authorizations' });
ReturnSchema.index({ orgId: 1, requestKey: 1 }, { unique: true });
ReturnSchema.index({ orgId: 1, orderId: 1, status: 1 });
export const ReturnAuthorization: Model<ReturnAuthorizationRecord> =
  mongoose.models.ReturnAuthorization || mongoose.model('ReturnAuthorization', ReturnSchema);

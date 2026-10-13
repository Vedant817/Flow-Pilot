import mongoose, { Schema, type Model } from 'mongoose';

export interface ShipmentRecord {
  orgId: string; orderId: string; requestKey: string; requestHash: string;
  carrier: string; trackingNumber: string;
  lines: Array<{ productId: string; quantity: number }>;
  status: 'shipped' | 'delivered'; shippedAt: Date; deliveredAt?: Date;
  createdBy: string; deliveryProof?: string;
}
const ShipmentSchema = new Schema<ShipmentRecord>({
  orgId: { type: String, required: true, immutable: true }, orderId: { type: String, required: true, immutable: true },
  requestKey: { type: String, required: true, immutable: true }, requestHash: { type: String, required: true, immutable: true },
  carrier: { type: String, required: true }, trackingNumber: { type: String, required: true },
  lines: { type: [{ _id: false, productId: String, quantity: { type: Number, min: 1, validate: Number.isSafeInteger } }], required: true },
  status: { type: String, enum: ['shipped', 'delivered'], default: 'shipped' },
  shippedAt: { type: Date, default: Date.now }, deliveredAt: Date,
  createdBy: { type: String, required: true }, deliveryProof: { type: String, maxlength: 500 },
}, { collection: 'shipments' });
ShipmentSchema.index({ orgId: 1, requestKey: 1 }, { unique: true });
ShipmentSchema.index({ orgId: 1, orderId: 1, shippedAt: -1 });
export const Shipment: Model<ShipmentRecord> = mongoose.models.Shipment || mongoose.model('Shipment', ShipmentSchema);

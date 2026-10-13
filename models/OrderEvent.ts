import mongoose, { Document, Model, Schema } from 'mongoose';

interface IOrderEvent extends Document {
  orgId: string;
  orderId: string;
  actorId: string;
  type: 'created' | 'status.changed' | 'shipment.created' | 'shipment.delivered' | 'return.requested' | 'return.authorized' | 'return.rejected' | 'return.received';
  fromStatus?: string;
  toStatus: string;
  reason?: string;
  at: Date;
}

const OrderEventSchema = new Schema<IOrderEvent>(
  {
    orgId: { type: String, required: true, immutable: true },
    orderId: { type: String, required: true, immutable: true },
    actorId: { type: String, required: true, immutable: true },
    type: { type: String, enum: ['created', 'status.changed', 'shipment.created', 'shipment.delivered', 'return.requested', 'return.authorized', 'return.rejected', 'return.received'], required: true, immutable: true },
    fromStatus: { type: String, immutable: true },
    toStatus: { type: String, required: true, immutable: true },
    reason: { type: String, maxlength: 500, immutable: true },
    at: { type: Date, default: Date.now, required: true, immutable: true },
  },
  { collection: 'order_events' }
);

OrderEventSchema.index({ orgId: 1, orderId: 1, at: 1 });

export const OrderEvent: Model<IOrderEvent> =
  mongoose.models.OrderEvent ||
  mongoose.model<IOrderEvent>('OrderEvent', OrderEventSchema);

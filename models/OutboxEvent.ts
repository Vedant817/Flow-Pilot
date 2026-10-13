import mongoose, { Document, Model, Schema } from 'mongoose';

export type OutboxEventType = 'order.created';
export type OutboxEventStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export interface IOutboxEvent extends Document {
  orgId: string;
  type: OutboxEventType;
  aggregateId: string;
  eventKey: string;
  status: OutboxEventStatus;
  attempts: number;
  availableAt: Date;
  lockedUntil?: Date;
  leaseOwner?: string;
  processedAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OutboxEventSchema = new Schema<IOutboxEvent>(
  {
    orgId: { type: String, required: true },
    type: { type: String, enum: ['order.created'], required: true },
    aggregateId: { type: String, required: true },
    eventKey: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      required: true,
    },
    attempts: { type: Number, default: 0, min: 0, required: true },
    availableAt: { type: Date, default: Date.now, required: true },
    lockedUntil: Date,
    leaseOwner: String,
    processedAt: Date,
    lastError: String,
  },
  { collection: 'outbox_events', timestamps: true }
);

OutboxEventSchema.index({ orgId: 1, eventKey: 1 }, { unique: true });
OutboxEventSchema.index({ status: 1, availableAt: 1, lockedUntil: 1 });

export const OutboxEvent: Model<IOutboxEvent> =
  mongoose.models.OutboxEvent ||
  mongoose.model<IOutboxEvent>('OutboxEvent', OutboxEventSchema);

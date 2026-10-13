import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IInventoryMovement extends Document {
  orgId: string;
  productId: string;
  orderId?: string;
  kind: 'opening' | 'receipt' | 'adjustment' | 'reserve' | 'release' | 'fulfill' | 'return' | 'return_damaged';
  quantityDelta: number;
  reservedDelta: number;
  quarantinedDelta?: number;
  units?: number;
  balanceAfter: { quantity: number; reservedQuantity: number };
  actorId: string;
  reason: string;
  eventKey: string;
  requestHash: string;
  provenance: 'catalog_opening' | 'legacy_snapshot' | 'command';
  at: Date;
}

const MovementSchema = new Schema<IInventoryMovement>({
  orgId: { type: String, required: true, immutable: true },
  productId: { type: String, required: true, immutable: true },
  orderId: { type: String, immutable: true },
  kind: { type: String, required: true, immutable: true, enum: ['opening', 'receipt', 'adjustment', 'reserve', 'release', 'fulfill', 'return', 'return_damaged'] },
  quantityDelta: { type: Number, required: true, immutable: true, validate: Number.isSafeInteger },
  reservedDelta: { type: Number, required: true, immutable: true, validate: Number.isSafeInteger },
  quarantinedDelta: { type: Number, default: 0, immutable: true, validate: Number.isSafeInteger },
  units: { type: Number, immutable: true, validate: Number.isSafeInteger },
  balanceAfter: {
    quantity: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    reservedQuantity: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  },
  actorId: { type: String, required: true, immutable: true },
  reason: { type: String, required: true, maxlength: 500, immutable: true },
  eventKey: { type: String, required: true, immutable: true },
  requestHash: { type: String, required: true, immutable: true },
  provenance: { type: String, enum: ['catalog_opening', 'legacy_snapshot', 'command'], default: 'command', immutable: true },
  at: { type: Date, default: Date.now, required: true, immutable: true },
}, { collection: 'inventory_movements' });
MovementSchema.pre('validate', function () {
  if (this.balanceAfter?.reservedQuantity > this.balanceAfter?.quantity) {
    throw new Error('Reserved balance cannot exceed on-hand balance');
  }
});
MovementSchema.index({ orgId: 1, eventKey: 1 }, { unique: true });
MovementSchema.index({ orgId: 1, productId: 1, at: -1, _id: -1 });

export const InventoryMovement: Model<IInventoryMovement> =
  mongoose.models.InventoryMovement || mongoose.model<IInventoryMovement>('InventoryMovement', MovementSchema);

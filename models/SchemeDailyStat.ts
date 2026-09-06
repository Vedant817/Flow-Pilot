import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ISchemeDailyStat extends Document {
  orgId: string;
  schemeId: Types.ObjectId;
  date: string; // YYYY-MM-DD
  issued: number;
  redeemed: number;
  holdoutEligible: number;
  holdoutOrders: number;
  treatedOrders: number;
  treatedN: number;
  holdoutN: number;
  discountCostMinor: number;
  revenueMinor: number;
  scaledHoldoutRevenueMinor: number;
  incrementalRevenueMinor: number;
  reactivatedSlipping: number;
  _updatedAt: Date;
}

const SchemeDailyStatSchema = new Schema<ISchemeDailyStat>(
  {
    orgId: { type: String, required: true, default: 'default' },
    schemeId: { type: Schema.Types.ObjectId, ref: 'PromotionScheme', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    issued: { type: Number, default: 0, min: 0 },
    redeemed: { type: Number, default: 0, min: 0 },
    holdoutEligible: { type: Number, default: 0, min: 0 },
    holdoutOrders: { type: Number, default: 0, min: 0 },
    treatedOrders: { type: Number, default: 0, min: 0 },
    treatedN: { type: Number, default: 0, min: 0 },
    holdoutN: { type: Number, default: 0, min: 0 },
    discountCostMinor: { type: Number, default: 0, min: 0 },
    revenueMinor: { type: Number, default: 0, min: 0 },
    scaledHoldoutRevenueMinor: { type: Number, default: 0, min: 0 },
    incrementalRevenueMinor: { type: Number, default: 0 },
    reactivatedSlipping: { type: Number, default: 0, min: 0 },
    _updatedAt: { type: Date, default: () => new Date() },
  },
  {
    collection: 'scheme_daily_stats',
    timestamps: false,
  }
);

SchemeDailyStatSchema.index({ orgId: 1, schemeId: 1, date: 1 }, { unique: true });

export const SchemeDailyStat: Model<ISchemeDailyStat> =
  mongoose.models.SchemeDailyStat || mongoose.model<ISchemeDailyStat>('SchemeDailyStat', SchemeDailyStatSchema);

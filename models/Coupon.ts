import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type CouponStatus = 'issued' | 'redeemed' | 'expired' | 'revoked' | 'holdout';

export interface ICoupon extends Document {
  _id: Types.ObjectId;
  code: string;
  schemeId: Types.ObjectId;
  schemeCodeDenorm: string;
  orgId: string;
  email: string;
  emailNormalized: string;
  clerkUserId?: string;
  benefitSnapshot: {
    type: string;
    valueMinor: number;
    maxDiscountMinor?: number;
    setupFeeMinor?: number;
  };
  status: CouponStatus;
  issuedAt: Date;
  expiresAt: Date;
  redeemedAt?: Date;
  redeemedOrderId?: Types.ObjectId;
  revokedAt?: Date;
  revocationReason?: string;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    schemeId: { type: Schema.Types.ObjectId, ref: 'PromotionScheme', required: true },
    schemeCodeDenorm: { type: String, required: true, trim: true, uppercase: true },
    orgId: { type: String, required: true, default: 'default', index: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    emailNormalized: { type: String, required: true, trim: true, lowercase: true, index: true },
    clerkUserId: { type: String },
    benefitSnapshot: {
      type: { type: String, required: true },
      valueMinor: { type: Number, required: true, min: 0 },
      maxDiscountMinor: { type: Number, min: 0 },
      setupFeeMinor: { type: Number, min: 0 },
    },
    status: { type: String, enum: ['issued', 'redeemed', 'expired', 'revoked', 'holdout'], default: 'issued', index: true },
    issuedAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, required: true },
    redeemedAt: { type: Date },
    redeemedOrderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    revokedAt: { type: Date },
    revocationReason: { type: String },
    idempotencyKey: { type: String },
  },
  {
    collection: 'coupons',
    timestamps: true,
  }
);

CouponSchema.index({ code: 1 }, { unique: true });
CouponSchema.index({ orgId: 1, emailNormalized: 1, status: 1, expiresAt: 1 });
CouponSchema.index({ orgId: 1, schemeId: 1, status: 1 });
CouponSchema.index({ orgId: 1, schemeId: 1, redeemedAt: -1 });
CouponSchema.index(
  { orgId: 1, emailNormalized: 1, schemeId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['issued', 'redeemed', 'holdout'] } } as any }
);
CouponSchema.index({ redeemedOrderId: 1 }, { sparse: true });
CouponSchema.index({ expiresAt: 1 });

export const Coupon: Model<ICoupon> = mongoose.models.Coupon || mongoose.model<ICoupon>('Coupon', CouponSchema);

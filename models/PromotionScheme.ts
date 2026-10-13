import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type RfmSegment =
  | 'Champions'
  | 'Loyal Accounts'
  | 'Promising'
  | 'Potential Loyalists'
  | 'At Risk'
  | 'Hibernating'
  | 'Needs Attention';

export type SchemeCohort = 'regular' | 'active_tenured' | 'slipping' | 'dormant_tenured';
export type BenefitType = 'percent' | 'fixed' | 'free_setup';
export type SchemeStatus = 'draft' | 'pending_approval' | 'active' | 'paused' | 'expired' | 'archived';
export type SchemeMode = 'code' | 'auto' | 'both';

export interface IPromotionScheme extends Document {
  _id: Types.ObjectId;
  orgId: string;
  code: string;
  title: string;
  description: string;
  benefitType: BenefitType;
  benefitValueMinor: number;
  maxDiscountMinor?: number;
  currency: 'INR';
  applicableProducts?: string[];
  applicableCategories?: string[];
  minimumOrderValueMinor?: number;
  setupFeeMinor?: number;
  mode: SchemeMode;
  priority: number;
  stackable: boolean;
  maxSchemesPerCustomer: number;
  exclusiveGroup?: string;
  holdoutPercent: number;
  eligibility: {
    cohorts: SchemeCohort[];
    operator: 'OR' | 'AND';
    minOrders: number;
    minTenureDays: number;
    maxRecencyDays: number;
    excludeEstimated: boolean;
    cadence?: {
      preset: 'strict' | 'relaxed' | 'custom';
      maxCv: number;
      maxMadRatio: number;
      expectedIntervalDays?: number;
      toleranceMultiplier: number;
      medianIntervalMin: number;
      medianIntervalMax: number;
    };
    rfmSegments?: RfmSegment[];
    minMonetaryUnits?: number;
    minMonetaryValueMinor?: number;
    monetaryMode: 'units' | 'value';
  };
  limits: {
    maxRedemptionsGlobal?: number;
    maxRedemptionsPerCustomer: number;
    validFrom: Date;
    validUntil: Date;
  };
  counters: {
    issued: number;
    redeemed: number;
    holdout: number;
  };
  status: SchemeStatus;
  version: number;
  createdBy: string;
  createdByEmail: string;
  updatedBy?: string;
  approvedBy?: string;
  approvedAt?: Date;
  deactivatedAt?: Date;
  deactivationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PromotionSchemeSchema = new Schema<IPromotionScheme>(
  {
    orgId: { type: String, required: true, default: 'default', index: true },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      set: (v: string) => v?.toUpperCase().trim(),
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    benefitType: { type: String, enum: ['percent', 'fixed', 'free_setup'], required: true },
    benefitValueMinor: { type: Number, required: true, min: 0 },
    maxDiscountMinor: { type: Number, min: 0 },
    currency: { type: String, default: 'INR' },
    applicableProducts: { type: [String], default: undefined },
    applicableCategories: { type: [String], default: undefined },
    minimumOrderValueMinor: { type: Number, min: 0 },
    setupFeeMinor: { type: Number, min: 0 },
    mode: { type: String, enum: ['code', 'auto', 'both'], default: 'code' },
    priority: { type: Number, default: 0 },
    stackable: { type: Boolean, default: false },
    maxSchemesPerCustomer: { type: Number, default: 2, min: 1 },
    exclusiveGroup: { type: String, trim: true },
    holdoutPercent: { type: Number, default: 10, min: 0, max: 15 },
    eligibility: {
      cohorts: {
        type: [String],
        enum: ['regular', 'active_tenured', 'slipping', 'dormant_tenured'],
        required: true,
        validate: {
          validator: (v: string[]) => Array.isArray(v) && v.length > 0,
          message: 'At least one cohort required',
        },
      },
      operator: { type: String, enum: ['OR', 'AND'], default: 'OR' },
      minOrders: { type: Number, default: 4, min: 4 },
      minTenureDays: { type: Number, default: 180, min: 0 },
      maxRecencyDays: { type: Number, default: 90, min: 0 },
      excludeEstimated: { type: Boolean, default: true },
      cadence: {
        preset: { type: String, enum: ['strict', 'relaxed', 'custom'], default: 'strict' },
        maxCv: { type: Number, default: 0.35, min: 0, max: 2 },
        maxMadRatio: { type: Number, default: 0.25, min: 0, max: 2 },
        expectedIntervalDays: { type: Number, min: 1, max: 365 },
        toleranceMultiplier: { type: Number, default: 1.5, min: 1, max: 5 },
        medianIntervalMin: { type: Number, default: 7, min: 1 },
        medianIntervalMax: { type: Number, default: 60, min: 1 },
      },
      rfmSegments: { type: [String], default: undefined },
      minMonetaryUnits: { type: Number, min: 0 },
      minMonetaryValueMinor: { type: Number, min: 0 },
      monetaryMode: { type: String, enum: ['units', 'value'], default: 'value' },
    },
    limits: {
      maxRedemptionsGlobal: { type: Number, min: 1 },
      maxRedemptionsPerCustomer: { type: Number, default: 1, min: 1 },
      validFrom: { type: Date, required: true },
      validUntil: { type: Date, required: true },
    },
    counters: {
      issued: { type: Number, default: 0, min: 0 },
      redeemed: { type: Number, default: 0, min: 0 },
      holdout: { type: Number, default: 0, min: 0 },
    },
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'active', 'paused', 'expired', 'archived'],
      default: 'draft',
      index: true,
    },
    version: { type: Number, default: 0 },
    createdBy: { type: String, required: true },
    createdByEmail: { type: String, required: true },
    updatedBy: { type: String },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    deactivatedAt: { type: Date },
    deactivationReason: { type: String },
  },
  {
    collection: 'promotion_schemes',
    timestamps: true,
    collation: { locale: 'en', strength: 2 },
  }
);

// Compound unique per org + code is handled via index below (Mongoose autoIndex). Add pre-validate for window.
(PromotionSchemeSchema as any).pre('validate', function (this: any, next: any) {
  const limits = (this as any).limits;
  if (limits?.validFrom && limits?.validUntil && limits.validFrom >= limits.validUntil) {
    return next(new Error('validFrom must be before validUntil'));
  }
  // percent is basis points 0..10000 (0..100%)
  if ((this as any).benefitType === 'percent' && (this as any).benefitValueMinor > 10000) {
    return next(new Error('percent benefitValueMinor must be 0..10000 (basis points)'));
  }
  next();
});

// Optimistic concurrency helper index defined in ensureQueryIndexes, but also declare here for Mongoose.
(PromotionSchemeSchema as any).index({ orgId: 1, code: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } as any });
(PromotionSchemeSchema as any).index({ status: 1, 'limits.validFrom': 1, 'limits.validUntil': 1 });
(PromotionSchemeSchema as any).index({ orgId: 1, status: 1 });

export const PromotionScheme: Model<IPromotionScheme> =
  mongoose.models.PromotionScheme || mongoose.model<IPromotionScheme>('PromotionScheme', PromotionSchemeSchema);

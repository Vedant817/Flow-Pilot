import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICustomerSignal extends Document {
  orgId: string;
  email: string;
  emailNormalized: string;
  name: string;
  firstOrder: Date;
  lastOrder: Date;
  tenureDays: number;
  recencyDays: number;
  frequency: number;
  monetaryUnits: number;
  monetaryValueMinor: number;
  priceEstimated: boolean;
  originalCurrency?: 'INR' | 'GBP';
  intervals: number[];
  meanInterval: number;
  medianInterval: number;
  stddev: number;
  cv: number;
  mad: number;
  madRatio: number;
  maxInterval: number;
  p90Interval: number;
  expectedInterval: number;
  expectedIntervalsExcludedLast: number | null;
  isRegular: boolean;
  isRegularShort: boolean;
  isRegularLong: boolean;
  isActiveTenured: boolean;
  isSlipping: boolean;
  isDormantTenured: boolean;
  seasonalityFlag: 'stable' | 'bursty' | 'seasonal' | 'insufficient';
  r: number;
  f: number;
  m: number;
  segment: string;
  rfmThresholdVersion: string;
  insufficientData: boolean;
  updatedAt: Date;
}

const CustomerSignalSchema = new Schema<ICustomerSignal>(
  {
    orgId: { type: String, required: true, default: 'default', index: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    emailNormalized: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true },
    firstOrder: { type: Date, required: true },
    lastOrder: { type: Date, required: true },
    tenureDays: { type: Number, required: true, min: 0 },
    recencyDays: { type: Number, required: true, min: 0 },
    frequency: { type: Number, required: true, min: 0 },
    monetaryUnits: { type: Number, required: true, min: 0 },
    monetaryValueMinor: { type: Number, required: true, min: 0 },
    priceEstimated: { type: Boolean, default: false },
    originalCurrency: { type: String, enum: ['INR', 'GBP'] },
    intervals: { type: [Number], default: [] },
    meanInterval: { type: Number, default: 0 },
    medianInterval: { type: Number, default: 0 },
    stddev: { type: Number, default: 0 },
    cv: { type: Number, default: 0 },
    mad: { type: Number, default: 0 },
    madRatio: { type: Number, default: 0 },
    maxInterval: { type: Number, default: 0 },
    p90Interval: { type: Number, default: 0 },
    expectedInterval: { type: Number, default: 0 },
    expectedIntervalsExcludedLast: { type: Number, default: null },
    isRegular: { type: Boolean, default: false, index: true },
    isRegularShort: { type: Boolean, default: false },
    isRegularLong: { type: Boolean, default: false },
    isActiveTenured: { type: Boolean, default: false },
    isSlipping: { type: Boolean, default: false },
    isDormantTenured: { type: Boolean, default: false },
    seasonalityFlag: { type: String, enum: ['stable', 'bursty', 'seasonal', 'insufficient'], default: 'insufficient' },
    r: { type: Number, min: 1, max: 5, default: 1 },
    f: { type: Number, min: 1, max: 5, default: 1 },
    m: { type: Number, min: 1, max: 5, default: 1 },
    segment: { type: String, default: 'Needs Attention' },
    rfmThresholdVersion: { type: String, default: 'v1' },
    insufficientData: { type: Boolean, default: false },
  },
  {
    collection: 'customer_signals',
    timestamps: { createdAt: false, updatedAt: true },
  }
);

CustomerSignalSchema.index({ orgId: 1, emailNormalized: 1 }, { unique: true });
CustomerSignalSchema.index({ orgId: 1, updatedAt: -1 });
CustomerSignalSchema.index({ medianInterval: 1 }, { partialFilterExpression: { isRegular: true } as any });
CustomerSignalSchema.index({ recencyDays: 1 }, { partialFilterExpression: { isSlipping: true } as any });
CustomerSignalSchema.index({ orgId: 1, isActiveTenured: 1 });
CustomerSignalSchema.index({ orgId: 1, isDormantTenured: 1 });

export const CustomerSignal: Model<ICustomerSignal> =
  mongoose.models.CustomerSignal || mongoose.model<ICustomerSignal>('CustomerSignal', CustomerSignalSchema);

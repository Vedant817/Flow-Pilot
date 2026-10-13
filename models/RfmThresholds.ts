import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRfmThresholds extends Document {
  version: string;
  at: Date;
  rCut: number[];
  fCut: number[];
  mCut: number[];
}

const RfmThresholdsSchema = new Schema<IRfmThresholds>(
  {
    version: { type: String, required: true, unique: true },
    at: { type: Date, default: () => new Date() },
    rCut: { type: [Number], required: true },
    fCut: { type: [Number], required: true },
    mCut: { type: [Number], required: true },
  },
  {
    collection: 'rfm_thresholds',
    timestamps: false,
  }
);

RfmThresholdsSchema.index({ version: 1 }, { unique: true });

export const RfmThresholds: Model<IRfmThresholds> =
  mongoose.models.RfmThresholds || mongoose.model<IRfmThresholds>('RfmThresholds', RfmThresholdsSchema);

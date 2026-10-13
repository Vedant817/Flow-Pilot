import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type IssueJobStatus = 'running' | 'completed' | 'failed';

export interface ISchemeIssueJob extends Document {
  _id: Types.ObjectId;
  orgId: string;
  schemeId: Types.ObjectId;
  status: IssueJobStatus;
  totalEligible: number;
  issued: number;
  holdout: number;
  failed: number;
  failedEmails: string[];
  startedAt: Date;
  completedAt?: Date;
  startedBy: string;
  error?: string;
}

const SchemeIssueJobSchema = new Schema<ISchemeIssueJob>(
  {
    orgId: { type: String, required: true, default: 'default' },
    schemeId: { type: Schema.Types.ObjectId, ref: 'PromotionScheme', required: true },
    status: { type: String, enum: ['running', 'completed', 'failed'], default: 'running', index: true },
    totalEligible: { type: Number, default: 0 },
    issued: { type: Number, default: 0 },
    holdout: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    failedEmails: { type: [String], default: [] },
    startedAt: { type: Date, default: () => new Date() },
    completedAt: { type: Date },
    startedBy: { type: String, required: true },
    error: { type: String },
  },
  {
    collection: 'scheme_issue_jobs',
    timestamps: false,
  }
);

SchemeIssueJobSchema.index({ schemeId: 1, status: 1 });
SchemeIssueJobSchema.index({ orgId: 1, startedAt: -1 });

export const SchemeIssueJob: Model<ISchemeIssueJob> =
  mongoose.models.SchemeIssueJob || mongoose.model<ISchemeIssueJob>('SchemeIssueJob', SchemeIssueJobSchema);

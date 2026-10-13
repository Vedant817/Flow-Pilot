import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type AuditAction =
  | 'create'
  | 'update'
  | 'submit_for_approval'
  | 'approve'
  | 'activate'
  | 'pause'
  | 'expire'
  | 'archive'
  | 'issue_batch'
  | 'revoke'
  | 'redeem'
  | 'validate'
  | 'backfill';

export interface IPromotionAudit extends Document {
  orgId: string;
  schemeId?: Types.ObjectId;
  couponId?: Types.ObjectId;
  actorClerkId: string;
  actorEmail: string;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
  at: Date;
  ip?: string;
  requestId?: string;
  jobId?: string;
}

const PromotionAuditSchema = new Schema<IPromotionAudit>(
  {
    orgId: { type: String, required: true, default: 'default' },
    schemeId: { type: Schema.Types.ObjectId, ref: 'PromotionScheme' },
    couponId: { type: Schema.Types.ObjectId, ref: 'Coupon' },
    actorClerkId: { type: String, required: true },
    actorEmail: { type: String, required: true },
    action: {
      type: String,
      enum: ['create', 'update', 'submit_for_approval', 'approve', 'activate', 'pause', 'expire', 'archive', 'issue_batch', 'revoke', 'redeem', 'validate', 'backfill'],
      required: true,
    },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    at: { type: Date, default: () => new Date() },
    ip: { type: String },
    requestId: { type: String },
    jobId: { type: String },
  },
  {
    collection: 'promotion_audits',
    timestamps: false,
  }
);

PromotionAuditSchema.index({ orgId: 1, schemeId: 1, at: -1 });
PromotionAuditSchema.index({ orgId: 1, actorClerkId: 1, at: -1 });
PromotionAuditSchema.index({ at: -1 });

export const PromotionAudit: Model<IPromotionAudit> =
  mongoose.models.PromotionAudit || mongoose.model<IPromotionAudit>('PromotionAudit', PromotionAuditSchema);

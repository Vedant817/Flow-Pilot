import mongoose, { Schema, Document, Model } from 'mongoose';

interface IFeedback extends Document {
    orgId: string;
    sourceMessageId?: string;
    email: string;
    review: string;
    type: string;
    createdAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>({
    orgId: { type: String, required: true, index: true },
    sourceMessageId: { type: String },
    email: { type: String, required: true },
    review: { type: String, required: true },
    type: {
        type: String,
        required: true,
        enum: ['good', 'bad', 'neutral']
    },
    createdAt: { type: Date, required: true, default: Date.now },
}, {
    collection: 'feedback',
    timestamps: false,
});

FeedbackSchema.index(
    { orgId: 1, sourceMessageId: 1 },
    { unique: true, partialFilterExpression: { sourceMessageId: { $type: 'string' } } }
);

export const Feedback: Model<IFeedback> = mongoose.models.Feedback || mongoose.model<IFeedback>('Feedback', FeedbackSchema);

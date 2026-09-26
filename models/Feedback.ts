import mongoose, { Schema, Document, Model } from 'mongoose';

interface IFeedback extends Document {
    email: string;
    review: string;
    type: string;
    createdAt: Date;
    orgId?: string;
}

const FeedbackSchema = new Schema<IFeedback>({
    email: { type: String, required: true },
    review: { type: String, required: true },
    type: {
        type: String,
        required: true,
        enum: ['good', 'bad', 'neutral']
    },
    createdAt: { type: Date, required: true, default: Date.now },
    orgId: { type: String, default: 'default' },
}, {
    collection: 'feedback',
    timestamps: false,
});

FeedbackSchema.index({ orgId: 1, createdAt: -1 });

export const Feedback: Model<IFeedback> = mongoose.models.Feedback || mongoose.model<IFeedback>('Feedback', FeedbackSchema);
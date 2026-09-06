import mongoose, { Schema, Document, Model } from 'mongoose';

interface IFeedback extends Document {
    email: string;
    review: string;
    type: string;
    createdAt: Date;
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
}, {
    collection: 'feedback',
    timestamps: false,
});

export const Feedback: Model<IFeedback> = mongoose.models.Feedback || mongoose.model<IFeedback>('Feedback', FeedbackSchema);
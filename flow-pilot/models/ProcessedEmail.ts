import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProcessedEmail extends Document {
    messageId: string;
    historyId?: string;
    classification?: string;
    status: 'processing' | 'processed' | 'failed';
    error?: string;
    processedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const ProcessedEmailSchema = new Schema<IProcessedEmail>({
    messageId: { type: String, required: true, unique: true, index: true },
    historyId: { type: String },
    classification: { type: String },
    status: {
        type: String,
        required: true,
        enum: ['processing', 'processed', 'failed'],
        default: 'processing',
    },
    error: { type: String },
    processedAt: { type: Date },
}, {
    collection: 'processed_emails',
    timestamps: true,
});

export const ProcessedEmail: Model<IProcessedEmail> = mongoose.models.ProcessedEmail || mongoose.model<IProcessedEmail>('ProcessedEmail', ProcessedEmailSchema);

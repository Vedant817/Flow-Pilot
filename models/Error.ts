import mongoose, { Schema, Document, Model } from 'mongoose';

interface IError extends Document {
    orgId: string;
    sourceMessageId?: string;
    errorMessage: string;
    type: string;
    severity: string;
    timestamp: Date;
}

const ErrorSchema = new Schema<IError>({
    orgId: { type: String, required: true, index: true },
    sourceMessageId: { type: String },
    errorMessage: { type: String, required: true },
    type: {
        type: String,
        required: true,
        enum: ['System', 'Customer']
    },
    severity: {
        type: String,
        required: true,
        enum: ['low', 'medium', 'high', 'critical']
    },
    timestamp: { type: Date, required: true, default: Date.now },
}, {
    collection: 'errors',
    timestamps: false,
});

ErrorSchema.index(
    { orgId: 1, sourceMessageId: 1 },
    { unique: true, partialFilterExpression: { sourceMessageId: { $type: 'string' } } }
);

export const Error: Model<IError> = mongoose.models.Error || mongoose.model<IError>('Error', ErrorSchema);

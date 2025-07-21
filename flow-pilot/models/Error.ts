import mongoose, { Schema, Document, Model } from 'mongoose';

interface IError extends Document {
    errorMessage: string;
    type: string;
    severity: string;
    timestamp: Date;
}

const ErrorSchema = new Schema<IError>({
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

export const Error: Model<IError> = mongoose.models.Error || mongoose.model<IError>('Error', ErrorSchema);

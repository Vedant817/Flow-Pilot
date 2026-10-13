import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    provenance?: { promptVersion?: string; sourceIds?: string[]; toolIds?: string[]; generationMode?: string; modelRevision?: string };
}

export interface IConversation extends Document {
    _id: Types.ObjectId;
    orgId: string;
    userId: string;
    messages: IMessage[];
    clerkUserId?: string;
    expiresAt?: Date;
}

const MessageSchema = new Schema<IMessage>({
    role: { type: String, required: true, enum: ['user', 'assistant'] },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    provenance: { type: Schema.Types.Mixed },
}, { _id: false });

const ConversationSchema = new Schema<IConversation>({
    orgId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    messages: { type: [MessageSchema], required: true },
    clerkUserId: { type: String, sparse: true },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 86_400_000) },
}, {
    collection: 'conversations',
    timestamps: true,
});

ConversationSchema.index({ clerkUserId: 1, updatedAt: -1 });

export const Conversation: Model<IConversation> = mongoose.models.Conversation || mongoose.model<IConversation>('Conversation', ConversationSchema);

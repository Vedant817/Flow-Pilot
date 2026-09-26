import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export interface IConversation extends Document {
    _id: Types.ObjectId;
    messages: IMessage[];
    clerkUserId?: string;
    orgId?: string;
}

const MessageSchema = new Schema<IMessage>({
    role: { type: String, required: true, enum: ['user', 'assistant'] },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
}, { _id: false });

const ConversationSchema = new Schema<IConversation>({
    messages: { type: [MessageSchema], required: true },
    clerkUserId: { type: String, sparse: true },
    orgId: { type: String, default: 'default' },
}, {
    collection: 'conversations',
    timestamps: true,
});

ConversationSchema.index({ clerkUserId: 1, updatedAt: -1 });

export const Conversation: Model<IConversation> = mongoose.models.Conversation || mongoose.model<IConversation>('Conversation', ConversationSchema);

import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export interface IConversation extends Document {
    _id: Types.ObjectId;
    orgId: string;
    userId: string;
    messages: IMessage[];
}

const MessageSchema = new Schema<IMessage>({
    role: { type: String, required: true, enum: ['user', 'assistant'] },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
}, { _id: false });

const ConversationSchema = new Schema<IConversation>({
    orgId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    messages: { type: [MessageSchema], required: true },
}, {
    collection: 'conversations',
    timestamps: true,
});

export const Conversation: Model<IConversation> = mongoose.models.Conversation || mongoose.model<IConversation>('Conversation', ConversationSchema);

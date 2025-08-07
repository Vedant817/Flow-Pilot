/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Conversation } from '@/models/Conversation';
import type { IMessage } from '@/models/Conversation';
import type { IConversation } from '@/models/Conversation';
import type { HydratedDocument } from 'mongoose';
import { getChatbotResponse } from '@/lib/chatbot';
import type { Types } from 'mongoose';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, conversationId } = body;

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    await dbConnect();

    let conversation: (HydratedDocument<IConversation> & { _id: Types.ObjectId }) | null = null;
    let chatHistory: { role: 'user' | 'assistant'; content: string }[] = [];

    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
      if (conversation) {
        chatHistory = conversation.messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
        }));
      }
    }

    const assistantResponse = await getChatbotResponse(query, chatHistory);

    const newUserMessage: IMessage = { role: 'user', content: query, timestamp: new Date() };
    const newAssistantMessage: IMessage = { role: 'assistant', content: assistantResponse, timestamp: new Date() };

    if (conversation) {
      conversation.messages.push(newUserMessage, newAssistantMessage);
      await conversation.save();
    } else {
      conversation = await Conversation.create({
        messages: [newUserMessage, newAssistantMessage],
      });
    }

    return NextResponse.json({
      response: assistantResponse,
      conversationId: conversation!._id.toString(),
    });

  } catch (error) {
    console.error('Error in chatbot route:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: `Internal Server Error: ${errorMessage}` }, { status: 500 });
  }
}

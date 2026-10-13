import { NextRequest } from 'next/server';
import { isValidObjectId } from 'mongoose';
import { dbConnect } from '@/lib/mongodb';
import { Conversation } from '@/models/Conversation';
import type { IMessage } from '@/models/Conversation';
import { streamCopilotResponse, type CopilotContext } from '@/lib/ai/copilot';
import { rateLimitAsync } from '@/lib/rate-limit';
import { AuthorizationError, requireWorkspace } from '@/lib/auth';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let authCtx: Awaited<ReturnType<typeof requireWorkspace>>;
  try {
    authCtx = await requireWorkspace();
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 401;
    return Response.json({ error: error instanceof Error ? error.message : 'Unauthorized' }, { status });
  }
  const limited = await rateLimitAsync(req, { windowMs: 60_000, max: 12, keyPrefix: 'copilot' });
  if (!limited.ok) {
    return Response.json({ error: 'Rate limit exceeded. Retry shortly.' }, { status: 429 });
  }

  const body = await req.json();
  const query: string = body.query?.trim();
  const conversationId: string | undefined = body.conversationId;

  if (!query) {
    return Response.json({ error: 'Query is required' }, { status: 400 });
  }
  if (query.length > 2_000) {
    return Response.json({ error: 'Query must be 2,000 characters or fewer' }, { status: 400 });
  }
  if (conversationId && !isValidObjectId(conversationId)) {
    return Response.json({ error: 'Invalid conversation ID' }, { status: 400 });
  }

  await dbConnect();

  let conversation = conversationId
    ? await Conversation.findOne({
        _id: conversationId,
        orgId: authCtx.orgId,
        userId: authCtx.userId,
      })
    : null;
  if (conversationId && !conversation) {
    return Response.json({ error: 'Conversation not found' }, { status: 404 });
  }
  const history = (conversation?.messages ?? [])
    .slice(-8)
    .map((msg) => ({ role: msg.role as 'user' | 'assistant', content: msg.content }));

  let context: CopilotContext | null = null;
  let fullResponse = '';

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      try {
        for await (const event of streamCopilotResponse(query, history, { orgId: authCtx.orgId })) {
          if (event.type === 'meta') {
            context = event.payload;
            send('sources', {
              intent: event.payload.intent,
              facts: event.payload.facts.map((f) => ({ tool: f.tool, summary: f.summary })),
              sources: event.payload.sources.map((s) => ({
                kind: s.kind,
                title: s.title,
                snippet: s.text.slice(0, 160),
                score: Number(s.score.toFixed(3)),
              })),
            });
          } else {
            fullResponse += event.payload;
            send('token', event.payload);
          }
        }

        if (conversation) {
          conversation.messages.push(
            { role: 'user', content: query, timestamp: new Date() } as IMessage,
            { role: 'assistant', content: fullResponse, timestamp: new Date() } as IMessage
          );
          if (conversation.messages.length > 100) {
            conversation.messages = conversation.messages.slice(-100) as typeof conversation.messages;
          }
          await conversation.save();
        } else {
          conversation = await Conversation.create({
            orgId: authCtx.orgId,
            userId: authCtx.userId,
            messages: [
              { role: 'user', content: query, timestamp: new Date() },
              { role: 'assistant', content: fullResponse, timestamp: new Date() },
            ],
            clerkUserId: authCtx.userId,
          });
        }
        send('done', { conversationId: conversation._id.toString() });
      } catch (error) {
        console.error('Copilot stream failed:', error);
        send('error', { message: 'Copilot failed mid-response. Try again.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

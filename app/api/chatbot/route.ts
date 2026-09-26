import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/mongodb';
import { getAuthContext } from '@/lib/auth';
import { Conversation } from '@/models/Conversation';
import type { IMessage } from '@/models/Conversation';
import { streamCopilotResponse, type CopilotContext } from '@/lib/ai/copilot';
import { ingestDocument } from '@/lib/ai/memory';
import { rateLimit } from '@/lib/rate-limit';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { windowMs: 60_000, max: 12 });
  if (!limited.ok) {
    return Response.json({ error: 'Rate limit exceeded. Retry shortly.' }, { status: 429 });
  }

  const body = await req.json();
  const query: string = body.query?.trim();
  const conversationId: string | undefined = body.conversationId;

  if (!query) {
    return Response.json({ error: 'Query is required' }, { status: 400 });
  }

  if (conversationId && !mongoose.Types.ObjectId.isValid(conversationId)) {
    return Response.json({ error: 'Invalid conversationId' }, { status: 400 });
  }

  await dbConnect();

  const authCtx = await getAuthContext().catch(() => ({ userId: null as string | null, orgId: 'default' as string }));
  const ownerKey: string = authCtx.userId || 'anon';
  const orgId: string = authCtx.orgId || 'default';

  let conversation = conversationId ? await Conversation.findById(conversationId) : null;
  if (conversationId && !conversation) {
    // Stale/unknown id — start fresh rather than leaking another user's history.
    conversation = null;
  }
  if (conversation) {
    const doc = conversation as unknown as Record<string, unknown>;
    const storedClerkUserId = (doc.clerkUserId ?? doc.userId ?? doc.ownerKey) as string | undefined;
    if (typeof storedClerkUserId === 'string' && storedClerkUserId.length > 0 && storedClerkUserId !== ownerKey) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const storedOrgId = doc.orgId as string | undefined;
    if (typeof storedOrgId === 'string' && storedOrgId.length > 0 && storedOrgId !== orgId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
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
        for await (const event of streamCopilotResponse(query, history)) {
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
          await conversation.save();
        } else {
          conversation = await Conversation.create({
            messages: [
              { role: 'user', content: query, timestamp: new Date() },
              { role: 'assistant', content: fullResponse, timestamp: new Date() },
            ],
            clerkUserId: ownerKey,
            orgId,
          });
        }
        // Self-ingest of Q&A into global knowledge is opt-in only (avoids
        // polluting shared retrieval with per-user chatter).
        if (process.env.COPILOT_SELF_INGEST === '1' && context && context.sources.length > 0 && fullResponse.length > 40) {
          void ingestDocument(
            'knowledge',
            undefined,
            `Q&A: ${query.slice(0, 80)}`,
            `${query}\n${fullResponse.slice(0, 600)}`
          ).catch(() => undefined);
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

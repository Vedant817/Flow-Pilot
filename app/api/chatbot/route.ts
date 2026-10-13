import { NextRequest } from 'next/server';
import { isValidObjectId } from 'mongoose';
import { dbConnect } from '@/lib/mongodb';
import { Conversation } from '@/models/Conversation';
import type { IMessage } from '@/models/Conversation';
import { streamCopilotResponse, type CopilotContext } from '@/lib/ai/copilot';
import { rateLimitAsync } from '@/lib/rate-limit';
import { AuthorizationError, requireWorkspace } from '@/lib/auth';
import { redactSensitiveText } from '@/lib/ai/governance';
import { getModelInfo } from '@/lib/ai/generator';
import { deadlineSignal } from '@/lib/ai/runtime';

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

  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof (body as { query?: unknown }).query !== 'string') {
    return Response.json({ error: 'Query must be text' }, { status: 400 });
  }
  const input = body as { query: string; conversationId?: unknown };
  const query = input.query.trim();
  if (input.conversationId !== undefined && typeof input.conversationId !== 'string') {
    return Response.json({ error: 'Invalid conversation ID' }, { status: 400 });
  }
  const conversationId = input.conversationId;

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
        expiresAt: { $gt: new Date() },
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
  const cancellation = new AbortController();
  const deadline = deadlineSignal(req.signal, 50_000);
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        !closed && !cancellation.signal.aborted && controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      const abort = () => cancellation.abort();
      deadline.signal.addEventListener('abort', abort, { once: true });
      const heartbeat = setInterval(() => send('heartbeat', { active: true }), 10_000);

      try {
        for await (const event of streamCopilotResponse(query, history, {
          orgId: authCtx.orgId, userId: authCtx.userId, role: authCtx.role, signal: cancellation.signal,
        })) {
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
                id: s._id, sourceVersion: s.sourceVersion, sourceUri: s.sourceUri, generatedAt: s.generatedAt,
              })),
            });
          } else {
            fullResponse += event.payload;
            send('token', event.payload);
          }
        }

        if (conversation) {
          conversation.messages.push(
            { role: 'user', content: redactSensitiveText(query), timestamp: new Date() } as IMessage,
            { role: 'assistant', content: fullResponse, timestamp: new Date(), provenance: {
              promptVersion: context?.promptVersion, sourceIds: context?.sources.map(source => source._id),
              toolIds: context?.facts.map(fact => fact.tool), generationMode: context?.generationMode, modelRevision: getModelInfo().revision,
            } } as IMessage
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
              { role: 'user', content: redactSensitiveText(query), timestamp: new Date() },
              { role: 'assistant', content: fullResponse, timestamp: new Date(), provenance: {
                promptVersion: context?.promptVersion, sourceIds: context?.sources.map(source => source._id),
                toolIds: context?.facts.map(fact => fact.tool), generationMode: context?.generationMode, modelRevision: getModelInfo().revision,
              } },
            ],
            clerkUserId: authCtx.userId,
          });
        }
        send('done', { conversationId: conversation._id.toString() });
      } catch (error) {
        console.error('Copilot stream failed', error instanceof Error ? error.name : 'UnknownError');
        send('error', { message: 'Copilot failed mid-response. Try again.' });
      } finally {
        clearInterval(heartbeat); deadline.dispose();
        deadline.signal.removeEventListener('abort', abort);
        if (!closed) { closed = true; controller.close(); }
      }
    },
    cancel() { closed = true; cancellation.abort(); deadline.dispose(); },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

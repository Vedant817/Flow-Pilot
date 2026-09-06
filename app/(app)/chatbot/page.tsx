'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowUp,
  Bot,
  BrainCircuit,
  Database,
  LoaderCircle,
  Mic,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface Source {
  kind: string;
  title: string;
  snippet: string;
  score: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  intent?: string;
}

const QUICK_ASKS = [
  'Which products are trending?',
  'What needs restocking?',
  'Is demand growing or shrinking?',
  'Explain our deadstock risk',
];

function parseSseBlock(block: string): { event: string; data: unknown } | null {
  const event = block.match(/^event:\s*(.+)$/m)?.[1];
  const raw = block.match(/^data:\s*(.+)$/m)?.[1];
  if (!event || !raw) return null;
  try {
    return { event, data: JSON.parse(raw) };
  } catch {
    return null;
  }
}

export default function CopilotPage() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState('');
  const [conversationId, setConversationId] = useState<string>();
  const [streaming, setStreaming] = useState(false);
  const [booting, setBooting] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const initialQueryRef = useRef<string | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  async function ask(text: string) {
    const clean = text.trim();
    if (!clean || streaming) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: clean,
    };
    const assistantId = crypto.randomUUID();

    setMessages((current) => [
      ...current,
      userMessage,
      { id: assistantId, role: 'assistant', content: '' },
    ]);
    setQuery('');
    setStreaming(true);
    setBooting(true);

    try {
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: clean, conversationId }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Copilot request failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';

        for (const block of blocks) {
          const parsed = parseSseBlock(block);
          if (!parsed) continue;

          if (parsed.event === 'sources') {
            setBooting(false);
            const data = parsed.data as { sources: Source[]; intent: string };
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, sources: data.sources, intent: data.intent }
                  : message
              )
            );
          }

          if (parsed.event === 'token') {
            setBooting(false);
            const token = String(parsed.data);
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, content: message.content + token }
                  : message
              )
            );
          }

          if (parsed.event === 'done') {
            setConversationId((parsed.data as { conversationId: string }).conversationId);
          }

          if (parsed.event === 'error') {
            throw new Error((parsed.data as { message: string }).message);
          }
        }

        if (done) break;
      }
    } catch (error) {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content:
                  error instanceof Error
                    ? error.message
                    : 'Copilot could not complete this request.',
              }
            : message
        )
      );
    } finally {
      setBooting(false);
      setStreaming(false);
    }
  }

  useEffect(() => {
    const initial = searchParams.get('q');
    if (initial && initialQueryRef.current !== initial) {
      initialQueryRef.current = initial;
      void ask(initial);
    }
    // The URL-triggered question should run only when q changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(query);
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BrainCircuit size={18} className="text-primary" />
              <h2 className="text-sm font-semibold">Operations Copilot</h2>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                LOCAL
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Grounded answers from live operational data and the DMS knowledge graph.
            </p>
          </div>
          <div className="hidden items-center gap-4 text-[11px] text-muted-foreground md:flex">
            <span className="flex items-center gap-1.5"><ShieldCheck size={13} /> No data leaves Vercel</span>
            <span className="flex items-center gap-1.5"><Database size={13} /> Hybrid RAG</span>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <Sparkles size={24} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Ask your distribution network</h1>
            <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
              Investigate demand shifts, customer risk, inventory exposure and domain best
              practices. Every answer is tool-grounded and source-cited.
            </p>
            <div className="mt-7 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
              {QUICK_ASKS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => void ask(prompt)}
                  className="rounded-lg border border-border bg-card px-4 py-3 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-6 pb-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
                    <Bot size={14} />
                  </div>
                )}
                <div className={`max-w-[82%] ${message.role === 'user' ? 'rounded-lg bg-primary px-4 py-3 text-primary-foreground' : ''}`}>
                  {message.role === 'assistant' && message.intent && (
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                      {message.intent.replaceAll('_', ' ')}
                    </p>
                  )}
                  <div className={`prose prose-sm max-w-none leading-6 ${message.role === 'user' ? 'prose-invert text-sm' : 'prose-invert text-sm text-foreground'} ${streaming && message.id === messages.at(-1)?.id ? 'fp-caret' : ''}`}>
                    {booting && message.id === messages.at(-1)?.id ? (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <LoaderCircle size={14} className="animate-spin" /> Loading local model and retrieving context…
                      </span>
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                    )}
                  </div>
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {message.sources.slice(0, 5).map((source, index) => (
                        <span
                          key={`${source.title}-${index}`}
                          title={source.snippet}
                          className="rounded border border-border bg-card px-2 py-1 text-[10px] text-muted-foreground"
                        >
                          S{index + 1} · {source.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}

        <form onSubmit={submit} className="sticky bottom-0 border-t border-border bg-background/90 pb-4 pt-4 backdrop-blur-md">
          <div className="rounded-xl border border-border bg-card p-2 shadow-xl shadow-black/20 focus-within:border-primary/50">
            <textarea
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void ask(query);
                }
              }}
              rows={2}
              placeholder="Ask about orders, inventory, customers, risk or DMS strategy…"
              className="w-full resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>SmolLM2-360M · q4</span>
                <span>•</span>
                <span>MiniLM-L6-v2</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" disabled className="rounded-md p-2 text-muted-foreground opacity-50" title="Voice input coming soon">
                  <Mic size={14} />
                </button>
                <button
                  type="submit"
                  disabled={!query.trim() || streaming}
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40"
                  aria-label="Send message"
                >
                  {streaming ? <LoaderCircle size={14} className="animate-spin" /> : <ArrowUp size={15} />}
                </button>
              </div>
            </div>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Tiny local models can be wrong. Verify high-impact replenishment decisions.
          </p>
        </form>
      </div>
    </div>
  );
}

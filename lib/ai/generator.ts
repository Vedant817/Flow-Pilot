import { AutoTokenizer, AutoModelForCausalLM, TextStreamer, StoppingCriteriaList, InterruptableStoppingCriteria, env } from '@huggingface/transformers';
import { InferenceGate, withDeadline, deadlineSignal } from './runtime';
import { MODEL_MANIFEST, pinnedRevision } from './model-manifest';

const MODEL_ID = process.env.AI_GEN_MODEL || 'HuggingFaceTB/SmolLM2-360M-Instruct';
const MAX_NEW_TOKENS = parseInt(process.env.AI_GEN_MAX_TOKENS || '320', 10);

if (process.env.NODE_ENV === 'production') {
  env.cacheDir = '/tmp/flowpilot-hf-cache';
}
env.allowLocalModels = true;

interface TokenizerLike {
  apply_chat_template(messages: ChatMessage[], opts: { add_generation_prompt: boolean; tokenize: false }): string;
  (prompt: string, options?: { truncation: boolean; max_length: number; add_special_tokens?: boolean }): { input_ids: { dims: number[] }; attention_mask: unknown };
  decode(tokens: unknown, opts: { skip_special_tokens: boolean }): string;
}

interface LLMCache {
  promise: Promise<{ tokenizer: TokenizerLike; model: Awaited<ReturnType<typeof AutoModelForCausalLM.from_pretrained>> }> | null;
}

declare global {
  var __flowpilotLLM: LLMCache | undefined;
}

const cache: LLMCache = global.__flowpilotLLM ?? (global.__flowpilotLLM = { promise: null });
const inferenceGate = new InferenceGate(1, 8);

async function getLLM() {
  if (!cache.promise) {
    const revision = pinnedRevision(MODEL_ID, process.env.AI_GEN_REVISION, MODEL_MANIFEST.generator);
    cache.promise = Promise.all([
      AutoTokenizer.from_pretrained(MODEL_ID, { revision }) as unknown as Promise<TokenizerLike>,
      AutoModelForCausalLM.from_pretrained(MODEL_ID, { dtype: 'q4', revision }),
    ])
      .then(([tokenizer, model]) => ({ tokenizer, model }))
      .catch((error: unknown) => {
        // Keep concurrent callers on one attempt, but allow the next call to retry.
        cache.promise = null;
        throw error;
      });
  }
  return cache.promise;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  maxNewTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function* generate(
  messages: ChatMessage[],
  opts: GenerateOptions = {}
): AsyncGenerator<string> {
  const timeoutMs = Math.min(45_000, Math.max(1000, opts.timeoutMs ?? 45_000));
  const deadline = deadlineSignal(opts.signal, timeoutMs);
  const signal = deadline.signal;
  let release: (() => void) | undefined;
  let running: Promise<void> | undefined;
  let wake: () => void = () => {};
  const interrupt = new InterruptableStoppingCriteria();
  const criteria = new StoppingCriteriaList();
  criteria.push(interrupt);
  const abort = () => { interrupt.interrupt(); wake(); };

  try {
  const { tokenizer, model } = await withDeadline(getLLM(), signal, timeoutMs);
  release = await inferenceGate.acquire(signal);
  if (signal.aborted) throw new Error('Generation aborted');
  const prompt = tokenizer.apply_chat_template(messages, {
    add_generation_prompt: true,
    tokenize: false,
  });
  const inputs = tokenizer(prompt, { truncation: false, max_length: 2048, add_special_tokens: false });
  if (typeof inputs.input_ids?.dims?.[1] === 'number' && inputs.input_ids.dims[1] > 2048) {
    throw new Error('Prompt exceeds the safe context budget; shorten the request');
  }
  const queue: string[] = [];
  let done = false;
  let failure: unknown = null;

  const streamer = new TextStreamer(tokenizer as never, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (token: string) => {
      queue.push(token);
      wake();
      return true;
    },
  });

  const generationModel = model as unknown as {
    generate(options: Record<string, unknown>): Promise<unknown>;
  };

  signal.addEventListener('abort', abort, { once: true });
  running = generationModel
    .generate({
      ...inputs,
      max_new_tokens: Math.min(320, Math.max(1, opts.maxNewTokens ?? MAX_NEW_TOKENS)),
      do_sample: (opts.temperature ?? 0.2) > 0,
      temperature: opts.temperature ?? 0.2,
      repetition_penalty: 1.15,
      streamer,
      stopping_criteria: criteria,
    })
    .then(() => {
      done = true;
      wake();
    })
    .catch((e: unknown) => {
      failure = e;
      done = true;
      wake();
    });

  while (true) {
    if (signal.aborted) throw new Error('Generation aborted or timed out');
    while (queue.length > 0) {
      yield queue.shift()!;
    }
    if (done) break;
    await new Promise<void>((resolve) => {
      wake = resolve;
    });
  }

  if (failure) throw failure;
  } finally {
    interrupt.interrupt();
    signal.removeEventListener('abort', abort);
    deadline.dispose();
    // Retain the admission slot until native inference has actually stopped.
    if (running && release) void running.finally(release);
    else release?.();
  }
}

export async function generateOnce(
  messages: ChatMessage[],
  opts: GenerateOptions = {}
): Promise<string> {
  let out = '';
  for await (const token of generate(messages, opts)) out += token;
  return out.trim();
}

export function getModelInfo() {
  return { id: MODEL_ID, revision: process.env.AI_GEN_REVISION || (MODEL_ID === MODEL_MANIFEST.generator.id ? MODEL_MANIFEST.generator.revision : undefined),
    quantization: 'q4', runtime: 'onnx-cpu (transformers.js)', admission: inferenceGate.stats() };
}
export async function warmGenerator() { await getLLM(); }

import { AutoTokenizer, AutoModelForCausalLM, TextStreamer, env } from '@huggingface/transformers';

const MODEL_ID = process.env.AI_GEN_MODEL || 'HuggingFaceTB/SmolLM2-360M-Instruct';
const MAX_NEW_TOKENS = parseInt(process.env.AI_GEN_MAX_TOKENS || '320', 10);

if (process.env.NODE_ENV === 'production') {
  env.cacheDir = '/tmp/flowpilot-hf-cache';
}
env.allowLocalModels = false;

interface TokenizerLike {
  applyChatTemplate(messages: ChatMessage[], opts: { addGenerationPrompt: boolean; tokenize: false }): string;
  (prompt: string): { input_ids: { dims: number[] }; attention_mask: unknown };
  decode(tokens: unknown, opts: { skip_special_tokens: boolean }): string;
}

interface LLMCache {
  promise: Promise<{ tokenizer: TokenizerLike; model: Awaited<ReturnType<typeof AutoModelForCausalLM.from_pretrained>> }> | null;
}

declare global {
  var __flowpilotLLM: LLMCache | undefined;
}

const cache: LLMCache = global.__flowpilotLLM ?? (global.__flowpilotLLM = { promise: null });

async function getLLM() {
  if (!cache.promise) {
    cache.promise = Promise.all([
      AutoTokenizer.from_pretrained(MODEL_ID) as unknown as Promise<TokenizerLike>,
      AutoModelForCausalLM.from_pretrained(MODEL_ID, { dtype: 'q4' }),
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
}

export async function* generate(
  messages: ChatMessage[],
  opts: GenerateOptions = {}
): AsyncGenerator<string> {
  const { tokenizer, model } = await getLLM();

  const prompt = tokenizer.applyChatTemplate(messages, {
    addGenerationPrompt: true,
    tokenize: false,
  });
  const inputs = tokenizer(prompt);
  const queue: string[] = [];
  let wake: () => void = () => {};
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

  generationModel
    .generate({
      ...inputs,
      max_new_tokens: opts.maxNewTokens ?? MAX_NEW_TOKENS,
      do_sample: (opts.temperature ?? 0.2) > 0,
      temperature: opts.temperature ?? 0.2,
      repetition_penalty: 1.15,
      streamer,
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
    while (queue.length > 0) {
      yield queue.shift()!;
    }
    if (done) break;
    await new Promise<void>((resolve) => {
      wake = resolve;
    });
  }

  if (failure) throw failure;
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
  return { id: MODEL_ID, quantization: 'q4', runtime: 'onnx-cpu (transformers.js)' };
}

import { pipeline, env } from '@huggingface/transformers';

export const EMBEDDING_DIM = 384;
const MODEL_ID = process.env.AI_EMBED_MODEL || 'Xenova/all-MiniLM-L6-v2';

if (process.env.NODE_ENV === 'production') {
  env.cacheDir = '/tmp/flowpilot-hf-cache';
}
// NOTE: do NOT set env.allowLocalModels = false here — it is process-global
// and would break lib/nlp/classify, which loads a committed local encoder.

interface EmbedderCache {
  promise: Promise<Embedder> | null;
}

interface EmbedOutput {
  data: Float32Array;
}

type Embedder = (
  input: string | string[],
  options: { pooling: 'mean'; normalize: false }
) => Promise<EmbedOutput>;

declare global {
  var __flowpilotEmbedder: EmbedderCache | undefined;
}

const cache: EmbedderCache =
  global.__flowpilotEmbedder ?? (global.__flowpilotEmbedder = { promise: null });

async function getEmbedder() {
  if (!cache.promise) {
    cache.promise = pipeline('feature-extraction', MODEL_ID, { dtype: 'q8' }) as unknown as Promise<Embedder>;
  }
  return cache.promise;
}

function normalize(vec: Float32Array | number[]): number[] {
  const arr = Array.from(vec);
  let norm = 0;
  for (const v of arr) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return arr.map((v) => v / norm);
}

export async function embedText(text: string): Promise<number[]> {
  const embedder = await getEmbedder();
  const output = await embedder(text, { pooling: 'mean', normalize: false });
  return normalize(output.data as Float32Array);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const embedder = await getEmbedder();
  const output = await embedder(texts, { pooling: 'mean', normalize: false });
  const dim = EMBEDDING_DIM;
  const result: number[][] = [];
  const flat = Array.from(output.data as Float32Array);
  for (let i = 0; i < texts.length; i++) {
    result.push(normalize(flat.slice(i * dim, (i + 1) * dim)));
  }
  return result;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

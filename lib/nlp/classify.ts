import { readFileSync } from 'fs';
import { join } from 'path';
import { pipeline, env } from '@huggingface/transformers';
import { embedText as genericEmbedText, cosineSimilarity } from '@/lib/ai/embeddings';
import { buildClassifyInput } from '@/lib/nlp/preprocess';

export type EmailClass = 'new_order' | 'update_order' | 'feedback' | 'other';

export interface ClassScores {
  label: EmailClass;
  /** Max class probability (calibrated on the training set). */
  confidence: number;
  /** Full per-class probability distribution. */
  scores: Record<EmailClass, number>;
}

// ---------------------------------------------------------------------------
// Trained head (primary path)
// A logistic-regression head over a MiniLM encoder fine-tuned with SetFit
// contrastive learning on 32 labeled mails. Measured locally: 75% held-out
// (vs 46% for the heuristic below), ~5ms/mail, no infra beyond the app.
// Encoder: lib/nlp/model (q8 ONNX, 23MB). Head: lib/nlp/model/head.json.
// ---------------------------------------------------------------------------

const MODEL_DIR = join(process.cwd(), 'lib', 'nlp', 'model').replace(/\\/g, '/');

interface HeadFile {
  classes: EmailClass[];
  threshold: number;
  coef: number[][];
  intercept: number[];
}

let headCache: HeadFile | null | undefined;
function loadHead(): HeadFile | null {
  if (headCache !== undefined) return headCache;
  try {
    const raw = readFileSync(join(MODEL_DIR, 'head.json'), 'utf-8');
    const parsed = JSON.parse(raw) as HeadFile;
    if (!parsed.classes?.length || !parsed.coef?.length) throw new Error('bad head.json');
    headCache = parsed;
  } catch {
    headCache = null;
  }
  return headCache;
}

interface ClassifierEmbedderCache {
  promise: Promise<ClassifierEmbedder> | null;
}

interface ClassifierEmbedOutput {
  data: Float32Array;
}

type ClassifierEmbedder = (
  input: string | string[],
  options: { pooling: 'mean'; normalize: false }
) => Promise<ClassifierEmbedOutput>;

declare global {
  var __flowpilotClassifierEmbedder: ClassifierEmbedderCache | undefined;
}

const embedderCache: ClassifierEmbedderCache =
  global.__flowpilotClassifierEmbedder ??
  (global.__flowpilotClassifierEmbedder = { promise: null });

async function getClassifierEmbedder() {
  if (!embedderCache.promise) {
    if (process.env.NODE_ENV === 'production') {
      env.cacheDir = '/tmp/flowpilot-hf-cache';
    }
    // Local committed encoder — must stay enabled even if another module
    // flips the process-global default.
    env.allowLocalModels = true;
    embedderCache.promise = pipeline('feature-extraction', MODEL_DIR, {
      dtype: 'q8',
    }) as unknown as Promise<ClassifierEmbedder>;
  }
  return embedderCache.promise;
}

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / sum);
}

async function predictWithHead(text: string): Promise<ClassScores> {
  const head = loadHead();
  if (!head) throw new Error('classifier head not available');
  const embedder = await getClassifierEmbedder();
  const output = await embedder(text.slice(0, 1200), { pooling: 'mean', normalize: false });
  const vec = Array.from(output.data as Float32Array);
  const logits = head.coef.map((row, i) => {
    let s = head.intercept[i] ?? 0;
    for (let j = 0; j < row.length; j++) s += row[j] * (vec[j] ?? 0);
    return s;
  });
  const probs = softmax(logits);
  const scores = {} as Record<EmailClass, number>;
  head.classes.forEach((c, i) => {
    scores[c] = probs[i] ?? 0;
  });
  let best = head.classes[0];
  for (const c of head.classes) {
    if ((scores[c] ?? 0) > (scores[best] ?? 0)) best = c;
  }
  const confidence = scores[best] ?? 0;
  return { label: confidence >= head.threshold ? best : 'other', confidence, scores };
}

// ---------------------------------------------------------------------------
// Zero-shot heuristic (fallback path)
// MiniLM cosine match against hand-written label descriptions + keyword
// evidence. Kept as the offline fallback if the trained head is missing.
// ---------------------------------------------------------------------------

const LABEL_DESCRIPTIONS: Record<Exclude<EmailClass, 'other'>, string[]> = {
  new_order: [
    'I want to place a new order',
    'please process this purchase order with quantities and delivery date',
    'we would like to buy products, here is our order list',
  ],
  update_order: [
    'I need to change my existing order',
    'update modify cancel or reschedule the order I placed',
    'correction to my previous purchase order quantity',
  ],
  feedback: [
    'here is my review of your service and products',
    'feedback about the delivery experience, complaint or compliment',
    'I am writing about quality issues or appreciation of your service',
  ],
};

const KEYWORD_EVIDENCE: Record<Exclude<EmailClass, 'other'>, string[]> = {
  new_order: ['order', 'purchase', 'buy', 'qty', 'quantity', 'deliver', 'place', 'po ', 'invoice'],
  update_order: ['update', 'change', 'modify', 'cancel', 'reschedule', 'amend', 'revise', 'instead'],
  feedback: ['review', 'feedback', 'complaint', 'excellent', 'terrible', 'service was', 'quality', 'satisfied', 'disappointed'],
};

interface LabelCache {
  vectors: Map<string, number[][]> | null;
}

declare global {
  var __flowpilotLabelCache: LabelCache | undefined;
}
const labelCache: LabelCache = global.__flowpilotLabelCache ?? (global.__flowpilotLabelCache = { vectors: null });

function keywordScore(body: string): Map<EmailClass, number> {
  const lower = ` ${body.toLowerCase()} `;
  const scores = new Map<EmailClass, number>([['new_order', 0], ['update_order', 0], ['feedback', 0], ['other', 0]]);
  for (const [label, words] of Object.entries(KEYWORD_EVIDENCE)) {
    let hits = 0;
    for (const w of words) if (lower.includes(w)) hits++;
    scores.set(label as EmailClass, Math.min(1, hits / 3));
  }
  return scores;
}

async function heuristicClassify(text: string): Promise<ClassScores> {
  if (!labelCache.vectors) {
    const map = new Map<string, number[][]>();
    for (const [label, descs] of Object.entries(LABEL_DESCRIPTIONS)) {
      map.set(label, await Promise.all(descs.map(genericEmbedText)));
    }
    labelCache.vectors = map;
  }

  const truncated = text.slice(0, 1200);
  const [bodyVec] = await Promise.all([genericEmbedText(truncated)]);

  let best: EmailClass = 'other';
  let bestScore = 0.35;
  const kw = keywordScore(truncated);
  const scores = { new_order: 0, update_order: 0, feedback: 0, other: 0 } as Record<EmailClass, number>;

  for (const [label, vecs] of labelCache.vectors) {
    const semantic = Math.max(...vecs.map((v) => cosineSimilarity(bodyVec, v)));
    const lexical = kw.get(label as EmailClass) ?? 0;
    const combined = 0.6 * semantic + 0.4 * lexical;
    scores[label as EmailClass] = combined;
    if (combined > bestScore) {
      bestScore = combined;
      best = label as EmailClass;
    }
  }

  return { label: best, confidence: bestScore, scores };
}

/** Zero-shot heuristic on raw text (no subject handling). Exported for eval/offline use. */
export async function heuristicClassifyEmail(text: string): Promise<EmailClass> {
  return (await heuristicClassify(text)).label;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Classify an email. Subject is embedded jointly — it carries strong intent. */
export async function classifyEmailWithScores(body: string, subject?: string | null): Promise<ClassScores> {
  const input = buildClassifyInput(body, subject);
  try {
    return await predictWithHead(input);
  } catch (err) {
    console.warn('Trained classifier unavailable, using heuristic fallback:', (err as Error)?.message ?? err);
    return heuristicClassify(input);
  }
}

/** Classify an email, returning just the winning label. */
export async function classifyEmail(body: string, subject?: string | null): Promise<EmailClass> {
  return (await classifyEmailWithScores(body, subject)).label;
}

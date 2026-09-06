import { embedText, cosineSimilarity } from '@/lib/ai/embeddings';

/**
 * Zero-shot intent classification using the local MiniLM embedder.
 * Replaces the hosted LLM classifier: labels are described as natural
 * sentences, embedded once per process, then matched by cosine similarity
 * with a keyword-evidence boost for robustness on short emails.
 */

export type EmailClass = 'new_order' | 'update_order' | 'feedback' | 'other';

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
const cache: LabelCache = global.__flowpilotLabelCache ?? (global.__flowpilotLabelCache = { vectors: null });

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

export async function classifyEmail(emailBody: string): Promise<EmailClass> {
  if (!cache.vectors) {
    const map = new Map<string, number[][]>();
    for (const [label, descs] of Object.entries(LABEL_DESCRIPTIONS)) {
      map.set(label, await Promise.all(descs.map(embedText)));
    }
    cache.vectors = map;
  }

  const truncated = emailBody.slice(0, 1200);
  const [bodyVec] = await Promise.all([embedText(truncated)]);

  let best: EmailClass = 'other';
  let bestScore = 0.35;
  const kw = keywordScore(truncated);

  for (const [label, vecs] of cache.vectors) {
    const semantic = Math.max(...vecs.map((v) => cosineSimilarity(bodyVec, v)));
    const lexical = kw.get(label as EmailClass) ?? 0;
    const combined = 0.6 * semantic + 0.4 * lexical;
    if (combined > bestScore) {
      bestScore = combined;
      best = label as EmailClass;
    }
  }

  return best;
}

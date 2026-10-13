import { dbConnect } from '@/lib/mongodb';
import { embedText, cosineSimilarity, EMBEDDING_DIM } from './embeddings';
import { bootstrapKnowledge, type MemoryDoc, type MemoryKind } from './memory';

export interface RetrievedDoc extends Pick<MemoryDoc, '_id' | 'kind' | 'title' | 'text'> {
  score: number;
}

const VECTOR_INDEX_NAME = 'vec_idx_v2';

/**
 * Hybrid retrieval over the semantic memory collection.
 * Tier 1: Atlas Vector Search ($vectorSearch) when available.
 * Tier 2 (fallback): bounded lexical scan with in-process cosine rescoring.
 * Results merged via reciprocal-rank fusion.
 */
export async function hybridRetrieve(
  query: string,
  opts: { orgId: string; limit?: number; kinds?: MemoryKind[] }
): Promise<RetrievedDoc[]> {
  const limit = Math.max(1, Math.min(50, Math.floor(opts.limit ?? 6)));
  const orgId = opts.orgId;
  if (!orgId) throw new Error('Workspace is required for retrieval');
  await bootstrapKnowledge();

  const conn = await dbConnect();
  const col = conn.connection.db!.collection<MemoryDoc>('semantic_memory');
  const queryVec = await embedText(query);
  const allowedWorkspaces = [opts.orgId, 'global'];

  let tier1: RetrievedDoc[] = [];
  let usedVectorSearch = false;
  try {
    const pipeline: Record<string, unknown>[] = [
      {
        $vectorSearch: {
          index: VECTOR_INDEX_NAME,
          path: 'embedding',
          queryVector: queryVec,
          numCandidates: Math.max(limit * 12, 120),
          limit: limit * 2,
          filter: {
            orgId: { $in: allowedWorkspaces },
            ...(opts.kinds ? { kind: { $in: opts.kinds } } : {}),
          },
        },
      },
      { $project: { kind: 1, title: 1, text: 1, orgId: 1, score: { $meta: 'vectorSearchScore' } } },
    ];
    interface VectorRow {
      _id: unknown;
      kind: MemoryKind;
      title: string;
      text: string;
      orgId?: unknown;
      score?: unknown;
    }
    const raw = (await col.aggregate(pipeline, { maxTimeMS: 3000 }).toArray()) as unknown as VectorRow[];
    tier1 = raw
      .filter((d) => {
        return typeof d.orgId === 'string' && allowedWorkspaces.includes(d.orgId);
      })
      .map((d) => ({
      _id: String(d._id),
      kind: d.kind,
      title: d.title,
      text: d.text,
      score: typeof d.score === 'number' ? d.score : 0,
    }));
    usedVectorSearch = tier1.length > 0;
  } catch {
    usedVectorSearch = false;
  }

  // Lexical tier: tokenized OR match over a bounded recent window (never full-scan).
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .slice(0, 8);

  let tier2: RetrievedDoc[] = [];
  if (!usedVectorSearch && tokens.length > 0) {
    const candidates = await col
      .find({
        orgId: { $in: allowedWorkspaces },
        ...(opts.kinds ? { kind: { $in: opts.kinds } } : {}),
      }, {
        limit: 500,
        sort: { createdAt: -1 },
        projection: { kind: 1, title: 1, text: 1, embedding: 1 },
      })
      .toArray();

    tier2 = candidates
      .map((d) => {
        const haystack = `${d.title} ${d.text}`.toLowerCase();
        const overlap = tokens.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0) / tokens.length;
        const emb = Array.isArray(d.embedding) && d.embedding.length === EMBEDDING_DIM ? cosineSimilarity(queryVec, d.embedding) : 0;
        const score = 0.45 * overlap + 0.55 * emb;
        return { _id: String(d._id), kind: d.kind, title: d.title, text: d.text, score };
      })
      .filter((d) => d.score > 0.15 || haystackIncludesAll(d.text, tokens))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit * 2);
  }

  return reciprocalRankFusion(tier1, tier2).slice(0, limit);
}

function haystackIncludesAll(text: string, tokens: string[]): boolean {
  const hay = text.toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

function reciprocalRankFusion(...lists: RetrievedDoc[][]): RetrievedDoc[] {
  const K = 60;
  const scores = new Map<string, { doc: RetrievedDoc; score: number }>();
  for (const list of lists) {
    list.forEach((doc, rank) => {
      const key = doc._id;
      const contribution = 1 / (K + rank + 1);
      const existing = scores.get(key);
      if (existing) existing.score += contribution;
      else scores.set(key, { doc, score: contribution });
    });
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .map(({ doc, score }) => ({ ...doc, score }));
}

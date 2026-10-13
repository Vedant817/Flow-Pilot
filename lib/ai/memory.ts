import { createHash } from 'crypto';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/mongodb';
import { embedBatch } from './embeddings';
import { KNOWLEDGE_CORPUS } from './knowledge';
import { redactSensitiveText } from './governance';

export type MemoryKind = 'knowledge' | 'order' | 'inventory' | 'feedback' | 'error';

export interface MemoryDoc {
  _id: string;
  orgId: string;
  kind: MemoryKind;
  refId?: string;
  title: string;
  text: string;
  embedding: number[];
  createdAt: Date;
  expiresAt?: Date;
  contentHash?: string;
  sourceVersion?: string;
  sourceUri?: string;
}

interface IndexBootstrap {
  knowledgeSeeded: boolean;
  vectorIndexChecked: boolean;
}

declare global {
  var __flowpilotMemBoot: IndexBootstrap | undefined;
}

const boot: IndexBootstrap =
  global.__flowpilotMemBoot ?? (global.__flowpilotMemBoot = { knowledgeSeeded: false, vectorIndexChecked: false });

function chunkId(orgId: string, kind: MemoryKind, refId: string | undefined, idx: number): string {
  return createHash('sha256').update(`${orgId}:${kind}:${refId ?? ''}:${idx}`).digest('hex');
}

export function chunkText(text: string, maxLen = 700): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let current = '';
  for (const para of text.split(/\n+/)) {
    if ((current + '\n' + para).length > maxLen && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = current.length ? `${current}\n${para}` : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function getCollection() {
  const conn = await dbConnect();
  return conn.connection.db!.collection<MemoryDoc>('semantic_memory');
}

/** Attempts to provision an Atlas Vector Search index; silently no-ops on non-Atlas MongoDB. */
async function ensureVectorIndex(): Promise<void> {
  if (boot.vectorIndexChecked) return;
  boot.vectorIndexChecked = true;
  try {
    const col = await getCollection();
    const indexes = col.listSearchIndexes();
    for await (const idx of indexes) {
      if (idx.name === 'vec_idx_v3') return;
    }
    await col.createSearchIndex({
      name: 'vec_idx_v3',
      type: 'vectorSearch',
      definition: {
        fields: [
          { type: 'vector', path: 'embedding', numDimensions: 384, similarity: 'cosine' },
          { type: 'filter', path: 'kind' },
          { type: 'filter', path: 'orgId' },
          { type: 'filter', path: 'expiresAt' },
        ],
      },
    });
  } catch {
    // Local MongoDB or older driver — lexical fallback handles retrieval.
  }
}

export async function ingestDocument(
  kind: MemoryKind,
  refId: string | undefined,
  title: string,
  text: string,
  options: { orgId: string }
): Promise<void> {
  if (options.orgId !== 'global' && process.env.AI_PRIVATE_MEMORY_ENABLED !== 'true') return;
  const chunks = chunkText(redactSensitiveText(text));
  if (chunks.length === 0) return;
  const embeddings = await embedBatch(chunks);
  const col = await getCollection();
  const ops = chunks.map((chunk, i) => ({
    replaceOne: {
      filter: { _id: chunkId(options.orgId, kind, refId, i) },
      replacement: {
        _id: chunkId(options.orgId, kind, refId, i),
        orgId: options.orgId,
        kind,
        refId,
        title: redactSensitiveText(title),
        text: chunk,
        embedding: embeddings[i],
        createdAt: new Date(),
        ...(options.orgId !== 'global' ? { expiresAt: new Date(Date.now() + 90 * 86_400_000) } : {}),
        contentHash: createHash('sha256').update(chunk).digest('hex'),
        sourceVersion: createHash('sha256').update(text).digest('hex'),
        sourceUri: kind === 'order' ? `/orders/${refId}/operations` : kind === 'inventory' ? `/inventory/${refId}/stock` : undefined,
      } satisfies Omit<MemoryDoc, 'createdAt'> & { createdAt: Date },
      upsert: true,
    },
  }));
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const conn = await dbConnect();
      const sources = conn.connection.db!.collection<{ orgId: string; kind: MemoryKind; refId: string; erasedAt?: Date; version: number }>('ai_source_controls');
      const scope = { orgId: options.orgId, kind, refId: refId ?? '' };
      const control = await sources.findOne(scope, { session });
      if (control?.erasedAt) return;
      await sources.updateOne(scope, { $inc: { version: 1 } }, { upsert: true, session });
      await col.bulkWrite(ops, { ordered: false, session });
    });
  } finally { await session.endSession(); }
}

/** Seeds the curated domain corpus once per process. */
export async function bootstrapKnowledge(): Promise<void> {
  if (boot.knowledgeSeeded) return;
  boot.knowledgeSeeded = true;
  try {
    await ensureVectorIndex();
    const col = await getCollection();
    const count = await col.countDocuments({ orgId: 'global', kind: 'knowledge' });
    if (count >= KNOWLEDGE_CORPUS.length) return;
    for (const doc of KNOWLEDGE_CORPUS) {
      await ingestDocument('knowledge', doc.id, doc.title, `${doc.title}. ${doc.content}`, { orgId: 'global' });
    }
  } catch (e) {
    boot.knowledgeSeeded = false;
    throw e;
  }
}

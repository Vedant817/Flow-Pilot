import { createHash } from 'crypto';
import { dbConnect } from '@/lib/mongodb';
import { embedBatch } from './embeddings';
import { KNOWLEDGE_CORPUS } from './knowledge';

export type MemoryKind = 'knowledge' | 'order' | 'inventory' | 'feedback' | 'error';

export interface MemoryDoc {
  _id: string;
  kind: MemoryKind;
  refId?: string;
  title: string;
  text: string;
  embedding: number[];
  createdAt: Date;
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

function chunkId(kind: MemoryKind, refId: string | undefined, idx: number): string {
  return createHash('sha1').update(`${kind}:${refId ?? ''}:${idx}`).digest('hex');
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
    const indexes = await (col as unknown as { searchIndexes: { list(): AsyncIterable<{ name: string }> } }).searchIndexes.list();
    for await (const idx of indexes) {
      if (idx.name === 'vec_idx') return;
    }
    await (col as unknown as {
      searchIndexes: {
        create(def: unknown): Promise<string>;
      };
    }).searchIndexes.create({
      name: 'vec_idx',
      type: 'vectorSearch',
      definition: {
        fields: [
          { type: 'vector', path: 'embedding', numDimensions: 384, similarity: 'cosine' },
          { type: 'filter', path: 'kind' },
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
  text: string
): Promise<void> {
  const chunks = chunkText(text);
  if (chunks.length === 0) return;
  const embeddings = await embedBatch(chunks);
  const col = await getCollection();
  const ops = chunks.map((chunk, i) => ({
    replaceOne: {
      filter: { _id: chunkId(kind, refId, i) },
      replacement: {
        _id: chunkId(kind, refId, i),
        kind,
        refId,
        title,
        text: chunk,
        embedding: embeddings[i],
        createdAt: new Date(),
      } satisfies Omit<MemoryDoc, 'createdAt'> & { createdAt: Date },
      upsert: true,
    },
  }));
  await col.bulkWrite(ops, { ordered: false });
}

/** Seeds the curated domain corpus once per process. */
export async function bootstrapKnowledge(): Promise<void> {
  if (boot.knowledgeSeeded) return;
  boot.knowledgeSeeded = true;
  try {
    await ensureVectorIndex();
    const col = await getCollection();
    const count = await col.countDocuments({ kind: 'knowledge' });
    if (count >= KNOWLEDGE_CORPUS.length) return;
    for (const doc of KNOWLEDGE_CORPUS) {
      await ingestDocument('knowledge', doc.id, doc.title, `${doc.title}. ${doc.content}`);
    }
  } catch (e) {
    boot.knowledgeSeeded = false;
    throw e;
  }
}

jest.mock('../lib/mongodb', () => ({ dbConnect: jest.fn() }));
jest.mock('../lib/ai/embeddings', () => ({
  embedText: jest.fn(async () => [1]),
  cosineSimilarity: jest.fn(() => 1),
  EMBEDDING_DIM: 1,
}));
jest.mock('../lib/ai/memory', () => ({ bootstrapKnowledge: jest.fn() }));

import { dbConnect } from '../lib/mongodb';
import { hybridRetrieve } from '../lib/ai/retriever';

test('vector results retain only explicit tenant and curated-global provenance', async () => {
  process.env.AI_PRIVATE_MEMORY_ENABLED = 'true';
  const aggregate = jest.fn((_pipeline: Array<{
    $vectorSearch: { filter: { orgId: unknown } };
  }>) => ({ toArray: async () => [
    { _id: 'a', orgId: 'org_a', kind: 'knowledge', title: 'tenant', text: 'a', score: 1, expiresAt: new Date(Date.now() + 100000) },
    { _id: 'global', orgId: 'global', kind: 'knowledge', title: 'curated', text: 'b', score: 1 },
    { _id: 'b', orgId: 'org_b', kind: 'knowledge', title: 'foreign', text: 'c', score: 1 },
    { _id: 'legacy', kind: 'knowledge', title: 'unscoped', text: 'd', score: 1 },
  ] }));
  (dbConnect as jest.Mock).mockResolvedValue({
    connection: { db: { collection: () => ({ aggregate }) } },
  });
  const result = await hybridRetrieve('orders', { orgId: 'org_a' });
  expect(result.map(row => row._id)).toEqual(['a', 'global']);
  expect(aggregate.mock.calls[0][0][0].$vectorSearch.filter.orgId)
    .toEqual({ $in: ['org_a', 'global'] });
  delete process.env.AI_PRIVATE_MEMORY_ENABLED;
});

test('missing workspace fails before any database lookup', async () => {
  (dbConnect as jest.Mock).mockClear();
  await expect(hybridRetrieve('orders', { orgId: '' }))
    .rejects.toThrow('Workspace is required');
  expect(dbConnect).not.toHaveBeenCalled();
});

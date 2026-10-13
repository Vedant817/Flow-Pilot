import { ensureQueryIndexes } from '../lib/db-indexes';

describe('database correctness indexes', () => {
  it('fails readiness when a unique index cannot be created', async () => {
    const createIndex = jest.fn((_keys, options) =>
      options?.unique
        ? Promise.reject(new Error('duplicate existing data'))
        : Promise.resolve('index')
    );
    const db = { collection: () => ({ createIndex }) };
    await expect(ensureQueryIndexes(db as never)).rejects.toThrow(
      'Required database indexes could not be created'
    );
  });

  it('uses a partial idempotency index so legacy orders without keys coexist', async () => {
    const createIndex = jest.fn(() => Promise.resolve('index'));
    await ensureQueryIndexes({
      collection: () => ({ createIndex }),
    } as never);
    expect(createIndex).toHaveBeenCalledWith(
      { orgId: 1, idempotencyKey: 1 },
      {
        unique: true,
        partialFilterExpression: { idempotencyKey: { $type: 'string' } },
      }
    );
  });
});

import {
  applyWorkspaceMigration,
  planWorkspaceMigration,
  TENANT_COLLECTIONS,
} from '../lib/migrations/workspace';

describe('workspace migration safety', () => {
  it.each([['global', 'source'], ['target', 'global']])('protects reserved global identity', async (target, source) => {
    await expect(planWorkspaceMigration({} as never, target, source))
      .rejects.toThrow('shared global corpus');
    await expect(applyWorkspaceMigration({} as never, {} as never, target, source))
      .rejects.toThrow('shared global corpus');
  });

  it('requires unfinished outbox work to be reconciled before moving a tenant', async () => {
    const db = { collection: (name: string) => ({
      findOne: async () => name === 'outbox_events' ? { status: 'pending' } : null,
    }) };
    await expect(planWorkspaceMigration(db as never, 'target', 'source'))
      .rejects.toThrow('Drain and reconcile');
  });

  it('rejects an occupied target before any write, including late collection conflicts', async () => {
    const updateMany = jest.fn();
    const db = {
      collection: (name: string) => ({
        countDocuments: async () => name === 'orders' ? 1 : 0,
        findOne: async () => name === 'promotion_schemes' ? { _id: 'conflict' } : null,
        updateMany,
      }),
    };
    await expect(planWorkspaceMigration(db as never, 'target', 'source'))
      .rejects.toThrow('Target workspace is not empty');
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects oversized atomic migrations', async () => {
    const db = { collection: () => ({
      countDocuments: async () => 1000,
      findOne: async () => null,
    }) };
    await expect(planWorkspaceMigration(db as never, 'target', 'source'))
      .rejects.toThrow('rehearsed resumable migration');
  });

  it('rejects stale target-only rollups even when target canonical collections are empty', async () => {
    const db = { collection: (name: string) => ({
      countDocuments: async () => name === 'orders' ? 1 : 0,
      findOne: async () => name === 'daily_sales_rollup' ? { _id: 'stale' } : null,
    }) };
    await expect(planWorkspaceMigration(db as never, 'target', 'source'))
      .rejects.toThrow('daily_sales_rollup');
  });

  it('passes the same session to every write and verifies before returning', async () => {
    const countDocuments = jest.fn()
      .mockImplementation((_filter, options) => options ? Promise.resolve(0) : Promise.resolve(1));
    let firstCounts = TENANT_COLLECTIONS.length;
    countDocuments.mockImplementation(() => Promise.resolve(firstCounts-- > 0 ? 1 : 0));
    const updateMany = jest.fn(async () => ({ modifiedCount: 1 }));
    const deleteMany = jest.fn(async () => ({ deletedCount: 1 }));
    const db = { collection: () => ({ countDocuments, updateMany, deleteMany, findOne: async () => null }) };
    const session = { withTransaction: jest.fn(async (callback) => callback()) };
    expect(await applyWorkspaceMigration(db as never, session as never, 'target', 'source'))
      .toBe(TENANT_COLLECTIONS.length);
    expect(updateMany).toHaveBeenCalledTimes(TENANT_COLLECTIONS.length - 2);
    expect(deleteMany).toHaveBeenCalledTimes(2);
    for (const [, , options] of updateMany.mock.calls as unknown as Array<[unknown, unknown, unknown]>) {
      expect(options).toEqual({ session });
    }
    expect(deleteMany).toHaveBeenCalledWith({ orgId: 'source' }, { session });
  });

  it('propagates late failures out of the transaction without fallback', async () => {
    const updateMany = jest.fn(async () => { throw new Error('unique collision'); });
    const db = { collection: () => ({
      findOne: async () => null, countDocuments: async () => 1, updateMany,
    }) };
    const session = { withTransaction: jest.fn(async (callback) => callback()) };
    await expect(applyWorkspaceMigration(db as never, session as never, 'target', 'source'))
      .rejects.toThrow('unique collision');
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});

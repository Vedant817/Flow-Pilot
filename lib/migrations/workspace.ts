import type { ClientSession, Db, Filter, Document } from 'mongodb';

export const TENANT_COLLECTIONS = [
  'orders', 'inventory', 'feedback', 'errors', 'conversations',
  'promotion_schemes', 'coupons', 'customer_signals', 'promotion_audits',
  'scheme_daily_stats', 'scheme_issue_jobs', 'order_events', 'outbox_events',
  'semantic_memory', 'projection_receipts', 'daily_sales_rollup',
  'email_reviews', 'inbound_order_drafts',
  'integration_credentials',
] as const;

export const MAX_ATOMIC_MIGRATION_RECORDS = 10_000;
const REBUILT_COLLECTIONS = new Set(['semantic_memory', 'daily_sales_rollup']);

function validateWorkspaceMove(targetOrgId: string, sourceOrgId?: string): void {
  if (!targetOrgId.trim() || sourceOrgId === targetOrgId) {
    throw new Error('Migration requires different source and target workspaces');
  }
  if (targetOrgId === 'global' || sourceOrgId === 'global') {
    throw new Error('The shared global corpus is not a tenant workspace');
  }
}

export function sourceWorkspaceFilter(sourceOrgId?: string): Filter<Document> {
  return sourceOrgId
    ? { orgId: sourceOrgId }
    : { $or: [{ orgId: { $exists: false } }, { orgId: null }, { orgId: '' }] };
}

export async function planWorkspaceMigration(
  db: Db,
  targetOrgId: string,
  sourceOrgId?: string
): Promise<{ total: number; counts: Record<string, number> }> {
  validateWorkspaceMove(targetOrgId, sourceOrgId);
  const filter = sourceWorkspaceFilter(sourceOrgId);
  if (await db.collection('integration_credentials').findOne(filter)) {
    throw new Error('Disconnect and reconnect encrypted integrations separately before workspace migration');
  }
  if (await db.collection('outbox_events').findOne({
    ...filter, status: { $ne: 'completed' },
  })) {
    throw new Error('Drain and reconcile all source outbox events before migration');
  }
  const counts: Record<string, number> = {};
  let total = 0;
  const occupied: string[] = [];
  for (const name of TENANT_COLLECTIONS) {
    const collection = db.collection(name);
    counts[name] = await collection.countDocuments(filter);
    total += counts[name];
    if (await collection.findOne({ orgId: targetOrgId }, { projection: { _id: 1 } })) {
      occupied.push(name);
    }
  }
  if (total && occupied.length) {
    throw new Error(
      `Target workspace is not empty (${occupied.join(', ')}). ` +
      'Tenant merges require a separate collision/reference reconciliation plan.'
    );
  }
  if (total > MAX_ATOMIC_MIGRATION_RECORDS) {
    throw new Error(
      `Migration has ${total} records; the atomic tool supports at most ` +
      `${MAX_ATOMIC_MIGRATION_RECORDS}. Use a rehearsed resumable migration for larger tenants.`
    );
  }
  return { total, counts };
}

/** All canonical ownership changes share one transaction; failure aborts all. */
export async function applyWorkspaceMigration(
  db: Db,
  session: ClientSession,
  targetOrgId: string,
  sourceOrgId?: string
): Promise<number> {
  validateWorkspaceMove(targetOrgId, sourceOrgId);
  const filter = sourceWorkspaceFilter(sourceOrgId);
  let migrated = 0;
  await session.withTransaction(async () => {
    // Reset on transaction retries; no progress is reported before commit.
    migrated = 0;
    if (await db.collection('integration_credentials').findOne(filter, { session })) {
      throw new Error('Encrypted integration credentials cannot be relabeled to another workspace');
    }
    if (await db.collection('outbox_events').findOne({
      ...filter, status: { $ne: 'completed' },
    }, { session })) {
      throw new Error('Source outbox changed after preflight; migration aborted');
    }
    for (const name of TENANT_COLLECTIONS) {
      const collection = db.collection(name);
      if (await collection.findOne({ orgId: targetOrgId }, { session, projection: { _id: 1 } })) {
        throw new Error('Target workspace changed after preflight; migration aborted');
      }
    }
    let total = 0;
    for (const name of TENANT_COLLECTIONS) {
      total += await db.collection(name).countDocuments(filter, { session });
    }
    if (total > MAX_ATOMIC_MIGRATION_RECORDS) {
      throw new Error('Source grew beyond the atomic migration limit');
    }
    for (const name of TENANT_COLLECTIONS) {
      const collection = db.collection(name);
      if (REBUILT_COLLECTIONS.has(name)) {
        // These IDs embed workspace identity. Delete derived source rows rather
        // than relabeling them; rebuild under the target's deterministic IDs.
        const result = await collection.deleteMany(filter, { session });
        migrated += result.deletedCount;
      } else {
        const result = await collection.updateMany(
          filter, { $set: { orgId: targetOrgId } }, { session }
        );
        migrated += result.modifiedCount;
      }
      if (await collection.countDocuments(filter, { session })) {
        throw new Error(`Ownership verification failed for ${name}`);
      }
    }
    if (migrated !== total) {
      throw new Error('Migration count verification failed');
    }
  });
  return migrated;
}

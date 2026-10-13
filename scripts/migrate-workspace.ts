import mongoose from 'mongoose';

const TENANT_COLLECTIONS = [
  'orders',
  'inventory',
  'feedback',
  'errors',
  'conversations',
  'promotion_schemes',
  'coupons',
  'customer_signals',
  'promotion_audits',
  'scheme_daily_stats',
  'scheme_issue_jobs',
] as const;

function argumentValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length).trim();
}

async function main(): Promise<void> {
  const mongoUri = process.env.MONGO_URI?.trim();
  const targetOrgId = argumentValue('to') || process.env.DEFAULT_ORG_ID?.trim();
  const sourceOrgId = argumentValue('from');
  const apply = process.argv.includes('--apply');

  if (!mongoUri) {
    throw new Error('MONGO_URI is required');
  }
  if (!targetOrgId) {
    throw new Error('DEFAULT_ORG_ID or --to=<workspace> is required');
  }
  if (sourceOrgId === targetOrgId) {
    throw new Error('--from and --to must identify different workspaces');
  }

  await mongoose.connect(mongoUri, {
    dbName: 'store_db',
    bufferCommands: false,
  });

  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection is unavailable');

    const filter = sourceOrgId
      ? { orgId: sourceOrgId }
      : {
          $or: [
            { orgId: { $exists: false } },
            { orgId: null },
            { orgId: '' },
          ],
        };

    console.log(
      `${apply ? 'Applying' : 'Dry run for'} workspace migration to "${targetOrgId}"` +
        (sourceOrgId ? ` from "${sourceOrgId}"` : ' for records without a workspace')
    );

    let total = 0;
    for (const collectionName of TENANT_COLLECTIONS) {
      const collection = db.collection(collectionName);
      const count = await collection.countDocuments(filter);
      total += count;
      if (apply && count > 0) {
        const result = await collection.updateMany(filter, {
          $set: { orgId: targetOrgId },
        });
        console.log(`${collectionName}: ${result.modifiedCount}/${count} migrated`);
      } else {
        console.log(`${collectionName}: ${count} ${apply ? 'migrated' : 'would migrate'}`);
      }
    }

    console.log(
      apply
        ? `Migration complete: ${total} matching records processed.`
        : `Dry run complete: ${total} records would migrate. Re-run with --apply after review.`
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

import mongoose from 'mongoose';
import {
  applyWorkspaceMigration,
  planWorkspaceMigration,
} from '../lib/migrations/workspace';

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

    console.log(
      `${apply ? 'Applying' : 'Dry run for'} workspace migration to "${targetOrgId}"` +
        (sourceOrgId ? ` from "${sourceOrgId}"` : ' for records without a workspace')
    );

    const plan = await planWorkspaceMigration(db, targetOrgId, sourceOrgId);
    for (const [collectionName, count] of Object.entries(plan.counts)) {
      console.log(`${collectionName}: ${count} would migrate`);
    }
    let migrated = 0;
    if (apply && plan.total > 0) {
      const session = await mongoose.startSession();
      try {
        migrated = await applyWorkspaceMigration(db, session, targetOrgId, sourceOrgId);
      } finally {
        await session.endSession();
      }
    }

    console.log(
      apply
        ? `Migration committed atomically: ${migrated} records processed. Rebuild projections for the target workspace before use.`
        : `Dry run complete: ${plan.total} records would migrate. Take a backup and pause tenant writes before --apply.`
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

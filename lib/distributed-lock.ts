import { dbConnect } from './mongodb';

export interface LockResult {
  acquired: boolean;
}

export async function acquireLock(key: string, ttlMs: number, owner: string): Promise<boolean> {
  try {
    const conn = await dbConnect();
    const col: any = conn.connection.db!.collection('distributed_locks');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    // Try atomic steal of expired or insert if missing via findOneAndUpdate with upsert and filter on expiry
    // First, try to insert if not exists
    try {
      await col.insertOne({ _id: key as any, owner, expiresAt, createdAt: now } as any);
      return true;
    } catch (e: any) {
      if (e?.code !== 11000) throw e;
      // Duplicate — check if expired, then try to steal
      const existing = await col.findOne({ _id: key } as any);
      if (!existing) return false;
      const exp = (existing as any).expiresAt ? new Date((existing as any).expiresAt) : null;
      if (exp && exp < now) {
        const raw = await col.findOneAndUpdate(
          { _id: key, expiresAt: { $lt: now } } as any,
          { $set: { owner, expiresAt: new Date(Date.now() + ttlMs), createdAt: now } },
          { returnDocument: 'after' } as any
        );
        const doc: any = (raw as any)?.value ?? raw;
        return !!doc;
      }
      return false;
    }
  } catch (e) {
    // Never grant a lock when the database cannot confirm ownership.
    console.warn('acquireLock failed:', e instanceof Error ? e.message : e);
    return false;
  }
}

export async function releaseLock(key: string, owner?: string): Promise<void> {
  try {
    const conn = await dbConnect();
    const col: any = conn.connection.db!.collection('distributed_locks');
    if (owner) {
      await col.deleteOne({ _id: key as any, owner } as any);
    } else {
      await col.deleteOne({ _id: key as any } as any);
    }
  } catch (e) {
    console.warn('releaseLock failed:', e instanceof Error ? e.message : e);
  }
}

export async function refreshLock(key: string, ttlMs: number, owner: string): Promise<boolean> {
  try {
    const conn = await dbConnect();
    const col: any = conn.connection.db!.collection('distributed_locks');
    const res = await col.updateOne({ _id: key as any, owner } as any, { $set: { expiresAt: new Date(Date.now() + ttlMs) } });
    return (res as any).modifiedCount > 0;
  } catch {
    return false;
  }
}

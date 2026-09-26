// Nightly public-data importer: Open Food Facts + USAspending + Open-Meteo /
// Nager.Date holidays + Frankfurter INR rates, materialized into
// `demo_public_daily`. Follows scripts/import-uci-retail.ts conventions
// (loadEnvConfig, mongoose bulkWrite, data_imports ledger, flags).
//
// Attribution:
// - Open Food Facts — ODbL 1.0 (https://world.openfoodfacts.org)
// - USAspending.gov awards — U.S. public domain (https://www.usaspending.gov)
// - Open-Meteo forecast — CC-BY 4.0 (https://open-meteo.com)
// - Nager.Date holidays — public domain / DBAD (https://date.nager.at)
// - Frankfurter FX rates — public-domain ECB reference data (https://frankfurter.app)
import { loadEnvConfig } from '@next/env';
import mongoose from 'mongoose';
import type { AnyBulkWriteOperation } from 'mongodb';

interface StringIdDocument {
  _id: string;
  [key: string]: unknown;
}

type BulkOperation = AnyBulkWriteOperation<StringIdDocument>;

loadEnvConfig(process.cwd());

const SOURCE_ID = 'public-daily';
const OFF_SOURCE = 'public-daily:off';
const BATCH_SIZE = 1_000;

const args = new Set(process.argv.slice(2));
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = Number(limitArg?.split('=')[1] ?? process.env.npm_config_limit) || Number.POSITIVE_INFINITY;
const reset = args.has('--reset') || process.env.npm_config_reset === 'true';
const dryRun = args.has('--dry-run') || process.env.npm_config_dry_run === 'true';

interface SourceStats {
  read: number;
  written: number;
  skipped: number;
}

function newStats(): SourceStats {
  return { read: 0, written: 0, skipped: 0 };
}

// ---------- cleaning helpers (enforced for every record) ----------

function cleanStr(value: unknown, max: number): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, max);
}

function hashStr(key: string): number {
  let hash = 2166136261;
  for (const char of key) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clampQty(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.max(1, Math.min(100_000, Math.round(value)));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(value).getTime());
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown | null> {
  const response = await fetch(url, init);
  if (!response.ok) return null;
  return (await response.json()) as unknown;
}

// ---------- source (a): Open Food Facts slice -> demo_public_products ----------

interface OffProduct {
  code?: unknown;
  product_name?: unknown;
  brands?: unknown;
  categories?: unknown;
  quantity?: unknown;
}

async function importOffProducts(operations: BulkOperation[], stats: SourceStats): Promise<void> {
  const base = 'https://world.openfoodfacts.org/api/v2/search';
  for (let page = 1; page <= 3; page++) {
    if (stats.read >= limit) break;
    const url = `${base}?fields=code,product_name,brands,categories,quantity&page_size=100&page=${page}`;
    let payload: { products?: OffProduct[] } | null = null;
    try {
      payload = (await fetchJson(url, {
        headers: { 'User-Agent': 'Omni-Order/1.0 (nightly-public-import)' },
      })) as { products?: OffProduct[] } | null;
    } catch (error) {
      console.warn(`[off] page ${page} fetch failed, stopping OFF slice:`, error instanceof Error ? error.message : error);
      break;
    }
    if (!payload || !Array.isArray(payload.products) || payload.products.length === 0) {
      if (!payload) console.warn(`[off] page ${page} returned non-OK status, stopping OFF slice`);
      break;
    }
    for (const raw of payload.products) {
      if (stats.read >= limit) break;
      stats.read++;
      const code = cleanStr(raw.code, 40);
      const name = cleanStr(raw.product_name, 120);
      if (!code || !name) {
        stats.skipped++;
        continue;
      }
      const categoriesRaw = cleanStr(raw.categories, 200);
      const firstCategory = (categoriesRaw.split(',')[0] ?? '').trim().slice(0, 80);
      const category = firstCategory || cleanStr(raw.brands, 80) || 'Grocery';
      // Deterministic synthesized INR price (> 0) and stock from the code hash.
      const hash = hashStr(code);
      const priceINR = roundMoney(20 + (hash % 198_000) / 100);
      const stockOnHand = clampQty(10 + (hash % 990)) ?? 10;
      const id = `${OFF_SOURCE}:${code}`;
      operations.push({
        replaceOne: {
          filter: { _id: id },
          replacement: {
            _id: id,
            sourceId: OFF_SOURCE,
            code,
            name,
            category,
            packSize: cleanStr(raw.quantity, 40) || undefined,
            brand: cleanStr(raw.brands, 80) || undefined,
            priceINR,
            stockOnHand,
          },
          upsert: true,
        },
      });
      stats.written++;
      if (operations.length >= BATCH_SIZE) await flushOps('demo_public_products', operations);
    }
    if (payload.products.length < 100) break;
  }
}

// ---------- source (b): USAspending recent awards -> demo_public_orders ----------

interface ParsedAward {
  dateKey: string;
  grossValue: number;
  units: number;
  dealerCode: string;
}

async function importAwards(
  operations: BulkOperation[],
  stats: SourceStats,
  parsed: ParsedAward[],
  windowEnd: Date
): Promise<void> {
  const windowStart = new Date(windowEnd);
  windowStart.setUTCDate(windowStart.getUTCDate() - 7);
  const requestBody = {
    filters: {
      award_type_codes: ['A', 'B', 'C', 'D'],
      time_period: [{ start_date: isoDate(windowStart), end_date: isoDate(windowEnd) }],
    },
    fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Action Date', 'Awarding Agency'],
    page: 1,
    limit: 100,
    sort: 'Award Amount',
    order: 'desc',
  };
  let payload: { results?: Array<Record<string, unknown>> } | null = null;
  try {
    payload = (await fetchJson('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })) as { results?: Array<Record<string, unknown>> } | null;
  } catch (error) {
    console.warn('[usaspending] fetch failed, skipping awards source:', error instanceof Error ? error.message : error);
    return;
  }
  if (!payload || !Array.isArray(payload.results)) {
    console.warn('[usaspending] non-OK response, skipping awards source');
    return;
  }
  for (const row of payload.results) {
    if (stats.read >= limit) break;
    stats.read++;
    const awardId = cleanStr(row['Award ID'] ?? row['award_id'], 60);
    const recipient = cleanStr(row['Recipient Name'] ?? row['recipient_name'], 120);
    const amount = Number(row['Award Amount'] ?? row['award_amount']);
    if (!awardId || !recipient) {
      stats.skipped++;
      continue;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      stats.skipped++;
      continue;
    }
    const rawDate = cleanStr(row['Action Date'] ?? row['action_date'], 10);
    const actionDate = isIsoDate(rawDate) ? new Date(rawDate) : windowEnd;
    const dateKey = isoDate(actionDate);
    if (!isIsoDate(dateKey)) {
      stats.skipped++;
      continue;
    }
    const units = clampQty(1 + (hashStr(awardId) % 50)) ?? 1;
    const slug = awardId.replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase() || String(hashStr(awardId));
    const dealerCode = `USA-${slug}`;
    const id = `${SOURCE_ID}:award:${awardId}`;
    operations.push({
      replaceOne: {
        filter: { _id: id },
        replacement: {
          _id: id,
          sourceId: SOURCE_ID,
          awardId,
          dealerCode,
          dealerName: recipient,
          agency: cleanStr(row['Awarding Agency'] ?? row['awarding_agency'], 120) || undefined,
          country: 'USA',
          grossValue: roundMoney(amount),
          units,
          activityDate: dateKey,
          activityAt: actionDate,
        },
        upsert: true,
      },
    });
    parsed.push({ dateKey, grossValue: roundMoney(amount), units, dealerCode });
    stats.written++;
  }
}

// ---------- source (c): weather + holidays + FX -> demo_public_signals ----------

const HUBS = [
  { hub: 'IN-Delhi', country: 'IN', lat: 28.61, lon: 77.2 },
  { hub: 'GB-London', country: 'GB', lat: 51.5, lon: -0.12 },
  { hub: 'US-NewYork', country: 'US', lat: 40.71, lon: -74.0 },
] as const;

interface DailySignal {
  dateKey: string;
  tempMax: number;
  isHoliday: boolean;
}

async function importSignals(
  operations: BulkOperation[],
  stats: SourceStats,
  dailySignals: DailySignal[],
  today: Date
): Promise<void> {
  let usdInr = 0;
  try {
    const fx = (await fetchJson('https://api.frankfurter.app/latest?from=USD&to=INR')) as {
      rates?: Record<string, number>;
    } | null;
    const rate = fx?.rates?.INR;
    if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) usdInr = rate;
    else console.warn('[fx] Frankfurter returned no usable INR rate, storing 0');
  } catch (error) {
    console.warn('[fx] Frankfurter fetch failed, storing usdInr=0:', error instanceof Error ? error.message : error);
  }

  const year = today.getUTCFullYear();
  const holidaysByCountry = new Map<string, Set<string>>();
  for (const country of ['IN', 'US', 'GB']) {
    try {
      const days = (await fetchJson(`https://date.nager.at/api/v3/publicholidays/${year}/${country}`)) as Array<{
        date?: unknown;
      }> | null;
      const set = new Set<string>();
      if (Array.isArray(days)) {
        for (const day of days) {
          const dateKey = cleanStr(day.date, 10);
          if (isIsoDate(dateKey)) set.add(dateKey);
        }
      }
      holidaysByCountry.set(country, set);
    } catch (error) {
      console.warn(`[holidays] ${country} fetch failed, treating as no holidays:`, error instanceof Error ? error.message : error);
      holidaysByCountry.set(country, new Set());
    }
  }

  for (const hub of HUBS) {
    let payload: {
      daily?: { time?: unknown; temperature_2m_max?: unknown; precipitation_sum?: unknown };
    } | null = null;
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${hub.lat}&longitude=${hub.lon}` +
        `&daily=temperature_2m_max,precipitation_sum&timezone=auto&forecast_days=7`;
      payload = (await fetchJson(url)) as {
        daily?: { time?: unknown; temperature_2m_max?: unknown; precipitation_sum?: unknown };
      } | null;
    } catch (error) {
      console.warn(`[meteo] ${hub.hub} fetch failed, skipping hub:`, error instanceof Error ? error.message : error);
      continue;
    }
    if (!payload || !Array.isArray(payload.daily?.time)) {
      console.warn(`[meteo] ${hub.hub} returned no daily series, skipping hub`);
      continue;
    }
    const times = payload.daily.time as unknown[];
    const temps = (Array.isArray(payload.daily.temperature_2m_max) ? payload.daily.temperature_2m_max : []) as unknown[];
    const precips = (Array.isArray(payload.daily.precipitation_sum) ? payload.daily.precipitation_sum : []) as unknown[];
    for (let i = 0; i < times.length; i++) {
      if (stats.read >= limit) break;
      stats.read++;
      const dateKey = cleanStr(times[i], 10);
      const tempMax = Number(temps[i]);
      const precip = Number(precips[i] ?? 0);
      if (!isIsoDate(dateKey) || !Number.isFinite(tempMax)) {
        stats.skipped++;
        continue;
      }
      const isHoliday = holidaysByCountry.get(hub.country)?.has(dateKey) ?? false;
      const id = `${SOURCE_ID}:signal:${hub.hub}:${dateKey}`;
      operations.push({
        replaceOne: {
          filter: { _id: id },
          replacement: {
            _id: id,
            sourceId: SOURCE_ID,
            hub: hub.hub,
            country: hub.country,
            date: dateKey,
            tempMax: roundMoney(tempMax),
            precip: Number.isFinite(precip) && precip >= 0 ? roundMoney(precip) : 0,
            isHoliday,
            usdInr,
          },
          upsert: true,
        },
      });
      dailySignals.push({ dateKey, tempMax, isHoliday });
      stats.written++;
      if (operations.length >= BATCH_SIZE) await flushOps('demo_public_signals', operations);
    }
  }
}

// ---------- shared write helpers ----------

async function flushOps(collection: string, operations: BulkOperation[]): Promise<void> {
  if (operations.length === 0) return;
  if (dryRun) {
    console.log(`[dry-run] would write ${operations.length} ops to ${collection}`);
    operations.length = 0;
    return;
  }
  await mongoose.connection.db!.collection<StringIdDocument>(collection).bulkWrite(operations, { ordered: false });
  operations.length = 0;
}

async function ensureIndexes(): Promise<void> {
  const db = mongoose.connection.db!;
  await Promise.all([
    db.collection('demo_public_products').createIndex({ sourceId: 1, name: 1 }),
    db.collection('demo_public_products').createIndex({ sourceId: 1, category: 1 }),
    db.collection('demo_public_orders').createIndex({ sourceId: 1, activityDate: -1 }),
    db.collection('demo_public_orders').createIndex({ sourceId: 1, dealerCode: 1 }),
    db.collection('demo_public_signals').createIndex({ sourceId: 1, date: -1 }),
    db.collection('demo_public_signals').createIndex({ sourceId: 1, hub: 1, date: -1 }),
    db.collection('demo_public_daily').createIndex({ sourceId: 1, date: -1 }),
    db.collection('data_imports').createIndex({ sourceId: 1, startedAt: -1 }),
  ]);
}

async function main(): Promise<void> {
  console.log('Attribution: Open Food Facts data (ODbL 1.0, https://world.openfoodfacts.org)');
  console.log('Attribution: USAspending.gov awards (U.S. public domain, https://www.usaspending.gov)');
  console.log('Attribution: Open-Meteo forecast (CC-BY 4.0, https://open-meteo.com)');
  console.log('Attribution: Nager.Date holidays (public domain, https://date.nager.at)');
  console.log('Attribution: Frankfurter FX rates (public-domain ECB data, https://frankfurter.app)');
  if (dryRun) console.log('Dry-run mode: validating only, zero writes.');
  if (Number.isFinite(limit)) console.log(`Record cap per source: ${limit}`);

  const uri = process.env.MONGO_URI;
  if (!uri && !dryRun) throw new Error('MONGO_URI is required');
  if (uri && !dryRun) {
    await mongoose.connect(uri, { dbName: 'store_db', bufferCommands: false });
  }
  const db = dryRun ? null : mongoose.connection.db!;

  const today = new Date();
  const importId = `${SOURCE_ID}:${today.toISOString()}`;
  const imports = dryRun ? null : db!.collection<StringIdDocument>('data_imports');

  if (!dryRun) {
    if (reset) {
      console.log('Resetting public-daily demo collections');
      await Promise.all(
        ['demo_public_products', 'demo_public_orders', 'demo_public_signals', 'demo_public_daily'].map((name) =>
          db!.collection(name).deleteMany({ sourceId: { $in: [SOURCE_ID, OFF_SOURCE] } })
        )
      );
    }
    await imports!.updateMany(
      { sourceId: SOURCE_ID, status: 'running' },
      { $set: { status: 'interrupted', interruptedAt: new Date() } }
    );
    await imports!.insertOne({
      _id: importId,
      sourceId: SOURCE_ID,
      status: 'running',
      startedAt: new Date(),
      rowsRead: 0,
    });
  }

  const productOps: BulkOperation[] = [];
  const orderOps: BulkOperation[] = [];
  const signalOps: BulkOperation[] = [];
  const parsedAwards: ParsedAward[] = [];
  const dailySignals: DailySignal[] = [];
  const productStats = newStats();
  const awardStats = newStats();
  const signalStats = newStats();

  try {
    try {
      await importOffProducts(productOps, productStats);
    } catch (error) {
      console.warn('[off] source failed, continuing with others:', error instanceof Error ? error.message : error);
    }
    try {
      await importAwards(orderOps, awardStats, parsedAwards, today);
    } catch (error) {
      console.warn('[usaspending] source failed, continuing with others:', error instanceof Error ? error.message : error);
    }
    try {
      await importSignals(signalOps, signalStats, dailySignals, today);
    } catch (error) {
      console.warn('[signals] source failed, continuing:', error instanceof Error ? error.message : error);
    }

    await Promise.all([
      flushOps('demo_public_products', productOps),
      flushOps('demo_public_orders', orderOps),
      flushOps('demo_public_signals', signalOps),
    ]);

    // Materialize demo_public_daily from awards grouped by date + signal averages.
    const byDate = new Map<string, { revenue: number; units: number; orders: number; dealers: Set<string> }>();
    for (const award of parsedAwards) {
      const day = byDate.get(award.dateKey) ?? { revenue: 0, units: 0, orders: 0, dealers: new Set<string>() };
      day.revenue += award.grossValue;
      day.units += award.units;
      day.orders += 1;
      day.dealers.add(award.dealerCode);
      byDate.set(award.dateKey, day);
    }
    const tempsByDate = new Map<string, number[]>();
    const holidayByDate = new Map<string, boolean>();
    for (const signal of dailySignals) {
      const list = tempsByDate.get(signal.dateKey) ?? [];
      list.push(signal.tempMax);
      tempsByDate.set(signal.dateKey, list);
      holidayByDate.set(signal.dateKey, (holidayByDate.get(signal.dateKey) ?? false) || signal.isHoliday);
    }
    const dailyOps: BulkOperation[] = [];
    for (const [dateKey, day] of byDate) {
      const temps = tempsByDate.get(dateKey) ?? [];
      const avgTemp = temps.length ? roundMoney(temps.reduce((sum, t) => sum + t, 0) / temps.length) : 0;
      dailyOps.push({
        replaceOne: {
          filter: { _id: `${SOURCE_ID}:${dateKey}` },
          replacement: {
            _id: `${SOURCE_ID}:${dateKey}`,
            sourceId: SOURCE_ID,
            date: dateKey,
            revenue: roundMoney(day.revenue),
            units: day.units,
            orders: day.orders,
            activeDealers: day.dealers.size,
            avgTemp,
            isHoliday: holidayByDate.get(dateKey) ?? false,
          },
          upsert: true,
        },
      });
    }
    await flushOps('demo_public_daily', dailyOps);

    if (!dryRun) {
      // Daily snapshot is a complete replacement for this source window.
      await db!.collection<StringIdDocument>('demo_public_daily').deleteMany({ sourceId: SOURCE_ID, _id: { $nin: [...byDate.keys()].map((d) => `${SOURCE_ID}:${d}`) } });
      await ensureIndexes();
      await imports!.updateOne(
        { _id: importId },
        {
          $set: {
            status: 'completed',
            completedAt: new Date(),
            rowsRead: productStats.read + awardStats.read + signalStats.read,
            products: productStats.written,
            orders: awardStats.written,
            signals: signalStats.written,
            days: byDate.size,
            skipped: productStats.skipped + awardStats.skipped + signalStats.skipped,
          },
        }
      );
    }

    console.log(
      `Public-daily import ${dryRun ? '(dry-run) ' : ''}complete: ` +
        `products read=${productStats.read} written=${productStats.written} skipped=${productStats.skipped}; ` +
        `awards read=${awardStats.read} written=${awardStats.written} skipped=${awardStats.skipped}; ` +
        `signals read=${signalStats.read} written=${signalStats.written} skipped=${signalStats.skipped}; ` +
        `days=${byDate.size}.`
    );
  } catch (error) {
    if (!dryRun) {
      await imports!.updateOne(
        { _id: importId },
        {
          $set: {
            status: 'failed',
            failedAt: new Date(),
            error: error instanceof Error ? error.message : String(error),
            rowsRead: productStats.read + awardStats.read + signalStats.read,
          },
        }
      );
    }
    throw error;
  } finally {
    if (!dryRun && mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

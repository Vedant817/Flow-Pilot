import { loadEnvConfig } from '@next/env';
import { createWriteStream } from 'node:fs';
import { mkdir, access, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import type { AnyBulkWriteOperation } from 'mongodb';
import ExcelJS from 'exceljs';
import unzipper from 'unzipper';
import { calculateDealerEnrichment, demoOrderStatus, roundMoney } from '@/lib/demo/network-metrics';

interface StringIdDocument {
  _id: string;
  [key: string]: unknown;
}

type BulkOperation = AnyBulkWriteOperation<StringIdDocument>;

loadEnvConfig(process.cwd());

const SOURCE_URL = 'https://archive.ics.uci.edu/static/public/352/online+retail.zip';
const SOURCE_ID = 'uci-online-retail-352';
const SOURCE_MAX_DATE = new Date('2011-12-09T23:59:59Z');
const DATA_DIR = path.join(process.cwd(), '.data', SOURCE_ID);
const ZIP_PATH = path.join(DATA_DIR, 'online-retail.zip');
const XLSX_PATH = path.join(DATA_DIR, 'Online Retail.xlsx');
const BATCH_SIZE = 1_000;

interface ProductLine {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineValue: number;
}

interface InvoiceAccumulator {
  invoiceNo: string;
  customerId: string;
  country: string;
  sourceDate: Date;
  activityDate: Date;
  products: ProductLine[];
  grossValue: number;
  units: number;
  isCancellation: boolean;
}

interface DealerAccumulator {
  customerId: string;
  country: string;
  firstOrder: Date;
  lastOrder: Date;
  revenue: number;
  returnValue: number;
  units: number;
  returnedUnits: number;
  invoices: Set<string>;
}

interface ProductAccumulator {
  sku: string;
  name: string;
  revenue: number;
  returnValue: number;
  units: number;
  returnedUnits: number;
  lastOrder: Date;
  unitPrice: number;
}

interface DailyAccumulator {
  date: string;
  revenue: number;
  returnValue: number;
  units: number;
  returnedUnits: number;
  invoices: Set<string>;
  customers: Set<string>;
}

const args = new Set(process.argv.slice(2));
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const resumeArg = process.argv.find((arg) => arg.startsWith('--resume-lines='));
const limit = Number(limitArg?.split('=')[1] ?? process.env.npm_config_limit) || Number.POSITIVE_INFINITY;
const resumeLines = Number(resumeArg?.split('=')[1] ?? process.env.npm_config_resume_lines) || 0;
const reset = args.has('--reset') || process.env.npm_config_reset === 'true';
const preserveDates = args.has('--preserve-dates');
const viewsOnly = args.has('--views-only') || process.env.npm_config_views_only === 'true';

function shiftedDate(sourceDate: Date): Date {
  if (preserveDates) return sourceDate;
  const targetMax = new Date();
  targetMax.setUTCDate(targetMax.getUTCDate() - 1);
  return new Date(sourceDate.getTime() + (targetMax.getTime() - SOURCE_MAX_DATE.getTime()));
}

function excelDate(value: ExcelJS.CellValue): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    // XLSX stores dates as days since the Excel 1900 epoch. Streaming with
    // styles disabled intentionally exposes the raw serial instead of Date.
    const parsed = new Date(Math.round((value - 25_569) * 86_400_000));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function clean(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('text' in value) return String(value.text).trim();
    if ('result' in value) return String(value.result ?? '').trim();
  }
  return String(value).trim();
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function prepareDataset(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  if (!(await exists(ZIP_PATH))) {
    console.log(`Downloading ${SOURCE_URL}`);
    const response = await fetch(SOURCE_URL);
    if (!response.ok || !response.body) throw new Error(`Dataset download failed: ${response.status}`);
    await pipeline(
      Readable.from(response.body as unknown as AsyncIterable<Uint8Array>),
      createWriteStream(ZIP_PATH)
    );
  }

  if (!(await exists(XLSX_PATH))) {
    console.log('Extracting Online Retail.xlsx');
    const archive = await unzipper.Open.file(ZIP_PATH);
    const workbook = archive.files.find((file) => file.path.toLowerCase().endsWith('.xlsx'));
    if (!workbook) throw new Error('Official archive did not contain an XLSX workbook');
    await pipeline(workbook.stream(), createWriteStream(XLSX_PATH));
  }
}

async function flushOps(collection: string, operations: BulkOperation[]): Promise<void> {
  if (operations.length === 0) return;
  await mongoose.connection.db!.collection<StringIdDocument>(collection).bulkWrite(operations, { ordered: false });
  operations.length = 0;
}

async function main(): Promise<void> {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is required');

  await prepareDataset();
  await mongoose.connect(uri, { dbName: 'store_db', bufferCommands: false });
  const db = mongoose.connection.db!;

  if (reset) {
    console.log('Resetting UCI demo workspace collections');
    await Promise.all([
      'demo_uci_lines',
      'demo_uci_orders',
      'demo_uci_returns',
      'demo_uci_dealers',
      'demo_uci_products',
      'demo_uci_daily',
    ].map((name) => db.collection(name).deleteMany({ sourceId: SOURCE_ID })));
  }

  const importId = `${SOURCE_ID}:${new Date().toISOString()}`;
  await db.collection('data_imports').updateMany(
    { sourceId: SOURCE_ID, status: 'running' },
    { $set: { status: 'interrupted', interruptedAt: new Date() } }
  );
  const imports = db.collection<StringIdDocument>('data_imports');
  await imports.insertOne({
    _id: importId,
    sourceId: SOURCE_ID,
    sourceUrl: SOURCE_URL,
    license: 'CC BY 4.0',
    status: 'running',
    startedAt: new Date(),
    rowsRead: 0,
  });

  const lineOps: BulkOperation[] = [];
  const orderOps: BulkOperation[] = [];
  const returnOps: BulkOperation[] = [];
  const dealers = new Map<string, DealerAccumulator>();
  const products = new Map<string, ProductAccumulator>();
  const daily = new Map<string, DailyAccumulator>();
  let currentInvoice: InvoiceAccumulator | null = null;
  let rowsRead = 0;
  let invoicesWritten = 0;

  const flushInvoice = async () => {
    if (!currentInvoice || currentInvoice.products.length === 0) return;
    const fact = {
      _id: `${SOURCE_ID}:${currentInvoice.invoiceNo}`,
      sourceId: SOURCE_ID,
      invoiceNo: currentInvoice.invoiceNo,
      customerId: currentInvoice.customerId,
      dealerCode: `UCI-${currentInvoice.customerId}`,
      country: currentInvoice.country,
      sourceDate: currentInvoice.sourceDate,
      activityAt: currentInvoice.activityDate,
      activityDate: currentInvoice.activityDate.toISOString().slice(0, 10),
      products: currentInvoice.products,
      grossValue: roundMoney(Math.abs(currentInvoice.grossValue)),
      units: Math.abs(currentInvoice.units),
      status: currentInvoice.isCancellation ? 'returned' : demoOrderStatus(currentInvoice.invoiceNo),
      sourceLineage: { dataset: SOURCE_ID, invoiceNo: currentInvoice.invoiceNo },
    };
    const op = {
      replaceOne: {
        filter: { _id: fact._id },
        replacement: fact,
        upsert: true,
      },
    } satisfies BulkOperation;
    if (!viewsOnly) (currentInvoice.isCancellation ? returnOps : orderOps).push(op);
    invoicesWritten++;
    if (orderOps.length >= 500) await flushOps('demo_uci_orders', orderOps);
    if (returnOps.length >= 500) await flushOps('demo_uci_returns', returnOps);
  };

  try {
    const reader = new ExcelJS.stream.xlsx.WorkbookReader(XLSX_PATH, {
      entries: 'emit',
      sharedStrings: 'cache',
      hyperlinks: 'ignore',
      styles: 'ignore',
      worksheets: 'emit',
    });

    for await (const worksheet of reader) {
      for await (const row of worksheet) {
        if (row.number === 1) continue;
        if (rowsRead >= limit) break;

        const invoiceNo = clean(row.getCell(1).value);
        const sku = clean(row.getCell(2).value);
        const description = clean(row.getCell(3).value) || `SKU ${sku}`;
        const quantity = Number(row.getCell(4).value);
        const sourceDate = excelDate(row.getCell(5).value);
        const unitPrice = Number(row.getCell(6).value);
        const rawCustomer = clean(row.getCell(7).value).replace(/\.0$/, '');
        const country = clean(row.getCell(8).value) || 'Unknown';

        if (!invoiceNo || !sku || !sourceDate || !Number.isFinite(quantity) || !Number.isFinite(unitPrice)) continue;
        const customerId = rawCustomer || `ANON-${country.replace(/\W+/g, '-').toUpperCase()}`;
        const activityDate = shiftedDate(sourceDate);
        const isCancellation = invoiceNo.toUpperCase().startsWith('C') || quantity < 0;
        const lineValue = roundMoney(quantity * unitPrice);

        if (currentInvoice && currentInvoice.invoiceNo !== invoiceNo) await flushInvoice();
        if (!currentInvoice || currentInvoice.invoiceNo !== invoiceNo) {
          currentInvoice = {
            invoiceNo,
            customerId,
            country,
            sourceDate,
            activityDate,
            products: [],
            grossValue: 0,
            units: 0,
            isCancellation,
          };
        }

        currentInvoice.products.push({ sku, name: description, quantity: Math.abs(quantity), unitPrice, lineValue: Math.abs(lineValue) });
        currentInvoice.grossValue += lineValue;
        currentInvoice.units += quantity;

        const lineId = `${SOURCE_ID}:${invoiceNo}:${row.number}`;
        if (!viewsOnly && rowsRead >= resumeLines) {
          lineOps.push({
            replaceOne: {
              filter: { _id: lineId },
              replacement: {
                _id: lineId,
                sourceId: SOURCE_ID,
                invoiceNo,
                customerId,
                dealerCode: `UCI-${customerId}`,
                country,
                sku,
                productName: description,
                quantity,
                unitPrice,
                lineValue,
                isCancellation,
                sourceDate,
                activityAt: activityDate,
                activityDate: activityDate.toISOString().slice(0, 10),
                sourceRow: row.number,
              },
              upsert: true,
            },
          });
        }

        const dealer = dealers.get(customerId) ?? {
          customerId,
          country,
          firstOrder: activityDate,
          lastOrder: activityDate,
          revenue: 0,
          returnValue: 0,
          units: 0,
          returnedUnits: 0,
          invoices: new Set<string>(),
        };
        dealer.firstOrder = dealer.firstOrder < activityDate ? dealer.firstOrder : activityDate;
        dealer.lastOrder = dealer.lastOrder > activityDate ? dealer.lastOrder : activityDate;
        dealer.invoices.add(invoiceNo);
        if (isCancellation) {
          dealer.returnValue += Math.abs(lineValue);
          dealer.returnedUnits += Math.abs(quantity);
        } else {
          dealer.revenue += Math.max(0, lineValue);
          dealer.units += Math.max(0, quantity);
        }
        dealers.set(customerId, dealer);

        const product = products.get(sku) ?? {
          sku,
          name: description,
          revenue: 0,
          returnValue: 0,
          units: 0,
          returnedUnits: 0,
          lastOrder: activityDate,
          unitPrice,
        };
        product.name = description;
        product.unitPrice = unitPrice > 0 ? unitPrice : product.unitPrice;
        product.lastOrder = product.lastOrder > activityDate ? product.lastOrder : activityDate;
        if (isCancellation) {
          product.returnValue += Math.abs(lineValue);
          product.returnedUnits += Math.abs(quantity);
        } else {
          product.revenue += Math.max(0, lineValue);
          product.units += Math.max(0, quantity);
        }
        products.set(sku, product);

        const dateKey = activityDate.toISOString().slice(0, 10);
        const day = daily.get(dateKey) ?? {
          date: dateKey,
          revenue: 0,
          returnValue: 0,
          units: 0,
          returnedUnits: 0,
          invoices: new Set<string>(),
          customers: new Set<string>(),
        };
        day.invoices.add(invoiceNo);
        day.customers.add(customerId);
        if (isCancellation) {
          day.returnValue += Math.abs(lineValue);
          day.returnedUnits += Math.abs(quantity);
        } else {
          day.revenue += Math.max(0, lineValue);
          day.units += Math.max(0, quantity);
        }
        daily.set(dateKey, day);

        rowsRead++;
        if (lineOps.length >= BATCH_SIZE) await flushOps('demo_uci_lines', lineOps);
        if (rowsRead % 10_000 === 0) {
          await imports.updateOne({ _id: importId }, { $set: { rowsRead, invoicesWritten, updatedAt: new Date() } });
          console.log(`Processed ${rowsRead.toLocaleString()} lines / ${invoicesWritten.toLocaleString()} invoices`);
        }
      }
      break;
    }

    await flushInvoice();
    await Promise.all([
      flushOps('demo_uci_lines', lineOps),
      flushOps('demo_uci_orders', orderOps),
      flushOps('demo_uci_returns', returnOps),
    ]);

    // Materialized collections are complete snapshots of a fixed source.
    // Replace them by source so interrupted/older runs cannot leave stale days.
    await Promise.all([
      db.collection('demo_uci_dealers').deleteMany({ sourceId: SOURCE_ID }),
      db.collection('demo_uci_products').deleteMany({ sourceId: SOURCE_ID }),
      db.collection('demo_uci_daily').deleteMany({ sourceId: SOURCE_ID }),
    ]);

    const dealerOps: BulkOperation[] = [...dealers.values()].map((dealer) => {
      const orderCount = [...dealer.invoices].filter((id) => !id.toUpperCase().startsWith('C')).length;
      const enrichment = calculateDealerEnrichment({ customerId: dealer.customerId, revenue: dealer.revenue, returnValue: dealer.returnValue, orderCount });
      return {
        replaceOne: {
          filter: { _id: `${SOURCE_ID}:${dealer.customerId}` },
          replacement: {
            _id: `${SOURCE_ID}:${dealer.customerId}`,
            sourceId: SOURCE_ID,
            dealerCode: `UCI-${dealer.customerId}`,
            customerId: dealer.customerId,
            name: dealer.customerId.startsWith('ANON-') ? `${dealer.country} Cash Accounts` : `Dealer ${dealer.customerId}`,
            email: `dealer-${dealer.customerId.toLowerCase()}@demo.flowpilot.local`,
            country: dealer.country,
            territory: dealer.country,
            firstOrder: dealer.firstOrder,
            lastOrder: dealer.lastOrder,
            orderCount,
            revenue: roundMoney(dealer.revenue),
            returnValue: roundMoney(dealer.returnValue),
            returnRate: enrichment.returnRate,
            units: dealer.units,
            creditLimit: enrichment.creditLimit,
            outstanding: enrichment.outstanding,
            overdue: enrichment.overdue,
            creditUtilization: enrichment.creditUtilization,
            riskScore: enrichment.riskScore,
            riskLevel: enrichment.riskLevel,
            serviceLevel: enrichment.serviceLevel,
            status: enrichment.status,
          },
          upsert: true,
        },
      };
    });

    const productOps: BulkOperation[] = [...products.values()].map((product) => ({
      replaceOne: {
        filter: { _id: `${SOURCE_ID}:${product.sku}` },
        replacement: {
          _id: `${SOURCE_ID}:${product.sku}`,
          sourceId: SOURCE_ID,
          ...product,
          revenue: roundMoney(product.revenue),
          returnValue: roundMoney(product.returnValue),
          returnRate: product.revenue ? roundMoney(product.returnValue / product.revenue * 100) : 0,
          stockOnHand: Math.round(Math.max(0, product.units * (0.02 + (product.sku.charCodeAt(0) % 16) / 100))),
        },
        upsert: true,
      },
    }));

    const dailyOps: BulkOperation[] = [...daily.values()].map((day) => ({
      replaceOne: {
        filter: { _id: `${SOURCE_ID}:${day.date}` },
        replacement: {
          _id: `${SOURCE_ID}:${day.date}`,
          sourceId: SOURCE_ID,
          date: day.date,
          revenue: roundMoney(day.revenue),
          returnValue: roundMoney(day.returnValue),
          units: day.units,
          returnedUnits: day.returnedUnits,
          orders: [...day.invoices].filter((id) => !id.toUpperCase().startsWith('C')).length,
          returns: [...day.invoices].filter((id) => id.toUpperCase().startsWith('C')).length,
          activeDealers: day.customers.size,
        },
        upsert: true,
      },
    }));

    for (const [collection, operations] of [
      ['demo_uci_dealers', dealerOps],
      ['demo_uci_products', productOps],
      ['demo_uci_daily', dailyOps],
    ] as const) {
      while (operations.length) await flushOps(collection, operations.splice(0, BATCH_SIZE));
    }

    await ensureIndexes();
    await imports.updateOne({ _id: importId }, {
      $set: {
        status: 'completed',
        completedAt: new Date(),
        rowsRead,
        invoicesWritten,
        dealers: dealers.size,
        products: products.size,
        days: daily.size,
      },
    });

    console.log(`Import complete: ${rowsRead.toLocaleString()} lines, ${invoicesWritten.toLocaleString()} invoices, ${dealers.size.toLocaleString()} dealers, ${products.size.toLocaleString()} products.`);
  } catch (error) {
    await imports.updateOne({ _id: importId }, { $set: { status: 'failed', failedAt: new Date(), error: error instanceof Error ? error.message : String(error), rowsRead } });
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

async function ensureIndexes(): Promise<void> {
  const db = mongoose.connection.db!;
  await Promise.all([
    db.collection('demo_uci_lines').createIndex({ sourceId: 1, activityDate: -1 }),
    db.collection('demo_uci_lines').createIndex({ sourceId: 1, customerId: 1, activityDate: -1 }),
    db.collection('demo_uci_orders').createIndex({ sourceId: 1, activityDate: -1 }),
    db.collection('demo_uci_returns').createIndex({ sourceId: 1, activityDate: -1 }),
    db.collection('demo_uci_dealers').createIndex({ sourceId: 1, riskLevel: 1, revenue: -1 }),
    db.collection('demo_uci_dealers').createIndex({ sourceId: 1, country: 1, revenue: -1 }),
    db.collection('demo_uci_dealers').createIndex({ sourceId: 1, name: 1 }),
    db.collection('demo_uci_products').createIndex({ sourceId: 1, revenue: -1 }),
    db.collection('demo_uci_daily').createIndex({ sourceId: 1, date: -1 }),
    db.collection('data_imports').createIndex({ sourceId: 1, startedAt: -1 }),
  ]);
}

void main().catch(async (error) => {
  console.error(error);
  await rm(XLSX_PATH, { force: true }).catch(() => undefined);
  process.exitCode = 1;
});

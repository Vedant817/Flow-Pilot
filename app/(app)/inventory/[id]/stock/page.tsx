'use client';

import { use, useCallback, useEffect, useState } from 'react';
import type { StockMovementKind } from '@/lib/inventory/ledger';

type Stock = { name: string; quantity: number; reservedQuantity?: number };
type Movement = {
  _id: string; kind: string; at: string; reason: string;
  quantityDelta: number; reservedDelta: number;
  orderId?: string; actorId: string; provenance?: string;
  balanceAfter: { quantity: number; reservedQuantity: number };
};

async function readJson(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Stock request failed');
  return body;
}

export default function StockLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <StockLedger key={id} id={id} />;
}

function StockLedger({ id }: { id: string }) {
  const [stock, setStock] = useState<Stock | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [kind, setKind] = useState<StockMovementKind>('receipt');
  const [units, setUnits] = useState('1');
  const [reason, setReason] = useState('');
  const [orderId, setOrderId] = useState('');
  const [intentKey, setIntentKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [commandError, setCommandError] = useState('');
  const [notice, setNotice] = useState('');
  const base = `/api/inventory/${id}`;
  const linked = ['reserve', 'release', 'fulfill', 'return'].includes(kind);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [item, history] = await Promise.all([
        fetch(base).then(readJson), fetch(`${base}/movements`).then(readJson),
      ]);
      setStock(item); setMovements(history.data); setCursor(history.nextCursor);
      return true;
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Stock data is unavailable');
      return false;
    }
  }, [base]);
  useEffect(() => { void load(); }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(units);
    if (!Number.isSafeInteger(amount) || amount === 0 || (kind !== 'adjustment' && amount < 0)) {
      setCommandError('Use positive whole units, or a signed nonzero adjustment.'); return;
    }
    const key = intentKey ?? crypto.randomUUID();
    setIntentKey(key); setPending(true); setCommandError(''); setNotice('');
    try {
      const result = await fetch(`${base}/movements`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({ kind, units: amount, reason, ...(linked ? { orderId } : {}) }),
      }).then(readJson);
      setNotice(result.dedup ? 'Original movement confirmed; no duplicate was applied.' : 'Movement recorded.');
      if (await load()) {
        setIntentKey(null); setReason(''); setOrderId(''); setUnits('1');
      }
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : 'The result is uncertain.');
    } finally { setPending(false); }
  }

  if (loadError) return <section className="p-6">
    {notice && <p role="status">{notice}</p>}
    <p role="alert">{loadError}</p><button onClick={() => void load()} className="mt-3 rounded border px-4 py-2">Retry stock data</button>
  </section>;
  if (!stock) return <p role="status" className="p-6">Loading stock ledger…</p>;
  const reserved = stock.reservedQuantity ?? 0;

  return <section className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
    <a href="/inventory" className="text-sm underline">Back to inventory</a>
    <header><h1 className="text-2xl font-semibold">{stock.name} — stock ledger</h1>
      <p className="mt-2 text-sm">On hand: {stock.quantity} · Reserved: {reserved} · Available: {stock.quantity - reserved}</p>
    </header>
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-5">
      <h2 className="font-semibold">Record a stock movement</h2>
      <fieldset disabled={pending || intentKey !== null} className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">Movement
          <select value={kind} onChange={event => setKind(event.target.value as StockMovementKind)}
            className="block w-full rounded border border-border bg-background p-2">
            {['receipt', 'adjustment', 'reserve', 'release', 'fulfill', 'return'].map(value =>
              <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">Whole units
          <input type="number" required step="1" value={units} onChange={event => setUnits(event.target.value)}
            className="block w-full rounded border border-border bg-background p-2" />
        </label>
        {linked && <label className="space-y-1 text-sm">Order ID
          <input required value={orderId} onChange={event => setOrderId(event.target.value)}
            className="block w-full rounded border border-border bg-background p-2" />
        </label>}
        <label className="space-y-1 text-sm md:col-span-2">Reason
          <input required maxLength={500} value={reason} onChange={event => setReason(event.target.value)}
            className="block w-full rounded border border-border bg-background p-2" />
        </label>
      </fieldset>
      {commandError && <div role="alert" className="text-sm text-red-500">
        <p>{commandError}</p><p>Retry preserves the same command key. Check the ledger before starting a different movement.</p>
      </div>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
      <button disabled={pending} className="rounded bg-primary px-4 py-2 text-primary-foreground">
        {pending ? 'Recording…' : intentKey ? 'Retry same movement' : 'Record movement'}
      </button>
      {intentKey && !pending && <button type="button" className="ml-3 text-sm underline" onClick={() => {
        if (window.confirm('The previous result may be uncertain. Check the ledger before starting a new movement. Continue?')) {
          setIntentKey(null); setCommandError('');
        }
      }}>Start a different movement</button>}
    </form>
    <section className="space-y-3">
      <h2 className="font-semibold">Movement history</h2>
      {!movements.length && <p className="text-sm">No recorded movements. Legacy stock receives an opening snapshot on its first audited movement.</p>}
      <ol className="space-y-3">
        {movements.map(movement => <li key={movement._id} className="rounded border border-border p-4 text-sm">
          <p className="font-medium">{movement.kind} · on-hand change {movement.quantityDelta} · reservation change {movement.reservedDelta}</p>
          <p>{movement.reason}</p>
          <p>Actor: {movement.actorId}{movement.orderId ? ` · Order: ${movement.orderId}` : ''}</p>
          {movement.provenance === 'legacy_snapshot' && <p>Legacy snapshot — not a reconstruction of earlier stock history.</p>}
          <p className="text-muted-foreground">{new Date(movement.at).toLocaleString()} · after: {movement.balanceAfter.quantity} on hand, {movement.balanceAfter.reservedQuantity} reserved</p>
        </li>)}
      </ol>
      {cursor && <button className="rounded border px-4 py-2" onClick={async () => {
        try {
          const page = await fetch(`${base}/movements?before=${encodeURIComponent(cursor)}`).then(readJson);
          setMovements(previous => [...previous, ...page.data]); setCursor(page.nextCursor);
        } catch (error) { setLoadError(error instanceof Error ? error.message : 'History unavailable'); }
      }}>Load older movements</button>}
    </section>
  </section>;
}

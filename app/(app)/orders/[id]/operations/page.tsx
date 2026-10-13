'use client';
import { use, useEffect, useState } from 'react';

type Line = { productId?: string; name: string; quantity: number };
type Shipment = { _id: string; carrier: string; trackingNumber: string; status: string };
type ReturnCase = { _id: string; status: string; reason: string; lines: Array<{ productId: string; quantity: number; received: number }> };
type View = {
  order: { status: string; products: Line[] }; shipments: Shipment[]; returns: ReturnCase[];
  credits: Array<{ _id: string; amountMinor: number; currency: string; kind: string }>;
  capabilities: { dispatch: boolean; requestReturn: boolean; approveReturn: boolean };
};
async function read(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Operation failed');
  return data;
}
export default function OrderOperationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Operations key={id} id={id} />;
}
function Operations({ id }: { id: string }) {
  const base = `/api/orders/${id}/operations`;
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [action, setAction] = useState('shipment.create');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTracking] = useState('');
  const [targetId, setTargetId] = useState('');
  const [note, setNote] = useState('');
  const [disposition, setDisposition] = useState('restock');
  const [pending, setPending] = useState(false);
  const [intent, setIntent] = useState<{ key: string; body: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(base, { signal: controller.signal }).then(read).then(setView).catch(failure => {
      if (!controller.signal.aborted) setError(failure.message);
    });
    return () => controller.abort();
  }, [base]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const body = JSON.stringify({
      action, carrier, trackingNumber, note, shipmentId: targetId, returnId: targetId,
      lines: [{ productId, quantity: Number(quantity), disposition }],
    });
    const current = intent ?? { key: crypto.randomUUID(), body };
    setIntent(current); setPending(true); setError(''); setNotice('');
    try {
      await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': current.key }, body: current.body }).then(read);
      setNotice('Operation confirmed. Credit memos are accounting records, not payment refunds.');
      try {
        setView(await fetch(base).then(read));
        setIntent(null);
      } catch { setError('Operation confirmed, but the view could not refresh. Retry safely using the same intent.'); }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Result uncertain; retry the same intent.');
    } finally { setPending(false); }
  }
  if (!view) return <section className="p-6">{error ? <p role="alert">{error}</p> : <p role="status">Loading order operations…</p>}</section>;
  const needsLine = ['shipment.create', 'return.request', 'return.receive'].includes(action);
  const choices = [
    ...(view.capabilities.dispatch ? ['shipment.create', 'return.receive'] : []),
    ...(view.capabilities.requestReturn ? ['shipment.deliver', 'return.request'] : []),
    ...(view.capabilities.approveReturn ? ['return.authorize', 'return.reject'] : []),
  ];
  return <section className="mx-auto max-w-5xl space-y-5 p-4 md:p-8">
    <a href="/orders" className="text-sm underline">Back to orders</a>
    <h1 className="text-2xl font-semibold">Dispatch and authorized returns</h1>
    <p className="text-sm">Order status: {view.order.status}. Reserve stock in its ledger before dispatch.</p>
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-card p-5">
      <fieldset disabled={pending || intent !== null} className="grid gap-3 md:grid-cols-2">
        <label>Operation<select value={choices.includes(action) ? action : ''} required onChange={event => setAction(event.target.value)}
          className="block w-full rounded border border-border bg-background p-2">
          <option value="" disabled>Choose operation</option>{choices.map(value => <option key={value}>{value}</option>)}
        </select></label>
        {needsLine && <>
          <label>Product<select value={productId} required onChange={event => setProductId(event.target.value)}
            className="block w-full rounded border border-border bg-background p-2">
            <option value="">Choose canonical product</option>
            {view.order.products.filter(line => line.productId).map((line, index) =>
              <option key={`${line.productId}-${index}`} value={line.productId}>{line.name} ({line.quantity} ordered)</option>)}
          </select></label>
          <label>Whole units<input type="number" min="1" max="100000" step="1" value={quantity} required
            onChange={event => setQuantity(event.target.value)} className="block w-full rounded border border-border bg-background p-2" /></label>
        </>}
        {action === 'shipment.create' && <>
          <label>Carrier<input value={carrier} maxLength={80} required onChange={event => setCarrier(event.target.value)} className="block w-full rounded border border-border bg-background p-2" /></label>
          <label>Tracking reference<input value={trackingNumber} maxLength={160} required onChange={event => setTracking(event.target.value)} className="block w-full rounded border border-border bg-background p-2" /></label>
        </>}
        {!['shipment.create', 'return.request'].includes(action) && <label>Shipment or return ID
          <input value={targetId} required onChange={event => setTargetId(event.target.value)} className="block w-full rounded border border-border bg-background p-2" /></label>}
        {action === 'return.receive' && <label>Inspection disposition<select value={disposition} onChange={event => setDisposition(event.target.value)}
          className="block w-full rounded border border-border bg-background p-2"><option value="restock">Resalable — restock</option><option value="damaged">Damaged — quarantine</option></select></label>}
        <label className="md:col-span-2">Reason / inspection / delivery proof<input value={note} maxLength={500}
          required={action !== 'shipment.create'} onChange={event => setNote(event.target.value)}
          className="block w-full rounded border border-border bg-background p-2" /></label>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
      <button disabled={pending || !choices.includes(action)} className="rounded bg-primary px-4 py-2 text-primary-foreground">
        {pending ? 'Processing…' : intent ? 'Retry same operation' : 'Submit operation'}
      </button>
      {intent && !pending && <button type="button" className="ml-3 underline" onClick={() => {
        if (window.confirm('Check the current operation state before starting a different intent. Continue?')) setIntent(null);
      }}>Start different intent</button>}
    </form>
    <section><h2 className="font-semibold">Shipments — most recent 100</h2>
      {view.shipments.map(shipment => <p key={shipment._id} className="mt-2 rounded border p-3 text-sm">
        {shipment._id} · {shipment.carrier} · {shipment.trackingNumber} · {shipment.status}
      </p>)}</section>
    <section><h2 className="font-semibold">Return cases — most recent 100</h2>
      {view.returns.map(record => <div key={record._id} className="mt-2 rounded border p-3 text-sm">
        <p>{record._id} · {record.status} · {record.reason}</p>
        {record.lines.map(line => <p key={line.productId}>{line.productId}: {line.received}/{line.quantity} received</p>)}
      </div>)}</section>
    <section><h2 className="font-semibold">Credit memos — most recent 100</h2>
      {view.credits.map(credit => <p key={credit._id} className="mt-2 text-sm">{credit.kind}: {credit.amountMinor / 100} {credit.currency}</p>)}
    </section>
  </section>;
}

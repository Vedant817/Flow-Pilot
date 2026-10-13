'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface Draft {
  _id: string;
  gmailMessageId: string;
  senderEmail: string;
  subject: string;
  body: string;
  reason: string;
  placedAt: string;
  products: Array<{ name: string; quantity: number; evidence: string }>;
  requestedDeliveryDate?: string;
  requestedDeliveryTime?: string;
}

interface Form { products: string; date: string; time: string; note: string }

export default function EmailDraftsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [forms, setForms] = useState<Record<string, Form>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/email-drafts?status=draft');
      if (!response.ok) throw new Error('Could not load inbound order drafts');
      const next = (await response.json()).drafts as Draft[];
      setDrafts(next);
      setForms((current) => {
        const updated = { ...current };
        for (const draft of next) if (!updated[draft._id]) updated[draft._id] = {
          products: draft.products.map((p) => `${p.quantity} | ${p.name}`).join('\n'),
          date: draft.requestedDeliveryDate ?? '', time: draft.requestedDeliveryTime ?? '', note: '',
        };
        return updated;
      });
      setError('');
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  function update(id: string, key: keyof Form, value: string) {
    setForms((current) => ({ ...current, [id]: { ...current[id], [key]: value } }));
  }

  async function submit(draft: Draft, action: 'confirm' | 'dismiss') {
    const form = forms[draft._id];
    if (!form) return;
    setBusy(draft._id); setError('');
    try {
      const products = action === 'confirm' ? form.products.split('\n').filter((line) => line.trim()).map((line) => {
        const match = line.match(/^\s*(\d+)\s*\|\s*(.{3,80})\s*$/);
        if (!match) throw new Error('Enter one product per line as "quantity | product name".');
        return { name: match[2].trim(), quantity: Number(match[1]) };
      }) : [];
      const response = await fetch(`/api/email-drafts/${draft._id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, products, requestedDeliveryDate: form.date,
          requestedDeliveryTime: form.time, note: form.note }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Could not handle draft');
      setDrafts((current) => current.filter((item) => item._id !== draft._id));
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(null); }
  }

  return <main className="mx-auto max-w-5xl space-y-6 p-6">
    <header className="flex items-center justify-between gap-4">
      <div><h1 className="text-2xl font-semibold">Inbound order drafts</h1>
        <p className="text-sm text-slate-500">Check suggested items and confirm a delivery slot before creating a fulfillment order. Nothing here has been ordered yet.</p></div>
      <Link href="/email-reviews" className="text-sm underline">Other email reviews</Link>
    </header>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    {loading ? <p>Loading drafts…</p> : drafts.length === 0 ? <p>No open order drafts.</p> : drafts.map((draft) => {
      const form = forms[draft._id];
      return <article key={draft._id} className="rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
        <div className="flex justify-between gap-4"><h2 className="font-semibold">{draft.subject}</h2><span className="text-sm text-slate-500">{new Date(draft.placedAt).toLocaleString()}</span></div>
        <p className="mt-2 text-sm">{draft.senderEmail} · {draft.reason}</p>
        <p className="text-xs text-slate-500">Gmail ID: {draft.gmailMessageId}</p>
        <pre className="mt-4 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{draft.body}</pre>
        <p className="mt-3 text-xs text-amber-800">Product suggestions are unverified. Correct names and quantities before confirming.</p>
        <label className="mt-3 block text-sm font-medium">Products — one per line: quantity | product name
          <textarea value={form?.products ?? ''} onChange={(event) => update(draft._id, 'products', event.target.value)} rows={4}
            className="mt-1 w-full rounded-lg border border-slate-300 p-2" />
        </label>
        <div className="mt-3 flex flex-wrap gap-3">
          <label className="text-sm font-medium">Requested delivery date
            <input type="date" value={form?.date ?? ''} onChange={(event) => update(draft._id, 'date', event.target.value)} className="mt-1 block rounded-lg border border-slate-300 p-2" />
          </label>
          <label className="text-sm font-medium">Requested delivery time
            <input type="time" value={form?.time ?? ''} onChange={(event) => update(draft._id, 'time', event.target.value)} className="mt-1 block rounded-lg border border-slate-300 p-2" />
          </label>
        </div>
        <label className="mt-3 block text-sm font-medium">Dismissal reason
          <input value={form?.note ?? ''} onChange={(event) => update(draft._id, 'note', event.target.value)} maxLength={1000}
            className="mt-1 w-full rounded-lg border border-slate-300 p-2" />
        </label>
        <div className="mt-3 flex gap-3">
          <button disabled={busy === draft._id} onClick={() => void submit(draft, 'confirm')} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">Confirm and create order</button>
          <button disabled={busy === draft._id} onClick={() => void submit(draft, 'dismiss')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50">Dismiss</button>
        </div>
      </article>;
    })}
  </main>;
}

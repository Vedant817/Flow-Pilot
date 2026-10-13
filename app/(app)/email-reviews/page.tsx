'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface Review {
  _id: string;
  gmailMessageId: string;
  subject: string;
  senderEmail: string;
  body: string;
  classification: string;
  reason: string;
  proposedChanges: Array<Record<string, unknown>>;
  createdAt: string;
}

export default function EmailReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [orderIds, setOrderIds] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/email-reviews?status=open');
      if (!response.ok) throw new Error('Could not load email reviews');
      setReviews((await response.json()).reviews);
      setError('');
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function decide(id: string, status: 'resolved' | 'dismissed' | 'apply') {
    const note = notes[id]?.trim();
    if (!note) { setError('Add a note explaining the decision before closing a review.'); return; }
    setBusy(id);
    setError('');
    try {
      const response = await fetch(`/api/email-reviews/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, note, orderId: orderIds[id] }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Could not update review');
      setReviews((current) => current.filter((review) => review._id !== id));
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(null); }
  }

  return <main className="mx-auto max-w-5xl space-y-6 p-6">
    <header className="flex items-center justify-between gap-4">
      <div><h1 className="text-2xl font-semibold">Email order reviews</h1>
        <p className="text-sm text-slate-500">Verify the original message before editing orders. Mark resolved only after completing the work.</p></div>
      <div className="flex gap-4"><Link href="/email-drafts" className="text-sm underline">Order drafts</Link><Link href="/orders" className="text-sm underline">View orders</Link></div>
    </header>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    {loading ? <p>Loading reviews…</p> : reviews.length === 0 ? <p>No open email reviews.</p> :
      reviews.map((review) => <article key={review._id} className="rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
        <div className="flex justify-between gap-4"><h2 className="font-semibold">{review.subject}</h2><span className="text-sm text-slate-500">{new Date(review.createdAt).toLocaleString()}</span></div>
        <p className="mt-2 text-sm">{review.senderEmail} · {review.classification} · {review.reason}</p>
        <p className="text-xs text-slate-500">Gmail ID: {review.gmailMessageId}</p>
        <pre className="mt-4 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{review.body}</pre>
        {review.proposedChanges?.length > 0 && <section className="mt-3 text-sm">
          <strong>Proposed changes (not applied):</strong><pre className="mt-1 whitespace-pre-wrap">{JSON.stringify(review.proposedChanges, null, 2)}</pre>
        </section>}
        <label className="mt-4 block text-sm font-medium">Resolution note
          <textarea aria-label={`Resolution note for ${review.subject}`} value={notes[review._id] ?? ''}
            onChange={(event) => setNotes((current) => ({ ...current, [review._id]: event.target.value }))}
            maxLength={1000} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 p-2" placeholder="What was checked or changed?" />
        </label>
        {review.classification === 'update_order' && review.proposedChanges?.length > 0 &&
          <label className="mt-3 block text-sm font-medium">Target order ID (verify sender, items and requested changes first)
            <input aria-label={`Target order ID for ${review.subject}`} value={orderIds[review._id] ?? ''}
              onChange={(event) => setOrderIds((current) => ({ ...current, [review._id]: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2" />
          </label>}
        <div className="mt-3 flex gap-3">
          {review.classification === 'update_order' && review.proposedChanges?.length > 0 &&
            <button disabled={busy === review._id || !orderIds[review._id]?.trim()} onClick={() => void decide(review._id, 'apply')} className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-50">Apply verified change</button>}
          <button disabled={busy === review._id} onClick={() => void decide(review._id, 'resolved')} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">Mark resolved</button>
          <button disabled={busy === review._id} onClick={() => void decide(review._id, 'dismissed')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50">Dismiss</button>
        </div>
      </article>)}
  </main>;
}

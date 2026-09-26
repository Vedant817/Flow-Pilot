/** Local write-path coverage: classifier labels are not permissions to write. */
import { readFileSync } from 'node:fs';
import { parseNewOrder, parseOrderChanges } from '../../lib/nlp/email-orders';
import { hasExistingOrderChangeLanguage } from '../../lib/nlp/order-intent';

const emails = JSON.parse(readFileSync('scripts/eval/dataset.json', 'utf8')).emails as Array<{
  id: string; expected: string; subject: string; body: string;
}>;
const predictions = JSON.parse(readFileSync('scripts/eval/preds/baseline.json', 'utf8')) as Record<string, { pred: string }>;
const counts = { newReady: 0, newDraft: 0, newReview: 0, changesProposed: 0, changesReview: 0,
  trueNewCapturedByPredictedFlow: 0, heldoutNewCaptured: 0, nonOrdersDrafted: 0,
  draftsWithProductSuggestions: 0 };
const reasons = new Map<string, number>();
for (const e of emails) {
  if (e.expected === 'new_order') {
    const parsed = parseNewOrder(e.subject, e.body);
    if (parsed.ready) counts.newReady++;
    else if (parsed.intent) { counts.newDraft++; if (parsed.products.length) counts.draftsWithProductSuggestions++;
      reasons.set(parsed.reason, (reasons.get(parsed.reason) ?? 0) + 1); }
    else counts.newReview++;
  }
  if (e.expected === 'update_order') {
    if (parseOrderChanges(e.body).length) counts.changesProposed++;
    else counts.changesReview++;
  }
  const label = predictions[e.id]?.pred;
  if ((label === 'new_order' || label === 'other') && !hasExistingOrderChangeLanguage(e.subject, e.body)) {
    const parsed = parseNewOrder(e.subject, e.body);
    if (parsed.ready || parsed.intent) {
      if (e.expected === 'new_order') {
        counts.trueNewCapturedByPredictedFlow++;
        if (Number(e.id.split('-')[1]) > 8) counts.heldoutNewCaptured++;
      }
      else { counts.nonOrdersDrafted++; console.log('Non-order drafted:', e.id); }
    }
  }
}
console.log('Local synthetic mail write-path coverage:', counts);
console.log('Review reasons:', Object.fromEntries(reasons));

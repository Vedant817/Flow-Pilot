/** Local write-path coverage: classifier labels are not permissions to write. */
import { readFileSync } from 'node:fs';
import { parseNewOrder, parseOrderChanges } from '../../lib/nlp/email-orders';

const emails = JSON.parse(readFileSync('scripts/eval/dataset.json', 'utf8')).emails as Array<{
  id: string; expected: string; subject: string; body: string;
}>;
const counts = { newReady: 0, newReview: 0, changesProposed: 0, changesReview: 0 };
const reasons = new Map<string, number>();
for (const e of emails) {
  if (e.expected === 'new_order') {
    const parsed = parseNewOrder(e.subject, e.body);
    if (parsed.ready) counts.newReady++;
    else { counts.newReview++; reasons.set(parsed.reason, (reasons.get(parsed.reason) ?? 0) + 1); }
  }
  if (e.expected === 'update_order') {
    if (parseOrderChanges(e.body).length) counts.changesProposed++;
    else counts.changesReview++;
  }
}
console.log('Local synthetic mail write-path coverage:', counts);
console.log('Review reasons:', Object.fromEntries(reasons));

import { cleanEmailBody } from './preprocess';
import { hasExplicitNewOrderRequest } from './order-intent';

export interface Evidence<T> { value: T; text: string }
export type Change =
  | { op: 'cancel_order'; evidence: string }
  | { op: 'reschedule'; date: Evidence<string> }
  | { op: 'set_quantity'; product: Evidence<string>; quantity: Evidence<number> }
  | { op: 'remove_product'; product: Evidence<string> };

export type NewOrderParse =
  | { ready: true; products: Array<{ name: string; quantity: number; evidence: string }>; date: Evidence<string>; time: Evidence<string> }
  | { ready: false; reason: string; evidence: string[]; intent: boolean;
      products: Array<{ name: string; quantity: number; evidence: string }>; date: Evidence<string> | null; time: Evidence<string> | null };

function dateFrom(text: string): Evidence<string> | null {
  const match = text.match(/\b(20\d\d)-(\d\d)-(\d\d)\b|\b(\d{1,2})[/.](\d{1,2})[/.](20\d\d)\b/);
  if (!match) return null;
  const value = match[1]
    ? `${match[1]}-${match[2]}-${match[3]}`
    : `${match[6]}-${match[5].padStart(2, '0')}-${match[4].padStart(2, '0')}`;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
    ? { value, text: match[0] } : null;
}

function timeFrom(text: string): Evidence<string> | null {
  const match = text.match(/\b(\d{1,2}):(\d\d)\s*(am|pm)?\b/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || hour > (match[3] ? 12 : 23) || (match[3] && hour < 1)) return null;
  if (match[3]?.toLowerCase() === 'pm' && hour < 12) hour += 12;
  if (match[3]?.toLowerCase() === 'am' && hour === 12) hour = 0;
  return { value: `${String(hour).padStart(2, '0')}:${match[2]}`, text: match[0] };
}

function productLine(line: string): { name: string; quantity: number; evidence: string } | null {
  const clean = line.trim().replace(/^[•*\-]\s*/, '').trim();
  if (/^(?:delivery|date|time|ship|shipping|address|contact|phone|mobile|name|from|to)\b/i.test(clean)) return null;
  // Explicit line structure only. No guessing quantities from arbitrary prose.
  const first = clean.match(/^(\d{1,5})\s*(?:x|×|pcs?\b|units?\b)?\s+([a-z][\w .&'()\-]{2,65})$/i);
  const last = clean.match(/^([a-z][\w .&'()\-]{2,65}?)\s*(?:x|×|[-:]\s*(?:qty|quantity)?\s*[:=]?)\s*(\d{1,5})$/i);
  const quantity = Number(first?.[1] ?? last?.[2]);
  const name = (first?.[2] ?? last?.[1] ?? '').trim();
  if (!name || /\b\d\d:\d\d\b/.test(clean) || !Number.isInteger(quantity) || quantity < 1 ||
      /^(?:total|subtotal|amount|price|gst|tax|order|po|invoice|phone|contact)\b/i.test(name)) return null;
  return { name, quantity, evidence: line.trim() };
}

/** Suggestions only: these are never sufficient to automatically fulfill an order. */
function suggestProducts(body: string): Array<{ name: string; quantity: number; evidence: string }> {
  const found: Array<{ name: string; quantity: number; evidence: string }> = [];
  const seen = new Set<string>();
  for (const line of body.split('\n')) {
    if (/\b(?:delivery|date|time|phone|mobile|contact|address|rate|price|invoice|gst)\b/i.test(line) &&
        !/\b(?:send|dispatch|bhej)\b/i.test(line)) continue;
    for (const segment of line.split(/[,;+]|\s+and\s+|\s+aur\s+/i)) {
      const exact = productLine(segment);
      const match = segment.match(/\b(\d{1,5})\s*(?:x|×|bags?|packets?|units?|cartons?|crates?|tins?|kilo|kg|dabba|peti)?\s+(?:of\s+)?([a-z][\w ]{2,55})/i);
      const quantity = exact?.quantity ?? Number(match?.[1]);
      const name = (exact?.name ?? match?.[2] ?? '')
        .replace(/\b(?:bhej|deliver|dispatch|kal|tomorrow|aaj|today|please|urgent|chahiye)\b.*$/i, '')
        .trim();
      const key = name.toLowerCase();
      if (Number.isInteger(quantity) && quantity > 0 && name.length >= 3 &&
          !/^(?:order|po|phone|contact|date|time|delivery|gst|invoice|price|rate)\b/i.test(name) && !seen.has(key)) {
        found.push({ name, quantity, evidence: segment.trim().slice(0, 180) });
        seen.add(key);
      }
    }
  }
  return found;
}

export function parseNewOrder(subject: string, body: string): NewOrderParse {
  const clean = cleanEmailBody(body);
  const intent = hasExplicitNewOrderRequest(subject, clean);
  const products = clean.split('\n').map(productLine).filter((p): p is NonNullable<typeof p> => p !== null);
  const date = dateFrom(clean);
  const time = timeFrom(clean);
  const names = new Set(products.map((p) => p.name.toLowerCase()));
  if (!intent || !products.length || names.size !== products.length || !date || !time) {
    return {
      ready: false,
      reason: !intent ? 'Purchase request is not explicit' : !products.length ? 'No structured product lines' : names.size !== products.length
        ? 'Duplicate products' : !date ? 'Missing explicit delivery date' : 'Missing explicit delivery time',
      evidence: products.map((p) => p.evidence),
      intent, products: suggestProducts(clean), date, time,
    };
  }
  return { ready: true, products, date, time };
}

/** Candidate changes for a reviewer; these are never applied from an email alone. */
export function parseOrderChanges(body: string): Change[] {
  const clean = cleanEmailBody(body);
  const changes: Change[] = [];
  if (/\b(?:cancel (?:my|our|the|entire|full) (?:existing )?order|order cancel|po cancel)\b/i.test(clean)) {
    changes.push({ op: 'cancel_order', evidence: clean.slice(0, 180) });
  }
  const reschedule = clean.match(/\b(?:reschedule|postpone|change (?:the )?delivery (?:date|to)|deliver (?:on|by|at))\b[^\n]{0,90}/i);
  if (reschedule) {
    // "change from old-date to new-date": never take the first (old) date.
    const explicitTarget = reschedule[0].match(/\bto\s+(20\d\d-\d\d-\d\d|\d{1,2}[/.]\d{1,2}[/.]20\d\d)\b/i);
    const allDates = reschedule[0].match(/\b20\d\d-\d\d-\d\d\b|\b\d{1,2}[/.]\d{1,2}[/.]20\d\d\b/g) ?? [];
    const date = explicitTarget ? dateFrom(explicitTarget[1]) : allDates.length === 1 ? dateFrom(allDates[0]) : null;
    if (date) changes.push({ op: 'reschedule', date });
  }
  for (const line of clean.split('\n')) {
    const revised = line.match(/^(?:[-•]\s*)?(.{3,65}?)\s*:\s*\d{1,5}\s*(?:bags?|pcs?|units?)?\s+(?:revised|changed|reduced|increased)\s+to\s+(\d{1,5})\s*(?:bags?|pcs?|units?)?\s*$/i);
    if (revised && Number(revised[2]) > 0) {
      changes.push({ op: 'set_quantity', product: { value: revised[1].trim(), text: line.trim() }, quantity: { value: Number(revised[2]), text: revised[2] } });
    }
    const quantityChange = line.match(/\b(?:change (?:the )?quantity of|reduce|increase|revise)\s+(.{3,60}?)\s+from\s+\d{1,5}\s*(?:bags?|pcs?|units?)?\s+to\s+(\d{1,5})\b/i);
    if (quantityChange && Number(quantityChange[2]) > 0) {
      changes.push({ op: 'set_quantity', product: { value: quantityChange[1].trim(), text: line.trim() }, quantity: { value: Number(quantityChange[2]), text: quantityChange[2] } });
    }
    const remove = line.match(/\b(?:remove|cancel|drop|hata do)\s+(?:the\s+)?(.{3,65}?)\s+(?:from (?:my|our|the) order|from (?:my|our|the) list)\s*$/i);
    if (remove) changes.push({ op: 'remove_product', product: { value: remove[1].trim(), text: line.trim() } });
  }
  return changes;
}

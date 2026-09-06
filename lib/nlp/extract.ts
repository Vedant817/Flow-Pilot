export interface ProductDetail {
  name: string;
  quantity: number;
}

export interface OrderDetails {
  name: string;
  phone: string;
  products: ProductDetail[];
  date: string;
  time: string;
}

export interface FeedbackDetails {
  review: string;
  type: 'good' | 'bad' | 'neutral';
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function normalizeDate(raw: string | undefined): string {
  if (!raw) return new Date().toISOString().slice(0, 10);

  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = raw.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${year}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }

  const dMon = raw.match(/(\d{1,2})\s*([a-zA-Z]{3,9})/);
  if (dMon) {
    const m = MONTHS.indexOf(dMon[2].slice(0, 3).toLowerCase());
    if (m >= 0) {
      const year = new Date().getFullYear();
      return `${year}-${String(m + 1).padStart(2, '0')}-${dMon[1].padStart(2, '0')}`;
    }
  }

  return new Date().toISOString().slice(0, 10);
}

/**
 * Rule-based structured extraction from order emails.
 * Deterministic and auditable — replaces hosted-LLM JSON extraction,
 * eliminating hallucinated quantities/dates on the write path.
 */
export function extractOrderDetails(emailBody: string): OrderDetails | null {
  const body = emailBody.replace(/\r/g, '');

  const phoneMatch =
    body.match(/(?:phone|mobile|contact)\s*(?:number)?\s*[:\-]?\s*(\+?\d[\d\s-]{8,13}\d)/i) ??
    body.match(/\b([6-9]\d{9})\b/);
  const phone = phoneMatch ? phoneMatch[1].replace(/[\s-]/g, '') : '';

  const nameMatch = body.match(/(?:name|customer|attn|attention)\s*[:\-]\s*([A-Z][\w.]+(?:\s+[A-Z][\w.]+){0,3})/);
  const name = nameMatch ? nameMatch[1].trim() : '';

  const dateRaw =
    body.match(/(?:date|delivery|deliver by|required by)\s*(?:on|by|:|-)?\s*((?:\d{4}-\d{2}-\d{2})|(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})|(?:\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*))/i)?.[1];
  const date = normalizeDate(dateRaw);

  const timeMatch = body.match(/\b(\d{1,2}[:.]\d{2})\s*(am|pm|AM|PM)?\b/);
  let time = '12:00';
  if (timeMatch) {
    const [, hhmm, meridiem] = timeMatch;
    const [hRaw, mm] = hhmm.split(/[.:]/).map(Number);
    let h = hRaw;
    if (meridiem?.toLowerCase() === 'pm' && h < 12) h += 12;
    if (meridiem?.toLowerCase() === 'am' && h === 12) h = 0;
    time = `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  const products: ProductDetail[] = [];
  const lineParsers: RegExp[] = [
    /^\s*[•*\-]?\s*(.+?)\s+[-–x×:]\s*(?:qty|quantity)?\s*[:=]?\s*(\d{1,5})\s*$/gim,
    /^\s*[•*\-]?\s*(\d{1,5})\s*(?:x|pcs|units?|nos\.?)?\s+([A-Za-z][\w\s&.'()-]{2,60})\s*$/gim,
    /^\s*[•*\-]?\s*([\w\s&.'()-]{3,60}?)\s*[:\-]\s*(?:qty|quantity)\s*[:\-]?\s*(\d{1,5})\s*$/gim,
  ];

  for (const rx of lineParsers) {
    for (const m of body.matchAll(rx)) {
      const namePart = (m[1] || m[2] || '').trim();
      const qty = parseInt(m[2] && /^\d+$/.test(m[2]) ? m[2] : m[1], 10);
      const quantity = Number.isFinite(qty) ? qty : NaN;
      if (!namePart || !Number.isFinite(quantity)) continue;
      if (/^(total|subtotal|amount|price|gst|tax)/i.test(namePart)) continue;
      if (products.some((p) => p.name.toLowerCase() === namePart.toLowerCase())) continue;
      products.push({ name: namePart.slice(0, 80), quantity });
    }
    if (products.length > 0) break;
  }

  if (!phone && !products.length) return null;

  return { name, phone, products, date, time };
}

const POSITIVE = ['great', 'excellent', 'good', 'love', 'perfect', 'fast', 'reliable', 'happy', 'satisfied', 'recommend', 'smooth', 'best', 'awesome', 'thank'];
const NEGATIVE = ['bad', 'terrible', 'worst', 'late', 'delay', 'damaged', 'broken', 'poor', 'disappointed', 'complaint', 'refund', 'return', 'issue', 'problem', 'never', 'worst', 'unacceptable'];

export function extractFeedbackDetails(emailBody: string): FeedbackDetails | null {
  const text = emailBody
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1500);
  if (text.length < 8) return null;

  const lower = ` ${text.toLowerCase()} `;
  let score = 0;
  for (const w of POSITIVE) if (lower.includes(` ${w}`)) score++;
  for (const w of NEGATIVE) if (lower.includes(` ${w}`)) score--;

  const type: 'good' | 'bad' | 'neutral' = score >= 1 ? 'good' : score <= -1 ? 'bad' : 'neutral';
  return { review: text, type };
}

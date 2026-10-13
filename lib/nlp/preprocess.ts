/**
 * Email preprocessing for classification.
 * Strips quoted reply history, signatures and legal disclaimers before
 * embedding — long noisy threads otherwise dilute the intent signal.
 * (Technique adopted from Convai Laya's email_utils; model-independent.)
 */

const QUOTE_HEADERS = [
  /^\s*On .{0,300}wrote:\s*$/i,
  /^\s*-{2,}\s*(Original|Forwarded) Message\s*-{2,}/i,
  /^\s*_{8,}\s*$/,
];

const SIGNOFF = /^\s*(--\s*|best|kind|warm|many thanks|thanks|thank you|regards|cheers|sincerely)[\w ,!.]*$/i;

const DISCLAIMER =
  /confidential|intended (solely )?for the (use of the )?(named )?(addressee|recipient)|received this (e-?mail|message) in error/i;

/** Remove quoted history, signatures and disclaimers; collapse whitespace. */
export function cleanEmailBody(body: string): string {
  const lines = (body || '').replace(/\r/g, '').split('\n');
  const kept: string[] = [];
  for (const line of lines) {
    if (line.trimStart().startsWith('>')) continue;
    if (kept.length > 0 && QUOTE_HEADERS.some((p) => p.test(line))) break;
    kept.push(line);
  }
  // A sign-off only counts near the end (last 40%) and must be a short line.
  let cut = kept.length;
  const start = Math.max(1, Math.min(Math.floor(kept.length * 0.6), kept.length - 8));
  for (let i = start; i < kept.length; i++) {
    if (kept[i].trim().length <= 40 && SIGNOFF.test(kept[i])) {
      cut = i;
      break;
    }
  }
  const paras = kept
    .slice(0, cut)
    .join('\n')
    .split(/\n\s*\n/)
    .filter((p) => !DISCLAIMER.test(p));
  return paras
    .map((p) => p.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Build the classifier input. Subject carries strong intent signal
 * ("Re: change delivery date"), so it is embedded jointly with the body.
 * Matches the input form the head was trained on.
 */
export function buildClassifyInput(body: string, subject?: string | null): string {
  const cleaned = cleanEmailBody(body);
  const sub = (subject || '').trim();
  return sub ? `${sub}\n${cleaned}` : cleaned;
}

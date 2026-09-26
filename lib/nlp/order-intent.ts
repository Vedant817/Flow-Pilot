/** A text classifier alone is not enough to authorize an order write. */
export function hasExplicitNewOrderRequest(subject: string, body: string): boolean {
  const text = `${subject}\n${body}`.toLowerCase();
  // Asking for a quote, a rate, or a possible future order is not an order.
  if (/\b(?:price|rate|freight|catalog|quotation|quote|estimate)\b|\brate kya\b|\bkitna (?:hoga|hai)\b/i.test(text) &&
      /\b(?:what|how much|share|send|asking|puchna|quote|estimate|bata|confirm (?:the )?rate)\b/i.test(text)) {
    return false;
  }
  if (/\b(?:order baad me|no order yet|will (?:place|make|confirm) (?:an? |the )?order|may order later)\b/i.test(text)) {
    return false;
  }
  return /\b(?:please (?:place|process|book|send|deliver|dispatch)|place (?:a |an |the |my |our )?order|purchase order|order placement|we (?:would like to|want to|need to) (?:buy|order|purchase)|need (?:\d+|to buy)|bhej (?:do|dijiye|dena)|mangwa|maal chahiye|dispatch (?:the|\d+)|go ahead and dispatch)\b/i.test(text);
}

/** Reject parser artefacts such as name='50' from a `50 x Rice` line. */
export function hasUsableOrderLines(products: Array<{ name: string; quantity: number }>): boolean {
  return products.length > 0 && products.every(
    ({ name, quantity }) => /[A-Za-z\p{L}]{2}/u.test(name) &&
      !/^\s*\d+(?:\s*(?:x|pcs|bags|cartons?))?\s*$/i.test(name) &&
      Number.isInteger(quantity) && quantity > 0
  );
}

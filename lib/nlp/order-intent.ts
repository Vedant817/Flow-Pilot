/** A text classifier alone is not enough to authorize an order write. */
export function hasExplicitNewOrderRequest(subject: string, body: string): boolean {
  const text = `${subject}\n${body}`.toLowerCase();
  // Asking for a quote, a rate, or a possible future order is not an order.
  if (/\b(?:what(?: is| would be)?|how much|please (?:share|send|confirm)|only asking|bas)\b[^.!?\n]{0,80}\b(?:price|rate|freight|catalog|quotation|quote|estimate)\b|\brate kya\b|\bkitna (?:hoga|hai)\b/i.test(text)) {
    return false;
  }
  if (/\b(?:order baad me|no order yet|will (?:place|make|confirm) (?:an? |the )?order|may order later)\b|\b(?:on|after|upon) confirmation\b[^.]{0,100}\bwill\b/i.test(text)) {
    return false;
  }
  return /\b(?:please (?:place|process|book|send|deliver|dispatch|repeat)|place (?:a |an |the |my |our )?order|purchase order|purchase indent|new order|repeat (?:the )?(?:same|last)|book our indent|raises? (?:the following )?indent|stock me up|we (?:would like to|want to|need to) (?:buy|order|purchase|place)|need (?:\d+|to buy)|bhej (?:do|dijiye|dena)|mangwa|maal chahiye|dispatch (?:the|\d+)|go ahead and dispatch)\b/i.test(text);
}

/** A change request mislabelled as new must not become a second order. */
export function hasExistingOrderChangeLanguage(subject: string, body: string): boolean {
  const text = `${subject}\n${body}`.toLowerCase();
  return /\b(?:cancel|remove|reschedule|postpone|amend|revise|revised|instead|change (?:the |my |our )?(?:order|quantity|delivery)|hata do|baaki (?:sab )?(?:same|bhej)|order se)\b/i.test(text);
}

/** Reject parser artefacts such as name='50' from a `50 x Rice` line. */
export function hasUsableOrderLines(products: Array<{ name: string; quantity: number }>): boolean {
  return products.length > 0 && products.every(
    ({ name, quantity }) => /[A-Za-z\p{L}]{2}/u.test(name) &&
      !/^\s*\d+(?:\s*(?:x|pcs|bags|cartons?))?\s*$/i.test(name) &&
      Number.isInteger(quantity) && quantity > 0
  );
}

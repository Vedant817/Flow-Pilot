/* Accuracy gate for the production classifier (8 formal/casual samples, all 4 classes).
 * Runs OUTSIDE jest (wired into `npm test`): onnxruntime cannot execute inside
 * jest's sandboxed vm contexts (realm instanceof failure on tensors).
 * Uses the REAL local encoder + head — fails loudly if behavior regresses. */
import { classifyEmail } from '../../lib/nlp/classify';

const CASES: Array<{ subject: string; body: string; expected: string }> = [
  { subject: 'Purchase Order PO-2214 - Kirana Stores', body: 'Please process our purchase order PO-2214: 50 x Basmati Rice 5kg, 20 x Sunflower Oil 1L. Delivery by 2026-10-05. Contact: Ramesh Kumar, phone 9876543210.', expected: 'new_order' },
  { subject: 'bhaiya maal bhej do', body: 'bhaiya 50 rice bag bhej do kal tak, rate wahi purana wala lagana. paise kal shaam tak de dunga. - Chotu, 9810012345', expected: 'new_order' },
  { subject: 'Cancellation of 10 units from PO-2214', body: 'With reference to PO-2214 dated 28th September, please cancel 10 units of Sugar 1kg. Remaining items stay as-is. Ramesh Kumar, 9876543210.', expected: 'update_order' },
  { subject: 'kal wala order', body: 'bhaiya kal wala order cancel kar do, customer ne mana kar diya. jo advance diya tha wo agle order me adjust kar lena. - Chotu 9810012345', expected: 'update_order' },
  { subject: 'Great service, thank you!', body: 'Just wanted to say the delivery was perfectly on time and the packing was excellent. My customers are happy with the product quality. Keep it up! Priya Nair', expected: 'feedback' },
  { subject: 'delivery late', body: 'sir delivery bahut late tha, 3 din wait karwaya. dukaan khali ho gayi thi. aage se time pe bheja karo pls. very disappointed. - Santosh', expected: 'feedback' },
  { subject: 'Meeting invite: Q4 business review', body: 'You are invited to our Q4 business review meeting on 12th October at 3 PM. Agenda: sales performance, outstanding payments. Please confirm attendance.', expected: 'other' },
  { subject: 'Happy Diwali!', body: 'sir aapko aur aapke parivaar ko Diwali ki bahut bahut shubhkamnayein! mithaas bhara saal ho. - Chotu aur pariwar', expected: 'other' },
];

async function main() {
  let ok = 0;
  for (const c of CASES) {
    const pred = await classifyEmail(c.body, c.subject);
    const good = pred === c.expected;
    if (good) ok++;
    console.log(`[${good ? 'OK  ' : 'MISS'}] expected=${c.expected} predicted=${pred} :: ${c.subject}`);
  }
  console.log(`${ok}/${CASES.length} gate samples pass`);
  if (ok !== CASES.length) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });

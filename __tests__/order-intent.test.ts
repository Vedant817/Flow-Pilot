import { hasExplicitNewOrderRequest, hasUsableOrderLines, hasExistingOrderChangeLanguage } from '../lib/nlp/order-intent';

describe('order write guard', () => {
  it.each([
    ['Purchase Order PO-2214', 'Please process our purchase order: 50 x Basmati Rice'],
    ['bhaiya maal bhej do', 'bhaiya 50 rice bag bhej do kal tak'],
    ['Fresh stock', 'Please dispatch 30 bags of rice'],
  ])('allows clear purchase intent', (subject, body) => {
    expect(hasExplicitNewOrderRequest(subject, body)).toBe(true);
  });

  it.each([
    ['Freight charges to Pune?', 'What would be the freight charges for sending 100 cartons? Please share the estimate.'],
    ['rate kya hai?', 'Sir aaj cheeni ka rate kya hai? order baad me dunga.'],
    ['as discussed', 'As discussed on call. Please proceed.'],
    ['catalog', 'Please send a price list for 20 cartons, will place an order later.'],
    ['Rate confirmation and order placement', 'Please confirm the current rate. On confirmation, we will place an order.'],
  ])('rejects inquiries and ambiguous mail', (subject, body) => {
    expect(hasExplicitNewOrderRequest(subject, body)).toBe(false);
  });
});

it('recognizes changes even when they also say send the remaining items', () => {
  expect(hasExistingOrderChangeLanguage('items kam kar do', 'biscuits hata do, baaki bhej do')).toBe(true);
  expect(hasExistingOrderChangeLanguage('Purchase Order', 'Please send 50 bags rice')).toBe(false);
});

it('rejects numeric parser artefacts while accepting product quantities', () => {
  expect(hasUsableOrderLines([{ name: '50', quantity: 50 }])).toBe(false);
  expect(hasUsableOrderLines([{ name: 'Basmati Rice 5kg', quantity: 50 }])).toBe(true);
});

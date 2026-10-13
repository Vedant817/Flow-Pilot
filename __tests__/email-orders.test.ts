import { parseNewOrder, parseOrderChanges } from '../lib/nlp/email-orders';

describe('typed new-order parser', () => {
  it('accepts quantity-first and name-first lines with explicit delivery fields', () => {
    const result = parseNewOrder('Purchase Order', 'Please process our purchase order:\n50 x Basmati Rice\nSunflower Oil x 20\nDelivery 2026-10-05 at 10:30');
    expect(result).toEqual({
      ready: true,
      products: [
        { name: 'Basmati Rice', quantity: 50, evidence: '50 x Basmati Rice' },
        { name: 'Sunflower Oil', quantity: 20, evidence: 'Sunflower Oil x 20' },
      ],
      date: { value: '2026-10-05', text: '2026-10-05' },
      time: { value: '10:30', text: '10:30' },
    });
  });

  it.each([
    ['Please process our purchase order:\n50 x Basmati Rice\nDelivery 2026-10-05', 'Missing explicit delivery time'],
    ['Please process our purchase order:\n50 x Basmati Rice\nDelivery 2026-02-30 at 10:30', 'Missing explicit delivery date'],
    ['Please process our purchase order:\nDelivery 2026-10-05 at 10:30', 'No structured product lines'],
  ])('routes incomplete mail for review', (body, reason) => {
    expect(parseNewOrder('Purchase Order', body)).toMatchObject({ ready: false, reason });
  });

  it('does not treat an inquiry with a quantity as an order', () => {
    expect(parseNewOrder('Freight charges?', 'What would it cost to send 100 x cartons? Please share an estimate.\nDelivery 2026-10-05 at 10:30'))
      .toMatchObject({ ready: false, reason: 'Purchase request is not explicit' });
  });
});

describe('typed change proposals', () => {
  it('finds only explicitly requested changes and does not invent defaults', () => {
    expect(parseOrderChanges('Please revise our PO:\n- Masoor Dal: 20 bags revised to 12 bags\nDeliver on 2026-10-07.'))
      .toEqual([
        { op: 'reschedule', date: { value: '2026-10-07', text: '2026-10-07' } },
        { op: 'set_quantity', product: { value: 'Masoor Dal', text: '- Masoor Dal: 20 bags revised to 12 bags' }, quantity: { value: 12, text: '12' } },
      ]);
    expect(parseOrderChanges('Actually please postpone to Monday.')).toEqual([]);
  });

  it('proposes an explicit reduction but never invents a product for a vague amendment', () => {
    expect(parseOrderChanges('Please reduce Rice from 50 bags to 30 bags.')).toEqual([
      { op: 'set_quantity', product: { value: 'Rice', text: 'Please reduce Rice from 50 bags to 30 bags.' }, quantity: { value: 30, text: '30' } },
    ]);
    expect(parseOrderChanges('sirf 30 bag bhejo, 50 nahi.')).toEqual([]);
  });

  it('uses the new date, never the old date, when rescheduling', () => {
    expect(parseOrderChanges('Please reschedule delivery from 2026-10-05 to 2026-10-09.'))
      .toEqual([{ op: 'reschedule', date: { value: '2026-10-09', text: '2026-10-09' } }]);
    expect(parseOrderChanges('Please reschedule delivery on 2026-10-05 or 2026-10-09.')).toEqual([]);
  });
});

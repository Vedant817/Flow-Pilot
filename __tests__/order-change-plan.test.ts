import { planOrderChanges } from '../lib/nlp/order-change-plan';

const original = {
  date: '2026-10-05', status: 'pending fulfillment',
  products: [{ name: 'Masoor Dal', quantity: 20 }, { name: 'Poha', quantity: 10 }],
};

describe('reviewed order-change planning', () => {
  it('changes only the requested quantity and keeps other lines/date', () => {
    expect(planOrderChanges(original, [{
      op: 'set_quantity', product: { value: 'Masoor Dal', text: 'Masoor Dal' }, quantity: { value: 12, text: '12' },
    }])).toEqual({ ok: true, date: '2026-10-05', status: 'pending fulfillment',
      products: [{ name: 'Masoor Dal', quantity: 12 }, { name: 'Poha', quantity: 10 }] });
    expect(original.products[0].quantity).toBe(20);
  });

  it('rejects ambiguous products, changes to priced orders, and removal of the final line', () => {
    const change = { op: 'remove_product' as const, product: { value: 'Rice', text: 'remove Rice' } };
    expect(planOrderChanges(original, [change])).toMatchObject({ ok: false });
    expect(planOrderChanges({ ...original, pricing: { originalMinor: 100 } }, [
      { ...change, product: { value: 'Poha', text: 'remove Poha' } },
    ])).toMatchObject({ ok: false, reason: 'Priced order needs manual repricing' });
    expect(planOrderChanges({ ...original, products: [original.products[0]] }, [
      { ...change, product: { value: 'Masoor Dal', text: 'remove Masoor Dal' } },
    ])).toMatchObject({ ok: false });
  });

  it('refuses unknown requests and mixed cancellation', () => {
    expect(planOrderChanges(original, [])).toMatchObject({ ok: false });
    expect(planOrderChanges(original, [
      { op: 'cancel_order', evidence: 'cancel my order' },
      { op: 'reschedule', date: { value: '2026-10-08', text: '2026-10-08' } },
    ])).toMatchObject({ ok: false });
  });
});

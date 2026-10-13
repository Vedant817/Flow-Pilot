import { extractOrderDetails } from '../lib/nlp/extract';

describe('order email extraction', () => {
  it('extracts a common quantity-first order without consuming the next line as phone data', () => {
    expect(extractOrderDetails([
      'Name: Alice Doe',
      'Phone: 9876543210',
      '2x Industrial Widget',
      'Deliver by 20 May',
    ].join('\n'))).toEqual({
      name: 'Alice Doe',
      phone: '9876543210',
      products: [{ name: 'Industrial Widget', quantity: 2 }],
      date: `${new Date().getFullYear()}-05-20`,
      time: '12:00',
    });
  });

  it('rejects an apparent order that has no product lines', () => {
    expect(extractOrderDetails('Name: Alice Doe\nPhone: 9876543210')).toBeNull();
  });
});

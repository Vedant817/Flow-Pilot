import {
  createTrackingCredential,
  hashTrackingToken,
  toPublicOrderTracking,
} from '../lib/order-tracking';

describe('public order tracking', () => {
  it('creates an opaque token and stores only its hash', () => {
    const credential = createTrackingCredential();

    expect(credential.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(credential.tokenHash).toBe(hashTrackingToken(credential.token));
    expect(credential.tokenHash).not.toContain(credential.token);
  });

  it('projects only customer-safe tracking fields', () => {
    const result = toPublicOrderTracking({
      _id: '507f1f77bcf86cd799439011',
      orgId: 'org_secret',
      name: 'Alice Dealer',
      email: 'alice@example.com',
      phone: '+919876543210',
      date: '2026-05-20',
      time: '12:00',
      status: 'pending fulfillment',
      products: [{ name: 'Industrial Widget', quantity: 2 }],
      orderLink: '/internal/order',
      pricing: { finalMinor: 10_000, currency: 'INR' },
    });

    expect(result).toEqual({
      id: '507F1F77BCF86CD799439011',
      date: '2026-05-20',
      time: '12:00',
      status: 'pending fulfillment',
      products: [{ name: 'Industrial Widget', quantity: 2 }],
    });
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('phone');
    expect(result).not.toHaveProperty('name');
    expect(result).not.toHaveProperty('orgId');
    expect(result).not.toHaveProperty('pricing');
  });
});

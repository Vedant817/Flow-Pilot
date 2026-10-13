import { calculateDealerEnrichment, demoOrderStatus, stablePercent } from '@/lib/demo/network-metrics';

describe('public dealer metric enrichment', () => {
  it('is deterministic for the same source account', () => {
    expect(stablePercent('17850', 0, 1)).toBe(stablePercent('17850', 0, 1));
    expect(calculateDealerEnrichment({ customerId: '17850', revenue: 50_000, returnValue: 1_000, orderCount: 20 }))
      .toEqual(calculateDealerEnrichment({ customerId: '17850', revenue: 50_000, returnValue: 1_000, orderCount: 20 }));
  });

  it('keeps generated percentages within documented ranges', () => {
    const metric = calculateDealerEnrichment({ customerId: '13047', revenue: 80_000, returnValue: 2_000, orderCount: 30 });
    expect(metric.serviceLevel).toBeGreaterThanOrEqual(86);
    expect(metric.serviceLevel).toBeLessThanOrEqual(99.5);
    expect(metric.creditUtilization).toBeGreaterThanOrEqual(8);
    expect(metric.creditUtilization).toBeLessThanOrEqual(118);
  });

  it('raises risk when return leakage is extreme', () => {
    const normal = calculateDealerEnrichment({ customerId: 'same', revenue: 100_000, returnValue: 1_000, orderCount: 20 });
    const leaky = calculateDealerEnrichment({ customerId: 'same', revenue: 100_000, returnValue: 30_000, orderCount: 20 });
    expect(leaky.riskScore).toBeGreaterThan(normal.riskScore);
  });

  it('assigns a stable fulfillment status per invoice', () => {
    expect(demoOrderStatus('536365')).toBe(demoOrderStatus('536365'));
    expect(['fulfilled', 'pending fulfillment', 'partially fulfilled', 'canceled'])
      .toContain(demoOrderStatus('536365'));
  });
});

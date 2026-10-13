import { buildOverview, overviewWindow } from '../lib/analytics/overview';
test('comparison periods are equal, nonoverlapping IST business-day windows', () => {
  const period = overviewWindow(7, new Date('2026-03-31T18:45:00Z'));
  expect(period).toMatchObject({ today: '2026-04-01', currentStart: '2026-03-26', previousStart: '2026-03-19' });
  expect(period.dates).toHaveLength(7);
});
test('money is based on immutable order snapshots and posted credits, never current catalog prices', async () => {
  const calls: Array<{ collection: string; pipeline: unknown[] }> = [];
  const db = { collection: (name: string) => ({
    aggregate: (pipeline: unknown[]) => {
      calls.push({ collection: name, pipeline });
      return { toArray: async () => [] };
    },
  }) };
  const result = await buildOverview(db as never, 'org_a', 30, false);
  expect(result.monetaryCoverage.basis).toContain('not recognized revenue');
  expect(calls.every(call => (call.pipeline[0] as { $match: { orgId: string } }).$match.orgId === 'org_a')).toBe(true);
  expect(JSON.stringify(calls)).toContain('$pricing.finalMinor');
  expect(JSON.stringify(calls)).not.toContain('$lookup');
  expect(JSON.stringify(calls)).not.toContain('sku.price');
  expect(result.summary.averageOrderValue).toBeNull();
});

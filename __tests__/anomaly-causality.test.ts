jest.mock('../lib/analytics/rollup', () => ({ getProductSeries: jest.fn() }));

import { detectAnomalies } from '@/lib/intelligence/anomaly';

const dates = (n: number) => Array.from({ length: n }, (_, i) => `day-${i}`);

test('future spikes never alter any prefix points or flags', () => {
  const units = [...Array(12).fill(10), 200, 10, 0, 5000, 10000];
  const full = detectAnomalies(units, dates(units.length));
  for (let n = 1; n <= units.length; n++) {
    const prefix = detectAnomalies(units.slice(0, n), dates(n));
    expect(prefix.series).toEqual(full.series.slice(0, n));
    expect(prefix.anomalies).toEqual(full.anomalies.filter(p => dates(n).includes(p.date)));
  }
  expect(full.series[12].direction).toBe('spike');
});

test('current spike does not widen its own limits', () => {
  const prior = Array(10).fill(10);
  const normal = detectAnomalies([...prior, 10], dates(11));
  const spike = detectAnomalies([...prior, 1000], dates(11));
  expect(spike.series[10].upperLimit).toBe(normal.series[10].upperLimit);
  expect(spike.series[10].lowerLimit).toBe(normal.series[10].lowerLimit);
  expect(spike.series[10].direction).toBe('spike');
  expect(detectAnomalies([], []).series).toEqual([]);
  expect(detectAnomalies([10], dates(1)).series[0].direction).toBeNull();
});

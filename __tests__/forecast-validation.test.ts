import { validatedForecast } from '../lib/intelligence/forecast';
test('weekly demand is backtested with disjoint chronological selection/calibration/validation', () => {
  const demand = Array.from({ length: 180 }, (_, index) => [10, 20, 10, 30, 10, 5, 5][index % 7]);
  const result = validatedForecast(demand);
  expect(result.model).toBe('seasonal_naive');
  expect(result.validation.mae).toBe(0);
  expect(result.validation.empiricalCoverage).toBe(1);
  expect(result.predictions[29].calibrationSamples).toBeGreaterThanOrEqual(10);
  expect(result.predictions[29].lower).not.toBeNull();
});
test('short/zero demand does not invent confidence or divide by zero', () => {
  const result = validatedForecast([0, 0, 0]);
  expect(result.validation.wape).toBeNull();
  expect(result.validation.empiricalCoverage).toBeNull();
  expect(result.predictions[0].upper).toBeNull();
});
test('invalid demand fails closed', () => {
  expect(() => validatedForecast([1, NaN])).toThrow('nonnegative');
  expect(() => validatedForecast([1, -1])).toThrow('nonnegative');
});

export type ForecastModel = 'seasonal_naive' | 'recent_mean' | 'damped_trend';
const MODELS: ForecastModel[] = ['seasonal_naive', 'recent_mean', 'damped_trend'];
function predict(series: number[], model: ForecastModel, horizon: number): number {
  if (!series.length) return 0;
  if (model === 'seasonal_naive') return series[Math.max(0, series.length - 7 + (horizon - 1) % 7)];
  const recent = series.slice(-28);
  const mean = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  if (model === 'recent_mean' || recent.length < 14) return mean;
  const first = recent.slice(0, 7).reduce((sum, value) => sum + value, 0) / 7;
  const last = recent.slice(-7).reduce((sum, value) => sum + value, 0) / 7;
  return Math.max(0, last + (last - first) / Math.max(7, recent.length - 7) * (1 - Math.pow(0.9, horizon)) / 0.1);
}
function quantile(values: number[], nominal: number): number | null {
  if (values.length < 10) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((sorted.length + 1) * nominal) - 1)];
}
export function validatedForecast(series: number[], horizon = 30, nominal = 0.9) {
  if (!Array.isArray(series) || series.length > 730 || series.some(value => !Number.isFinite(value) || value < 0)) {
    throw new Error('Forecast requires finite nonnegative daily demand');
  }
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 60 || nominal <= 0 || nominal >= 1) throw new Error('Invalid forecast horizon/coverage');
  const selectionEnd = Math.max(14, Math.floor(series.length * 0.3));
  const calibrationEnd = Math.floor(series.length * 0.8);
  const scores = MODELS.map(model => {
    const errors: number[] = [];
    for (let origin = 7; origin < Math.min(selectionEnd, series.length); origin++) {
      errors.push(Math.abs(series[origin] - predict(series.slice(0, origin), model, 1)));
    }
    return { model, mae: errors.length ? errors.reduce((sum, value) => sum + value, 0) / errors.length : Infinity };
  }).sort((a, b) => a.mae - b.mae);
  const model = scores[0].model;
  const calibration = Array.from({ length: horizon }, (_, index) => {
    const errors: number[] = [];
    for (let origin = selectionEnd; origin + index < calibrationEnd; origin++) {
      errors.push(Math.abs(series[origin + index] - predict(series.slice(0, origin), model, index + 1)));
    }
    return { samples: errors.length, radius: quantile(errors, nominal) };
  });
  const heldout: Array<{ observed: number; predicted: number; covered: boolean | null }> = [];
  for (let origin = calibrationEnd; origin < series.length; origin++) {
    const predicted = predict(series.slice(0, origin), model, 1);
    const radius = calibration[0].radius;
    heldout.push({ observed: series[origin], predicted, covered: radius === null ? null : Math.abs(series[origin] - predicted) <= radius });
  }
  const mae = heldout.length ? heldout.reduce((sum, row) => sum + Math.abs(row.observed - row.predicted), 0) / heldout.length : null;
  const denominator = heldout.reduce((sum, row) => sum + row.observed, 0);
  const covered = heldout.filter(row => row.covered !== null);
  return {
    model, methodology: 'Chronological model selection, horizon-specific residual calibration, disjoint held-out one-step evaluation',
    nominalCoverage: nominal, trainingDays: series.length, selectionDays: selectionEnd,
    validation: { samples: heldout.length, mae, wape: denominator > 0 ? heldout.reduce((sum, row) => sum + Math.abs(row.observed - row.predicted), 0) / denominator : null,
      empiricalCoverage: covered.length >= 8 ? covered.filter(row => row.covered).length / covered.length : null },
    predictions: calibration.map((entry, index) => {
      const value = predict(series, model, index + 1);
      return { horizon: index + 1, value, lower: entry.radius === null ? null : Math.max(0, value - entry.radius),
        upper: entry.radius === null ? null : value + entry.radius, calibrationSamples: entry.samples };
    }),
    limitations: 'Intervals are empirical under time-series dependence, not guaranteed probabilities. Sparse horizons return unavailable intervals; zero-demand WAPE is undefined.',
  };
}

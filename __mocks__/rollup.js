module.exports = {
  applyOrderDelta: jest.fn(async () => undefined),
  backfillRollups: jest.fn(async () => 0),
  getDailySeries: jest.fn(async () => []),
  getProductSeries: jest.fn(async () => ({ dates: [], units: [] })),
};

import mongoose from 'mongoose';
import { Inventory } from '@/models/Inventory';
import dbConnect from '@/lib/mongodb';
import { overviewWindow } from './overview';
import { validatedForecast } from '@/lib/intelligence/forecast';
import { businessDateTime } from '@/lib/orders/time';

export async function forecastPage(orgId: string, cursor?: string, limit = 50) {
  const days = 180;
  const window = overviewWindow(days);
  const items = await Inventory.find({ orgId, ...(cursor ? { _id: { $gt: new mongoose.Types.ObjectId(cursor) } } : {}) })
    .sort({ _id: 1 }).limit(limit + 1).lean();
  const more = items.length > limit;
  const page = items.slice(0, limit);
  const ids = page.map(item => String(item._id));
  const conn = await dbConnect();
  const rows = await conn.connection.db!.collection('orders').aggregate<{ _id: { productId: string; date: string }; units: number }>([
    { $match: { orgId, date: { $gte: window.currentStart, $lte: window.today }, status: { $ne: 'canceled' }, 'products.productId': { $in: ids } } },
    { $unwind: '$products' }, { $match: { 'products.productId': { $in: ids } } },
    { $group: { _id: { productId: '$products.productId', date: '$date' }, units: { $sum: '$products.quantity' } } },
  ], { maxTimeMS: 8000 }).toArray();
  const values = new Map(rows.map(row => [`${row._id.productId}:${row._id.date}`, Number(row.units)]));
  const data = page.map(item => {
    const firstObserved = rows.filter(row => row._id.productId === String(item._id)).map(row => row._id.date).sort()[0];
    const evidenceStart = item.createdAt instanceof Date ? businessDateTime(item.createdAt).date : firstObserved;
    const series = evidenceStart ? window.dates.filter(date => date >= evidenceStart)
      .map(date => values.get(`${item._id}:${date}`) ?? 0) : [];
    const forecast = validatedForecast(series);
    const average = forecast.predictions.reduce((sum, prediction) => sum + prediction.value, 0) / forecast.predictions.length;
    const available = item.quantity - (item.reservedQuantity ?? 0);
    if (!Number.isSafeInteger(available) || available < 0) throw new Error('Stock balance requires reconciliation');
    const stockout = average > 0 ? available / average : null;
    const buffer = forecast.predictions[0].upper ?? forecast.predictions[0].value;
    const reorder = Math.ceil(buffer * 7);
    const recommended = Math.ceil(forecast.predictions.reduce((sum, prediction) => sum + prediction.value, 0));
    const last = series.slice(-14).reduce((sum, units) => sum + units, 0);
    const prior = series.slice(-28, -14).reduce((sum, units) => sum + units, 0);
    const urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN' = !series.length ? 'UNKNOWN' : stockout !== null && stockout <= 3 ? 'CRITICAL'
      : stockout !== null && stockout <= 7 ? 'HIGH' : available < reorder ? 'MEDIUM' : 'LOW';
    return {
      product: item.name, productId: String(item._id), current_stock: available, recommended_stock: recommended,
      urgency_level: urgency, days_until_stockout: stockout === null ? null : Math.round(stockout * 10) / 10,
      projected_stockout_date: stockout === null || stockout > 3650 ? null : new Date(Date.now() + stockout * 86_400_000).toISOString().slice(0, 10),
      expected_daily_demand: average, reorder_point: reorder, economic_order_quantity: null,
      cost_impact: Math.max(0, recommended - available) * item.price,
      confidence_score: forecast.validation.empiricalCoverage,
      trend_direction: last > prior * 1.1 ? 'INCREASING' : last < prior * 0.9 ? 'DECREASING' : 'STABLE',
      reasons: [`Model: ${forecast.model}`, `Held-out MAE: ${forecast.validation.mae ?? 'unavailable'}`],
      recommendations: ['Use intervals and actual supplier lead time before purchasing; seven-day lead time is an explicit planning assumption.'],
      validation: forecast.validation, predictions: forecast.predictions, interval_nominal_coverage: forecast.nominalCoverage,
      historicalEvidenceDays: series.length,
    };
  });
  const coverage = data.map(row => row.confidence_score).filter((value): value is number => value !== null);
  return {
    urgent_restocking: data, summary: { total_products_analyzed: data.length,
      critical_items: data.filter(row => row.urgency_level === 'CRITICAL').length,
      high_priority_items: data.filter(row => row.urgency_level === 'HIGH').length,
      total_estimated_cost: data.reduce((sum, row) => sum + row.cost_impact, 0),
      average_confidence_score: coverage.length ? coverage.reduce((sum, value) => sum + value, 0) / coverage.length : null,
    },
    pagination: { limit, nextCursor: more ? String(page[page.length - 1]._id) : null },
    scope: { basis: 'Current catalog page; canonical SKU demand from accepted orders, cancellations excluded',
      excludesUnmappedLegacyLines: true, demandDays: days, confidenceBasis: 'Empirical held-out one-step interval coverage, not a probability of future correctness',
      costBasis: 'Current catalog-value estimate, not verified supplier procurement cost', leadTimeAssumptionDays: 7 },
    generated_at: new Date().toISOString(), next_analysis_recommended: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

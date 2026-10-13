export interface DealerMetricInput {
  customerId: string;
  revenue: number;
  returnValue: number;
  orderCount: number;
}

export interface DealerEnrichment {
  averageOrderValue: number;
  creditLimit: number;
  outstanding: number;
  overdue: number;
  creditUtilization: number;
  returnRate: number;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  serviceLevel: number;
  status: 'active' | 'credit hold';
}

export function stablePercent(key: string, min: number, max: number): number {
  let hash = 2166136261;
  for (const char of key) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return min + ((hash >>> 0) % 10_000) / 10_000 * (max - min);
}

export function demoOrderStatus(invoiceNo: string): string {
  const percentile = stablePercent(invoiceNo, 0, 1);
  if (percentile < 0.84) return 'fulfilled';
  if (percentile < 0.92) return 'pending fulfillment';
  if (percentile < 0.97) return 'partially fulfilled';
  return 'canceled';
}

export function calculateDealerEnrichment(input: DealerMetricInput): DealerEnrichment {
  const averageOrderValue = input.revenue / Math.max(1, input.orderCount);
  const creditLimit = roundMoney(Math.max(5_000, averageOrderValue * 8));
  const utilization = stablePercent(input.customerId, 0.08, 1.18);
  const outstanding = roundMoney(creditLimit * utilization);
  const overdue = roundMoney(outstanding * stablePercent(`${input.customerId}:overdue`, 0.05, 0.72));
  const returnRate = input.revenue > 0 ? input.returnValue / input.revenue : 0;
  const riskScore = Math.round(Math.min(100, utilization * 55 + returnRate * 220 + stablePercent(`${input.customerId}:risk`, 0, 20)));
  const riskLevel = riskScore >= 75 ? 'critical' : riskScore >= 55 ? 'high' : riskScore >= 35 ? 'medium' : 'low';
  const serviceLevel = roundMoney(stablePercent(`${input.customerId}:service`, 86, 99.5));

  return {
    averageOrderValue: roundMoney(averageOrderValue),
    creditLimit,
    outstanding,
    overdue,
    creditUtilization: roundMoney(utilization * 100),
    returnRate: roundMoney(returnRate * 100),
    riskScore,
    riskLevel,
    serviceLevel,
    status: utilization > 1 ? 'credit hold' : 'active',
  };
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

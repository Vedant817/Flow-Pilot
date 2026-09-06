import type { IPromotionScheme } from '@/models/PromotionScheme';
import { computeDiscount } from '@/lib/promotions/pricing';

export interface MatchResult {
  matched: boolean;
  reason?: string;
}

export function matchesSignals(
  signal: any,
  eligibility: IPromotionScheme['eligibility'],
  opts?: { toleranceOverride?: number }
): boolean {
  if (!signal) return false;
  if (signal.insufficientData && eligibility.cohorts.includes('regular')) {
    // regular requires sufficient data; if cohort includes regular but signal insufficient, fail that cohort check
    // But OR logic may still pass via other cohort, handled below
  }
  if (eligibility.excludeEstimated && signal.priceEstimated) return false;

  // Cohort predicates
  const checks: Record<string, boolean> = {
    regular: !!signal.isRegular,
    active_tenured: !!signal.isActiveTenured,
    slipping: (() => {
      if (!signal.isRegular) return false;
      // recompute slipping if tolerance override
      if (opts?.toleranceOverride != null) {
        const expected = signal.expectedIntervalsExcludedLast ?? signal.expectedInterval ?? signal.medianInterval;
        if (!expected || expected <= 0) return false;
        return signal.recencyDays > expected * opts.toleranceOverride;
      }
      return !!signal.isSlipping;
    })(),
    dormant_tenured: !!signal.isDormantTenured,
  };

  let cohortPass: boolean;
  if (eligibility.operator === 'AND') {
    cohortPass = eligibility.cohorts.every((c) => checks[c]);
  } else {
    cohortPass = eligibility.cohorts.some((c) => checks[c]);
  }
  if (!cohortPass) return false;

  // Numeric gates
  if (signal.frequency < (eligibility.minOrders ?? 4)) return false;
  if (signal.tenureDays < (eligibility.minTenureDays ?? 0)) return false;
  if (eligibility.maxRecencyDays != null && signal.recencyDays > eligibility.maxRecencyDays) {
    // For active_tenured this is already enforced in signal, but re-check scheme-level stricter cap
    // If cohorts include slipping/dormant, maxRecency may be higher — we enforce only if operator AND or if all cohorts are active_tenured
    // For simplicity, enforce maxRecency as hard cap regardless (spec says required)
    return false;
  }

  // Monetary gates
  if (eligibility.minMonetaryUnits != null && signal.monetaryUnits < eligibility.minMonetaryUnits) return false;
  if (eligibility.minMonetaryValueMinor != null && signal.monetaryValueMinor < eligibility.minMonetaryValueMinor) return false;

  // RFM filter optional
  if (eligibility.rfmSegments && eligibility.rfmSegments.length > 0) {
    if (!eligibility.rfmSegments.includes(signal.segment)) return false;
  }

  // Cadence median range if present
  if (eligibility.cadence) {
    const median = signal.medianInterval ?? 0;
    const min = eligibility.cadence.medianIntervalMin ?? 7;
    const max = eligibility.cadence.medianIntervalMax ?? 60;
    // Only enforce if signal is regular-like; for non-regular cohorts, skip
    if (eligibility.cohorts.includes('regular') && signal.isRegular) {
      if (median < min || median > max) {
        // Check long tier exception: 61-120 closes dead zone
        if (!(median >= 61 && median <= 120 && signal.isRegularLong)) return false;
      }
      // Custom preset: enforce cv/mad thresholds stored on scheme at match time
      if (eligibility.cadence.preset === 'custom') {
        const maxCv = eligibility.cadence.maxCv ?? 0.35;
        const maxMad = eligibility.cadence.maxMadRatio ?? 0.25;
        if ((signal.cv ?? Infinity) > maxCv) return false;
        if ((signal.madRatio ?? Infinity) > maxMad) return false;
      }
    }
  }

  return true;
}

export function computeEligibilityDetails(signal: any, scheme: IPromotionScheme): MatchResult {
  const ok = matchesSignals(signal, scheme.eligibility, {
    toleranceOverride: scheme.eligibility.cadence?.toleranceMultiplier,
  });
  return { matched: ok };
}

export function estimateDiscountForScheme(scheme: IPromotionScheme, signal: any): number {
  // Estimate order value from signal monetaryValueMinor / frequency
  const avgOrderValue = signal.frequency > 0 ? Math.round(signal.monetaryValueMinor / signal.frequency) : 50000;
  return computeDiscount(
    {
      benefitType: scheme.benefitType,
      benefitValueMinor: scheme.benefitValueMinor,
      maxDiscountMinor: scheme.maxDiscountMinor,
      setupFeeMinor: scheme.setupFeeMinor,
      minimumOrderValueMinor: scheme.minimumOrderValueMinor,
    },
    avgOrderValue
  );
}

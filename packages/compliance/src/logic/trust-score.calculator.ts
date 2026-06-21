import { ComplianceItemStatus, ComplianceItemType, TrustScoreBreakdownItem } from '@khanij/types';
import { ITEM_WEIGHTS } from './required-items';

const DECAY_WINDOW_DAYS = 30;

export interface ScoreInputItem {
  type: ComplianceItemType;
  status: ComplianceItemStatus;
  validUntil?: Date | null;
}

export interface TrustScoreResult {
  score: number;
  breakdown: TrustScoreBreakdownItem[];
}

export function computeTrustScore(
  items: ScoreInputItem[],
  requiredTypes: ComplianceItemType[],
  now: Date = new Date(),
): TrustScoreResult {
  const totalWeight = requiredTypes.reduce((sum, t) => sum + (ITEM_WEIGHTS[t] ?? 0), 0);

  if (totalWeight === 0) {
    return { score: 0, breakdown: [] };
  }

  const breakdown: TrustScoreBreakdownItem[] = [];
  let earned = 0;

  const itemMap = new Map<ComplianceItemType, ScoreInputItem>();
  for (const item of items) {
    itemMap.set(item.type, item);
  }

  for (const type of requiredTypes) {
    const weight = ITEM_WEIGHTS[type] ?? 0;
    const item = itemMap.get(type);
    const status = item?.status ?? ComplianceItemStatus.MISSING;

    let decayFactor = 1.0;
    let effectiveWeight = 0;

    if (status === ComplianceItemStatus.VERIFIED) {
      decayFactor = computeDecayFactor(item?.validUntil ?? null, now);
      effectiveWeight = weight * decayFactor;
      earned += effectiveWeight;
    }

    breakdown.push({
      itemType: type,
      weight,
      status,
      effectiveWeight: parseFloat(effectiveWeight.toFixed(2)),
      decayFactor: parseFloat(decayFactor.toFixed(4)),
    });
  }

  const rawScore = (earned / totalWeight) * 100;
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  return { score, breakdown };
}

function computeDecayFactor(validUntil: Date | null | undefined, now: Date): number {
  if (!validUntil) return 1.0;

  const msUntilExpiry = validUntil.getTime() - now.getTime();
  const daysUntilExpiry = msUntilExpiry / (1000 * 60 * 60 * 24);

  if (daysUntilExpiry <= 0) return 0.0;
  if (daysUntilExpiry >= DECAY_WINDOW_DAYS) return 1.0;

  return 0.5 + (daysUntilExpiry / DECAY_WINDOW_DAYS) * 0.5;
}

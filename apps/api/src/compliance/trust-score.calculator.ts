import { ComplianceItemStatus, ComplianceItemType, TrustScoreBreakdownItem } from '@khanij/types';

/**
 * Weight configuration per compliance item type.
 * Total weights for SELLER = 100.
 * Weights for BUYER types are proportional subsets.
 */
const ITEM_WEIGHTS: Record<ComplianceItemType, number> = {
  [ComplianceItemType.MINING_LEASE]: 20,
  [ComplianceItemType.ENV_CLEARANCE]: 15,
  [ComplianceItemType.IBM_RETURNS]: 15,
  [ComplianceItemType.ROYALTY_CLEARANCE]: 15,
  [ComplianceItemType.SPCB_NOC]: 10,
  [ComplianceItemType.GST_REG]: 10,
  [ComplianceItemType.PAN]: 5,
  [ComplianceItemType.BANK_VERIFICATION]: 10,
  // Lower-weight items for broader org types
  [ComplianceItemType.FOREST_CLEARANCE]: 5,
  [ComplianceItemType.IEC]: 5,
  [ComplianceItemType.END_USE_DECLARATION]: 5,
  [ComplianceItemType.INDUSTRY_REGISTRATION]: 5,
};

/** Number of days before expiry at which decay begins. */
const DECAY_WINDOW_DAYS = 30;

/**
 * Input item shape for the calculator — a subset of ComplianceItem fields.
 */
export interface ScoreInputItem {
  type: ComplianceItemType;
  status: ComplianceItemStatus;
  validUntil?: Date | null;
}

export interface TrustScoreResult {
  score: number; // 0–100, integer
  breakdown: TrustScoreBreakdownItem[];
}

/**
 * Compute a TrustScore from a set of compliance items.
 *
 * Algorithm:
 * 1. For each required item type, look up the weight.
 * 2. Compute a decay factor for VERIFIED items nearing expiry (linear 1.0→0.5 over 30 days).
 * 3. Only VERIFIED items contribute to the score. EXPIRED items contribute 0.
 * 4. Normalise against the sum of weights of all required types.
 * 5. Return integer 0–100 + breakdown for transparency.
 *
 * Pure function — no side effects, easily unit-testable.
 */
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
    // EXPIRED, MISSING, UPLOADED, UNDER_REVIEW, REJECTED → contribute 0

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

/**
 * Compute a linear decay factor for items near expiry.
 *
 * - validUntil is null or far in the future → 1.0 (no decay)
 * - validUntil is today → 0.5
 * - validUntil is past → 0.0 (but status should be EXPIRED by sweep)
 * - Linear interpolation within the DECAY_WINDOW_DAYS window.
 */
function computeDecayFactor(validUntil: Date | null | undefined, now: Date): number {
  if (!validUntil) return 1.0;

  const msUntilExpiry = validUntil.getTime() - now.getTime();
  const daysUntilExpiry = msUntilExpiry / (1000 * 60 * 60 * 24);

  if (daysUntilExpiry <= 0) return 0.0;
  if (daysUntilExpiry >= DECAY_WINDOW_DAYS) return 1.0;

  // Linear: 1.0 at DECAY_WINDOW_DAYS days, 0.5 at 0 days
  return 0.5 + (daysUntilExpiry / DECAY_WINDOW_DAYS) * 0.5;
}

/** Required compliance item types by org type. */
export const REQUIRED_ITEMS_BY_ORG_TYPE: Record<string, ComplianceItemType[]> = {
  SELLER: [
    ComplianceItemType.MINING_LEASE,
    ComplianceItemType.ENV_CLEARANCE,
    ComplianceItemType.IBM_RETURNS,
    ComplianceItemType.ROYALTY_CLEARANCE,
    ComplianceItemType.SPCB_NOC,
    ComplianceItemType.GST_REG,
    ComplianceItemType.PAN,
    ComplianceItemType.BANK_VERIFICATION,
  ],
  BUYER: [
    ComplianceItemType.GST_REG,
    ComplianceItemType.PAN,
    ComplianceItemType.BANK_VERIFICATION,
    ComplianceItemType.END_USE_DECLARATION,
  ],
  TRADER: [
    ComplianceItemType.GST_REG,
    ComplianceItemType.PAN,
    ComplianceItemType.BANK_VERIFICATION,
  ],
  EXPORTER: [
    ComplianceItemType.GST_REG,
    ComplianceItemType.PAN,
    ComplianceItemType.BANK_VERIFICATION,
    ComplianceItemType.IEC,
  ],
  ARBITRATION_BODY: [
    ComplianceItemType.GST_REG,
    ComplianceItemType.PAN,
    ComplianceItemType.INDUSTRY_REGISTRATION,
  ],
};

/** Human-readable labels for compliance item types. */
export const COMPLIANCE_ITEM_LABELS: Record<ComplianceItemType, string> = {
  [ComplianceItemType.MINING_LEASE]: 'Mining Lease',
  [ComplianceItemType.ENV_CLEARANCE]: 'Environmental Clearance',
  [ComplianceItemType.FOREST_CLEARANCE]: 'Forest Clearance',
  [ComplianceItemType.IBM_RETURNS]: 'IBM Annual Returns',
  [ComplianceItemType.ROYALTY_CLEARANCE]: 'Royalty Clearance Certificate',
  [ComplianceItemType.SPCB_NOC]: 'SPCB No Objection Certificate',
  [ComplianceItemType.GST_REG]: 'GST Registration',
  [ComplianceItemType.PAN]: 'PAN Card',
  [ComplianceItemType.BANK_VERIFICATION]: 'Bank Account Verification',
  [ComplianceItemType.IEC]: 'Import Export Code',
  [ComplianceItemType.END_USE_DECLARATION]: 'End Use Declaration',
  [ComplianceItemType.INDUSTRY_REGISTRATION]: 'Industry Registration',
};

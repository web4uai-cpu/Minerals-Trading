import {
  computeTrustScore,
  REQUIRED_ITEMS_BY_ORG_TYPE,
  ScoreInputItem,
} from './trust-score.calculator';
import { ComplianceItemStatus, ComplianceItemType } from '@khanij/types';

const SELLER_TYPES = REQUIRED_ITEMS_BY_ORG_TYPE['SELLER']!;

function allVerified(types: ComplianceItemType[], validUntil?: Date): ScoreInputItem[] {
  return types.map((type) => ({
    type,
    status: ComplianceItemStatus.VERIFIED,
    validUntil: validUntil ?? null,
  }));
}

describe('computeTrustScore', () => {
  describe('all verified, no expiry', () => {
    it('returns 100 when all required items are VERIFIED with no expiry', () => {
      const items = allVerified(SELLER_TYPES);
      const { score } = computeTrustScore(items, SELLER_TYPES);
      expect(score).toBe(100);
    });
  });

  describe('missing items', () => {
    it('returns 0 when no items are present', () => {
      const { score } = computeTrustScore([], SELLER_TYPES);
      expect(score).toBe(0);
    });

    it('returns partial score when only some items are verified', () => {
      // Only PAN verified (weight 5) out of total SELLER weight 100
      const items: ScoreInputItem[] = [
        { type: ComplianceItemType.PAN, status: ComplianceItemStatus.VERIFIED, validUntil: null },
      ];
      const { score } = computeTrustScore(items, SELLER_TYPES);
      expect(score).toBe(5); // 5/100
    });

    it('UNDER_REVIEW items do not contribute to the score', () => {
      const items: ScoreInputItem[] = [
        {
          type: ComplianceItemType.MINING_LEASE,
          status: ComplianceItemStatus.UNDER_REVIEW,
          validUntil: null,
        },
      ];
      const { score } = computeTrustScore(items, SELLER_TYPES);
      expect(score).toBe(0);
    });

    it('REJECTED items do not contribute to the score', () => {
      const items: ScoreInputItem[] = [
        {
          type: ComplianceItemType.MINING_LEASE,
          status: ComplianceItemStatus.REJECTED,
          validUntil: null,
        },
      ];
      const { score } = computeTrustScore(items, SELLER_TYPES);
      expect(score).toBe(0);
    });

    it('EXPIRED items do not contribute to the score', () => {
      const items: ScoreInputItem[] = [
        {
          type: ComplianceItemType.MINING_LEASE,
          status: ComplianceItemStatus.EXPIRED,
          validUntil: new Date('2020-01-01'),
        },
      ];
      const { score } = computeTrustScore(items, SELLER_TYPES);
      expect(score).toBe(0);
    });
  });

  describe('expiry decay', () => {
    it('applies no decay when validUntil is null', () => {
      const items: ScoreInputItem[] = [
        { type: ComplianceItemType.PAN, status: ComplianceItemStatus.VERIFIED, validUntil: null },
      ];
      const { breakdown } = computeTrustScore(items, [ComplianceItemType.PAN]);
      const panBreakdown = breakdown.find((b) => b.itemType === ComplianceItemType.PAN)!;
      expect(panBreakdown.decayFactor).toBe(1.0);
    });

    it('applies no decay when validUntil is far in the future', () => {
      const farFuture = new Date();
      farFuture.setFullYear(farFuture.getFullYear() + 5);
      const items: ScoreInputItem[] = [
        { type: ComplianceItemType.PAN, status: ComplianceItemStatus.VERIFIED, validUntil: farFuture },
      ];
      const { breakdown } = computeTrustScore(items, [ComplianceItemType.PAN]);
      const panBreakdown = breakdown.find((b) => b.itemType === ComplianceItemType.PAN)!;
      expect(panBreakdown.decayFactor).toBe(1.0);
    });

    it('applies 50% decay when validUntil is today', () => {
      const today = new Date();
      today.setHours(today.getHours() + 1); // just past now
      const items: ScoreInputItem[] = [
        { type: ComplianceItemType.PAN, status: ComplianceItemStatus.VERIFIED, validUntil: today },
      ];
      const { breakdown } = computeTrustScore(items, [ComplianceItemType.PAN], new Date());
      const panBreakdown = breakdown.find((b) => b.itemType === ComplianceItemType.PAN)!;
      // Very close to expiry → decay factor near 0.5
      expect(panBreakdown.decayFactor).toBeGreaterThanOrEqual(0.5);
      expect(panBreakdown.decayFactor).toBeLessThan(0.52);
    });

    it('applies intermediate decay within the 30-day window', () => {
      const now = new Date('2025-01-01T00:00:00Z');
      const in15days = new Date('2025-01-16T00:00:00Z');
      const items: ScoreInputItem[] = [
        { type: ComplianceItemType.PAN, status: ComplianceItemStatus.VERIFIED, validUntil: in15days },
      ];
      const { breakdown } = computeTrustScore(items, [ComplianceItemType.PAN], now);
      const panBreakdown = breakdown.find((b) => b.itemType === ComplianceItemType.PAN)!;
      // 15/30 days = 0.5 * 0.5 + 0.5 = 0.75
      expect(panBreakdown.decayFactor).toBeCloseTo(0.75, 1);
    });

    it('score decays when item is near expiry', () => {
      const now = new Date('2025-01-01T00:00:00Z');
      const in15days = new Date('2025-01-16T00:00:00Z');

      const noDecayItems = allVerified(SELLER_TYPES);
      const { score: fullScore } = computeTrustScore(noDecayItems, SELLER_TYPES, now);

      // Replace PAN with near-expiry PAN
      const nearExpiry: ScoreInputItem[] = SELLER_TYPES.map((type) =>
        type === ComplianceItemType.PAN
          ? { type, status: ComplianceItemStatus.VERIFIED, validUntil: in15days }
          : { type, status: ComplianceItemStatus.VERIFIED, validUntil: null },
      );
      const { score: decayedScore } = computeTrustScore(nearExpiry, SELLER_TYPES, now);

      expect(decayedScore).toBeLessThan(fullScore);
    });
  });

  describe('breakdown', () => {
    it('includes all required types in breakdown even when items are missing', () => {
      const { breakdown } = computeTrustScore([], SELLER_TYPES);
      expect(breakdown).toHaveLength(SELLER_TYPES.length);
      for (const item of breakdown) {
        expect(item.status).toBe(ComplianceItemStatus.MISSING);
        expect(item.effectiveWeight).toBe(0);
      }
    });

    it('shows correct effectiveWeight for verified items', () => {
      const items = allVerified([ComplianceItemType.MINING_LEASE]);
      const { breakdown } = computeTrustScore(items, [ComplianceItemType.MINING_LEASE]);
      const b = breakdown[0]!;
      expect(b.weight).toBe(20);
      expect(b.effectiveWeight).toBe(20);
      expect(b.decayFactor).toBe(1.0);
    });
  });

  describe('edge cases', () => {
    it('returns 0 when required types array is empty', () => {
      const { score } = computeTrustScore(allVerified(SELLER_TYPES), []);
      expect(score).toBe(0);
    });

    it('score is clamped to 0–100', () => {
      const { score } = computeTrustScore(allVerified(SELLER_TYPES), SELLER_TYPES);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('ignores items that are not in the required types list', () => {
      const items: ScoreInputItem[] = [
        {
          type: ComplianceItemType.IEC, // not in SELLER required list
          status: ComplianceItemStatus.VERIFIED,
          validUntil: null,
        },
      ];
      const { score } = computeTrustScore(items, SELLER_TYPES);
      expect(score).toBe(0);
    });

    it('is deterministic — same inputs produce same output', () => {
      const items = allVerified(SELLER_TYPES);
      const now = new Date('2025-06-01T00:00:00Z');
      const result1 = computeTrustScore(items, SELLER_TYPES, now);
      const result2 = computeTrustScore(items, SELLER_TYPES, now);
      expect(result1.score).toBe(result2.score);
    });
  });
});

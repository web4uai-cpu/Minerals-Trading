import type { DiscoveryMatch } from '@khanij/types';
import type { ListingDocument } from '../providers/search/search.service';

/**
 * Ranking weights — transparent, deterministic.
 * Total = 100%.
 *
 * trustScore:        40% — compliance is the product
 * priceVsFairBand:   25% — how close to fair market value
 * proximity:         15% — same state/district bonus
 * dispatchLeadDays:  10% — faster is better
 * dealHistory:       10% — past successful deals (stub for now)
 */
const WEIGHTS = {
  trustScore: 0.4,
  priceVsFairBand: 0.25,
  proximity: 0.15,
  dispatchLeadDays: 0.1,
  dealHistory: 0.1,
} as const;

export interface RankingContext {
  fairLow: number;   // paise
  fairHigh: number;  // paise
  refPrice: number;  // paise
  buyerState?: string;
  buyerDistrict?: string;
}

/**
 * Score a single listing match. Returns 0–100.
 * Pure function — deterministic given inputs.
 */
export function scoreListing(
  listing: ListingDocument,
  context: RankingContext,
): DiscoveryMatch['breakdown'] {
  // ─── Trust Score (40%) ─────────────────────────────────────────────
  // Direct pass-through: 0–100 → 0–100 raw
  const trustRaw = listing.sellerTrustScore;

  // ─── Price vs Fair Band (25%) ──────────────────────────────────────
  // Score: 100 if at or below fair_low, 0 if 50%+ above fair_high
  let priceRaw = 100;
  if (context.refPrice > 0 && listing.askPriceInPaise > 0) {
    if (listing.askPriceInPaise <= context.fairLow) {
      priceRaw = 100;
    } else if (listing.askPriceInPaise <= context.fairHigh) {
      // Linear interpolation within the band
      const range = context.fairHigh - context.fairLow;
      const position = listing.askPriceInPaise - context.fairLow;
      priceRaw = range > 0 ? 100 - (position / range) * 30 : 85; // 100→70 within band
    } else {
      // Above fair band — steep penalty
      const overshoot = (listing.askPriceInPaise - context.fairHigh) / context.refPrice;
      priceRaw = Math.max(0, 70 - overshoot * 140); // drops to 0 at 50% above fair_high
    }
  }

  // ─── Proximity (15%) ───────────────────────────────────────────────
  // Same state = 80, same district = 100, different state = 40
  let proximityRaw = 50;
  if (context.buyerState) {
    const listingState = listing.location?.state?.toLowerCase() ?? '';
    const buyerState = context.buyerState.toLowerCase();
    if (listingState === buyerState) {
      proximityRaw = 80;
      if (
        context.buyerDistrict &&
        listing.location?.district?.toLowerCase() === context.buyerDistrict.toLowerCase()
      ) {
        proximityRaw = 100;
      }
    } else {
      proximityRaw = 40;
    }
  }

  // ─── Dispatch Lead Days (10%) ──────────────────────────────────────
  // 1 day = 100, 30+ days = 20
  const days = listing.dispatchLeadDays;
  const dispatchRaw = Math.max(20, 100 - (days - 1) * (80 / 29));

  // ─── Deal History (10%) ────────────────────────────────────────────
  // Stub: will integrate with deal module in Phase 6
  const dealHistoryRaw = 50;

  return {
    trustScore: {
      raw: round(trustRaw),
      weighted: round(trustRaw * WEIGHTS.trustScore),
    },
    priceVsFairBand: {
      raw: round(priceRaw),
      weighted: round(priceRaw * WEIGHTS.priceVsFairBand),
    },
    proximity: {
      raw: round(proximityRaw),
      weighted: round(proximityRaw * WEIGHTS.proximity),
    },
    dispatchLeadDays: {
      raw: round(dispatchRaw),
      weighted: round(dispatchRaw * WEIGHTS.dispatchLeadDays),
    },
    dealHistory: {
      raw: round(dealHistoryRaw),
      weighted: round(dealHistoryRaw * WEIGHTS.dealHistory),
    },
  };
}

/**
 * Compute the final composite score from a breakdown.
 */
export function compositeScore(breakdown: DiscoveryMatch['breakdown']): number {
  return round(
    breakdown.trustScore.weighted +
    breakdown.priceVsFairBand.weighted +
    breakdown.proximity.weighted +
    breakdown.dispatchLeadDays.weighted +
    breakdown.dealHistory.weighted,
  );
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

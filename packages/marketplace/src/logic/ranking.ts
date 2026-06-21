import type { DiscoveryMatch } from '@khanij/types';
import type { ListingDocument } from '../types/listing-document';

const WEIGHTS = {
  trustScore: 0.4,
  priceVsFairBand: 0.25,
  proximity: 0.15,
  dispatchLeadDays: 0.1,
  dealHistory: 0.1,
} as const;

export interface RankingContext {
  fairLow: number;
  fairHigh: number;
  refPrice: number;
  buyerState?: string;
  buyerDistrict?: string;
}

export function scoreListing(
  listing: ListingDocument,
  context: RankingContext,
): DiscoveryMatch['breakdown'] {
  const trustRaw = listing.sellerTrustScore;

  let priceRaw = 100;
  if (context.refPrice > 0 && listing.askPriceInPaise > 0) {
    if (listing.askPriceInPaise <= context.fairLow) {
      priceRaw = 100;
    } else if (listing.askPriceInPaise <= context.fairHigh) {
      const range = context.fairHigh - context.fairLow;
      const position = listing.askPriceInPaise - context.fairLow;
      priceRaw = range > 0 ? 100 - (position / range) * 30 : 85;
    } else {
      const overshoot = (listing.askPriceInPaise - context.fairHigh) / context.refPrice;
      priceRaw = Math.max(0, 70 - overshoot * 140);
    }
  }

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

  const days = listing.dispatchLeadDays;
  const dispatchRaw = Math.max(20, 100 - (days - 1) * (80 / 29));

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

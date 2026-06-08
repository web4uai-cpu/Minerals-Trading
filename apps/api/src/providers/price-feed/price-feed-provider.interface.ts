/**
 * Price Feed Provider interface — the pluggable swap layer for mineral reference prices.
 */
export interface ReferencePriceResult {
  fairLow: number;   // paise
  fairHigh: number;  // paise
  refPrice: number;  // paise (midpoint or weighted average)
  source: string;
  asOf: Date;
}

export interface PriceFeedProvider {
  getReferencePrice(
    mineralId: string,
    grade: Record<string, number>,
    state: string,
  ): Promise<ReferencePriceResult>;
}

export const PRICE_FEED_PROVIDER = Symbol('PRICE_FEED_PROVIDER');

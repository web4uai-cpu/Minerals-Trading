import { scoreListing, compositeScore, RankingContext } from './ranking';
import type { ListingDocument } from '../providers/search/search.service';

const baseListing: ListingDocument = {
  listingId: 'listing-1',
  sellerOrgId: 'org-1',
  sellerLegalName: 'Test Mining Co',
  mineralId: 'mineral-1',
  mineralName: 'Iron Ore',
  grade: { 'Fe%': 62, 'moisture%': 4 },
  quantityAvailable: 5000,
  unit: 'MT',
  askPriceInPaise: 585000, // ₹5,850/MT
  location: { district: 'Keonjhar', state: 'Odisha' },
  dispatchLeadDays: 7,
  sellerTrustScore: 85,
  createdAt: '2025-06-01T00:00:00Z',
};

const baseContext: RankingContext = {
  fairLow: 550000,
  fairHigh: 620000,
  refPrice: 585000,
  buyerState: 'Odisha',
};

describe('scoreListing', () => {
  it('returns a breakdown with all 5 factors', () => {
    const breakdown = scoreListing(baseListing, baseContext);
    expect(breakdown).toHaveProperty('trustScore');
    expect(breakdown).toHaveProperty('priceVsFairBand');
    expect(breakdown).toHaveProperty('proximity');
    expect(breakdown).toHaveProperty('dispatchLeadDays');
    expect(breakdown).toHaveProperty('dealHistory');
  });

  it('each factor has raw and weighted properties', () => {
    const breakdown = scoreListing(baseListing, baseContext);
    for (const factor of Object.values(breakdown)) {
      expect(factor).toHaveProperty('raw');
      expect(factor).toHaveProperty('weighted');
      expect(typeof factor.raw).toBe('number');
      expect(typeof factor.weighted).toBe('number');
    }
  });

  it('is deterministic — same inputs produce same output', () => {
    const a = scoreListing(baseListing, baseContext);
    const b = scoreListing(baseListing, baseContext);
    expect(compositeScore(a)).toBe(compositeScore(b));
  });

  describe('trustScore factor (40%)', () => {
    it('weights trustScore at 40%', () => {
      const breakdown = scoreListing(baseListing, baseContext);
      // 85 * 0.4 = 34
      expect(breakdown.trustScore.raw).toBe(85);
      expect(breakdown.trustScore.weighted).toBe(34);
    });

    it('returns 0 weighted for trustScore = 0', () => {
      const listing = { ...baseListing, sellerTrustScore: 0 };
      const breakdown = scoreListing(listing, baseContext);
      expect(breakdown.trustScore.weighted).toBe(0);
    });

    it('returns 40 weighted for trustScore = 100', () => {
      const listing = { ...baseListing, sellerTrustScore: 100 };
      const breakdown = scoreListing(listing, baseContext);
      expect(breakdown.trustScore.weighted).toBe(40);
    });
  });

  describe('priceVsFairBand factor (25%)', () => {
    it('gives 100 raw when price is at or below fairLow', () => {
      const listing = { ...baseListing, askPriceInPaise: 540000 };
      const breakdown = scoreListing(listing, baseContext);
      expect(breakdown.priceVsFairBand.raw).toBe(100);
    });

    it('gives partial score within the fair band', () => {
      const listing = { ...baseListing, askPriceInPaise: 585000 }; // midpoint
      const breakdown = scoreListing(listing, baseContext);
      expect(breakdown.priceVsFairBand.raw).toBeGreaterThan(70);
      expect(breakdown.priceVsFairBand.raw).toBeLessThan(100);
    });

    it('penalises heavily above fair band', () => {
      const listing = { ...baseListing, askPriceInPaise: 800000 }; // way above
      const breakdown = scoreListing(listing, baseContext);
      expect(breakdown.priceVsFairBand.raw).toBeLessThan(50);
    });
  });

  describe('proximity factor (15%)', () => {
    it('gives 80 for same state', () => {
      const breakdown = scoreListing(baseListing, { ...baseContext, buyerState: 'Odisha' });
      expect(breakdown.proximity.raw).toBe(80);
    });

    it('gives 100 for same state + same district', () => {
      const breakdown = scoreListing(baseListing, {
        ...baseContext,
        buyerState: 'Odisha',
        buyerDistrict: 'Keonjhar',
      });
      expect(breakdown.proximity.raw).toBe(100);
    });

    it('gives 40 for different state', () => {
      const breakdown = scoreListing(baseListing, { ...baseContext, buyerState: 'Karnataka' });
      expect(breakdown.proximity.raw).toBe(40);
    });

    it('gives 50 when no buyer state', () => {
      const breakdown = scoreListing(baseListing, { ...baseContext, buyerState: undefined });
      expect(breakdown.proximity.raw).toBe(50);
    });
  });

  describe('dispatchLeadDays factor (10%)', () => {
    it('gives 100 for 1 day', () => {
      const listing = { ...baseListing, dispatchLeadDays: 1 };
      const breakdown = scoreListing(listing, baseContext);
      expect(breakdown.dispatchLeadDays.raw).toBe(100);
    });

    it('gives lower score for longer dispatch', () => {
      const listing = { ...baseListing, dispatchLeadDays: 15 };
      const breakdown = scoreListing(listing, baseContext);
      expect(breakdown.dispatchLeadDays.raw).toBeLessThan(65);
    });

    it('gives minimum 20 for 30+ days', () => {
      const listing = { ...baseListing, dispatchLeadDays: 30 };
      const breakdown = scoreListing(listing, baseContext);
      expect(breakdown.dispatchLeadDays.raw).toBeGreaterThanOrEqual(20);
    });
  });
});

describe('compositeScore', () => {
  it('sums all weighted values', () => {
    const breakdown = scoreListing(baseListing, baseContext);
    const total = compositeScore(breakdown);
    const manual =
      breakdown.trustScore.weighted +
      breakdown.priceVsFairBand.weighted +
      breakdown.proximity.weighted +
      breakdown.dispatchLeadDays.weighted +
      breakdown.dealHistory.weighted;
    expect(total).toBeCloseTo(manual, 1);
  });

  it('returns a score between 0 and 100', () => {
    const breakdown = scoreListing(baseListing, baseContext);
    const total = compositeScore(breakdown);
    expect(total).toBeGreaterThanOrEqual(0);
    expect(total).toBeLessThanOrEqual(100);
  });

  it('perfect listing scores near 100', () => {
    const perfect = {
      ...baseListing,
      sellerTrustScore: 100,
      askPriceInPaise: 540000, // below fairLow
      dispatchLeadDays: 1,
    };
    const breakdown = scoreListing(perfect, {
      ...baseContext,
      buyerState: 'Odisha',
      buyerDistrict: 'Keonjhar',
    });
    const total = compositeScore(breakdown);
    expect(total).toBeGreaterThan(85);
  });
});

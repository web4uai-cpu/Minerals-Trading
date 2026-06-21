import { AuctionType } from '@khanij/types';
import { validateBid, shouldExtendAuction, BidContext } from './bid-rules';

describe('validateBid', () => {
  const baseContext: BidContext = {
    auctionType: AuctionType.FORWARD,
    currentBestPaise: 100_000n,
    minIncrementPaise: 1_000n,
    reservePriceInPaise: 50_000n,
    auctionEndAt: new Date('2025-06-02T12:00:00Z'),
    now: new Date('2025-06-01T12:00:00Z'),
  };

  it('rejects zero amount', () => {
    const result = validateBid(0n, baseContext);
    expect(result).toEqual({
      valid: false,
      code: 'BID_AMOUNT_NOT_POSITIVE',
      message: 'Bid amount must be positive',
    });
  });

  it('rejects negative amount', () => {
    const result = validateBid(-1n, baseContext);
    expect(result).toEqual({
      valid: false,
      code: 'BID_AMOUNT_NOT_POSITIVE',
      message: 'Bid amount must be positive',
    });
  });

  it('rejects bid after auction ended', () => {
    const result = validateBid(200_000n, {
      ...baseContext,
      now: new Date('2025-06-03T00:00:00Z'),
    });
    expect(result).toEqual({
      valid: false,
      code: 'AUCTION_ENDED',
      message: 'Cannot place bid after auction has ended',
    });
  });

  it('rejects bid exactly at auction end time', () => {
    const result = validateBid(200_000n, {
      ...baseContext,
      now: new Date('2025-06-02T12:00:00Z'),
    });
    expect(result).toEqual({
      valid: false,
      code: 'AUCTION_ENDED',
      message: 'Cannot place bid after auction has ended',
    });
  });

  describe('FORWARD auction', () => {
    it('accepts bid above currentBest + increment', () => {
      const result = validateBid(101_000n, baseContext);
      expect(result).toEqual({ valid: true });
    });

    it('accepts bid exactly at currentBest + increment', () => {
      const result = validateBid(101_000n, baseContext);
      expect(result).toEqual({ valid: true });
    });

    it('rejects bid below currentBest + increment', () => {
      const result = validateBid(100_999n, baseContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('BID_TOO_LOW');
      }
    });

    it('accepts first bid at reserve price (no existing bids)', () => {
      const result = validateBid(50_000n, {
        ...baseContext,
        currentBestPaise: null,
      });
      expect(result).toEqual({ valid: true });
    });

    it('accepts first bid above reserve price (no existing bids)', () => {
      const result = validateBid(60_000n, {
        ...baseContext,
        currentBestPaise: null,
      });
      expect(result).toEqual({ valid: true });
    });

    it('rejects first bid below reserve price', () => {
      const result = validateBid(49_999n, {
        ...baseContext,
        currentBestPaise: null,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('BID_BELOW_RESERVE');
      }
    });
  });

  describe('REVERSE auction', () => {
    const reverseContext: BidContext = {
      ...baseContext,
      auctionType: AuctionType.REVERSE,
      currentBestPaise: 100_000n,
      minIncrementPaise: 1_000n,
      reservePriceInPaise: 200_000n,
    };

    it('accepts bid below currentBest - increment', () => {
      const result = validateBid(98_000n, reverseContext);
      expect(result).toEqual({ valid: true });
    });

    it('accepts bid exactly at currentBest - increment', () => {
      const result = validateBid(99_000n, reverseContext);
      expect(result).toEqual({ valid: true });
    });

    it('rejects bid above currentBest - increment', () => {
      const result = validateBid(99_001n, reverseContext);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('BID_TOO_HIGH');
      }
    });

    it('accepts first bid at reserve price (no existing bids)', () => {
      const result = validateBid(200_000n, {
        ...reverseContext,
        currentBestPaise: null,
      });
      expect(result).toEqual({ valid: true });
    });

    it('rejects first bid above reserve price', () => {
      const result = validateBid(200_001n, {
        ...reverseContext,
        currentBestPaise: null,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('BID_ABOVE_RESERVE');
      }
    });
  });
});

describe('shouldExtendAuction', () => {
  const auctionEndAt = new Date('2025-06-02T12:00:00Z');
  const antiSnipingMinutes = 5;

  it('extends when bid is placed within anti-sniping window', () => {
    const bidTime = new Date('2025-06-02T11:57:00Z'); // 3 minutes before end
    const result = shouldExtendAuction(bidTime, auctionEndAt, antiSnipingMinutes);
    expect(result).not.toBeNull();
    // Should extend by antiSnipingMinutes from original end
    expect(result!.getTime()).toBe(
      auctionEndAt.getTime() + antiSnipingMinutes * 60 * 1000,
    );
  });

  it('extends when bid is placed exactly at anti-sniping boundary', () => {
    const bidTime = new Date('2025-06-02T11:55:00Z'); // exactly 5 minutes before end
    const result = shouldExtendAuction(bidTime, auctionEndAt, antiSnipingMinutes);
    expect(result).not.toBeNull();
  });

  it('does not extend when bid is placed well before anti-sniping window', () => {
    const bidTime = new Date('2025-06-02T11:00:00Z'); // 60 minutes before end
    const result = shouldExtendAuction(bidTime, auctionEndAt, antiSnipingMinutes);
    expect(result).toBeNull();
  });

  it('does not extend when bid is placed after auction end', () => {
    const bidTime = new Date('2025-06-02T12:01:00Z');
    const result = shouldExtendAuction(bidTime, auctionEndAt, antiSnipingMinutes);
    expect(result).toBeNull();
  });
});

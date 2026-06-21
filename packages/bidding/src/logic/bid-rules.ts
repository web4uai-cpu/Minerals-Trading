import { AuctionType } from '@khanij/types';

export interface BidContext {
  auctionType: AuctionType;
  currentBestPaise: bigint | null;
  minIncrementPaise: bigint;
  reservePriceInPaise: bigint | null;
  auctionEndAt: Date;
  now: Date;
}

export type BidValidationResult =
  | { valid: true }
  | { valid: false; code: string; message: string };

export function validateBid(
  amountPaise: bigint,
  context: BidContext,
): BidValidationResult {
  if (amountPaise <= 0n) {
    return {
      valid: false,
      code: 'BID_AMOUNT_NOT_POSITIVE',
      message: 'Bid amount must be positive',
    };
  }

  if (context.now >= context.auctionEndAt) {
    return {
      valid: false,
      code: 'AUCTION_ENDED',
      message: 'Cannot place bid after auction has ended',
    };
  }

  if (context.auctionType === AuctionType.FORWARD) {
    return validateForwardBid(amountPaise, context);
  }

  return validateReverseBid(amountPaise, context);
}

function validateForwardBid(
  amountPaise: bigint,
  context: BidContext,
): BidValidationResult {
  if (context.currentBestPaise !== null) {
    const minimumBid = context.currentBestPaise + context.minIncrementPaise;
    if (amountPaise < minimumBid) {
      return {
        valid: false,
        code: 'BID_TOO_LOW',
        message: `Forward auction bid must be at least ${minimumBid} paise (current best ${context.currentBestPaise} + increment ${context.minIncrementPaise})`,
      };
    }
  } else if (context.reservePriceInPaise !== null) {
    if (amountPaise < context.reservePriceInPaise) {
      return {
        valid: false,
        code: 'BID_BELOW_RESERVE',
        message: `Bid must be at least the reserve price of ${context.reservePriceInPaise} paise`,
      };
    }
  }

  return { valid: true };
}

function validateReverseBid(
  amountPaise: bigint,
  context: BidContext,
): BidValidationResult {
  if (context.currentBestPaise !== null) {
    const maximumBid = context.currentBestPaise - context.minIncrementPaise;
    if (amountPaise > maximumBid) {
      return {
        valid: false,
        code: 'BID_TOO_HIGH',
        message: `Reverse auction bid must be at most ${maximumBid} paise (current best ${context.currentBestPaise} - increment ${context.minIncrementPaise})`,
      };
    }
  } else if (context.reservePriceInPaise !== null) {
    if (amountPaise > context.reservePriceInPaise) {
      return {
        valid: false,
        code: 'BID_ABOVE_RESERVE',
        message: `Bid must be at most the reserve price of ${context.reservePriceInPaise} paise`,
      };
    }
  }

  return { valid: true };
}

/**
 * Anti-sniping: if a bid is placed within `antiSnipingMinutes` of auction end,
 * returns a new extended endAt. Otherwise returns null.
 */
export function shouldExtendAuction(
  bidTime: Date,
  auctionEndAt: Date,
  antiSnipingMinutes: number,
): Date | null {
  const thresholdMs = antiSnipingMinutes * 60 * 1000;
  const timeUntilEndMs = auctionEndAt.getTime() - bidTime.getTime();

  if (timeUntilEndMs > 0 && timeUntilEndMs <= thresholdMs) {
    return new Date(auctionEndAt.getTime() + thresholdMs);
  }

  return null;
}

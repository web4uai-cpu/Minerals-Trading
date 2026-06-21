import { AuctionStatus } from '@khanij/types';
import {
  validateAuctionTransition,
  getLegalNextAuctionStates,
  isTerminalAuctionState,
} from './auction-state-machine';

describe('validateAuctionTransition', () => {
  const now = new Date('2025-06-01T12:00:00Z');

  it('DRAFT → OPEN (happy path)', () => {
    const result = validateAuctionTransition(
      AuctionStatus.DRAFT,
      AuctionStatus.OPEN,
      {
        now,
        startAt: new Date('2025-06-01T10:00:00Z'),
        endAt: new Date('2025-06-02T12:00:00Z'),
      },
    );
    expect(result).toEqual({ valid: true });
  });

  it('DRAFT → OPEN rejects if before startAt', () => {
    const result = validateAuctionTransition(
      AuctionStatus.DRAFT,
      AuctionStatus.OPEN,
      {
        now,
        startAt: new Date('2025-06-01T14:00:00Z'),
        endAt: new Date('2025-06-02T12:00:00Z'),
      },
    );
    expect(result).toEqual({
      valid: false,
      code: 'AUCTION_NOT_STARTED',
      message: 'Cannot open auction before its start time',
    });
  });

  it('OPEN → CLOSED (happy path)', () => {
    const result = validateAuctionTransition(
      AuctionStatus.OPEN,
      AuctionStatus.CLOSED,
    );
    expect(result).toEqual({ valid: true });
  });

  it('CLOSED → AWARDED (happy path, has bids)', () => {
    const result = validateAuctionTransition(
      AuctionStatus.CLOSED,
      AuctionStatus.AWARDED,
      { hasBids: true },
    );
    expect(result).toEqual({ valid: true });
  });

  it('CLOSED → AWARDED rejects when no bids', () => {
    const result = validateAuctionTransition(
      AuctionStatus.CLOSED,
      AuctionStatus.AWARDED,
      { hasBids: false },
    );
    expect(result).toEqual({
      valid: false,
      code: 'NO_BIDS',
      message: 'Cannot award auction with no bids',
    });
  });

  it('rejects illegal transition', () => {
    const result = validateAuctionTransition(
      AuctionStatus.DRAFT,
      AuctionStatus.AWARDED,
    );
    expect(result).toEqual({
      valid: false,
      code: 'ILLEGAL_AUCTION_TRANSITION',
      message: 'Cannot transition auction from DRAFT to AWARDED',
    });
  });

  it('rejects transition from terminal state AWARDED', () => {
    const result = validateAuctionTransition(
      AuctionStatus.AWARDED,
      AuctionStatus.OPEN,
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe('AUCTION_TERMINAL_STATE');
    }
  });

  it('rejects transition from terminal state CANCELLED', () => {
    const result = validateAuctionTransition(
      AuctionStatus.CANCELLED,
      AuctionStatus.DRAFT,
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe('AUCTION_TERMINAL_STATE');
    }
  });
});

describe('getLegalNextAuctionStates', () => {
  it('returns OPEN and CANCELLED for DRAFT', () => {
    expect(getLegalNextAuctionStates(AuctionStatus.DRAFT)).toEqual([
      AuctionStatus.OPEN,
      AuctionStatus.CANCELLED,
    ]);
  });

  it('returns empty array for terminal states', () => {
    expect(getLegalNextAuctionStates(AuctionStatus.AWARDED)).toEqual([]);
    expect(getLegalNextAuctionStates(AuctionStatus.CANCELLED)).toEqual([]);
  });
});

describe('isTerminalAuctionState', () => {
  it('AWARDED is terminal', () => {
    expect(isTerminalAuctionState(AuctionStatus.AWARDED)).toBe(true);
  });

  it('CANCELLED is terminal', () => {
    expect(isTerminalAuctionState(AuctionStatus.CANCELLED)).toBe(true);
  });

  it('DRAFT is not terminal', () => {
    expect(isTerminalAuctionState(AuctionStatus.DRAFT)).toBe(false);
  });
});

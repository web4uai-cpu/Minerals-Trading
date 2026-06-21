import { AuctionStatus } from '@khanij/types';

const TERMINAL_STATES: AuctionStatus[] = [
  AuctionStatus.AWARDED,
  AuctionStatus.CANCELLED,
];

const LEGAL_TRANSITIONS: Record<AuctionStatus, AuctionStatus[]> = {
  [AuctionStatus.DRAFT]: [AuctionStatus.OPEN, AuctionStatus.CANCELLED],
  [AuctionStatus.OPEN]: [AuctionStatus.CLOSED, AuctionStatus.CANCELLED],
  [AuctionStatus.CLOSED]: [AuctionStatus.AWARDED, AuctionStatus.CANCELLED],
  [AuctionStatus.AWARDED]: [],
  [AuctionStatus.CANCELLED]: [],
};

export interface AuctionTransitionContext {
  now?: Date;
  startAt?: Date;
  endAt?: Date;
  hasBids?: boolean;
}

export type AuctionTransitionResult =
  | { valid: true }
  | { valid: false; code: string; message: string };

export function validateAuctionTransition(
  from: AuctionStatus,
  to: AuctionStatus,
  context: AuctionTransitionContext = {},
): AuctionTransitionResult {
  if (TERMINAL_STATES.includes(from)) {
    return {
      valid: false,
      code: 'AUCTION_TERMINAL_STATE',
      message: `Auction is in terminal state ${from} — no further transitions allowed`,
    };
  }

  const allowed = LEGAL_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    return {
      valid: false,
      code: 'ILLEGAL_AUCTION_TRANSITION',
      message: `Cannot transition auction from ${from} to ${to}`,
    };
  }

  // Precondition: DRAFT → OPEN requires startAt <= now AND endAt > now
  if (from === AuctionStatus.DRAFT && to === AuctionStatus.OPEN) {
    const now = context.now ?? new Date();
    if (context.startAt && context.startAt > now) {
      return {
        valid: false,
        code: 'AUCTION_NOT_STARTED',
        message: 'Cannot open auction before its start time',
      };
    }
    if (context.endAt && context.endAt <= now) {
      return {
        valid: false,
        code: 'AUCTION_ALREADY_ENDED',
        message: 'Cannot open auction after its end time has passed',
      };
    }
  }

  // Precondition: CLOSED → AWARDED requires at least one bid
  if (from === AuctionStatus.CLOSED && to === AuctionStatus.AWARDED) {
    if (!context.hasBids) {
      return {
        valid: false,
        code: 'NO_BIDS',
        message: 'Cannot award auction with no bids',
      };
    }
  }

  return { valid: true };
}

export function getLegalNextAuctionStates(from: AuctionStatus): AuctionStatus[] {
  return LEGAL_TRANSITIONS[from] ?? [];
}

export function isTerminalAuctionState(status: AuctionStatus): boolean {
  return TERMINAL_STATES.includes(status);
}

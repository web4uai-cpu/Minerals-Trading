// @khanij/bidding — Auction and bidding system (Phase 5)
//
// Pure business logic for the auction state machine, bid validation,
// increment rules, and anti-sniping logic. Separate from the RFQ flow.
//
// Owns: Auction, Bid entities.

export {
  validateAuctionTransition,
  getLegalNextAuctionStates,
  isTerminalAuctionState,
  type AuctionTransitionContext,
  type AuctionTransitionResult,
} from './logic/auction-state-machine';

export {
  validateBid,
  shouldExtendAuction,
  type BidContext,
  type BidValidationResult,
} from './logic/bid-rules';

export {
  validateDealTransition,
  getLegalNextStates,
  isTerminalState,
  type TransitionContext,
  type TransitionResult,
} from './logic/deal-state-machine';

export {
  computeEscrowBalance,
  type EscrowEntry,
} from './logic/escrow-calculator';

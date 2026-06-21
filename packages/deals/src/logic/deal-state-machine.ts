import { DealStatus } from '@khanij/types';

const TERMINAL_STATES: DealStatus[] = [
  DealStatus.COMPLETED,
  DealStatus.CANCELLED,
];

const LEGAL_TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  [DealStatus.CREATED]: [DealStatus.AGREEMENT_DRAFT, DealStatus.CANCELLED],
  [DealStatus.AGREEMENT_DRAFT]: [DealStatus.SIGNED, DealStatus.CANCELLED],
  [DealStatus.SIGNED]: [DealStatus.ESCROW_PENDING, DealStatus.CANCELLED],
  [DealStatus.ESCROW_PENDING]: [DealStatus.IN_FULFILMENT, DealStatus.CANCELLED],
  [DealStatus.IN_FULFILMENT]: [DealStatus.COMPLETED, DealStatus.DISPUTED, DealStatus.CANCELLED],
  [DealStatus.COMPLETED]: [],
  [DealStatus.DISPUTED]: [DealStatus.COMPLETED, DealStatus.CANCELLED],
  [DealStatus.CANCELLED]: [],
};

export interface TransitionContext {
  bothOrgsVerified?: boolean;
  escrowHeld?: boolean;
}

export type TransitionResult =
  | { valid: true }
  | { valid: false; code: string; message: string };

export function validateDealTransition(
  from: DealStatus,
  to: DealStatus,
  context: TransitionContext = {},
): TransitionResult {
  if (TERMINAL_STATES.includes(from)) {
    return {
      valid: false,
      code: 'DEAL_TERMINAL_STATE',
      message: `Deal is in terminal state ${from} — no further transitions allowed`,
    };
  }

  const allowed = LEGAL_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    return {
      valid: false,
      code: 'ILLEGAL_DEAL_TRANSITION',
      message: `Cannot transition deal from ${from} to ${to}`,
    };
  }

  if (to === DealStatus.SIGNED && !context.bothOrgsVerified) {
    return {
      valid: false,
      code: 'ORGS_NOT_VERIFIED',
      message: 'Both buyer and seller organizations must be VERIFIED before signing',
    };
  }

  if (to === DealStatus.IN_FULFILMENT && !context.escrowHeld) {
    return {
      valid: false,
      code: 'ESCROW_NOT_HELD',
      message: 'Escrow must be held before moving to IN_FULFILMENT',
    };
  }

  return { valid: true };
}

export function getLegalNextStates(from: DealStatus): DealStatus[] {
  return LEGAL_TRANSITIONS[from] ?? [];
}

export function isTerminalState(status: DealStatus): boolean {
  return TERMINAL_STATES.includes(status);
}

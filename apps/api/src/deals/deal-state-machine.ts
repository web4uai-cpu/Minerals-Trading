import { BadRequestException } from '@nestjs/common';
import { DealStatus } from '@prisma/client';

/**
 * Deal state machine — strict transitions.
 * Pure function. Unit-testable.
 *
 * Flow:
 *   CREATED → AGREEMENT_DRAFT
 *   AGREEMENT_DRAFT → SIGNED (requires both orgs VERIFIED)
 *   SIGNED → ESCROW_PENDING
 *   ESCROW_PENDING → IN_FULFILMENT (requires escrow HELD)
 *   IN_FULFILMENT → COMPLETED | DISPUTED
 *   Any non-terminal → CANCELLED
 *
 * Terminal states: COMPLETED, CANCELLED
 * DISPUTED is frozen — awaits arbitration award.
 */

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
  [DealStatus.DISPUTED]: [], // frozen — only arbitration can resolve
  [DealStatus.CANCELLED]: [],
};

export interface TransitionContext {
  bothOrgsVerified?: boolean;
  escrowHeld?: boolean;
}

/**
 * Assert a deal state transition is legal.
 * Throws BadRequestException if the transition is illegal or a precondition is unmet.
 */
export function assertDealTransition(
  from: DealStatus,
  to: DealStatus,
  context: TransitionContext = {},
): void {
  if (TERMINAL_STATES.includes(from)) {
    throw new BadRequestException({
      code: 'DEAL_TERMINAL_STATE',
      message: `Deal is in terminal state ${from} — no further transitions allowed`,
    });
  }

  const allowed = LEGAL_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new BadRequestException({
      code: 'ILLEGAL_DEAL_TRANSITION',
      message: `Cannot transition deal from ${from} to ${to}`,
    });
  }

  // Precondition: SIGNED requires both orgs VERIFIED (SKILL.md rule)
  if (to === DealStatus.SIGNED && !context.bothOrgsVerified) {
    throw new BadRequestException({
      code: 'ORGS_NOT_VERIFIED',
      message: 'Both buyer and seller organizations must be VERIFIED before signing',
    });
  }

  // Precondition: IN_FULFILMENT requires escrow held
  if (to === DealStatus.IN_FULFILMENT && !context.escrowHeld) {
    throw new BadRequestException({
      code: 'ESCROW_NOT_HELD',
      message: 'Escrow must be held before moving to IN_FULFILMENT',
    });
  }
}

/**
 * Get the list of legal next states from a given state.
 */
export function getLegalNextStates(from: DealStatus): DealStatus[] {
  return LEGAL_TRANSITIONS[from] ?? [];
}

/**
 * Check if a deal state is terminal.
 */
export function isTerminalState(status: DealStatus): boolean {
  return TERMINAL_STATES.includes(status);
}

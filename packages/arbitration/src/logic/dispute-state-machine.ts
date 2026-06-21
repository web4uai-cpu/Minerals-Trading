import { DisputeStatus } from '@khanij/types';

const TERMINAL_STATES: DisputeStatus[] = [
  DisputeStatus.CLOSED,
  DisputeStatus.WITHDRAWN,
];

const LEGAL_TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
  [DisputeStatus.FILED]: [DisputeStatus.UNDER_REVIEW, DisputeStatus.WITHDRAWN],
  [DisputeStatus.UNDER_REVIEW]: [DisputeStatus.HEARING, DisputeStatus.WITHDRAWN, DisputeStatus.CLOSED],
  [DisputeStatus.HEARING]: [DisputeStatus.AWARD_ISSUED, DisputeStatus.WITHDRAWN],
  [DisputeStatus.AWARD_ISSUED]: [DisputeStatus.CLOSED],
  [DisputeStatus.CLOSED]: [],
  [DisputeStatus.WITHDRAWN]: [],
};

export interface DisputeTransitionContext {
  hasEvidence?: boolean;
}

export type DisputeTransitionResult =
  | { valid: true }
  | { valid: false; code: string; message: string };

export function validateDisputeTransition(
  from: DisputeStatus,
  to: DisputeStatus,
  context: DisputeTransitionContext = {},
): DisputeTransitionResult {
  if (TERMINAL_STATES.includes(from)) {
    return {
      valid: false,
      code: 'DISPUTE_TERMINAL_STATE',
      message: `Dispute is in terminal state ${from} — no further transitions allowed`,
    };
  }

  const allowed = LEGAL_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    return {
      valid: false,
      code: 'ILLEGAL_DISPUTE_TRANSITION',
      message: `Cannot transition dispute from ${from} to ${to}`,
    };
  }

  // HEARING -> AWARD_ISSUED requires at least one evidence submission
  if (from === DisputeStatus.HEARING && to === DisputeStatus.AWARD_ISSUED && !context.hasEvidence) {
    return {
      valid: false,
      code: 'NO_EVIDENCE',
      message: 'Cannot issue award without at least one evidence submission',
    };
  }

  return { valid: true };
}

export function getLegalNextDisputeStates(from: DisputeStatus): DisputeStatus[] {
  return LEGAL_TRANSITIONS[from] ?? [];
}

export function isTerminalDisputeState(status: DisputeStatus): boolean {
  return TERMINAL_STATES.includes(status);
}

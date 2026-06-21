import { DisputeStatus } from '@khanij/types';
import {
  validateDisputeTransition,
  getLegalNextDisputeStates,
  isTerminalDisputeState,
} from './dispute-state-machine';

describe('validateDisputeTransition', () => {
  it('allows FILED -> UNDER_REVIEW', () => {
    const result = validateDisputeTransition(DisputeStatus.FILED, DisputeStatus.UNDER_REVIEW);
    expect(result).toEqual({ valid: true });
  });

  it('allows FILED -> WITHDRAWN', () => {
    const result = validateDisputeTransition(DisputeStatus.FILED, DisputeStatus.WITHDRAWN);
    expect(result).toEqual({ valid: true });
  });

  it('allows UNDER_REVIEW -> HEARING', () => {
    const result = validateDisputeTransition(DisputeStatus.UNDER_REVIEW, DisputeStatus.HEARING);
    expect(result).toEqual({ valid: true });
  });

  it('allows HEARING -> AWARD_ISSUED when evidence exists', () => {
    const result = validateDisputeTransition(
      DisputeStatus.HEARING,
      DisputeStatus.AWARD_ISSUED,
      { hasEvidence: true },
    );
    expect(result).toEqual({ valid: true });
  });

  it('rejects HEARING -> AWARD_ISSUED without evidence', () => {
    const result = validateDisputeTransition(
      DisputeStatus.HEARING,
      DisputeStatus.AWARD_ISSUED,
      { hasEvidence: false },
    );
    expect(result).toEqual({
      valid: false,
      code: 'NO_EVIDENCE',
      message: 'Cannot issue award without at least one evidence submission',
    });
  });

  it('rejects illegal transition FILED -> HEARING', () => {
    const result = validateDisputeTransition(DisputeStatus.FILED, DisputeStatus.HEARING);
    expect(result).toEqual({
      valid: false,
      code: 'ILLEGAL_DISPUTE_TRANSITION',
      message: 'Cannot transition dispute from FILED to HEARING',
    });
  });

  it('rejects transition from terminal state CLOSED', () => {
    const result = validateDisputeTransition(DisputeStatus.CLOSED, DisputeStatus.FILED);
    expect(result).toEqual({
      valid: false,
      code: 'DISPUTE_TERMINAL_STATE',
      message: 'Dispute is in terminal state CLOSED — no further transitions allowed',
    });
  });

  it('rejects transition from terminal state WITHDRAWN', () => {
    const result = validateDisputeTransition(DisputeStatus.WITHDRAWN, DisputeStatus.FILED);
    expect(result).toEqual({
      valid: false,
      code: 'DISPUTE_TERMINAL_STATE',
      message: 'Dispute is in terminal state WITHDRAWN — no further transitions allowed',
    });
  });
});

describe('getLegalNextDisputeStates', () => {
  it('returns valid next states for FILED', () => {
    expect(getLegalNextDisputeStates(DisputeStatus.FILED)).toEqual([
      DisputeStatus.UNDER_REVIEW,
      DisputeStatus.WITHDRAWN,
    ]);
  });

  it('returns empty array for terminal state', () => {
    expect(getLegalNextDisputeStates(DisputeStatus.CLOSED)).toEqual([]);
  });
});

describe('isTerminalDisputeState', () => {
  it('returns true for CLOSED', () => {
    expect(isTerminalDisputeState(DisputeStatus.CLOSED)).toBe(true);
  });

  it('returns true for WITHDRAWN', () => {
    expect(isTerminalDisputeState(DisputeStatus.WITHDRAWN)).toBe(true);
  });

  it('returns false for FILED', () => {
    expect(isTerminalDisputeState(DisputeStatus.FILED)).toBe(false);
  });
});

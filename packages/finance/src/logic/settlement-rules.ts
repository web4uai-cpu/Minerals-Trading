/**
 * Settlement Rules — pure business logic for determining escrow
 * settlement actions based on deal state.
 *
 * All amounts in paise (bigint). No floats.
 */

export interface SettlementContext {
  dealStatus: string;
  allMilestonesDone: boolean;
  escrowBalancePaise: bigint;
  totalValuePaise: bigint;
  isDisputed: boolean;
}

export type SettlementAction =
  | { action: 'RELEASE_TO_SELLER'; amountPaise: bigint; reason: string }
  | { action: 'REFUND_TO_BUYER'; amountPaise: bigint; reason: string }
  | { action: 'HOLD'; reason: string }
  | { action: 'NO_ACTION'; reason: string };

/**
 * Determine the correct settlement action for an escrow based on the
 * current deal context.
 *
 * Rules (evaluated in priority order):
 * 1. DISPUTED → HOLD (escrow frozen per constitution)
 * 2. COMPLETED + all milestones done → RELEASE_TO_SELLER
 * 3. CANCELLED → REFUND_TO_BUYER
 * 4. Everything else → NO_ACTION
 *
 * Zero-balance escrows always return NO_ACTION (nothing to move).
 */
export function determineSettlement(context: SettlementContext): SettlementAction {
  const { dealStatus, allMilestonesDone, escrowBalancePaise, isDisputed } = context;

  // Nothing to settle if balance is zero
  if (escrowBalancePaise <= 0n) {
    return { action: 'NO_ACTION', reason: 'Escrow balance is zero; nothing to settle' };
  }

  // Disputed takes priority — freeze funds regardless of status
  if (isDisputed) {
    return { action: 'HOLD', reason: 'Deal is disputed; escrow frozen pending resolution' };
  }

  if (dealStatus === 'COMPLETED' && allMilestonesDone) {
    return {
      action: 'RELEASE_TO_SELLER',
      amountPaise: escrowBalancePaise,
      reason: 'Deal completed with all milestones fulfilled; releasing escrow to seller',
    };
  }

  if (dealStatus === 'CANCELLED') {
    return {
      action: 'REFUND_TO_BUYER',
      amountPaise: escrowBalancePaise,
      reason: 'Deal cancelled; refunding escrow to buyer',
    };
  }

  return { action: 'NO_ACTION', reason: `Deal status is ${dealStatus}; no settlement action required` };
}

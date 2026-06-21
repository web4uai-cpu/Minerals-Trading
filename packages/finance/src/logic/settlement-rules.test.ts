import { determineSettlement } from './settlement-rules';

describe('determineSettlement', () => {
  it('releases to seller when COMPLETED with all milestones done', () => {
    const result = determineSettlement({
      dealStatus: 'COMPLETED',
      allMilestonesDone: true,
      escrowBalancePaise: 5_000_000n,
      totalValuePaise: 5_000_000n,
      isDisputed: false,
    });

    expect(result.action).toBe('RELEASE_TO_SELLER');
    if (result.action === 'RELEASE_TO_SELLER') {
      expect(result.amountPaise).toBe(5_000_000n);
    }
  });

  it('refunds to buyer when CANCELLED', () => {
    const result = determineSettlement({
      dealStatus: 'CANCELLED',
      allMilestonesDone: false,
      escrowBalancePaise: 3_000_000n,
      totalValuePaise: 5_000_000n,
      isDisputed: false,
    });

    expect(result.action).toBe('REFUND_TO_BUYER');
    if (result.action === 'REFUND_TO_BUYER') {
      expect(result.amountPaise).toBe(3_000_000n);
    }
  });

  it('holds escrow when disputed', () => {
    const result = determineSettlement({
      dealStatus: 'COMPLETED',
      allMilestonesDone: true,
      escrowBalancePaise: 5_000_000n,
      totalValuePaise: 5_000_000n,
      isDisputed: true,
    });

    expect(result.action).toBe('HOLD');
  });

  it('returns NO_ACTION for IN_FULFILMENT', () => {
    const result = determineSettlement({
      dealStatus: 'IN_FULFILMENT',
      allMilestonesDone: false,
      escrowBalancePaise: 5_000_000n,
      totalValuePaise: 10_000_000n,
      isDisputed: false,
    });

    expect(result.action).toBe('NO_ACTION');
  });

  it('returns NO_ACTION when escrow balance is zero', () => {
    const result = determineSettlement({
      dealStatus: 'COMPLETED',
      allMilestonesDone: true,
      escrowBalancePaise: 0n,
      totalValuePaise: 5_000_000n,
      isDisputed: false,
    });

    expect(result.action).toBe('NO_ACTION');
    expect(result.reason).toContain('zero');
  });

  it('returns NO_ACTION for COMPLETED without all milestones', () => {
    const result = determineSettlement({
      dealStatus: 'COMPLETED',
      allMilestonesDone: false,
      escrowBalancePaise: 5_000_000n,
      totalValuePaise: 5_000_000n,
      isDisputed: false,
    });

    expect(result.action).toBe('NO_ACTION');
  });

  it('prioritizes dispute over completed status', () => {
    const result = determineSettlement({
      dealStatus: 'COMPLETED',
      allMilestonesDone: true,
      escrowBalancePaise: 5_000_000n,
      totalValuePaise: 5_000_000n,
      isDisputed: true,
    });

    // Disputed takes priority even if deal is completed
    expect(result.action).toBe('HOLD');
  });
});

import { computeAwardEscrowSplit } from './award-rules';

describe('computeAwardEscrowSplit', () => {
  it('releases 100% to seller', () => {
    const result = computeAwardEscrowSplit(1000000n, 'RELEASE_TO_SELLER');
    expect(result).toEqual({
      action: 'RELEASE_TO_SELLER',
      sellerAmountPaise: 1000000n,
      buyerAmountPaise: 0n,
    });
  });

  it('refunds 100% to buyer', () => {
    const result = computeAwardEscrowSplit(1000000n, 'REFUND_TO_BUYER');
    expect(result).toEqual({
      action: 'REFUND_TO_BUYER',
      sellerAmountPaise: 0n,
      buyerAmountPaise: 1000000n,
    });
  });

  it('splits 60/40 correctly', () => {
    const result = computeAwardEscrowSplit(1000000n, 'SPLIT', 60);
    expect(result.action).toBe('SPLIT');
    expect(result.sellerAmountPaise).toBe(600000n);
    expect(result.buyerAmountPaise).toBe(400000n);
  });

  it('defaults to 50/50 split when no percent given', () => {
    const result = computeAwardEscrowSplit(1000000n, 'SPLIT');
    expect(result.sellerAmountPaise).toBe(500000n);
    expect(result.buyerAmountPaise).toBe(500000n);
  });

  it('rounding preserves total (odd amount)', () => {
    // 1000001 paise at 33% seller => seller gets floor, buyer gets remainder
    const result = computeAwardEscrowSplit(1000001n, 'SPLIT', 33);
    expect(result.sellerAmountPaise + result.buyerAmountPaise).toBe(1000001n);
    // 33% of 1000001 = 330000.33 -> seller gets floor
    expect(result.sellerAmountPaise).toBe(330000n);
    expect(result.buyerAmountPaise).toBe(670001n);
  });

  it('handles zero balance', () => {
    const result = computeAwardEscrowSplit(0n, 'SPLIT', 50);
    expect(result.sellerAmountPaise).toBe(0n);
    expect(result.buyerAmountPaise).toBe(0n);
  });
});

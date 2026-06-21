export interface AwardEscrowAction {
  action: 'RELEASE_TO_SELLER' | 'REFUND_TO_BUYER' | 'SPLIT';
  sellerAmountPaise: bigint;
  buyerAmountPaise: bigint;
}

export function computeAwardEscrowSplit(
  escrowBalancePaise: bigint,
  escrowAction: 'RELEASE_TO_SELLER' | 'REFUND_TO_BUYER' | 'SPLIT',
  splitSellerPercent?: number,
): AwardEscrowAction {
  if (escrowAction === 'RELEASE_TO_SELLER') {
    return {
      action: 'RELEASE_TO_SELLER',
      sellerAmountPaise: escrowBalancePaise,
      buyerAmountPaise: 0n,
    };
  }

  if (escrowAction === 'REFUND_TO_BUYER') {
    return {
      action: 'REFUND_TO_BUYER',
      sellerAmountPaise: 0n,
      buyerAmountPaise: escrowBalancePaise,
    };
  }

  // SPLIT: round seller down, buyer gets remainder
  const percent = splitSellerPercent ?? 50;
  const sellerAmountPaise = (escrowBalancePaise * BigInt(Math.floor(percent * 100))) / 10000n;
  const buyerAmountPaise = escrowBalancePaise - sellerAmountPaise;

  return {
    action: 'SPLIT',
    sellerAmountPaise,
    buyerAmountPaise,
  };
}

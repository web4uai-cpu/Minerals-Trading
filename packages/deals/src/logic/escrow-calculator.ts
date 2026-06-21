import { EscrowEntryType } from '@khanij/types';

export interface EscrowEntry {
  type: EscrowEntryType;
  amountPaise: bigint;
}

export function computeEscrowBalance(entries: EscrowEntry[]): bigint {
  let balance = 0n;
  for (const entry of entries) {
    if (entry.type === EscrowEntryType.HELD) balance += entry.amountPaise;
    else balance -= entry.amountPaise;
  }
  return balance;
}

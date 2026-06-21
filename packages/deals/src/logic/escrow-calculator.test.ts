import { computeEscrowBalance, EscrowEntry } from './escrow-calculator';
import { EscrowEntryType } from '@khanij/types';

describe('computeEscrowBalance', () => {
  it('returns 0n for empty entries', () => {
    expect(computeEscrowBalance([])).toBe(0n);
  });

  it('returns held amount for a single HELD entry', () => {
    const entries: EscrowEntry[] = [
      { type: EscrowEntryType.HELD, amountPaise: 500000n },
    ];
    expect(computeEscrowBalance(entries)).toBe(500000n);
  });

  it('subtracts RELEASED from HELD', () => {
    const entries: EscrowEntry[] = [
      { type: EscrowEntryType.HELD, amountPaise: 1000000n },
      { type: EscrowEntryType.RELEASED, amountPaise: 300000n },
    ];
    expect(computeEscrowBalance(entries)).toBe(700000n);
  });

  it('subtracts REFUNDED from HELD', () => {
    const entries: EscrowEntry[] = [
      { type: EscrowEntryType.HELD, amountPaise: 1000000n },
      { type: EscrowEntryType.REFUNDED, amountPaise: 1000000n },
    ];
    expect(computeEscrowBalance(entries)).toBe(0n);
  });

  it('handles multiple entries of all types', () => {
    const entries: EscrowEntry[] = [
      { type: EscrowEntryType.HELD, amountPaise: 5000000n },
      { type: EscrowEntryType.RELEASED, amountPaise: 1000000n },
      { type: EscrowEntryType.HELD, amountPaise: 2000000n },
      { type: EscrowEntryType.REFUNDED, amountPaise: 500000n },
      { type: EscrowEntryType.RELEASED, amountPaise: 1500000n },
    ];
    // 5000000 + 2000000 - 1000000 - 500000 - 1500000 = 4000000
    expect(computeEscrowBalance(entries)).toBe(4000000n);
  });

  it('handles large amounts without precision loss', () => {
    const largePaise = 99_99_99_999_99n; // ₹99,99,99,999.99 (near ₹100 crore)
    const entries: EscrowEntry[] = [
      { type: EscrowEntryType.HELD, amountPaise: largePaise },
    ];
    expect(computeEscrowBalance(entries)).toBe(largePaise);
  });

  it('can go negative if released/refunded exceeds held', () => {
    const entries: EscrowEntry[] = [
      { type: EscrowEntryType.HELD, amountPaise: 100n },
      { type: EscrowEntryType.RELEASED, amountPaise: 200n },
    ];
    expect(computeEscrowBalance(entries)).toBe(-100n);
  });
});

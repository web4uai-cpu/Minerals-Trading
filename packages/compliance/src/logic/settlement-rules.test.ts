import {
  validateSettlement,
  getForexLockExpiry,
  isForexLockExpired,
  SettlementCalculation,
  FOREX_LOCK_DURATION_MINUTES,
} from './settlement-rules';

describe('validateSettlement', () => {
  const baseCalc: SettlementCalculation = {
    amountSourcePaise: 5_000_000_00,
    forexRate: 0.012,
    sourceCurrency: 'INR',
    targetCurrency: 'USD',
  };

  it('should validate a correct INR/USD settlement', () => {
    const result = validateSettlement(baseCalc);
    expect(result.valid).toBe(true);
    expect(result.amountTargetPaise).toBe(Math.round(5_000_000_00 * 0.012));
  });

  it('should reject same source and target currency', () => {
    const result = validateSettlement({
      ...baseCalc,
      targetCurrency: 'INR',
    });
    expect(result.valid).toBe(false);
    expect(result.reasons[0]).toContain('different');
  });

  it('should reject unsupported currency pair', () => {
    const result = validateSettlement({
      ...baseCalc,
      sourceCurrency: 'AED',
      targetCurrency: 'JPY',
    });
    expect(result.valid).toBe(false);
    expect(result.reasons[0]).toContain('not supported');
  });

  it('should reject below minimum amount', () => {
    const result = validateSettlement({
      ...baseCalc,
      amountSourcePaise: 50,
    });
    expect(result.valid).toBe(false);
    expect(result.reasons[0]).toContain('Minimum');
  });

  it('should reject above maximum amount', () => {
    const result = validateSettlement({
      ...baseCalc,
      amountSourcePaise: 200_000_000_00,
    });
    expect(result.valid).toBe(false);
    expect(result.reasons[0]).toContain('Maximum');
  });

  it('should reject zero or negative forex rate', () => {
    const result = validateSettlement({
      ...baseCalc,
      forexRate: 0,
    });
    expect(result.valid).toBe(false);
    expect(result.reasons[0]).toContain('positive');
  });

  it('should calculate target amount correctly', () => {
    const result = validateSettlement({
      amountSourcePaise: 1_000_000_00,
      forexRate: 83.5,
      sourceCurrency: 'USD',
      targetCurrency: 'INR',
    });
    expect(result.valid).toBe(true);
    expect(result.amountTargetPaise).toBe(Math.round(1_000_000_00 * 83.5));
  });
});

describe('forex lock expiry', () => {
  it('should calculate expiry as locked + 15 minutes', () => {
    const locked = new Date('2026-06-21T10:00:00Z');
    const expiry = getForexLockExpiry(locked);
    expect(expiry.getTime() - locked.getTime()).toBe(FOREX_LOCK_DURATION_MINUTES * 60 * 1000);
  });

  it('should detect expired lock', () => {
    const locked = new Date('2026-06-21T10:00:00Z');
    const now = new Date('2026-06-21T10:20:00Z');
    expect(isForexLockExpired(locked, now)).toBe(true);
  });

  it('should detect valid lock', () => {
    const locked = new Date('2026-06-21T10:00:00Z');
    const now = new Date('2026-06-21T10:10:00Z');
    expect(isForexLockExpired(locked, now)).toBe(false);
  });
});

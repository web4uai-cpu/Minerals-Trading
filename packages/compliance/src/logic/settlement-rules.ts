/**
 * Cross-border settlement rules — forex validation, currency pair
 * checks, and settlement amount calculation.
 *
 * Real forex rates come from PriceFeedProvider (stub).
 * This module validates the structure and business rules.
 */

export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AED' | 'SGD' | 'AUD';

export interface SettlementCalculation {
  amountSourcePaise: number;
  forexRate: number;
  sourceCurrency: Currency;
  targetCurrency: Currency;
}

export interface SettlementValidationResult {
  valid: boolean;
  reasons: string[];
  amountTargetPaise: number | null;
}

const SUPPORTED_PAIRS = new Set([
  'INR/USD', 'USD/INR',
  'INR/EUR', 'EUR/INR',
  'INR/GBP', 'GBP/INR',
  'INR/JPY', 'JPY/INR',
  'INR/AED', 'AED/INR',
  'INR/SGD', 'SGD/INR',
  'INR/AUD', 'AUD/INR',
  'USD/EUR', 'EUR/USD',
  'USD/GBP', 'GBP/USD',
  'USD/JPY', 'JPY/USD',
]);

const MIN_SETTLEMENT_PAISE = 100_00;
const MAX_SETTLEMENT_PAISE = 100_000_000_00;
const FOREX_LOCK_DURATION_MINUTES = 15;

export function validateSettlement(
  calc: SettlementCalculation,
): SettlementValidationResult {
  const reasons: string[] = [];

  if (calc.sourceCurrency === calc.targetCurrency) {
    reasons.push('Source and target currency must be different for cross-border settlement');
  }

  const pair = `${calc.sourceCurrency}/${calc.targetCurrency}`;
  if (!SUPPORTED_PAIRS.has(pair)) {
    reasons.push(`Currency pair ${pair} is not supported`);
  }

  if (calc.amountSourcePaise < MIN_SETTLEMENT_PAISE) {
    reasons.push(`Minimum settlement amount is ${MIN_SETTLEMENT_PAISE} paise (₹100)`);
  }

  if (calc.amountSourcePaise > MAX_SETTLEMENT_PAISE) {
    reasons.push(`Maximum settlement amount is ${MAX_SETTLEMENT_PAISE} paise (₹100 crore)`);
  }

  if (calc.forexRate <= 0) {
    reasons.push('Forex rate must be positive');
  }

  if (reasons.length > 0) {
    return { valid: false, reasons, amountTargetPaise: null };
  }

  const amountTargetPaise = Math.round(calc.amountSourcePaise * calc.forexRate);

  return { valid: true, reasons: [], amountTargetPaise };
}

export function getForexLockExpiry(lockedAt: Date): Date {
  return new Date(lockedAt.getTime() + FOREX_LOCK_DURATION_MINUTES * 60 * 1000);
}

export function isForexLockExpired(lockedAt: Date, now: Date = new Date()): boolean {
  return now > getForexLockExpiry(lockedAt);
}

export { SUPPORTED_PAIRS, MIN_SETTLEMENT_PAISE, MAX_SETTLEMENT_PAISE, FOREX_LOCK_DURATION_MINUTES };

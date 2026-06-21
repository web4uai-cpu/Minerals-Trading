/**
 * Forex Provider interface — pluggable swap layer for currency exchange rates.
 * Real forex feeds need RBI/AD-II bank integration — out of scope for MVP.
 */
export interface ForexQuote {
  sourceCurrency: string;
  targetCurrency: string;
  rate: number;
  validUntilMinutes: number;
  source: string;
  asOf: Date;
}

export interface ForexProvider {
  getQuote(sourceCurrency: string, targetCurrency: string): Promise<ForexQuote>;
}

export const FOREX_PROVIDER = Symbol('FOREX_PROVIDER');

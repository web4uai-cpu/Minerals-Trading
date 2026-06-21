import { Injectable, Logger } from '@nestjs/common';
import { ForexProvider, ForexQuote } from './forex-provider.interface';

const SANDBOX_RATES: Record<string, number> = {
  'INR/USD': 0.01195,
  'USD/INR': 83.68,
  'INR/EUR': 0.01095,
  'EUR/INR': 91.32,
  'INR/GBP': 0.00945,
  'GBP/INR': 105.82,
  'INR/JPY': 1.867,
  'JPY/INR': 0.5356,
  'INR/AED': 0.04389,
  'AED/INR': 22.78,
  'INR/SGD': 0.01605,
  'SGD/INR': 62.31,
  'INR/AUD': 0.01835,
  'AUD/INR': 54.50,
  'USD/EUR': 0.9165,
  'EUR/USD': 1.0911,
  'USD/GBP': 0.7905,
  'GBP/USD': 1.265,
  'USD/JPY': 156.3,
  'JPY/USD': 0.006398,
};

@Injectable()
export class SandboxForexProvider implements ForexProvider {
  private readonly logger = new Logger(SandboxForexProvider.name);

  async getQuote(
    sourceCurrency: string,
    targetCurrency: string,
  ): Promise<ForexQuote> {
    const pair = `${sourceCurrency}/${targetCurrency}`;
    const rate = SANDBOX_RATES[pair];

    if (!rate) {
      this.logger.warn(`No sandbox rate for pair ${pair}, using 1.0`);
    }

    return {
      sourceCurrency,
      targetCurrency,
      rate: rate ?? 1.0,
      validUntilMinutes: 15,
      source: 'sandbox',
      asOf: new Date(),
    };
  }
}

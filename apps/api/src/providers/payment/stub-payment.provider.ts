import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PaymentProvider, PaymentResult } from './payment-provider.interface';

/**
 * Stub Payment Provider — NO REAL MONEY MOVES.
 *
 * Always returns success with a stub transaction reference.
 * Clearly labeled in code, logs, and API responses.
 *
 * WARNING: Do not use in production without swapping to a real provider.
 */
@Injectable()
export class StubPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(StubPaymentProvider.name);

  async holdFunds(dealId: string, amountPaise: number, description: string): Promise<PaymentResult> {
    const txnRef = `stub-hold-${randomUUID()}`;
    this.logger.warn(
      `[STUB] holdFunds: deal=${dealId} amount=₹${(amountPaise / 100).toFixed(2)} txn=${txnRef} — NO REAL MONEY HELD`,
    );
    return { txnRef, status: 'SUCCESS', message: `[STUB] ${description}` };
  }

  async releaseFunds(dealId: string, amountPaise: number, description: string): Promise<PaymentResult> {
    const txnRef = `stub-release-${randomUUID()}`;
    this.logger.warn(
      `[STUB] releaseFunds: deal=${dealId} amount=₹${(amountPaise / 100).toFixed(2)} txn=${txnRef} — NO REAL MONEY RELEASED`,
    );
    return { txnRef, status: 'SUCCESS', message: `[STUB] ${description}` };
  }

  async refundFunds(dealId: string, amountPaise: number, description: string): Promise<PaymentResult> {
    const txnRef = `stub-refund-${randomUUID()}`;
    this.logger.warn(
      `[STUB] refundFunds: deal=${dealId} amount=₹${(amountPaise / 100).toFixed(2)} txn=${txnRef} — NO REAL MONEY REFUNDED`,
    );
    return { txnRef, status: 'SUCCESS', message: `[STUB] ${description}` };
  }
}

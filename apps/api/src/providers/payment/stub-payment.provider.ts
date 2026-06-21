import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PaymentProvider, PaymentResult } from './payment-provider.interface';
import { Money } from '@khanij/types';

@Injectable()
export class StubPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(StubPaymentProvider.name);

  async holdFunds(dealId: string, amountPaise: bigint, description: string): Promise<PaymentResult> {
    const txnRef = `stub-hold-${randomUUID()}`;
    this.logger.warn(
      `[STUB] holdFunds: deal=${dealId} amount=${Money.fromPaise(amountPaise).format()} txn=${txnRef} — NO REAL MONEY HELD`,
    );
    return { txnRef, status: 'SUCCESS', message: `[STUB] ${description}` };
  }

  async releaseFunds(dealId: string, amountPaise: bigint, description: string): Promise<PaymentResult> {
    const txnRef = `stub-release-${randomUUID()}`;
    this.logger.warn(
      `[STUB] releaseFunds: deal=${dealId} amount=${Money.fromPaise(amountPaise).format()} txn=${txnRef} — NO REAL MONEY RELEASED`,
    );
    return { txnRef, status: 'SUCCESS', message: `[STUB] ${description}` };
  }

  async refundFunds(dealId: string, amountPaise: bigint, description: string): Promise<PaymentResult> {
    const txnRef = `stub-refund-${randomUUID()}`;
    this.logger.warn(
      `[STUB] refundFunds: deal=${dealId} amount=${Money.fromPaise(amountPaise).format()} txn=${txnRef} — NO REAL MONEY REFUNDED`,
    );
    return { txnRef, status: 'SUCCESS', message: `[STUB] ${description}` };
  }
}

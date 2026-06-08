/**
 * Payment Provider interface — the pluggable swap layer for payment operations.
 * Currently a STUB — no real money moves.
 */
export interface PaymentResult {
  txnRef: string;
  status: 'SUCCESS' | 'FAILED';
  message: string;
}

export interface PaymentProvider {
  holdFunds(dealId: string, amountPaise: number, description: string): Promise<PaymentResult>;
  releaseFunds(dealId: string, amountPaise: number, description: string): Promise<PaymentResult>;
  refundFunds(dealId: string, amountPaise: number, description: string): Promise<PaymentResult>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

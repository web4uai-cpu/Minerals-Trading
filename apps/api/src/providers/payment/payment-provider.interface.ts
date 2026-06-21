export interface PaymentResult {
  txnRef: string;
  status: 'SUCCESS' | 'FAILED';
  message: string;
}

export interface PaymentProvider {
  holdFunds(dealId: string, amountPaise: bigint, description: string): Promise<PaymentResult>;
  releaseFunds(dealId: string, amountPaise: bigint, description: string): Promise<PaymentResult>;
  refundFunds(dealId: string, amountPaise: bigint, description: string): Promise<PaymentResult>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

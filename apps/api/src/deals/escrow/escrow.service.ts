import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { PaymentProvider, PAYMENT_PROVIDER } from '../../providers/payment/payment-provider.interface';
import { EscrowEntryType } from '@prisma/client';

/**
 * Escrow Service — append-only ledger for deal escrow operations.
 * Balance = Σ HELD − Σ RELEASED − Σ REFUNDED
 */
@Injectable()
export class EscrowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(PAYMENT_PROVIDER)
    private readonly payment: PaymentProvider,
  ) {}

  /** Hold funds for a deal. */
  async holdFunds(dealId: string, amountPaise: number, userId: string): Promise<void> {
    if (amountPaise <= 0) {
      throw new BadRequestException({ code: 'INVALID_AMOUNT', message: 'Amount must be positive' });
    }

    const result = await this.payment.holdFunds(dealId, amountPaise, `Escrow hold for deal ${dealId}`);
    if (result.status !== 'SUCCESS') {
      throw new BadRequestException({ code: 'PAYMENT_FAILED', message: result.message });
    }

    await this.prisma.escrowLedger.create({
      data: {
        dealId,
        type: EscrowEntryType.HELD,
        amountPaise: BigInt(amountPaise),
        txnRef: result.txnRef,
        note: result.message,
      },
    });

    await this.audit.log({
      actor: userId,
      action: 'escrow.hold',
      entityType: 'Deal',
      entityId: dealId,
      after: { amountPaise, txnRef: result.txnRef },
    });
  }

  /** Release escrowed funds to the seller. */
  async releaseFunds(dealId: string, amountPaise: number, userId: string): Promise<void> {
    const balance = await this.getBalance(dealId);
    if (amountPaise > balance) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_ESCROW',
        message: `Cannot release ₹${(amountPaise / 100).toFixed(2)} — only ₹${(balance / 100).toFixed(2)} held`,
      });
    }

    const result = await this.payment.releaseFunds(dealId, amountPaise, `Escrow release for deal ${dealId}`);
    if (result.status !== 'SUCCESS') {
      throw new BadRequestException({ code: 'PAYMENT_FAILED', message: result.message });
    }

    await this.prisma.escrowLedger.create({
      data: {
        dealId,
        type: EscrowEntryType.RELEASED,
        amountPaise: BigInt(amountPaise),
        txnRef: result.txnRef,
        note: result.message,
      },
    });

    await this.audit.log({
      actor: userId,
      action: 'escrow.release',
      entityType: 'Deal',
      entityId: dealId,
      after: { amountPaise, txnRef: result.txnRef },
    });
  }

  /** Refund escrowed funds to the buyer. */
  async refundFunds(dealId: string, amountPaise: number, userId: string): Promise<void> {
    const balance = await this.getBalance(dealId);
    if (amountPaise > balance) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_ESCROW',
        message: `Cannot refund ₹${(amountPaise / 100).toFixed(2)} — only ₹${(balance / 100).toFixed(2)} held`,
      });
    }

    const result = await this.payment.refundFunds(dealId, amountPaise, `Escrow refund for deal ${dealId}`);
    if (result.status !== 'SUCCESS') {
      throw new BadRequestException({ code: 'PAYMENT_FAILED', message: result.message });
    }

    await this.prisma.escrowLedger.create({
      data: {
        dealId,
        type: EscrowEntryType.REFUNDED,
        amountPaise: BigInt(amountPaise),
        txnRef: result.txnRef,
        note: result.message,
      },
    });

    await this.audit.log({
      actor: userId,
      action: 'escrow.refund',
      entityType: 'Deal',
      entityId: dealId,
      after: { amountPaise, txnRef: result.txnRef },
    });
  }

  /** Get escrow balance for a deal: Σ HELD − Σ RELEASED − Σ REFUNDED. */
  async getBalance(dealId: string): Promise<number> {
    const entries = await this.prisma.escrowLedger.findMany({
      where: { dealId },
      select: { type: true, amountPaise: true },
    });

    let balance = 0;
    for (const entry of entries) {
      const amount = Number(entry.amountPaise);
      if (entry.type === EscrowEntryType.HELD) balance += amount;
      else balance -= amount; // RELEASED or REFUNDED
    }
    return balance;
  }

  /** Get full escrow ledger for a deal. */
  async getLedger(dealId: string) {
    const entries = await this.prisma.escrowLedger.findMany({
      where: { dealId },
      orderBy: { createdAt: 'asc' },
    });
    return entries.map((e) => ({
      ...e,
      amountPaise: Number(e.amountPaise),
    }));
  }

  /** Check if escrow is held (balance > 0). */
  async isEscrowHeld(dealId: string): Promise<boolean> {
    const balance = await this.getBalance(dealId);
    return balance > 0;
  }
}

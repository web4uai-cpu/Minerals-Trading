import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { PaymentProvider, PAYMENT_PROVIDER } from '../../providers/payment/payment-provider.interface';
import { EscrowEntryType } from '@prisma/client';
import { Money } from '@khanij/types';

@Injectable()
export class EscrowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(PAYMENT_PROVIDER)
    private readonly payment: PaymentProvider,
  ) {}

  async holdFunds(dealId: string, amountPaise: bigint, userId: string): Promise<void> {
    if (amountPaise <= 0n) {
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
        amountPaise,
        txnRef: result.txnRef,
        note: result.message,
      },
    });

    await this.audit.log({
      actor: userId,
      action: 'escrow.hold',
      entityType: 'Deal',
      entityId: dealId,
      after: { amountPaise: amountPaise.toString(), txnRef: result.txnRef },
    });
  }

  async releaseFunds(dealId: string, amountPaise: bigint, userId: string): Promise<void> {
    const balance = await this.getBalance(dealId);
    if (amountPaise > balance) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_ESCROW',
        message: `Cannot release ${Money.fromPaise(amountPaise).format()} — only ${Money.fromPaise(balance).format()} held`,
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
        amountPaise,
        txnRef: result.txnRef,
        note: result.message,
      },
    });

    await this.audit.log({
      actor: userId,
      action: 'escrow.release',
      entityType: 'Deal',
      entityId: dealId,
      after: { amountPaise: amountPaise.toString(), txnRef: result.txnRef },
    });
  }

  async refundFunds(dealId: string, amountPaise: bigint, userId: string): Promise<void> {
    const balance = await this.getBalance(dealId);
    if (amountPaise > balance) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_ESCROW',
        message: `Cannot refund ${Money.fromPaise(amountPaise).format()} — only ${Money.fromPaise(balance).format()} held`,
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
        amountPaise,
        txnRef: result.txnRef,
        note: result.message,
      },
    });

    await this.audit.log({
      actor: userId,
      action: 'escrow.refund',
      entityType: 'Deal',
      entityId: dealId,
      after: { amountPaise: amountPaise.toString(), txnRef: result.txnRef },
    });
  }

  async getBalance(dealId: string): Promise<bigint> {
    const entries = await this.prisma.escrowLedger.findMany({
      where: { dealId },
      select: { type: true, amountPaise: true },
    });

    let balance = 0n;
    for (const entry of entries) {
      if (entry.type === EscrowEntryType.HELD) balance += entry.amountPaise;
      else balance -= entry.amountPaise;
    }
    return balance;
  }

  async getLedger(dealId: string) {
    const entries = await this.prisma.escrowLedger.findMany({
      where: { dealId },
      orderBy: { createdAt: 'asc' },
    });
    return entries.map((e) => ({
      id: e.id,
      dealId: e.dealId,
      type: e.type,
      amountPaise: e.amountPaise.toString(),
      txnRef: e.txnRef,
      note: e.note,
      createdAt: e.createdAt,
    }));
  }

  async isEscrowHeld(dealId: string): Promise<boolean> {
    const balance = await this.getBalance(dealId);
    return balance > 0n;
  }
}

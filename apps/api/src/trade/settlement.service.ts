import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import { CreateCrossBorderSettlementInput } from '@khanij/types';
import {
  CrossBorderSettlementStatus,
  SettlementCurrency,
} from '@prisma/client';
import {
  validateSettlement,
  isForexLockExpired,
  getForexLockExpiry,
} from '@khanij/compliance';
import {
  FOREX_PROVIDER,
  ForexProvider,
} from '../providers/forex/forex-provider.interface';

@Injectable()
export class SettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly logger: LoggerService,
    @Inject(FOREX_PROVIDER) private readonly forex: ForexProvider,
  ) {}

  // ─── Create Settlement with Forex Quote ──────────────────────────────────

  async createSettlement(
    input: CreateCrossBorderSettlementInput,
    orgId: string,
    userId: string,
    ip?: string,
  ) {
    const tradeApp = await this.prisma.tradeApplication.findUnique({
      where: { id: input.tradeApplicationId },
      include: { deal: true },
    });
    if (!tradeApp) {
      throw new NotFoundException({
        code: 'TRADE_APPLICATION_NOT_FOUND',
        message: 'Trade application not found',
      });
    }

    const deal = tradeApp.deal;
    if (deal.buyerOrgId !== orgId && deal.sellerOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'NOT_DEAL_PARTICIPANT',
        message: 'Only deal participants can create settlements',
      });
    }

    if (tradeApp.clearanceStatus !== 'APPROVED') {
      throw new BadRequestException({
        code: 'CLEARANCE_NOT_APPROVED',
        message: 'Trade application must be APPROVED before settlement',
      });
    }

    const validation = validateSettlement({
      amountSourcePaise: input.amountSourcePaise,
      forexRate: input.forexRateSnapshot,
      sourceCurrency: input.sourceCurrency,
      targetCurrency: input.targetCurrency,
    });
    if (!validation.valid) {
      throw new BadRequestException({
        code: 'SETTLEMENT_VALIDATION_FAILED',
        message: `Settlement validation failed: ${validation.reasons.join('; ')}`,
      });
    }

    const settlement = await this.prisma.crossBorderSettlement.create({
      data: {
        tradeApplicationId: input.tradeApplicationId,
        dealId: input.dealId,
        sourceCurrency: input.sourceCurrency as SettlementCurrency,
        targetCurrency: input.targetCurrency as SettlementCurrency,
        amountSourcePaise: BigInt(input.amountSourcePaise),
        amountTargetPaise: validation.amountTargetPaise
          ? BigInt(validation.amountTargetPaise)
          : null,
        forexRateSnapshot: input.forexRateSnapshot,
        bankSwiftCode: input.bankSwiftCode,
        beneficiaryAccountRef: input.beneficiaryAccountRef,
        status: CrossBorderSettlementStatus.PENDING_FOREX,
      },
    });

    await this.audit.log({
      actor: userId,
      actorOrgId: orgId,
      action: 'settlement.created',
      entityType: 'CrossBorderSettlement',
      entityId: settlement.id,
      after: {
        sourceCurrency: input.sourceCurrency,
        targetCurrency: input.targetCurrency,
        amountSourcePaise: input.amountSourcePaise,
      },
      ip,
    });

    this.logger.log(
      `Settlement created id=${settlement.id} trade=${input.tradeApplicationId}`,
      'SettlementService',
    );
    return this.serialize(settlement);
  }

  // ─── Lock Forex Rate ─────────────────────────────────────────────────────

  async lockForex(
    settlementId: string,
    orgId: string,
    userId: string,
    ip?: string,
  ) {
    const settlement = await this.findAndAuthorize(settlementId, orgId);

    if (settlement.status !== CrossBorderSettlementStatus.PENDING_FOREX) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: `Cannot lock forex — status is ${settlement.status}, expected PENDING_FOREX`,
      });
    }

    const quote = await this.forex.getQuote(
      settlement.sourceCurrency,
      settlement.targetCurrency,
    );

    const amountTargetPaise = Math.round(
      Number(settlement.amountSourcePaise) * quote.rate,
    );
    const now = new Date();
    const expiresAt = getForexLockExpiry(now);

    const updated = await this.prisma.crossBorderSettlement.update({
      where: { id: settlementId },
      data: {
        status: CrossBorderSettlementStatus.FOREX_LOCKED,
        forexRateSnapshot: quote.rate,
        amountTargetPaise: BigInt(amountTargetPaise),
        forexLockedAt: now,
        forexExpiresAt: expiresAt,
      },
    });

    await this.audit.log({
      actor: userId,
      actorOrgId: orgId,
      action: 'settlement.forex_locked',
      entityType: 'CrossBorderSettlement',
      entityId: settlementId,
      before: { status: 'PENDING_FOREX' },
      after: {
        status: 'FOREX_LOCKED',
        forexRate: quote.rate,
        expiresAt: expiresAt.toISOString(),
      },
      ip,
    });

    this.logger.log(
      `Forex locked id=${settlementId} rate=${quote.rate} expires=${expiresAt.toISOString()}`,
      'SettlementService',
    );
    return this.serialize(updated);
  }

  // ─── Initiate Payment ────────────────────────────────────────────────────

  async initiatePayment(
    settlementId: string,
    orgId: string,
    userId: string,
    ip?: string,
  ) {
    const settlement = await this.findAndAuthorize(settlementId, orgId);

    if (settlement.status !== CrossBorderSettlementStatus.FOREX_LOCKED) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: `Cannot initiate payment — status is ${settlement.status}, expected FOREX_LOCKED`,
      });
    }

    if (
      settlement.forexLockedAt &&
      isForexLockExpired(settlement.forexLockedAt)
    ) {
      await this.prisma.crossBorderSettlement.update({
        where: { id: settlementId },
        data: { status: CrossBorderSettlementStatus.PENDING_FOREX },
      });
      throw new BadRequestException({
        code: 'FOREX_EXPIRED',
        message: 'Forex lock has expired — please lock a new rate',
      });
    }

    const paymentRef = `PAY-${Date.now()}-${settlementId.slice(0, 8).toUpperCase()}`;

    const updated = await this.prisma.crossBorderSettlement.update({
      where: { id: settlementId },
      data: {
        status: CrossBorderSettlementStatus.PAYMENT_INITIATED,
        paymentRef,
      },
    });

    await this.audit.log({
      actor: userId,
      actorOrgId: orgId,
      action: 'settlement.payment_initiated',
      entityType: 'CrossBorderSettlement',
      entityId: settlementId,
      before: { status: 'FOREX_LOCKED' },
      after: { status: 'PAYMENT_INITIATED', paymentRef },
      ip,
    });

    this.logger.log(
      `Payment initiated id=${settlementId} ref=${paymentRef}`,
      'SettlementService',
    );
    return this.serialize(updated);
  }

  // ─── Confirm Payment (Admin) ─────────────────────────────────────────────

  async confirmPayment(
    settlementId: string,
    userId: string,
    ip?: string,
  ) {
    const settlement = await this.prisma.crossBorderSettlement.findUnique({
      where: { id: settlementId },
    });
    if (!settlement) {
      throw new NotFoundException({
        code: 'SETTLEMENT_NOT_FOUND',
        message: 'Settlement not found',
      });
    }

    if (settlement.status !== CrossBorderSettlementStatus.PAYMENT_INITIATED) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: `Cannot confirm — status is ${settlement.status}, expected PAYMENT_INITIATED`,
      });
    }

    const updated = await this.prisma.crossBorderSettlement.update({
      where: { id: settlementId },
      data: {
        status: CrossBorderSettlementStatus.PAYMENT_CONFIRMED,
      },
    });

    await this.audit.log({
      actor: userId,
      action: 'settlement.payment_confirmed',
      entityType: 'CrossBorderSettlement',
      entityId: settlementId,
      before: { status: 'PAYMENT_INITIATED' },
      after: { status: 'PAYMENT_CONFIRMED' },
      ip,
    });

    this.logger.log(
      `Payment confirmed id=${settlementId}`,
      'SettlementService',
    );
    return this.serialize(updated);
  }

  // ─── Mark Settled (Admin) ────────────────────────────────────────────────

  async markSettled(
    settlementId: string,
    userId: string,
    ip?: string,
  ) {
    const settlement = await this.prisma.crossBorderSettlement.findUnique({
      where: { id: settlementId },
    });
    if (!settlement) {
      throw new NotFoundException({
        code: 'SETTLEMENT_NOT_FOUND',
        message: 'Settlement not found',
      });
    }

    if (settlement.status !== CrossBorderSettlementStatus.PAYMENT_CONFIRMED) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: `Cannot settle — status is ${settlement.status}, expected PAYMENT_CONFIRMED`,
      });
    }

    const updated = await this.prisma.crossBorderSettlement.update({
      where: { id: settlementId },
      data: {
        status: CrossBorderSettlementStatus.SETTLED,
        settledAt: new Date(),
      },
    });

    await this.audit.log({
      actor: userId,
      action: 'settlement.settled',
      entityType: 'CrossBorderSettlement',
      entityId: settlementId,
      before: { status: 'PAYMENT_CONFIRMED' },
      after: { status: 'SETTLED' },
      ip,
    });

    this.logger.log(`Settlement settled id=${settlementId}`, 'SettlementService');
    return this.serialize(updated);
  }

  // ─── Find by Trade Application ───────────────────────────────────────────

  async findByTradeApplication(tradeApplicationId: string, orgId: string) {
    const tradeApp = await this.prisma.tradeApplication.findUnique({
      where: { id: tradeApplicationId },
      include: { deal: true },
    });
    if (!tradeApp) {
      throw new NotFoundException({
        code: 'TRADE_APPLICATION_NOT_FOUND',
        message: 'Trade application not found',
      });
    }

    const deal = tradeApp.deal;
    if (deal.buyerOrgId !== orgId && deal.sellerOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'NOT_DEAL_PARTICIPANT',
        message: 'Only deal participants can view settlements',
      });
    }

    const settlements = await this.prisma.crossBorderSettlement.findMany({
      where: { tradeApplicationId },
      orderBy: { createdAt: 'desc' },
    });

    return settlements.map(this.serialize);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async findAndAuthorize(settlementId: string, orgId: string) {
    const settlement = await this.prisma.crossBorderSettlement.findUnique({
      where: { id: settlementId },
      include: { deal: true },
    });
    if (!settlement) {
      throw new NotFoundException({
        code: 'SETTLEMENT_NOT_FOUND',
        message: 'Settlement not found',
      });
    }

    const deal = settlement.deal;
    if (deal.buyerOrgId !== orgId && deal.sellerOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'NOT_DEAL_PARTICIPANT',
        message: 'Only deal participants can manage settlements',
      });
    }

    return settlement;
  }

  private serialize(record: Record<string, unknown>) {
    return JSON.parse(
      JSON.stringify(record, (_key, value) => {
        if (typeof value === 'bigint') return Number(value);
        if (value && typeof value === 'object' && 'toNumber' in value) {
          return (value as { toNumber: () => number }).toNumber();
        }
        return value;
      }),
    );
  }
}

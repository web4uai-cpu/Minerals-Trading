import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import { AiService } from '../ai/ai.service';
import { DealStatus, MilestoneType, MilestoneStatus, ContractDraftOutput } from '@khanij/types';
import { determineSettlement, type SettlementContext } from '@khanij/finance';
import { OrgStatus } from '@prisma/client';
import { assertDealTransition, type TransitionContext } from './deal-state-machine';
import { EscrowService } from './escrow/escrow.service';
import {
  PRICE_FEED_PROVIDER,
  type PriceFeedProvider,
} from '../providers/price-feed/price-feed-provider.interface';

@Injectable()
export class DealService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly logger: LoggerService,
    private readonly escrow: EscrowService,
    private readonly ai: AiService,
    @Inject(PRICE_FEED_PROVIDER)
    private readonly priceFeed: PriceFeedProvider,
  ) {}

  // ─── Find by ID ──────────────────────────────────────────────────────────

  async findById(dealId: string, orgId: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        milestones: { orderBy: { sequence: 'asc' } },
        escrow: { orderBy: { createdAt: 'asc' } },
        quote: true,
        buyerOrg: { select: { legalName: true } },
        sellerOrg: { select: { legalName: true } },
      },
    });

    if (!deal) {
      throw new NotFoundException({ code: 'DEAL_NOT_FOUND', message: 'Deal not found' });
    }

    if (deal.buyerOrgId !== orgId && deal.sellerOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'DEAL_ACCESS_DENIED',
        message: 'You do not have access to this deal',
      });
    }

    return this.serialize(deal);
  }

  // ─── Find by Org ─────────────────────────────────────────────────────────

  async findByOrg(orgId: string, role: 'buyer' | 'seller', status?: DealStatus) {
    const where: Record<string, unknown> = {};

    if (role === 'buyer') {
      where['buyerOrgId'] = orgId;
    } else {
      where['sellerOrgId'] = orgId;
    }

    if (status) {
      where['status'] = status;
    }

    const deals = await this.prisma.deal.findMany({
      where,
      include: {
        milestones: { orderBy: { sequence: 'asc' } },
        buyerOrg: { select: { legalName: true } },
        sellerOrg: { select: { legalName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return deals.map(this.serialize);
  }

  // ─── Transition Deal ─────────────────────────────────────────────────────

  async transitionDeal(
    dealId: string,
    toStatus: DealStatus,
    orgId: string,
    userId: string,
    ip?: string,
  ) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        milestones: true,
        buyerOrg: { select: { status: true } },
        sellerOrg: { select: { status: true } },
      },
    });

    if (!deal) {
      throw new NotFoundException({ code: 'DEAL_NOT_FOUND', message: 'Deal not found' });
    }

    // Access check: must be participant
    if (deal.buyerOrgId !== orgId && deal.sellerOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'DEAL_ACCESS_DENIED',
        message: 'You do not have access to this deal',
      });
    }

    // Build transition context
    const context: TransitionContext = {
      bothOrgsVerified:
        deal.buyerOrg.status === OrgStatus.VERIFIED &&
        deal.sellerOrg.status === OrgStatus.VERIFIED,
      escrowHeld: await this.escrow.isEscrowHeld(dealId),
    };

    // Validate and assert transition — throws BadRequestException if illegal
    assertDealTransition(deal.status as DealStatus, toStatus, context);

    // For COMPLETED: verify all milestones are DONE
    if (toStatus === DealStatus.COMPLETED) {
      const allDone = deal.milestones.every(
        (m) => m.status === MilestoneStatus.DONE,
      );
      if (!allDone) {
        throw new BadRequestException({
          code: 'MILESTONES_INCOMPLETE',
          message: 'All milestones must be DONE before completing the deal',
        });
      }
    }

    const fromStatus = deal.status;

    const updated = await this.prisma.deal.update({
      where: { id: dealId },
      data: { status: toStatus },
      include: {
        milestones: { orderBy: { sequence: 'asc' } },
        buyerOrg: { select: { legalName: true } },
        sellerOrg: { select: { legalName: true } },
      },
    });

    await this.audit.log({
      actor: userId,
      actorOrgId: orgId,
      action: 'deal.transitioned',
      entityType: 'Deal',
      entityId: dealId,
      before: { status: fromStatus },
      after: { status: toStatus },
      ip,
    });

    this.logger.log(
      `Deal transitioned id=${dealId} from=${fromStatus} to=${toStatus} by=${userId}`,
      'DealService',
    );

    // Auto-settle escrow on terminal states
    if (toStatus === DealStatus.COMPLETED || toStatus === DealStatus.CANCELLED) {
      await this.settleEscrow(dealId, userId, ip);
    }

    return this.serialize(updated);
  }

  // ─── Hold Escrow ─────────────────────────────────────────────────────────

  async holdEscrow(
    dealId: string,
    amountPaise: bigint,
    orgId: string,
    userId: string,
    ip?: string,
  ) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
    });

    if (!deal) {
      throw new NotFoundException({ code: 'DEAL_NOT_FOUND', message: 'Deal not found' });
    }

    // Only buyer can hold escrow
    if (deal.buyerOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'NOT_BUYER',
        message: 'Only the buyer can hold escrow funds',
      });
    }

    // Deal must be in ESCROW_PENDING
    if (deal.status !== DealStatus.ESCROW_PENDING) {
      throw new BadRequestException({
        code: 'DEAL_NOT_ESCROW_PENDING',
        message: `Cannot hold escrow for deal in ${deal.status} status — deal must be in ESCROW_PENDING`,
      });
    }

    // Delegate to EscrowService
    await this.escrow.holdFunds(dealId, amountPaise, userId);

    // Check if should auto-transition to IN_FULFILMENT
    const balance = await this.escrow.getBalance(dealId);
    if (balance >= deal.totalValuePaise) {
      const context: TransitionContext = {
        bothOrgsVerified: true, // already verified at SIGNED stage
        escrowHeld: true,
      };
      assertDealTransition(
        DealStatus.ESCROW_PENDING,
        DealStatus.IN_FULFILMENT,
        context,
      );

      await this.prisma.deal.update({
        where: { id: dealId },
        data: { status: DealStatus.IN_FULFILMENT },
      });

      await this.audit.log({
        actor: userId,
        actorOrgId: orgId,
        action: 'deal.transitioned',
        entityType: 'Deal',
        entityId: dealId,
        before: { status: DealStatus.ESCROW_PENDING },
        after: { status: DealStatus.IN_FULFILMENT },
        ip,
      });

      this.logger.log(
        `Deal auto-transitioned id=${dealId} ESCROW_PENDING → IN_FULFILMENT (escrow fully funded)`,
        'DealService',
      );
    }

    // Return updated deal
    return this.findById(dealId, orgId);
  }

  // ─── Complete Milestone ──────────────────────────────────────────────────

  async completeMilestone(
    dealId: string,
    milestoneType: MilestoneType,
    orgId: string,
    userId: string,
    ip?: string,
  ) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
    });

    if (!deal) {
      throw new NotFoundException({ code: 'DEAL_NOT_FOUND', message: 'Deal not found' });
    }

    // Verify deal participant
    if (deal.buyerOrgId !== orgId && deal.sellerOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'DEAL_ACCESS_DENIED',
        message: 'You do not have access to this deal',
      });
    }

    // Find milestone by dealId + type
    const milestone = await this.prisma.dealMilestone.findUnique({
      where: { dealId_type: { dealId, type: milestoneType } },
    });

    if (!milestone) {
      throw new NotFoundException({
        code: 'MILESTONE_NOT_FOUND',
        message: `Milestone ${milestoneType} not found for this deal`,
      });
    }

    if (milestone.status === MilestoneStatus.DONE) {
      throw new BadRequestException({
        code: 'MILESTONE_ALREADY_DONE',
        message: `Milestone ${milestoneType} is already completed`,
      });
    }

    const updated = await this.prisma.dealMilestone.update({
      where: { id: milestone.id },
      data: {
        status: MilestoneStatus.DONE,
        completedAt: new Date(),
      },
    });

    await this.audit.log({
      actor: userId,
      actorOrgId: orgId,
      action: 'deal.milestone.completed',
      entityType: 'DealMilestone',
      entityId: milestone.id,
      before: { status: milestone.status },
      after: { status: MilestoneStatus.DONE, type: milestoneType },
      ip,
    });

    this.logger.log(
      `Milestone completed deal=${dealId} type=${milestoneType} by=${userId}`,
      'DealService',
    );
    return this.serialize(updated);
  }

  // ─── Get Deal Ledger ─────────────────────────────────────────────────────

  async getDealLedger(dealId: string, orgId: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
    });

    if (!deal) {
      throw new NotFoundException({ code: 'DEAL_NOT_FOUND', message: 'Deal not found' });
    }

    if (deal.buyerOrgId !== orgId && deal.sellerOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'DEAL_ACCESS_DENIED',
        message: 'You do not have access to this deal',
      });
    }

    return this.escrow.getLedger(dealId);
  }

  // ─── Draft Contract ──────────────────────────────────────────────────────

  async draftContract(
    dealId: string,
    orgId: string,
    userId: string,
    ip?: string,
  ): Promise<ContractDraftOutput | null> {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        quote: true,
        buyerOrg: { select: { legalName: true } },
        sellerOrg: { select: { legalName: true } },
      },
    });

    if (!deal) {
      throw new NotFoundException({ code: 'DEAL_NOT_FOUND', message: 'Deal not found' });
    }

    // Access check: must be deal participant
    if (deal.buyerOrgId !== orgId && deal.sellerOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'DEAL_ACCESS_DENIED',
        message: 'You do not have access to this deal',
      });
    }

    // Resolve mineral name for the prompt
    const mineral = await this.prisma.mineral.findUnique({
      where: { id: deal.mineralId },
    });

    const mineralName = mineral?.name ?? 'Unknown Mineral';

    // Get reference price from PriceFeedProvider (best-effort)
    let fairPriceBand: { fairLow: number; fairHigh: number; refPrice: number } | null = null;
    try {
      const refPrice = await this.priceFeed.getReferencePrice(
        deal.mineralId,
        deal.grade as Record<string, number>,
        'India', // default state for price lookup
      );
      fairPriceBand = {
        fairLow: refPrice.fairLow,
        fairHigh: refPrice.fairHigh,
        refPrice: refPrice.refPrice,
      };
    } catch (error) {
      this.logger.warn(
        `Could not fetch reference price for deal=${dealId}: ${error instanceof Error ? error.message : String(error)}`,
        'DealService',
      );
      // Continue without fair price band — AI will note it was unavailable
    }

    // Call AI to draft the contract
    const draft = await this.ai.draftContract({
      deal: {
        id: deal.id,
        mineralName,
        grade: deal.grade as Record<string, number>,
        quantity: Number(deal.quantity),
        unit: deal.unit,
        totalValuePaise: deal.totalValuePaise.toString(),
        buyerName: deal.buyerOrg.legalName,
        sellerName: deal.sellerOrg.legalName,
      },
      fairPriceBand,
      standardClauses: [
        'Force Majeure as per Indian Contract Act, 1872',
        'Compliance with MMDR Act, 1957 and applicable mining regulations',
        'Quality disputes subject to re-sampling per IS 1405 / IS 436',
        'Payment through Khanij Nexus escrow system',
      ],
    });

    // Audit the drafting action
    await this.audit.log({
      actor: userId,
      actorOrgId: orgId,
      action: 'deal.contract.drafted',
      entityType: 'Deal',
      entityId: dealId,
      after: { aiDraftGenerated: draft !== null },
      ip,
    });

    this.logger.log(
      `Contract draft ${draft ? 'generated' : 'failed (AI returned null)'} for deal=${dealId} by=${userId}`,
      'DealService',
    );

    return draft;
  }

  // ─── Settle Escrow ───────────────────────────────────────────────────────

  async settleEscrow(dealId: string, userId: string, ip?: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { milestones: true },
    });

    if (!deal) {
      throw new NotFoundException({ code: 'DEAL_NOT_FOUND', message: 'Deal not found' });
    }

    const escrowBalance = await this.escrow.getBalance(dealId);

    const context: SettlementContext = {
      dealStatus: deal.status,
      allMilestonesDone: deal.milestones.every(
        (m) => m.status === MilestoneStatus.DONE,
      ),
      escrowBalancePaise: escrowBalance,
      totalValuePaise: deal.totalValuePaise,
      isDisputed: deal.status === DealStatus.DISPUTED,
    };

    const settlement = determineSettlement(context);

    if (settlement.action === 'RELEASE_TO_SELLER') {
      await this.escrow.releaseFunds(dealId, settlement.amountPaise, userId);
      this.logger.log(
        `Escrow released deal=${dealId} amount=${settlement.amountPaise} reason=${settlement.reason}`,
        'DealService',
      );
    } else if (settlement.action === 'REFUND_TO_BUYER') {
      await this.escrow.refundFunds(dealId, settlement.amountPaise, userId);
      this.logger.log(
        `Escrow refunded deal=${dealId} amount=${settlement.amountPaise} reason=${settlement.reason}`,
        'DealService',
      );
    } else {
      this.logger.log(
        `Escrow settlement: ${settlement.action} deal=${dealId} reason=${settlement.reason}`,
        'DealService',
      );
      return;
    }

    await this.audit.log({
      actor: userId,
      action: 'deal.escrow.settled',
      entityType: 'Deal',
      entityId: dealId,
      after: {
        settlementAction: settlement.action,
        reason: settlement.reason,
      },
      ip,
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** Serialize for JSON response (BigInt → string, Decimal → number). */
  private serialize(record: Record<string, unknown>) {
    return JSON.parse(
      JSON.stringify(record, (_key, value) => {
        if (typeof value === 'bigint') return value.toString();
        // Prisma Decimal comes as object with toNumber()
        if (value && typeof value === 'object' && 'toNumber' in value) {
          return (value as { toNumber: () => number }).toNumber();
        }
        return value;
      }),
    );
  }
}

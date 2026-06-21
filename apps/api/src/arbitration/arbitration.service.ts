import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import { EscrowService } from '../deals/escrow/escrow.service';
import {
  DealStatus,
  DisputeStatus,
  FileDisputeInput,
  SubmitEvidenceInput,
  IssueAwardInput,
} from '@khanij/types';
import {
  validateDisputeTransition,
  computeAwardEscrowSplit,
} from '@khanij/arbitration';
import { assertDealTransition } from '../deals/deal-state-machine';

@Injectable()
export class ArbitrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly logger: LoggerService,
    private readonly escrow: EscrowService,
  ) {}

  // ─── File Dispute ───────────────────────────────────────────────────────

  async fileDispute(
    input: FileDisputeInput,
    filedByOrgId: string,
    userId: string,
    ip?: string,
  ) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: input.dealId },
    });

    if (!deal) {
      throw new NotFoundException({ code: 'DEAL_NOT_FOUND', message: 'Deal not found' });
    }

    // Caller must be a deal participant
    if (deal.buyerOrgId !== filedByOrgId && deal.sellerOrgId !== filedByOrgId) {
      throw new ForbiddenException({
        code: 'NOT_DEAL_PARTICIPANT',
        message: 'Only deal participants can file a dispute',
      });
    }

    // Deal must be IN_FULFILMENT or COMPLETED
    if (deal.status !== DealStatus.IN_FULFILMENT && deal.status !== DealStatus.COMPLETED) {
      throw new BadRequestException({
        code: 'DEAL_NOT_DISPUTABLE',
        message: `Cannot file dispute for deal in ${deal.status} status — deal must be IN_FULFILMENT or COMPLETED`,
      });
    }

    // Transition deal to DISPUTED
    assertDealTransition(deal.status as DealStatus, DealStatus.DISPUTED);

    const [dispute] = await this.prisma.$transaction([
      this.prisma.dispute.create({
        data: {
          dealId: input.dealId,
          filedByOrgId,
          filedByUserId: userId,
          category: input.category,
          description: input.description,
          status: DisputeStatus.FILED,
        },
      }),
      this.prisma.deal.update({
        where: { id: input.dealId },
        data: { status: DealStatus.DISPUTED },
      }),
    ]);

    await this.audit.log({
      actor: userId,
      actorOrgId: filedByOrgId,
      action: 'dispute.filed',
      entityType: 'Dispute',
      entityId: dispute.id,
      after: {
        dealId: input.dealId,
        category: input.category,
        status: DisputeStatus.FILED,
      },
      ip,
    });

    this.logger.log(
      `Dispute filed id=${dispute.id} deal=${input.dealId} by=${userId}`,
      'ArbitrationService',
    );

    return dispute;
  }

  // ─── Submit Evidence ────────────────────────────────────────────────────

  async submitEvidence(
    input: SubmitEvidenceInput,
    orgId: string,
    userId: string,
    ip?: string,
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: input.disputeId },
      include: { deal: true },
    });

    if (!dispute) {
      throw new NotFoundException({ code: 'DISPUTE_NOT_FOUND', message: 'Dispute not found' });
    }

    // Cannot submit evidence to closed/withdrawn disputes
    if (dispute.status === DisputeStatus.CLOSED || dispute.status === DisputeStatus.WITHDRAWN) {
      throw new BadRequestException({
        code: 'DISPUTE_CLOSED',
        message: `Cannot submit evidence to dispute in ${dispute.status} status`,
      });
    }

    // Only deal participants can submit evidence
    if (dispute.deal.buyerOrgId !== orgId && dispute.deal.sellerOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'NOT_DEAL_PARTICIPANT',
        message: 'Only deal participants can submit evidence',
      });
    }

    const evidence = await this.prisma.evidence.create({
      data: {
        disputeId: input.disputeId,
        submittedByOrgId: orgId,
        submittedByUserId: userId,
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        documentRef: input.documentRef ?? null,
      },
    });

    await this.audit.log({
      actor: userId,
      actorOrgId: orgId,
      action: 'dispute.evidence.submitted',
      entityType: 'Evidence',
      entityId: evidence.id,
      after: {
        disputeId: input.disputeId,
        type: input.type,
        title: input.title,
      },
      ip,
    });

    this.logger.log(
      `Evidence submitted id=${evidence.id} dispute=${input.disputeId} by=${userId}`,
      'ArbitrationService',
    );

    return evidence;
  }

  // ─── Transition Dispute ─────────────────────────────────────────────────

  async transitionDispute(
    disputeId: string,
    toStatus: DisputeStatus,
    orgId: string,
    userId: string,
    ip?: string,
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        deal: true,
        evidence: { select: { id: true }, take: 1 },
      },
    });

    if (!dispute) {
      throw new NotFoundException({ code: 'DISPUTE_NOT_FOUND', message: 'Dispute not found' });
    }

    // WITHDRAWN: only the filing party can withdraw
    if (toStatus === DisputeStatus.WITHDRAWN && dispute.filedByOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'NOT_FILING_PARTY',
        message: 'Only the party that filed the dispute can withdraw it',
      });
    }

    const result = validateDisputeTransition(
      dispute.status as DisputeStatus,
      toStatus,
      { hasEvidence: dispute.evidence.length > 0 },
    );

    if (!result.valid) {
      throw new BadRequestException({ code: result.code, message: result.message });
    }

    const fromStatus = dispute.status;

    const updated = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: toStatus,
        closedAt: toStatus === DisputeStatus.CLOSED || toStatus === DisputeStatus.WITHDRAWN
          ? new Date()
          : undefined,
      },
    });

    await this.audit.log({
      actor: userId,
      actorOrgId: orgId,
      action: 'dispute.transitioned',
      entityType: 'Dispute',
      entityId: disputeId,
      before: { status: fromStatus },
      after: { status: toStatus },
      ip,
    });

    this.logger.log(
      `Dispute transitioned id=${disputeId} from=${fromStatus} to=${toStatus} by=${userId}`,
      'ArbitrationService',
    );

    return updated;
  }

  // ─── Issue Award ────────────────────────────────────────────────────────

  async issueAward(
    input: IssueAwardInput,
    arbitratorId: string,
    userId: string,
    ip?: string,
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: input.disputeId },
      include: {
        deal: true,
        evidence: { select: { id: true }, take: 1 },
      },
    });

    if (!dispute) {
      throw new NotFoundException({ code: 'DISPUTE_NOT_FOUND', message: 'Dispute not found' });
    }

    // Dispute must be in HEARING
    if (dispute.status !== DisputeStatus.HEARING) {
      throw new BadRequestException({
        code: 'DISPUTE_NOT_IN_HEARING',
        message: `Cannot issue award for dispute in ${dispute.status} status — must be HEARING`,
      });
    }

    // Validate transition with evidence check
    const transitionResult = validateDisputeTransition(
      DisputeStatus.HEARING,
      DisputeStatus.AWARD_ISSUED,
      { hasEvidence: dispute.evidence.length > 0 },
    );

    if (!transitionResult.valid) {
      throw new BadRequestException({
        code: transitionResult.code,
        message: transitionResult.message,
      });
    }

    // Compute escrow split
    const escrowBalance = await this.escrow.getBalance(dispute.dealId);
    const escrowSplit = computeAwardEscrowSplit(
      escrowBalance,
      input.escrowAction,
      input.splitSellerPercent,
    );

    const decision = {
      ruling: input.ruling,
      rationale: input.rationale,
      escrowAction: input.escrowAction,
      splitSellerPercent: input.splitSellerPercent,
      sellerAmountPaise: escrowSplit.sellerAmountPaise.toString(),
      buyerAmountPaise: escrowSplit.buyerAmountPaise.toString(),
    };

    // Create award and transition dispute in a transaction
    const [award] = await this.prisma.$transaction([
      this.prisma.award.create({
        data: {
          disputeId: input.disputeId,
          arbitratorId,
          decision,
          isAiDrafted: input.isAiDrafted ?? false,
        },
      }),
      this.prisma.dispute.update({
        where: { id: input.disputeId },
        data: { status: DisputeStatus.AWARD_ISSUED },
      }),
    ]);

    // Execute escrow actions
    if (escrowSplit.sellerAmountPaise > 0n) {
      await this.escrow.releaseFunds(dispute.dealId, escrowSplit.sellerAmountPaise, userId);
    }
    if (escrowSplit.buyerAmountPaise > 0n) {
      await this.escrow.refundFunds(dispute.dealId, escrowSplit.buyerAmountPaise, userId);
    }

    // Transition deal based on award outcome
    const dealToStatus = input.escrowAction === 'REFUND_TO_BUYER'
      ? DealStatus.CANCELLED
      : DealStatus.COMPLETED;

    await this.prisma.deal.update({
      where: { id: dispute.dealId },
      data: { status: dealToStatus },
    });

    await this.audit.log({
      actor: userId,
      actorOrgId: arbitratorId,
      action: 'dispute.award.issued',
      entityType: 'Award',
      entityId: award.id,
      after: {
        disputeId: input.disputeId,
        dealId: dispute.dealId,
        escrowAction: input.escrowAction,
        dealTransition: dealToStatus,
      },
      ip,
    });

    this.logger.log(
      `Award issued id=${award.id} dispute=${input.disputeId} deal=${dispute.dealId} escrow=${input.escrowAction} by=${userId}`,
      'ArbitrationService',
    );

    return award;
  }

  // ─── Find by Deal ───────────────────────────────────────────────────────

  async findByDeal(dealId: string, orgId: string) {
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

    const disputes = await this.prisma.dispute.findMany({
      where: { dealId },
      include: { evidence: true, award: true },
      orderBy: { createdAt: 'desc' },
    });

    return disputes;
  }

  // ─── Find by ID ─────────────────────────────────────────────────────────

  async findById(disputeId: string, orgId: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        deal: true,
        evidence: { orderBy: { createdAt: 'asc' } },
        award: true,
      },
    });

    if (!dispute) {
      throw new NotFoundException({ code: 'DISPUTE_NOT_FOUND', message: 'Dispute not found' });
    }

    if (dispute.deal.buyerOrgId !== orgId && dispute.deal.sellerOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'DISPUTE_ACCESS_DENIED',
        message: 'You do not have access to this dispute',
      });
    }

    return dispute;
  }
}

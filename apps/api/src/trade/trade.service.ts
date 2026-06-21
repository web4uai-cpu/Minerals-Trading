import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import { CreateTradeApplicationInput } from '@khanij/types';
import { ExportClearanceStatus, TradeDirection } from '@prisma/client';
import {
  checkTradeEligibility,
  TradeEligibilityContext,
} from '@khanij/compliance';
import { randomUUID } from 'crypto';

@Injectable()
export class TradeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly logger: LoggerService,
  ) {}

  // ─── Create Application ───────────────────────────────────────────────────

  async createApplication(
    input: CreateTradeApplicationInput,
    orgId: string,
    userId: string,
    ip?: string,
  ) {
    // Validate deal exists and caller is a participant
    const deal = await this.prisma.deal.findUnique({
      where: { id: input.dealId },
    });
    if (!deal) {
      throw new NotFoundException({
        code: 'DEAL_NOT_FOUND',
        message: 'Deal not found',
      });
    }
    if (deal.buyerOrgId !== orgId && deal.sellerOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'NOT_DEAL_PARTICIPANT',
        message: 'Only deal participants can create trade applications',
      });
    }

    // Look up org for eligibility check
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) {
      throw new NotFoundException({
        code: 'ORG_NOT_FOUND',
        message: 'Organization not found',
      });
    }

    // Check IEC compliance item
    const iecItem = await this.prisma.complianceItem.findUnique({
      where: { orgId_type: { orgId, type: 'IEC' } },
    });

    const eligibilityContext: TradeEligibilityContext = {
      orgType: org.type,
      hasIec: !!iecItem,
      iecVerified: iecItem?.status === 'VERIFIED',
      orgVerified: org.status === 'VERIFIED',
      direction: input.direction,
      mineralName: input.mineralName,
      destinationCountry: input.destinationCountry,
    };

    const eligibility = checkTradeEligibility(eligibilityContext);
    if (!eligibility.eligible) {
      throw new BadRequestException({
        code: 'TRADE_NOT_ELIGIBLE',
        message: `Trade eligibility check failed: ${eligibility.reasons.join('; ')}`,
      });
    }

    const application = await this.prisma.tradeApplication.create({
      data: {
        dealId: input.dealId,
        applicantOrgId: orgId,
        direction: input.direction as TradeDirection,
        destinationCountry: input.destinationCountry,
        portOfLoading: input.portOfLoading,
        portOfDischarge: input.portOfDischarge,
        mineralName: input.mineralName,
        hsnCode: input.hsnCode,
        quantityMt: input.quantityMt,
        valueFobPaise: BigInt(input.valueFobPaise),
        iecNumber: input.iecNumber ?? null,
        clearanceStatus: ExportClearanceStatus.PENDING,
      },
    });

    await this.audit.log({
      actor: userId,
      actorOrgId: orgId,
      action: 'trade.application.created',
      entityType: 'TradeApplication',
      entityId: application.id,
      after: {
        direction: input.direction,
        dealId: input.dealId,
        destinationCountry: input.destinationCountry,
      },
      ip,
    });

    this.logger.log(
      `Trade application created id=${application.id} deal=${input.dealId} direction=${input.direction}`,
      'TradeService',
    );
    return this.serialize(application);
  }

  // ─── Apply for Clearance ──────────────────────────────────────────────────

  async applyForClearance(
    applicationId: string,
    orgId: string,
    userId: string,
    ip?: string,
  ) {
    const application = await this.prisma.tradeApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) {
      throw new NotFoundException({
        code: 'APPLICATION_NOT_FOUND',
        message: 'Trade application not found',
      });
    }
    if (application.applicantOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'NOT_APPLICANT',
        message: 'Only the applicant organization can apply for clearance',
      });
    }
    if (application.clearanceStatus !== ExportClearanceStatus.PENDING) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: `Cannot apply for clearance — current status is ${application.clearanceStatus}, expected PENDING`,
      });
    }

    const dgftRefNumber = `DGFT-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;

    const updated = await this.prisma.tradeApplication.update({
      where: { id: applicationId },
      data: {
        clearanceStatus: ExportClearanceStatus.APPLIED,
        appliedAt: new Date(),
        dgftRefNumber,
      },
    });

    await this.audit.log({
      actor: userId,
      actorOrgId: orgId,
      action: 'trade.clearance.applied',
      entityType: 'TradeApplication',
      entityId: applicationId,
      before: { clearanceStatus: 'PENDING' },
      after: { clearanceStatus: 'APPLIED', dgftRefNumber },
      ip,
    });

    this.logger.log(
      `Trade clearance applied id=${applicationId} dgftRef=${dgftRefNumber}`,
      'TradeService',
    );
    return this.serialize(updated);
  }

  // ─── Approve Clearance ────────────────────────────────────────────────────

  async approveClearance(
    applicationId: string,
    userId: string,
    ip?: string,
  ) {
    const application = await this.prisma.tradeApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) {
      throw new NotFoundException({
        code: 'APPLICATION_NOT_FOUND',
        message: 'Trade application not found',
      });
    }
    if (application.clearanceStatus !== ExportClearanceStatus.APPLIED) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: `Cannot approve — current status is ${application.clearanceStatus}, expected APPLIED`,
      });
    }

    const validUntil = new Date();
    validUntil.setMonth(validUntil.getMonth() + 6);

    const updated = await this.prisma.tradeApplication.update({
      where: { id: applicationId },
      data: {
        clearanceStatus: ExportClearanceStatus.APPROVED,
        approvedAt: new Date(),
        validUntil,
      },
    });

    await this.audit.log({
      actor: userId,
      action: 'trade.clearance.approved',
      entityType: 'TradeApplication',
      entityId: applicationId,
      before: { clearanceStatus: 'APPLIED' },
      after: { clearanceStatus: 'APPROVED', validUntil: validUntil.toISOString() },
      ip,
    });

    this.logger.log(
      `Trade clearance approved id=${applicationId}`,
      'TradeService',
    );
    return this.serialize(updated);
  }

  // ─── Reject Clearance ─────────────────────────────────────────────────────

  async rejectClearance(
    applicationId: string,
    reason: string,
    userId: string,
    ip?: string,
  ) {
    const application = await this.prisma.tradeApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) {
      throw new NotFoundException({
        code: 'APPLICATION_NOT_FOUND',
        message: 'Trade application not found',
      });
    }
    if (application.clearanceStatus !== ExportClearanceStatus.APPLIED) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: `Cannot reject — current status is ${application.clearanceStatus}, expected APPLIED`,
      });
    }

    const updated = await this.prisma.tradeApplication.update({
      where: { id: applicationId },
      data: {
        clearanceStatus: ExportClearanceStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });

    await this.audit.log({
      actor: userId,
      action: 'trade.clearance.rejected',
      entityType: 'TradeApplication',
      entityId: applicationId,
      before: { clearanceStatus: 'APPLIED' },
      after: { clearanceStatus: 'REJECTED', rejectionReason: reason },
      ip,
    });

    this.logger.log(
      `Trade clearance rejected id=${applicationId} reason="${reason}"`,
      'TradeService',
    );
    return this.serialize(updated);
  }

  // ─── Find by Deal ─────────────────────────────────────────────────────────

  async findByDeal(dealId: string, orgId: string) {
    // Verify caller is a deal participant
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
    });
    if (!deal) {
      throw new NotFoundException({
        code: 'DEAL_NOT_FOUND',
        message: 'Deal not found',
      });
    }
    if (deal.buyerOrgId !== orgId && deal.sellerOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'NOT_DEAL_PARTICIPANT',
        message: 'Only deal participants can view trade applications',
      });
    }

    const applications = await this.prisma.tradeApplication.findMany({
      where: { dealId },
      orderBy: { createdAt: 'desc' },
    });

    return applications.map(this.serialize);
  }

  // ─── Find by ID ───────────────────────────────────────────────────────────

  async findById(applicationId: string, orgId: string) {
    const application = await this.prisma.tradeApplication.findUnique({
      where: { id: applicationId },
      include: { deal: true },
    });
    if (!application) {
      throw new NotFoundException({
        code: 'APPLICATION_NOT_FOUND',
        message: 'Trade application not found',
      });
    }

    // Access: must be deal participant or the applicant
    const deal = application.deal;
    if (
      deal.buyerOrgId !== orgId &&
      deal.sellerOrgId !== orgId &&
      application.applicantOrgId !== orgId
    ) {
      throw new ForbiddenException({
        code: 'ACCESS_DENIED',
        message: 'You do not have access to this trade application',
      });
    }

    return this.serialize(application);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

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

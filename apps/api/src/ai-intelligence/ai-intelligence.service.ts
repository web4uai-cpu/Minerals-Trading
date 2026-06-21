import {
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { AiService } from '../ai/ai.service';
import {
  PRICE_FEED_PROVIDER,
  type PriceFeedProvider,
} from '../providers/price-feed/price-feed-provider.interface';
import type { PriceAdvisorContext, FraudSignalContext, ComplianceReviewContext } from '@khanij/ai';
import type { PriceAdvisorOutput, FraudSignalOutput, ComplianceReviewOutput } from '@khanij/types';
import { ComplianceItemType } from '@khanij/types';

// ─── Request Schemas ────────────────────────────────────────────────────────

export const PriceAdvisorRequestSchema = z.object({
  mineralId: z.string().uuid(),
  grade: z.record(z.string(), z.number()),
  quantity: z.number().positive(),
  unit: z.enum(['MT', 'KG']),
  proposedPricePaise: z.number().int().positive(),
});
export type PriceAdvisorRequest = z.infer<typeof PriceAdvisorRequestSchema>;

export const FraudCheckRequestSchema = z.object({
  orgId: z.string().cuid(),
});
export type FraudCheckRequest = z.infer<typeof FraudCheckRequestSchema>;

export const ComplianceReviewRequestSchema = z.object({
  complianceItemId: z.string().cuid(),
});
export type ComplianceReviewRequest = z.infer<typeof ComplianceReviewRequestSchema>;

// ─── Expected fields per compliance document type ───────────────────────────

const EXPECTED_FIELDS: Record<string, string[]> = {
  [ComplianceItemType.MINING_LEASE]: ['leaseId', 'mineral', 'validFrom', 'validUntil', 'holder', 'state', 'district'],
  [ComplianceItemType.ENV_CLEARANCE]: ['clearanceNumber', 'issuedBy', 'validFrom', 'validUntil', 'holder'],
  [ComplianceItemType.FOREST_CLEARANCE]: ['clearanceNumber', 'issuedBy', 'validFrom', 'validUntil', 'holder'],
  [ComplianceItemType.IBM_RETURNS]: ['returnPeriod', 'mineral', 'quantity', 'holder'],
  [ComplianceItemType.ROYALTY_CLEARANCE]: ['receiptNumber', 'mineral', 'amount', 'period', 'holder'],
  [ComplianceItemType.SPCB_NOC]: ['nocNumber', 'issuedBy', 'validFrom', 'validUntil', 'holder'],
  [ComplianceItemType.GST_REG]: ['gstin', 'legalName', 'state', 'status'],
  [ComplianceItemType.PAN]: ['panNumber', 'name', 'type'],
  [ComplianceItemType.BANK_VERIFICATION]: ['accountNumber', 'ifsc', 'bankName', 'accountHolder'],
  [ComplianceItemType.IEC]: ['iecCode', 'holder', 'validFrom'],
  [ComplianceItemType.END_USE_DECLARATION]: ['declarant', 'mineral', 'endUse', 'date'],
  [ComplianceItemType.INDUSTRY_REGISTRATION]: ['registrationNumber', 'industry', 'holder', 'validFrom', 'validUntil'],
};

// ─── PII stripping ────────────────────────────────────────────────────────

/** Strip Aadhaar, PAN, bank account numbers from text before sending to AI. */
function stripPii(text: string): string {
  return text
    // Aadhaar: 12 digits, possibly separated by spaces/dashes
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[AADHAAR_REDACTED]')
    // PAN: ABCDE1234F
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, '[PAN_REDACTED]')
    // Bank account numbers: 9-18 digits
    .replace(/\b\d{9,18}\b/g, '[ACCOUNT_REDACTED]');
}

@Injectable()
export class AiIntelligenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ai: AiService,
    @Inject(PRICE_FEED_PROVIDER)
    private readonly priceFeed: PriceFeedProvider,
  ) {}

  // ─── Price Advisor ────────────────────────────────────────────────────────

  async advisePricing(
    dto: PriceAdvisorRequest,
    _actorId: string,
    _actorOrgId: string,
    _ip?: string,
  ): Promise<PriceAdvisorOutput | null> {
    const mineral = await this.prisma.mineral.findUnique({
      where: { id: dto.mineralId },
    });

    if (!mineral) {
      throw new NotFoundException({ code: 'MINERAL_NOT_FOUND', message: 'Mineral not found' });
    }

    // Look up fair price band
    const priceBand = await this.priceFeed.getReferencePrice(
      dto.mineralId,
      dto.grade,
      'ALL', // state-agnostic for advisory
    );

    // Look up recent completed deals for this mineral (last 5)
    const recentDeals = await this.prisma.deal.findMany({
      where: {
        mineralId: dto.mineralId,
        status: 'COMPLETED',
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        totalValuePaise: true,
        quantity: true,
        unit: true,
        updatedAt: true,
      },
    });

    const context: PriceAdvisorContext = {
      mineralName: mineral.name,
      grade: dto.grade,
      quantity: dto.quantity,
      unit: dto.unit,
      proposedPricePaise: dto.proposedPricePaise,
      fairPriceBand: {
        fairLow: priceBand.fairLow,
        fairHigh: priceBand.fairHigh,
        refPrice: priceBand.refPrice,
        source: priceBand.source,
        asOf: priceBand.asOf.toISOString(),
      },
      recentDeals: recentDeals.map((d) => ({
        pricePaise: Math.round(Number(d.totalValuePaise) / Number(d.quantity)),
        quantity: Number(d.quantity),
        date: d.updatedAt.toISOString(),
      })),
    };

    return this.ai.advisePricing(context);
  }

  // ─── Fraud Check ──────────────────────────────────────────────────────────

  async detectFraudSignals(
    dto: FraudCheckRequest,
    actorId: string,
    ip?: string,
  ): Promise<FraudSignalOutput | null> {
    const org = await this.prisma.organization.findUnique({
      where: { id: dto.orgId },
    });

    if (!org) {
      throw new NotFoundException({ code: 'ORG_NOT_FOUND', message: 'Organization not found' });
    }

    // Gather activity data
    const [dealCount, totalValueResult, disputeCount, cancelledCount] = await Promise.all([
      this.prisma.deal.count({ where: { OR: [{ buyerOrgId: dto.orgId }, { sellerOrgId: dto.orgId }] } }),
      this.prisma.deal.aggregate({
        where: { OR: [{ buyerOrgId: dto.orgId }, { sellerOrgId: dto.orgId }] },
        _sum: { totalValuePaise: true },
      }),
      this.prisma.dispute.count({
        where: {
          deal: { OR: [{ buyerOrgId: dto.orgId }, { sellerOrgId: dto.orgId }] },
        },
      }),
      this.prisma.deal.count({
        where: {
          OR: [{ buyerOrgId: dto.orgId }, { sellerOrgId: dto.orgId }],
          status: 'CANCELLED',
        },
      }),
    ]);

    const totalValue = totalValueResult._sum.totalValuePaise ?? BigInt(0);
    const avgValue = dealCount > 0 ? Number(totalValue) / dealCount : 0;
    const orgAgeDays = Math.floor(
      (Date.now() - org.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    const cancelRate = dealCount > 0 ? cancelledCount / dealCount : 0;

    // Compute pattern flags
    const patterns = {
      velocitySpike: dealCount > 10 && orgAgeDays < 30,
      unusualPricing: false, // would need price analysis — simplified for now
      highCancelRate: cancelRate > 0.3,
      newOrgHighValue: orgAgeDays < 30 && Number(totalValue) > 1000000000, // >10L paise = 1cr INR
    };

    const context: FraudSignalContext = {
      orgId: dto.orgId,
      orgType: org.type,
      orgAge: orgAgeDays,
      recentActivity: {
        dealsCount: dealCount,
        totalValuePaise: totalValue.toString(),
        avgDealValuePaise: Math.round(avgValue).toString(),
        disputeCount,
        cancelledDeals: cancelledCount,
      },
      patterns,
    };

    const result = await this.ai.detectFraudSignals(context);

    // Audit the fraud check
    await this.audit.log({
      actor: actorId,
      action: 'ai.fraud.check',
      entityType: 'Organization',
      entityId: dto.orgId,
      after: { riskLevel: result?.riskLevel ?? 'AI_UNAVAILABLE', patterns },
      ip,
    });

    return result;
  }

  // ─── Compliance Review ────────────────────────────────────────────────────

  async reviewComplianceDocument(
    dto: ComplianceReviewRequest,
    actorId: string,
    ip?: string,
  ): Promise<ComplianceReviewOutput | null> {
    const item = await this.prisma.complianceItem.findUnique({
      where: { id: dto.complianceItemId },
      include: {
        org: { select: { legalName: true, state: true } },
      },
    });

    if (!item) {
      throw new NotFoundException({
        code: 'COMPLIANCE_ITEM_NOT_FOUND',
        message: 'Compliance item not found',
      });
    }

    // In production, fetch document from S3 and run OCR.
    // Stub: use placeholder text representing extracted content.
    const extractedText = `[Extracted document content for ${item.type} - document ref: ${item.documentRef ?? 'none'}]`;

    // Strip PII from extracted text before sending to AI
    const sanitizedText = stripPii(extractedText);

    const expectedFields = EXPECTED_FIELDS[item.type] ?? ['holder', 'validFrom', 'validUntil'];

    const context: ComplianceReviewContext = {
      documentType: item.type,
      extractedText: sanitizedText,
      expectedFields,
      orgLegalName: item.org.legalName,
      state: item.org.state,
    };

    const result = await this.ai.reviewComplianceDocument(context);

    // Audit the compliance review
    await this.audit.log({
      actor: actorId,
      action: 'ai.compliance.review',
      entityType: 'ComplianceItem',
      entityId: dto.complianceItemId,
      after: { recommendation: result?.recommendation ?? 'AI_UNAVAILABLE' },
      ip,
    });

    return result;
  }
}

// Export stripPii for testing
export { stripPii };

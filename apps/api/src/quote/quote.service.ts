import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import { CreateQuoteInput } from '@khanij/types';
import {
  QuoteStatus,
  RfqStatus,
  DealStatus,
  OrgStatus,
  ListingStatus,
  MilestoneType,
  MilestoneStatus,
} from '@prisma/client';

@Injectable()
export class QuoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly logger: LoggerService,
  ) {}

  // ─── Submit Quote ─────────────────────────────────────────────────────────

  async submitQuote(
    input: CreateQuoteInput,
    sellerOrgId: string,
    userId: string,
    ip?: string,
  ) {
    // Validate RFQ exists and is OPEN
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: input.rfqId },
      include: { mineral: true },
    });

    if (!rfq) {
      throw new NotFoundException({
        code: 'RFQ_NOT_FOUND',
        message: 'RFQ not found',
      });
    }

    if (rfq.status !== RfqStatus.OPEN && rfq.status !== RfqStatus.QUOTED) {
      throw new BadRequestException({
        code: 'RFQ_NOT_OPEN',
        message: `Cannot submit quote for RFQ in ${rfq.status} status — only OPEN or QUOTED RFQs accept quotes`,
      });
    }

    // Validate seller org is VERIFIED
    const sellerOrg = await this.prisma.organization.findUnique({
      where: { id: sellerOrgId },
    });

    if (!sellerOrg || sellerOrg.status !== OrgStatus.VERIFIED) {
      throw new ForbiddenException({
        code: 'ORG_NOT_VERIFIED',
        message: 'Seller organization must be VERIFIED to submit quotes',
      });
    }

    // Validate seller has an ACTIVE listing for the RFQ's mineral
    const activeListing = await this.prisma.listing.findFirst({
      where: {
        sellerOrgId,
        mineralId: rfq.mineralId,
        status: ListingStatus.ACTIVE,
      },
    });

    if (!activeListing) {
      throw new BadRequestException({
        code: 'NO_ACTIVE_LISTING',
        message: 'Seller must have an ACTIVE listing for this mineral to submit a quote',
      });
    }

    // Prevent duplicate quotes from same seller to same RFQ
    const existingQuote = await this.prisma.quote.findFirst({
      where: {
        rfqId: input.rfqId,
        sellerOrgId,
        status: { in: [QuoteStatus.SENT] },
      },
    });

    if (existingQuote) {
      throw new BadRequestException({
        code: 'DUPLICATE_QUOTE',
        message: 'You have already submitted a quote for this RFQ',
      });
    }

    // Create the quote
    const quote = await this.prisma.quote.create({
      data: {
        rfqId: input.rfqId,
        sellerOrgId,
        pricePerUnitPaise: BigInt(input.pricePerUnitPaise),
        validUntil: new Date(input.validUntil),
        terms: input.terms as object ?? null,
        status: QuoteStatus.SENT,
      },
      include: {
        rfq: { include: { mineral: true } },
        sellerOrg: { select: { legalName: true } },
      },
    });

    // Update RFQ status to QUOTED (if currently OPEN)
    if (rfq.status === RfqStatus.OPEN) {
      await this.prisma.rfq.update({
        where: { id: input.rfqId },
        data: { status: RfqStatus.QUOTED },
      });
    }

    await this.audit.log({
      actor: userId,
      actorOrgId: sellerOrgId,
      action: 'quote.submitted',
      entityType: 'Quote',
      entityId: quote.id,
      after: {
        status: quote.status,
        rfqId: input.rfqId,
        pricePerUnitPaise: Number(quote.pricePerUnitPaise),
      },
      ip,
    });

    this.logger.log(
      `Quote submitted id=${quote.id} rfq=${input.rfqId} seller=${sellerOrgId}`,
      'QuoteService',
    );
    return this.serialize(quote);
  }

  // ─── Find by RFQ ──────────────────────────────────────────────────────────

  async findByRfq(rfqId: string, orgId: string) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
    });

    if (!rfq) {
      throw new NotFoundException({
        code: 'RFQ_NOT_FOUND',
        message: 'RFQ not found',
      });
    }

    // Buyer of the RFQ sees all quotes
    if (rfq.buyerOrgId === orgId) {
      const quotes = await this.prisma.quote.findMany({
        where: { rfqId },
        include: {
          sellerOrg: { select: { legalName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return quotes.map(this.serialize);
    }

    // Seller sees only their own quotes
    const sellerQuotes = await this.prisma.quote.findMany({
      where: { rfqId, sellerOrgId: orgId },
      include: {
        sellerOrg: { select: { legalName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (sellerQuotes.length > 0) {
      return sellerQuotes.map(this.serialize);
    }

    // If caller is neither buyer nor a seller with quotes, forbid
    throw new ForbiddenException({
      code: 'QUOTE_ACCESS_DENIED',
      message: 'You do not have access to quotes for this RFQ',
    });
  }

  // ─── Find by ID ───────────────────────────────────────────────────────────

  async findById(quoteId: string, orgId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        rfq: { include: { mineral: true } },
        sellerOrg: { select: { legalName: true } },
      },
    });

    if (!quote) {
      throw new NotFoundException({
        code: 'QUOTE_NOT_FOUND',
        message: 'Quote not found',
      });
    }

    // Access check: buyer of the RFQ or the seller who submitted
    if (quote.rfq.buyerOrgId !== orgId && quote.sellerOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'QUOTE_ACCESS_DENIED',
        message: 'You do not have access to this quote',
      });
    }

    return this.serialize(quote);
  }

  // ─── Accept Quote ─────────────────────────────────────────────────────────

  async acceptQuote(
    quoteId: string,
    buyerOrgId: string,
    userId: string,
    ip?: string,
  ) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        rfq: { include: { mineral: true } },
      },
    });

    if (!quote) {
      throw new NotFoundException({
        code: 'QUOTE_NOT_FOUND',
        message: 'Quote not found',
      });
    }

    // Only buyer of the RFQ can accept
    if (quote.rfq.buyerOrgId !== buyerOrgId) {
      throw new ForbiddenException({
        code: 'NOT_BUYER',
        message: 'Only the buyer who created the RFQ can accept a quote',
      });
    }

    // Only SENT quotes can be accepted
    if (quote.status !== QuoteStatus.SENT) {
      throw new BadRequestException({
        code: 'QUOTE_NOT_SENT',
        message: `Cannot accept quote in ${quote.status} status — only SENT quotes can be accepted`,
      });
    }

    // Check quote hasn't expired
    if (new Date(quote.validUntil) <= new Date()) {
      throw new BadRequestException({
        code: 'QUOTE_EXPIRED',
        message: 'This quote has expired and can no longer be accepted',
      });
    }

    // Compute totalValuePaise: pricePerUnitPaise × quantity (integer math)
    // quantity is Prisma Decimal — convert to paise-safe integer multiplication
    const quantityInHundredths = BigInt(
      Math.round(Number(quote.rfq.quantity) * 100),
    );
    const totalValuePaise =
      (BigInt(quote.pricePerUnitPaise) * quantityInHundredths) / 100n;

    // Atomic transaction: accept quote, reject others, close RFQ, create deal + milestones
    const deal = await this.prisma.$transaction(async (tx) => {
      // a. Update quote status → ACCEPTED
      await tx.quote.update({
        where: { id: quoteId },
        data: { status: QuoteStatus.ACCEPTED },
      });

      // b. Reject all other SENT quotes for same RFQ
      await tx.quote.updateMany({
        where: {
          rfqId: quote.rfqId,
          id: { not: quoteId },
          status: QuoteStatus.SENT,
        },
        data: { status: QuoteStatus.REJECTED },
      });

      // c. Close the RFQ
      await tx.rfq.update({
        where: { id: quote.rfqId },
        data: { status: RfqStatus.CLOSED },
      });

      // d. Create Deal
      const createdDeal = await tx.deal.create({
        data: {
          buyerOrgId,
          sellerOrgId: quote.sellerOrgId,
          quoteId,
          mineralId: quote.rfq.mineralId,
          grade: quote.rfq.grade as object,
          quantity: quote.rfq.quantity,
          unit: quote.rfq.unit,
          totalValuePaise,
          status: DealStatus.CREATED,
        },
      });

      // e. Create 6 DealMilestones
      const milestoneTypes = [
        MilestoneType.AGREEMENT,
        MilestoneType.ESCROW,
        MilestoneType.SAMPLING,
        MilestoneType.DISPATCH,
        MilestoneType.DELIVERY,
        MilestoneType.PAYMENT,
      ];

      await tx.dealMilestone.createMany({
        data: milestoneTypes.map((type, index) => ({
          dealId: createdDeal.id,
          type,
          sequence: index + 1,
          status: MilestoneStatus.PENDING,
        })),
      });

      return tx.deal.findUnique({
        where: { id: createdDeal.id },
        include: {
          milestones: { orderBy: { sequence: 'asc' } },
          buyerOrg: { select: { legalName: true } },
          sellerOrg: { select: { legalName: true } },
          quote: true,
        },
      });
    });

    // Audit: quote accepted
    await this.audit.log({
      actor: userId,
      actorOrgId: buyerOrgId,
      action: 'quote.accepted',
      entityType: 'Quote',
      entityId: quoteId,
      before: { status: QuoteStatus.SENT },
      after: { status: QuoteStatus.ACCEPTED },
      ip,
    });

    // Audit: deal created
    await this.audit.log({
      actor: userId,
      actorOrgId: buyerOrgId,
      action: 'deal.created',
      entityType: 'Deal',
      entityId: deal!.id,
      after: {
        status: DealStatus.CREATED,
        quoteId,
        totalValuePaise: Number(totalValuePaise),
      },
      ip,
    });

    this.logger.log(
      `Quote accepted id=${quoteId} → Deal created id=${deal!.id} totalPaise=${totalValuePaise}`,
      'QuoteService',
    );
    return this.serialize(deal!);
  }

  // ─── Reject Quote ─────────────────────────────────────────────────────────

  async rejectQuote(
    quoteId: string,
    buyerOrgId: string,
    userId: string,
    ip?: string,
  ) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { rfq: true },
    });

    if (!quote) {
      throw new NotFoundException({
        code: 'QUOTE_NOT_FOUND',
        message: 'Quote not found',
      });
    }

    // Only buyer of the RFQ can reject
    if (quote.rfq.buyerOrgId !== buyerOrgId) {
      throw new ForbiddenException({
        code: 'NOT_BUYER',
        message: 'Only the buyer who created the RFQ can reject a quote',
      });
    }

    // Only SENT quotes can be rejected
    if (quote.status !== QuoteStatus.SENT) {
      throw new BadRequestException({
        code: 'QUOTE_NOT_SENT',
        message: `Cannot reject quote in ${quote.status} status — only SENT quotes can be rejected`,
      });
    }

    const updated = await this.prisma.quote.update({
      where: { id: quoteId },
      data: { status: QuoteStatus.REJECTED },
      include: {
        sellerOrg: { select: { legalName: true } },
      },
    });

    await this.audit.log({
      actor: userId,
      actorOrgId: buyerOrgId,
      action: 'quote.rejected',
      entityType: 'Quote',
      entityId: quoteId,
      before: { status: QuoteStatus.SENT },
      after: { status: QuoteStatus.REJECTED },
      ip,
    });

    this.logger.log(`Quote rejected id=${quoteId}`, 'QuoteService');
    return this.serialize(updated);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Serialize for JSON response (Decimal/BigInt → number). */
  private serialize(record: Record<string, unknown>) {
    return JSON.parse(
      JSON.stringify(record, (_key, value) => {
        if (typeof value === 'bigint') return Number(value);
        // Prisma Decimal comes as object with toNumber()
        if (value && typeof value === 'object' && 'toNumber' in value) {
          return (value as { toNumber: () => number }).toNumber();
        }
        return value;
      }),
    );
  }
}

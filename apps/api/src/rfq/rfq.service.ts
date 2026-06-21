import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import { CreateRfqInput } from '@khanij/types';
import { RfqStatus, ListingStatus } from '@prisma/client';

@Injectable()
export class RfqService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly logger: LoggerService,
  ) {}

  // ─── Create ────────────────────────────────────────────────────────────────

  async createRfq(
    input: CreateRfqInput,
    buyerOrgId: string,
    userId: string,
    ip?: string,
    idempotencyKey?: string,
  ) {
    // Idempotency: if key provided, check for existing RFQ with same key
    if (idempotencyKey) {
      const existing = await this.prisma.rfq.findFirst({
        where: {
          buyerOrgId,
          mineralId: input.mineralId,
          quantity: input.quantity,
          neededBy: new Date(input.neededBy),
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // within last 24h
        },
        include: { mineral: true, buyerOrg: { select: { legalName: true } } },
      });
      if (existing) {
        this.logger.log(
          `Idempotent RFQ hit key=${idempotencyKey} rfq=${existing.id}`,
          'RfqService',
        );
        return this.serialize(existing);
      }
    }

    // Validate mineral exists
    const mineral = await this.prisma.mineral.findUnique({
      where: { id: input.mineralId },
    });
    if (!mineral) {
      throw new BadRequestException({
        code: 'MINERAL_NOT_FOUND',
        message: 'Invalid mineralId — mineral does not exist in catalog',
      });
    }

    // Validate listing if provided
    if (input.listingId) {
      const listing = await this.prisma.listing.findUnique({
        where: { id: input.listingId },
      });
      if (!listing) {
        throw new NotFoundException({
          code: 'LISTING_NOT_FOUND',
          message: 'Referenced listing does not exist',
        });
      }
      if (listing.status !== ListingStatus.ACTIVE) {
        throw new BadRequestException({
          code: 'LISTING_NOT_ACTIVE',
          message: 'Referenced listing is not ACTIVE',
        });
      }
    }

    const rfq = await this.prisma.rfq.create({
      data: {
        buyerOrgId,
        listingId: input.listingId ?? null,
        mineralId: input.mineralId,
        grade: input.grade as object,
        quantity: input.quantity,
        unit: input.unit,
        neededBy: new Date(input.neededBy),
        notes: input.notes ?? null,
        status: RfqStatus.OPEN,
      },
      include: { mineral: true, buyerOrg: { select: { legalName: true } } },
    });

    await this.audit.log({
      actor: userId,
      actorOrgId: buyerOrgId,
      action: 'rfq.created',
      entityType: 'Rfq',
      entityId: rfq.id,
      after: { status: rfq.status, mineralId: input.mineralId, listingId: input.listingId },
      ip,
    });

    this.logger.log(
      `RFQ created id=${rfq.id} mineral=${mineral.name} buyer=${buyerOrgId}`,
      'RfqService',
    );
    return this.serialize(rfq);
  }

  // ─── Find by Buyer ─────────────────────────────────────────────────────────

  async findByBuyer(buyerOrgId: string, status?: RfqStatus) {
    const where: Record<string, unknown> = { buyerOrgId };
    if (status) where['status'] = status;

    const rfqs = await this.prisma.rfq.findMany({
      where,
      include: { mineral: true },
      orderBy: { createdAt: 'desc' },
    });

    return rfqs.map(this.serialize);
  }

  // ─── Seller Inbox ──────────────────────────────────────────────────────────

  async findSellerInbox(sellerOrgId: string, status?: RfqStatus) {
    // Find all active listings owned by this seller
    const sellerListings = await this.prisma.listing.findMany({
      where: {
        sellerOrgId,
        status: ListingStatus.ACTIVE,
      },
      select: { id: true, mineralId: true },
    });

    if (sellerListings.length === 0) {
      return [];
    }

    const sellerListingIds = sellerListings.map((l) => l.id);
    const sellerMineralIds = [...new Set(sellerListings.map((l) => l.mineralId))];

    // Find RFQs that either:
    // 1. Reference one of the seller's listings directly (via listingId), OR
    // 2. Are for a mineral the seller has active listings for (broadcast RFQs with no listingId)
    const rfqWhere: Record<string, unknown> = {
      OR: [
        { listingId: { in: sellerListingIds } },
        { listingId: null, mineralId: { in: sellerMineralIds } },
      ],
    };
    if (status) rfqWhere['status'] = status;

    const rfqs = await this.prisma.rfq.findMany({
      where: rfqWhere,
      include: {
        mineral: true,
        buyerOrg: { select: { legalName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rfqs.map(this.serialize);
  }

  // ─── Find by ID ────────────────────────────────────────────────────────────

  async findById(rfqId: string, orgId: string) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      include: {
        mineral: true,
        buyerOrg: { select: { legalName: true } },
        quotes: true,
      },
    });

    if (!rfq) {
      throw new NotFoundException({ code: 'RFQ_NOT_FOUND', message: 'RFQ not found' });
    }

    // Access check: buyer owns the RFQ
    if (rfq.buyerOrgId === orgId) {
      return this.serialize(rfq);
    }

    // Access check: seller has matching active listings
    const matchingListings = await this.prisma.listing.findFirst({
      where: {
        sellerOrgId: orgId,
        status: ListingStatus.ACTIVE,
        OR: [
          ...(rfq.listingId ? [{ id: rfq.listingId }] : []),
          { mineralId: rfq.mineralId },
        ],
      },
    });

    if (!matchingListings) {
      throw new ForbiddenException({
        code: 'RFQ_ACCESS_DENIED',
        message: 'You do not have access to this RFQ',
      });
    }

    return this.serialize(rfq);
  }

  // ─── Cancel ────────────────────────────────────────────────────────────────

  async cancelRfq(rfqId: string, buyerOrgId: string, userId: string, ip?: string) {
    const rfq = await this.prisma.rfq.findUnique({ where: { id: rfqId } });

    if (!rfq) {
      throw new NotFoundException({ code: 'RFQ_NOT_FOUND', message: 'RFQ not found' });
    }

    if (rfq.buyerOrgId !== buyerOrgId) {
      throw new ForbiddenException({
        code: 'NOT_OWNER',
        message: 'Only the buyer who created this RFQ can cancel it',
      });
    }

    if (rfq.status !== RfqStatus.OPEN) {
      throw new BadRequestException({
        code: 'RFQ_NOT_OPEN',
        message: `Cannot cancel RFQ in ${rfq.status} status — only OPEN RFQs can be cancelled`,
      });
    }

    const updated = await this.prisma.rfq.update({
      where: { id: rfqId },
      data: { status: RfqStatus.CANCELLED },
      include: { mineral: true },
    });

    await this.audit.log({
      actor: userId,
      actorOrgId: buyerOrgId,
      action: 'rfq.cancelled',
      entityType: 'Rfq',
      entityId: rfqId,
      before: { status: RfqStatus.OPEN },
      after: { status: RfqStatus.CANCELLED },
      ip,
    });

    this.logger.log(`RFQ cancelled id=${rfqId}`, 'RfqService');
    return this.serialize(updated);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Serialize for JSON response (Decimal/BigInt → number). */
  private serialize(rfq: Record<string, unknown>) {
    return JSON.parse(
      JSON.stringify(rfq, (_key, value) => {
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

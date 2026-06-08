import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import { SearchService, ListingDocument } from '../providers/search/search.service';
import {
  CreateListingInput,
  UpdateListingInput,
} from '@khanij/types';
import { ListingStatus, OrgStatus } from '@prisma/client';

/** Legal status transitions for listings. */
const LISTING_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  [ListingStatus.DRAFT]: [ListingStatus.ACTIVE, ListingStatus.SOLD_OUT],
  [ListingStatus.ACTIVE]: [ListingStatus.PAUSED, ListingStatus.SOLD_OUT],
  [ListingStatus.PAUSED]: [ListingStatus.ACTIVE, ListingStatus.SOLD_OUT],
  [ListingStatus.SOLD_OUT]: [], // terminal state
};

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly logger: LoggerService,
    private readonly search: SearchService,
  ) {}

  // ─── Create ────────────────────────────────────────────────────────────────

  async create(dto: CreateListingInput, orgId: string, userId: string, ip?: string) {
    // Validate mineral exists
    const mineral = await this.prisma.mineral.findUnique({
      where: { id: dto.mineralId },
    });
    if (!mineral) {
      throw new BadRequestException({
        code: 'MINERAL_NOT_FOUND',
        message: 'Invalid mineralId — mineral does not exist in catalog',
      });
    }

    const listing = await this.prisma.listing.create({
      data: {
        sellerOrgId: orgId,
        mineralId: dto.mineralId,
        grade: dto.grade as object,
        quantityAvailable: dto.quantityAvailable,
        unit: dto.unit,
        askPriceInPaise: BigInt(dto.askPriceInPaise),
        location: dto.location as object,
        dispatchLeadDays: dto.dispatchLeadDays,
        status: ListingStatus.DRAFT,
      },
      include: { mineral: true, sellerOrg: { select: { legalName: true, status: true } } },
    });

    await this.audit.log({
      actor: userId,
      actorOrgId: orgId,
      action: 'listing.created',
      entityType: 'Listing',
      entityId: listing.id,
      after: { status: listing.status, mineralId: dto.mineralId },
      ip,
    });

    this.logger.log(`Listing created id=${listing.id} mineral=${mineral.name}`, 'ListingsService');
    return this.serialize(listing);
  }

  // ─── Find ──────────────────────────────────────────────────────────────────

  async findOwn(orgId: string) {
    const listings = await this.prisma.listing.findMany({
      where: { sellerOrgId: orgId },
      include: { mineral: true },
      orderBy: { createdAt: 'desc' },
    });
    return listings.map(this.serialize);
  }

  async findActive(mineralId?: string, state?: string) {
    const where: Record<string, unknown> = { status: ListingStatus.ACTIVE };
    if (mineralId) where['mineralId'] = mineralId;

    const listings = await this.prisma.listing.findMany({
      where,
      include: {
        mineral: true,
        sellerOrg: { select: { legalName: true, state: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Post-filter by state if provided (location is JSON)
    const filtered = state
      ? listings.filter((l) => {
          const loc = l.location as { state?: string };
          return loc?.state?.toLowerCase() === state.toLowerCase();
        })
      : listings;

    return filtered.map(this.serialize);
  }

  async findOne(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        mineral: true,
        sellerOrg: { select: { legalName: true, status: true } },
      },
    });
    if (!listing) {
      throw new NotFoundException({ code: 'LISTING_NOT_FOUND', message: 'Listing not found' });
    }
    return this.serialize(listing);
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateListingInput, orgId: string, userId: string, ip?: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException({ code: 'LISTING_NOT_FOUND', message: 'Listing not found' });
    if (listing.sellerOrgId !== orgId) {
      throw new ForbiddenException({ code: 'NOT_OWNER', message: 'You do not own this listing' });
    }
    if (listing.status === ListingStatus.SOLD_OUT) {
      throw new BadRequestException({
        code: 'LISTING_SOLD_OUT',
        message: 'Cannot update a SOLD_OUT listing',
      });
    }

    const data: Record<string, unknown> = {};
    if (dto.grade) data['grade'] = dto.grade;
    if (dto.quantityAvailable !== undefined) data['quantityAvailable'] = dto.quantityAvailable;
    if (dto.unit) data['unit'] = dto.unit;
    if (dto.askPriceInPaise !== undefined) data['askPriceInPaise'] = BigInt(dto.askPriceInPaise);
    if (dto.location) data['location'] = dto.location;
    if (dto.dispatchLeadDays !== undefined) data['dispatchLeadDays'] = dto.dispatchLeadDays;

    const updated = await this.prisma.listing.update({
      where: { id },
      data,
      include: { mineral: true, sellerOrg: { select: { legalName: true, status: true } } },
    });

    // Re-index if listing is ACTIVE
    if (updated.status === ListingStatus.ACTIVE) {
      await this.indexToEs(updated);
    }

    await this.audit.log({
      actor: userId,
      actorOrgId: orgId,
      action: 'listing.updated',
      entityType: 'Listing',
      entityId: id,
      before: { status: listing.status },
      after: { status: updated.status },
      ip,
    });

    return this.serialize(updated);
  }

  // ─── Activate ──────────────────────────────────────────────────────────────

  async activate(id: string, orgId: string, userId: string, ip?: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        mineral: true,
        sellerOrg: { select: { legalName: true, status: true, state: true } },
      },
    });
    if (!listing) throw new NotFoundException({ code: 'LISTING_NOT_FOUND', message: 'Listing not found' });
    if (listing.sellerOrgId !== orgId) {
      throw new ForbiddenException({ code: 'NOT_OWNER', message: 'You do not own this listing' });
    }

    // Enforce: ACTIVE requires VERIFIED org
    if (listing.sellerOrg.status !== OrgStatus.VERIFIED) {
      throw new BadRequestException({
        code: 'ORG_NOT_VERIFIED',
        message: 'Cannot activate listing — seller organization must be VERIFIED',
      });
    }

    this.assertTransition(listing.status, ListingStatus.ACTIVE);

    const updated = await this.prisma.listing.update({
      where: { id },
      data: { status: ListingStatus.ACTIVE },
      include: { mineral: true, sellerOrg: { select: { legalName: true, status: true } } },
    });

    // Index into Elasticsearch
    await this.indexToEs(updated);

    await this.audit.log({
      actor: userId,
      actorOrgId: orgId,
      action: 'listing.activated',
      entityType: 'Listing',
      entityId: id,
      before: { status: listing.status },
      after: { status: updated.status },
      ip,
    });

    this.logger.log(`Listing activated id=${id}`, 'ListingsService');
    return this.serialize(updated);
  }

  // ─── Pause ─────────────────────────────────────────────────────────────────

  async pause(id: string, orgId: string, userId: string, ip?: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException({ code: 'LISTING_NOT_FOUND', message: 'Listing not found' });
    if (listing.sellerOrgId !== orgId) {
      throw new ForbiddenException({ code: 'NOT_OWNER', message: 'You do not own this listing' });
    }

    this.assertTransition(listing.status, ListingStatus.PAUSED);

    const updated = await this.prisma.listing.update({
      where: { id },
      data: { status: ListingStatus.PAUSED },
      include: { mineral: true },
    });

    // Remove from Elasticsearch
    await this.search.removeListing(id);

    await this.audit.log({
      actor: userId,
      actorOrgId: orgId,
      action: 'listing.paused',
      entityType: 'Listing',
      entityId: id,
      before: { status: listing.status },
      after: { status: updated.status },
      ip,
    });

    return this.serialize(updated);
  }

  // ─── Sell Out ──────────────────────────────────────────────────────────────

  async markSoldOut(id: string, orgId: string, userId: string, ip?: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException({ code: 'LISTING_NOT_FOUND', message: 'Listing not found' });
    if (listing.sellerOrgId !== orgId) {
      throw new ForbiddenException({ code: 'NOT_OWNER', message: 'You do not own this listing' });
    }

    this.assertTransition(listing.status, ListingStatus.SOLD_OUT);

    const updated = await this.prisma.listing.update({
      where: { id },
      data: { status: ListingStatus.SOLD_OUT },
      include: { mineral: true },
    });

    // Remove from Elasticsearch
    await this.search.removeListing(id);

    await this.audit.log({
      actor: userId,
      actorOrgId: orgId,
      action: 'listing.sold_out',
      entityType: 'Listing',
      entityId: id,
      before: { status: listing.status },
      after: { status: updated.status },
      ip,
    });

    return this.serialize(updated);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private assertTransition(from: ListingStatus, to: ListingStatus): void {
    const allowed = LISTING_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException({
        code: 'ILLEGAL_STATUS_TRANSITION',
        message: `Cannot transition listing from ${from} to ${to}`,
      });
    }
  }

  private async indexToEs(listing: {
    id: string;
    sellerOrgId: string;
    sellerOrg: { legalName: string };
    mineralId: string;
    mineral: { name: string };
    grade: unknown;
    quantityAvailable: unknown;
    unit: string;
    askPriceInPaise: bigint;
    location: unknown;
    dispatchLeadDays: number;
    createdAt: Date;
  }): Promise<void> {
    // Fetch seller's latest TrustScore
    const latestSnapshot = await this.prisma.complianceSnapshot.findFirst({
      where: { orgId: listing.sellerOrgId },
      orderBy: { createdAt: 'desc' },
      select: { trustScore: true },
    });

    const doc: ListingDocument = {
      listingId: listing.id,
      sellerOrgId: listing.sellerOrgId,
      sellerLegalName: listing.sellerOrg.legalName,
      mineralId: listing.mineralId,
      mineralName: listing.mineral.name,
      grade: listing.grade as Record<string, number>,
      quantityAvailable: Number(listing.quantityAvailable),
      unit: listing.unit,
      askPriceInPaise: Number(listing.askPriceInPaise),
      location: listing.location as ListingDocument['location'],
      dispatchLeadDays: listing.dispatchLeadDays,
      sellerTrustScore: latestSnapshot?.trustScore ?? 0,
      createdAt: listing.createdAt.toISOString(),
    };

    await this.search.indexListing(doc);
  }

  /** Serialize listing for JSON response (BigInt → number). */
  private serialize(listing: Record<string, unknown>) {
    return JSON.parse(
      JSON.stringify(listing, (_key, value) =>
        typeof value === 'bigint' ? Number(value) : value,
      ),
    );
  }
}

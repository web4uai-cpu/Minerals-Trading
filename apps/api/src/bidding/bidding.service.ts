import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import { CreateAuctionInput, PlaceBidInput } from '@khanij/types';
import { AuctionStatus, AuctionType, OrgStatus, UserRole } from '@prisma/client';

@Injectable()
export class BiddingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly logger: LoggerService,
  ) {}

  // ─── Create Auction ───────────────────────────────────────────────────────

  async createAuction(
    input: CreateAuctionInput,
    creatorOrgId: string,
    userId: string,
    userRole: UserRole,
    ip?: string,
  ) {
    // Validate org is VERIFIED
    const org = await this.prisma.organization.findUnique({
      where: { id: creatorOrgId },
    });
    if (!org || org.status !== OrgStatus.VERIFIED) {
      throw new ForbiddenException({
        code: 'ORG_NOT_VERIFIED',
        message: 'Only verified organizations can create auctions',
      });
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

    // Validate endAt > startAt
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    if (endAt <= startAt) {
      throw new BadRequestException({
        code: 'INVALID_AUCTION_DATES',
        message: 'endAt must be after startAt',
      });
    }

    // Validate role matches auction type
    if (input.type === AuctionType.FORWARD && userRole !== UserRole.SELLER) {
      throw new ForbiddenException({
        code: 'ROLE_MISMATCH',
        message: 'Only SELLER can create FORWARD auctions',
      });
    }
    if (input.type === AuctionType.REVERSE && userRole !== UserRole.BUYER) {
      throw new ForbiddenException({
        code: 'ROLE_MISMATCH',
        message: 'Only BUYER can create REVERSE auctions',
      });
    }

    const auction = await this.prisma.auction.create({
      data: {
        creatorOrgId,
        type: input.type as AuctionType,
        mineralId: input.mineralId,
        grade: input.grade as object,
        quantity: input.quantity,
        unit: input.unit,
        reservePriceInPaise: input.reservePriceInPaise
          ? BigInt(input.reservePriceInPaise)
          : null,
        startAt,
        endAt,
        antiSnipingMinutes: input.antiSnipingMinutes ?? 5,
        minIncrementPaise: input.minIncrementPaise
          ? BigInt(input.minIncrementPaise)
          : BigInt(100),
        status: AuctionStatus.DRAFT,
      },
      include: { mineral: true, creatorOrg: { select: { legalName: true } } },
    });

    await this.audit.log({
      actor: userId,
      actorOrgId: creatorOrgId,
      action: 'auction.created',
      entityType: 'Auction',
      entityId: auction.id,
      after: {
        status: auction.status,
        type: auction.type,
        mineralId: input.mineralId,
      },
      ip,
    });

    this.logger.log(
      `Auction created id=${auction.id} type=${auction.type} mineral=${mineral.name} org=${creatorOrgId}`,
      'BiddingService',
    );
    return this.serialize(auction);
  }

  // ─── Open Auction ─────────────────────────────────────────────────────────

  async openAuction(
    auctionId: string,
    orgId: string,
    userId: string,
    ip?: string,
  ) {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
    });

    if (!auction) {
      throw new NotFoundException({
        code: 'AUCTION_NOT_FOUND',
        message: 'Auction not found',
      });
    }

    if (auction.creatorOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'NOT_OWNER',
        message: 'Only the auction creator can open this auction',
      });
    }

    if (auction.status !== AuctionStatus.DRAFT) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: `Cannot open auction in ${auction.status} status — only DRAFT auctions can be opened`,
      });
    }

    const now = new Date();
    if (auction.startAt > now) {
      throw new BadRequestException({
        code: 'TOO_EARLY',
        message: 'Cannot open auction before its startAt time',
      });
    }
    if (auction.endAt <= now) {
      throw new BadRequestException({
        code: 'ALREADY_EXPIRED',
        message: 'Cannot open auction — endAt has already passed',
      });
    }

    const updated = await this.prisma.auction.update({
      where: { id: auctionId },
      data: { status: AuctionStatus.OPEN },
      include: { mineral: true, creatorOrg: { select: { legalName: true } } },
    });

    await this.audit.log({
      actor: userId,
      actorOrgId: orgId,
      action: 'auction.opened',
      entityType: 'Auction',
      entityId: auctionId,
      before: { status: AuctionStatus.DRAFT },
      after: { status: AuctionStatus.OPEN },
      ip,
    });

    this.logger.log(`Auction opened id=${auctionId}`, 'BiddingService');
    return this.serialize(updated);
  }

  // ─── Place Bid ────────────────────────────────────────────────────────────

  async placeBid(
    input: PlaceBidInput,
    bidderOrgId: string,
    userId: string,
    ip?: string,
  ) {
    const auction = await this.prisma.auction.findUnique({
      where: { id: input.auctionId },
      include: { bids: { orderBy: { createdAt: 'desc' } } },
    });

    if (!auction) {
      throw new NotFoundException({
        code: 'AUCTION_NOT_FOUND',
        message: 'Auction not found',
      });
    }

    if (auction.status !== AuctionStatus.OPEN) {
      throw new BadRequestException({
        code: 'AUCTION_NOT_OPEN',
        message: `Cannot bid on auction in ${auction.status} status`,
      });
    }

    // Validate bidder org is VERIFIED
    const bidderOrg = await this.prisma.organization.findUnique({
      where: { id: bidderOrgId },
    });
    if (!bidderOrg || bidderOrg.status !== OrgStatus.VERIFIED) {
      throw new ForbiddenException({
        code: 'ORG_NOT_VERIFIED',
        message: 'Only verified organizations can place bids',
      });
    }

    // Cannot bid on own auction
    if (auction.creatorOrgId === bidderOrgId) {
      throw new ForbiddenException({
        code: 'SELF_BID',
        message: 'Cannot bid on your own auction',
      });
    }

    const amountPaise = BigInt(input.amountPaise);
    const minIncrement = auction.minIncrementPaise;

    // Find current best bid
    const currentBest = this.findBestBid(auction.bids, auction.type);

    if (auction.type === AuctionType.FORWARD) {
      // FORWARD: bid must be >= currentBest + minIncrement, or >= reserve if first bid
      if (currentBest) {
        const minRequired = currentBest.amountPaise + minIncrement;
        if (amountPaise < minRequired) {
          throw new BadRequestException({
            code: 'BID_TOO_LOW',
            message: `Bid must be at least ${minRequired.toString()} paise (current best + minimum increment)`,
          });
        }
      } else if (auction.reservePriceInPaise && amountPaise < auction.reservePriceInPaise) {
        throw new BadRequestException({
          code: 'BELOW_RESERVE',
          message: `Bid must be at least ${auction.reservePriceInPaise.toString()} paise (reserve price)`,
        });
      }
    } else {
      // REVERSE: bid must be <= currentBest - minIncrement, or <= reserve if first bid
      if (currentBest) {
        const maxAllowed = currentBest.amountPaise - minIncrement;
        if (amountPaise > maxAllowed) {
          throw new BadRequestException({
            code: 'BID_TOO_HIGH',
            message: `Bid must be at most ${maxAllowed.toString()} paise (current best - minimum increment)`,
          });
        }
      } else if (auction.reservePriceInPaise && amountPaise > auction.reservePriceInPaise) {
        throw new BadRequestException({
          code: 'ABOVE_RESERVE',
          message: `Bid must be at most ${auction.reservePriceInPaise.toString()} paise (reserve price)`,
        });
      }
    }

    // Anti-sniping: extend endAt if bid is within antiSnipingMinutes of endAt
    const now = new Date();
    const snipeThreshold = new Date(
      auction.endAt.getTime() - auction.antiSnipingMinutes * 60 * 1000,
    );
    let newEndAt: Date | undefined;
    if (now >= snipeThreshold) {
      newEndAt = new Date(
        now.getTime() + auction.antiSnipingMinutes * 60 * 1000,
      );
    }

    // Create bid and optionally extend endAt in a transaction
    const [bid] = await this.prisma.$transaction([
      this.prisma.bid.create({
        data: {
          auctionId: input.auctionId,
          bidderOrgId,
          bidderUserId: userId,
          amountPaise,
        },
        include: {
          auction: {
            include: { mineral: true },
          },
        },
      }),
      ...(newEndAt
        ? [
            this.prisma.auction.update({
              where: { id: input.auctionId },
              data: { endAt: newEndAt },
            }),
          ]
        : []),
    ]);

    await this.audit.log({
      actor: userId,
      actorOrgId: bidderOrgId,
      action: 'bid.placed',
      entityType: 'Bid',
      entityId: bid.id,
      after: {
        auctionId: input.auctionId,
        amountPaise: amountPaise.toString(),
        antiSnipeExtended: !!newEndAt,
      },
      ip,
    });

    this.logger.log(
      `Bid placed id=${bid.id} auction=${input.auctionId} amount=${amountPaise.toString()} org=${bidderOrgId}`,
      'BiddingService',
    );
    return this.serialize(bid);
  }

  // ─── Close Auction ────────────────────────────────────────────────────────

  async closeAuction(
    auctionId: string,
    orgId: string,
    userId: string,
    ip?: string,
  ) {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
    });

    if (!auction) {
      throw new NotFoundException({
        code: 'AUCTION_NOT_FOUND',
        message: 'Auction not found',
      });
    }

    if (auction.creatorOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'NOT_OWNER',
        message: 'Only the auction creator can close this auction',
      });
    }

    if (auction.status !== AuctionStatus.OPEN) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: `Cannot close auction in ${auction.status} status — only OPEN auctions can be closed`,
      });
    }

    const updated = await this.prisma.auction.update({
      where: { id: auctionId },
      data: { status: AuctionStatus.CLOSED },
      include: { mineral: true, creatorOrg: { select: { legalName: true } } },
    });

    await this.audit.log({
      actor: userId,
      actorOrgId: orgId,
      action: 'auction.closed',
      entityType: 'Auction',
      entityId: auctionId,
      before: { status: AuctionStatus.OPEN },
      after: { status: AuctionStatus.CLOSED },
      ip,
    });

    this.logger.log(`Auction closed id=${auctionId}`, 'BiddingService');
    return this.serialize(updated);
  }

  // ─── Award Auction ────────────────────────────────────────────────────────

  async awardAuction(
    auctionId: string,
    orgId: string,
    userId: string,
    ip?: string,
  ) {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      include: { bids: true },
    });

    if (!auction) {
      throw new NotFoundException({
        code: 'AUCTION_NOT_FOUND',
        message: 'Auction not found',
      });
    }

    if (auction.creatorOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'NOT_OWNER',
        message: 'Only the auction creator can award this auction',
      });
    }

    if (auction.status !== AuctionStatus.CLOSED) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: `Cannot award auction in ${auction.status} status — only CLOSED auctions can be awarded`,
      });
    }

    if (auction.bids.length === 0) {
      throw new BadRequestException({
        code: 'NO_BIDS',
        message: 'Cannot award auction with no bids',
      });
    }

    // Determine winning bid: highest for FORWARD, lowest for REVERSE
    const winningBid = this.findBestBid(auction.bids, auction.type);
    if (!winningBid) {
      throw new BadRequestException({
        code: 'NO_BIDS',
        message: 'Cannot award auction with no bids',
      });
    }

    const updated = await this.prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: AuctionStatus.AWARDED,
        winningBidId: winningBid.id,
      },
      include: {
        mineral: true,
        creatorOrg: { select: { legalName: true } },
        bids: true,
        winningBid: true,
      },
    });

    await this.audit.log({
      actor: userId,
      actorOrgId: orgId,
      action: 'auction.awarded',
      entityType: 'Auction',
      entityId: auctionId,
      before: { status: AuctionStatus.CLOSED },
      after: {
        status: AuctionStatus.AWARDED,
        winningBidId: winningBid.id,
        winningAmount: winningBid.amountPaise.toString(),
      },
      ip,
    });

    this.logger.log(
      `Auction awarded id=${auctionId} winner=${winningBid.bidderOrgId} amount=${winningBid.amountPaise.toString()}`,
      'BiddingService',
    );
    return this.serialize(updated);
  }

  // ─── Find Auctions ───────────────────────────────────────────────────────

  async findAuctions(filters: {
    mineralId?: string;
    status?: AuctionStatus;
    type?: AuctionType;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.mineralId) where['mineralId'] = filters.mineralId;
    if (filters.status) where['status'] = filters.status;
    if (filters.type) where['type'] = filters.type;

    const auctions = await this.prisma.auction.findMany({
      where,
      include: {
        mineral: true,
        creatorOrg: { select: { legalName: true } },
        _count: { select: { bids: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return auctions.map(this.serialize);
  }

  // ─── Find by ID ───────────────────────────────────────────────────────────

  async findById(auctionId: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        mineral: true,
        creatorOrg: { select: { legalName: true } },
        bids: { orderBy: { createdAt: 'desc' } },
        winningBid: true,
      },
    });

    if (!auction) {
      throw new NotFoundException({
        code: 'AUCTION_NOT_FOUND',
        message: 'Auction not found',
      });
    }

    return this.serialize(auction);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Find the best bid: highest for FORWARD, lowest for REVERSE. */
  private findBestBid(
    bids: Array<{ id: string; amountPaise: bigint }>,
    type: AuctionType,
  ): { id: string; amountPaise: bigint; bidderOrgId?: string } | null {
    if (bids.length === 0) return null;

    return bids.reduce((best, bid) => {
      if (type === AuctionType.FORWARD) {
        return bid.amountPaise > best.amountPaise ? bid : best;
      }
      return bid.amountPaise < best.amountPaise ? bid : best;
    }) as { id: string; amountPaise: bigint; bidderOrgId?: string };
  }

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

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { BiddingService } from './bidding.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import { AuctionStatus, AuctionType, OrgStatus, UserRole } from '@prisma/client';
import { CreateAuctionInput, AuctionType as KhanijAuctionType } from '@khanij/types';

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockPrisma = {
  organization: { findUnique: jest.fn() },
  mineral: { findUnique: jest.fn() },
  auction: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  bid: { create: jest.fn() },
  $transaction: jest.fn(),
};

const mockAudit = { log: jest.fn() };
const mockLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

// ─── Test Data ─────────────────────────────────────────────────────────────

const verifiedOrg = {
  id: 'org-seller-1',
  status: OrgStatus.VERIFIED,
  legalName: 'Test Minerals Pvt Ltd',
};

const unverifiedOrg = {
  id: 'org-unverified-1',
  status: OrgStatus.PENDING,
  legalName: 'Pending Corp',
};

const mineral = { id: 'mineral-1', name: 'Iron Ore' };

const validCreateInput: CreateAuctionInput = {
  type: KhanijAuctionType.FORWARD,
  mineralId: 'mineral-1',
  grade: { 'Fe%': 62 },
  quantity: 500,
  unit: 'MT',
  reservePriceInPaise: '100000',
  startAt: new Date(Date.now() - 60_000).toISOString(),
  endAt: new Date(Date.now() + 3_600_000).toISOString(),
  antiSnipingMinutes: 5,
  minIncrementPaise: '1000',
};

const draftAuction = {
  id: 'auction-1',
  creatorOrgId: 'org-seller-1',
  type: AuctionType.FORWARD,
  mineralId: 'mineral-1',
  grade: { 'Fe%': 62 },
  quantity: 500,
  unit: 'MT',
  reservePriceInPaise: BigInt(100000),
  startAt: new Date(Date.now() - 60_000),
  endAt: new Date(Date.now() + 3_600_000),
  antiSnipingMinutes: 5,
  minIncrementPaise: BigInt(1000),
  status: AuctionStatus.DRAFT,
  winningBidId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  mineral,
  creatorOrg: { legalName: 'Test Minerals Pvt Ltd' },
};

const openAuction = {
  ...draftAuction,
  status: AuctionStatus.OPEN,
  bids: [],
};

const closedAuctionWithBids = {
  ...draftAuction,
  status: AuctionStatus.CLOSED,
  bids: [
    { id: 'bid-1', auctionId: 'auction-1', bidderOrgId: 'org-buyer-1', bidderUserId: 'user-buyer-1', amountPaise: BigInt(110000), createdAt: new Date() },
    { id: 'bid-2', auctionId: 'auction-1', bidderOrgId: 'org-buyer-2', bidderUserId: 'user-buyer-2', amountPaise: BigInt(120000), createdAt: new Date() },
    { id: 'bid-3', auctionId: 'auction-1', bidderOrgId: 'org-buyer-3', bidderUserId: 'user-buyer-3', amountPaise: BigInt(105000), createdAt: new Date() },
  ],
};

const closedAuctionNoBids = {
  ...draftAuction,
  status: AuctionStatus.CLOSED,
  bids: [],
};

// ─── Test Suite ────────────────────────────────────────────────────────────

describe('BiddingService', () => {
  let service: BiddingService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BiddingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<BiddingService>(BiddingService);
  });

  // ─── createAuction ────────────────────────────────────────────────────────

  describe('createAuction', () => {
    it('creates a FORWARD auction for a SELLER org (happy path)', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(verifiedOrg);
      mockPrisma.mineral.findUnique.mockResolvedValue(mineral);
      mockPrisma.auction.create.mockResolvedValue(draftAuction);

      const result = await service.createAuction(
        validCreateInput,
        'org-seller-1',
        'user-seller-1',
        UserRole.SELLER,
      );

      expect(result).toBeDefined();
      expect(result.status).toBe(AuctionStatus.DRAFT);
      expect(result.type).toBe(AuctionType.FORWARD);
      expect(mockPrisma.auction.create).toHaveBeenCalledTimes(1);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auction.created' }),
      );
    });

    it('rejects unverified org', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(unverifiedOrg);

      await expect(
        service.createAuction(
          validCreateInput,
          'org-unverified-1',
          'user-1',
          UserRole.SELLER,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.auction.create).not.toHaveBeenCalled();
    });

    it('rejects if endAt <= startAt', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(verifiedOrg);
      mockPrisma.mineral.findUnique.mockResolvedValue(mineral);

      const badInput = {
        ...validCreateInput,
        startAt: new Date(Date.now() + 3_600_000).toISOString(),
        endAt: new Date(Date.now() - 60_000).toISOString(),
      };

      await expect(
        service.createAuction(badInput, 'org-seller-1', 'user-1', UserRole.SELLER),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.auction.create).not.toHaveBeenCalled();
    });
  });

  // ─── placeBid ─────────────────────────────────────────────────────────────

  describe('placeBid', () => {
    const bidderOrg = {
      id: 'org-buyer-1',
      status: OrgStatus.VERIFIED,
      legalName: 'Buyer Corp',
    };

    it('places a bid on a FORWARD auction (happy path)', async () => {
      const auctionWithNoBids = { ...openAuction, bids: [] };
      mockPrisma.auction.findUnique.mockResolvedValue(auctionWithNoBids);
      mockPrisma.organization.findUnique.mockResolvedValue(bidderOrg);

      const createdBid = {
        id: 'bid-new',
        auctionId: 'auction-1',
        bidderOrgId: 'org-buyer-1',
        bidderUserId: 'user-buyer-1',
        amountPaise: BigInt(110000),
        createdAt: new Date(),
        auction: { ...openAuction, mineral },
      };
      mockPrisma.$transaction.mockResolvedValue([createdBid]);

      const result = await service.placeBid(
        { auctionId: 'auction-1', amountPaise: '110000' },
        'org-buyer-1',
        'user-buyer-1',
      );

      expect(result).toBeDefined();
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'bid.placed' }),
      );
    });

    it('rejects bid from auction creator (self-bid)', async () => {
      mockPrisma.auction.findUnique.mockResolvedValue({
        ...openAuction,
        bids: [],
      });
      mockPrisma.organization.findUnique.mockResolvedValue(verifiedOrg);

      await expect(
        service.placeBid(
          { auctionId: 'auction-1', amountPaise: '110000' },
          'org-seller-1', // same as auction creator
          'user-seller-1',
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects bid below minimum increment (FORWARD)', async () => {
      const auctionWithBids = {
        ...openAuction,
        bids: [
          {
            id: 'bid-existing',
            auctionId: 'auction-1',
            bidderOrgId: 'org-buyer-2',
            bidderUserId: 'user-buyer-2',
            amountPaise: BigInt(110000),
            createdAt: new Date(),
          },
        ],
      };
      mockPrisma.auction.findUnique.mockResolvedValue(auctionWithBids);
      mockPrisma.organization.findUnique.mockResolvedValue(bidderOrg);

      // Bid of 110500 is below 110000 + 1000 = 111000
      await expect(
        service.placeBid(
          { auctionId: 'auction-1', amountPaise: '110500' },
          'org-buyer-1',
          'user-buyer-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ─── awardAuction ─────────────────────────────────────────────────────────

  describe('awardAuction', () => {
    it('sets winning bid to highest for FORWARD auction', async () => {
      mockPrisma.auction.findUnique.mockResolvedValue(closedAuctionWithBids);
      mockPrisma.auction.update.mockResolvedValue({
        ...closedAuctionWithBids,
        status: AuctionStatus.AWARDED,
        winningBidId: 'bid-2', // 120000 is highest
        winningBid: closedAuctionWithBids.bids[1],
      });

      const result = await service.awardAuction(
        'auction-1',
        'org-seller-1',
        'user-seller-1',
      );

      expect(result).toBeDefined();
      expect(mockPrisma.auction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: AuctionStatus.AWARDED,
            winningBidId: 'bid-2',
          }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auction.awarded' }),
      );
    });

    it('rejects if no bids', async () => {
      mockPrisma.auction.findUnique.mockResolvedValue(closedAuctionNoBids);

      await expect(
        service.awardAuction('auction-1', 'org-seller-1', 'user-seller-1'),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.auction.update).not.toHaveBeenCalled();
    });
  });
});

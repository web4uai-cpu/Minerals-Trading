import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RfqService } from './rfq.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import { RfqStatus, ListingStatus } from '@prisma/client';

const mockPrisma = {
  mineral: {
    findUnique: jest.fn(),
  },
  listing: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  rfq: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

const mockAudit = { log: jest.fn() };
const mockLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

const testMineral = {
  id: 'mineral-1',
  name: 'Iron Ore',
  category: 'Metallic',
  hsnCode: '2601.11',
  defaultUnit: 'MT',
  gradeParams: { 'Fe%': { min: 0, max: 100 } },
};

const testListing = {
  id: 'listing-1',
  sellerOrgId: 'seller-org-1',
  mineralId: 'mineral-1',
  grade: { 'Fe%': 62 },
  quantityAvailable: 5000,
  unit: 'MT',
  askPriceInPaise: BigInt(585000),
  location: { district: 'Keonjhar', state: 'Odisha' },
  dispatchLeadDays: 7,
  status: ListingStatus.ACTIVE,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const openRfq = {
  id: 'rfq-1',
  buyerOrgId: 'buyer-org-1',
  listingId: null,
  mineralId: 'mineral-1',
  grade: { 'Fe%': 62 },
  quantity: 1000,
  unit: 'MT',
  neededBy: new Date('2025-03-01'),
  notes: null,
  status: RfqStatus.OPEN,
  createdAt: new Date(),
  updatedAt: new Date(),
  mineral: testMineral,
  buyerOrg: { legalName: 'Test Buyer Corp' },
};

const validInput = {
  mineralId: 'mineral-1',
  grade: { 'Fe%': 62 },
  quantity: 1000,
  unit: 'MT' as const,
  neededBy: '2025-03-01T00:00:00.000Z',
  notes: 'Need high-grade ore',
};

describe('RfqService', () => {
  let service: RfqService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RfqService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    service = module.get(RfqService);
  });

  // ─── createRfq ───────────────────────────────────────────────────────────

  describe('createRfq', () => {
    it('creates an RFQ with status OPEN when mineral exists', async () => {
      mockPrisma.mineral.findUnique.mockResolvedValue(testMineral);
      mockPrisma.rfq.create.mockResolvedValue(openRfq);

      const result = await service.createRfq(validInput, 'buyer-org-1', 'user-1');

      expect(result.status).toBe(RfqStatus.OPEN);
      expect(result.mineralId).toBe('mineral-1');
      expect(mockPrisma.rfq.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            buyerOrgId: 'buyer-org-1',
            mineralId: 'mineral-1',
            status: RfqStatus.OPEN,
          }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'rfq.created',
          entityType: 'Rfq',
          entityId: 'rfq-1',
        }),
      );
    });

    it('rejects creation when mineral does not exist', async () => {
      mockPrisma.mineral.findUnique.mockResolvedValue(null);

      await expect(
        service.createRfq(validInput, 'buyer-org-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.rfq.create).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
    });

    it('rejects creation when listing does not exist', async () => {
      mockPrisma.mineral.findUnique.mockResolvedValue(testMineral);
      mockPrisma.listing.findUnique.mockResolvedValue(null);

      const inputWithListing = { ...validInput, listingId: 'bad-listing' };

      await expect(
        service.createRfq(inputWithListing, 'buyer-org-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.rfq.create).not.toHaveBeenCalled();
    });

    it('rejects creation when listing is not ACTIVE', async () => {
      mockPrisma.mineral.findUnique.mockResolvedValue(testMineral);
      mockPrisma.listing.findUnique.mockResolvedValue({
        ...testListing,
        status: ListingStatus.PAUSED,
      });

      const inputWithListing = { ...validInput, listingId: 'listing-1' };

      await expect(
        service.createRfq(inputWithListing, 'buyer-org-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.rfq.create).not.toHaveBeenCalled();
    });
  });

  // ─── cancelRfq ───────────────────────────────────────────────────────────

  describe('cancelRfq', () => {
    it('cancels an OPEN RFQ owned by the buyer', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue(openRfq);
      mockPrisma.rfq.update.mockResolvedValue({
        ...openRfq,
        status: RfqStatus.CANCELLED,
      });

      const result = await service.cancelRfq('rfq-1', 'buyer-org-1', 'user-1');

      expect(result.status).toBe(RfqStatus.CANCELLED);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'rfq.cancelled',
          before: { status: RfqStatus.OPEN },
          after: { status: RfqStatus.CANCELLED },
        }),
      );
    });

    it('rejects cancellation when RFQ is not OPEN', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        ...openRfq,
        status: RfqStatus.QUOTED,
      });

      await expect(
        service.cancelRfq('rfq-1', 'buyer-org-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.rfq.update).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
    });

    it('rejects cancellation when caller is not the buyer', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue(openRfq);

      await expect(
        service.cancelRfq('rfq-1', 'other-org', 'user-1'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.rfq.update).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
    });
  });

  // ─── findByBuyer ─────────────────────────────────────────────────────────

  describe('findByBuyer', () => {
    it('returns only the buyer\'s RFQs', async () => {
      const buyerRfqs = [openRfq, { ...openRfq, id: 'rfq-2' }];
      mockPrisma.rfq.findMany.mockResolvedValue(buyerRfqs);

      const result = await service.findByBuyer('buyer-org-1');

      expect(result).toHaveLength(2);
      expect(mockPrisma.rfq.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { buyerOrgId: 'buyer-org-1' },
        }),
      );
    });

    it('filters by status when provided', async () => {
      mockPrisma.rfq.findMany.mockResolvedValue([openRfq]);

      await service.findByBuyer('buyer-org-1', RfqStatus.OPEN);

      expect(mockPrisma.rfq.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { buyerOrgId: 'buyer-org-1', status: RfqStatus.OPEN },
        }),
      );
    });
  });

  // ─── findSellerInbox ─────────────────────────────────────────────────────

  describe('findSellerInbox', () => {
    it('returns empty array when seller has no active listings', async () => {
      mockPrisma.listing.findMany.mockResolvedValue([]);

      const result = await service.findSellerInbox('seller-org-1');

      expect(result).toEqual([]);
      expect(mockPrisma.rfq.findMany).not.toHaveBeenCalled();
    });

    it('returns RFQs matching seller\'s active listings', async () => {
      mockPrisma.listing.findMany.mockResolvedValue([testListing]);
      mockPrisma.rfq.findMany.mockResolvedValue([openRfq]);

      const result = await service.findSellerInbox('seller-org-1');

      expect(result).toHaveLength(1);
      expect(mockPrisma.rfq.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { listingId: { in: ['listing-1'] } },
              { listingId: null, mineralId: { in: ['mineral-1'] } },
            ],
          }),
        }),
      );
    });
  });

  // ─── findById ────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns RFQ when caller is the buyer', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        ...openRfq,
        quotes: [],
      });

      const result = await service.findById('rfq-1', 'buyer-org-1');

      expect(result.id).toBe('rfq-1');
    });

    it('returns RFQ when caller is a seller with matching listings', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        ...openRfq,
        quotes: [],
      });
      mockPrisma.listing.findFirst.mockResolvedValue(testListing);

      const result = await service.findById('rfq-1', 'seller-org-1');

      expect(result.id).toBe('rfq-1');
    });

    it('rejects access when caller has no matching listings and is not buyer', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        ...openRfq,
        quotes: [],
      });
      mockPrisma.listing.findFirst.mockResolvedValue(null);

      await expect(
        service.findById('rfq-1', 'unrelated-org'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for non-existent RFQ', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue(null);

      await expect(
        service.findById('bad-rfq', 'buyer-org-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

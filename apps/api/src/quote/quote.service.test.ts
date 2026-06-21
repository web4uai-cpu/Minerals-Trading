import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { QuoteService } from './quote.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import {
  QuoteStatus,
  RfqStatus,
  DealStatus,
  OrgStatus,
  ListingStatus,
  MilestoneStatus,
} from '@prisma/client';

const mockPrisma = {
  rfq: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  organization: {
    findUnique: jest.fn(),
  },
  listing: {
    findFirst: jest.fn(),
  },
  quote: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  deal: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  dealMilestone: {
    createMany: jest.fn(),
  },
  $transaction: jest.fn(),
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

const testOrg = {
  id: 'seller-org-1',
  legalName: 'Test Seller Corp',
  status: OrgStatus.VERIFIED,
};

const testListing = {
  id: 'listing-1',
  sellerOrgId: 'seller-org-1',
  mineralId: 'mineral-1',
  status: ListingStatus.ACTIVE,
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

const sentQuote = {
  id: 'quote-1',
  rfqId: 'rfq-1',
  sellerOrgId: 'seller-org-1',
  pricePerUnitPaise: BigInt(585000),
  validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  terms: null,
  status: QuoteStatus.SENT,
  createdAt: new Date(),
  updatedAt: new Date(),
  rfq: openRfq,
  sellerOrg: { legalName: 'Test Seller Corp' },
};

const validInput = {
  rfqId: 'rfq-1',
  pricePerUnitPaise: 585000,
  validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

describe('QuoteService', () => {
  let service: QuoteService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuoteService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    service = module.get(QuoteService);
  });

  // ─── submitQuote ────────────────────────────────────────────────────────

  describe('submitQuote', () => {
    it('creates a quote with status SENT when all validations pass', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue(openRfq);
      mockPrisma.organization.findUnique.mockResolvedValue(testOrg);
      mockPrisma.listing.findFirst.mockResolvedValue(testListing);
      mockPrisma.quote.findFirst.mockResolvedValue(null);
      mockPrisma.quote.create.mockResolvedValue(sentQuote);
      mockPrisma.rfq.update.mockResolvedValue({
        ...openRfq,
        status: RfqStatus.QUOTED,
      });

      const result = await service.submitQuote(
        validInput,
        'seller-org-1',
        'user-1',
      );

      expect(result.status).toBe(QuoteStatus.SENT);
      expect(result.rfqId).toBe('rfq-1');
      expect(mockPrisma.quote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rfqId: 'rfq-1',
            sellerOrgId: 'seller-org-1',
            status: QuoteStatus.SENT,
          }),
        }),
      );
      expect(mockPrisma.rfq.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rfq-1' },
          data: { status: RfqStatus.QUOTED },
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'quote.submitted',
          entityType: 'Quote',
          entityId: 'quote-1',
        }),
      );
    });

    it('rejects when RFQ is not OPEN', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        ...openRfq,
        status: RfqStatus.CLOSED,
      });

      await expect(
        service.submitQuote(validInput, 'seller-org-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.quote.create).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
    });

    it('rejects when seller org is not VERIFIED', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue(openRfq);
      mockPrisma.organization.findUnique.mockResolvedValue({
        ...testOrg,
        status: OrgStatus.PENDING,
      });

      await expect(
        service.submitQuote(validInput, 'seller-org-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.quote.create).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
    });

    it('rejects duplicate quote from same seller', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue(openRfq);
      mockPrisma.organization.findUnique.mockResolvedValue(testOrg);
      mockPrisma.listing.findFirst.mockResolvedValue(testListing);
      mockPrisma.quote.findFirst.mockResolvedValue(sentQuote); // existing quote

      await expect(
        service.submitQuote(validInput, 'seller-org-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.quote.create).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
    });
  });

  // ─── acceptQuote ────────────────────────────────────────────────────────

  describe('acceptQuote', () => {
    it('atomically creates deal with 6 milestones on acceptance', async () => {
      mockPrisma.quote.findUnique.mockResolvedValue(sentQuote);

      const createdDeal = {
        id: 'deal-1',
        buyerOrgId: 'buyer-org-1',
        sellerOrgId: 'seller-org-1',
        quoteId: 'quote-1',
        mineralId: 'mineral-1',
        grade: { 'Fe%': 62 },
        quantity: 1000,
        unit: 'MT',
        totalValuePaise: BigInt(585000) * BigInt(1000),
        status: DealStatus.CREATED,
        createdAt: new Date(),
        updatedAt: new Date(),
        milestones: [
          { id: 'm-1', type: 'AGREEMENT', sequence: 1, status: MilestoneStatus.PENDING },
          { id: 'm-2', type: 'ESCROW', sequence: 2, status: MilestoneStatus.PENDING },
          { id: 'm-3', type: 'SAMPLING', sequence: 3, status: MilestoneStatus.PENDING },
          { id: 'm-4', type: 'DISPATCH', sequence: 4, status: MilestoneStatus.PENDING },
          { id: 'm-5', type: 'DELIVERY', sequence: 5, status: MilestoneStatus.PENDING },
          { id: 'm-6', type: 'PAYMENT', sequence: 6, status: MilestoneStatus.PENDING },
        ],
        buyerOrg: { legalName: 'Test Buyer Corp' },
        sellerOrg: { legalName: 'Test Seller Corp' },
        quote: sentQuote,
      };

      // Mock $transaction to execute the callback with a mock tx
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          quote: {
            update: jest.fn(),
            updateMany: jest.fn(),
          },
          rfq: {
            update: jest.fn(),
          },
          deal: {
            create: jest.fn().mockResolvedValue({ id: 'deal-1' }),
            findUnique: jest.fn().mockResolvedValue(createdDeal),
          },
          dealMilestone: {
            createMany: jest.fn(),
          },
        };
        return cb(tx);
      });

      const result = await service.acceptQuote(
        'quote-1',
        'buyer-org-1',
        'user-1',
      );

      expect(result.id).toBe('deal-1');
      expect(result.status).toBe(DealStatus.CREATED);
      expect(result.milestones).toHaveLength(6);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'quote.accepted',
          entityType: 'Quote',
          entityId: 'quote-1',
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deal.created',
          entityType: 'Deal',
          entityId: 'deal-1',
        }),
      );
    });

    it('rejects when quote has expired', async () => {
      const expiredQuote = {
        ...sentQuote,
        validUntil: new Date(Date.now() - 1000), // already expired
      };
      mockPrisma.quote.findUnique.mockResolvedValue(expiredQuote);

      await expect(
        service.acceptQuote('quote-1', 'buyer-org-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
    });

    it('rejects when caller is not the buyer', async () => {
      mockPrisma.quote.findUnique.mockResolvedValue(sentQuote);

      await expect(
        service.acceptQuote('quote-1', 'other-org', 'user-1'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
    });

    it('rejects other SENT quotes for same RFQ during acceptance', async () => {
      mockPrisma.quote.findUnique.mockResolvedValue(sentQuote);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let capturedTx: any;
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          quote: {
            update: jest.fn(),
            updateMany: jest.fn(),
          },
          rfq: {
            update: jest.fn(),
          },
          deal: {
            create: jest.fn().mockResolvedValue({ id: 'deal-1' }),
            findUnique: jest.fn().mockResolvedValue({
              id: 'deal-1',
              buyerOrgId: 'buyer-org-1',
              sellerOrgId: 'seller-org-1',
              status: DealStatus.CREATED,
              totalValuePaise: BigInt(585000000),
              milestones: [],
              buyerOrg: { legalName: 'Test Buyer Corp' },
              sellerOrg: { legalName: 'Test Seller Corp' },
              quote: sentQuote,
            }),
          },
          dealMilestone: {
            createMany: jest.fn(),
          },
        };
        capturedTx = tx;
        return cb(tx);
      });

      await service.acceptQuote('quote-1', 'buyer-org-1', 'user-1');

      // Verify other quotes were rejected
      expect(capturedTx!.quote.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            rfqId: 'rfq-1',
            id: { not: 'quote-1' },
            status: QuoteStatus.SENT,
          }),
          data: { status: QuoteStatus.REJECTED },
        }),
      );
    });
  });

  // ─── rejectQuote ────────────────────────────────────────────────────────

  describe('rejectQuote', () => {
    it('rejects a SENT quote', async () => {
      mockPrisma.quote.findUnique.mockResolvedValue({
        ...sentQuote,
        rfq: openRfq,
      });
      mockPrisma.quote.update.mockResolvedValue({
        ...sentQuote,
        status: QuoteStatus.REJECTED,
      });

      const result = await service.rejectQuote(
        'quote-1',
        'buyer-org-1',
        'user-1',
      );

      expect(result.status).toBe(QuoteStatus.REJECTED);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'quote.rejected',
          entityType: 'Quote',
          entityId: 'quote-1',
          before: { status: QuoteStatus.SENT },
          after: { status: QuoteStatus.REJECTED },
        }),
      );
    });

    it('rejects when quote is not in SENT status', async () => {
      mockPrisma.quote.findUnique.mockResolvedValue({
        ...sentQuote,
        status: QuoteStatus.ACCEPTED,
        rfq: openRfq,
      });

      await expect(
        service.rejectQuote('quote-1', 'buyer-org-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.quote.update).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
    });
  });
});

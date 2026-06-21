import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DealService } from './deal.service';
import { EscrowService } from './escrow/escrow.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import { AiService } from '../ai/ai.service';
import { DealStatus, MilestoneType, MilestoneStatus } from '@khanij/types';
import { OrgStatus } from '@prisma/client';
import { PRICE_FEED_PROVIDER } from '../providers/price-feed/price-feed-provider.interface';

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockPrisma = {
  deal: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  dealMilestone: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  mineral: {
    findUnique: jest.fn(),
  },
};

const mockAudit = { log: jest.fn() };
const mockLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

const mockEscrow = {
  holdFunds: jest.fn(),
  releaseFunds: jest.fn(),
  refundFunds: jest.fn(),
  getBalance: jest.fn(),
  getLedger: jest.fn(),
  isEscrowHeld: jest.fn(),
};

const mockAiService = {
  parseSearchIntent: jest.fn(),
  draftContract: jest.fn(),
};

const mockPriceFeed = {
  getReferencePrice: jest.fn(),
};

// ─── Test Data ─────────────────────────────────────────────────────────────

const baseDeal = {
  id: 'deal-1',
  buyerOrgId: 'buyer-org-1',
  sellerOrgId: 'seller-org-1',
  quoteId: 'quote-1',
  mineralId: 'mineral-1',
  grade: { 'Fe%': 62 },
  quantity: 1000,
  unit: 'MT',
  totalValuePaise: BigInt(585000000),
  status: DealStatus.CREATED,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const dealWithRelations = {
  ...baseDeal,
  milestones: [
    { id: 'm-1', dealId: 'deal-1', type: MilestoneType.AGREEMENT, sequence: 1, status: MilestoneStatus.PENDING },
    { id: 'm-2', dealId: 'deal-1', type: MilestoneType.ESCROW, sequence: 2, status: MilestoneStatus.PENDING },
    { id: 'm-3', dealId: 'deal-1', type: MilestoneType.SAMPLING, sequence: 3, status: MilestoneStatus.PENDING },
    { id: 'm-4', dealId: 'deal-1', type: MilestoneType.DISPATCH, sequence: 4, status: MilestoneStatus.PENDING },
    { id: 'm-5', dealId: 'deal-1', type: MilestoneType.DELIVERY, sequence: 5, status: MilestoneStatus.PENDING },
    { id: 'm-6', dealId: 'deal-1', type: MilestoneType.PAYMENT, sequence: 6, status: MilestoneStatus.PENDING },
  ],
  escrow: [],
  quote: { id: 'quote-1', pricePerUnitPaise: BigInt(585000) },
  buyerOrg: { legalName: 'Test Buyer Corp' },
  sellerOrg: { legalName: 'Test Seller Corp' },
};

const dealWithOrgStatus = {
  ...baseDeal,
  milestones: dealWithRelations.milestones,
  buyerOrg: { status: OrgStatus.VERIFIED },
  sellerOrg: { status: OrgStatus.VERIFIED },
};

// ─── Suite ─────────────────────────────────────────────────────────────────

describe('DealService', () => {
  let service: DealService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DealService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: LoggerService, useValue: mockLogger },
        { provide: EscrowService, useValue: mockEscrow },
        { provide: AiService, useValue: mockAiService },
        { provide: PRICE_FEED_PROVIDER, useValue: mockPriceFeed },
      ],
    }).compile();

    service = module.get(DealService);
  });

  // ─── findById ──────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns a deal for a valid participant (buyer)', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(dealWithRelations);

      const result = await service.findById('deal-1', 'buyer-org-1');

      expect(result.id).toBe('deal-1');
      expect(result.milestones).toHaveLength(6);
      expect(result.buyerOrg.legalName).toBe('Test Buyer Corp');
      expect(mockPrisma.deal.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'deal-1' } }),
      );
    });

    it('throws ForbiddenException for non-participant', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(dealWithRelations);

      await expect(
        service.findById('deal-1', 'other-org'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when deal does not exist', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(null);

      await expect(
        service.findById('nonexistent', 'buyer-org-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── transitionDeal ────────────────────────────────────────────────────

  describe('transitionDeal', () => {
    it('transitions CREATED -> AGREEMENT_DRAFT (happy path)', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(dealWithOrgStatus);
      mockEscrow.isEscrowHeld.mockResolvedValue(false);

      const updatedDeal = {
        ...dealWithRelations,
        status: DealStatus.AGREEMENT_DRAFT,
      };
      mockPrisma.deal.update.mockResolvedValue(updatedDeal);

      const result = await service.transitionDeal(
        'deal-1',
        DealStatus.AGREEMENT_DRAFT,
        'buyer-org-1',
        'user-1',
        '127.0.0.1',
      );

      expect(result.status).toBe(DealStatus.AGREEMENT_DRAFT);
      expect(mockPrisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'deal-1' },
          data: { status: DealStatus.AGREEMENT_DRAFT },
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deal.transitioned',
          entityType: 'Deal',
          entityId: 'deal-1',
          before: { status: DealStatus.CREATED },
          after: { status: DealStatus.AGREEMENT_DRAFT },
        }),
      );
    });

    it('throws BadRequestException for illegal transition (CREATED -> COMPLETED)', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(dealWithOrgStatus);
      mockEscrow.isEscrowHeld.mockResolvedValue(false);

      await expect(
        service.transitionDeal(
          'deal-1',
          DealStatus.COMPLETED,
          'buyer-org-1',
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.deal.update).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
    });

    it('requires both orgs VERIFIED for SIGNED transition', async () => {
      const dealUnverifiedBuyer = {
        ...baseDeal,
        status: DealStatus.AGREEMENT_DRAFT,
        milestones: dealWithRelations.milestones,
        buyerOrg: { status: OrgStatus.PENDING },
        sellerOrg: { status: OrgStatus.VERIFIED },
      };
      mockPrisma.deal.findUnique.mockResolvedValue(dealUnverifiedBuyer);
      mockEscrow.isEscrowHeld.mockResolvedValue(false);

      await expect(
        service.transitionDeal(
          'deal-1',
          DealStatus.SIGNED,
          'buyer-org-1',
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.deal.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException for non-participant', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(dealWithOrgStatus);

      await expect(
        service.transitionDeal(
          'deal-1',
          DealStatus.AGREEMENT_DRAFT,
          'other-org',
          'user-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── completeMilestone ─────────────────────────────────────────────────

  describe('completeMilestone', () => {
    it('marks a PENDING milestone as DONE', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(baseDeal);

      const pendingMilestone = {
        id: 'm-1',
        dealId: 'deal-1',
        type: MilestoneType.AGREEMENT,
        sequence: 1,
        status: MilestoneStatus.PENDING,
        completedAt: null,
      };
      mockPrisma.dealMilestone.findUnique.mockResolvedValue(pendingMilestone);

      const completedMilestone = {
        ...pendingMilestone,
        status: MilestoneStatus.DONE,
        completedAt: new Date(),
      };
      mockPrisma.dealMilestone.update.mockResolvedValue(completedMilestone);

      const result = await service.completeMilestone(
        'deal-1',
        MilestoneType.AGREEMENT,
        'buyer-org-1',
        'user-1',
        '127.0.0.1',
      );

      expect(result.status).toBe(MilestoneStatus.DONE);
      expect(mockPrisma.dealMilestone.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'm-1' },
          data: expect.objectContaining({
            status: MilestoneStatus.DONE,
          }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deal.milestone.completed',
          entityType: 'DealMilestone',
          entityId: 'm-1',
        }),
      );
    });

    it('throws BadRequestException if milestone is already DONE', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(baseDeal);
      mockPrisma.dealMilestone.findUnique.mockResolvedValue({
        id: 'm-1',
        dealId: 'deal-1',
        type: MilestoneType.AGREEMENT,
        sequence: 1,
        status: MilestoneStatus.DONE,
        completedAt: new Date(),
      });

      await expect(
        service.completeMilestone(
          'deal-1',
          MilestoneType.AGREEMENT,
          'buyer-org-1',
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.dealMilestone.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException for non-participant', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(baseDeal);

      await expect(
        service.completeMilestone(
          'deal-1',
          MilestoneType.AGREEMENT,
          'other-org',
          'user-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── holdEscrow ────────────────────────────────────────────────────────

  describe('holdEscrow', () => {
    it('holds escrow as buyer (happy path)', async () => {
      const escrowPendingDeal = {
        ...baseDeal,
        status: DealStatus.ESCROW_PENDING,
      };
      mockPrisma.deal.findUnique
        .mockResolvedValueOnce(escrowPendingDeal) // first call in holdEscrow
        .mockResolvedValueOnce({ ...dealWithRelations, status: DealStatus.ESCROW_PENDING }); // second call in findById

      mockEscrow.holdFunds.mockResolvedValue(undefined);
      mockEscrow.getBalance.mockResolvedValue(100000000n); // less than totalValuePaise
      mockEscrow.isEscrowHeld.mockResolvedValue(false);

      const result = await service.holdEscrow(
        'deal-1',
        100000000n,
        'buyer-org-1',
        'user-1',
        '127.0.0.1',
      );

      expect(mockEscrow.holdFunds).toHaveBeenCalledWith('deal-1', 100000000n, 'user-1');
      expect(result.id).toBe('deal-1');
    });

    it('auto-transitions to IN_FULFILMENT when escrow fully funded', async () => {
      const escrowPendingDeal = {
        ...baseDeal,
        status: DealStatus.ESCROW_PENDING,
        totalValuePaise: 585000000n,
      };
      mockPrisma.deal.findUnique
        .mockResolvedValueOnce(escrowPendingDeal) // first call in holdEscrow
        .mockResolvedValueOnce({ ...dealWithRelations, status: DealStatus.IN_FULFILMENT }); // second call in findById

      mockEscrow.holdFunds.mockResolvedValue(undefined);
      mockEscrow.getBalance.mockResolvedValue(585000000n); // equals totalValuePaise
      mockPrisma.deal.update.mockResolvedValue({
        ...dealWithRelations,
        status: DealStatus.IN_FULFILMENT,
      });
      mockEscrow.isEscrowHeld.mockResolvedValue(true);

      await service.holdEscrow(
        'deal-1',
        585000000n,
        'buyer-org-1',
        'user-1',
      );

      expect(mockPrisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'deal-1' },
          data: { status: DealStatus.IN_FULFILMENT },
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deal.transitioned',
          before: { status: DealStatus.ESCROW_PENDING },
          after: { status: DealStatus.IN_FULFILMENT },
        }),
      );
    });

    it('fails if caller is not the buyer', async () => {
      const escrowPendingDeal = {
        ...baseDeal,
        status: DealStatus.ESCROW_PENDING,
      };
      mockPrisma.deal.findUnique.mockResolvedValue(escrowPendingDeal);

      await expect(
        service.holdEscrow(
          'deal-1',
          100000000n,
          'seller-org-1', // seller trying to hold escrow
          'user-1',
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockEscrow.holdFunds).not.toHaveBeenCalled();
    });

    it('fails if deal is not in ESCROW_PENDING status', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(baseDeal); // status is CREATED

      await expect(
        service.holdEscrow(
          'deal-1',
          100000000n,
          'buyer-org-1',
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockEscrow.holdFunds).not.toHaveBeenCalled();
    });
  });

  // ─── getDealLedger ─────────────────────────────────────────────────────

  describe('getDealLedger', () => {
    it('returns ledger for valid participant', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(baseDeal);
      const ledgerEntries = [
        { id: 'e-1', dealId: 'deal-1', type: 'HELD', amountPaise: '100000000', txnRef: 'ref-1', note: null, createdAt: new Date() },
      ];
      mockEscrow.getLedger.mockResolvedValue(ledgerEntries);

      const result = await service.getDealLedger('deal-1', 'buyer-org-1');

      expect(result).toEqual(ledgerEntries);
      expect(mockEscrow.getLedger).toHaveBeenCalledWith('deal-1');
    });

    it('throws ForbiddenException for non-participant', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(baseDeal);

      await expect(
        service.getDealLedger('deal-1', 'other-org'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockEscrow.getLedger).not.toHaveBeenCalled();
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ArbitrationService } from './arbitration.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import { EscrowService } from '../deals/escrow/escrow.service';
import { DealStatus, DisputeStatus, DisputeCategory } from '@khanij/types';

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockPrisma = {
  deal: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  dispute: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  evidence: {
    create: jest.fn(),
  },
  award: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
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


// ─── Test Data ─────────────────────────────────────────────────────────────

const baseDeal = {
  id: 'deal-1',
  buyerOrgId: 'buyer-org-1',
  sellerOrgId: 'seller-org-1',
  status: DealStatus.IN_FULFILMENT,
  totalValuePaise: BigInt(585000000),
};

const baseDispute = {
  id: 'dispute-1',
  dealId: 'deal-1',
  filedByOrgId: 'buyer-org-1',
  filedByUserId: 'user-1',
  category: DisputeCategory.QUALITY,
  description: 'Iron ore quality below spec',
  status: DisputeStatus.FILED,
  deal: baseDeal,
};

// ─── Suite ─────────────────────────────────────────────────────────────────

describe('ArbitrationService', () => {
  let service: ArbitrationService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArbitrationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: LoggerService, useValue: mockLogger },
        { provide: EscrowService, useValue: mockEscrow },
      ],
    }).compile();

    service = module.get(ArbitrationService);
  });

  // ─── fileDispute ──────────────────────────────────────────────────────

  describe('fileDispute', () => {
    it('creates a dispute and transitions deal to DISPUTED (happy path)', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(baseDeal);

      const createdDispute = { ...baseDispute, id: 'dispute-new' };
      mockPrisma.$transaction.mockResolvedValue([
        createdDispute,
        { ...baseDeal, status: DealStatus.DISPUTED },
      ]);

      const result = await service.fileDispute(
        {
          dealId: 'deal-1',
          category: DisputeCategory.QUALITY,
          description: 'Iron ore quality below spec',
        },
        'buyer-org-1',
        'user-1',
        '127.0.0.1',
      );

      expect(result.id).toBe('dispute-new');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'dispute.filed',
          entityType: 'Dispute',
        }),
      );
    });

    it('rejects if caller is not a deal participant', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(baseDeal);

      await expect(
        service.fileDispute(
          {
            dealId: 'deal-1',
            category: DisputeCategory.QUALITY,
            description: 'Iron ore quality below spec',
          },
          'other-org',
          'user-1',
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects if deal is not in disputable status', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue({
        ...baseDeal,
        status: DealStatus.CREATED,
      });

      await expect(
        service.fileDispute(
          {
            dealId: 'deal-1',
            category: DisputeCategory.QUALITY,
            description: 'Iron ore quality below spec',
          },
          'buyer-org-1',
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── submitEvidence ───────────────────────────────────────────────────

  describe('submitEvidence', () => {
    it('creates evidence record (happy path)', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        ...baseDispute,
        status: DisputeStatus.UNDER_REVIEW,
      });

      const createdEvidence = {
        id: 'evidence-1',
        disputeId: 'dispute-1',
        type: 'document',
        title: 'Quality report',
      };
      mockPrisma.evidence.create.mockResolvedValue(createdEvidence);

      const result = await service.submitEvidence(
        {
          disputeId: 'dispute-1',
          type: 'document',
          title: 'Quality report',
        },
        'buyer-org-1',
        'user-1',
      );

      expect(result.id).toBe('evidence-1');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'dispute.evidence.submitted' }),
      );
    });

    it('rejects if dispute is CLOSED', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        ...baseDispute,
        status: DisputeStatus.CLOSED,
      });

      await expect(
        service.submitEvidence(
          {
            disputeId: 'dispute-1',
            type: 'document',
            title: 'Quality report',
          },
          'buyer-org-1',
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.evidence.create).not.toHaveBeenCalled();
    });
  });

  // ─── issueAward ──────────────────────────────────────────────────────

  describe('issueAward', () => {
    it('creates award, executes escrow, and transitions deal (happy path)', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        ...baseDispute,
        status: DisputeStatus.HEARING,
        evidence: [{ id: 'ev-1' }],
      });

      mockEscrow.getBalance.mockResolvedValue(585000000n);
      mockEscrow.releaseFunds.mockResolvedValue(undefined);

      const createdAward = {
        id: 'award-1',
        disputeId: 'dispute-1',
        arbitratorId: 'arb-org-1',
      };
      mockPrisma.$transaction.mockResolvedValue([
        createdAward,
        { ...baseDispute, status: DisputeStatus.AWARD_ISSUED },
      ]);
      mockPrisma.deal.update.mockResolvedValue({
        ...baseDeal,
        status: DealStatus.COMPLETED,
      });

      const result = await service.issueAward(
        {
          disputeId: 'dispute-1',
          ruling: 'Seller delivered conforming goods as per IS specifications',
          rationale: 'Evidence shows quality within acceptable tolerance range per contract',
          escrowAction: 'RELEASE_TO_SELLER',
        },
        'arb-org-1',
        'arb-user-1',
        '127.0.0.1',
      );

      expect(result.id).toBe('award-1');
      expect(mockEscrow.releaseFunds).toHaveBeenCalledWith('deal-1', 585000000n, 'arb-user-1');
      expect(mockPrisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: DealStatus.COMPLETED },
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'dispute.award.issued' }),
      );
    });

    it('rejects if dispute is not in HEARING status', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        ...baseDispute,
        status: DisputeStatus.FILED,
        evidence: [],
      });

      await expect(
        service.issueAward(
          {
            disputeId: 'dispute-1',
            ruling: 'Some ruling text for this test',
            rationale: 'Some rationale text for this test',
            escrowAction: 'RELEASE_TO_SELLER',
          },
          'arb-org-1',
          'arb-user-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ─── transitionDispute ────────────────────────────────────────────────

  describe('transitionDispute', () => {
    it('transitions FILED -> UNDER_REVIEW', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        ...baseDispute,
        status: DisputeStatus.FILED,
        evidence: [],
      });

      const updated = { ...baseDispute, status: DisputeStatus.UNDER_REVIEW };
      mockPrisma.dispute.update.mockResolvedValue(updated);

      const result = await service.transitionDispute(
        'dispute-1',
        DisputeStatus.UNDER_REVIEW,
        'admin-org',
        'admin-user',
      );

      expect(result.status).toBe(DisputeStatus.UNDER_REVIEW);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'dispute.transitioned',
          before: { status: DisputeStatus.FILED },
          after: { status: DisputeStatus.UNDER_REVIEW },
        }),
      );
    });

    it('rejects illegal transition FILED -> HEARING', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        ...baseDispute,
        status: DisputeStatus.FILED,
        evidence: [],
      });

      await expect(
        service.transitionDispute(
          'dispute-1',
          DisputeStatus.HEARING,
          'admin-org',
          'admin-user',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.dispute.update).not.toHaveBeenCalled();
    });
  });

  // ─── findByDeal ───────────────────────────────────────────────────────

  describe('findByDeal', () => {
    it('returns disputes for a deal the caller participates in', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(baseDeal);
      mockPrisma.dispute.findMany.mockResolvedValue([baseDispute]);

      const result = await service.findByDeal('deal-1', 'buyer-org-1');

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('dispute-1');
    });

    it('rejects non-participant access', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(baseDeal);

      await expect(
        service.findByDeal('deal-1', 'other-org'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

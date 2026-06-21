import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TradeService } from './trade.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import { TradeDirection } from '@khanij/types';

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockPrisma = {
  deal: { findUnique: jest.fn() },
  organization: { findUnique: jest.fn() },
  complianceItem: { findUnique: jest.fn() },
  tradeApplication: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

const mockAudit = { log: jest.fn() };
const mockLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

// ─── Test data ─────────────────────────────────────────────────────────────

const ORG_ID = 'org-seller-001';
const USER_ID = 'user-001';
const DEAL_ID = 'deal-001';
const APP_ID = 'app-001';

const baseDeal = {
  id: DEAL_ID,
  buyerOrgId: 'org-buyer-001',
  sellerOrgId: ORG_ID,
};

const baseOrg = {
  id: ORG_ID,
  type: 'EXPORTER',
  status: 'VERIFIED',
};

const verifiedIec = {
  orgId: ORG_ID,
  type: 'IEC',
  status: 'VERIFIED',
};

const baseInput = {
  dealId: DEAL_ID,
  direction: TradeDirection.EXPORT,
  destinationCountry: 'Japan',
  destinationCountryCode: 'JP',
  portOfLoading: 'Paradip',
  portOfDischarge: 'Osaka',
  mineralName: 'Manganese Ore',
  hsnCode: '26020000',
  quantityMt: 5000,
  valueFobPaise: 50000000,
  iecNumber: 'ABCDE12345',
};

const baseApplication = {
  id: APP_ID,
  ...baseInput,
  applicantOrgId: ORG_ID,
  clearanceStatus: 'PENDING',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Test suite ────────────────────────────────────────────────────────────

describe('TradeService', () => {
  let service: TradeService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<TradeService>(TradeService);
  });

  // ─── createApplication ─────────────────────────────────────────────────

  describe('createApplication', () => {
    it('should create a trade application for eligible org', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(baseDeal);
      mockPrisma.organization.findUnique.mockResolvedValue(baseOrg);
      mockPrisma.complianceItem.findUnique.mockResolvedValue(verifiedIec);
      mockPrisma.tradeApplication.create.mockResolvedValue(baseApplication);

      const result = await service.createApplication(baseInput, ORG_ID, USER_ID, '127.0.0.1');

      expect(result.id).toBe(APP_ID);
      expect(mockPrisma.tradeApplication.create).toHaveBeenCalledTimes(1);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: USER_ID,
          action: 'trade.application.created',
          entityType: 'TradeApplication',
        }),
      );
    });

    it('should reject when deal not found', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(null);

      await expect(
        service.createApplication(baseInput, ORG_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject when caller is not a deal participant', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(baseDeal);

      await expect(
        service.createApplication(baseInput, 'org-stranger', USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject when org is not verified', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(baseDeal);
      mockPrisma.organization.findUnique.mockResolvedValue({
        ...baseOrg,
        status: 'PENDING',
      });
      mockPrisma.complianceItem.findUnique.mockResolvedValue(verifiedIec);

      await expect(
        service.createApplication(baseInput, ORG_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when IEC is missing', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(baseDeal);
      mockPrisma.organization.findUnique.mockResolvedValue(baseOrg);
      mockPrisma.complianceItem.findUnique.mockResolvedValue(null);

      await expect(
        service.createApplication(baseInput, ORG_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when destination country is sanctioned', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(baseDeal);
      mockPrisma.organization.findUnique.mockResolvedValue(baseOrg);
      mockPrisma.complianceItem.findUnique.mockResolvedValue(verifiedIec);

      await expect(
        service.createApplication(
          { ...baseInput, destinationCountryCode: 'KP' },
          ORG_ID,
          USER_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── applyForClearance ─────────────────────────────────────────────────

  describe('applyForClearance', () => {
    it('should transition PENDING → APPLIED', async () => {
      mockPrisma.tradeApplication.findUnique.mockResolvedValue(baseApplication);
      mockPrisma.tradeApplication.update.mockResolvedValue({
        ...baseApplication,
        clearanceStatus: 'APPLIED',
      });

      const result = await service.applyForClearance(APP_ID, ORG_ID, USER_ID, '127.0.0.1');

      expect(result.clearanceStatus).toBe('APPLIED');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'trade.clearance.applied' }),
      );
    });

    it('should reject when not the applicant org', async () => {
      mockPrisma.tradeApplication.findUnique.mockResolvedValue(baseApplication);

      await expect(
        service.applyForClearance(APP_ID, 'org-stranger', USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject when status is not PENDING', async () => {
      mockPrisma.tradeApplication.findUnique.mockResolvedValue({
        ...baseApplication,
        clearanceStatus: 'APPLIED',
      });

      await expect(
        service.applyForClearance(APP_ID, ORG_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── approveClearance ──────────────────────────────────────────────────

  describe('approveClearance', () => {
    it('should transition APPLIED → APPROVED with validUntil', async () => {
      mockPrisma.tradeApplication.findUnique.mockResolvedValue({
        ...baseApplication,
        clearanceStatus: 'APPLIED',
      });
      mockPrisma.tradeApplication.update.mockResolvedValue({
        ...baseApplication,
        clearanceStatus: 'APPROVED',
        validUntil: new Date(),
      });

      const result = await service.approveClearance(APP_ID, USER_ID, '127.0.0.1');

      expect(result.clearanceStatus).toBe('APPROVED');
      expect(mockPrisma.tradeApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clearanceStatus: 'APPROVED',
            validUntil: expect.any(Date),
          }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'trade.clearance.approved' }),
      );
    });

    it('should reject when status is not APPLIED', async () => {
      mockPrisma.tradeApplication.findUnique.mockResolvedValue({
        ...baseApplication,
        clearanceStatus: 'PENDING',
      });

      await expect(
        service.approveClearance(APP_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── rejectClearance ───────────────────────────────────────────────────

  describe('rejectClearance', () => {
    it('should transition APPLIED → REJECTED with reason', async () => {
      mockPrisma.tradeApplication.findUnique.mockResolvedValue({
        ...baseApplication,
        clearanceStatus: 'APPLIED',
      });
      mockPrisma.tradeApplication.update.mockResolvedValue({
        ...baseApplication,
        clearanceStatus: 'REJECTED',
        rejectionReason: 'Incomplete documentation',
      });

      const result = await service.rejectClearance(APP_ID, 'Incomplete documentation', USER_ID, '127.0.0.1');

      expect(result.clearanceStatus).toBe('REJECTED');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'trade.clearance.rejected' }),
      );
    });

    it('should reject when status is not APPLIED', async () => {
      mockPrisma.tradeApplication.findUnique.mockResolvedValue(baseApplication);

      await expect(
        service.rejectClearance(APP_ID, 'reason', USER_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── findByDeal ────────────────────────────────────────────────────────

  describe('findByDeal', () => {
    it('should return applications for deal participant', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(baseDeal);
      mockPrisma.tradeApplication.findMany.mockResolvedValue([baseApplication]);

      const result = await service.findByDeal(DEAL_ID, ORG_ID);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(APP_ID);
    });

    it('should reject for non-participant', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(baseDeal);

      await expect(
        service.findByDeal(DEAL_ID, 'org-stranger'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject when deal not found', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(null);

      await expect(
        service.findByDeal(DEAL_ID, ORG_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findById ──────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should return application for deal participant', async () => {
      mockPrisma.tradeApplication.findUnique.mockResolvedValue({
        ...baseApplication,
        deal: baseDeal,
      });

      const result = await service.findById(APP_ID, ORG_ID);

      expect(result.id).toBe(APP_ID);
    });

    it('should reject for non-participant and non-applicant', async () => {
      mockPrisma.tradeApplication.findUnique.mockResolvedValue({
        ...baseApplication,
        deal: baseDeal,
      });

      await expect(
        service.findById(APP_ID, 'org-stranger'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject when not found', async () => {
      mockPrisma.tradeApplication.findUnique.mockResolvedValue(null);

      await expect(
        service.findById(APP_ID, ORG_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

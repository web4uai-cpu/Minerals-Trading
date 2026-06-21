import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import { FOREX_PROVIDER } from '../providers/forex/forex-provider.interface';
import { SettlementCurrency } from '@khanij/types';

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockPrisma = {
  tradeApplication: { findUnique: jest.fn() },
  crossBorderSettlement: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

const mockAudit = { log: jest.fn() };
const mockLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
const mockForex = {
  getQuote: jest.fn().mockResolvedValue({
    sourceCurrency: 'INR',
    targetCurrency: 'USD',
    rate: 0.012,
    validUntilMinutes: 15,
    source: 'sandbox',
    asOf: new Date(),
  }),
};

// ─── Test data ─────────────────────────────────────────────────────────────

const ORG_ID = 'org-seller-001';
const USER_ID = 'user-001';
const DEAL_ID = 'deal-001';
const TRADE_APP_ID = 'trade-app-001';
const SETTLEMENT_ID = 'settlement-001';

const baseDeal = {
  id: DEAL_ID,
  buyerOrgId: 'org-buyer-001',
  sellerOrgId: ORG_ID,
};

const baseTradeApp = {
  id: TRADE_APP_ID,
  dealId: DEAL_ID,
  applicantOrgId: ORG_ID,
  clearanceStatus: 'APPROVED',
  deal: baseDeal,
};

const baseInput = {
  tradeApplicationId: TRADE_APP_ID,
  dealId: DEAL_ID,
  sourceCurrency: SettlementCurrency.INR,
  targetCurrency: SettlementCurrency.USD,
  amountSourcePaise: 5_000_000_00,
  forexRateSnapshot: 0.012,
  bankSwiftCode: 'SBININBB',
  beneficiaryAccountRef: 'ACC-12345',
};

const baseSettlement = {
  id: SETTLEMENT_ID,
  ...baseInput,
  amountSourcePaise: BigInt(5_000_000_00),
  amountTargetPaise: BigInt(6_000_000),
  status: 'PENDING_FOREX',
  deal: baseDeal,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Test suite ────────────────────────────────────────────────────────────

describe('SettlementService', () => {
  let service: SettlementService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: LoggerService, useValue: mockLogger },
        { provide: FOREX_PROVIDER, useValue: mockForex },
      ],
    }).compile();

    service = module.get<SettlementService>(SettlementService);
  });

  // ─── createSettlement ──────────────────────────────────────────────────

  describe('createSettlement', () => {
    it('should create a settlement for approved trade application', async () => {
      mockPrisma.tradeApplication.findUnique.mockResolvedValue(baseTradeApp);
      mockPrisma.crossBorderSettlement.create.mockResolvedValue(baseSettlement);

      const result = await service.createSettlement(baseInput, ORG_ID, USER_ID, '127.0.0.1');

      expect(result.id).toBe(SETTLEMENT_ID);
      expect(mockPrisma.crossBorderSettlement.create).toHaveBeenCalledTimes(1);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'settlement.created' }),
      );
    });

    it('should reject when trade application not found', async () => {
      mockPrisma.tradeApplication.findUnique.mockResolvedValue(null);

      await expect(
        service.createSettlement(baseInput, ORG_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject when caller is not a deal participant', async () => {
      mockPrisma.tradeApplication.findUnique.mockResolvedValue(baseTradeApp);

      await expect(
        service.createSettlement(baseInput, 'org-stranger', USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject when clearance is not APPROVED', async () => {
      mockPrisma.tradeApplication.findUnique.mockResolvedValue({
        ...baseTradeApp,
        clearanceStatus: 'PENDING',
      });

      await expect(
        service.createSettlement(baseInput, ORG_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when same source and target currency', async () => {
      mockPrisma.tradeApplication.findUnique.mockResolvedValue(baseTradeApp);

      await expect(
        service.createSettlement(
          { ...baseInput, targetCurrency: SettlementCurrency.INR },
          ORG_ID,
          USER_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── lockForex ─────────────────────────────────────────────────────────

  describe('lockForex', () => {
    it('should transition PENDING_FOREX → FOREX_LOCKED', async () => {
      mockPrisma.crossBorderSettlement.findUnique.mockResolvedValue(baseSettlement);
      mockPrisma.crossBorderSettlement.update.mockResolvedValue({
        ...baseSettlement,
        status: 'FOREX_LOCKED',
        forexLockedAt: new Date(),
      });

      const result = await service.lockForex(SETTLEMENT_ID, ORG_ID, USER_ID, '127.0.0.1');

      expect(result.status).toBe('FOREX_LOCKED');
      expect(mockForex.getQuote).toHaveBeenCalledWith('INR', 'USD');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'settlement.forex_locked' }),
      );
    });

    it('should reject when status is not PENDING_FOREX', async () => {
      mockPrisma.crossBorderSettlement.findUnique.mockResolvedValue({
        ...baseSettlement,
        status: 'FOREX_LOCKED',
      });

      await expect(
        service.lockForex(SETTLEMENT_ID, ORG_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject for non-participant', async () => {
      mockPrisma.crossBorderSettlement.findUnique.mockResolvedValue(baseSettlement);

      await expect(
        service.lockForex(SETTLEMENT_ID, 'org-stranger', USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── initiatePayment ──────────────────────────────────────────────────

  describe('initiatePayment', () => {
    it('should transition FOREX_LOCKED → PAYMENT_INITIATED', async () => {
      const lockedSettlement = {
        ...baseSettlement,
        status: 'FOREX_LOCKED',
        forexLockedAt: new Date(),
      };
      mockPrisma.crossBorderSettlement.findUnique.mockResolvedValue(lockedSettlement);
      mockPrisma.crossBorderSettlement.update.mockResolvedValue({
        ...lockedSettlement,
        status: 'PAYMENT_INITIATED',
        paymentRef: 'PAY-123',
      });

      const result = await service.initiatePayment(SETTLEMENT_ID, ORG_ID, USER_ID, '127.0.0.1');

      expect(result.status).toBe('PAYMENT_INITIATED');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'settlement.payment_initiated' }),
      );
    });

    it('should reject when forex lock expired', async () => {
      const expiredLock = new Date();
      expiredLock.setMinutes(expiredLock.getMinutes() - 20);
      mockPrisma.crossBorderSettlement.findUnique.mockResolvedValue({
        ...baseSettlement,
        status: 'FOREX_LOCKED',
        forexLockedAt: expiredLock,
      });
      mockPrisma.crossBorderSettlement.update.mockResolvedValue({});

      await expect(
        service.initiatePayment(SETTLEMENT_ID, ORG_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when status is not FOREX_LOCKED', async () => {
      mockPrisma.crossBorderSettlement.findUnique.mockResolvedValue(baseSettlement);

      await expect(
        service.initiatePayment(SETTLEMENT_ID, ORG_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── confirmPayment ───────────────────────────────────────────────────

  describe('confirmPayment', () => {
    it('should transition PAYMENT_INITIATED → PAYMENT_CONFIRMED', async () => {
      mockPrisma.crossBorderSettlement.findUnique.mockResolvedValue({
        ...baseSettlement,
        status: 'PAYMENT_INITIATED',
      });
      mockPrisma.crossBorderSettlement.update.mockResolvedValue({
        ...baseSettlement,
        status: 'PAYMENT_CONFIRMED',
      });

      const result = await service.confirmPayment(SETTLEMENT_ID, USER_ID, '127.0.0.1');

      expect(result.status).toBe('PAYMENT_CONFIRMED');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'settlement.payment_confirmed' }),
      );
    });

    it('should reject when status is not PAYMENT_INITIATED', async () => {
      mockPrisma.crossBorderSettlement.findUnique.mockResolvedValue(baseSettlement);

      await expect(
        service.confirmPayment(SETTLEMENT_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── markSettled ──────────────────────────────────────────────────────

  describe('markSettled', () => {
    it('should transition PAYMENT_CONFIRMED → SETTLED', async () => {
      mockPrisma.crossBorderSettlement.findUnique.mockResolvedValue({
        ...baseSettlement,
        status: 'PAYMENT_CONFIRMED',
      });
      mockPrisma.crossBorderSettlement.update.mockResolvedValue({
        ...baseSettlement,
        status: 'SETTLED',
        settledAt: new Date(),
      });

      const result = await service.markSettled(SETTLEMENT_ID, USER_ID, '127.0.0.1');

      expect(result.status).toBe('SETTLED');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'settlement.settled' }),
      );
    });

    it('should reject when status is not PAYMENT_CONFIRMED', async () => {
      mockPrisma.crossBorderSettlement.findUnique.mockResolvedValue(baseSettlement);

      await expect(
        service.markSettled(SETTLEMENT_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when settlement not found', async () => {
      mockPrisma.crossBorderSettlement.findUnique.mockResolvedValue(null);

      await expect(
        service.markSettled(SETTLEMENT_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findByTradeApplication ────────────────────────────────────────────

  describe('findByTradeApplication', () => {
    it('should return settlements for deal participant', async () => {
      mockPrisma.tradeApplication.findUnique.mockResolvedValue(baseTradeApp);
      mockPrisma.crossBorderSettlement.findMany.mockResolvedValue([baseSettlement]);

      const result = await service.findByTradeApplication(TRADE_APP_ID, ORG_ID);

      expect(result).toHaveLength(1);
    });

    it('should reject for non-participant', async () => {
      mockPrisma.tradeApplication.findUnique.mockResolvedValue(baseTradeApp);

      await expect(
        service.findByTradeApplication(TRADE_APP_ID, 'org-stranger'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject when trade application not found', async () => {
      mockPrisma.tradeApplication.findUnique.mockResolvedValue(null);

      await expect(
        service.findByTradeApplication(TRADE_APP_ID, ORG_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

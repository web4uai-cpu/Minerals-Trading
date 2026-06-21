import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AiIntelligenceService, stripPii } from './ai-intelligence.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import { AiService } from '../ai/ai.service';
import { PRICE_FEED_PROVIDER } from '../providers/price-feed/price-feed-provider.interface';

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockPrisma = {
  mineral: { findUnique: jest.fn() },
  deal: {
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  dispute: { count: jest.fn() },
  organization: { findUnique: jest.fn() },
  complianceItem: { findUnique: jest.fn() },
};

const mockAudit = { log: jest.fn() };
const mockLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

const mockAiService = {
  advisePricing: jest.fn(),
  detectFraudSignals: jest.fn(),
  reviewComplianceDocument: jest.fn(),
};

const mockPriceFeed = {
  getReferencePrice: jest.fn(),
};

// ─── Test Setup ───────────────────────────────────────────────────────────

describe('AiIntelligenceService', () => {
  let service: AiIntelligenceService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiIntelligenceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: LoggerService, useValue: mockLogger },
        { provide: AiService, useValue: mockAiService },
        { provide: PRICE_FEED_PROVIDER, useValue: mockPriceFeed },
      ],
    }).compile();

    service = module.get(AiIntelligenceService);
  });

  // ─── advisePricing ──────────────────────────────────────────────────────

  describe('advisePricing', () => {
    const dto = {
      mineralId: 'mineral-1',
      grade: { 'Fe%': 62 },
      quantity: 1000,
      unit: 'MT' as const,
      proposedPricePaise: 585000,
    };

    it('calls AiService.advisePricing with correct context', async () => {
      mockPrisma.mineral.findUnique.mockResolvedValue({ id: 'mineral-1', name: 'Iron Ore' });
      mockPriceFeed.getReferencePrice.mockResolvedValue({
        fairLow: 550000,
        fairHigh: 600000,
        refPrice: 575000,
        source: 'sandbox',
        asOf: new Date('2024-01-01'),
      });
      mockPrisma.deal.findMany.mockResolvedValue([]);
      mockAiService.advisePricing.mockResolvedValue({
        assessment: 'FAIR',
        proposedPricePaise: 585000,
        fairLowPaise: 550000,
        fairHighPaise: 600000,
        refPricePaise: 575000,
        deviationPercent: 1.74,
        analysis: 'Price is within fair range.',
        recommendation: 'Proceed with the transaction.',
        disclaimer: 'AI-generated price analysis',
      });

      const result = await service.advisePricing(dto, 'user-1', 'org-1');

      expect(mockAiService.advisePricing).toHaveBeenCalledWith(
        expect.objectContaining({
          mineralName: 'Iron Ore',
          proposedPricePaise: 585000,
          fairPriceBand: expect.objectContaining({
            fairLow: 550000,
            fairHigh: 600000,
            refPrice: 575000,
          }),
        }),
      );
      expect(result).not.toBeNull();
      expect(result!.assessment).toBe('FAIR');
    });

    it('returns null when AI is unavailable', async () => {
      mockPrisma.mineral.findUnique.mockResolvedValue({ id: 'mineral-1', name: 'Iron Ore' });
      mockPriceFeed.getReferencePrice.mockResolvedValue({
        fairLow: 550000, fairHigh: 600000, refPrice: 575000,
        source: 'sandbox', asOf: new Date(),
      });
      mockPrisma.deal.findMany.mockResolvedValue([]);
      mockAiService.advisePricing.mockResolvedValue(null);

      const result = await service.advisePricing(dto, 'user-1', 'org-1');

      expect(result).toBeNull();
    });
  });

  // ─── detectFraudSignals ─────────────────────────────────────────────────

  describe('detectFraudSignals', () => {
    const dto = { orgId: 'org-suspect' };

    it('computes pattern flags correctly from org data', async () => {
      const orgCreatedAt = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000); // 15 days ago
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-suspect', type: 'SELLER', createdAt: orgCreatedAt,
      });
      mockPrisma.deal.count
        .mockResolvedValueOnce(15) // total deals
        .mockResolvedValueOnce(6);  // cancelled deals
      mockPrisma.deal.aggregate.mockResolvedValue({
        _sum: { totalValuePaise: BigInt(2000000000) },
      });
      mockPrisma.dispute.count.mockResolvedValue(3);

      mockAiService.detectFraudSignals.mockResolvedValue({
        riskLevel: 'HIGH',
        signals: [],
        overallAssessment: 'High risk detected.',
        recommendedActions: ['Investigate'],
        disclaimer: 'AI-generated.',
      });

      await service.detectFraudSignals(dto, 'admin-1', '127.0.0.1');

      // Verify the context passed to AI has correct pattern flags
      const callArg = mockAiService.detectFraudSignals.mock.calls[0][0];
      expect(callArg.patterns.velocitySpike).toBe(true);   // 15 deals in 15 days
      expect(callArg.patterns.highCancelRate).toBe(true);   // 6/15 = 40% > 30%
      expect(callArg.patterns.newOrgHighValue).toBe(true);  // <30 days, >10L paise

      // Verify audit log was written
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ai.fraud.check',
          entityType: 'Organization',
          entityId: 'org-suspect',
        }),
      );
    });

    it('uses orgId from dto to load org data', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-suspect', type: 'BUYER', createdAt: new Date(),
      });
      mockPrisma.deal.count.mockResolvedValue(0);
      mockPrisma.deal.aggregate.mockResolvedValue({ _sum: { totalValuePaise: null } });
      mockPrisma.dispute.count.mockResolvedValue(0);
      mockAiService.detectFraudSignals.mockResolvedValue(null);

      await service.detectFraudSignals(dto, 'admin-1');

      expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'org-suspect' },
      });
    });
  });

  // ─── reviewComplianceDocument ───────────────────────────────────────────

  describe('reviewComplianceDocument', () => {
    it('strips PII before sending to AI', async () => {
      mockPrisma.complianceItem.findUnique.mockResolvedValue({
        id: 'item-1',
        type: 'MINING_LEASE',
        documentRef: 's3://docs/lease.pdf',
        org: { legalName: 'Test Mining Co', state: 'Jharkhand' },
      });

      mockAiService.reviewComplianceDocument.mockResolvedValue({
        documentType: 'MINING_LEASE',
        completeness: 'COMPLETE',
        extractedFields: {},
        redFlags: [],
        recommendation: 'APPROVE',
        summary: 'Document is complete.',
        disclaimer: 'AI pre-screening.',
      });

      await service.reviewComplianceDocument({ complianceItemId: 'item-1' }, 'admin-1');

      // Verify the context passed to AI has sanitized text (no raw PII)
      const callArg = mockAiService.reviewComplianceDocument.mock.calls[0][0];
      expect(callArg.extractedText).not.toMatch(/\b\d{4}\s?\d{4}\s?\d{4}\b/);
      expect(callArg.documentType).toBe('MINING_LEASE');
      expect(callArg.orgLegalName).toBe('Test Mining Co');

      // Verify audit log
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ai.compliance.review',
          entityType: 'ComplianceItem',
          entityId: 'item-1',
        }),
      );
    });

    it('returns null when compliance item not found', async () => {
      mockPrisma.complianceItem.findUnique.mockResolvedValue(null);

      await expect(
        service.reviewComplianceDocument({ complianceItemId: 'nonexistent' }, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── stripPii utility ──────────────────────────────────────────────────

  describe('stripPii', () => {
    it('redacts Aadhaar numbers', () => {
      expect(stripPii('Aadhaar: 1234 5678 9012')).toContain('[AADHAAR_REDACTED]');
    });

    it('redacts PAN numbers', () => {
      expect(stripPii('PAN: ABCDE1234F')).toContain('[PAN_REDACTED]');
    });
  });
});

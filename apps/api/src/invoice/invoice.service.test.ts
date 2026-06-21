import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockPrisma = {
  deal: {
    findUnique: jest.fn(),
  },
  mineral: {
    findUnique: jest.fn(),
  },
  invoice: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

const mockAudit = { log: jest.fn() };
const mockLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

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
  status: 'COMPLETED',
  buyerOrg: { id: 'buyer-org-1', legalName: 'Test Buyer Corp', gstin: 'GSTIN-BUYER', state: 'Maharashtra' },
  sellerOrg: { id: 'seller-org-1', legalName: 'Test Seller Corp', gstin: 'GSTIN-SELLER', state: 'Odisha' },
  quote: { pricePerUnitPaise: BigInt(585000) },
};

const baseMineral = {
  id: 'mineral-1',
  name: 'Iron Ore Fines',
  category: 'Ferrous',
  hsnCode: '2601',
  defaultUnit: 'MT',
  gradeParams: {},
};

const baseInvoice = {
  id: 'inv-1',
  dealId: 'deal-1',
  invoiceNumber: 'KN-20260620-0001',
  status: 'DRAFT',
  sellerOrgId: 'seller-org-1',
  buyerOrgId: 'buyer-org-1',
  subtotalPaise: BigInt(585000000),
  igstPaise: BigInt(29250000),
  cgstPaise: BigInt(0),
  sgstPaise: BigInt(0),
  totalTaxPaise: BigInt(29250000),
  grandTotalPaise: BigInt(614250000),
  lineItems: [{ description: 'Iron Ore Fines', hsnCode: '2601', quantity: 1000, unit: 'MT', ratePerUnitPaise: '585000', amountPaise: '585000000' }],
  gstRate: 0.05,
  isInterstate: true,
  issuedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Suite ─────────────────────────────────────────────────────────────────

describe('InvoiceService', () => {
  let service: InvoiceService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    service = module.get(InvoiceService);
  });

  // ─── generateInvoice ──────────────────────────────────────────────────

  describe('generateInvoice', () => {
    it('creates a DRAFT invoice with GST breakdown (happy path)', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(baseDeal);
      mockPrisma.mineral.findUnique.mockResolvedValue(baseMineral);
      mockPrisma.invoice.findFirst.mockResolvedValue(null); // no prior invoices
      mockPrisma.invoice.create.mockResolvedValue(baseInvoice);

      const result = await service.generateInvoice('deal-1', 'user-1', '127.0.0.1');

      expect(result.invoiceNumber).toBe('KN-20260620-0001');
      expect(result.status).toBe('DRAFT');
      expect(result.dealId).toBe('deal-1');
      expect(result.isInterstate).toBe(true);

      expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dealId: 'deal-1',
            status: 'DRAFT',
            sellerOrgId: 'seller-org-1',
            buyerOrgId: 'buyer-org-1',
            isInterstate: true,
          }),
        }),
      );

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'invoice.generated',
          entityType: 'Invoice',
          entityId: 'inv-1',
        }),
      );
    });

    it('throws NotFoundException if deal does not exist', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(null);

      await expect(
        service.generateInvoice('nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
    });
  });

  // ─── issueInvoice ─────────────────────────────────────────────────────

  describe('issueInvoice', () => {
    it('transitions DRAFT to ISSUED (happy path)', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(baseInvoice);
      const issuedInvoice = {
        ...baseInvoice,
        status: 'ISSUED',
        issuedAt: new Date(),
      };
      mockPrisma.invoice.update.mockResolvedValue(issuedInvoice);

      const result = await service.issueInvoice('inv-1', 'seller-org-1', 'user-1', '127.0.0.1');

      expect(result.status).toBe('ISSUED');
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: expect.objectContaining({
            status: 'ISSUED',
          }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'invoice.issued',
          entityType: 'Invoice',
          entityId: 'inv-1',
          before: { status: 'DRAFT' },
          after: { status: 'ISSUED' },
        }),
      );
    });

    it('throws ForbiddenException if not seller', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(baseInvoice);

      await expect(
        service.issueInvoice('inv-1', 'buyer-org-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
    });
  });

  // ─── findByDeal ───────────────────────────────────────────────────────

  describe('findByDeal', () => {
    it('returns invoices for deal participants', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue({
        buyerOrgId: 'buyer-org-1',
        sellerOrgId: 'seller-org-1',
      });
      mockPrisma.invoice.findMany.mockResolvedValue([baseInvoice]);

      const result = await service.findByDeal('deal-1', 'buyer-org-1');

      expect(result).toHaveLength(1);
      expect(result[0].invoiceNumber).toBe('KN-20260620-0001');
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { dealId: 'deal-1' },
        }),
      );
    });

    it('throws ForbiddenException for non-participant', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue({
        buyerOrgId: 'buyer-org-1',
        sellerOrgId: 'seller-org-1',
      });

      await expect(
        service.findByDeal('deal-1', 'other-org'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.invoice.findMany).not.toHaveBeenCalled();
    });
  });
});

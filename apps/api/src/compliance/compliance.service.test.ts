import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import { StorageService } from '../providers/storage/storage.service';
import { ComplianceItemType } from '@khanij/types';
import { OrgStatus, OrgType } from '@prisma/client';

// Prisma compliance status as string literals (Prisma client not regenerated yet)
const PrismaStatus = {
  UPLOADED: 'UPLOADED',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  MISSING: 'MISSING',
  EXPIRED: 'EXPIRED',
  UNDER_REVIEW: 'UNDER_REVIEW',
} as const;

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockPrisma = {
  organization: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  complianceItem: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  complianceSnapshot: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
};

const mockAudit = { log: jest.fn() };
const mockLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
const mockStorage = { generatePresignedUploadUrl: jest.fn().mockResolvedValue('https://minio/presigned') };

const baseOrg = {
  id: 'org-1',
  type: OrgType.SELLER,
  status: OrgStatus.PENDING,
  legalName: 'Test Org',
  state: 'Rajasthan',
};

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('ComplianceService', () => {
  let service: ComplianceService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: LoggerService, useValue: mockLogger },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile();

    service = module.get(ComplianceService);
  });

  // ─── registerItem ──────────────────────────────────────────────────────

  describe('registerItem', () => {
    it('creates item when none exists (MISSING → UPLOADED)', async () => {
      mockPrisma.complianceItem.findUnique.mockResolvedValue(null);
      mockPrisma.complianceItem.upsert.mockResolvedValue({
        id: 'item-1',
        orgId: 'org-1',
        type: ComplianceItemType.PAN,
        status: PrismaStatus.UPLOADED,
      });
      mockPrisma.organization.findUnique.mockResolvedValue(baseOrg);
      mockPrisma.complianceItem.findMany.mockResolvedValue([]);
      mockPrisma.complianceSnapshot.create.mockResolvedValue({});

      const result = await service.registerItem(
        { type: ComplianceItemType.PAN, documentRef: 'compliance/org-1/PAN/uuid.pdf' },
        'org-1',
        'user-1',
      );

      expect(result.status).toBe(PrismaStatus.UPLOADED);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'compliance.item_uploaded' }),
      );
    });

    it('allows re-upload after rejection (REJECTED → UPLOADED)', async () => {
      mockPrisma.complianceItem.findUnique.mockResolvedValue({
        id: 'item-1',
        status: PrismaStatus.REJECTED,
        type: ComplianceItemType.PAN,
      });
      mockPrisma.complianceItem.upsert.mockResolvedValue({
        id: 'item-1',
        status: PrismaStatus.UPLOADED,
      });
      mockPrisma.organization.findUnique.mockResolvedValue(baseOrg);
      mockPrisma.complianceItem.findMany.mockResolvedValue([]);
      mockPrisma.complianceSnapshot.create.mockResolvedValue({});

      await expect(
        service.registerItem(
          { type: ComplianceItemType.PAN, documentRef: 'compliance/org-1/PAN/uuid2.pdf' },
          'org-1',
          'user-1',
        ),
      ).resolves.toBeDefined();
    });

    it('allows re-upload after expiry (EXPIRED → UPLOADED)', async () => {
      mockPrisma.complianceItem.findUnique.mockResolvedValue({
        id: 'item-1',
        status: PrismaStatus.EXPIRED,
        type: ComplianceItemType.PAN,
      });
      mockPrisma.complianceItem.upsert.mockResolvedValue({ id: 'item-1', status: PrismaStatus.UPLOADED });
      mockPrisma.organization.findUnique.mockResolvedValue(baseOrg);
      mockPrisma.complianceItem.findMany.mockResolvedValue([]);
      mockPrisma.complianceSnapshot.create.mockResolvedValue({});

      await expect(
        service.registerItem(
          { type: ComplianceItemType.PAN, documentRef: 'compliance/org-1/PAN/uuid3.pdf' },
          'org-1',
          'user-1',
        ),
      ).resolves.toBeDefined();
    });

    it('rejects illegal transition MISSING → VERIFIED', async () => {
      // Simulate MISSING status (no item exists) trying to go to VERIFIED directly
      // This is triggered indirectly — verifyItem should be used, not registerItem.
      // registerItem always targets UPLOADED, so this tests the state machine logic directly.
      mockPrisma.complianceItem.findUnique.mockResolvedValue({
        id: 'item-1',
        status: PrismaStatus.VERIFIED, // attempt to re-upload a verified item would be VERIFIED→UPLOADED
        type: ComplianceItemType.PAN,
      });

      // VERIFIED → UPLOADED is not allowed per the state machine
      await expect(
        service.registerItem(
          { type: ComplianceItemType.PAN, documentRef: 'compliance/org-1/PAN/uuid4.pdf' },
          'org-1',
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── verifyItem ────────────────────────────────────────────────────────

  describe('verifyItem', () => {
    const uploadedItem = {
      id: 'item-1',
      orgId: 'org-1',
      type: ComplianceItemType.PAN,
      status: PrismaStatus.UNDER_REVIEW, // state machine: UNDER_REVIEW → VERIFIED|REJECTED
      validFrom: null,
      validUntil: null,
      org: baseOrg,
    };

    it('verifies an UNDER_REVIEW item successfully', async () => {
      mockPrisma.complianceItem.findUnique.mockResolvedValue(uploadedItem);
      mockPrisma.complianceItem.update.mockResolvedValue({
        ...uploadedItem,
        status: PrismaStatus.VERIFIED,
        verifiedBy: 'admin-1',
        verifiedAt: new Date(),
        rejectionNote: null,
      });
      mockPrisma.organization.findUnique.mockResolvedValue(baseOrg);
      mockPrisma.complianceItem.findMany.mockResolvedValue([]);
      mockPrisma.complianceSnapshot.create.mockResolvedValue({});
      mockPrisma.complianceItem.count.mockResolvedValue(0); // not all verified yet

      const result = await service.verifyItem('item-1', { status: 'VERIFIED' }, 'admin-1');

      expect(result.status).toBe(PrismaStatus.VERIFIED);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'compliance.item_verified' }),
      );
    });

    it('rejects an item and requires a rejection note', async () => {
      mockPrisma.complianceItem.findUnique.mockResolvedValue(uploadedItem);

      await expect(
        service.verifyItem('item-1', { status: 'REJECTED' }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects with a note successfully', async () => {
      mockPrisma.complianceItem.findUnique.mockResolvedValue(uploadedItem);
      mockPrisma.complianceItem.update.mockResolvedValue({
        ...uploadedItem,
        status: PrismaStatus.REJECTED,
        rejectionNote: 'Document is blurry',
      });
      mockPrisma.organization.findUnique.mockResolvedValue(baseOrg);
      mockPrisma.complianceItem.findMany.mockResolvedValue([]);
      mockPrisma.complianceSnapshot.create.mockResolvedValue({});

      const result = await service.verifyItem(
        'item-1',
        { status: 'REJECTED', rejectionNote: 'Document is blurry' },
        'admin-1',
      );

      expect(result.status).toBe(PrismaStatus.REJECTED);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'compliance.item_rejected' }),
      );
    });

    it('throws NotFoundException for unknown item', async () => {
      mockPrisma.complianceItem.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyItem('bad-id', { status: 'VERIFIED' }, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws on illegal transition (MISSING → VERIFIED)', async () => {
      mockPrisma.complianceItem.findUnique.mockResolvedValue({
        ...uploadedItem,
        status: PrismaStatus.MISSING,
      });

      await expect(
        service.verifyItem('item-1', { status: 'VERIFIED' }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('auto-verifies org when all required items are verified', async () => {
      const REQUIRED_SELLER_COUNT = 8; // SELLER has 8 required items

      mockPrisma.complianceItem.findUnique.mockResolvedValue(uploadedItem);
      mockPrisma.complianceItem.update.mockResolvedValue({
        ...uploadedItem,
        status: PrismaStatus.VERIFIED,
        verifiedBy: 'admin-1',
        verifiedAt: new Date(),
        rejectionNote: null,
      });
      mockPrisma.organization.findUnique.mockResolvedValue(baseOrg);
      mockPrisma.complianceItem.findMany.mockResolvedValue([]);
      mockPrisma.complianceSnapshot.create.mockResolvedValue({});
      // All required items are now verified
      mockPrisma.complianceItem.count.mockResolvedValue(REQUIRED_SELLER_COUNT);
      mockPrisma.organization.update.mockResolvedValue({ ...baseOrg, status: OrgStatus.VERIFIED });

      await service.verifyItem('item-1', { status: 'VERIFIED' }, 'admin-1');

      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: OrgStatus.VERIFIED },
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'compliance.org_verified' }),
      );
    });
  });

  // ─── runExpirySweep ────────────────────────────────────────────────────

  describe('runExpirySweep', () => {
    it('returns empty array when no items to expire', async () => {
      mockPrisma.complianceItem.findMany.mockResolvedValue([]);

      const result = await service.runExpirySweep();
      expect(result).toEqual([]);
      expect(mockPrisma.complianceItem.updateMany).not.toHaveBeenCalled();
    });

    it('expires items and recomputes TrustScore for affected orgs', async () => {
      const expiredItems = [
        { id: 'item-1', orgId: 'org-1', type: ComplianceItemType.MINING_LEASE },
        { id: 'item-2', orgId: 'org-1', type: ComplianceItemType.ENV_CLEARANCE },
        { id: 'item-3', orgId: 'org-2', type: ComplianceItemType.PAN },
      ];

      mockPrisma.complianceItem.findMany
        .mockResolvedValueOnce(expiredItems) // sweep query
        .mockResolvedValue([]); // recompute queries
      mockPrisma.complianceItem.updateMany.mockResolvedValue({ count: 3 });
      mockPrisma.organization.findUnique
        .mockResolvedValueOnce(baseOrg) // org-1
        .mockResolvedValueOnce({ ...baseOrg, id: 'org-2' }); // org-2
      mockPrisma.complianceSnapshot.create.mockResolvedValue({});

      const result = await service.runExpirySweep();

      expect(result).toEqual(['org-1', 'org-2']);
      expect(mockPrisma.complianceItem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: PrismaStatus.EXPIRED },
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledTimes(3); // one per expired item
    });
  });

  // ─── getProfile ────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('throws NotFoundException for unknown org', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      mockPrisma.complianceItem.findMany.mockResolvedValue([]);
      mockPrisma.complianceSnapshot.findMany.mockResolvedValue([]);

      await expect(service.getProfile('bad-org')).rejects.toThrow(NotFoundException);
    });

    it('returns profile with score and breakdown', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(baseOrg);
      mockPrisma.complianceItem.findMany.mockResolvedValue([]);
      mockPrisma.complianceSnapshot.findMany.mockResolvedValue([]);

      const result = await service.getProfile('org-1');

      expect(result.orgId).toBe('org-1');
      expect(result.trustScore).toBe(0); // no items
      expect(result.breakdown).toBeDefined();
      expect(result.items).toEqual([]);
      expect(result.history).toEqual([]);
    });
  });
});

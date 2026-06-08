import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import { SearchService } from '../providers/search/search.service';
import { ListingStatus, OrgStatus } from '@prisma/client';

const mockPrisma = {
  mineral: {
    findUnique: jest.fn(),
  },
  listing: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  complianceSnapshot: {
    findFirst: jest.fn(),
  },
};

const mockAudit = { log: jest.fn() };
const mockLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
const mockSearch = { indexListing: jest.fn(), removeListing: jest.fn() };


const testMineral = {
  id: 'mineral-1',
  name: 'Iron Ore',
  category: 'Metallic',
  hsnCode: '2601.11',
  defaultUnit: 'MT',
  gradeParams: { 'Fe%': { min: 0, max: 100 } },
};

const draftListing = {
  id: 'listing-1',
  sellerOrgId: 'org-1',
  mineralId: 'mineral-1',
  grade: { 'Fe%': 62 },
  quantityAvailable: 5000,
  unit: 'MT',
  askPriceInPaise: BigInt(585000),
  location: { district: 'Keonjhar', state: 'Odisha' },
  dispatchLeadDays: 7,
  status: ListingStatus.DRAFT,
  createdAt: new Date(),
  updatedAt: new Date(),
  mineral: testMineral,
  sellerOrg: { legalName: 'Test Mining Co', status: OrgStatus.VERIFIED },
};

describe('ListingsService', () => {
  let service: ListingsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: LoggerService, useValue: mockLogger },
        { provide: SearchService, useValue: mockSearch },
      ],
    }).compile();

    service = module.get(ListingsService);
  });

  describe('create', () => {
    it('creates a listing in DRAFT status', async () => {
      mockPrisma.mineral.findUnique.mockResolvedValue(testMineral);
      mockPrisma.listing.create.mockResolvedValue(draftListing);

      const result = await service.create(
        {
          mineralId: 'mineral-1',
          grade: { 'Fe%': 62 },
          quantityAvailable: 5000,
          unit: 'MT',
          askPriceInPaise: 585000,
          location: { district: 'Keonjhar', state: 'Odisha' },
          dispatchLeadDays: 7,
        },
        'org-1',
        'user-1',
      );

      expect(result.status).toBe(ListingStatus.DRAFT);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'listing.created' }),
      );
    });

    it('rejects creation for invalid mineral', async () => {
      mockPrisma.mineral.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          {
            mineralId: 'bad-mineral',
            grade: { 'Fe%': 62 },
            quantityAvailable: 5000,
            unit: 'MT',
            askPriceInPaise: 585000,
            location: { district: 'Keonjhar', state: 'Odisha' },
            dispatchLeadDays: 7,
          },
          'org-1',
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('activate', () => {
    it('activates a DRAFT listing when org is VERIFIED', async () => {
      mockPrisma.listing.findUnique.mockResolvedValue({
        ...draftListing,
        sellerOrg: { legalName: 'Test Mining Co', status: OrgStatus.VERIFIED, state: 'Odisha' },
      });
      mockPrisma.listing.update.mockResolvedValue({
        ...draftListing,
        status: ListingStatus.ACTIVE,
      });
      mockPrisma.complianceSnapshot.findFirst.mockResolvedValue({ trustScore: 85 });

      const result = await service.activate('listing-1', 'org-1', 'user-1');

      expect(result.status).toBe(ListingStatus.ACTIVE);
      expect(mockSearch.indexListing).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'listing.activated' }),
      );
    });

    it('REJECTS activation when org is NOT VERIFIED', async () => {
      mockPrisma.listing.findUnique.mockResolvedValue({
        ...draftListing,
        sellerOrg: { legalName: 'Test Mining Co', status: OrgStatus.PENDING, state: 'Odisha' },
      });

      await expect(
        service.activate('listing-1', 'org-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);

      expect(mockSearch.indexListing).not.toHaveBeenCalled();
    });

    it('rejects activation by non-owner', async () => {
      mockPrisma.listing.findUnique.mockResolvedValue({
        ...draftListing,
        sellerOrgId: 'org-OTHER',
        sellerOrg: { legalName: 'Other Co', status: OrgStatus.VERIFIED, state: 'Odisha' },
      });

      await expect(
        service.activate('listing-1', 'org-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects illegal transition SOLD_OUT → ACTIVE', async () => {
      mockPrisma.listing.findUnique.mockResolvedValue({
        ...draftListing,
        status: ListingStatus.SOLD_OUT,
        sellerOrg: { legalName: 'Test Mining Co', status: OrgStatus.VERIFIED, state: 'Odisha' },
      });

      await expect(
        service.activate('listing-1', 'org-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('pause', () => {
    it('pauses an ACTIVE listing and removes from ES', async () => {
      mockPrisma.listing.findUnique.mockResolvedValue({
        ...draftListing,
        status: ListingStatus.ACTIVE,
      });
      mockPrisma.listing.update.mockResolvedValue({
        ...draftListing,
        status: ListingStatus.PAUSED,
      });

      await service.pause('listing-1', 'org-1', 'user-1');

      expect(mockSearch.removeListing).toHaveBeenCalledWith('listing-1');
    });
  });

  describe('markSoldOut', () => {
    it('marks listing as SOLD_OUT and removes from ES', async () => {
      mockPrisma.listing.findUnique.mockResolvedValue({
        ...draftListing,
        status: ListingStatus.ACTIVE,
      });
      mockPrisma.listing.update.mockResolvedValue({
        ...draftListing,
        status: ListingStatus.SOLD_OUT,
      });

      await service.markSoldOut('listing-1', 'org-1', 'user-1');

      expect(mockSearch.removeListing).toHaveBeenCalledWith('listing-1');
    });

    it('rejects SOLD_OUT → SOLD_OUT (terminal state)', async () => {
      mockPrisma.listing.findUnique.mockResolvedValue({
        ...draftListing,
        status: ListingStatus.SOLD_OUT,
      });

      await expect(
        service.markSoldOut('listing-1', 'org-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

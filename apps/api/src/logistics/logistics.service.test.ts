import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { LogisticsService } from './logistics.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import {
  DealStatus,
  ShipmentStatus,
  MilestoneType,
  MilestoneStatus,
} from '@khanij/types';

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockPrisma = {
  deal: {
    findUnique: jest.fn(),
  },
  shipment: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  trackingEvent: {
    create: jest.fn(),
  },
  dealMilestone: {
    findUnique: jest.fn(),
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
  status: DealStatus.IN_FULFILMENT,
  totalValuePaise: BigInt(585000000),
};

const baseShipment = {
  id: 'ship-1',
  dealId: 'deal-1',
  sellerOrgId: 'seller-org-1',
  buyerOrgId: 'buyer-org-1',
  carrierName: 'ABC Transport',
  vehicleNumber: 'MH-12-AB-1234',
  driverName: 'Ramesh',
  driverPhone: '+919876543210',
  originDistrict: 'Sindhudurg',
  originState: 'Maharashtra',
  destinationDistrict: 'Bellary',
  destinationState: 'Karnataka',
  estimatedDeliveryDate: new Date('2026-07-01'),
  weightAtOriginKg: 50000,
  weightAtDestinationKg: null,
  status: ShipmentStatus.CREATED,
  dispatchedAt: null,
  deliveredAt: null,
  confirmedAt: null,
  confirmedByUserId: null,
  receivedByName: null,
  receivedByPhone: null,
  proofDocumentRef: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  trackingEvents: [],
};

const dispatchMilestone = {
  id: 'ms-dispatch-1',
  dealId: 'deal-1',
  type: MilestoneType.DISPATCH,
  sequence: 4,
  status: MilestoneStatus.PENDING,
};

const deliveryMilestone = {
  id: 'ms-delivery-1',
  dealId: 'deal-1',
  type: MilestoneType.DELIVERY,
  sequence: 5,
  status: MilestoneStatus.PENDING,
};

const createInput = {
  dealId: 'deal-1',
  carrierName: 'ABC Transport',
  vehicleNumber: 'MH-12-AB-1234',
  driverName: 'Ramesh',
  driverPhone: '+919876543210',
  originDistrict: 'Sindhudurg',
  originState: 'Maharashtra',
  destinationDistrict: 'Bellary',
  destinationState: 'Karnataka',
  estimatedDeliveryDate: '2026-07-01T00:00:00.000Z',
  weightAtOriginKg: 50000,
};

// ─── Suite ─────────────────────────────────────────────────────────────────

describe('LogisticsService', () => {
  let service: LogisticsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogisticsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    service = module.get(LogisticsService);
  });

  // ─── createShipment ───────────────────────────────────────────────────

  describe('createShipment', () => {
    it('creates a shipment for a valid seller and IN_FULFILMENT deal', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(baseDeal);
      mockPrisma.shipment.create.mockResolvedValue({ ...baseShipment });

      const result = await service.createShipment(
        createInput,
        'seller-org-1',
        'user-1',
        '127.0.0.1',
      );

      expect(result.id).toBe('ship-1');
      expect(mockPrisma.shipment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dealId: 'deal-1',
            sellerOrgId: 'seller-org-1',
            buyerOrgId: 'buyer-org-1',
            status: ShipmentStatus.CREATED,
          }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'shipment.created' }),
      );
    });

    it('rejects if caller is not the seller of the deal', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(baseDeal);

      await expect(
        service.createShipment(createInput, 'other-org', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects if deal is not IN_FULFILMENT', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue({
        ...baseDeal,
        status: DealStatus.CREATED,
      });

      await expect(
        service.createShipment(createInput, 'seller-org-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── dispatchShipment ─────────────────────────────────────────────────

  describe('dispatchShipment', () => {
    it('dispatches shipment and auto-completes DISPATCH milestone', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue({ ...baseShipment });
      mockPrisma.shipment.update.mockResolvedValue({
        ...baseShipment,
        status: ShipmentStatus.DISPATCHED,
        dispatchedAt: new Date(),
      });
      mockPrisma.dealMilestone.findUnique.mockResolvedValue(dispatchMilestone);
      mockPrisma.dealMilestone.update.mockResolvedValue({
        ...dispatchMilestone,
        status: MilestoneStatus.DONE,
      });

      const result = await service.dispatchShipment(
        'ship-1',
        'seller-org-1',
        'user-1',
        '127.0.0.1',
      );

      expect(result.status).toBe(ShipmentStatus.DISPATCHED);
      expect(mockPrisma.dealMilestone.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: MilestoneStatus.DONE }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'shipment.dispatched' }),
      );
    });

    it('rejects illegal transition (e.g. CONFIRMED → DISPATCHED)', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue({
        ...baseShipment,
        status: ShipmentStatus.CONFIRMED,
      });

      await expect(
        service.dispatchShipment('ship-1', 'seller-org-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── confirmDelivery ──────────────────────────────────────────────────

  describe('confirmDelivery', () => {
    const confirmInput = {
      shipmentId: 'ship-1',
      weightAtDestinationKg: 49800,
      receivedByName: 'Suresh Kumar',
      receivedByPhone: '+919876543211',
      proofDocumentRef: 's3://proofs/pod-001.pdf',
    };

    it('confirms delivery and auto-completes DELIVERY milestone', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue({
        ...baseShipment,
        status: ShipmentStatus.DELIVERED,
        deliveredAt: new Date(),
      });
      mockPrisma.shipment.update.mockResolvedValue({
        ...baseShipment,
        status: ShipmentStatus.CONFIRMED,
        weightAtDestinationKg: 49800,
        confirmedAt: new Date(),
        trackingEvents: [],
      });
      mockPrisma.dealMilestone.findUnique.mockResolvedValue(deliveryMilestone);
      mockPrisma.dealMilestone.update.mockResolvedValue({
        ...deliveryMilestone,
        status: MilestoneStatus.DONE,
      });

      const result = await service.confirmDelivery(
        confirmInput,
        'buyer-org-1',
        'user-2',
        '127.0.0.1',
      );

      expect(result.status).toBe(ShipmentStatus.CONFIRMED);
      expect(mockPrisma.dealMilestone.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: MilestoneStatus.DONE }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'shipment.confirmed' }),
      );
    });

    it('rejects if caller is not the buyer', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue({
        ...baseShipment,
        status: ShipmentStatus.DELIVERED,
      });

      await expect(
        service.confirmDelivery(confirmInput, 'seller-org-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('includes weight verification result in audit when origin weight exists', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue({
        ...baseShipment,
        status: ShipmentStatus.DELIVERED,
        weightAtOriginKg: 50000,
      });
      mockPrisma.shipment.update.mockResolvedValue({
        ...baseShipment,
        status: ShipmentStatus.CONFIRMED,
        trackingEvents: [],
      });
      mockPrisma.dealMilestone.findUnique.mockResolvedValue(deliveryMilestone);
      mockPrisma.dealMilestone.update.mockResolvedValue({
        ...deliveryMilestone,
        status: MilestoneStatus.DONE,
      });

      await service.confirmDelivery(confirmInput, 'buyer-org-1', 'user-2');

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'shipment.confirmed',
          after: expect.objectContaining({
            weightVerification: expect.objectContaining({
              originKg: 50000,
              destinationKg: 49800,
              passed: expect.any(Boolean),
            }),
          }),
        }),
      );
    });
  });

  // ─── cancelShipment ───────────────────────────────────────────────────

  describe('cancelShipment', () => {
    it('cancels a shipment in CREATED status', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue({ ...baseShipment });
      mockPrisma.shipment.update.mockResolvedValue({
        ...baseShipment,
        status: ShipmentStatus.CANCELLED,
        trackingEvents: [],
      });

      const result = await service.cancelShipment(
        'ship-1',
        'seller-org-1',
        'user-1',
        '127.0.0.1',
      );

      expect(result.status).toBe(ShipmentStatus.CANCELLED);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'shipment.cancelled' }),
      );
    });
  });

  // ─── findByDeal ───────────────────────────────────────────────────────

  describe('findByDeal', () => {
    it('returns shipments with tracking events for a deal participant', async () => {
      mockPrisma.deal.findUnique.mockResolvedValue(baseDeal);
      mockPrisma.shipment.findMany.mockResolvedValue([
        { ...baseShipment, trackingEvents: [] },
      ]);

      const result = await service.findByDeal('deal-1', 'buyer-org-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ship-1');
      expect(mockPrisma.shipment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { dealId: 'deal-1' },
          include: expect.objectContaining({ trackingEvents: expect.any(Object) }),
        }),
      );
    });
  });
});

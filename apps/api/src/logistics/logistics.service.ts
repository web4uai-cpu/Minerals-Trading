import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import {
  CreateShipmentInput,
  AddTrackingEventInput,
  ConfirmDeliveryInput,
  DealStatus,
  MilestoneType,
  MilestoneStatus,
  ShipmentStatus,
  TrackingEventType,
} from '@khanij/types';
import {
  validateShipmentTransition,
  verifyWeight,
  buildTrackingTimeline,
} from '@khanij/logistics';

@Injectable()
export class LogisticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly logger: LoggerService,
  ) {}

  // ─── Create Shipment ──────────────────────────────────────────────────────

  async createShipment(
    input: CreateShipmentInput,
    sellerOrgId: string,
    userId: string,
    ip?: string,
  ) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: input.dealId },
    });

    if (!deal) {
      throw new NotFoundException({ code: 'DEAL_NOT_FOUND', message: 'Deal not found' });
    }

    if (deal.sellerOrgId !== sellerOrgId) {
      throw new ForbiddenException({
        code: 'NOT_SELLER',
        message: 'Only the seller of the deal can create a shipment',
      });
    }

    if (deal.status !== DealStatus.IN_FULFILMENT) {
      throw new BadRequestException({
        code: 'DEAL_NOT_IN_FULFILMENT',
        message: `Cannot create shipment for deal in ${deal.status} status — deal must be IN_FULFILMENT`,
      });
    }

    const shipment = await this.prisma.shipment.create({
      data: {
        dealId: input.dealId,
        sellerOrgId,
        buyerOrgId: deal.buyerOrgId,
        carrierName: input.carrierName,
        vehicleNumber: input.vehicleNumber,
        driverName: input.driverName ?? null,
        driverPhone: input.driverPhone ?? null,
        originDistrict: input.originDistrict,
        originState: input.originState,
        destinationDistrict: input.destinationDistrict,
        destinationState: input.destinationState,
        estimatedDeliveryDate: new Date(input.estimatedDeliveryDate),
        weightAtOriginKg: input.weightAtOriginKg ?? null,
        status: ShipmentStatus.CREATED,
      },
      include: { trackingEvents: true },
    });

    await this.audit.log({
      actor: userId,
      actorOrgId: sellerOrgId,
      action: 'shipment.created',
      entityType: 'Shipment',
      entityId: shipment.id,
      after: { dealId: input.dealId, status: ShipmentStatus.CREATED },
      ip,
    });

    this.logger.log(
      `Shipment created id=${shipment.id} deal=${input.dealId} seller=${sellerOrgId}`,
      'LogisticsService',
    );
    return this.serialize(shipment);
  }

  // ─── Dispatch Shipment ────────────────────────────────────────────────────

  async dispatchShipment(
    shipmentId: string,
    orgId: string,
    userId: string,
    ip?: string,
  ) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      throw new NotFoundException({ code: 'SHIPMENT_NOT_FOUND', message: 'Shipment not found' });
    }

    if (shipment.sellerOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'NOT_SELLER',
        message: 'Only the seller can dispatch a shipment',
      });
    }

    const result = validateShipmentTransition(
      shipment.status as ShipmentStatus,
      ShipmentStatus.DISPATCHED,
    );
    if (!result.valid) {
      throw new BadRequestException({ code: result.code, message: result.message });
    }

    const updated = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: ShipmentStatus.DISPATCHED,
        dispatchedAt: new Date(),
      },
      include: { trackingEvents: true },
    });

    // Auto-complete DISPATCH milestone
    await this.autoCompleteMilestone(shipment.dealId, MilestoneType.DISPATCH, userId, orgId, ip);

    await this.audit.log({
      actor: userId,
      actorOrgId: orgId,
      action: 'shipment.dispatched',
      entityType: 'Shipment',
      entityId: shipmentId,
      before: { status: shipment.status },
      after: { status: ShipmentStatus.DISPATCHED },
      ip,
    });

    this.logger.log(
      `Shipment dispatched id=${shipmentId} deal=${shipment.dealId} by=${userId}`,
      'LogisticsService',
    );
    return this.serialize(updated);
  }

  // ─── Add Tracking Event ───────────────────────────────────────────────────

  async addTrackingEvent(
    input: AddTrackingEventInput,
    orgId: string,
    userId: string,
    ip?: string,
  ) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: input.shipmentId },
    });

    if (!shipment) {
      throw new NotFoundException({ code: 'SHIPMENT_NOT_FOUND', message: 'Shipment not found' });
    }

    if (shipment.sellerOrgId !== orgId && shipment.buyerOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'SHIPMENT_ACCESS_DENIED',
        message: 'Only the buyer or seller can add tracking events',
      });
    }

    const status = shipment.status as ShipmentStatus;
    if (status === ShipmentStatus.CONFIRMED || status === ShipmentStatus.CANCELLED) {
      throw new BadRequestException({
        code: 'SHIPMENT_TERMINAL_STATE',
        message: `Cannot add tracking events to shipment in ${status} status`,
      });
    }

    // If event type is DELIVERED, auto-transition shipment
    if (input.eventType === TrackingEventType.DELIVERED) {
      const transitionResult = validateShipmentTransition(status, ShipmentStatus.DELIVERED);
      if (!transitionResult.valid) {
        throw new BadRequestException({
          code: transitionResult.code,
          message: transitionResult.message,
        });
      }

      await this.prisma.shipment.update({
        where: { id: input.shipmentId },
        data: {
          status: ShipmentStatus.DELIVERED,
          deliveredAt: new Date(),
        },
      });
    }

    const trackingEvent = await this.prisma.trackingEvent.create({
      data: {
        shipmentId: input.shipmentId,
        eventType: input.eventType,
        location: input.location,
        notes: input.notes ?? null,
        weightKg: input.weightKg ?? null,
        recordedBy: userId,
      },
    });

    await this.audit.log({
      actor: userId,
      actorOrgId: orgId,
      action: 'shipment.tracking.added',
      entityType: 'TrackingEvent',
      entityId: trackingEvent.id,
      after: { shipmentId: input.shipmentId, eventType: input.eventType },
      ip,
    });

    this.logger.log(
      `Tracking event added shipment=${input.shipmentId} type=${input.eventType} by=${userId}`,
      'LogisticsService',
    );
    return this.serialize(trackingEvent);
  }

  // ─── Confirm Delivery ─────────────────────────────────────────────────────

  async confirmDelivery(
    input: ConfirmDeliveryInput,
    buyerOrgId: string,
    userId: string,
    ip?: string,
  ) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: input.shipmentId },
    });

    if (!shipment) {
      throw new NotFoundException({ code: 'SHIPMENT_NOT_FOUND', message: 'Shipment not found' });
    }

    if (shipment.buyerOrgId !== buyerOrgId) {
      throw new ForbiddenException({
        code: 'NOT_BUYER',
        message: 'Only the buyer can confirm delivery',
      });
    }

    const result = validateShipmentTransition(
      shipment.status as ShipmentStatus,
      ShipmentStatus.CONFIRMED,
      { hasWeightAtDestination: true },
    );
    if (!result.valid) {
      throw new BadRequestException({ code: result.code, message: result.message });
    }

    const updated = await this.prisma.shipment.update({
      where: { id: input.shipmentId },
      data: {
        status: ShipmentStatus.CONFIRMED,
        weightAtDestinationKg: input.weightAtDestinationKg,
        receivedByName: input.receivedByName,
        receivedByPhone: input.receivedByPhone ?? null,
        proofDocumentRef: input.proofDocumentRef ?? null,
        confirmedAt: new Date(),
        confirmedByUserId: userId,
      },
      include: { trackingEvents: true },
    });

    // Weight verification (if origin weight exists)
    let weightVerification = null;
    if (shipment.weightAtOriginKg) {
      weightVerification = verifyWeight({
        weightAtOriginKg: shipment.weightAtOriginKg,
        weightAtDestinationKg: input.weightAtDestinationKg,
        tolerancePercent: 2,
      });
    }

    // Auto-complete DELIVERY milestone
    await this.autoCompleteMilestone(shipment.dealId, MilestoneType.DELIVERY, userId, buyerOrgId, ip);

    await this.audit.log({
      actor: userId,
      actorOrgId: buyerOrgId,
      action: 'shipment.confirmed',
      entityType: 'Shipment',
      entityId: input.shipmentId,
      before: { status: ShipmentStatus.DELIVERED },
      after: {
        status: ShipmentStatus.CONFIRMED,
        weightAtDestinationKg: input.weightAtDestinationKg,
        weightVerification,
      },
      ip,
    });

    this.logger.log(
      `Shipment confirmed id=${input.shipmentId} deal=${shipment.dealId} by=${userId}`,
      'LogisticsService',
    );
    return this.serialize(updated);
  }

  // ─── Find by Deal ─────────────────────────────────────────────────────────

  async findByDeal(dealId: string, orgId: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
    });

    if (!deal) {
      throw new NotFoundException({ code: 'DEAL_NOT_FOUND', message: 'Deal not found' });
    }

    if (deal.buyerOrgId !== orgId && deal.sellerOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'DEAL_ACCESS_DENIED',
        message: 'You do not have access to this deal',
      });
    }

    const shipments = await this.prisma.shipment.findMany({
      where: { dealId },
      include: { trackingEvents: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    return shipments.map(this.serialize);
  }

  // ─── Find by ID ───────────────────────────────────────────────────────────

  async findById(shipmentId: string, orgId: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { trackingEvents: { orderBy: { createdAt: 'asc' } } },
    });

    if (!shipment) {
      throw new NotFoundException({ code: 'SHIPMENT_NOT_FOUND', message: 'Shipment not found' });
    }

    if (shipment.sellerOrgId !== orgId && shipment.buyerOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'SHIPMENT_ACCESS_DENIED',
        message: 'You do not have access to this shipment',
      });
    }

    const timeline = buildTrackingTimeline(
      shipment.trackingEvents.map((e) => ({
        eventType: e.eventType as unknown as import('@khanij/types').TrackingEventType,
        location: e.location,
        createdAt: e.createdAt,
        notes: e.notes ?? undefined,
      })),
      shipment.status as ShipmentStatus,
      shipment.estimatedDeliveryDate,
    );
    timeline.shipmentId = shipment.id;

    return {
      ...this.serialize(shipment),
      timeline,
    };
  }

  // ─── Cancel Shipment ──────────────────────────────────────────────────────

  async cancelShipment(
    shipmentId: string,
    orgId: string,
    userId: string,
    ip?: string,
  ) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      throw new NotFoundException({ code: 'SHIPMENT_NOT_FOUND', message: 'Shipment not found' });
    }

    if (shipment.sellerOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'NOT_SELLER',
        message: 'Only the seller can cancel a shipment',
      });
    }

    const result = validateShipmentTransition(
      shipment.status as ShipmentStatus,
      ShipmentStatus.CANCELLED,
    );
    if (!result.valid) {
      throw new BadRequestException({ code: result.code, message: result.message });
    }

    const updated = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: ShipmentStatus.CANCELLED },
      include: { trackingEvents: true },
    });

    await this.audit.log({
      actor: userId,
      actorOrgId: orgId,
      action: 'shipment.cancelled',
      entityType: 'Shipment',
      entityId: shipmentId,
      before: { status: shipment.status },
      after: { status: ShipmentStatus.CANCELLED },
      ip,
    });

    this.logger.log(
      `Shipment cancelled id=${shipmentId} deal=${shipment.dealId} by=${userId}`,
      'LogisticsService',
    );
    return this.serialize(updated);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async autoCompleteMilestone(
    dealId: string,
    type: MilestoneType,
    userId: string,
    orgId: string,
    ip?: string,
  ) {
    const milestone = await this.prisma.dealMilestone.findUnique({
      where: { dealId_type: { dealId, type } },
    });

    if (milestone && milestone.status !== MilestoneStatus.DONE) {
      await this.prisma.dealMilestone.update({
        where: { id: milestone.id },
        data: {
          status: MilestoneStatus.DONE,
          completedAt: new Date(),
        },
      });

      await this.audit.log({
        actor: userId,
        actorOrgId: orgId,
        action: 'deal.milestone.completed',
        entityType: 'DealMilestone',
        entityId: milestone.id,
        before: { status: milestone.status },
        after: { status: MilestoneStatus.DONE, type },
        ip,
      });

      this.logger.log(
        `Milestone auto-completed deal=${dealId} type=${type} by=logistics`,
        'LogisticsService',
      );
    }
  }

  /** Serialize for JSON response (BigInt → string, Decimal → number). */
  private serialize(record: Record<string, unknown>) {
    return JSON.parse(
      JSON.stringify(record, (_key, value) => {
        if (typeof value === 'bigint') return value.toString();
        if (value && typeof value === 'object' && 'toNumber' in value) {
          return (value as { toNumber: () => number }).toNumber();
        }
        return value;
      }),
    );
  }
}

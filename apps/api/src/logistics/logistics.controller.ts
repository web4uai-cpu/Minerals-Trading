import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { LogisticsService } from './logistics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { UserRole } from '@prisma/client';
import {
  CreateShipmentSchema,
  CreateShipmentInput,
  AddTrackingEventSchema,
  AddTrackingEventInput,
  ConfirmDeliverySchema,
  ConfirmDeliveryInput,
  JwtPayload,
} from '@khanij/types';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class LogisticsController {
  constructor(private readonly logisticsService: LogisticsService) {}

  /** POST /api/v1/shipments — create a shipment (SELLER only). */
  @Post('shipments')
  @Roles(UserRole.SELLER)
  async create(
    @Body(new ZodValidationPipe(CreateShipmentSchema)) dto: CreateShipmentInput,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.logisticsService.createShipment(dto, user.orgId, user.sub, req.ip);
  }

  /** PATCH /api/v1/shipments/:id/dispatch — dispatch a shipment (SELLER only). */
  @Patch('shipments/:id/dispatch')
  @Roles(UserRole.SELLER)
  async dispatch(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.logisticsService.dispatchShipment(id, user.orgId, user.sub, req.ip);
  }

  /** POST /api/v1/shipments/:id/tracking — add tracking event (BUYER or SELLER). */
  @Post('shipments/:id/tracking')
  @Roles(UserRole.BUYER, UserRole.SELLER)
  async addTracking(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AddTrackingEventSchema)) dto: AddTrackingEventInput,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    // Override shipmentId from URL param for safety
    const input: AddTrackingEventInput = { ...dto, shipmentId: id };
    return this.logisticsService.addTrackingEvent(input, user.orgId, user.sub, req.ip);
  }

  /** PATCH /api/v1/shipments/:id/confirm-delivery — confirm delivery (BUYER only). */
  @Patch('shipments/:id/confirm-delivery')
  @Roles(UserRole.BUYER)
  async confirmDelivery(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ConfirmDeliverySchema)) dto: ConfirmDeliveryInput,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const input: ConfirmDeliveryInput = { ...dto, shipmentId: id };
    return this.logisticsService.confirmDelivery(input, user.orgId, user.sub, req.ip);
  }

  /** GET /api/v1/deals/:dealId/shipments — list shipments for a deal (BUYER or SELLER). */
  @Get('deals/:dealId/shipments')
  @Roles(UserRole.BUYER, UserRole.SELLER)
  async findByDeal(
    @Param('dealId') dealId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.logisticsService.findByDeal(dealId, user.orgId);
  }

  /** GET /api/v1/shipments/:id — get shipment detail (BUYER or SELLER). */
  @Get('shipments/:id')
  @Roles(UserRole.BUYER, UserRole.SELLER)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.logisticsService.findById(id, user.orgId);
  }

  /** PATCH /api/v1/shipments/:id/cancel — cancel a shipment (SELLER only). */
  @Patch('shipments/:id/cancel')
  @Roles(UserRole.SELLER)
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.logisticsService.cancelShipment(id, user.orgId, user.sub, req.ip);
  }
}

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
import { SettlementService } from './settlement.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { UserRole } from '@prisma/client';
import {
  CreateCrossBorderSettlementSchema,
  CreateCrossBorderSettlementInput,
  JwtPayload,
} from '@khanij/types';

@Controller('api/v1/settlements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Post()
  @Roles(UserRole.SELLER, UserRole.BUYER)
  async create(
    @Body(new ZodValidationPipe(CreateCrossBorderSettlementSchema))
    dto: CreateCrossBorderSettlementInput,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.settlementService.createSettlement(dto, user.orgId, user.sub, req.ip);
  }

  @Patch(':id/lock-forex')
  @Roles(UserRole.SELLER, UserRole.BUYER)
  async lockForex(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.settlementService.lockForex(id, user.orgId, user.sub, req.ip);
  }

  @Patch(':id/initiate-payment')
  @Roles(UserRole.SELLER, UserRole.BUYER)
  async initiatePayment(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.settlementService.initiatePayment(id, user.orgId, user.sub, req.ip);
  }

  @Patch(':id/confirm')
  @Roles(UserRole.ADMIN)
  async confirmPayment(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.settlementService.confirmPayment(id, user.sub, req.ip);
  }

  @Patch(':id/settle')
  @Roles(UserRole.ADMIN)
  async markSettled(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.settlementService.markSettled(id, user.sub, req.ip);
  }
}

@Controller('api/v1/trade/applications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TradeApplicationSettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Get(':tradeAppId/settlements')
  @Roles(UserRole.BUYER, UserRole.SELLER)
  async findByTradeApplication(
    @Param('tradeAppId') tradeAppId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.settlementService.findByTradeApplication(tradeAppId, user.orgId);
  }
}

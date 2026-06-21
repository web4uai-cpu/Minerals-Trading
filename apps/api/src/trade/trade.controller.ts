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
import { TradeService } from './trade.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { UserRole } from '@prisma/client';
import {
  CreateTradeApplicationSchema,
  CreateTradeApplicationInput,
  JwtPayload,
} from '@khanij/types';
import { z } from 'zod';

const RejectReasonSchema = z.object({
  reason: z.string().min(1).max(2000),
});

@Controller('api/v1/trade')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TradeController {
  constructor(private readonly tradeService: TradeService) {}

  /** POST /api/v1/trade/applications — create a trade application. */
  @Post('applications')
  @Roles(UserRole.SELLER, UserRole.BUYER)
  async create(
    @Body(new ZodValidationPipe(CreateTradeApplicationSchema))
    dto: CreateTradeApplicationInput,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.tradeService.createApplication(dto, user.orgId, user.sub, req.ip);
  }

  /** PATCH /api/v1/trade/applications/:id/apply — apply for clearance. */
  @Patch('applications/:id/apply')
  @Roles(UserRole.SELLER, UserRole.BUYER)
  async applyForClearance(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.tradeService.applyForClearance(id, user.orgId, user.sub, req.ip);
  }

  /** PATCH /api/v1/trade/applications/:id/approve — ADMIN approves clearance. */
  @Patch('applications/:id/approve')
  @Roles(UserRole.ADMIN)
  async approveClearance(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.tradeService.approveClearance(id, user.sub, req.ip);
  }

  /** PATCH /api/v1/trade/applications/:id/reject — ADMIN rejects clearance. */
  @Patch('applications/:id/reject')
  @Roles(UserRole.ADMIN)
  async rejectClearance(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RejectReasonSchema))
    dto: { reason: string },
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.tradeService.rejectClearance(id, dto.reason, user.sub, req.ip);
  }

  /** GET /api/v1/trade/applications/:id — single application detail. */
  @Get('applications/:id')
  @Roles(UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tradeService.findById(id, user.orgId);
  }
}

@Controller('api/v1/deals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DealTradeController {
  constructor(private readonly tradeService: TradeService) {}

  /** GET /api/v1/deals/:dealId/trade-applications — list applications for a deal. */
  @Get(':dealId/trade-applications')
  @Roles(UserRole.BUYER, UserRole.SELLER)
  async findByDeal(
    @Param('dealId') dealId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tradeService.findByDeal(dealId, user.orgId);
  }
}

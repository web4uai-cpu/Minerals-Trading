import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Req,
  Headers,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { RfqService } from './rfq.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { UserRole, RfqStatus } from '@prisma/client';
import { CreateRfqSchema, CreateRfqInput, JwtPayload } from '@khanij/types';

@Controller('rfqs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RfqController {
  constructor(private readonly rfqService: RfqService) {}

  /** POST /rfqs — create a new RFQ (BUYER only). */
  @Post()
  @Roles(UserRole.BUYER)
  async create(
    @Body(new ZodValidationPipe(CreateRfqSchema)) dto: CreateRfqInput,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.rfqService.createRfq(dto, user.orgId, user.sub, req.ip, idempotencyKey);
  }

  /** GET /rfqs/mine — buyer's sent RFQs. */
  @Get('mine')
  @Roles(UserRole.BUYER)
  async findMine(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: RfqStatus,
  ) {
    return this.rfqService.findByBuyer(user.orgId, status);
  }

  /** GET /rfqs/inbox — seller's incoming RFQs for their active listings/minerals. */
  @Get('inbox')
  @Roles(UserRole.SELLER)
  async findInbox(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: RfqStatus,
  ) {
    return this.rfqService.findSellerInbox(user.orgId, status);
  }

  /** GET /rfqs/:id — single RFQ detail (buyer or seller with matching listings). */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rfqService.findById(id, user.orgId);
  }

  /** PATCH /rfqs/:id/cancel — cancel an OPEN RFQ (BUYER only). */
  @Patch(':id/cancel')
  @Roles(UserRole.BUYER)
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.rfqService.cancelRfq(id, user.orgId, user.sub, req.ip);
  }
}

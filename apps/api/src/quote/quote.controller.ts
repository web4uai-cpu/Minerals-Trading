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
import { QuoteService } from './quote.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { UserRole } from '@prisma/client';
import { CreateQuoteSchema, CreateQuoteInput, JwtPayload } from '@khanij/types';

@Controller('quotes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteController {
  constructor(private readonly quoteService: QuoteService) {}

  /** POST /quotes — submit a quote for an RFQ (SELLER only). */
  @Post()
  @Roles(UserRole.SELLER)
  async submit(
    @Body(new ZodValidationPipe(CreateQuoteSchema)) dto: CreateQuoteInput,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.quoteService.submitQuote(dto, user.orgId, user.sub, req.ip);
  }

  /** GET /quotes/by-rfq/:rfqId — quotes for an RFQ (BUYER sees all, SELLER sees own). */
  @Get('by-rfq/:rfqId')
  async findByRfq(
    @Param('rfqId') rfqId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.quoteService.findByRfq(rfqId, user.orgId);
  }

  /** GET /quotes/:id — single quote detail (BUYER of RFQ or SELLER who submitted). */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.quoteService.findById(id, user.orgId);
  }

  /** PATCH /quotes/:id/accept — accept a quote (BUYER only). */
  @Patch(':id/accept')
  @Roles(UserRole.BUYER)
  async accept(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.quoteService.acceptQuote(id, user.orgId, user.sub, req.ip);
  }

  /** PATCH /quotes/:id/reject — reject a quote (BUYER only). */
  @Patch(':id/reject')
  @Roles(UserRole.BUYER)
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.quoteService.rejectQuote(id, user.orgId, user.sub, req.ip);
  }
}

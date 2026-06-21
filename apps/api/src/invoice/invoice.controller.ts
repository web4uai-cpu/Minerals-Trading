import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { InvoiceService } from './invoice.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { JwtPayload } from '@khanij/types';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  /** POST /api/v1/deals/:dealId/invoices — generate invoice for a deal (SELLER only). */
  @Post('deals/:dealId/invoices')
  @Roles(UserRole.SELLER)
  async generate(
    @Param('dealId') dealId: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.invoiceService.generateInvoice(dealId, user.sub, req.ip);
  }

  /** PATCH /api/v1/invoices/:id/issue — issue a DRAFT invoice (SELLER only). */
  @Patch('invoices/:id/issue')
  @Roles(UserRole.SELLER)
  async issue(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.invoiceService.issueInvoice(id, user.orgId, user.sub, req.ip);
  }

  /** GET /api/v1/deals/:dealId/invoices — list invoices for a deal (BUYER or SELLER). */
  @Get('deals/:dealId/invoices')
  @Roles(UserRole.BUYER, UserRole.SELLER)
  async findByDeal(
    @Param('dealId') dealId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.invoiceService.findByDeal(dealId, user.orgId);
  }

  /** GET /api/v1/invoices/:id — single invoice detail (BUYER or SELLER). */
  @Get('invoices/:id')
  @Roles(UserRole.BUYER, UserRole.SELLER)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.invoiceService.findById(id, user.orgId);
  }
}

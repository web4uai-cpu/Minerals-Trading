import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { DealService } from './deal.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { DealStatus, MilestoneType, JwtPayload } from '@khanij/types';

@Controller('deals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DealController {
  constructor(private readonly dealService: DealService) {}

  /** GET /deals — list deals for the current user's org. */
  @Get()
  @Roles(UserRole.BUYER, UserRole.SELLER)
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('role') role: 'buyer' | 'seller',
    @Query('status') status?: DealStatus,
  ) {
    return this.dealService.findByOrg(user.orgId, role, status);
  }

  /** GET /deals/:id — single deal detail (buyer or seller). */
  @Get(':id')
  @Roles(UserRole.BUYER, UserRole.SELLER)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.dealService.findById(id, user.orgId);
  }

  /** PATCH /deals/:id/transition — transition deal status. */
  @Patch(':id/transition')
  @Roles(UserRole.BUYER, UserRole.SELLER)
  async transition(
    @Param('id') id: string,
    @Body('status') toStatus: DealStatus,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.dealService.transitionDeal(id, toStatus, user.orgId, user.sub, req.ip);
  }

  /** POST /deals/:id/escrow/hold — buyer holds escrow funds. */
  @Post(':id/escrow/hold')
  @Roles(UserRole.BUYER)
  async holdEscrow(
    @Param('id') id: string,
    @Body('amountPaise') amountPaiseStr: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const amountPaise = BigInt(amountPaiseStr);
    return this.dealService.holdEscrow(id, amountPaise, user.orgId, user.sub, req.ip);
  }

  /** PATCH /deals/:id/milestones/:type/complete — mark milestone as DONE. */
  @Patch(':id/milestones/:type/complete')
  @Roles(UserRole.BUYER, UserRole.SELLER)
  async completeMilestone(
    @Param('id') id: string,
    @Param('type') type: MilestoneType,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.dealService.completeMilestone(id, type, user.orgId, user.sub, req.ip);
  }

  /** GET /deals/:id/ledger — escrow ledger for a deal. */
  @Get(':id/ledger')
  @Roles(UserRole.BUYER, UserRole.SELLER)
  async getLedger(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.dealService.getDealLedger(id, user.orgId);
  }

  /**
   * POST /deals/:id/draft-contract — AI-generated contract draft.
   *
   * Returns an AI-drafted contract labeled as decision-support.
   * Not legally binding — requires human review and signature.
   */
  @Post(':id/draft-contract')
  @Roles(UserRole.BUYER, UserRole.SELLER)
  async draftContract(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const draft = await this.dealService.draftContract(id, user.orgId, user.sub, req.ip);

    return {
      draft,
      meta: {
        label: 'AI-DRAFTED — NOT LEGALLY BINDING',
        note: 'This contract draft is AI-generated decision-support. It requires human review and signature before it has any legal effect.',
      },
    };
  }
}

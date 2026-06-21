import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { BiddingService } from './bidding.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { UserRole, AuctionStatus, AuctionType } from '@prisma/client';
import {
  CreateAuctionSchema,
  CreateAuctionInput,
  PlaceBidSchema,
  PlaceBidInput,
  JwtPayload,
} from '@khanij/types';

@Controller('auctions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BiddingController {
  constructor(private readonly biddingService: BiddingService) {}

  /** POST /auctions — create a new auction (BUYER for REVERSE, SELLER for FORWARD). */
  @Post()
  @Roles(UserRole.BUYER, UserRole.SELLER)
  async create(
    @Body(new ZodValidationPipe(CreateAuctionSchema)) dto: CreateAuctionInput,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.biddingService.createAuction(
      dto,
      user.orgId,
      user.sub,
      user.role as UserRole,
      req.ip,
    );
  }

  /** PATCH /auctions/:id/open — open a DRAFT auction (owner only). */
  @Patch(':id/open')
  @Roles(UserRole.BUYER, UserRole.SELLER)
  async open(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.biddingService.openAuction(id, user.orgId, user.sub, req.ip);
  }

  /** POST /auctions/:id/bids — place a bid (opposite role of creator). */
  @Post(':id/bids')
  @Roles(UserRole.BUYER, UserRole.SELLER)
  async placeBid(
    @Param('id') auctionId: string,
    @Body(new ZodValidationPipe(PlaceBidSchema)) dto: PlaceBidInput,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    // Override auctionId from route param to prevent mismatch
    const input: PlaceBidInput = { ...dto, auctionId };
    return this.biddingService.placeBid(input, user.orgId, user.sub, req.ip);
  }

  /** PATCH /auctions/:id/close — close an OPEN auction (owner only). */
  @Patch(':id/close')
  @Roles(UserRole.BUYER, UserRole.SELLER)
  async close(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.biddingService.closeAuction(id, user.orgId, user.sub, req.ip);
  }

  /** PATCH /auctions/:id/award — award a CLOSED auction (owner only). */
  @Patch(':id/award')
  @Roles(UserRole.BUYER, UserRole.SELLER)
  async award(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.biddingService.awardAuction(id, user.orgId, user.sub, req.ip);
  }

  /** GET /auctions — list auctions with optional filters. */
  @Get()
  async findAll(
    @Query('mineralId') mineralId?: string,
    @Query('status') status?: AuctionStatus,
    @Query('type') type?: AuctionType,
  ) {
    return this.biddingService.findAuctions({ mineralId, status, type });
  }

  /** GET /auctions/:id — single auction detail with bids. */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.biddingService.findById(id);
  }
}

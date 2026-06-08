import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ListingsService } from './listings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { UserRole } from '@prisma/client';
import {
  CreateListingSchema,
  UpdateListingSchema,
  CreateListingInput,
  UpdateListingInput,
  JwtPayload,
} from '@khanij/types';

@Controller('listings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  /** POST /listings — create a new listing (SELLER only). */
  @Post()
  @Roles(UserRole.SELLER)
  async create(
    @Body(new ZodValidationPipe(CreateListingSchema)) dto: CreateListingInput,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.listingsService.create(dto, user.orgId, user.sub, req.ip);
  }

  /** GET /listings — own listings for SELLER, active listings for others. */
  @Get()
  async findMany(
    @CurrentUser() user: JwtPayload,
    @Query('mineralId') mineralId?: string,
    @Query('state') state?: string,
  ) {
    if (user.role === UserRole.SELLER) {
      return this.listingsService.findOwn(user.orgId);
    }
    return this.listingsService.findActive(mineralId, state);
  }

  /** GET /listings/:id — single listing detail. */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.listingsService.findOne(id);
  }

  /** PATCH /listings/:id — update listing fields (SELLER, owns listing). */
  @Patch(':id')
  @Roles(UserRole.SELLER)
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateListingSchema)) dto: UpdateListingInput,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.listingsService.update(id, dto, user.orgId, user.sub, req.ip);
  }

  /** PATCH /listings/:id/activate — DRAFT/PAUSED → ACTIVE (requires VERIFIED org). */
  @Patch(':id/activate')
  @Roles(UserRole.SELLER)
  async activate(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.listingsService.activate(id, user.orgId, user.sub, req.ip);
  }

  /** PATCH /listings/:id/pause — ACTIVE → PAUSED. */
  @Patch(':id/pause')
  @Roles(UserRole.SELLER)
  async pause(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.listingsService.pause(id, user.orgId, user.sub, req.ip);
  }

  /** DELETE /listings/:id — mark SOLD_OUT (soft delete). */
  @Delete(':id')
  @Roles(UserRole.SELLER)
  async soldOut(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.listingsService.markSoldOut(id, user.orgId, user.sub, req.ip);
  }
}

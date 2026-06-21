import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ArbitrationService } from './arbitration.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import {
  JwtPayload,
  DisputeStatus,
  FileDisputeSchema,
  SubmitEvidenceSchema,
  IssueAwardSchema,
} from '@khanij/types';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ArbitrationController {
  constructor(private readonly arbitration: ArbitrationService) {}

  /** POST /api/v1/disputes — file a new dispute against a deal. */
  @Post('disputes')
  @Roles(UserRole.BUYER, UserRole.SELLER)
  async fileDispute(
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const input = FileDisputeSchema.parse(body);
    return this.arbitration.fileDispute(input, user.orgId, user.sub, req.ip);
  }

  /** POST /api/v1/disputes/:id/evidence — submit evidence for a dispute. */
  @Post('disputes/:id/evidence')
  @Roles(UserRole.BUYER, UserRole.SELLER)
  async submitEvidence(
    @Param('id') disputeId: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const input = SubmitEvidenceSchema.parse({ ...body as object, disputeId });
    return this.arbitration.submitEvidence(input, user.orgId, user.sub, req.ip);
  }

  /** PATCH /api/v1/disputes/:id/transition — transition dispute status. */
  @Patch('disputes/:id/transition')
  @Roles(UserRole.ADMIN, UserRole.ARBITRATOR)
  async transitionDispute(
    @Param('id') disputeId: string,
    @Body('status') toStatus: DisputeStatus,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.arbitration.transitionDispute(disputeId, toStatus, user.orgId, user.sub, req.ip);
  }

  /** POST /api/v1/disputes/:id/award — issue an arbitration award. */
  @Post('disputes/:id/award')
  @Roles(UserRole.ARBITRATOR)
  async issueAward(
    @Param('id') disputeId: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const input = IssueAwardSchema.parse({ ...body as object, disputeId });
    return this.arbitration.issueAward(input, user.orgId, user.sub, req.ip);
  }

  /** GET /api/v1/deals/:dealId/disputes — list disputes for a deal. */
  @Get('deals/:dealId/disputes')
  @Roles(UserRole.BUYER, UserRole.SELLER, UserRole.ARBITRATOR)
  async findByDeal(
    @Param('dealId') dealId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.arbitration.findByDeal(dealId, user.orgId);
  }

  /** GET /api/v1/disputes/:id — single dispute detail. */
  @Get('disputes/:id')
  @Roles(UserRole.BUYER, UserRole.SELLER, UserRole.ARBITRATOR)
  async findOne(
    @Param('id') disputeId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.arbitration.findById(disputeId, user.orgId);
  }
}

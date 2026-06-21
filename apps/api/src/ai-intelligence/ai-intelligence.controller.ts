import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AiIntelligenceService,
  PriceAdvisorRequestSchema,
  PriceAdvisorRequest,
  FraudCheckRequestSchema,
  FraudCheckRequest,
  ComplianceReviewRequestSchema,
  ComplianceReviewRequest,
} from './ai-intelligence.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { UserRole } from '@prisma/client';
import type { JwtPayload } from '@khanij/types';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiIntelligenceController {
  constructor(private readonly service: AiIntelligenceService) {}

  /** POST /api/v1/ai/price-advisor — AI price analysis (BUYER or SELLER). */
  @Post('price-advisor')
  @Roles(UserRole.BUYER, UserRole.SELLER)
  async priceAdvisor(
    @Body(new ZodValidationPipe(PriceAdvisorRequestSchema)) dto: PriceAdvisorRequest,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.service.advisePricing(dto, user.sub, user.orgId, req.ip);
  }

  /** POST /api/v1/ai/fraud-check — AI fraud signal detection (ADMIN only). */
  @Post('fraud-check')
  @Roles(UserRole.ADMIN)
  async fraudCheck(
    @Body(new ZodValidationPipe(FraudCheckRequestSchema)) dto: FraudCheckRequest,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.service.detectFraudSignals(dto, user.sub, req.ip);
  }

  /** POST /api/v1/ai/compliance-review — AI compliance document review (ADMIN only). */
  @Post('compliance-review')
  @Roles(UserRole.ADMIN)
  async complianceReview(
    @Body(new ZodValidationPipe(ComplianceReviewRequestSchema)) dto: ComplianceReviewRequest,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.service.reviewComplianceDocument(dto, user.sub, req.ip);
  }
}

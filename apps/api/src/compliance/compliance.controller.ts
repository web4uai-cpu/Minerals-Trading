import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { ComplianceService } from './compliance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { UserRole } from '@prisma/client';
import {
  RegisterComplianceItemSchema,
  VerifyComplianceItemSchema,
  PresignedUploadRequestSchema,
  RegisterComplianceItemInput,
  VerifyComplianceItemInput,
  PresignedUploadRequestInput,
  JwtPayload,
} from '@khanij/types';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  /**
   * POST /compliance/upload-url
   * Generate a presigned MinIO/S3 URL for direct document upload.
   * Client uploads to S3 then calls POST /compliance/items with the returned documentRef.
   */
  @Post('compliance/upload-url')
  @HttpCode(HttpStatus.OK)
  async getUploadUrl(
    @Body(new ZodValidationPipe(PresignedUploadRequestSchema)) dto: PresignedUploadRequestInput,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.complianceService.getPresignedUploadUrl(dto, user.orgId, user.sub);
  }

  /**
   * POST /compliance/items
   * Register a compliance document after successful S3 upload.
   */
  @Post('compliance/items')
  async registerItem(
    @Body(new ZodValidationPipe(RegisterComplianceItemSchema)) dto: RegisterComplianceItemInput,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.complianceService.registerItem(dto, user.orgId, user.sub, req.ip);
  }

  /**
   * PATCH /compliance/items/:id/verify
   * ADMIN only: verify or reject a compliance item.
   */
  @Patch('compliance/items/:id/verify')
  @Roles(UserRole.ADMIN)
  async verifyItem(
    @Param('id') itemId: string,
    @Body(new ZodValidationPipe(VerifyComplianceItemSchema)) dto: VerifyComplianceItemInput,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.complianceService.verifyItem(itemId, dto, user.sub, req.ip);
  }

  /**
   * GET /compliance/profile
   * Return the caller's org compliance profile: items + TrustScore + history.
   */
  @Get('compliance/profile')
  async getProfile(@CurrentUser() user: JwtPayload) {
    return this.complianceService.getProfile(user.orgId);
  }

  /**
   * GET /onboarding/checklist
   * Dynamic list of required compliance items for the caller's org type,
   * with current status — used by the UI to render a progress checklist.
   */
  @Get('onboarding/checklist')
  async getOnboardingChecklist(@CurrentUser() user: JwtPayload) {
    return this.complianceService.getOnboardingChecklist(user.orgId);
  }
}

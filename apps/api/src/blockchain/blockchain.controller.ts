import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { BlockchainService } from './blockchain.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { JwtPayload } from '@khanij/types';
import { z } from 'zod';

const CreateAnchorSchema = z.object({
  entityType: z.string().min(1).max(100),
  entityId: z.string().min(1).max(100),
  contentHash: z.string().min(1).max(256),
});

@Controller('anchors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BlockchainController {
  constructor(private readonly blockchain: BlockchainService) {}

  /** POST /api/v1/anchors — create a new audit anchor. ADMIN only. */
  @Post()
  @Roles(UserRole.ADMIN)
  async createAnchor(
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const input = CreateAnchorSchema.parse(body);
    return this.blockchain.anchorAuditEntry(
      input.entityType,
      input.entityId,
      input.contentHash,
      user.sub,
      req.ip,
    );
  }

  /** GET /api/v1/anchors/:id/verify — verify a single anchor's integrity. */
  @Get(':id/verify')
  async verifyAnchor(@Param('id') id: string) {
    return this.blockchain.verifyAnchor(id);
  }

  /** GET /api/v1/anchors/chain/:entityType/:entityId — get and verify the full chain. */
  @Get('chain/:entityType/:entityId')
  async getAnchorChain(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.blockchain.getAnchorChain(entityType, entityId);
  }
}

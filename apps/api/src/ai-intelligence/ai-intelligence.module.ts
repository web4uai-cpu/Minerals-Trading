import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiIntelligenceService } from './ai-intelligence.service';
import { AiIntelligenceController } from './ai-intelligence.controller';
import { AuditService } from '../common/services/audit.service';

@Module({
  imports: [AiModule, PrismaModule],
  controllers: [AiIntelligenceController],
  providers: [AiIntelligenceService, AuditService],
  exports: [AiIntelligenceService],
})
export class AiIntelligenceModule {}

import { Module } from '@nestjs/common';
import { ArbitrationController } from './arbitration.controller';
import { ArbitrationService } from './arbitration.service';
import { AuditService } from '../common/services/audit.service';
import { DealModule } from '../deals/deal.module';

@Module({
  imports: [DealModule],
  controllers: [ArbitrationController],
  providers: [ArbitrationService, AuditService],
  exports: [ArbitrationService],
})
export class ArbitrationModule {}

import { Module } from '@nestjs/common';
import { RfqController } from './rfq.controller';
import { RfqService } from './rfq.service';
import { AuditService } from '../common/services/audit.service';

@Module({
  controllers: [RfqController],
  providers: [RfqService, AuditService],
  exports: [RfqService],
})
export class RfqModule {}

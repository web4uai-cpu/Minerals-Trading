import { Module } from '@nestjs/common';
import { LogisticsController } from './logistics.controller';
import { LogisticsService } from './logistics.service';
import { AuditService } from '../common/services/audit.service';

@Module({
  controllers: [LogisticsController],
  providers: [LogisticsService, AuditService],
  exports: [LogisticsService],
})
export class LogisticsModule {}

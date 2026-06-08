import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { ExpirySweepProcessor, EXPIRY_SWEEP_QUEUE } from './jobs/expiry-sweep.processor';
import { ExpirySweepScheduler } from './jobs/expiry-sweep.scheduler';
import { AuditService } from '../common/services/audit.service';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueueAsync({
      name: EXPIRY_SWEEP_QUEUE,
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.getOrThrow<string>('REDIS_URL'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ComplianceController],
  providers: [
    ComplianceService,
    AuditService,
    ExpirySweepProcessor,
    ExpirySweepScheduler,
  ],
  exports: [ComplianceService],
})
export class ComplianceModule {}

import { Module } from '@nestjs/common';
import { QuoteController } from './quote.controller';
import { QuoteService } from './quote.service';
import { AuditService } from '../common/services/audit.service';

@Module({
  controllers: [QuoteController],
  providers: [QuoteService, AuditService],
  exports: [QuoteService],
})
export class QuoteModule {}

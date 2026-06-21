import { Module } from '@nestjs/common';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { AuditService } from '../common/services/audit.service';

@Module({
  controllers: [InvoiceController],
  providers: [InvoiceService, AuditService],
  exports: [InvoiceService],
})
export class InvoiceModule {}

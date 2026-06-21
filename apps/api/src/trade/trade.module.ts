import { Module } from '@nestjs/common';
import { TradeController, DealTradeController } from './trade.controller';
import { TradeService } from './trade.service';
import { AuditService } from '../common/services/audit.service';

@Module({
  controllers: [TradeController, DealTradeController],
  providers: [TradeService, AuditService],
  exports: [TradeService],
})
export class TradeModule {}

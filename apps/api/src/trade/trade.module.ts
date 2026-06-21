import { Module } from '@nestjs/common';
import { TradeController, DealTradeController } from './trade.controller';
import { TradeService } from './trade.service';
import { SettlementController, TradeApplicationSettlementController } from './settlement.controller';
import { SettlementService } from './settlement.service';
import { AuditService } from '../common/services/audit.service';

@Module({
  controllers: [
    TradeController,
    DealTradeController,
    SettlementController,
    TradeApplicationSettlementController,
  ],
  providers: [TradeService, SettlementService, AuditService],
  exports: [TradeService, SettlementService],
})
export class TradeModule {}

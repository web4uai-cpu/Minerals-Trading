import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerModule } from './logger/logger.module';
import { AuthModule } from './auth/auth.module';
import { ProvidersModule } from './providers/providers.module';
import { ComplianceModule } from './compliance/compliance.module';
import { CatalogModule } from './catalog/catalog.module';
import { ListingsModule } from './listings/listings.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { RfqModule } from './rfq/rfq.module';
import { QuoteModule } from './quote/quote.module';
import { DealModule } from './deals/deal.module';
import { NotificationModule } from './notifications/notification.module';
import { BiddingModule } from './bidding/bidding.module';
import { InvoiceModule } from './invoice/invoice.module';
import { LogisticsModule } from './logistics/logistics.module';
import { ArbitrationModule } from './arbitration/arbitration.module';
import { BlockchainModule } from './blockchain/blockchain.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    LoggerModule,
    PrismaModule,
    ProvidersModule,
    AuthModule,
    ComplianceModule,
    CatalogModule,
    ListingsModule,
    DiscoveryModule,
    RfqModule,
    QuoteModule,
    DealModule,
    NotificationModule,
    BiddingModule,
    InvoiceModule,
    LogisticsModule,
    ArbitrationModule,
    BlockchainModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}

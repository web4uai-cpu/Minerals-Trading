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
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}

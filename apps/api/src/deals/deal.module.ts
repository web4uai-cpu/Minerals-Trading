import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DealController } from './deal.controller';
import { DealService } from './deal.service';
import { DealRoomGateway } from './deal-room.gateway';
import { EscrowService } from './escrow/escrow.service';
import { AuditService } from '../common/services/audit.service';
import { AiModule } from '../ai/ai.module';
import { PAYMENT_PROVIDER } from '../providers/payment/payment-provider.interface';
import { StubPaymentProvider } from '../providers/payment/stub-payment.provider';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
      inject: [ConfigService],
    }),
    AiModule,
  ],
  controllers: [DealController],
  providers: [
    DealService,
    DealRoomGateway,
    EscrowService,
    AuditService,
    {
      provide: PAYMENT_PROVIDER,
      useClass: StubPaymentProvider,
    },
  ],
  exports: [DealService, EscrowService],
})
export class DealModule {}

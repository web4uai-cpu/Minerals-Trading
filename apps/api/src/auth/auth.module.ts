import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { AuditService } from '../common/services/audit.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        // expiresIn applied at sign-time in AuthService to avoid ms StringValue cast
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      useFactory: (config: ConfigService) => [
        {
          ttl: parseInt(config.get<string>('RATE_LIMIT_WINDOW_MS', '60000'), 10),
          limit: parseInt(config.get<string>('RATE_LIMIT_MAX', '100'), 10),
        },
      ],
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAccessStrategy, AuditService],
  exports: [AuthService, JwtAccessStrategy],
})
export class AuthModule {}

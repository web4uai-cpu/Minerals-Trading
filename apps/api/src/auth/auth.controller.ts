import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  RegisterSchema,
  LoginSchema,
  RefreshSchema,
  RegisterInput,
  LoginInput,
  RefreshInput,
  JwtPayload,
} from '@khanij/types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterInput,
    @Req() req: Request,
    @Headers('idempotency-key') _idempotencyKey?: string,
  ) {
    const ip = req.ip;
    return this.authService.register(dto, ip);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) dto: LoginInput,
    @Req() req: Request,
  ) {
    return this.authService.login(dto, req.ip);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body(new ZodValidationPipe(RefreshSchema)) dto: RefreshInput,
    @Req() req: Request,
  ) {
    return this.authService.refresh(dto, req.ip);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(RefreshSchema)) dto: RefreshInput,
    @Req() req: Request,
  ) {
    await this.authService.logout(user.sub, dto.refreshToken, req.ip);
  }
}

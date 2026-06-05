import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { JwtPayloadSchema, JwtPayload } from '@khanij/types';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(rawPayload: unknown): Promise<JwtPayload> {
    const parsed = JwtPayloadSchema.safeParse(rawPayload);
    if (!parsed.success) {
      throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: 'Malformed JWT payload' });
    }

    const user = await this.authService.validateJwtPayload(parsed.data);
    if (!user) {
      throw new UnauthorizedException({ code: 'USER_NOT_FOUND', message: 'User not found or inactive' });
    }

    return parsed.data;
  }
}

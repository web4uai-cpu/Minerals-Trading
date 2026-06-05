import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import {
  RegisterInput,
  LoginInput,
  RefreshInput,
  JwtPayload,
  UserRole as KhanijUserRole,
} from '@khanij/types';
import { OrgStatus, UserStatus, UserRole } from '@prisma/client';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly logger: LoggerService,
  ) {}

  async register(
    dto: RegisterInput,
    ip?: string,
  ): Promise<{ userId: string; orgId: string }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'Email already registered' });
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const { org, user } = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          type: dto.orgType,
          legalName: dto.legalName,
          state: dto.state,
          status: OrgStatus.PENDING,
        },
      });

      const role = this.defaultRoleForOrgType(dto.orgType);
      const user = await tx.user.create({
        data: {
          orgId: org.id,
          email: dto.email,
          passwordHash,
          role,
          status: UserStatus.ACTIVE,
        },
      });

      return { org, user };
    });

    await this.audit.log({
      actor: user.id,
      actorOrgId: org.id,
      action: 'auth.register',
      entityType: 'User',
      entityId: user.id,
      after: { userId: user.id, orgId: org.id, role: user.role },
      ip,
    });

    this.logger.log(`User registered orgId=${org.id} userId=${user.id}`, 'AuthService');
    return { userId: user.id, orgId: org.id };
  }

  async login(dto: LoginInput, ip?: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { org: true },
    });

    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException({ code: 'ACCOUNT_SUSPENDED', message: 'Account is not active' });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokenPair(user.id, user.orgId, user.role as UserRole, user.email, ip);

    await this.audit.log({
      actor: user.id,
      actorOrgId: user.orgId,
      action: 'auth.login',
      entityType: 'User',
      entityId: user.id,
      ip,
    });

    return tokens;
  }

  async refresh(dto: RefreshInput, ip?: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(dto.refreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored) {
      throw new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token not found' });
    }

    if (stored.isRevoked) {
      // Token reuse detected — revoke entire family for this user
      await this.revokeAllTokensForUser(stored.userId);
      await this.audit.log({
        actor: stored.userId,
        actorOrgId: stored.orgId,
        action: 'auth.token_reuse_detected',
        entityType: 'RefreshToken',
        entityId: stored.id,
        ip,
      });
      this.logger.warn(`Token reuse detected userId=${stored.userId}`, 'AuthService');
      throw new UnauthorizedException({ code: 'TOKEN_REUSE_DETECTED', message: 'Suspicious activity detected. Please log in again.' });
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException({ code: 'REFRESH_TOKEN_EXPIRED', message: 'Refresh token expired' });
    }

    if (stored.user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException({ code: 'ACCOUNT_SUSPENDED', message: 'Account is not active' });
    }

    // Rotate: revoke old, issue new
    const newPair = await this.issueTokenPair(
      stored.userId,
      stored.orgId,
      stored.user.role as UserRole,
      stored.user.email,
      ip,
    );

    const newTokenHash = this.hashToken(newPair.refreshToken);
    const newRecord = await this.prisma.refreshToken.findUnique({ where: { tokenHash: newTokenHash } });

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { isRevoked: true, replacedById: newRecord?.id },
    });

    await this.audit.log({
      actor: stored.userId,
      actorOrgId: stored.orgId,
      action: 'auth.token_rotated',
      entityType: 'RefreshToken',
      entityId: stored.id,
      ip,
    });

    return newPair;
  }

  async logout(userId: string, refreshToken: string, ip?: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash },
      data: { isRevoked: true },
    });

    await this.audit.log({
      actor: userId,
      action: 'auth.logout',
      entityType: 'User',
      entityId: userId,
      ip,
    });
  }

  async validateJwtPayload(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, orgId: true, role: true, email: true, status: true },
    });

    if (!user || user.status !== UserStatus.ACTIVE) return null;
    return user;
  }

  private async issueTokenPair(
    userId: string,
    orgId: string,
    role: UserRole,
    email: string,
    ip?: string,
  ): Promise<TokenPair> {
    // Cast Prisma enum to shared types enum — identical string values at runtime
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: userId,
      orgId,
      role: role as unknown as KhanijUserRole,
      email,
    };

    const accessToken = this.jwt.sign(payload);

    const rawRefresh = randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawRefresh);

    const refreshTtlDays = 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + refreshTtlDays);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        orgId,
        tokenHash,
        expiresAt,
        deviceFingerprint: ip,
      },
    });

    return { accessToken, refreshToken: rawRefresh };
  }

  private async revokeAllTokensForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private defaultRoleForOrgType(orgType: string): UserRole {
    switch (orgType) {
      case 'BUYER': return UserRole.BUYER;
      case 'SELLER': return UserRole.SELLER;
      case 'ARBITRATION_BODY': return UserRole.ARBITRATOR;
      default: return UserRole.BUYER;
    }
  }
}

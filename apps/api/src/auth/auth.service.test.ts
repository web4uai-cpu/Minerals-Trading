jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  verify: jest.fn(),
  argon2id: 2,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import { UserRole, UserStatus, OrgStatus, OrgType } from '@prisma/client';
import { OrgType as KhanijOrgType, UserRole as KhanijUserRole } from '@khanij/types';

const mockUser = {
  id: 'cuid_user_1',
  orgId: 'cuid_org_1',
  email: 'test@example.com',
  passwordHash: 'hashed',
  role: UserRole.BUYER,
  status: UserStatus.ACTIVE,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  phone: null,
  org: {
    id: 'cuid_org_1',
    type: OrgType.BUYER,
    legalName: 'Test Co',
    gstin: null,
    pan: null,
    state: 'Maharashtra',
    status: OrgStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

const mockRefreshToken = {
  id: 'cuid_rt_1',
  userId: mockUser.id,
  orgId: mockUser.orgId,
  tokenHash: 'hash_123',
  isRevoked: false,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  deviceFingerprint: null,
  replacedById: null,
  createdAt: new Date(),
  user: mockUser,
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            organization: { create: jest.fn() },
            refreshToken: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('access_token_abc') },
        },
        {
          provide: AuditService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: LoggerService,
          useValue: { log: jest.fn(), warn: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);
  });

  describe('register', () => {
    it('creates org and user, returns ids', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue(null);
      prisma.$transaction = jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          organization: { create: jest.fn().mockResolvedValue(mockUser.org) },
          user: { create: jest.fn().mockResolvedValue(mockUser) },
        };
        return fn(tx);
      });

      const result = await service.register({
        email: 'test@example.com',
        password: 'SecurePass123!',
        legalName: 'Test Co',
        orgType: KhanijOrgType.BUYER,
        state: 'Maharashtra',
        phone: '+911234567890',
      });

      expect(result.userId).toBe(mockUser.id);
      expect(result.orgId).toBe(mockUser.orgId);
    });

    it('throws ConflictException when email already taken', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'SecurePass123!',
          legalName: 'Test Co',
          orgType: KhanijOrgType.BUYER,
          state: 'Maharashtra',
          phone: '+911234567890',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('returns token pair on valid credentials', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      prisma.user.update = jest.fn().mockResolvedValue(mockUser);
      prisma.refreshToken.create = jest.fn().mockResolvedValue(mockRefreshToken);

      const result = await service.login({ email: 'test@example.com', password: 'pass' });

      expect(result.accessToken).toBe('access_token_abc');
      expect(typeof result.refreshToken).toBe('string');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: mockUser.id, orgId: mockUser.orgId }),
      );
    });

    it('throws UnauthorizedException on wrong password', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ email: 'test@example.com', password: 'wrong' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when user not found', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.login({ email: 'nobody@example.com', password: 'pass' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException when account is suspended', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue({
        ...mockUser,
        status: UserStatus.SUSPENDED,
      });
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await expect(service.login({ email: 'test@example.com', password: 'pass' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('refresh', () => {
    it('rotates token and returns new pair', async () => {
      prisma.refreshToken.findUnique = jest.fn()
        .mockResolvedValueOnce(mockRefreshToken)
        .mockResolvedValueOnce({ id: 'cuid_rt_2' });
      prisma.refreshToken.create = jest.fn().mockResolvedValue({ id: 'cuid_rt_2' });
      prisma.refreshToken.update = jest.fn().mockResolvedValue({});

      const result = await service.refresh({ refreshToken: 'raw_token' });

      expect(result.accessToken).toBe('access_token_abc');
      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: mockRefreshToken.id } }),
      );
    });

    it('throws on revoked token and revokes all family tokens', async () => {
      prisma.refreshToken.findUnique = jest.fn().mockResolvedValue({
        ...mockRefreshToken,
        isRevoked: true,
      });
      prisma.refreshToken.updateMany = jest.fn().mockResolvedValue({ count: 1 });

      await expect(service.refresh({ refreshToken: 'raw_revoked' })).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: mockUser.id, isRevoked: false } }),
      );
    });

    it('throws on expired token', async () => {
      prisma.refreshToken.findUnique = jest.fn().mockResolvedValue({
        ...mockRefreshToken,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh({ refreshToken: 'expired_token' })).rejects.toThrow(UnauthorizedException);
    });

    it('throws on unknown token', async () => {
      prisma.refreshToken.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.refresh({ refreshToken: 'unknown' })).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('cross-org isolation', () => {
    it('validateJwtPayload returns null for inactive user', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue({
        ...mockUser,
        status: UserStatus.SUSPENDED,
      });

      const result = await service.validateJwtPayload({
        sub: mockUser.id,
        orgId: mockUser.orgId,
        role: KhanijUserRole.BUYER,
        email: mockUser.email,
      });

      expect(result).toBeNull();
    });

    it('validateJwtPayload returns null for missing user', async () => {
      prisma.user.findUnique = jest.fn().mockResolvedValue(null);

      const result = await service.validateJwtPayload({
        sub: 'ghost_id',
        orgId: 'ghost_org',
        role: KhanijUserRole.BUYER,
        email: 'ghost@example.com',
      });

      expect(result).toBeNull();
    });
  });
});

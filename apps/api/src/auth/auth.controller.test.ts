import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AllExceptionsFilter } from '../common/filters/http-exception.filter';
import { LoggerService } from '../logger/logger.service';

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
};

const mockLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

describe('AuthController', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: LoggerService, useValue: mockLogger },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: { switchToHttp: () => { getRequest: () => { user: { sub: string; orgId: string; role: string; email: string } } } }) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = { sub: 'user_1', orgId: 'org_1', role: 'BUYER', email: 'test@example.com' };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter(mockLogger as unknown as LoggerService));
    await app.init();
  });

  afterEach(() => jest.clearAllMocks());
  afterAll(() => app.close());

  describe('POST /auth/register', () => {
    it('201 on valid payload', async () => {
      const supertest = (await import('supertest')).default;
      mockAuthService.register.mockResolvedValue({ userId: 'u1', orgId: 'o1' });

      const res = await supertest(app.getHttpServer()).post('/auth/register').send({
        email: 'buyer@example.com',
        password: 'SecurePass1!',
        legalName: 'Acme Minerals Ltd',
        orgType: 'BUYER',
        state: 'Maharashtra',
        phone: '+911234567890',
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ userId: 'u1', orgId: 'o1' });
    });

    it('400 on missing email', async () => {
      const supertest = (await import('supertest')).default;

      const res = await supertest(app.getHttpServer()).post('/auth/register').send({
        password: 'SecurePass1!',
        legalName: 'Acme',
        orgType: 'BUYER',
        state: 'Maharashtra',
        phone: '+911234567890',
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('400 on invalid phone number', async () => {
      const supertest = (await import('supertest')).default;

      const res = await supertest(app.getHttpServer()).post('/auth/register').send({
        email: 'buyer@example.com',
        password: 'SecurePass1!',
        legalName: 'Acme',
        orgType: 'BUYER',
        state: 'Maharashtra',
        phone: 'not-a-phone',
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /auth/login', () => {
    it('200 on valid credentials', async () => {
      const supertest = (await import('supertest')).default;
      mockAuthService.login.mockResolvedValue({
        accessToken: 'access_abc',
        refreshToken: 'refresh_xyz',
      });

      const res = await supertest(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'buyer@example.com', password: 'pass' });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBe('access_abc');
    });

    it('400 on empty password', async () => {
      const supertest = (await import('supertest')).default;

      const res = await supertest(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'buyer@example.com', password: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/logout', () => {
    it('204 on valid authenticated request', async () => {
      const supertest = (await import('supertest')).default;
      mockAuthService.logout.mockResolvedValue(undefined);

      const res = await supertest(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', 'Bearer valid_token')
        .send({ refreshToken: 'some_refresh_token' });

      expect(res.status).toBe(204);
    });
  });
});

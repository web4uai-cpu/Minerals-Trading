import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = { isHealthy: jest.fn() };

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    mockPrisma.isHealthy.mockResolvedValue(true);
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns ok status and db up when DB is healthy', async () => {
    const result = await controller.check();
    expect(result.status).toBe('ok');
    expect(result.db).toBe('up');
  });

  it('returns degraded status and db down when DB is unhealthy', async () => {
    mockPrisma.isHealthy.mockResolvedValue(false);
    const result = await controller.check();
    expect(result.status).toBe('degraded');
    expect(result.db).toBe('down');
  });

  it('returns uptime as a non-negative number', async () => {
    const result = await controller.check();
    expect(typeof result.uptime).toBe('number');
    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });

  it('returns a valid ISO timestamp', async () => {
    const result = await controller.check();
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it('returns version string', async () => {
    const result = await controller.check();
    expect(typeof result.version).toBe('string');
    expect(result.version.length).toBeGreaterThan(0);
  });
});

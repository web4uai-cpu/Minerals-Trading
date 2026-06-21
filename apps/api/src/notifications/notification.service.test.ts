import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { NotificationService, NotificationParams } from './notification.service';
import { LoggerService } from '../logger/logger.service';
import { NOTIFICATIONS_QUEUE } from './notification.processor';

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockQueue = {
  add: jest.fn(),
};

const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// ─── Suite ─────────────────────────────────────────────────────────────────

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: getQueueToken(NOTIFICATIONS_QUEUE), useValue: mockQueue },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    service = module.get(NotificationService);
  });

  describe('sendNotification', () => {
    const params: NotificationParams = {
      type: 'email',
      recipientUserId: 'user-1',
      recipientOrgId: 'org-1',
      eventType: 'deal.contract.drafted',
      data: { dealId: 'deal-1', mineralName: 'Iron Ore' },
    };

    it('queues a job with correct params', async () => {
      mockQueue.add.mockResolvedValue({ id: 'job-1' });

      await service.sendNotification(params);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'send',
        params,
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        }),
      );
    });

    it('includes retry config (attempts: 3, exponential backoff)', async () => {
      mockQueue.add.mockResolvedValue({ id: 'job-2' });

      await service.sendNotification(params);

      const addCall = mockQueue.add.mock.calls[0];
      const jobOptions = addCall[2];

      expect(jobOptions.attempts).toBe(3);
      expect(jobOptions.backoff).toEqual({
        type: 'exponential',
        delay: 1000,
      });
    });

    it('logs the queued notification', async () => {
      mockQueue.add.mockResolvedValue({ id: 'job-3' });

      await service.sendNotification(params);

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('deal.contract.drafted'),
        'NotificationService',
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('user-1'),
        'NotificationService',
      );
    });

    it('queues push notifications with the same config', async () => {
      mockQueue.add.mockResolvedValue({ id: 'job-4' });

      const pushParams: NotificationParams = {
        ...params,
        type: 'push',
      };

      await service.sendNotification(pushParams);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'send',
        pushParams,
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        }),
      );
    });
  });
});

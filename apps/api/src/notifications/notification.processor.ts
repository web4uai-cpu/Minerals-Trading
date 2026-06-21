import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import type { NotificationParams } from './notification.service';

export const NOTIFICATIONS_QUEUE = 'notifications';

/**
 * BullMQ processor for the notifications queue.
 *
 * MVP: stubs email and push — logs the notification instead of
 * sending it through real channels. Swap to real providers when
 * email/push integrations are licensed and configured.
 */
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  async process(job: Job<NotificationParams>): Promise<void> {
    const { type, recipientUserId, eventType, data } = job.data;

    if (type === 'email') {
      this.logger.log(
        `[STUB EMAIL] to=${recipientUserId} event=${eventType} data=${JSON.stringify(data)}`,
        'NotificationProcessor',
      );
    } else if (type === 'push') {
      this.logger.log(
        `[STUB PUSH] to=${recipientUserId} event=${eventType} data=${JSON.stringify(data)}`,
        'NotificationProcessor',
      );
    } else {
      this.logger.warn(
        `Unknown notification type=${type} for user=${recipientUserId}`,
        'NotificationProcessor',
      );
    }
  }
}

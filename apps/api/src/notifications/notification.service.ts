import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { LoggerService } from '../logger/logger.service';

export interface NotificationParams {
  type: 'email' | 'push';
  recipientUserId: string;
  recipientOrgId: string;
  eventType: string;
  data: Record<string, unknown>;
}

@Injectable()
export class NotificationService {
  constructor(
    @InjectQueue('notifications') private readonly queue: Queue,
    private readonly logger: LoggerService,
  ) {}

  async sendNotification(params: NotificationParams): Promise<void> {
    await this.queue.add('send', params, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
    this.logger.log(
      `Notification queued: ${params.eventType} for user ${params.recipientUserId}`,
      'NotificationService',
    );
  }
}

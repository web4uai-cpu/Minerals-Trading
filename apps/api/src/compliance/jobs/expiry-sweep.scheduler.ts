import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EXPIRY_SWEEP_QUEUE, EXPIRY_SWEEP_JOB } from './expiry-sweep.processor';

/**
 * Registers the repeatable nightly expiry sweep job on module init.
 *
 * Cron: "0 2 * * *" — 02:00 UTC daily (approx 07:30 IST).
 * Adjust to "30 20 * * *" UTC for exactly 02:00 IST if needed.
 *
 * BullMQ repeatable jobs survive restarts — the scheduler only adds
 * the job if it does not already exist.
 */
@Injectable()
export class ExpirySweepScheduler implements OnModuleInit {
  private readonly logger = new Logger(ExpirySweepScheduler.name);

  constructor(
    @InjectQueue(EXPIRY_SWEEP_QUEUE)
    private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      EXPIRY_SWEEP_JOB,
      {},
      {
        repeat: {
          // 02:00 UTC daily
          pattern: '0 2 * * *',
        },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60_000, // 1 minute base
        },
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 30 },
      },
    );

    this.logger.log(
      'Nightly compliance expiry sweep scheduled (cron: 0 2 * * *)',
      'ExpirySweepScheduler',
    );
  }
}

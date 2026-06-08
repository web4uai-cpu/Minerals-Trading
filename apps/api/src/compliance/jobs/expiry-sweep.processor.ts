import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ComplianceService } from '../compliance.service';

export const EXPIRY_SWEEP_QUEUE = 'compliance-expiry-sweep';
export const EXPIRY_SWEEP_JOB = 'run-expiry-sweep';

/**
 * BullMQ processor for the nightly compliance expiry sweep.
 *
 * Triggered by ExpirySweepScheduler at 02:00 IST daily.
 * Marks expired VERIFIED items, recomputes TrustScores,
 * and returns affected org IDs for downstream notification.
 */
@Processor(EXPIRY_SWEEP_QUEUE)
export class ExpirySweepProcessor extends WorkerHost {
  private readonly logger = new Logger(ExpirySweepProcessor.name);

  constructor(private readonly complianceService: ComplianceService) {
    super();
  }

  async process(job: Job): Promise<{ affectedOrgs: string[] }> {
    this.logger.log(`Starting expiry sweep job=${job.id}`, 'ExpirySweepProcessor');

    try {
      const affectedOrgIds = await this.complianceService.runExpirySweep();
      this.logger.log(
        `Expiry sweep completed: ${affectedOrgIds.length} orgs affected`,
        'ExpirySweepProcessor',
      );
      return { affectedOrgs: affectedOrgIds };
    } catch (error) {
      this.logger.error(
        `Expiry sweep failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
        'ExpirySweepProcessor',
      );
      throw error; // BullMQ will retry per queue config
    }
  }
}

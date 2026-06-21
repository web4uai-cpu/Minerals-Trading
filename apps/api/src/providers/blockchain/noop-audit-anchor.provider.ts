import { Injectable } from '@nestjs/common';
import { AuditAnchorProvider, AnchorResult } from './audit-anchor-provider.interface';
import { computeAnchorHash } from '@khanij/blockchain';
import { LoggerService } from '../../logger/logger.service';

/**
 * No-op blockchain anchor provider for MVP.
 * Computes the anchor hash locally but does not write to any blockchain.
 * Real blockchain anchoring requires separate licensing — this is a stub.
 */
@Injectable()
export class NoOpAuditAnchorProvider implements AuditAnchorProvider {
  constructor(private readonly logger: LoggerService) {}

  async anchorHash(
    entityType: string,
    entityId: string,
    contentHash: string,
  ): Promise<AnchorResult> {
    const anchorHash = computeAnchorHash({
      entityType,
      entityId,
      contentHash,
      previousAnchorHash: null,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `[NoOpAuditAnchor] Anchored ${entityType}/${entityId} — hash=${anchorHash.substring(0, 12)}...`,
      'NoOpAuditAnchorProvider',
    );

    return {
      anchorHash,
      chainId: null,
      txHash: null,
      status: 'ANCHORED',
    };
  }

  async verifyAnchor(
    _anchorHash: string,
  ): Promise<{ verified: boolean; chainId?: string; txHash?: string }> {
    // No-op provider: no external chain to verify against.
    // Verification is done locally via hash recomputation in BlockchainService.
    return { verified: true };
  }
}

import {
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import {
  AUDIT_ANCHOR_PROVIDER,
  AuditAnchorProvider,
} from '../providers/blockchain/audit-anchor-provider.interface';
import {
  computeAnchorHash,
  verifyChain,
  createAnchorProof,
  AnchorRecord,
} from '@khanij/blockchain';

@Injectable()
export class BlockchainService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly logger: LoggerService,
    @Inject(AUDIT_ANCHOR_PROVIDER)
    private readonly anchorProvider: AuditAnchorProvider,
  ) {}

  /**
   * Anchor an audit entry for tamper-evidence.
   * Creates an AuditAnchor record and calls the provider.
   */
  async anchorAuditEntry(
    entityType: string,
    entityId: string,
    contentHash: string,
    userId: string,
    ip?: string,
  ) {
    // Find the last anchor for this entity to chain it
    const lastAnchor = await this.prisma.auditAnchor.findFirst({
      where: { entityType, entityId },
      orderBy: { anchoredAt: 'desc' },
    });

    const record: AnchorRecord = {
      entityType,
      entityId,
      contentHash,
      previousAnchorHash: lastAnchor?.anchorHash ?? null,
      timestamp: new Date().toISOString(),
    };

    const anchorHash = computeAnchorHash(record);

    // Call the provider (no-op in MVP)
    const result = await this.anchorProvider.anchorHash(entityType, entityId, contentHash);

    // Persist the anchor
    const anchor = await this.prisma.auditAnchor.create({
      data: {
        entityType,
        entityId,
        contentHash,
        anchorHash,
        previousAnchorHash: lastAnchor?.anchorHash ?? null,
        chainId: result.chainId,
        txHash: result.txHash,
      },
    });

    await this.audit.log({
      actor: userId,
      action: 'blockchain.anchor_created',
      entityType: 'AuditAnchor',
      entityId: anchor.id,
      after: { entityType, entityId, anchorHash },
      ip,
    });

    this.logger.log(
      `Anchor created for ${entityType}/${entityId}`,
      'BlockchainService',
    );

    return anchor;
  }

  /**
   * Verify the integrity of a single anchor by recomputing its hash.
   */
  async verifyAnchor(anchorId: string) {
    const anchor = await this.prisma.auditAnchor.findUnique({
      where: { id: anchorId },
    });

    if (!anchor) {
      throw new NotFoundException({
        code: 'ANCHOR_NOT_FOUND',
        message: 'Audit anchor not found',
      });
    }

    const record: AnchorRecord = {
      entityType: anchor.entityType,
      entityId: anchor.entityId,
      contentHash: anchor.contentHash,
      previousAnchorHash: anchor.previousAnchorHash,
      timestamp: anchor.anchoredAt.toISOString(),
    };

    const recomputedHash = computeAnchorHash(record);
    const valid = recomputedHash === anchor.anchorHash;

    // Also check with the provider if it has external verification
    const providerResult = await this.anchorProvider.verifyAnchor(anchor.anchorHash);

    return {
      id: anchor.id,
      valid: valid && providerResult.verified,
      anchorHash: anchor.anchorHash,
      entityType: anchor.entityType,
      entityId: anchor.entityId,
      chainId: anchor.chainId,
      txHash: anchor.txHash,
      anchoredAt: anchor.anchoredAt,
    };
  }

  /**
   * Get all anchors for an entity and verify the full chain.
   */
  async getAnchorChain(entityType: string, entityId: string) {
    const anchors = await this.prisma.auditAnchor.findMany({
      where: { entityType, entityId },
      orderBy: { anchoredAt: 'asc' },
    });

    const proofs = anchors.map((a) => {
      const record: AnchorRecord = {
        entityType: a.entityType,
        entityId: a.entityId,
        contentHash: a.contentHash,
        previousAnchorHash: a.previousAnchorHash,
        timestamp: a.anchoredAt.toISOString(),
      };
      return createAnchorProof(record);
    });

    const chainResult = verifyChain(proofs);

    return {
      entityType,
      entityId,
      anchors: anchors.map((a) => ({
        id: a.id,
        anchorHash: a.anchorHash,
        contentHash: a.contentHash,
        previousAnchorHash: a.previousAnchorHash,
        chainId: a.chainId,
        txHash: a.txHash,
        anchoredAt: a.anchoredAt,
      })),
      chainValid: chainResult.valid,
      brokenAt: chainResult.brokenAt,
    };
  }
}

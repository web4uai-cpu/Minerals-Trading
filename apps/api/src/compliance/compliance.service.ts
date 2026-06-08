import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import { StorageService } from '../providers/storage/storage.service';
import {
  ComplianceItemStatus,
  ComplianceItemType,
  RegisterComplianceItemInput,
  VerifyComplianceItemInput,
  PresignedUploadRequestInput,
  ComplianceProfileResponse,
  OnboardingChecklistItem,
} from '@khanij/types';
import { OrgStatus } from '@prisma/client';
import {
  computeTrustScore,
  REQUIRED_ITEMS_BY_ORG_TYPE,
  COMPLIANCE_ITEM_LABELS,
} from './trust-score.calculator';
import { randomUUID } from 'crypto';

// Prisma status string constants — avoids importing Prisma enum before client regeneration
const P_UPLOADED = 'UPLOADED' as const;
const P_VERIFIED = 'VERIFIED' as const;
const P_EXPIRED = 'EXPIRED' as const;

/** Legal status transitions for compliance items. */
const LEGAL_TRANSITIONS: Record<ComplianceItemStatus, ComplianceItemStatus[]> = {
  [ComplianceItemStatus.MISSING]: [ComplianceItemStatus.UPLOADED],
  [ComplianceItemStatus.UPLOADED]: [ComplianceItemStatus.UNDER_REVIEW, ComplianceItemStatus.REJECTED],
  [ComplianceItemStatus.UNDER_REVIEW]: [ComplianceItemStatus.VERIFIED, ComplianceItemStatus.REJECTED],
  [ComplianceItemStatus.VERIFIED]: [ComplianceItemStatus.EXPIRED],
  [ComplianceItemStatus.REJECTED]: [ComplianceItemStatus.UPLOADED],
  [ComplianceItemStatus.EXPIRED]: [ComplianceItemStatus.UPLOADED],
};

@Injectable()
export class ComplianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly logger: LoggerService,
    private readonly storage: StorageService,
  ) {}

  // ─── Presigned Upload URL ────────────────────────────────────────────────

  async getPresignedUploadUrl(
    dto: PresignedUploadRequestInput,
    orgId: string,
    userId: string,
  ): Promise<{ uploadUrl: string; documentRef: string }> {
    const ext = dto.fileName.split('.').pop()?.toLowerCase() ?? 'bin';
    const key = `compliance/${orgId}/${dto.itemType}/${randomUUID()}.${ext}`;
    const uploadUrl = await this.storage.generatePresignedUploadUrl(key, 900); // 15 min

    this.logger.log(
      `Presigned upload URL generated for orgId=${orgId} itemType=${dto.itemType}`,
      'ComplianceService',
    );
    await this.audit.log({
      actor: userId,
      actorOrgId: orgId,
      action: 'compliance.presigned_url_generated',
      entityType: 'ComplianceItem',
      after: { itemType: dto.itemType, key },
    });

    return { uploadUrl, documentRef: key };
  }

  // ─── Register Item ───────────────────────────────────────────────────────

  async registerItem(
    dto: RegisterComplianceItemInput,
    orgId: string,
    userId: string,
    ip?: string,
  ) {
    // Upsert: one item per type per org (@@unique constraint)
    const existing = await this.prisma.complianceItem.findUnique({
      where: { orgId_type: { orgId, type: dto.type } },
    });

    const from = (existing?.status ?? ComplianceItemStatus.MISSING) as ComplianceItemStatus;
    const to = ComplianceItemStatus.UPLOADED;
    this.assertLegalTransition(from, to, dto.type);

    const item = await this.prisma.complianceItem.upsert({
      where: { orgId_type: { orgId, type: dto.type } },
      create: {
        orgId,
        type: dto.type,
        status: P_UPLOADED,
        documentRef: dto.documentRef,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        uploadedAt: new Date(),
      },
      update: {
        status: P_UPLOADED,
        documentRef: dto.documentRef,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        uploadedAt: new Date(),
        // Clear previous rejection note and verification on re-upload
        rejectionNote: null,
        verifiedBy: null,
        verifiedAt: null,
      },
    });

    await this.audit.log({
      actor: userId,
      actorOrgId: orgId,
      action: 'compliance.item_uploaded',
      entityType: 'ComplianceItem',
      entityId: item.id,
      before: existing ? { status: existing.status } : undefined,
      after: { status: item.status, type: item.type },
      ip,
    });

    await this.recomputeAndSnapshotTrustScore(orgId, 'upload');
    this.logger.log(`Compliance item uploaded orgId=${orgId} type=${dto.type}`, 'ComplianceService');

    return item;
  }

  // ─── Verify / Reject Item (ADMIN only) ──────────────────────────────────

  async verifyItem(
    itemId: string,
    dto: VerifyComplianceItemInput,
    adminUserId: string,
    ip?: string,
  ) {
    const item = await this.prisma.complianceItem.findUnique({
      where: { id: itemId },
      include: { org: true },
    });
    if (!item) throw new NotFoundException({ code: 'ITEM_NOT_FOUND', message: 'Compliance item not found' });

    if (dto.status === 'REJECTED' && !dto.rejectionNote) {
      throw new BadRequestException({
        code: 'REJECTION_NOTE_REQUIRED',
        message: 'A rejection note is required when rejecting a compliance item',
      });
    }

    const from = item.status as ComplianceItemStatus;
    const to = dto.status as ComplianceItemStatus;
    this.assertLegalTransition(from, to, item.type as ComplianceItemType);

    const before = { status: item.status };
    const updated = await this.prisma.complianceItem.update({
      where: { id: itemId },
      data: {
        status: dto.status,
        verifiedBy: dto.status === 'VERIFIED' ? adminUserId : null,
        verifiedAt: dto.status === 'VERIFIED' ? new Date() : null,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : item.validFrom,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : item.validUntil,
        rejectionNote: dto.status === 'REJECTED' ? (dto.rejectionNote ?? null) : null,
      },
    });

    await this.audit.log({
      actor: adminUserId,
      actorOrgId: item.orgId,
      action: `compliance.item_${dto.status.toLowerCase()}`,
      entityType: 'ComplianceItem',
      entityId: itemId,
      before,
      after: { status: updated.status, verifiedBy: updated.verifiedBy },
      ip,
    });

    const trigger = dto.status === 'VERIFIED' ? 'verify' : 'reject';
    await this.recomputeAndSnapshotTrustScore(item.orgId, trigger);

    // If org now has all required items verified, promote to VERIFIED status
    await this.maybeVerifyOrg(item.orgId);

    this.logger.log(
      `Compliance item ${dto.status} itemId=${itemId} by admin=${adminUserId}`,
      'ComplianceService',
    );

    return updated;
  }

  // ─── Get Compliance Profile ──────────────────────────────────────────────

  async getProfile(orgId: string): Promise<ComplianceProfileResponse> {
    const [org, items, snapshots] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: orgId } }),
      this.prisma.complianceItem.findMany({
        where: { orgId },
        orderBy: { type: 'asc' },
      }),
      this.prisma.complianceSnapshot.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    if (!org) throw new NotFoundException({ code: 'ORG_NOT_FOUND', message: 'Organization not found' });

    const requiredTypes = REQUIRED_ITEMS_BY_ORG_TYPE[org.type] ?? [];
    const { score, breakdown } = computeTrustScore(
      items.map((i) => ({
        type: i.type as ComplianceItemType,
        status: i.status as ComplianceItemStatus,
        validUntil: i.validUntil,
      })),
      requiredTypes,
    );

    return {
      orgId,
      trustScore: score,
      breakdown,
      items: items.map((i) => ({
        id: i.id,
        type: i.type as ComplianceItemType,
        status: i.status as ComplianceItemStatus,
        documentRef: i.documentRef,
        validFrom: i.validFrom?.toISOString() ?? null,
        validUntil: i.validUntil?.toISOString() ?? null,
        verifiedAt: i.verifiedAt?.toISOString() ?? null,
        rejectionNote: i.rejectionNote,
        uploadedAt: i.uploadedAt?.toISOString() ?? null,
      })),
      history: snapshots.map((s) => ({
        trustScore: s.trustScore,
        triggeredBy: s.triggeredBy,
        createdAt: s.createdAt.toISOString(),
      })),
    };
  }

  // ─── Onboarding Checklist ────────────────────────────────────────────────

  async getOnboardingChecklist(orgId: string): Promise<OnboardingChecklistItem[]> {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException({ code: 'ORG_NOT_FOUND', message: 'Organization not found' });

    const requiredTypes = REQUIRED_ITEMS_BY_ORG_TYPE[org.type] ?? [];
    const existingItems = await this.prisma.complianceItem.findMany({ where: { orgId } });
    const itemMap = new Map(existingItems.map((i) => [i.type, i]));

    return requiredTypes.map((type) => {
      const item = itemMap.get(type);
      return {
        type: type as ComplianceItemType,
        label: COMPLIANCE_ITEM_LABELS[type],
        required: true,
        status: (item?.status ?? ComplianceItemStatus.MISSING) as ComplianceItemStatus,
        documentRef: item?.documentRef ?? null,
      };
    });
  }

  // ─── Nightly Expiry Sweep ────────────────────────────────────────────────

  /**
   * Called by the BullMQ nightly job.
   * 1. Mark VERIFIED items whose validUntil < now as EXPIRED.
   * 2. Recompute TrustScore for affected orgs.
   * Returns affected org IDs for notification purposes.
   */
  async runExpirySweep(): Promise<string[]> {
    const now = new Date();

    const expiredItems = await this.prisma.complianceItem.findMany({
      where: {
        status: P_VERIFIED,
        validUntil: { lt: now },
      },
      select: { id: true, orgId: true, type: true },
    });

    if (expiredItems.length === 0) {
      this.logger.log('Expiry sweep: no items to expire', 'ComplianceService');
      return [];
    }

    // Expire all in one batch
    await this.prisma.complianceItem.updateMany({
      where: {
        id: { in: expiredItems.map((i: { id: string }) => i.id) },
      },
      data: { status: P_EXPIRED },
    });

    // Write audit entries
    for (const item of expiredItems as Array<{ id: string; orgId: string; type: string }>) {
      await this.audit.log({
        actor: 'system',
        actorOrgId: item.orgId,
        action: 'compliance.item_expired',
        entityType: 'ComplianceItem',
        entityId: item.id,
        before: { status: 'VERIFIED' },
        after: { status: 'EXPIRED', type: item.type },
      });
    }

    // Recompute scores for unique affected orgs
    const affectedOrgIds = [...new Set((expiredItems as Array<{ orgId: string }>).map((i) => i.orgId))];
    for (const orgId of affectedOrgIds) {
      await this.recomputeAndSnapshotTrustScore(orgId, 'nightly_sweep');
    }

    this.logger.log(
      `Expiry sweep: expired ${expiredItems.length} items across ${affectedOrgIds.length} orgs`,
      'ComplianceService',
    );

    return affectedOrgIds;
  }

  // ─── Internal Helpers ────────────────────────────────────────────────────

  private assertLegalTransition(
    from: ComplianceItemStatus,
    to: ComplianceItemStatus,
    itemType: ComplianceItemType,
  ): void {
    const allowed = LEGAL_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException({
        code: 'ILLEGAL_STATUS_TRANSITION',
        message: `Cannot transition ${itemType} from ${from} to ${to}`,
      });
    }
  }

  private async recomputeAndSnapshotTrustScore(
    orgId: string,
    triggeredBy: string,
  ): Promise<void> {
    const [org, items] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: orgId } }),
      this.prisma.complianceItem.findMany({ where: { orgId } }),
    ]);

    if (!org) return;

    const requiredTypes = REQUIRED_ITEMS_BY_ORG_TYPE[org.type] ?? [];
    const { score, breakdown } = computeTrustScore(
      items.map((i) => ({
        type: i.type as ComplianceItemType,
        status: i.status as ComplianceItemStatus,
        validUntil: i.validUntil,
      })),
      requiredTypes,
    );

    await this.prisma.complianceSnapshot.create({
      data: {
        orgId,
        trustScore: score,
        breakdown: breakdown as object[],
        triggeredBy,
      },
    });
  }

  private async maybeVerifyOrg(orgId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org || org.status === OrgStatus.VERIFIED) return;

    const requiredTypes = REQUIRED_ITEMS_BY_ORG_TYPE[org.type] ?? [];
    if (requiredTypes.length === 0) return;

    const verifiedCount = await this.prisma.complianceItem.count({
      where: {
        orgId,
        type: { in: requiredTypes },
        status: P_VERIFIED,
      },
    });

    if (verifiedCount >= requiredTypes.length) {
      await this.prisma.organization.update({
        where: { id: orgId },
        data: { status: OrgStatus.VERIFIED },
      });
      await this.audit.log({
        actor: 'system',
        actorOrgId: orgId,
        action: 'compliance.org_verified',
        entityType: 'Organization',
        entityId: orgId,
        after: { status: 'VERIFIED' },
      });
      this.logger.log(`Org auto-verified orgId=${orgId}`, 'ComplianceService');
    }
  }
}

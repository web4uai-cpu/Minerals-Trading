import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { traceStorage } from '../../logger/trace.context';
import { createHash } from 'crypto';

export interface AuditParams {
  actor: string;
  actorOrgId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: AuditParams): Promise<void> {
    const traceId = traceStorage.getStore()?.traceId;

    await this.prisma.auditLog.create({
      data: {
        actor: params.actor,
        actorOrgId: params.actorOrgId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        beforeHash: params.before ? this.hash(params.before) : undefined,
        afterHash: params.after ? this.hash(params.after) : undefined,
        ip: params.ip,
        traceId,
      },
    });
  }

  private hash(data: unknown): string {
    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }
}

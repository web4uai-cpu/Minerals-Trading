import { Test } from '@nestjs/testing';
import { BlockchainService } from './blockchain.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import { AUDIT_ANCHOR_PROVIDER } from '../providers/blockchain/audit-anchor-provider.interface';
import { computeAnchorHash } from '@khanij/blockchain';

describe('BlockchainService', () => {
  let service: BlockchainService;
  let prisma: Record<string, any>;
  let auditService: { log: jest.Mock };
  let anchorProvider: { anchorHash: jest.Mock; verifyAnchor: jest.Mock };

  beforeEach(async () => {
    prisma = {
      auditAnchor: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'anchor-1',
          ...data,
          anchoredAt: new Date(),
        })),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    auditService = { log: jest.fn().mockResolvedValue(undefined) };

    anchorProvider = {
      anchorHash: jest.fn().mockResolvedValue({
        anchorHash: 'provider-hash',
        chainId: null,
        txHash: null,
        status: 'ANCHORED',
      }),
      verifyAnchor: jest.fn().mockResolvedValue({ verified: true }),
    };

    const module = await Test.createTestingModule({
      providers: [
        BlockchainService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: LoggerService, useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } },
        { provide: AUDIT_ANCHOR_PROVIDER, useValue: anchorProvider },
      ],
    }).compile();

    service = module.get(BlockchainService);
  });

  describe('anchorAuditEntry', () => {
    it('creates a record and calls the provider', async () => {
      const result = await service.anchorAuditEntry(
        'Deal',
        'deal-1',
        'content-hash-abc',
        'user-1',
      );

      expect(prisma.auditAnchor.create).toHaveBeenCalledTimes(1);
      expect(anchorProvider.anchorHash).toHaveBeenCalledWith('Deal', 'deal-1', 'content-hash-abc');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: 'user-1',
          action: 'blockchain.anchor_created',
        }),
      );
      expect(result.entityType).toBe('Deal');
    });

    it('chains to previous anchor when one exists', async () => {
      prisma.auditAnchor.findFirst.mockResolvedValue({
        anchorHash: 'prev-hash',
      });

      await service.anchorAuditEntry('Deal', 'deal-1', 'hash2', 'user-1');

      const createCall = prisma.auditAnchor.create.mock.calls[0][0];
      expect(createCall.data.previousAnchorHash).toBe('prev-hash');
    });
  });

  describe('verifyAnchor', () => {
    it('returns valid for an untampered anchor', async () => {
      const timestamp = new Date('2024-01-01T00:00:00.000Z');
      const record = {
        entityType: 'Deal',
        entityId: 'deal-1',
        contentHash: 'abc',
        previousAnchorHash: null,
        timestamp: timestamp.toISOString(),
      };
      const hash = computeAnchorHash(record);

      prisma.auditAnchor.findUnique.mockResolvedValue({
        id: 'anchor-1',
        entityType: 'Deal',
        entityId: 'deal-1',
        contentHash: 'abc',
        anchorHash: hash,
        previousAnchorHash: null,
        chainId: null,
        txHash: null,
        anchoredAt: timestamp,
      });

      const result = await service.verifyAnchor('anchor-1');
      expect(result.valid).toBe(true);
    });

    it('throws NotFoundException for missing anchor', async () => {
      prisma.auditAnchor.findUnique.mockResolvedValue(null);
      await expect(service.verifyAnchor('nonexistent')).rejects.toThrow('Audit anchor not found');
    });
  });

  describe('getAnchorChain', () => {
    it('returns verified chain for an entity', async () => {
      const t1 = new Date('2024-01-01T00:00:00.000Z');
      const r1 = {
        entityType: 'Deal',
        entityId: 'deal-1',
        contentHash: 'hash1',
        previousAnchorHash: null,
        timestamp: t1.toISOString(),
      };
      const h1 = computeAnchorHash(r1);

      prisma.auditAnchor.findMany.mockResolvedValue([
        {
          id: 'a1',
          entityType: 'Deal',
          entityId: 'deal-1',
          contentHash: 'hash1',
          anchorHash: h1,
          previousAnchorHash: null,
          chainId: null,
          txHash: null,
          anchoredAt: t1,
        },
      ]);

      const result = await service.getAnchorChain('Deal', 'deal-1');
      expect(result.chainValid).toBe(true);
      expect(result.anchors).toHaveLength(1);
    });
  });
});

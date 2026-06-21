import { Module } from '@nestjs/common';
import { BlockchainController } from './blockchain.controller';
import { BlockchainService } from './blockchain.service';
import { AuditService } from '../common/services/audit.service';
import { AUDIT_ANCHOR_PROVIDER } from '../providers/blockchain/audit-anchor-provider.interface';
import { NoOpAuditAnchorProvider } from '../providers/blockchain/noop-audit-anchor.provider';

@Module({
  controllers: [BlockchainController],
  providers: [
    BlockchainService,
    AuditService,
    {
      provide: AUDIT_ANCHOR_PROVIDER,
      useClass: NoOpAuditAnchorProvider,
    },
  ],
  exports: [BlockchainService, AUDIT_ANCHOR_PROVIDER],
})
export class BlockchainModule {}

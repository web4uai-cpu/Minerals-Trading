export interface AnchorResult {
  anchorHash: string;
  chainId: string | null;
  txHash: string | null;
  status: 'ANCHORED' | 'PENDING' | 'FAILED';
}

export interface AuditAnchorProvider {
  anchorHash(entityType: string, entityId: string, contentHash: string): Promise<AnchorResult>;
  verifyAnchor(anchorHash: string): Promise<{ verified: boolean; chainId?: string; txHash?: string }>;
}

export const AUDIT_ANCHOR_PROVIDER = Symbol('AUDIT_ANCHOR_PROVIDER');

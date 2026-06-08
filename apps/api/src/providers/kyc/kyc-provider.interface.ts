/**
 * KYC Provider interface — the pluggable swap layer.
 *
 * MVP: SandboxKycProvider (deterministic fakes).
 * Later: UidaiKycProvider / NsdlKycProvider (requires authorization).
 *
 * Swapping to real providers is a DI change, not a rewrite.
 * This is the single most important design decision in the repo.
 */

export interface KycResult {
  valid: boolean;
  status: 'VERIFIED' | 'FAILED' | 'NOT_FOUND' | 'ERROR';
  details?: Record<string, unknown>;
  verifiedAt: Date;
}

export interface KycProvider {
  /** Verify a PAN (Permanent Account Number). */
  verifyPan(pan: string): Promise<KycResult>;

  /** Verify a GSTIN (Goods and Services Tax Identification Number). */
  verifyGstin(gstin: string): Promise<KycResult>;

  /** Penny-drop bank account verification. */
  pennyDropBank(acct: string, ifsc: string): Promise<KycResult>;
}

/** DI token for the KycProvider interface. */
export const KYC_PROVIDER = Symbol('KYC_PROVIDER');

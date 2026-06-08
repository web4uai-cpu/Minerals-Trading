import { Injectable } from '@nestjs/common';
import { KycProvider, KycResult } from './kyc-provider.interface';

/**
 * Sandbox KYC provider — deterministic fake results for development.
 *
 * Rules:
 * - PAN starting with 'AAAAA' → VERIFIED
 * - PAN starting with 'ZZZZZ' → FAILED
 * - GSTIN starting with '07' (Delhi) → VERIFIED
 * - GSTIN starting with '99' → FAILED
 * - Bank acct '0000000000' → NOT_FOUND
 * - Everything else → VERIFIED (permissive in sandbox)
 *
 * These patterns are documented so test fixtures can rely on them.
 */
@Injectable()
export class SandboxKycProvider implements KycProvider {
  async verifyPan(pan: string): Promise<KycResult> {
    const now = new Date();

    if (pan.startsWith('ZZZZZ')) {
      return {
        valid: false,
        status: 'FAILED',
        details: { reason: 'PAN not found in NSDL registry (sandbox)' },
        verifiedAt: now,
      };
    }

    return {
      valid: true,
      status: 'VERIFIED',
      details: { name: 'SANDBOX ENTITY', panType: 'Company', source: 'sandbox' },
      verifiedAt: now,
    };
  }

  async verifyGstin(gstin: string): Promise<KycResult> {
    const now = new Date();

    if (gstin.startsWith('99')) {
      return {
        valid: false,
        status: 'FAILED',
        details: { reason: 'Invalid GSTIN (sandbox)' },
        verifiedAt: now,
      };
    }

    return {
      valid: true,
      status: 'VERIFIED',
      details: {
        tradeName: 'SANDBOX MINERALS PVT LTD',
        legalName: 'SANDBOX MINERALS PRIVATE LIMITED',
        status: 'Active',
        source: 'sandbox',
      },
      verifiedAt: now,
    };
  }

  async pennyDropBank(acct: string, _ifsc: string): Promise<KycResult> {
    const now = new Date();

    if (acct === '0000000000') {
      return {
        valid: false,
        status: 'NOT_FOUND',
        details: { reason: 'Account does not exist (sandbox)' },
        verifiedAt: now,
      };
    }

    return {
      valid: true,
      status: 'VERIFIED',
      details: {
        accountHolderName: 'SANDBOX ENTITY',
        bankName: 'SANDBOX BANK',
        source: 'sandbox',
      },
      verifiedAt: now,
    };
  }
}

/**
 * Government Data Provider interface — for mining lease lookups
 * and IBM returns verification.
 *
 * MVP: SandboxGovDataProvider with seeded fixture data.
 * Later: Real API integration once govt data access is secured.
 */

export interface LeaseStatus {
  leaseId: string;
  state: string;
  holder: string;
  mineral: string;
  validFrom: Date;
  validUntil: Date;
  status: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'NOT_FOUND';
  area?: string;
  district?: string;
}

export interface IbmReturnResult {
  orgId: string;
  filingYear: number;
  filed: boolean;
  mineral?: string;
  productionMT?: number;
  royaltyPaidPaise?: number;
  status: 'FILED' | 'PENDING' | 'OVERDUE' | 'NOT_FOUND';
}

export interface GovDataProvider {
  fetchMiningLeaseStatus(leaseId: string, state: string): Promise<LeaseStatus>;
  fetchIbmReturns(orgId: string): Promise<IbmReturnResult>;
}

/** DI token for the GovDataProvider interface. */
export const GOV_DATA_PROVIDER = Symbol('GOV_DATA_PROVIDER');

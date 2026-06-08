import { Injectable } from '@nestjs/common';
import { GovDataProvider, LeaseStatus, IbmReturnResult } from './gov-data-provider.interface';

/**
 * Sandbox Government Data Provider — seeded fixture data for development.
 *
 * Patterns:
 * - leaseId starting with 'ML-RJ-' → Rajasthan active lease
 * - leaseId starting with 'ML-OD-' → Odisha active lease
 * - leaseId 'ML-EXPIRED' → expired lease
 * - Anything else → NOT_FOUND
 *
 * - orgId starting with 'org-' → IBM returns filed
 * - orgId 'org-overdue' → overdue returns
 */
@Injectable()
export class SandboxGovDataProvider implements GovDataProvider {
  async fetchMiningLeaseStatus(leaseId: string, state: string): Promise<LeaseStatus> {
    if (leaseId === 'ML-EXPIRED') {
      return {
        leaseId,
        state,
        holder: 'SANDBOX EXPIRED MINES PVT LTD',
        mineral: 'Granite',
        validFrom: new Date('2015-01-01'),
        validUntil: new Date('2020-12-31'),
        status: 'EXPIRED',
        area: '50 hectares',
        district: 'Sandbox District',
      };
    }

    if (leaseId.startsWith('ML-RJ-') || leaseId.startsWith('ML-OD-')) {
      const isRajasthan = leaseId.startsWith('ML-RJ-');
      return {
        leaseId,
        state: isRajasthan ? 'Rajasthan' : 'Odisha',
        holder: isRajasthan ? 'SANDBOX STONE EXPORTS PVT LTD' : 'SANDBOX IRON ORE MINES LTD',
        mineral: isRajasthan ? 'Dimensional Stone' : 'Iron Ore',
        validFrom: new Date('2022-01-01'),
        validUntil: new Date('2042-12-31'),
        status: 'ACTIVE',
        area: isRajasthan ? '25 hectares' : '100 hectares',
        district: isRajasthan ? 'Jaipur' : 'Keonjhar',
      };
    }

    return {
      leaseId,
      state,
      holder: '',
      mineral: '',
      validFrom: new Date(),
      validUntil: new Date(),
      status: 'NOT_FOUND',
    };
  }

  async fetchIbmReturns(orgId: string): Promise<IbmReturnResult> {
    if (orgId === 'org-overdue') {
      return {
        orgId,
        filingYear: new Date().getFullYear() - 1,
        filed: false,
        status: 'OVERDUE',
      };
    }

    return {
      orgId,
      filingYear: new Date().getFullYear() - 1,
      filed: true,
      mineral: 'Iron Ore',
      productionMT: 50000,
      royaltyPaidPaise: 2500000000, // ₹2.5 crore
      status: 'FILED',
    };
  }
}

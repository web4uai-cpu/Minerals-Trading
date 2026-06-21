import { OrgType, OrgStatus } from '@khanij/types';

export const VERIFIED_SELLER_ORG = {
  id: 'org_seller_verified_01',
  type: OrgType.SELLER,
  legalName: 'Odisha Minerals Pvt Ltd',
  state: 'Odisha',
  status: OrgStatus.VERIFIED,
} as const;

export const PENDING_BUYER_ORG = {
  id: 'org_buyer_pending_01',
  type: OrgType.BUYER,
  legalName: 'Steel Works India Ltd',
  state: 'Jharkhand',
  status: OrgStatus.PENDING,
} as const;

export const VERIFIED_BUYER_ORG = {
  id: 'org_buyer_verified_01',
  type: OrgType.BUYER,
  legalName: 'Tata Steel Procurement',
  state: 'Jharkhand',
  status: OrgStatus.VERIFIED,
} as const;

export const SUSPENDED_TRADER_ORG = {
  id: 'org_trader_suspended_01',
  type: OrgType.TRADER,
  legalName: 'Mineral Traders Co',
  state: 'Karnataka',
  status: OrgStatus.SUSPENDED,
} as const;

export const ARBITRATION_BODY_ORG = {
  id: 'org_arb_01',
  type: OrgType.ARBITRATION_BODY,
  legalName: 'India Minerals Arbitration Council',
  state: 'Delhi',
  status: OrgStatus.VERIFIED,
} as const;

import { UserRole, UserStatus } from '@khanij/types';

export const SELLER_USER = {
  id: 'user_seller_01',
  orgId: 'org_seller_verified_01',
  email: 'seller@odishaminerals.in',
  role: UserRole.SELLER,
  status: UserStatus.ACTIVE,
} as const;

export const BUYER_USER = {
  id: 'user_buyer_01',
  orgId: 'org_buyer_verified_01',
  email: 'buyer@steelworks.in',
  role: UserRole.BUYER,
  status: UserStatus.ACTIVE,
} as const;

export const ADMIN_USER = {
  id: 'user_admin_01',
  orgId: 'org_admin_01',
  email: 'admin@khanijnexus.in',
  role: UserRole.ADMIN,
  status: UserStatus.ACTIVE,
} as const;

export const ARBITRATOR_USER = {
  id: 'user_arbitrator_01',
  orgId: 'org_arb_01',
  email: 'arbitrator@imac.in',
  role: UserRole.ARBITRATOR,
  status: UserStatus.ACTIVE,
} as const;

export const REGULATOR_USER = {
  id: 'user_regulator_01',
  orgId: 'org_regulator_01',
  email: 'regulator@ibm.gov.in',
  role: UserRole.REGULATOR_READONLY,
  status: UserStatus.ACTIVE,
} as const;

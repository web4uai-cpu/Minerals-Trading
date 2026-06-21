import { ComplianceItemType } from '@khanij/types';

export const ITEM_WEIGHTS: Record<ComplianceItemType, number> = {
  [ComplianceItemType.MINING_LEASE]: 20,
  [ComplianceItemType.ENV_CLEARANCE]: 15,
  [ComplianceItemType.IBM_RETURNS]: 15,
  [ComplianceItemType.ROYALTY_CLEARANCE]: 15,
  [ComplianceItemType.SPCB_NOC]: 10,
  [ComplianceItemType.GST_REG]: 10,
  [ComplianceItemType.PAN]: 5,
  [ComplianceItemType.BANK_VERIFICATION]: 10,
  [ComplianceItemType.FOREST_CLEARANCE]: 5,
  [ComplianceItemType.IEC]: 5,
  [ComplianceItemType.END_USE_DECLARATION]: 5,
  [ComplianceItemType.INDUSTRY_REGISTRATION]: 5,
};

export const REQUIRED_ITEMS_BY_ORG_TYPE: Record<string, ComplianceItemType[]> = {
  SELLER: [
    ComplianceItemType.MINING_LEASE,
    ComplianceItemType.ENV_CLEARANCE,
    ComplianceItemType.IBM_RETURNS,
    ComplianceItemType.ROYALTY_CLEARANCE,
    ComplianceItemType.SPCB_NOC,
    ComplianceItemType.GST_REG,
    ComplianceItemType.PAN,
    ComplianceItemType.BANK_VERIFICATION,
  ],
  BUYER: [
    ComplianceItemType.GST_REG,
    ComplianceItemType.PAN,
    ComplianceItemType.BANK_VERIFICATION,
    ComplianceItemType.END_USE_DECLARATION,
  ],
  TRADER: [
    ComplianceItemType.GST_REG,
    ComplianceItemType.PAN,
    ComplianceItemType.BANK_VERIFICATION,
  ],
  EXPORTER: [
    ComplianceItemType.GST_REG,
    ComplianceItemType.PAN,
    ComplianceItemType.BANK_VERIFICATION,
    ComplianceItemType.IEC,
  ],
  ARBITRATION_BODY: [
    ComplianceItemType.GST_REG,
    ComplianceItemType.PAN,
    ComplianceItemType.INDUSTRY_REGISTRATION,
  ],
};

export const COMPLIANCE_ITEM_LABELS: Record<ComplianceItemType, string> = {
  [ComplianceItemType.MINING_LEASE]: 'Mining Lease',
  [ComplianceItemType.ENV_CLEARANCE]: 'Environmental Clearance',
  [ComplianceItemType.FOREST_CLEARANCE]: 'Forest Clearance',
  [ComplianceItemType.IBM_RETURNS]: 'IBM Annual Returns',
  [ComplianceItemType.ROYALTY_CLEARANCE]: 'Royalty Clearance Certificate',
  [ComplianceItemType.SPCB_NOC]: 'SPCB No Objection Certificate',
  [ComplianceItemType.GST_REG]: 'GST Registration',
  [ComplianceItemType.PAN]: 'PAN Card',
  [ComplianceItemType.BANK_VERIFICATION]: 'Bank Account Verification',
  [ComplianceItemType.IEC]: 'Import Export Code',
  [ComplianceItemType.END_USE_DECLARATION]: 'End Use Declaration',
  [ComplianceItemType.INDUSTRY_REGISTRATION]: 'Industry Registration',
};

/**
 * Pure business logic for international trade eligibility.
 * No NestJS, no Prisma — just rules.
 */

export interface TradeEligibilityContext {
  orgType: string;
  hasIec: boolean;
  iecVerified: boolean;
  orgVerified: boolean;
  direction: 'EXPORT' | 'IMPORT';
  mineralName: string;
  destinationCountry: string;
}

export interface TradeEligibilityResult {
  eligible: boolean;
  reasons: string[];
  requiredDocuments: string[];
}

/** Minerals that require additional DGFT approval for export. */
const RESTRICTED_EXPORT_MINERALS = ['iron ore'];

/**
 * Check whether an organization is eligible for international trade
 * in the given direction, mineral, and destination.
 */
export function checkTradeEligibility(
  context: TradeEligibilityContext,
): TradeEligibilityResult {
  const reasons: string[] = [];
  const requiredDocuments: string[] = [];

  // 1. Org must be VERIFIED
  if (!context.orgVerified) {
    reasons.push('Organization must be VERIFIED to engage in international trade');
  }

  // 2. IEC is required for both export and import
  if (!context.hasIec) {
    reasons.push('Import Export Code (IEC) is required for international trade');
  } else if (!context.iecVerified) {
    reasons.push('IEC must be verified before trade applications can be submitted');
  }

  // Common required documents
  requiredDocuments.push('Import Export Code (IEC)');

  if (context.direction === 'EXPORT') {
    // Exporter org type required
    if (context.orgType !== 'EXPORTER' && context.orgType !== 'TRADER') {
      reasons.push(
        'Organization type must be EXPORTER or TRADER for export transactions',
      );
    }

    // Restricted minerals need DGFT licence
    const mineralLower = context.mineralName.toLowerCase();
    if (RESTRICTED_EXPORT_MINERALS.some((m) => mineralLower.includes(m))) {
      requiredDocuments.push('DGFT Export Licence (restricted mineral)');
    }

    requiredDocuments.push('Shipping Bill');
    requiredDocuments.push('Bill of Lading');
    requiredDocuments.push('Certificate of Origin');
  }

  if (context.direction === 'IMPORT') {
    requiredDocuments.push('End-Use Declaration');
    requiredDocuments.push('Bill of Entry');
    requiredDocuments.push('Bill of Lading');
    requiredDocuments.push('Certificate of Origin');
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    requiredDocuments,
  };
}

/**
 * Country-level trade rules — sanctioned/restricted countries,
 * required documents by destination, and treaty preferences.
 *
 * Source: India's DGFT / MEA / OFAC-equivalent sanctions lists.
 * This is a sandbox approximation — real compliance needs live feeds.
 */

export interface CountryTradeContext {
  countryCode: string;
  direction: 'EXPORT' | 'IMPORT';
  mineralName: string;
}

export interface CountryTradeResult {
  allowed: boolean;
  reasons: string[];
  additionalDocuments: string[];
  dutyCategory: 'ZERO' | 'PREFERENTIAL' | 'MFN' | 'RESTRICTED';
}

const SANCTIONED_COUNTRIES = new Set([
  'KP', // North Korea
  'IR', // Iran (partial — minerals restricted)
  'SY', // Syria
]);

const RESTRICTED_EXPORT_DESTINATIONS = new Set([
  'CN', // China — iron ore export restrictions
  'PK', // Pakistan — strategic minerals restricted
]);

const FTA_COUNTRIES = new Set([
  'JP', // India-Japan CEPA
  'KR', // India-Korea CEPA
  'SG', // India-Singapore CECA
  'TH', // India-Thailand FTA
  'LK', // India-Sri Lanka FTA
  'MY', // India-Malaysia CECA
  'AE', // India-UAE CEPA
  'AU', // India-Australia ECTA
]);

const STRATEGIC_MINERALS = [
  'lithium',
  'cobalt',
  'rare earth',
  'uranium',
  'thorium',
  'beryllium',
];

export function checkCountryTradeRules(
  context: CountryTradeContext,
): CountryTradeResult {
  const reasons: string[] = [];
  const additionalDocuments: string[] = [];
  let dutyCategory: CountryTradeResult['dutyCategory'] = 'MFN';

  const code = context.countryCode.toUpperCase();
  const mineralLower = context.mineralName.toLowerCase();

  if (SANCTIONED_COUNTRIES.has(code)) {
    reasons.push(
      `Trade with ${code} is prohibited under India's sanctions regime`,
    );
    return { allowed: false, reasons, additionalDocuments, dutyCategory: 'RESTRICTED' };
  }

  if (
    context.direction === 'EXPORT' &&
    RESTRICTED_EXPORT_DESTINATIONS.has(code)
  ) {
    additionalDocuments.push('DGFT Special Export Licence');
    additionalDocuments.push('End-User Certificate from destination country');
  }

  const isStrategic = STRATEGIC_MINERALS.some((m) => mineralLower.includes(m));
  if (isStrategic) {
    additionalDocuments.push('Department of Atomic Energy (DAE) clearance');
    if (context.direction === 'EXPORT') {
      additionalDocuments.push('Strategic mineral export permit');
    }
  }

  if (FTA_COUNTRIES.has(code)) {
    dutyCategory = 'PREFERENTIAL';
    additionalDocuments.push('Certificate of Origin (preferential)');
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    additionalDocuments,
    dutyCategory,
  };
}

export function isValidCountryCode(code: string): boolean {
  return /^[A-Z]{2}$/.test(code);
}

export { SANCTIONED_COUNTRIES, FTA_COUNTRIES, RESTRICTED_EXPORT_DESTINATIONS };

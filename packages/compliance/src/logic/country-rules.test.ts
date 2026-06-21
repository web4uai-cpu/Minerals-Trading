import {
  checkCountryTradeRules,
  isValidCountryCode,
  CountryTradeContext,
} from './country-rules';

describe('checkCountryTradeRules', () => {
  const baseContext: CountryTradeContext = {
    countryCode: 'JP',
    direction: 'EXPORT',
    mineralName: 'Manganese Ore',
  };

  it('should allow trade with non-sanctioned country', () => {
    const result = checkCountryTradeRules(baseContext);
    expect(result.allowed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('should block trade with sanctioned country (North Korea)', () => {
    const result = checkCountryTradeRules({
      ...baseContext,
      countryCode: 'KP',
    });
    expect(result.allowed).toBe(false);
    expect(result.reasons[0]).toContain('prohibited');
    expect(result.dutyCategory).toBe('RESTRICTED');
  });

  it('should block trade with Iran', () => {
    const result = checkCountryTradeRules({
      ...baseContext,
      countryCode: 'IR',
    });
    expect(result.allowed).toBe(false);
  });

  it('should require special licence for restricted export destinations (China)', () => {
    const result = checkCountryTradeRules({
      ...baseContext,
      countryCode: 'CN',
    });
    expect(result.allowed).toBe(true);
    expect(result.additionalDocuments).toContain('DGFT Special Export Licence');
    expect(result.additionalDocuments).toContain(
      'End-User Certificate from destination country',
    );
  });

  it('should not require special licence for import from restricted country', () => {
    const result = checkCountryTradeRules({
      ...baseContext,
      countryCode: 'CN',
      direction: 'IMPORT',
    });
    expect(result.allowed).toBe(true);
    expect(result.additionalDocuments).not.toContain('DGFT Special Export Licence');
  });

  it('should apply preferential duty for FTA countries', () => {
    const result = checkCountryTradeRules(baseContext);
    expect(result.dutyCategory).toBe('PREFERENTIAL');
    expect(result.additionalDocuments).toContain(
      'Certificate of Origin (preferential)',
    );
  });

  it('should apply MFN duty for non-FTA countries', () => {
    const result = checkCountryTradeRules({
      ...baseContext,
      countryCode: 'US',
    });
    expect(result.dutyCategory).toBe('MFN');
  });

  it('should require DAE clearance for strategic minerals', () => {
    const result = checkCountryTradeRules({
      ...baseContext,
      mineralName: 'Lithium Carbonate',
    });
    expect(result.allowed).toBe(true);
    expect(result.additionalDocuments).toContain(
      'Department of Atomic Energy (DAE) clearance',
    );
    expect(result.additionalDocuments).toContain(
      'Strategic mineral export permit',
    );
  });

  it('should not require export permit for strategic mineral imports', () => {
    const result = checkCountryTradeRules({
      ...baseContext,
      direction: 'IMPORT',
      mineralName: 'Rare Earth Oxide',
    });
    expect(result.additionalDocuments).toContain(
      'Department of Atomic Energy (DAE) clearance',
    );
    expect(result.additionalDocuments).not.toContain(
      'Strategic mineral export permit',
    );
  });
});

describe('isValidCountryCode', () => {
  it('should accept valid ISO 3166 alpha-2 codes', () => {
    expect(isValidCountryCode('IN')).toBe(true);
    expect(isValidCountryCode('JP')).toBe(true);
    expect(isValidCountryCode('US')).toBe(true);
  });

  it('should reject invalid codes', () => {
    expect(isValidCountryCode('in')).toBe(false);
    expect(isValidCountryCode('IND')).toBe(false);
    expect(isValidCountryCode('')).toBe(false);
    expect(isValidCountryCode('1A')).toBe(false);
  });
});

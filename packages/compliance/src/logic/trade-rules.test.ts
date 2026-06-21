import { checkTradeEligibility, TradeEligibilityContext } from './trade-rules';

describe('checkTradeEligibility', () => {
  const baseExportContext: TradeEligibilityContext = {
    orgType: 'EXPORTER',
    hasIec: true,
    iecVerified: true,
    orgVerified: true,
    direction: 'EXPORT',
    mineralName: 'Manganese Ore',
    destinationCountry: 'Japan',
  };

  const baseImportContext: TradeEligibilityContext = {
    orgType: 'BUYER',
    hasIec: true,
    iecVerified: true,
    orgVerified: true,
    direction: 'IMPORT',
    mineralName: 'Lithium',
    destinationCountry: 'Australia',
  };

  it('should allow eligible export with IEC', () => {
    const result = checkTradeEligibility(baseExportContext);
    expect(result.eligible).toBe(true);
    expect(result.reasons).toHaveLength(0);
    expect(result.requiredDocuments).toContain('Import Export Code (IEC)');
    expect(result.requiredDocuments).toContain('Shipping Bill');
  });

  it('should reject export without IEC', () => {
    const result = checkTradeEligibility({
      ...baseExportContext,
      hasIec: false,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain(
      'Import Export Code (IEC) is required for international trade',
    );
  });

  it('should reject without org verification', () => {
    const result = checkTradeEligibility({
      ...baseExportContext,
      orgVerified: false,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain(
      'Organization must be VERIFIED to engage in international trade',
    );
  });

  it('should allow eligible import', () => {
    const result = checkTradeEligibility(baseImportContext);
    expect(result.eligible).toBe(true);
    expect(result.reasons).toHaveLength(0);
    expect(result.requiredDocuments).toContain('End-Use Declaration');
    expect(result.requiredDocuments).toContain('Bill of Entry');
  });

  it('should list required documents for export', () => {
    const result = checkTradeEligibility(baseExportContext);
    expect(result.requiredDocuments).toContain('Import Export Code (IEC)');
    expect(result.requiredDocuments).toContain('Shipping Bill');
    expect(result.requiredDocuments).toContain('Bill of Lading');
    expect(result.requiredDocuments).toContain('Certificate of Origin');
  });

  it('should require DGFT licence for restricted minerals (iron ore)', () => {
    const result = checkTradeEligibility({
      ...baseExportContext,
      mineralName: 'Iron Ore 62% Fe',
    });
    expect(result.eligible).toBe(true);
    expect(result.requiredDocuments).toContain(
      'DGFT Export Licence (restricted mineral)',
    );
  });

  it('should reject export for non-EXPORTER/TRADER org types', () => {
    const result = checkTradeEligibility({
      ...baseExportContext,
      orgType: 'BUYER',
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain(
      'Organization type must be EXPORTER or TRADER for export transactions',
    );
  });

  it('should reject when IEC exists but is not verified', () => {
    const result = checkTradeEligibility({
      ...baseExportContext,
      hasIec: true,
      iecVerified: false,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain(
      'IEC must be verified before trade applications can be submitted',
    );
  });
});

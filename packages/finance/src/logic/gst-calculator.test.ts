import { computeGst } from './gst-calculator';

describe('computeGst', () => {
  it('applies 5% GST for iron ore (HSN 2601)', () => {
    const result = computeGst({
      baseAmountPaise: 1_000_000n, // ₹10,000
      sellerState: 'Jharkhand',
      buyerState: 'Odisha',
      hsnCode: '26011100',
    });

    expect(result.gstRate).toBe(0.05);
    expect(result.totalTaxPaise).toBe(50_000n); // 5% of ₹10,000
  });

  it('applies 12% GST for dimensional stone (HSN 6802)', () => {
    const result = computeGst({
      baseAmountPaise: 1_000_000n,
      sellerState: 'Rajasthan',
      buyerState: 'Gujarat',
      hsnCode: '68021000',
    });

    expect(result.gstRate).toBe(0.12);
    expect(result.totalTaxPaise).toBe(120_000n); // 12% of ₹10,000
  });

  it('applies default 18% GST for unknown HSN codes', () => {
    const result = computeGst({
      baseAmountPaise: 1_000_000n,
      sellerState: 'Maharashtra',
      buyerState: 'Karnataka',
      hsnCode: '9999',
    });

    expect(result.gstRate).toBe(0.18);
    expect(result.totalTaxPaise).toBe(180_000n);
  });

  it('sets IGST only for interstate supply (CGST=0, SGST=0)', () => {
    const result = computeGst({
      baseAmountPaise: 2_000_000n,
      sellerState: 'Jharkhand',
      buyerState: 'West Bengal',
      hsnCode: '2601',
    });

    expect(result.isInterstate).toBe(true);
    expect(result.igstPaise).toBe(100_000n);
    expect(result.cgstPaise).toBe(0n);
    expect(result.sgstPaise).toBe(0n);
  });

  it('splits CGST + SGST for intrastate supply (no IGST)', () => {
    const result = computeGst({
      baseAmountPaise: 2_000_000n,
      sellerState: 'Rajasthan',
      buyerState: 'Rajasthan',
      hsnCode: '2601',
    });

    expect(result.isInterstate).toBe(false);
    expect(result.igstPaise).toBe(0n);
    expect(result.cgstPaise).toBe(50_000n);
    expect(result.sgstPaise).toBe(50_000n);
  });

  it('ensures CGST + SGST sum equals total tax exactly', () => {
    // Use an odd tax amount that doesn't split evenly
    const result = computeGst({
      baseAmountPaise: 1_000_001n,
      sellerState: 'karnataka',
      buyerState: 'KARNATAKA',
      hsnCode: '2601',
    });

    expect(result.isInterstate).toBe(false);
    expect(result.cgstPaise + result.sgstPaise).toBe(result.totalTaxPaise);
  });

  it('preserves precision with large amounts (no floating point)', () => {
    // ₹50 crore = 50_00_00_000 rupees = 50_00_00_000_00 paise
    const baseAmountPaise = 50_00_00_000_00n;
    const result = computeGst({
      baseAmountPaise,
      sellerState: 'Odisha',
      buyerState: 'Jharkhand',
      hsnCode: '2601',
    });

    // 5% of ₹50 crore = ₹2.5 crore
    expect(result.totalTaxPaise).toBe(2_50_00_000_00n);
    expect(result.totalWithTaxPaise).toBe(baseAmountPaise + 2_50_00_000_00n);
  });

  it('handles case-insensitive state comparison', () => {
    const result = computeGst({
      baseAmountPaise: 100_000n,
      sellerState: 'RAJASTHAN',
      buyerState: 'rajasthan',
      hsnCode: '2601',
    });

    expect(result.isInterstate).toBe(false);
  });

  it('throws on negative base amount', () => {
    expect(() =>
      computeGst({
        baseAmountPaise: -100n,
        sellerState: 'Odisha',
        buyerState: 'Jharkhand',
        hsnCode: '2601',
      }),
    ).toThrow('baseAmountPaise must be non-negative');
  });

  it('handles zero base amount', () => {
    const result = computeGst({
      baseAmountPaise: 0n,
      sellerState: 'Odisha',
      buyerState: 'Jharkhand',
      hsnCode: '2601',
    });

    expect(result.totalTaxPaise).toBe(0n);
    expect(result.totalWithTaxPaise).toBe(0n);
  });
});

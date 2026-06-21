import { generateInvoice, paiseToWords } from './invoice-generator';

describe('generateInvoice', () => {
  const baseInput = {
    dealId: 'deal-001',
    invoiceNumber: 'KN-INV-2025-0001',
    sellerName: 'Odisha Mining Corp',
    sellerGstin: '21AABCU9603R1ZM',
    sellerState: 'Odisha',
    buyerName: 'Tata Steel Ltd',
    buyerGstin: '20AABCT1332L1ZR',
    buyerState: 'Jharkhand',
    mineralName: 'Iron Ore Fines (Fe 62%)',
    hsnCode: '26011190',
    quantity: 500,
    unit: 'MT',
    ratePerUnitPaise: 450_000n, // ₹4,500/MT
    date: '2025-01-15',
  };

  it('generates invoice with correct line items', () => {
    const invoice = generateInvoice(baseInput);

    expect(invoice.invoiceNumber).toBe('KN-INV-2025-0001');
    expect(invoice.dealId).toBe('deal-001');
    expect(invoice.date).toBe('2025-01-15');
    expect(invoice.seller.name).toBe('Odisha Mining Corp');
    expect(invoice.buyer.name).toBe('Tata Steel Ltd');
    expect(invoice.lineItems).toHaveLength(1);
    const line = invoice.lineItems[0]!;
    expect(line.description).toBe('Iron Ore Fines (Fe 62%)');
    expect(line.quantity).toBe(500);
    expect(line.unit).toBe('MT');
    expect(line.ratePerUnitPaise).toBe(450_000n);
    // 500 * ₹4,500 = ₹22,50,000
    expect(line.amountPaise).toBe(225_000_000n);
  });

  it('includes correct GST breakdown', () => {
    const invoice = generateInvoice(baseInput);

    // Interstate (Odisha → Jharkhand) iron ore = 5% IGST
    expect(invoice.gst.isInterstate).toBe(true);
    expect(invoice.gst.gstRate).toBe(0.05);
    expect(invoice.gst.igstPaise).toBe(11_250_000n); // 5% of ₹22,50,000
    expect(invoice.gst.cgstPaise).toBe(0n);
    expect(invoice.gst.sgstPaise).toBe(0n);
  });

  it('calculates grand total = subtotal + tax', () => {
    const invoice = generateInvoice(baseInput);

    expect(invoice.grandTotalPaise).toBe(
      invoice.subtotalPaise + invoice.gst.totalTaxPaise,
    );
    // ₹22,50,000 + ₹1,12,500 = ₹23,62,500
    expect(invoice.grandTotalPaise).toBe(236_250_000n);
  });

  it('generates amount in words for typical deal amount', () => {
    const invoice = generateInvoice(baseInput);

    // ₹23,62,500 = "Rupees Twenty-Three Lakh Sixty-Two Thousand Five Hundred Only"
    expect(invoice.amountInWords).toBe(
      'Rupees Twenty-Three Lakh Sixty-Two Thousand Five Hundred Only',
    );
  });

  it('defaults date to today if not provided', () => {
    const { date: _, ...inputWithoutDate } = baseInput;
    const invoice = generateInvoice(inputWithoutDate);

    // Should be an ISO date string (YYYY-MM-DD)
    expect(invoice.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('throws for zero quantity', () => {
    expect(() =>
      generateInvoice({ ...baseInput, quantity: 0 }),
    ).toThrow('quantity must be positive');
  });
});

describe('paiseToWords', () => {
  it('converts zero', () => {
    expect(paiseToWords(0n)).toBe('Rupees Zero Only');
  });

  it('converts round rupee amounts', () => {
    expect(paiseToWords(100_00n)).toBe('Rupees One Hundred Only');
  });

  it('handles paise remainder', () => {
    expect(paiseToWords(10_050n)).toBe('Rupees One Hundred and Fifty Paise Only');
  });

  it('converts large Indian amounts (lakh/crore)', () => {
    // ₹62,50,000
    expect(paiseToWords(62_50_000_00n)).toBe(
      'Rupees Sixty-Two Lakh Fifty Thousand Only',
    );
  });

  it('converts crore amounts', () => {
    // ₹5,00,00,000
    expect(paiseToWords(5_00_00_000_00n)).toBe('Rupees Five Crore Only');
  });
});

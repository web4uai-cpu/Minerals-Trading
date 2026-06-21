/**
 * Invoice Generator — pure business logic for generating tax invoices
 * for mineral deals on Khanij Nexus.
 *
 * All amounts in paise (bigint). No floats.
 */

import { computeGst, type GstBreakdown } from './gst-calculator';

export interface InvoiceLineItem {
  description: string;
  hsnCode: string;
  quantity: number;
  unit: string;
  ratePerUnitPaise: bigint;
  amountPaise: bigint;
}

export interface InvoiceInput {
  dealId: string;
  invoiceNumber: string;
  sellerName: string;
  sellerGstin: string;
  sellerState: string;
  buyerName: string;
  buyerGstin: string;
  buyerState: string;
  mineralName: string;
  hsnCode: string;
  quantity: number;
  unit: string;
  ratePerUnitPaise: bigint;
  /** Optional ISO date string; defaults to current date */
  date?: string;
}

export interface GeneratedInvoice {
  invoiceNumber: string;
  dealId: string;
  date: string;
  seller: { name: string; gstin: string; state: string };
  buyer: { name: string; gstin: string; state: string };
  lineItems: InvoiceLineItem[];
  subtotalPaise: bigint;
  gst: GstBreakdown;
  grandTotalPaise: bigint;
  amountInWords: string;
}

// ---------------------------------------------------------------------------
// Number-to-words helpers (Indian numbering system up to 100 crore)
// ---------------------------------------------------------------------------

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n] ?? '';
  const ten = Math.floor(n / 10);
  const one = n % 10;
  const tenWord = TENS[ten] ?? '';
  const oneWord = ONES[one] ?? '';
  return one === 0 ? tenWord : `${tenWord}-${oneWord}`;
}

function threeDigitsToWords(n: number): string {
  if (n === 0) return '';
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;
  const hundredWord = ONES[hundreds] ?? '';
  if (hundreds === 0) return twoDigitsToWords(remainder);
  if (remainder === 0) return `${hundredWord} Hundred`;
  return `${hundredWord} Hundred ${twoDigitsToWords(remainder)}`;
}

/**
 * Convert a non-negative integer to Indian-style words.
 * Supports up to 99,99,99,999 (i.e. < 100 crore).
 */
function integerToIndianWords(n: number): string {
  if (n === 0) return 'Zero';
  if (n < 0 || n >= 10_000_000_000) {
    throw new Error('Amount out of supported range for words conversion');
  }

  const parts: string[] = [];

  // Crore (1,00,00,000)
  const crore = Math.floor(n / 10_000_000);
  if (crore > 0) {
    parts.push(`${twoDigitsToWords(crore)} Crore`);
    n %= 10_000_000;
  }

  // Lakh (1,00,000)
  const lakh = Math.floor(n / 100_000);
  if (lakh > 0) {
    parts.push(`${twoDigitsToWords(lakh)} Lakh`);
    n %= 100_000;
  }

  // Thousand (1,000)
  const thousand = Math.floor(n / 1_000);
  if (thousand > 0) {
    parts.push(`${twoDigitsToWords(thousand)} Thousand`);
    n %= 1_000;
  }

  // Hundreds, tens, ones
  const rest = threeDigitsToWords(n);
  if (rest) parts.push(rest);

  return parts.join(' ');
}

/**
 * Convert paise (bigint) to Indian Rupees words.
 * E.g. 6250000_00n → "Rupees Sixty-Two Lakh Fifty Thousand Only"
 */
export function paiseToWords(paise: bigint): string {
  const rupees = Number(paise / 100n);
  const paisePart = Number(paise % 100n);

  if (rupees === 0 && paisePart === 0) {
    return 'Rupees Zero Only';
  }

  let result = `Rupees ${integerToIndianWords(rupees)}`;
  if (paisePart > 0) {
    result += ` and ${integerToIndianWords(paisePart)} Paise`;
  }
  result += ' Only';
  return result;
}

// ---------------------------------------------------------------------------
// Invoice generation
// ---------------------------------------------------------------------------

export function generateInvoice(input: InvoiceInput): GeneratedInvoice {
  const {
    dealId,
    invoiceNumber,
    sellerName,
    sellerGstin,
    sellerState,
    buyerName,
    buyerGstin,
    buyerState,
    mineralName,
    hsnCode,
    quantity,
    unit,
    ratePerUnitPaise,
    date,
  } = input;

  if (quantity <= 0) {
    throw new Error('quantity must be positive');
  }
  if (ratePerUnitPaise <= 0n) {
    throw new Error('ratePerUnitPaise must be positive');
  }

  const lineAmountPaise = ratePerUnitPaise * BigInt(Math.round(quantity * 1000)) / 1000n;

  const lineItem: InvoiceLineItem = {
    description: mineralName,
    hsnCode,
    quantity,
    unit,
    ratePerUnitPaise,
    amountPaise: lineAmountPaise,
  };

  const subtotalPaise = lineAmountPaise;

  const gst = computeGst({
    baseAmountPaise: subtotalPaise,
    sellerState,
    buyerState,
    hsnCode,
  });

  const grandTotalPaise = gst.totalWithTaxPaise;

  return {
    invoiceNumber,
    dealId,
    date: date ?? new Date().toISOString().slice(0, 10),
    seller: { name: sellerName, gstin: sellerGstin, state: sellerState },
    buyer: { name: buyerName, gstin: buyerGstin, state: buyerState },
    lineItems: [lineItem],
    subtotalPaise,
    gst,
    grandTotalPaise,
    amountInWords: paiseToWords(grandTotalPaise),
  };
}

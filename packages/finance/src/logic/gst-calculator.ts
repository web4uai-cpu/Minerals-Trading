/**
 * GST Calculator — pure business logic for India's Goods & Services Tax
 * on mineral ores and related commodities.
 *
 * All amounts in paise (bigint). No floats.
 */

export interface GstInput {
  baseAmountPaise: bigint;
  sellerState: string;
  buyerState: string;
  hsnCode: string;
}

export interface GstBreakdown {
  baseAmountPaise: bigint;
  /** Decimal rate, e.g. 0.05 for 5% */
  gstRate: number;
  isInterstate: boolean;
  /** Full GST amount when interstate; 0n when intrastate */
  igstPaise: bigint;
  /** Half of GST when intrastate (floor); 0n when interstate */
  cgstPaise: bigint;
  /** Half of GST when intrastate (ceiling to preserve sum); 0n when interstate */
  sgstPaise: bigint;
  totalTaxPaise: bigint;
  totalWithTaxPaise: bigint;
}

/**
 * HSN-prefix to GST rate mapping.
 * Ordered most-specific first; first match wins.
 */
const HSN_GST_RATES: ReadonlyArray<{ prefix: string; rate: number; ratePercent: bigint }> = [
  // Mineral ores (HSN 2601–2617): 5%
  { prefix: '2601', rate: 0.05, ratePercent: 5n },
  { prefix: '2602', rate: 0.05, ratePercent: 5n },
  { prefix: '2603', rate: 0.05, ratePercent: 5n },
  { prefix: '2604', rate: 0.05, ratePercent: 5n },
  { prefix: '2605', rate: 0.05, ratePercent: 5n },
  { prefix: '2606', rate: 0.05, ratePercent: 5n },
  { prefix: '2607', rate: 0.05, ratePercent: 5n },
  { prefix: '2608', rate: 0.05, ratePercent: 5n },
  { prefix: '2609', rate: 0.05, ratePercent: 5n },
  { prefix: '2610', rate: 0.05, ratePercent: 5n },
  { prefix: '2611', rate: 0.05, ratePercent: 5n },
  { prefix: '2612', rate: 0.05, ratePercent: 5n },
  { prefix: '2613', rate: 0.05, ratePercent: 5n },
  { prefix: '2614', rate: 0.05, ratePercent: 5n },
  { prefix: '2615', rate: 0.05, ratePercent: 5n },
  { prefix: '2616', rate: 0.05, ratePercent: 5n },
  { prefix: '2617', rate: 0.05, ratePercent: 5n },
  // Limestone
  { prefix: '2521', rate: 0.05, ratePercent: 5n },
  // Dimensional stone
  { prefix: '6802', rate: 0.12, ratePercent: 12n },
];

/** Default GST rate (conservative — fail closed) */
const DEFAULT_RATE = 0.18;
const DEFAULT_RATE_PERCENT = 18n;

function lookupRate(hsnCode: string): { rate: number; ratePercent: bigint } {
  const trimmed = hsnCode.trim();
  for (const entry of HSN_GST_RATES) {
    if (trimmed.startsWith(entry.prefix)) {
      return { rate: entry.rate, ratePercent: entry.ratePercent };
    }
  }
  return { rate: DEFAULT_RATE, ratePercent: DEFAULT_RATE_PERCENT };
}

export function computeGst(input: GstInput): GstBreakdown {
  const { baseAmountPaise, sellerState, buyerState, hsnCode } = input;

  if (baseAmountPaise < 0n) {
    throw new Error('baseAmountPaise must be non-negative');
  }

  const { rate, ratePercent } = lookupRate(hsnCode);
  const isInterstate = sellerState.toLowerCase().trim() !== buyerState.toLowerCase().trim();

  // Tax = base * ratePercent / 100  (integer arithmetic, no floats)
  const totalTaxPaise = (baseAmountPaise * ratePercent) / 100n;

  let igstPaise: bigint;
  let cgstPaise: bigint;
  let sgstPaise: bigint;

  if (isInterstate) {
    igstPaise = totalTaxPaise;
    cgstPaise = 0n;
    sgstPaise = 0n;
  } else {
    igstPaise = 0n;
    // Floor for CGST, remainder for SGST to preserve exact sum
    cgstPaise = totalTaxPaise / 2n;
    sgstPaise = totalTaxPaise - cgstPaise;
  }

  return {
    baseAmountPaise,
    gstRate: rate,
    isInterstate,
    igstPaise,
    cgstPaise,
    sgstPaise,
    totalTaxPaise,
    totalWithTaxPaise: baseAmountPaise + totalTaxPaise,
  };
}

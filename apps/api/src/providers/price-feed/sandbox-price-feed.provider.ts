import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PriceFeedProvider, ReferencePriceResult } from './price-feed-provider.interface';

/**
 * Sandbox Price Feed Provider — seeded district-wise reference prices for development.
 *
 * Also writes every lookup as a snapshot into the price_history table
 * (raw SQL since it's a TimescaleDB hypertable, not a Prisma model).
 */

interface PriceBand {
  fairLow: number;   // paise per MT
  fairHigh: number;
  refPrice: number;
}

/** Seeded reference prices: mineral name → state → price band. */
const REFERENCE_PRICES: Record<string, Record<string, PriceBand>> = {
  'Iron Ore': {
    Odisha: { fairLow: 550000, fairHigh: 620000, refPrice: 585000 },
    Jharkhand: { fairLow: 520000, fairHigh: 600000, refPrice: 560000 },
    Karnataka: { fairLow: 560000, fairHigh: 640000, refPrice: 600000 },
    Chhattisgarh: { fairLow: 510000, fairHigh: 580000, refPrice: 545000 },
    Goa: { fairLow: 480000, fairHigh: 550000, refPrice: 515000 },
    _default: { fairLow: 530000, fairHigh: 610000, refPrice: 570000 },
  },
  'Limestone': {
    Rajasthan: { fairLow: 120000, fairHigh: 180000, refPrice: 150000 },
    'Andhra Pradesh': { fairLow: 130000, fairHigh: 190000, refPrice: 160000 },
    'Madhya Pradesh': { fairLow: 110000, fairHigh: 170000, refPrice: 140000 },
    _default: { fairLow: 125000, fairHigh: 175000, refPrice: 150000 },
  },
  'Manganese Ore': {
    Odisha: { fairLow: 800000, fairHigh: 1100000, refPrice: 950000 },
    Maharashtra: { fairLow: 750000, fairHigh: 1050000, refPrice: 900000 },
    'Madhya Pradesh': { fairLow: 780000, fairHigh: 1080000, refPrice: 930000 },
    _default: { fairLow: 780000, fairHigh: 1080000, refPrice: 930000 },
  },
  'Chromite': {
    Odisha: { fairLow: 1200000, fairHigh: 1600000, refPrice: 1400000 },
    _default: { fairLow: 1200000, fairHigh: 1600000, refPrice: 1400000 },
  },
};

/**
 * Apply a grade-based price adjustment.
 * Higher Fe% → higher price; higher impurities → lower price.
 */
function adjustForGrade(base: PriceBand, grade: Record<string, number>): PriceBand {
  let multiplier = 1.0;

  // Iron ore: Fe% premium/discount around 62% benchmark
  if (grade['Fe%'] !== undefined) {
    const feDeviation = (grade['Fe%'] - 62) / 100;
    multiplier += feDeviation * 2; // ±2% price per 1% Fe deviation
  }
  // Silica penalty
  if (grade['silica%'] !== undefined && grade['silica%'] > 5) {
    multiplier -= (grade['silica%'] - 5) * 0.005; // small penalty per % above 5
  }
  // Manganese: Mn% premium around 40%
  if (grade['Mn%'] !== undefined) {
    const mnDeviation = (grade['Mn%'] - 40) / 100;
    multiplier += mnDeviation * 1.5;
  }

  multiplier = Math.max(0.7, Math.min(1.3, multiplier)); // clamp to ±30%

  return {
    fairLow: Math.round(base.fairLow * multiplier),
    fairHigh: Math.round(base.fairHigh * multiplier),
    refPrice: Math.round(base.refPrice * multiplier),
  };
}

@Injectable()
export class SandboxPriceFeedProvider implements PriceFeedProvider {
  private readonly logger = new Logger(SandboxPriceFeedProvider.name);

  constructor(private readonly prisma: PrismaService) {}

  async getReferencePrice(
    mineralId: string,
    grade: Record<string, number>,
    state: string,
  ): Promise<ReferencePriceResult> {
    // Look up mineral name
    const mineral = await this.prisma.mineral.findUnique({
      where: { id: mineralId },
      select: { name: true },
    });

    const mineralName = mineral?.name ?? '';
    const priceMap = REFERENCE_PRICES[mineralName] ?? {};
    const baseBand = priceMap[state] ?? priceMap['_default'] ?? {
      fairLow: 100000,
      fairHigh: 200000,
      refPrice: 150000,
    };

    const adjusted = adjustForGrade(baseBand, grade);
    const now = new Date();

    // Store snapshot in price_history (raw SQL for TimescaleDB hypertable)
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO price_history (time, mineral_id, grade, state, fair_low, fair_high, ref_price, source)
         VALUES ($1::timestamptz, $2::uuid, $3::jsonb, $4, $5, $6, $7, 'sandbox')`,
        now.toISOString(),
        mineralId,
        JSON.stringify(grade),
        state,
        adjusted.fairLow,
        adjusted.fairHigh,
        adjusted.refPrice,
      );
    } catch (error) {
      // price_history may not exist yet (migration not applied)
      this.logger.warn(
        `Failed to insert price_history: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return {
      ...adjusted,
      source: 'sandbox',
      asOf: now,
    };
  }
}

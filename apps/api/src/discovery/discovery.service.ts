import { Injectable, Inject, Logger } from '@nestjs/common';
import { SearchService, SearchListingsQuery } from '../providers/search/search.service';
import { PriceFeedProvider, PRICE_FEED_PROVIDER } from '../providers/price-feed/price-feed-provider.interface';
import { AiService } from '../ai/ai.service';
import { CatalogService } from '../catalog/catalog.service';
import {
  SearchQueryInput,
  DiscoverySearchResponse,
  DiscoveryMatch,
  ReferencePriceResponse,
} from '@khanij/types';
import { scoreListing, compositeScore, RankingContext } from './ranking';

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private readonly search: SearchService,
    @Inject(PRICE_FEED_PROVIDER)
    private readonly priceFeed: PriceFeedProvider,
    private readonly ai: AiService,
    private readonly catalog: CatalogService,
  ) {}

  async searchListings(dto: SearchQueryInput): Promise<DiscoverySearchResponse> {
    // 1. Get mineral catalog for AI context
    const minerals = await this.catalog.findAll();
    const aiContext = {
      minerals: minerals.map((m) => ({
        id: m.id,
        name: m.name,
        gradeParams: m.gradeParams as Record<string, unknown>,
      })),
    };

    // 2. Parse NL query into structured intent
    const parsedIntent = await this.ai.parseSearchIntent(dto.query, aiContext);
    this.logger.log(
      `Parsed intent: ${parsedIntent ? JSON.stringify(parsedIntent) : 'null (fallback)'}`,
    );

    // 3. Build ES query from parsed intent + explicit filters
    const esQuery: SearchListingsQuery = {
      limit: 50,
    };

    // Merge parsed intent
    if (parsedIntent) {
      if (parsedIntent.mineralId) esQuery.mineralId = parsedIntent.mineralId;
      else if (parsedIntent.mineralName) esQuery.mineralName = parsedIntent.mineralName;
      if (parsedIntent.state) esQuery.state = parsedIntent.state;
      if (parsedIntent.gradeMin) esQuery.gradeMin = parsedIntent.gradeMin;
      if (parsedIntent.gradeMax) esQuery.gradeMax = parsedIntent.gradeMax;
    }

    // Merge explicit filters (override AI-parsed values)
    if (dto.filters) {
      if (dto.filters.mineralId) esQuery.mineralId = dto.filters.mineralId;
      if (dto.filters.state) esQuery.state = dto.filters.state;
      if (dto.filters.maxPriceInPaise) esQuery.maxPriceInPaise = dto.filters.maxPriceInPaise;
      if (dto.filters.minTrustScore) esQuery.minTrustScore = dto.filters.minTrustScore;
    }

    // 4. Query Elasticsearch
    const esResults = await this.search.searchListings(esQuery);

    // 5. Get reference price for context
    let fairPriceBand: ReferencePriceResponse | null = null;
    const resolvedMineralId = esQuery.mineralId ?? parsedIntent?.mineralId;
    const resolvedState = esQuery.state ?? parsedIntent?.state;
    const resolvedGrade = parsedIntent?.gradeMin ?? {};

    if (resolvedMineralId && resolvedState) {
      try {
        const priceResult = await this.priceFeed.getReferencePrice(
          resolvedMineralId,
          resolvedGrade,
          resolvedState,
        );
        fairPriceBand = {
          mineralId: resolvedMineralId,
          grade: resolvedGrade,
          state: resolvedState,
          fairLow: priceResult.fairLow,
          fairHigh: priceResult.fairHigh,
          refPrice: priceResult.refPrice,
          source: priceResult.source,
          asOf: priceResult.asOf.toISOString(),
        };
      } catch (error) {
        this.logger.warn(
          `Failed to get reference price: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // 6. Score and rank matches
    const rankingContext: RankingContext = {
      fairLow: fairPriceBand?.fairLow ?? 0,
      fairHigh: fairPriceBand?.fairHigh ?? 0,
      refPrice: fairPriceBand?.refPrice ?? 0,
      buyerState: resolvedState ?? undefined,
    };

    const matches: DiscoveryMatch[] = esResults.map((doc) => {
      const breakdown = scoreListing(doc, rankingContext);
      const score = compositeScore(breakdown);

      return {
        listing: {
          id: doc.listingId,
          mineralId: doc.mineralId,
          mineralName: doc.mineralName,
          grade: doc.grade,
          quantityAvailable: doc.quantityAvailable,
          unit: doc.unit,
          askPriceInPaise: doc.askPriceInPaise,
          location: doc.location,
          dispatchLeadDays: doc.dispatchLeadDays,
          sellerOrgId: doc.sellerOrgId,
          sellerLegalName: doc.sellerLegalName,
        },
        score,
        breakdown,
        fairPriceBand: {
          fairLow: fairPriceBand?.fairLow ?? 0,
          fairHigh: fairPriceBand?.fairHigh ?? 0,
          refPrice: fairPriceBand?.refPrice ?? 0,
        },
        sellerTrustScore: doc.sellerTrustScore,
      };
    });

    // Sort by composite score descending
    matches.sort((a, b) => b.score - a.score);

    return {
      parsedIntent,
      matches,
      fairPriceBand,
      totalMatches: matches.length,
    };
  }
}

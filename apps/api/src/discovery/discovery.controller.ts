import { Controller, Post, Get, Query, Body, UseGuards, Inject } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SearchQuerySchema, SearchQueryInput } from '@khanij/types';
import { PriceFeedProvider, PRICE_FEED_PROVIDER } from '../providers/price-feed/price-feed-provider.interface';

@Controller()
@UseGuards(JwtAuthGuard)
export class DiscoveryController {
  constructor(
    private readonly discoveryService: DiscoveryService,
    @Inject(PRICE_FEED_PROVIDER)
    private readonly priceFeed: PriceFeedProvider,
  ) {}

  /**
   * POST /discovery/search
   * Natural-language search → AI-parsed intent → ES query → ranked results.
   */
  @Post('discovery/search')
  async search(
    @Body(new ZodValidationPipe(SearchQuerySchema)) dto: SearchQueryInput,
  ) {
    return this.discoveryService.searchListings(dto);
  }

  /**
   * GET /price/reference?mineralId=...&grade=...&state=...
   * Returns the fair price band for a mineral + grade + state.
   */
  @Get('price/reference')
  async getReferencePrice(
    @Query('mineralId') mineralId: string,
    @Query('state') state: string,
    @Query('grade') gradeStr?: string,
  ) {
    const grade: Record<string, number> = gradeStr ? JSON.parse(gradeStr) : {};
    const result = await this.priceFeed.getReferencePrice(mineralId, grade, state);
    return {
      mineralId,
      grade,
      state,
      fairLow: result.fairLow,
      fairHigh: result.fairHigh,
      refPrice: result.refPrice,
      source: result.source,
      asOf: result.asOf.toISOString(),
    };
  }
}

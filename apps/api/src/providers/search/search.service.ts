import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

const LISTING_INDEX = 'khanij_listings';

/** Shape of a listing document in the ES index. */
export interface ListingDocument {
  listingId: string;
  sellerOrgId: string;
  sellerLegalName: string;
  mineralId: string;
  mineralName: string;
  grade: Record<string, number>;
  quantityAvailable: number;
  unit: string;
  askPriceInPaise: number;
  location: {
    district: string;
    state: string;
    lat?: number;
    lng?: number;
  };
  dispatchLeadDays: number;
  sellerTrustScore: number;
  createdAt: string;
}

export interface SearchListingsQuery {
  mineralId?: string;
  mineralName?: string;
  state?: string;
  maxPriceInPaise?: number;
  minTrustScore?: number;
  gradeMin?: Record<string, number>;
  gradeMax?: Record<string, number>;
  limit?: number;
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private client: Client | null = null;
  private healthy = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const node = this.config.get<string>('ELASTICSEARCH_NODE');
    if (!node) {
      this.logger.warn('ELASTICSEARCH_NODE not set — search indexing disabled');
      return;
    }

    try {
      this.client = new Client({
        node,
        auth: {
          username: this.config.get<string>('ELASTICSEARCH_USERNAME', 'elastic'),
          password: this.config.get<string>('ELASTICSEARCH_PASSWORD', 'changeme'),
        },
      });

      await this.client.ping();
      this.healthy = true;
      this.logger.log(`Elasticsearch connected: ${node}`);
      await this.ensureIndex();
    } catch (error) {
      this.logger.warn(
        `Elasticsearch init failed (listings will not be indexed): ${error instanceof Error ? error.message : String(error)}`,
      );
      this.client = null;
    }
  }

  private async ensureIndex(): Promise<void> {
    if (!this.client) return;

    const exists = await this.client.indices.exists({ index: LISTING_INDEX });
    if (exists) return;

    await this.client.indices.create({
      index: LISTING_INDEX,
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
      },
      mappings: {
        properties: {
          listingId: { type: 'keyword' },
          sellerOrgId: { type: 'keyword' },
          sellerLegalName: { type: 'text' },
          mineralId: { type: 'keyword' },
          mineralName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          grade: { type: 'object', enabled: true },
          quantityAvailable: { type: 'float' },
          unit: { type: 'keyword' },
          askPriceInPaise: { type: 'long' },
          'location.district': { type: 'text', fields: { keyword: { type: 'keyword' } } },
          'location.state': { type: 'text', fields: { keyword: { type: 'keyword' } } },
          'location.lat': { type: 'float' },
          'location.lng': { type: 'float' },
          dispatchLeadDays: { type: 'integer' },
          sellerTrustScore: { type: 'integer' },
          createdAt: { type: 'date' },
        },
      },
    });

    this.logger.log(`Created Elasticsearch index: ${LISTING_INDEX}`);
  }

  /** Index an ACTIVE listing document. */
  async indexListing(doc: ListingDocument): Promise<void> {
    if (!this.client || !this.healthy) return;

    try {
      await this.client.index({
        index: LISTING_INDEX,
        id: doc.listingId,
        document: doc,
        refresh: 'wait_for',
      });
    } catch (error) {
      this.logger.error(
        `Failed to index listing ${doc.listingId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Remove a listing from the index (paused, sold out). */
  async removeListing(listingId: string): Promise<void> {
    if (!this.client || !this.healthy) return;

    try {
      await this.client.delete({
        index: LISTING_INDEX,
        id: listingId,
        refresh: 'wait_for',
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) return;
      this.logger.error(
        `Failed to remove listing ${listingId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Search for listings with structured filters. */
  async searchListings(query: SearchListingsQuery): Promise<ListingDocument[]> {
    if (!this.client || !this.healthy) {
      this.logger.warn('ES unavailable — returning empty results');
      return [];
    }

    const must: object[] = [];
    const filter: object[] = [];

    if (query.mineralId) {
      filter.push({ term: { mineralId: query.mineralId } });
    }
    if (query.mineralName) {
      must.push({ match: { mineralName: { query: query.mineralName, fuzziness: 'AUTO' } } });
    }
    if (query.state) {
      must.push({ match: { 'location.state': { query: query.state, fuzziness: 'AUTO' } } });
    }
    if (query.maxPriceInPaise) {
      filter.push({ range: { askPriceInPaise: { lte: query.maxPriceInPaise } } });
    }
    if (query.minTrustScore) {
      filter.push({ range: { sellerTrustScore: { gte: query.minTrustScore } } });
    }

    if (query.gradeMin) {
      for (const [key, val] of Object.entries(query.gradeMin)) {
        filter.push({ range: { [`grade.${key}`]: { gte: val } } });
      }
    }
    if (query.gradeMax) {
      for (const [key, val] of Object.entries(query.gradeMax)) {
        filter.push({ range: { [`grade.${key}`]: { lte: val } } });
      }
    }

    try {
      const result = await this.client.search<ListingDocument>({
        index: LISTING_INDEX,
        size: query.limit ?? 50,
        query: {
          bool: {
            ...(must.length > 0 ? { must } : {}),
            ...(filter.length > 0 ? { filter } : {}),
            ...(must.length === 0 && filter.length === 0
              ? { must: [{ match_all: {} }] }
              : {}),
          },
        },
        sort: [
          { sellerTrustScore: 'desc' as const },
          { createdAt: 'desc' as const },
        ],
      });

      return (result.hits?.hits ?? []).map((hit) => hit._source as ListingDocument);
    } catch (error) {
      this.logger.error(
        `ES search failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  isHealthy(): boolean {
    return this.healthy;
  }
}

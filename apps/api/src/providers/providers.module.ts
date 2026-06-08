import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KYC_PROVIDER } from './kyc/kyc-provider.interface';
import { SandboxKycProvider } from './kyc/sandbox-kyc.provider';
import { GOV_DATA_PROVIDER } from './gov-data/gov-data-provider.interface';
import { SandboxGovDataProvider } from './gov-data/sandbox-gov-data.provider';
import { DOCUMENT_AI_PROVIDER } from './document-ai/document-ai-provider.interface';
import { SandboxDocumentAiProvider } from './document-ai/sandbox-document-ai.provider';
import { PRICE_FEED_PROVIDER } from './price-feed/price-feed-provider.interface';
import { SandboxPriceFeedProvider } from './price-feed/sandbox-price-feed.provider';
import { StorageService } from './storage/storage.service';
import { SearchService } from './search/search.service';

/**
 * Providers module — the pluggable swap layer.
 *
 * All external integrations (KYC, govt data, document AI, storage, search, price feed)
 * are behind interfaces with sandbox implementations.
 * Swapping to real providers is a DI change, not a rewrite.
 *
 * @Global so all modules can inject providers without importing this module.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: KYC_PROVIDER,
      useClass: SandboxKycProvider,
    },
    {
      provide: GOV_DATA_PROVIDER,
      useClass: SandboxGovDataProvider,
    },
    {
      provide: DOCUMENT_AI_PROVIDER,
      useClass: SandboxDocumentAiProvider,
    },
    {
      provide: PRICE_FEED_PROVIDER,
      useClass: SandboxPriceFeedProvider,
    },
    StorageService,
    SearchService,
  ],
  exports: [
    KYC_PROVIDER,
    GOV_DATA_PROVIDER,
    DOCUMENT_AI_PROVIDER,
    PRICE_FEED_PROVIDER,
    StorageService,
    SearchService,
  ],
})
export class ProvidersModule {}

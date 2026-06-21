# Backend Development Guide — Khanij Nexus

> Stack: Node 20 · NestJS · PostgreSQL 16 + TimescaleDB · Redis 7 · Elasticsearch 8  
> Read alongside `.claude/skills/backend-api/SKILL.md` before writing any API code.

---

## Module Dependency Map

```
AppModule
├── LoggerModule (global)
├── PrismaModule (global)
├── ProvidersModule
│   ├── KycModule (SandboxKycProvider)
│   ├── GovDataModule (SandboxGovDataProvider)
│   ├── PaymentModule (StubPaymentProvider)
│   ├── PriceFeedModule (SandboxPriceFeedProvider)
│   ├── DocumentAiModule (SandboxDocumentAiProvider)
│   ├── SearchModule (ElasticsearchService)
│   └── StorageModule (S3/MinIO)
├── AuthModule
├── ComplianceModule (depends on: KycModule, GovDataModule, StorageModule)
├── CatalogModule
├── ListingsModule (depends on: SearchModule, ComplianceModule)
├── DiscoveryModule (depends on: SearchModule, AiModule)
├── DealsModule (depends on: ComplianceModule, PaymentModule, AiModule)
├── ArbitrationModule (depends on: DealsModule, AiModule, StorageModule)
├── NotificationModule (BullMQ)
└── AiModule (global — AiService)
```

---

## Module Build Order

Build modules in this order (each depends on previous being stable):

1. **Foundation** — PrismaModule, LoggerModule, AuthModule ✓
2. **Providers** — All provider interfaces + sandbox impls ✓
3. **Compliance** — ComplianceModule + TrustScore ✓
4. **Catalog** — CatalogModule, ListingsModule ✓
5. **Discovery** — DiscoveryModule (AI search) ✓
6. **Deals** — DealsModule (RFQ→Quote→Deal→Milestones→Escrow) 🚧
7. **Real-time** — WebSocket gateway for deal room
8. **Arbitration** — ArbitrationModule
9. **Notifications** — NotificationModule + BullMQ processors
10. **Admin** — Admin-specific endpoints (compliance review queue, org management)

---

## Current API Endpoints

### Auth (`/auth`)
```
POST /auth/register      { orgData, userData } → { org, user, tokens }
POST /auth/login         { email, password } → { accessToken, user } + httpOnly cookie
POST /auth/refresh       (cookie) → { accessToken }
POST /auth/logout        → 204
```

### Compliance (`/compliance`)
```
GET  /compliance/:orgId              → ComplianceChecklist
POST /compliance/:orgId/items/:type/upload    (file) → ComplianceItem
PATCH /compliance/:orgId/items/:type/verify  (ADMIN) → ComplianceItem
GET  /compliance/:orgId/snapshots    → ComplianceSnapshot[]
```

### Catalog (`/catalog`)
```
GET /catalog/minerals                → Mineral[]
GET /catalog/minerals/:id            → Mineral
POST /catalog/minerals               (ADMIN) → Mineral
```

### Listings (`/listings`)
```
GET  /listings                       → Listing[] (filtered by orgId for sellers)
GET  /listings/:id                   → Listing
POST /listings                       (SELLER, VERIFIED) → Listing
PATCH /listings/:id                  (SELLER, owner) → Listing
PATCH /listings/:id/activate         (SELLER, VERIFIED org) → Listing
PATCH /listings/:id/pause            (SELLER) → Listing
DELETE /listings/:id                 (SELLER, DRAFT only) → 204
```

### Discovery (`/discovery`)
```
POST /discovery/search               { query } → SearchResult[]
```

### RFQs (`/rfqs`) — TO BUILD
```
POST   /rfqs                         (BUYER, VERIFIED) → Rfq
GET    /rfqs                         (BUYER: my RFQs; SELLER: matching inbox)
GET    /rfqs/:id                     → Rfq with quotes
PATCH  /rfqs/:id/cancel              (BUYER, OPEN only) → Rfq
POST   /rfqs/:id/quotes              (SELLER, VERIFIED) → Quote
PATCH  /rfqs/:id/quotes/:qId/accept  (BUYER) → Deal (creates deal + milestones)
PATCH  /rfqs/:id/quotes/:qId/reject  (BUYER) → Quote
```

### Deals (`/deals`) — TO BUILD
```
GET    /deals                        → Deal[] (scoped to org)
GET    /deals/:id                    → Deal with milestones + messages
POST   /deals/:id/messages           → DealMessage
PATCH  /deals/:id/milestones/:type/complete → DealMilestone
POST   /deals/:id/dispute            → Dispute
PATCH  /deals/:id/status             (state machine transitions)
```

### Arbitration (`/arbitration`) — TO BUILD
```
GET    /arbitration                  (ARBITRATOR: my cases; parties: my disputes)
GET    /arbitration/:id              → Dispute with evidence, brief
POST   /arbitration/:id/evidence     → Evidence upload
POST   /arbitration/:id/brief/generate (ARBITRATOR) → ArbitrationBrief (AI)
POST   /arbitration/:id/award        (ARBITRATOR) → Award
```

### Admin (`/admin`) — TO BUILD
```
GET    /admin/compliance/queue       (ADMIN) → pending ComplianceItem[]
PATCH  /admin/compliance/:id/verify  (ADMIN) → ComplianceItem
GET    /admin/orgs                   (ADMIN) → Organization[]
PATCH  /admin/orgs/:id/suspend       (ADMIN) → Organization
GET    /admin/audit                  (ADMIN, REGULATOR_READONLY) → AuditLog[]
```

---

## Prisma Patterns

### Adding a new model (checklist):
1. Add to `apps/api/prisma/schema.prisma`
2. Run `npx prisma migrate dev --name <description>`
3. Add seed data to appropriate seed file
4. Add to `packages/types/src/schemas.ts` — the Zod schema
5. Add to `packages/types/src/enums.ts` — any new enums
6. Run `pnpm test` to catch cascade failures

### Seeding
```bash
npx prisma db seed   # runs prisma/seed.ts
```

Seed file structure:
```
apps/api/prisma/
├── seed.ts               # orchestrator
└── seeds/
    ├── minerals.seed.ts  # mineral catalog (12 minerals)
    ├── orgs.seed.ts      # test buyer + seller orgs
    └── users.seed.ts     # test users (all roles)
```

---

## Elasticsearch Index Schema

```json
// Index: khanij_listings
{
  "mappings": {
    "properties": {
      "listingId":       { "type": "keyword" },
      "sellerOrgId":     { "type": "keyword" },
      "sellerOrgName":   { "type": "text", "analyzer": "standard" },
      "mineralId":       { "type": "keyword" },
      "mineralName":     { "type": "text", "analyzer": "standard" },
      "grade":           { "type": "object", "dynamic": true },
      "quantityMT":      { "type": "double" },
      "askPricePerMTPaise": { "type": "long" },
      "state":           { "type": "keyword" },
      "district":        { "type": "keyword" },
      "location":        { "type": "geo_point" },
      "trustScore":      { "type": "integer" },
      "dispatchLeadDays":{ "type": "integer" },
      "status":          { "type": "keyword" },
      "updatedAt":       { "type": "date" }
    }
  }
}
```

---

## BullMQ Queue Names

```typescript
// apps/api/src/common/queues.ts
export const QUEUES = {
  LISTING_INDEX:       'listing-index',
  NOTIFICATION:        'notification',
  EXPIRY_SWEEP:        'expiry-sweep',
  MILESTONE_SWEEP:     'milestone-sweep',
  FRAUD_DETECTION:     'fraud-detection',
  DOCUMENT_EXTRACTION: 'document-extraction',
} as const;
```

---

## Redis Key Naming Convention

```
khanij:session:{userId}          → session data (TTL: 15m)
khanij:ratelimit:ip:{ip}         → request count (sliding window, TTL: 60s)
khanij:ratelimit:org:{orgId}:{agentName} → AI rate limit (TTL: 3600s)
khanij:idempotency:{key}         → cached response (TTL: 86400s)
khanij:price:{mineralId}:{grade} → cached sandbox price (TTL: 300s)
deal:{dealId}:messages           → pub/sub channel (no TTL — Redis streams)
```

---

## Environment Variables Reference

All variables documented in `.env.example`. Key groups:

```bash
# App
NODE_ENV=development
API_PORT=4000
WEB_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://khanij:khanij@localhost:5432/khanij_nexus

# Redis
REDIS_URL=redis://localhost:6379

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200

# Auth
JWT_ACCESS_SECRET=<generate: openssl rand -hex 32>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<generate: openssl rand -hex 32>
JWT_REFRESH_EXPIRES_IN=7d

# PII Encryption (never the same as JWT secrets)
PII_ENCRYPTION_KEY=<generate: openssl rand -hex 32>

# AI
ANTHROPIC_API_KEY=sk-ant-...
AI_MODEL=claude-sonnet-4-6

# Storage
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=khanij-documents
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
```

---

## Running Locally

```bash
# 1. Start infrastructure
docker compose up -d

# 2. Install deps
pnpm install

# 3. Generate Prisma client
pnpm --filter @khanij/api exec prisma generate

# 4. Run migrations + seed
pnpm --filter @khanij/api exec prisma migrate dev
pnpm --filter @khanij/api exec prisma db seed

# 5. Start all services
pnpm dev
```

API runs at: http://localhost:4000  
API docs (Swagger): http://localhost:4000/api/docs

---

## Testing Commands

```bash
pnpm test                    # all workspaces
pnpm --filter @khanij/api test          # API unit tests
pnpm --filter @khanij/api test:e2e      # API integration tests
pnpm --filter @khanij/types test        # types + money + encryption
pnpm test --coverage                    # coverage report
```

Coverage targets: 80%+ on all service files in `apps/api/src/`.

---

## Swagger / OpenAPI

NestJS Swagger decorator on every endpoint:

```typescript
@ApiOperation({ summary: 'Create a new listing' })
@ApiBody({ type: CreateListingDto })
@ApiResponse({ status: 201, type: ListingResponseDto })
@ApiResponse({ status: 403, description: 'Org not VERIFIED' })
```

Access at: `http://localhost:4000/api/docs` (dev only — disabled in production).

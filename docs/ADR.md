# Architecture Decision Records — Khanij Nexus

> ADRs document the *why* behind significant decisions. Once a decision reaches
> **Accepted** status it is a constraint — do not reverse without a new ADR.
>
> Format: Title · Status · Context · Decision · Consequences

---

## ADR-001 — Monorepo with pnpm Workspaces + Turborepo

**Status:** Accepted  
**Date:** 2026-06-05

**Context:**  
The platform has three applications (API, Web, Mobile) and shared code (types, UI components, config). Teams need to share Zod schemas and TypeScript types without versioning friction. Build times across packages must be fast.

**Decision:**  
Use a single pnpm monorepo with Turborepo for task orchestration. `packages/types` is the single source of truth for all shared types and Zod schemas. `packages/ui` holds shared React components. `packages/config` holds shared tsconfig and lint configs.

**Consequences:**
- (+) Schema changes propagate atomically — a breaking schema change fails all consumers in CI.
- (+) Single `pnpm install`, single `pnpm test`, one PR covers full-stack changes.
- (-) Developers must learn Turborepo cache invalidation — cold builds can be slow on first run.
- (-) All packages share one `pnpm-lock.yaml` — dependency conflicts require careful resolution.

---

## ADR-002 — Polyglot Persistence (PostgreSQL Primary + 4 Specialised Stores)

**Status:** Accepted  
**Date:** 2026-06-05

**Context:**  
The platform has distinct data access patterns: relational transactions (deals, compliance), full-text + faceted search (listings), real-time pub/sub (deal room chat), semi-structured documents (contracts, amendments), and binary file storage (compliance docs).

**Decision:**  
- **PostgreSQL 16 + TimescaleDB** — primary store for all relational data, audit log, time-series compliance snapshots
- **Redis 7** — refresh token allow-list, rate limiting counters, BullMQ queues, WebSocket pub/sub, price feed cache
- **Elasticsearch 8** — listings search index (grade facets, geo, TrustScore boost)
- **MongoDB** — deal document store (contracts, terms JSON, amendment history)
- **S3 / MinIO** — binary file storage (compliance docs, evidence vault)

**Consequences:**
- (+) Each store is optimised for its access pattern — no performance compromise.
- (+) Elasticsearch provides sub-100ms faceted search that Postgres cannot match at scale.
- (-) Operational complexity: 5 data stores to maintain, backup, and monitor.
- (-) Consistency across stores is eventual — Elasticsearch lags Postgres by the BullMQ job latency (~1s). Acceptable for search; not for financial operations.
- **Rule:** Postgres is always authoritative. Elasticsearch is a derived index — can always be rebuilt.

---

## ADR-003 — Provider Abstraction for All External Integrations

**Status:** Accepted  
**Date:** 2026-06-05

**Context:**  
Several required integrations are either unavailable for MVP (real Aadhaar eKYC, RBI-licensed payment rails) or involve paid external APIs (OCR, price feeds, fraud graph). We need real interfaces so business logic is correct, but sandbox/stub implementations that don't call real APIs.

**Decision:**  
Every external integration is behind a TypeScript interface with at least two implementations:
1. `Sandbox{Provider}` — deterministic, seeded responses, no external calls (used in dev, test, MVP)
2. Real provider implementation — written when the licence/API contract is available (V2+)

Pattern:
```typescript
// Interface in apps/api/src/providers/{domain}/{domain}-provider.interface.ts
// Sandbox in apps/api/src/providers/{domain}/sandbox-{domain}.provider.ts
// Real in apps/api/src/providers/{domain}/{real-vendor}-{domain}.provider.ts
```

Providers: `KycProvider`, `GovDataProvider`, `PaymentProvider`, `PriceFeedProvider`, `DocumentAiProvider`, `AuditAnchorProvider`.

**Consequences:**
- (+) Business logic (compliance service, escrow service) is correct and testable without real API keys.
- (+) Swapping to a real provider is a one-module change — no business logic changes.
- (-) Risk of sandbox/real provider behavioural drift — must keep interface contracts tight and test both against the same suite.
- **Guardrail:** Never return hardcoded `"verified"` from a sandbox without checking seeded state. Sandbox must be realistic enough to catch integration bugs.

---

## ADR-004 — Money in Paise as BigInt (Never Float)

**Status:** Accepted  
**Date:** 2026-06-05

**Context:**  
Financial platforms routinely have bugs caused by floating-point arithmetic. A deal worth ₹62,50,000 (₹62.5 lakh) must be computed exactly. JavaScript's `Number` type cannot represent all integers > 2^53 precisely.

**Decision:**  
- All monetary amounts stored in **paise** (1 INR = 100 paise) as PostgreSQL `BIGINT`.
- All arithmetic in application code uses `BigInt` — never `Number`.
- `Money` value object in `packages/types/src/money.ts` enforces construction, arithmetic, and display formatting.
- API responses format money for display only via `MoneyDisplay` component — raw paise never shown to users.
- Maximum supported value: ₹99,99,99,999.99 (≈ ₹100 crore) — sufficient for individual deal sizes.

**Consequences:**
- (+) Zero floating-point errors. Audit log hashes are deterministic.
- (+) Escrow balance computed as `Σ HELD - Σ RELEASED - Σ REFUNDED` in BigInt — exact.
- (-) All number-to-BigInt conversions must be explicit — TypeScript enforces this.
- (-) JSON serialization: BigInt is not JSON-serializable by default — need custom serializer (`BigInt.toString()` on the way out, `BigInt(value)` on the way in).

---

## ADR-005 — Field-Level Encryption for PII (AES-256-GCM, Org-Scoped Keys)

**Status:** Accepted  
**Date:** 2026-06-05

**Context:**  
The platform stores Aadhaar numbers, PAN, GSTIN, phone numbers, and bank account numbers. DPDP Act 2023 requires data protection. A DB compromise must not expose PII in plaintext.

**Decision:**  
PII fields are encrypted at rest using AES-256-GCM before writing to Postgres. The encryption key is derived per-organisation: `PBKDF2(masterKey, orgId, 100_000 iterations, SHA-256)`. This means a single org's key compromise does not expose all orgs' PII.

Implementation: `packages/types/src/encryption.ts` — used by API services only, never by frontend.

PII is:
- Never stored in plaintext anywhere (Elasticsearch, Redis, logs, BullMQ payloads, AI prompts)
- Always masked in API responses
- Only decrypted in the specific service call that needs it (KYC verification, regulatory export)

**Consequences:**
- (+) DB dump is useless to an attacker without the master encryption key.
- (+) Per-org key derivation limits blast radius of a key compromise.
- (-) Key rotation requires a migration job that re-encrypts all PII fields — write-heavy operation.
- (-) Cannot filter or sort on encrypted fields in Postgres (e.g., cannot `WHERE gstin = ?`). Lookups must go through the application layer after decryption.

---

## ADR-006 — Single AiService for All Claude API Calls

**Status:** Accepted  
**Date:** 2026-06-05

**Context:**  
Multiple modules need AI capabilities (search intent parsing, deal co-pilot, compliance pre-screening, arbitration briefs). Without a central point, each module would independently manage API keys, rate limits, timeouts, and error handling — leading to inconsistency and audit gaps.

**Decision:**  
`apps/api/src/ai/ai.service.ts` is a global NestJS module that is the **only** place the Anthropic SDK is called. All other services inject `AiService` and call `ai.complete(options)`. The service handles:
- Rate limiting per org per agent (Redis)
- Prompt injection sanitization
- Zod validation of every response
- Timeout (30s)
- Audit logging of every AI call
- Mock mode for tests

**Consequences:**
- (+) Rate limit enforcement is centralised — no per-module inconsistency.
- (+) Every AI call is audited — compliance requirement met.
- (+) Prompt injection guard cannot be bypassed by accident.
- (-) `AiService` becomes a critical shared dependency — changes to it affect all AI agents.
- **Rule:** If `AiService` fails, surface a typed error (`AI_UNAVAILABLE`). Never silently degrade to returning empty/null.

---

## ADR-007 — Append-Only Audit Log (Never UPDATE or DELETE)

**Status:** Accepted  
**Date:** 2026-06-05

**Context:**  
Regulatory compliance (MMDR Act, DPDP Act), dispute resolution, and fraud investigation all require an immutable record of every state-changing action. If the audit log can be altered, it cannot be trusted as evidence.

**Decision:**  
The `audit_log` table:
- Has no UPDATE policy and no DELETE policy in the application layer
- Has a PostgreSQL trigger that raises an exception on any UPDATE or DELETE attempt (defense in depth)
- Is never pruned — retention is 7 years (matched to legal discovery timelines)
- Stores `beforeHash` and `afterHash` (SHA-256 of serialised entity state) — not the full before/after state
- Is append-only from the application's perspective — `AuditService.log()` only ever INSERTs

Regulatory read access: `REGULATOR_READONLY` role can query `audit_log` — PII fields are masked at the query layer.

**Consequences:**
- (+) Admissible as evidence in arbitration and court proceedings.
- (+) Any attempt to tamper with the log (even by a DB admin) is detected via hash chain breaks.
- (-) Table grows unboundedly — needs partitioning by `created_at` range for query performance at scale (TimescaleDB handles this).
- (-) Cannot "undo" a mis-logged entry — must log a corrective entry instead.

---

## ADR-008 — JWT with Rotating Refresh Tokens + Token Family Revocation

**Status:** Accepted  
**Date:** 2026-06-05

**Context:**  
Short-lived access tokens minimise breach impact. Refresh tokens must rotate to detect token theft. If a stolen refresh token is replayed, the system must detect and revoke the entire session.

**Decision:**  
- Access token: 15-minute TTL, RS256, contains `{ userId, orgId, role }`. Stored in memory only (not localStorage).
- Refresh token: 7-day TTL, stored as `SHA-256(rawToken)` in `refresh_tokens` table. Sent as `httpOnly` cookie.
- On rotation: old token marked `isRevoked=true`, `replacedById` set to new token ID.
- **Token reuse detection:** If a revoked token is presented, the entire token family (ancestor chain) is revoked → force re-login. Audit log: `auth.token_reuse_detected`.

**Consequences:**
- (+) Stolen access token is useless after 15 minutes.
- (+) Stolen refresh token triggers automatic family revocation on next use.
- (-) Family revocation may log out legitimate users on shared devices — acceptable trade-off for B2B platform.
- (-) `refresh_tokens` table grows over time — needs TTL-based cleanup job (BullMQ cron).

---

## ADR-009 — Zod as Single Source of Truth for Types and Validation

**Status:** Accepted  
**Date:** 2026-06-05

**Context:**  
Type definitions that live only in TypeScript are compile-time only — they don't validate at runtime. Defining types in Prisma schema alone means the API layer has no runtime validation. Defining types separately in each layer leads to drift.

**Decision:**  
All shared types and validation schemas live in `packages/types/src/schemas.ts`. The pattern:
1. Define Zod schema → `const MySchema = z.object({ ... })`
2. Infer TypeScript type → `type My = z.infer<typeof MySchema>`
3. Export both from `packages/types/src/index.ts`
4. API uses schemas for runtime validation via `ZodValidationPipe`
5. Frontend uses schemas for form validation via `zodResolver`
6. AI agent outputs are validated against schemas before use

**Consequences:**
- (+) One definition, three uses: DB shapes, API validation, form validation.
- (+) Breaking a schema in `packages/types` fails CI across all consumers.
- (-) `packages/types` becomes a high-traffic change point — PRs touching schemas need careful review.
- (-) Zod schemas must stay in sync with Prisma schema — a migration without a schema update is a bug.

---

## ADR-010 — Next.js App Router + React Three Fiber for 3D UI

**Status:** Accepted  
**Date:** 2026-06-15

**Context:**  
The platform targets B2B institutional users but needs to differentiate from legacy portals. 3D visualizations (India globe, TrustScore gauge, price surfaces) communicate data in ways flat charts cannot. The web framework must support server components (for SEO + performance) alongside heavy client-side 3D rendering.

**Decision:**  
- **Next.js 14 App Router** — server components for data-fetching routes, client components for interactive UI
- **React Three Fiber (R3F)** — 3D scenes declared in JSX; `@react-three/drei` for helpers (OrbitControls, instances, etc.)
- **All 3D scenes lazy-loaded** with `next/dynamic({ ssr: false })` — never SSR canvas elements
- **Framer Motion** for layout animations, page transitions, gesture responses
- **GSAP** for complex timeline sequences (landing hero)
- **3D is decorative and aria-hidden** — never the primary information channel

**Consequences:**
- (+) Server components keep Time-to-First-Byte fast for data-heavy pages.
- (+) R3F integrates naturally with React's component model and hooks.
- (-) Three.js adds ~800KB to the client bundle — mitigated by lazy loading and code splitting.
- (-) 3D scenes require `useEffect` and browser APIs — careful boundary between server/client components.
- **Rule:** `prefers-reduced-motion` must disable all spring/inertia animations and 3D auto-rotation.

---

## ADR-011 — Compliance Snapshots Are Append-Only (Never Overwrite TrustScore History)

**Status:** Accepted  
**Date:** 2026-06-05

**Context:**  
TrustScore history is a core product asset. Regulators and dispute arbitrators need to know what an org's TrustScore was at any point in the past — especially at the time a deal was signed. If scores are overwritten, this data is lost.

**Decision:**  
`ComplianceSnapshot` rows are INSERT-only. Every TrustScore recalculation creates a new row with `triggeredBy` (what caused the recalculation) and `createdAt`. The application never issues `UPDATE` or `DELETE` on this table.

Current score = the snapshot with the most recent `createdAt` for an `orgId`. Historical score at time T = the snapshot with the largest `createdAt ≤ T`.

**Consequences:**
- (+) Full TrustScore audit trail — admissible in arbitration.
- (+) Can reconstruct org's compliance state at any point in time.
- (-) Table grows with every compliance event — ~50 rows/year per org is acceptable; needs indexing on `(orgId, createdAt)`.

---

## ADR-012 — Escrow Ledger Is Append-Only (Balance Computed on Read)

**Status:** Accepted  
**Date:** 2026-06-08

**Context:**  
Financial ledgers must be auditable and tamper-evident. Running balance columns can drift from the sum of entries due to bugs or concurrent writes. Computing balance from entries is always correct by construction.

**Decision:**  
`EscrowLedger` has three entry types: `HELD`, `RELEASED`, `REFUNDED`. Balance = `Σ HELD - Σ RELEASED - Σ REFUNDED`. No running balance column is stored. Entries are immutable — no UPDATE or DELETE.

Every entry references a `PaymentProvider` transaction reference for external reconciliation.

**Consequences:**
- (+) Balance is always arithmetically correct — no reconciliation needed.
- (+) Every financial movement is individually auditable.
- (-) Balance query is a full scan of entries for a deal — acceptable for deal sizes (typically < 20 entries per deal); add index on `(dealId)`.
- **Rule:** All escrow mutations are within a Postgres transaction that also updates the Deal milestone and writes the audit log row.

---

## ADR-013 — Real-Time Deal Room via WebSocket + Redis Pub/Sub (Not Long-Polling)

**Status:** Accepted  
**Date:** 2026-06-15

**Context:**  
Deal room chat and milestone updates must be real-time (<500ms latency). The API will run as multiple Kubernetes pods. A WebSocket connected to pod A must receive messages sent from pod B.

**Decision:**  
- **NestJS WebSocket Gateway** (`@nestjs/websockets` with `socket.io`) for connection management
- **Redis pub/sub** as the message bus between pods: pod B publishes to `deal:{dealId}:messages`, pod A (subscribed) receives and emits to connected clients
- Client authenticates WebSocket via JWT token in handshake auth
- Rooms: each deal is a Socket.io room (`deal:{dealId}`) — users join after server verifies participation

**Consequences:**
- (+) Horizontal scaling works — Redis bridges across pods.
- (+) Socket.io provides automatic reconnection with event buffering.
- (-) Redis adds a hop to every message — latency ~2ms overhead, acceptable.
- (-) Socket.io client adds ~45KB to the web bundle — acceptable.

---

## ADR-014 — AI Output Is Never Auto-Binding (Decision-Support Only)

**Status:** Accepted  
**Date:** 2026-06-05

**Context:**  
The platform uses AI to draft contracts, generate arbitration briefs, pre-screen compliance documents, and flag fraud. In each case, the AI output affects legally and financially significant decisions. AI models can hallucinate, produce biased outputs, or be manipulated via prompt injection.

**Decision:**  
AI output that reaches a user interface must:
1. Include `isDecisionSupport: true` in the Zod output schema
2. Be displayed with a visible `<AiDisclaimer>` component: *"AI-generated decision-support. Not legally binding."*
3. Never trigger a state transition without a human action (button click, signature, admin approval)
4. Be stored with `senderType: 'AI'` in `DealMessage` so the audit trail distinguishes AI-generated content

The AI can draft, suggest, summarize, and flag — but a human always pulls the trigger.

**Consequences:**
- (+) Legal liability stays with the humans who act on AI output — not with the platform.
- (+) Prompt injection attacks can suggest actions but cannot execute them.
- (-) Reduces automation potential — some users may prefer fully automated flows in V2.
- **Guardrail:** If `isDecisionSupport` field is removed from an agent's output schema, CI must catch it via type checking.

---

## ADR-015 — AWS ap-south-1 (Mumbai) as Sole Deployment Region

**Status:** Accepted  
**Date:** 2026-06-05

**Context:**  
DPDP Act 2023 (India's data protection law) requires that personal data of Indian residents not be transferred outside India without explicit consent and government notification. The platform processes Aadhaar proxies, PAN, GSTIN, and phone numbers of Indian citizens.

**Decision:**  
All infrastructure (EKS, RDS, ElastiCache, OpenSearch, S3, ECR) is provisioned exclusively in `ap-south-1` (Mumbai). No cross-region replication of any data. Backups are stored within `ap-south-1`.

CDN (CloudFront) may serve static assets from edge locations globally — these assets contain no PII.

**Consequences:**
- (+) DPDP Act 2023 compliance by architecture, not by policy.
- (+) Low latency for Indian users (primary market).
- (-) Single-region — regional AWS outage affects the platform. Mitigated by Multi-AZ deployments within `ap-south-1`.
- (-) Disaster recovery is within the same region — acceptable per DPDP Act requirements.

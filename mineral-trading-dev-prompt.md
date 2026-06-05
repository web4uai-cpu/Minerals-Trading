# KHANIJ NEXUS — Production Development Prompt

> **How to use this document.** Section 1 is the *master context* — paste it once at the start of your coding session (Claude Code, Cursor, etc.) and keep it pinned. Sections 2–8 are *sequenced build prompts* — run them one at a time, in order, reviewing and testing each before moving on. Do **not** paste the whole document as one prompt; agents build better in vertical slices.

---

## 1. MASTER CONTEXT (paste first, keep pinned)

```
You are the lead engineer building Khanij Nexus — an AI-powered B2B marketplace
and dispute-arbitration platform for India's mines & minerals trade. Buyers and
sellers onboard with verified compliance, get AI-matched, transact in monitored
"deal rooms", and resolve disputes through structured arbitration.

ROLE & STANDARDS
- Write production-grade, typed, tested code. No placeholder logic, no TODO stubs
  in committed code, no mock data outside designated seed/fixture files.
- Every endpoint: input validation, authz check, structured error, audit log entry.
- Security and compliance are features, not afterthoughts. When in doubt, fail closed.
- Explain non-obvious decisions in code comments. Keep functions small and pure.
- If a requirement is ambiguous or risky (e.g. handling money, PII, Aadhaar),
  STOP and ask before implementing. Do not guess on legal/financial behavior.

LOCKED TECH STACK (do not substitute without asking)
- Language:      TypeScript everywhere (strict mode on)
- Backend:       Node.js 20 + NestJS (modular, DI, guards, interceptors)
- Frontend web:  Next.js 14 (App Router) + React + Tailwind + shadcn/ui
- Mobile:        React Native (Expo) — shared API client + types with web
- Primary DB:    PostgreSQL 16 + Prisma ORM. TimescaleDB extension for price series.
- Cache/RT:      Redis 7 (sessions, cache, rate-limit, pub/sub for deal rooms)
- Search:        Elasticsearch 8 (seller/listing discovery, NL query)
- Documents:     MongoDB (parsed govt docs, contract versions, AI logs)
- Object store:  S3-compatible (MinIO in dev) for uploaded files, AES-256 SSE
- Graph (later): Neo4j (fraud/related-party detection) — stub interface now, wire later
- Queue:         BullMQ (Redis-backed) for async jobs (OCR, verification, notifications)
- AI:            Anthropic Claude API via a single AiService abstraction (never call
                 the SDK directly from controllers; all prompts live in /ai/prompts)
- Auth:          JWT access (15m) + refresh (7d, rotating), Argon2id password hashing
- Infra target:  Docker Compose for dev; Kubernetes-ready manifests; AWS ap-south-1

REPO STRUCTURE (monorepo, pnpm workspaces + Turborepo)
  /apps
    /api          NestJS backend
    /web          Next.js buyer/seller/arbitrator portal
    /mobile       React Native app
  /packages
    /types        Shared TS types & Zod schemas (single source of truth)
    /ui           Shared React components (web)
    /config       ESLint, tsconfig, tailwind preset
  /infra          docker-compose.yml, k8s manifests, terraform (later)
  /docs           ADRs, API spec, data dictionary

CROSS-CUTTING NON-NEGOTIABLES
1. Validation: every external input validated with Zod (shared in /packages/types).
2. AuthZ: role-based guards (BUYER, SELLER, ARBITRATOR, ADMIN, REGULATOR_READONLY).
   Enforce at the route AND the data layer (row scoping by orgId).
3. Audit: an append-only audit_log row for every state-changing action
   (who, what, before/after hash, timestamp, ip). Never deletable.
4. PII: Aadhaar, PAN, bank acct, GSTIN are field-level encrypted at rest
   (AES-256-GCM, key from env/KMS). Never logged in plaintext. Never returned
   in list endpoints — only last-4 / masked unless explicitly authorized.
5. Money: all amounts stored as integer paise (BIGINT), never floats. A Money
   value object handles formatting. Every financial mutation is transactional.
6. Idempotency: all POST endpoints that create resources accept an
   Idempotency-Key header.
7. Errors: typed error classes -> consistent JSON { code, message, traceId }.
   Never leak stack traces or internal IDs to clients.
8. Tests: unit tests for services/guards, integration tests for each module's
   happy + auth-fail + validation-fail paths. Target 80%+ on business logic.
9. Observability: structured JSON logs (pino), request traceId, OpenTelemetry hooks.
10. Compliance data is the product. Treat IBM/govt verification status as
    first-class, versioned, and timestamped — never overwrite, always append.

WHAT WE ARE *NOT* BUILDING YET (scope guardrails — refuse politely if asked)
- Real Aadhaar eKYC integration (use a pluggable KycProvider interface +
  a SandboxKycProvider that simulates UIDAI responses).
- Real escrow / RBI-regulated money movement (model the ledger + states, but
  payment rails are a stubbed PaymentProvider — actual integration is post-MVP
  and requires a PA/PA-C license).
- Blockchain anchoring (define the AuditAnchor interface; no-op impl for now).
- Neo4j fraud graph (interface + stub; flag suspicious patterns with simple
  SQL heuristics in MVP).
- Live LME/MCX market feeds (use a PriceFeedProvider interface + seeded data;
  real feed adapters come later).
Building these for real has licensing/legal prerequisites — do not fake them in
a way that looks production-real.

When I give you a build task, produce: (a) the files, (b) the Prisma migration if
schema changes, (c) Zod schemas in /packages/types, (d) tests, (e) a one-line
summary of what to verify manually. Ask before introducing any new dependency.
```

---

## 2. BUILD PROMPT — Foundation & Scaffolding

```
Initialize the monorepo per the structure in master context.

Deliver:
1. pnpm + Turborepo workspace with /apps/api, /apps/web, /packages/types, /packages/config.
2. /apps/api: NestJS app booting on :4000 with a /health endpoint returning
   { status, uptime, version, db: 'up'|'down' }.
3. Prisma configured against PostgreSQL; docker-compose.yml in /infra spinning up
   Postgres 16, Redis 7, MinIO, Elasticsearch 8, MongoDB (dev only).
4. Shared tsconfig, ESLint (strict), Prettier in /packages/config; wire into all apps.
5. Global NestJS setup: Zod validation pipe, pino logger with traceId middleware,
   global exception filter producing { code, message, traceId }, Helmet, CORS allowlist.
6. A Money value object and a field-encryption util (AES-256-GCM, key from env)
   in /packages/types (or a /packages/core if cleaner) — with unit tests.
7. .env.example documenting every variable. README with `make dev` / `pnpm dev` flow.

Verify: `docker compose up` + `pnpm dev` boots api and web; /health is green.
```

---

## 3. BUILD PROMPT — Identity, Orgs & RBAC

```
Build authentication, organizations, and role-based access control.

Data model (Prisma):
- Organization: id, type (BUYER|SELLER|TRADER|EXPORTER|ARBITRATION_BODY),
  legalName, gstin (encrypted), pan (encrypted), state, status
  (PENDING|VERIFIED|SUSPENDED), createdAt.
- User: id, orgId, email (unique), phone (encrypted), passwordHash (Argon2id),
  role (BUYER|SELLER|ARBITRATOR|ADMIN|REGULATOR_READONLY), status, lastLoginAt.
- RefreshToken: rotating, hashed, device fingerprint, revocable.
- AuditLog: append-only (see master context rule 3).

Endpoints (all validated, audited):
- POST /auth/register (creates org + first admin user, status PENDING)
- POST /auth/login  -> access (15m) + refresh (7d), rate-limited (5/min/IP)
- POST /auth/refresh (rotates refresh token, detects reuse -> revoke chain)
- POST /auth/logout
- GET  /me

Guards & decorators:
- @Roles(...) guard reading JWT claims.
- @CurrentOrg() — every query scoped to the caller's orgId at the data layer.
- REGULATOR_READONLY can read aggregate/compliance data but never mutate.

Tests: login happy path, wrong password, rate-limit trip, refresh rotation,
refresh-reuse detection, role-denied (403), cross-org data access blocked.

Verify: a SELLER cannot read another org's data even with a valid token.
```

---

## 4. BUILD PROMPT — Compliance & Verification Engine

```
Build the compliance/verification engine. This is the platform's core trust layer.

Concepts:
- A ComplianceItem is a required document/attestation for an org type
  (e.g. SELLER needs: MINING_LEASE, ENV_CLEARANCE, IBM_RETURNS, ROYALTY_CLEARANCE,
  SPCB_NOC, GST_REG, PAN, BANK_VERIFICATION; BUYER needs a smaller set).
- Each item has: status (MISSING|UPLOADED|UNDER_REVIEW|VERIFIED|REJECTED|EXPIRED),
  validFrom, validUntil, documentRef (S3 key), verifiedBy, verifiedAt, notes.
- A ComplianceProfile aggregates an org's items into a 0–100 TrustScore
  (weighted; expiring-soon items decay the score). Versioned & timestamped —
  never overwrite, append a new snapshot on every change.

Pluggable providers (interfaces + sandbox impls only):
- KycProvider.verifyPan(pan), .verifyGstin(gstin), .pennyDropBank(acct, ifsc)
  -> SandboxKycProvider returns deterministic fake results.
- GovDataProvider.fetchMiningLeaseStatus(leaseId, state),
  .fetchIbmReturns(orgId) -> SandboxGovDataProvider with seeded data.
- DocumentAiProvider.extractFields(s3Key, docType) -> stub that returns
  structured fields (later: AWS Textract). Store parsed output in MongoDB.

Endpoints:
- POST /compliance/documents (presigned S3 upload, then register item)
- POST /compliance/items/:id/verify (ADMIN only; transitions status, audited)
- GET  /compliance/profile (caller's org) -> items + TrustScore + history
- Background job (BullMQ): nightly expiry sweep -> mark EXPIRED, recompute score,
  notify org admins of items expiring within 30 days.

Onboarding checklist endpoint:
- GET /onboarding/checklist -> dynamic list of required items by org type with
  current status, so the UI can render a progress checklist.

Tests: score computation, expiry decay, status transitions (legal vs illegal),
ADMIN-only verify, audit entries created.

Verify: uploading + verifying all SELLER items moves status PENDING->VERIFIED
and TrustScore reflects it.
```

---

## 5. BUILD PROMPT — Catalog, Listings & AI Discovery

```
Build the mineral catalog, seller listings, and AI-powered buyer discovery.

Data model:
- Mineral: id, name, category, hsnCode, defaultUnit (MT|KG), gradeParams (JSON
  schema describing gradeable attributes e.g. Fe%, moisture%, silica%).
- Listing: id, sellerOrgId, mineralId, grade (JSON matching mineral.gradeParams),
  quantityAvailable, unit, askPriceInPaise, location {district, state, lat, lng},
  dispatchLeadDays, status (DRAFT|ACTIVE|PAUSED|SOLD_OUT), createdAt.
  A listing can only be ACTIVE if the seller org is VERIFIED — enforce this.
- Index every ACTIVE listing into Elasticsearch on write.

PriceFeedProvider interface (+ SandboxPriceFeedProvider with seeded data):
- getReferencePrice(mineralId, grade, state) -> { fairLow, fairHigh, refPrice,
  source, asOf }. Seed with realistic district-wise values.
- Store every reference price snapshot in the TimescaleDB price_history hypertable.

AI discovery (via AiService -> Claude):
- POST /discovery/search { query: string (natural language), filters? }
  Flow: AiService parses the NL query into a structured intent
  { mineralId, gradeMin, gradeMax, quantity, state, neededBy } using a prompt
  in /ai/prompts/parse-search.ts (instruct strict JSON output, then Zod-validate).
  Then query Elasticsearch with those filters. Then rank results by a transparent
  scoring function: trustScore (40%), priceVsFairBand (25%), proximity (15%),
  dispatchLeadDays (10%), dealHistory (10%). Return matches + the parsed intent
  + the fair price band so the UI can show "why this match".
- Never let the AI invent sellers or prices — it only parses intent; ranking and
  data come from our DB. Guard against prompt injection in the query string.

Endpoints:
- CRUD /listings (seller-scoped; activation requires VERIFIED org)
- GET  /minerals (catalog, public-ish/cached)
- POST /discovery/search (described above)
- GET  /price/reference?mineralId&grade&state

Tests: listing cannot go ACTIVE if org unverified; ES index sync; search intent
parsing returns valid JSON; ranking function deterministic given inputs;
prompt-injection string doesn't break parsing or leak system prompt.

Verify: an NL query like "5000 MT iron ore Fe 62%+, Odisha, August" returns
ranked verified sellers with a fair price band.
```

---

## 6. BUILD PROMPT — Deal Rooms, Quotes & Workflow

```
Build the transaction workflow: RFQ -> quote -> deal room -> milestones.

Data model:
- Rfq: id, buyerOrgId, listingId?, mineralId, grade, quantity, neededBy, status.
- Quote: id, rfqId, sellerOrgId, pricePerUnitPaise, validUntil, terms (JSON),
  status (SENT|ACCEPTED|REJECTED|EXPIRED).
- Deal: id, buyerOrgId, sellerOrgId, quoteId, totalValuePaise, status
  (CREATED|AGREEMENT_DRAFT|SIGNED|ESCROW_PENDING|IN_FULFILMENT|COMPLETED|DISPUTED|CANCELLED),
  arbitrationSeat. State transitions enforced by a state machine — illegal
  transitions throw.
- DealMilestone: id, dealId, type (AGREEMENT|ESCROW|SAMPLING|DISPATCH|DELIVERY|PAYMENT),
  sequence, dueDate, status (PENDING|DONE|OVERDUE), completedAt.
- EscrowLedger: append-only entries (HELD|RELEASED|REFUNDED) in paise, every
  entry references the deal + a PaymentProvider txn ref. PaymentProvider is a
  STUB (no real money) — model states correctly but do not integrate rails.
- DealMessage: deal-room messages (BUYER|SELLER|AI), persisted; real-time via
  Redis pub/sub + WebSocket gateway.

AI co-pilot in the deal room (AiService):
- /deal/:id/ai/draft-contract -> generates a draft agreement from deal + grade +
  fair price + standard clauses (MMDR refs, quality spec, delivery schedule,
  arbitration seat). Returns structured sections; store versioned in MongoDB.
  Human must review & sign — AI output is a draft, clearly labeled, never
  auto-binding.
- /deal/:id/ai/ask -> answers questions grounded ONLY in this deal's data +
  reference prices (pass them in the prompt context; forbid invented facts).

Endpoints: CRUD for RFQ/Quote, accept-quote -> creates Deal + default milestones,
deal state-transition endpoints (each guarded + audited), WebSocket /deal/:id/room.

Tests: state machine rejects illegal transitions; accepting a quote creates a
deal with correct milestones; escrow ledger balances; only deal participants can
read the room; AI draft is stored versioned and labeled non-binding.

Verify: end-to-end — buyer sends RFQ, seller quotes, buyer accepts, deal room
opens with AI-drafted contract and a milestone timeline.
```

---

## 7. BUILD PROMPT — Arbitration Module

```
Build structured dispute arbitration.

Data model:
- Dispute: id, dealId, raisedByOrgId, category (QUALITY|QUANTITY|PAYMENT|DELIVERY|OTHER),
  description, status (FILED|UNDER_REVIEW|HEARING|AWARD_ISSUED|CLOSED|WITHDRAWN),
  arbitratorUserId?, filedAt.
- Evidence: id, disputeId, submittedByOrgId, documentRef (S3), description,
  hash (for tamper-evidence), submittedAt. Append-only.
- Award: id, disputeId, arbitratorUserId, decision (text), rationale,
  monetaryAdjustmentPaise?, issuedAt. Immutable once issued.

AI arbitration assistant (AiService — assists the human arbitrator, never decides):
- /dispute/:id/ai/brief -> compiles a neutral case brief for the arbitrator:
  deal terms, agreed grade/price vs fair band at deal date (from price_history),
  milestone timeline with delays, message log summary, evidence list. Strictly
  factual + grounded; clearly labeled as decision-support, not a ruling.

Workflow & guards:
- Filing a dispute transitions the Deal to DISPUTED and freezes escrow release.
- Only the assigned ARBITRATOR can issue an Award. Award issuance transitions
  the deal to a resolution state and triggers escrow release/refund per the award.
- Both parties + assigned arbitrator can view; full audit trail on every action.

Tests: dispute freezes escrow; only assigned arbitrator issues award; award
immutability; evidence hash recorded; deal resolves correctly post-award.

Verify: file dispute on a deal -> escrow frozen -> arbitrator gets AI brief ->
issues award -> escrow resolves per ruling.
```

---

## 8. BUILD PROMPT — Frontend (Web) & Mobile Shell

```
Build the web portal (Next.js) consuming the API, then a mobile shell (Expo).

Web (apps/web), App Router, Tailwind + shadcn/ui, dark industrial theme
(slate #0D1117 base, ochre/gold #C9943A accent, sage for verified states):
- Auth: register (org + admin), login, refresh handling, protected route guard.
- Onboarding: compliance checklist with progress, document upload (presigned S3),
  live TrustScore ring.
- Buyer: AI smart-search bar -> ranked matches with trust scores + "why matched"
  + fair price band; listing detail; send RFQ.
- Seller: dashboard (TrustScore, inquiries, listings, AI price recommendation),
  listing CRUD, quote management.
- Deal room: 3-pane (deal+milestones / AI co-pilot chat over WebSocket / document
  vault); contract draft viewer.
- Arbitration: file dispute, evidence upload, arbitrator view with AI brief.
- All data via a typed API client generated from /packages/types (shared Zod).
- Accessibility: WCAG AA, keyboard nav, screen-reader labels.

Mobile (apps/mobile), Expo:
- Reuse the SAME API client + types. Implement: login, buyer home (live prices +
  AI matches), deal room chat, compliance scan view. Push-notification scaffold.

Cross-cutting: loading/skeleton states, optimistic UI where safe, error toasts
from the standard { code, message } envelope, i18n scaffold (en + hi to start).

Tests: component tests for critical flows (login, search, RFQ, deal room send),
plus one Playwright e2e: register -> verify (admin) -> list -> search -> RFQ ->
quote -> deal room.

Verify: the Playwright e2e passes end-to-end against the dockerized backend.
```

---

## 9. DEFINITION OF DONE (apply to every module)

```
A module is "done" only when ALL hold:
[ ] Strict TypeScript, no `any` in business logic, no committed TODO stubs.
[ ] Zod schemas in /packages/types; client & server share one source of truth.
[ ] AuthZ enforced at route + data layer; cross-org access provably blocked.
[ ] Every state-changing action writes an immutable audit_log row.
[ ] PII field-encrypted at rest; never logged or returned unmasked.
[ ] Money as integer paise; financial mutations transactional.
[ ] Unit + integration tests cover happy / auth-fail / validation-fail paths.
[ ] Structured logs with traceId; errors return { code, message, traceId }.
[ ] Prisma migration committed and reversible; seed data updated.
[ ] README/ADR note for any non-obvious decision.
[ ] AI calls go through AiService, prompts in /ai/prompts, outputs Zod-validated,
    and the model is never the source of facts it could fabricate.
```

---

## 10. CRITICAL REMINDERS FOR WHOEVER RUNS THIS

These are **product/legal realities the code alone cannot solve** — flagged so the prompt doesn't lull you into thinking the platform is "done" when the backend compiles:

- **Aadhaar eKYC, escrow, and payment rails are stubbed on purpose.** Going live with real money movement requires an RBI **PA/PA-C licence** (12–24 month process) and a bank/escrow partner. Wiring a fake escrow that *looks* real is the single most dangerous thing you could ship. Keep it stubbed until the licence and partner exist.
- **Government data access (IBM, state mining directorates) is assumed via a provider interface.** Confirm whether you'll get official **API access** or must rely on manual document verification. This determines whether TrustScore is legally defensible or just decorative.
- **Arbitration legal standing:** decide early if you're an **ODR facilitator** or a registered arbitration institution under the Arbitration & Conciliation Act, 1996. The award-enforcement code path depends on this answer.
- **Data localisation:** RBI + DPDP Act 2023 require Indian data residency for financial/PII data — keep all primary stores in `ap-south-1` and document the data-flow map before any cross-border service is added.
- **Start in ONE state and ONE mineral.** The prompt is generic by design; pick (e.g.) Rajasthan + dimensional stone, or Odisha + iron ore, and seed *real* compliance requirements for that jurisdiction first. A working narrow slice beats a broad shell.

---

*Khanij Nexus — Development Prompt v1.0. Build the vertical slice, prove the trust loop, then scale outward.*

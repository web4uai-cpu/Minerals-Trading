# Architecture

This document explains *how* Khanij Nexus is built and *why*. For build
sequencing see `docs/DEV_PROMPT.md`; for agent rules see `CLAUDE.md`.

## 1. System overview

```
        ┌──────────────┐      ┌──────────────┐
        │   Web (Next) │      │ Mobile (Expo)│
        └──────┬───────┘      └──────┬───────┘
               │  shared types + API client (packages/types)
               └──────────────┬───────────────┘
                              ▼
                    ┌───────────────────┐
                    │  API Gateway / WAF │   rate-limit, JWT verify, TLS 1.3
                    └─────────┬──────────┘
                              ▼
                    ┌───────────────────┐
                    │   NestJS API       │   guards · validation · audit
                    │  (modular)         │   AiService · providers
                    └─────────┬──────────┘
            ┌─────────┬───────┼────────┬─────────┬──────────┐
            ▼         ▼       ▼        ▼         ▼          ▼
        Postgres   Redis   Elastic  MongoDB    S3       BullMQ
        +Timescale (cache) (search) (docs)   (files)   (jobs)
```

## 2. Why each datastore (polyglot persistence)

We deliberately use the right tool per data shape rather than forcing one DB.

| Store | Holds | Why |
|-------|-------|-----|
| **PostgreSQL 16** | users, orgs, listings, deals, escrow ledger, arbitration, audit log | ACID, foreign-key integrity, row-level scoping. The system of record. |
| **TimescaleDB** (PG ext) | `price_history` hypertable | High-frequency price snapshots, time-bucketed queries. |
| **Redis 7** | sessions, price cache (30s TTL), rate-limit, OTP, deal-room pub/sub | Sub-ms reads; pub/sub powers realtime deal rooms. |
| **Elasticsearch 8** | listing + seller discovery index | Semantic / faceted search across sellers and minerals. |
| **MongoDB** | parsed govt documents, contract versions, AI logs | Flexible schema — govt formats vary by state and year. |
| **S3 / MinIO** | uploaded files (leases, ECs, assays, contracts) | Immutable object storage, AES-256 SSE, presigned uploads. |
| **Neo4j** *(post-MVP)* | entity/relationship graph | Detects circular deals, shell companies, related parties. |

**Consistency rule:** PostgreSQL is authoritative. Elasticsearch and Redis are
derived/cache layers — rebuildable from Postgres. Never treat them as source of truth.

## 3. Backend module boundaries (NestJS)

```
src/
├── auth/           JWT, refresh rotation, guards
├── orgs/           organizations, RBAC scoping
├── compliance/     verification engine, TrustScore, providers
├── catalog/        minerals, listings, ES indexing
├── discovery/      AI intent parsing + ranking
├── deals/          RFQ, quotes, deal state machine, milestones, escrow ledger
├── arbitration/    disputes, evidence, awards
├── ai/             AiService + prompts/  (the ONLY place Claude is called)
├── pricing/        PriceFeedProvider, reference prices, price_history
├── providers/      KycProvider, GovDataProvider, PaymentProvider, AuditAnchor
├── common/         Money, encryption, audit interceptor, error filter, logger
└── notifications/  BullMQ consumers, email/push fan-out
```

Each module owns its Prisma models, services, controllers, and tests. Modules
talk through services, not by reaching into each other's repositories.

## 4. Provider abstraction (the swap layer)

Anything that will later become a real, licensed, or paid integration is behind
an interface with a sandbox implementation today:

```ts
interface KycProvider {
  verifyPan(pan: string): Promise<KycResult>;
  verifyGstin(gstin: string): Promise<KycResult>;
  pennyDropBank(acct: string, ifsc: string): Promise<KycResult>;
}
// MVP: SandboxKycProvider (deterministic fakes)
// Later: UidaiKycProvider / NsdlKycProvider (requires authorization)
```

Same pattern for `GovDataProvider`, `PriceFeedProvider`, `PaymentProvider`,
`DocumentAiProvider`, `AuditAnchor`. Swapping to real providers is a DI change,
not a rewrite. **This is the single most important design decision in the repo.**

## 5. Request lifecycle (every mutating request)

```
request
  → WAF / gateway (rate-limit, TLS)
  → JWT guard (verify, load claims)
  → role guard (@Roles)
  → Zod validation pipe
  → org-scope check (data layer)
  → service (business logic, transactional if financial)
  → audit interceptor (writes append-only audit_log)
  → structured response { data } | { code, message, traceId }
```

## 6. AI integration shape

- One `AiService`; prompts versioned in `ai/prompts/`.
- Structured tasks (search-intent parsing, contract sections) → strict-JSON
  prompts → Zod-validated → typed objects. If parsing fails, fail closed.
- Grounding: facts (sellers, prices, compliance) are injected from the DB into
  the prompt context; the model is forbidden from inventing them.
- Injection defense: user strings are delimited and the system prompt instructs
  the model to treat them as data, not instructions.

## 7. Data residency & deployment

- All primary stores in **AWS ap-south-1 (Mumbai)** — RBI + DPDP Act 2023 require
  Indian residency for financial/PII data.
- Multi-AZ Postgres (1 primary, 2 replicas), PITR backups (30-day), daily S3 snapshots.
- Active-passive DR (Mumbai + Hyderabad). Target RPO 5 min / RTO 30 min.
- Dev: Docker Compose. Prod: Kubernetes (manifests in `infra/`).

## 8. Architecture Decision Records

Significant decisions get an ADR in `docs/adr/NNNN-title.md` (date, context,
decision, consequences). Examples to record early: choice of NestJS, polyglot
persistence, provider abstraction, money-as-paise, arbitration legal model.

## 9. Open architectural questions (resolve before scaling)

- **Govt data access**: official IBM/state API vs. manual verification — changes
  whether TrustScore is legally defensible.
- **Arbitration legal model**: ODR facilitator vs. registered arbitral
  institution under the Arbitration & Conciliation Act, 1996 — changes the
  award-enforcement code path.
- **Escrow partner & licence**: determines when `PaymentProvider` can go real.
- **Search scale**: when sellers > ~100k, revisit ES sharding + ranking cost.

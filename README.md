<div align="center">

# ⬡ KHANIJ NEXUS

**India's AI-Powered Mines & Minerals Trade, Verification & Arbitration Platform**

Verified buyers and sellers. AI-matched. Compliance-checked. Disputes resolved without courts.

[![Status](https://img.shields.io/badge/status-pre--alpha-orange)]()
[![License](https://img.shields.io/badge/license-proprietary-blue)]()
[![Stack](https://img.shields.io/badge/stack-TypeScript%20%C2%B7%20NestJS%20%C2%B7%20Next.js-2F6EA5)]()

</div>

---

## What this is

Khanij Nexus is a B2B marketplace where mineral sellers (mine owners, lessees, traders) and industrial buyers (steel, cement, aluminium, battery makers) transact under real compliance, fair pricing, and structured dispute resolution. AI assists at every step — it parses buyer needs, ranks verified sellers, drafts contracts, prepares arbitration briefs — but **it is never the source of facts it could fabricate, and it never moves money or makes binding decisions on its own.**

### Core capabilities

- **Verification engine** — mining lease, EC, IBM returns, royalty, SPCB NOC, GST checks → a versioned `TrustScore`
- **AI discovery** — natural-language buyer search → ranked, verified sellers with a fair-price band
- **Deal rooms** — quotes, contracts, milestone timelines, escrow ledger, real-time chat with an AI co-pilot
- **Arbitration** — structured disputes, evidence vault, AI case briefs, enforceable awards

---

## ⚠️ Read this before you build

Some parts of this system are **intentionally stubbed** because making them real has legal prerequisites. Do not "complete" them to look production-ready:

| Area | Status in code | Why |
|------|----------------|-----|
| Aadhaar eKYC | `SandboxKycProvider` | Real UIDAI access requires authorization |
| Escrow & payments | `PaymentProvider` stub + ledger model only | Requires RBI **PA/PA-C licence** + bank partner (12–24 mo) |
| Market feeds (LME/MCX) | `SandboxPriceFeedProvider` (seeded) | Real feeds need commercial licences |
| Blockchain anchoring | `AuditAnchor` no-op | Not needed for MVP trust loop |
| Fraud graph (Neo4j) | interface + SQL heuristics | Full graph DB is post-MVP |

See [`SECURITY.md`](./SECURITY.md) and [`docs/COMPLIANCE.md`](./docs/COMPLIANCE.md) for the full picture.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Language | TypeScript (strict) everywhere |
| Backend | Node.js 20 · NestJS |
| Web | Next.js 14 (App Router) · Tailwind · shadcn/ui |
| Mobile | React Native (Expo) — shared types & API client |
| Primary DB | PostgreSQL 16 + TimescaleDB · Prisma ORM |
| Cache / realtime | Redis 7 (sessions, cache, pub/sub) |
| Search | Elasticsearch 8 |
| Documents | MongoDB |
| Object store | S3-compatible (MinIO in dev) |
| Queue | BullMQ |
| AI | Anthropic Claude via a single `AiService` |

Full rationale in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Repo structure

```
khanij-nexus/
├── apps/
│   ├── api/          # NestJS backend
│   ├── web/          # Next.js portal (buyer / seller / arbitrator)
│   └── mobile/       # React Native (Expo)
├── packages/
│   ├── types/        # Shared TS types + Zod schemas (single source of truth)
│   ├── ui/           # Shared web components
│   └── config/       # ESLint, tsconfig, tailwind preset
├── infra/            # docker-compose, k8s manifests, terraform (later)
├── docs/             # ADRs, data dictionary, compliance, API spec
└── .claude/
    └── skills/       # Agent skills — domain rules for Claude Code
```

---

## Quickstart

> Requires: Node 20+, pnpm 9+, Docker, Docker Compose.

```bash
# 1. Install
pnpm install

# 2. Copy env and fill secrets
cp .env.example .env

# 3. Start infra (Postgres, Redis, MinIO, Elasticsearch, MongoDB)
docker compose -f infra/docker-compose.yml up -d

# 4. Run DB migrations + seed
pnpm --filter api prisma migrate dev
pnpm --filter api prisma db seed

# 5. Run everything
pnpm dev
```

| Service | URL |
|---------|-----|
| API | http://localhost:4000 |
| API health | http://localhost:4000/health |
| Web | http://localhost:3000 |
| MinIO console | http://localhost:9001 |

---

## Common scripts

```bash
pnpm dev               # run api + web in watch mode
pnpm test              # run all tests
pnpm test:e2e          # Playwright end-to-end
pnpm lint              # eslint across workspace
pnpm typecheck         # tsc --noEmit everywhere
pnpm --filter api prisma migrate dev   # new migration
```

---

## Building with Claude Code

This repo ships with agent context and skills so AI assistance stays consistent with our rules:

- [`CLAUDE.md`](./CLAUDE.md) — pinned project memory (stack, non-negotiables, scope guardrails). Claude Code reads this automatically.
- [`.claude/skills/`](./.claude/skills/) — domain skills the agent applies on relevant tasks (compliance rules, deal state machine). Extend these as you add domains.

Start from the sequenced build prompts in `docs/DEV_PROMPT.md`.

---

## Documentation map

| File | Purpose |
|------|---------|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | System design, data flow, why each DB |
| [`SECURITY.md`](./SECURITY.md) | Security model, PII handling, vuln reporting |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Dev workflow, conventions, Definition of Done |
| [`docs/COMPLIANCE.md`](./docs/COMPLIANCE.md) | Indian regulatory mapping & verification rules |
| [`docs/DATA_MODEL.md`](./docs/DATA_MODEL.md) | Entity reference / data dictionary |
| [`CLAUDE.md`](./CLAUDE.md) | Agent context for Claude Code |

---

## Roadmap (high level)

1. **Foundation** — auth, orgs, RBAC, audit
2. **Trust core** — compliance & verification engine
3. **Marketplace** — catalog, listings, AI discovery
4. **Transactions** — deal rooms, quotes, workflow
5. **Arbitration** — disputes, evidence, awards
6. **Clients** — web portal + mobile shell
7. **Hardening** — SOC 2 / ISO 27001 path, real provider integrations (post-licence)

Start narrow: **one state, one mineral.** Prove the trust loop, then scale.

---

<div align="center">
<sub>Proprietary · Not for distribution · © 2025 Khanij Nexus</sub>
</div>

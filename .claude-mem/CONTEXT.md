# Project Context Snapshot

> Claude reads this first. Last updated: 2026-06-15.

## What is this

**Khanij Nexus** — AI-powered B2B marketplace + dispute arbitration for India's mines &
minerals trade. Institutional grade. Not a consumer app.

Core loop: Seller onboards with compliance docs → gets TrustScore → lists minerals →
Buyer searches (AI-assisted) → sends RFQ → Seller quotes → Deal room (milestones,
escrow, AI co-pilot, real-time chat) → Dispute → Arbitration → Award.

## Monorepo map

```
apps/api        NestJS backend (primary codebase — most active)
apps/web        Next.js 14 frontend (currently placeholder — needs full build)
apps/mobile     Expo / React Native (skeleton only)
packages/types  Zod schemas + TypeScript types — single source of truth
packages/ui     Shared React components
packages/config Shared tsconfig/eslint
docs/           All design docs (ADR, PRD, flows, guides)
.claude/        Claude Code config (settings.json + 6 skills)
.claude-mem/    THIS DIRECTORY — Claude's persistent project memory
```

## Stack (frozen — never substitute without asking)

| Layer | Tech |
|-------|------|
| Backend | Node 20, NestJS, Prisma, PostgreSQL 16+TimescaleDB, Redis 7, Elasticsearch 8, MongoDB, BullMQ |
| Frontend | Next.js 14 (App Router), Tailwind, shadcn/ui, Framer Motion, React Three Fiber, GSAP |
| Mobile | Expo 52, React Native 0.76 |
| AI | Anthropic Claude via `AiService` only — never call SDK elsewhere |
| Auth | JWT 15m/7d rotating refresh, Argon2id, RBAC guards |
| Infra | Docker (dev) → Kubernetes EKS (prod), AWS ap-south-1 |

## Current build status (2026-06-15)

| Module | Status |
|--------|--------|
| Auth (JWT, RBAC) | ✅ Done |
| Compliance engine (TrustScore, 12-item checklist) | ✅ Done |
| Catalog (minerals) + Listings | ✅ Done |
| Discovery (AI NL search → Elasticsearch) | ✅ Done |
| Deal rooms (RFQ→Quote→Deal→Milestones→Escrow) | 🚧 In progress |
| Real-time WebSocket (deal chat) | ⏳ Pending |
| Arbitration module | ⏳ Pending |
| Web frontend | ⏳ Pending (placeholder only) |
| Mobile | ⏳ Skeleton only |

## The 5 things to always do

1. All Claude calls → `AiService` in `apps/api/src/ai/ai.service.ts`
2. Money → BigInt paise, never float, always transactional
3. PII → AES-256-GCM encrypted, never logged/indexed/AI-prompted
4. Every mutation → `audit_log` row (append-only)
5. Every state change → Zod-validated input + authZ at route AND data layer

## What NOT to build for real (sandbox/stub only)

- Real Aadhaar eKYC → `SandboxKycProvider`
- Real payment rails → `StubPaymentProvider` (needs RBI PA/PA-C licence)
- Blockchain anchoring → `AuditAnchor` no-op interface
- Live LME/MCX feeds → `SandboxPriceFeedProvider`
- Neo4j fraud graph → SQL heuristics only

## Agent start point

An agent picking up this project should:
1. Read this file (`.claude-mem/CONTEXT.md`)
2. Read `IMPLEMENTATION.md` — it has the ordered build plan with exact files, bugs to fix, and DoD per phase
3. Start at the first non-✅ phase: **Phase 5A — Fix escrow BigInt bug** in `apps/api/src/deals/escrow/escrow.service.ts`

## Key documents

- `IMPLEMENTATION.md` — **ordered build plan** (phases 5–12, exact files, bugs, DoD) ← agents read this
- `CLAUDE.md` — master agent context (always loaded)
- `PRD.md` — feature requirements, personas, success metrics
- `APP_FLOW.md` — all user journeys + screen inventory
- `AI_AGENTS.md` — 8 AI agents fully specified
- `DATA_FLOW.md` — 11 data flow diagrams
- `docs/ADR.md` — 15 architecture decision records
- `docs/FRONTEND.md` — Next.js + R3F + Framer Motion guide
- `docs/BACKEND.md` — NestJS patterns, all endpoints, DB patterns
- `docs/ANIMATION_3D.md` — 3D scene implementations
- `docs/UI_COMPONENTS.md` — component library spec
- `docs/TESTING.md` — test strategy + key test cases
- `docs/DEPLOYMENT.md` — Docker → K8s → EKS guide
- `.claude/skills/` — 6 domain skills (frontend-ui, ai-agents, backend-api, data-security, compliance-rules, deal-workflow)

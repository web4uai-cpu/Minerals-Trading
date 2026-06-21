# Module Progress Tracker

> Claude updates this when completing or starting work on a module.
> Last updated: 2026-06-15

---

## Backend (`apps/api/`)

### ✅ Completed

| Module | Key files | Tests |
|--------|-----------|-------|
| **Auth** | `auth.controller.ts`, `auth.service.ts`, `jwt-access.strategy.ts`, `guards/`, `decorators/` | Unit + integration |
| **Compliance** | `compliance.service.ts`, `trust-score.calculator.ts`, `jobs/expiry-sweep.{processor,scheduler}.ts` | Unit (calculator) + integration |
| **Catalog** | `catalog.controller.ts`, `catalog.service.ts`, `seed/minerals.seed.ts` | Integration |
| **Listings** | `listings.controller.ts`, `listings.service.ts` | Unit + integration |
| **Discovery** | `discovery.controller.ts`, `discovery.service.ts`, `ranking.ts` | Unit (ranking) + integration |
| **Common** | `filters/http-exception.filter.ts`, `pipes/zod-validation.pipe.ts`, `services/audit.service.ts` | Unit |
| **Logger** | `logger.middleware.ts`, `logger.service.ts`, `trace.context.ts` | — |
| **Prisma** | `prisma.module.ts`, `prisma.service.ts` | — |
| **Providers** | All 6 interfaces + sandbox implementations (kyc, gov-data, payment, price-feed, document-ai, search, storage) | Unit (kyc sandbox) |
| **AI** | `ai.service.ts`, `prompts/parse-search.ts` | Unit |
| **Health** | `health.controller.ts` | Integration |

### 🚧 In Progress

| Module | Status | Files exist? | Notes |
|--------|--------|--------------|-------|
| **Deals** | Skeleton | Partial — `deal-state-machine.ts`, `escrow/escrow.service.ts` | Missing: `deals.controller.ts`, `deals.module.ts`, `deals.service.ts`, RFQ controller/service, Quote controller/service |

### ⏳ Not Started

| Module | Depends on | Estimated complexity |
|--------|-----------|---------------------|
| **RFQ module** (full) | Deals | Medium |
| **Quote module** (full) | RFQ | Medium |
| **Deal module** (full REST + state machine integration) | Quote | High |
| **WebSocket gateway** (deal room real-time) | Deal, Redis pub/sub | High |
| **Arbitration module** | Deal (DISPUTED state) | High |
| **Notification module** (BullMQ processors) | All modules | Medium |
| **Admin endpoints** (compliance queue, org management) | Compliance | Medium |
| **Regulator endpoints** (read-only analytics) | All modules | Low |

---

## Database

### ✅ Migrations applied

| Migration | Contents |
|-----------|----------|
| `20260605000001_identity_rbac` | organizations, users, refresh_tokens, audit_log |
| `20260608000002_compliance_engine` | compliance_items, compliance_snapshots |
| `20260608000003_catalog_listings` | minerals, listings |
| `20260608000004_deal_rooms` | rfqs, quotes, deals, deal_milestones, escrow_ledger, deal_messages |

### ⏳ Migrations needed

| When | For |
|------|-----|
| Arbitration module | disputes, evidence_vault, hearings, awards |
| Notifications | (likely Redis-only — no new Prisma tables) |

---

## Frontend (`apps/web/`)

### Current state
Single placeholder page at `src/app/page.tsx`. No auth, no routing, no components beyond the default layout.

### ⏳ Build order

1. Install animation/3D dependencies (framer-motion, r3f, gsap, lottie-react)
2. Tailwind config with design tokens (color palette, typography)
3. shadcn/ui component installation
4. Shared layout: TopNav, Sidebar, DashboardShell, PageTransition
5. Auth pages: /login, /register
6. Middleware (route protection)
7. Dashboard page (TrustScoreGauge, metric cards)
8. Compliance page (checklist + document upload)
9. Discovery page (SearchBar + Globe + ListingCards)
10. Deal room page (MilestoneTrack + DealChat + EscrowPanel)

---

## Mobile (`apps/mobile/`)

### Current state
Expo skeleton: `app/_layout.tsx`, `app/index.tsx`, `src/api/client.ts`.

### ⏳ Planned
Push notifications, document upload via camera, deal status tracking. Defer until web is stable.

---

## Documentation

### ✅ Created 2026-06-15
PRD.md · APP_FLOW.md · AI_AGENTS.md · DATA_FLOW.md · docs/ADR.md ·
docs/FRONTEND.md · docs/BACKEND.md · docs/ANIMATION_3D.md · docs/UI_COMPONENTS.md ·
docs/AI_AGENTS.md · docs/TESTING.md · docs/DEPLOYMENT.md · .claude/settings.json ·
.claude/skills/{frontend-ui,ai-agents,backend-api,data-security}/SKILL.md ·
.claude-mem/{README,CONTEXT,DECISIONS,PROGRESS,OPEN_QUESTIONS,PATTERNS}.md

---

<!-- Claude: update rows above when completing or starting modules -->

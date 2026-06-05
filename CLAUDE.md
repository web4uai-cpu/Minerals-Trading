# CLAUDE.md — Agent Context for Khanij Nexus

> Claude Code reads this file automatically and keeps it in context. It is the
> persistent "master prompt" for this repo. Keep it short, current, and truthful.

## What you are building

Khanij Nexus — an AI-powered B2B marketplace + dispute-arbitration platform for
India's mines & minerals trade. Buyers and sellers onboard with verified
compliance, get AI-matched, transact in monitored deal rooms, and resolve
disputes through structured arbitration.

## Your operating standards

- Production-grade, fully typed, tested code. No placeholder logic, no `TODO`
  stubs in committed code, no mock data outside designated seed/fixture files.
- Every endpoint: input validation → authz check → business logic →
  structured error handling → audit log entry.
- Security and compliance are features. When in doubt, **fail closed**.
- If a requirement touches money, PII, Aadhaar, or legal behavior and is
  ambiguous — **stop and ask** before implementing. Do not guess.
- Ask before adding any new dependency.

## Locked stack (do not substitute without asking)

TypeScript (strict) · Node 20 + NestJS · Next.js 14 + Tailwind + shadcn/ui ·
React Native (Expo) · PostgreSQL 16 + TimescaleDB + Prisma · Redis 7 ·
Elasticsearch 8 · MongoDB · S3/MinIO · BullMQ · Anthropic Claude via `AiService`.
JWT (15m access / 7d rotating refresh) · Argon2id · Docker → K8s · AWS ap-south-1.

## Repo layout

```
apps/{api,web,mobile}   packages/{types,ui,config}   infra/   docs/   .claude/skills/
```

`packages/types` is the **single source of truth** for types + Zod schemas —
client and server both import from it.

## The 10 non-negotiables (apply to every change)

1. **Validate** every external input with Zod (schemas live in `packages/types`).
2. **AuthZ** via role guards (BUYER, SELLER, ARBITRATOR, ADMIN, REGULATOR_READONLY)
   enforced at the route **and** the data layer (scope every query by `orgId`).
3. **Audit** — append-only `audit_log` row for every state-changing action
   (actor, action, before/after hash, timestamp, ip). Never deletable.
4. **PII** — Aadhaar, PAN, bank account, GSTIN are field-level encrypted at rest
   (AES-256-GCM). Never logged in plaintext. Masked in list endpoints.
5. **Money** — integers in paise (BIGINT), never floats. Use the `Money` value
   object. Every financial mutation is transactional.
6. **Idempotency** — resource-creating POSTs accept an `Idempotency-Key` header.
7. **Errors** — typed error classes → `{ code, message, traceId }`. No stack
   traces or internal IDs leaked to clients.
8. **Tests** — unit (services, guards) + integration (happy / auth-fail /
   validation-fail) per module. 80%+ on business logic.
9. **Observability** — structured JSON logs (pino) with `traceId`; OTel hooks.
10. **Compliance data is the product** — verification status is versioned,
    timestamped, append-only. Never overwrite a compliance record.

## AI usage rules (critical)

- All Claude calls go through `apps/api/src/ai/ai.service.ts`. Never call the SDK
  from a controller.
- Prompts live in `apps/api/src/ai/prompts/`. Each prompt instructs strict JSON
  output where structured data is needed; **always Zod-validate the response.**
- The AI **parses intent and drafts text** — it does not supply facts it could
  fabricate. Sellers, prices, and compliance status always come from our DB.
- Guard every user-supplied string passed to a prompt against prompt injection.
- AI-drafted contracts and arbitration briefs are **decision-support, clearly
  labeled, never auto-binding**. A human signs / rules.

## Scope guardrails — do NOT build these for real (refuse politely)

- Real Aadhaar eKYC → use `KycProvider` interface + `SandboxKycProvider`.
- Real escrow / money movement → model the ledger + states; `PaymentProvider`
  is a stub. Real rails need an RBI PA/PA-C licence — out of scope.
- Blockchain anchoring → `AuditAnchor` interface, no-op impl.
- Neo4j fraud graph → interface + simple SQL heuristics for MVP.
- Live LME/MCX feeds → `PriceFeedProvider` interface + seeded sandbox data.

Faking any of these to look production-real is a serious error.

## Definition of Done (per module)

Strict TS (no `any` in logic) · Zod schemas shared · authz at route + data layer ·
audit rows written · PII encrypted & masked · money in paise & transactional ·
tests cover happy/auth-fail/validation-fail · structured logs · reversible Prisma
migration + seed updated · ADR note for non-obvious decisions.

## Output format when given a task

Produce: (a) the files, (b) Prisma migration if schema changed, (c) Zod schemas
in `packages/types`, (d) tests, (e) one line on what to verify manually.

## Where to start

Build the vertical slice in order — see `docs/DEV_PROMPT.md`:
Foundation → Identity/RBAC → Compliance engine → Catalog/Discovery →
Deal rooms → Arbitration → Web/Mobile. Pilot **one state, one mineral** first.

## Domain skills

Detailed domain rules live in `.claude/skills/`. Consult the relevant SKILL.md
before working on:
- `compliance-rules/` — what makes an org verified, how TrustScore is computed.
- `deal-workflow/` — the deal state machine and legal transitions.

# Contributing

Thanks for working on Khanij Nexus. This guide covers workflow and conventions.
Read `CLAUDE.md` (agent + human standards), `ARCHITECTURE.md`, and `SECURITY.md`
before your first PR.

## Local setup

See the Quickstart in `README.md`. TL;DR:

```bash
pnpm install
cp .env.example .env          # fill secrets
docker compose -f infra/docker-compose.yml up -d
pnpm --filter api prisma migrate dev && pnpm --filter api prisma db seed
pnpm dev
```

## Branching & commits

- Branch from `main`: `feat/<area>-<short>`, `fix/<area>-<short>`, `chore/...`.
- Conventional Commits: `feat(compliance): add trust score decay`,
  `fix(auth): refresh reuse detection`, `test(deals): cover illegal transitions`.
- Keep PRs small and single-purpose. One module concern per PR where possible.

## Code conventions

- **TypeScript strict.** No `any` in business logic. Prefer narrow types + Zod.
- **Shared types** live in `packages/types` and are imported by both client and
  server. Do not duplicate a type or schema across apps.
- **Validation:** every external input parsed with a Zod schema.
- **Errors:** throw typed error classes; the global filter maps them to
  `{ code, message, traceId }`. Never `throw new Error('...')` in a controller.
- **Money:** use the `Money` value object; store paise as BIGINT.
- **No magic strings** for roles/statuses — use enums from `packages/types`.
- **Naming:** services `*.service.ts`, controllers `*.controller.ts`, Zod
  schemas `*.schema.ts`, Prisma models PascalCase singular.
- Run `pnpm lint && pnpm typecheck` before pushing; CI enforces both.

## Database changes

- Schema changes go through Prisma migrations: `pnpm --filter api prisma migrate dev`.
- Migrations must be reversible and committed with the PR.
- Update `db seed` when you add tables that demos/tests rely on.
- Never edit a shipped migration; add a new one.

## Testing

- **Unit:** services, guards, value objects, the ranking function.
- **Integration:** every module's happy path + auth-fail (403) + validation-fail (400).
- **E2E:** maintain the Playwright flow (register → verify → list → search → RFQ →
  quote → deal room).
- Target 80%+ coverage on business logic. PRs that lower coverage need a reason.
- Tests must not hit external networks; providers are sandboxed in test env.

## Definition of Done (must all be true)

- [ ] Strict TS, no `any` in logic, no committed `TODO` stubs.
- [ ] Zod schemas in `packages/types`; client & server share them.
- [ ] AuthZ enforced at route + data layer; cross-org access blocked & tested.
- [ ] Immutable `audit_log` row for every state-changing action.
- [ ] PII encrypted at rest; never logged or returned unmasked.
- [ ] Money in paise; financial mutations transactional.
- [ ] Unit + integration tests cover happy / auth-fail / validation-fail.
- [ ] Structured logs with traceId; consistent error envelope.
- [ ] Reversible Prisma migration committed; seed updated.
- [ ] ADR note in `docs/adr/` for any non-obvious decision.
- [ ] AI calls go through `AiService`, prompts in `ai/prompts/`, outputs validated.

## Scope discipline

Do **not** implement real Aadhaar eKYC, escrow/payment rails, blockchain
anchoring, the Neo4j graph, or live market feeds. These are stubbed behind
provider interfaces on purpose (see `ARCHITECTURE.md` §4). If a task seems to
require one of them for real, raise it — there are legal prerequisites.

## Working with Claude Code

- `CLAUDE.md` is auto-loaded context. Keep it accurate when conventions change.
- Domain rules live in `.claude/skills/`. If you add a domain (e.g. logistics,
  insurance), add a skill so the agent applies the rules consistently.
- Use the sequenced prompts in `docs/DEV_PROMPT.md`; build one vertical slice at
  a time and review before moving on.

## PR review checklist (reviewer)

Correctness · security (PII, authz, money) · tests present & meaningful ·
migration reversible · no scope creep into stubbed integrations · docs/ADR
updated · `CLAUDE.md` still accurate.

# Agent Workflow — Khanij Nexus

> How any AI coding agent (Claude, GPT, Cursor, Windsurf, Cline, RooCode,
> Aider, OpenHands) should approach tasks in this repository.

## Before Writing Any Code

1. **Read `CLAUDE.md`** — understand the 10 non-negotiables and locked stack.
2. **Read `.ai/constitution/REPOSITORY_CONSTITUTION.md`** — the 10 immutable laws.
3. **Check `.ai/context/BUILD_ORDER.md`** — know which phase is current.
4. **Consult the relevant domain skill** in `.claude/skills/` if working on
   compliance, deals, AI, security, frontend, or backend.
5. **Read the domain package docs** (`packages/{domain}/docs/README.md`) for
   the domain you're modifying.

## When Implementing a Feature

1. **Update documentation first** — modify or create the domain docs
   (API_SPEC, WORKFLOWS, SCHEMAS) before writing implementation code.
2. **Write types and events** — define domain types in
   `packages/{domain}/src/types/` and events in `packages/{domain}/src/events/`.
3. **Write pure logic** — implement business rules in
   `packages/{domain}/src/logic/` with tests. No NestJS dependencies.
4. **Write NestJS module** — create controller, service, module in
   `apps/api/src/{module}/`. Import logic from the domain package.
5. **Write tests** — unit tests for pure logic, integration tests for endpoints
   (happy path, auth-fail, validation-fail).
6. **Update Prisma schema** if new tables are needed. Create a migration.
7. **Verify** — `pnpm build && pnpm test && pnpm typecheck`.

## Rules for All Agents

- **Never invent architecture** — follow the existing patterns in the codebase.
- **Never bypass compliance** — if a feature touches verification, TrustScore,
  or trade eligibility, the compliance module must be involved.
- **Never create duplicate entities** — check `governance/ENTITY_REGISTRY.md`
  before defining a new model.
- **Follow domain boundaries** — marketplace logic belongs in
  `packages/marketplace`, not in `packages/deals`.
- **Follow event contracts** — use the event naming and payload conventions
  from `.ai/standards/EVENT.md`.
- **Ask before adding dependencies** — no new npm packages without discussion.
- **Money in paise, PII encrypted, audit everything** — the three pillars.

## Output Checklist

Every feature delivery must include:
- [ ] Domain docs updated
- [ ] Zod schemas in `@khanij/types` or domain package
- [ ] Pure logic with tests in domain package
- [ ] NestJS module with controller + service
- [ ] AuthZ at route and data layer
- [ ] Audit log entries for state changes
- [ ] Integration tests (happy, auth-fail, validation-fail)
- [ ] Prisma migration if schema changed

# AI Agent Operating Rules — Khanij Nexus

> Applies to every AI coding agent working in this repository.

## Agents Governed

- Claude (Claude Code, API)
- GPT (ChatGPT, API)
- Cursor
- Windsurf
- Cline
- RooCode
- Aider
- OpenHands
- Any future AI coding assistant

## The Rules

### 1. Never Invent Architecture
Follow the repository's established structure. Domain packages hold pure logic.
NestJS modules hold HTTP/DI/persistence. Do not introduce new architectural
patterns without an ADR.

### 2. Follow Repository Architecture
```
packages/{domain}/src/logic/    → Pure business logic (no NestJS, no Prisma)
packages/{domain}/src/types/    → Domain-specific types
packages/{domain}/src/events/   → Domain event definitions
apps/api/src/{module}/          → NestJS controllers, services, guards
packages/types/                 → Shared Zod schemas (source of truth)
```

### 3. Follow Domain Boundaries
Each domain package owns its logic. Do not put marketplace logic in the deals
package. Do not put compliance logic in the marketplace package. Check
`governance/ENTITY_REGISTRY.md` for entity ownership.

### 4. Follow Event Contracts
Use the event naming convention: `{Domain}.{Entity}.{PastTenseVerb}`.
Include required base fields. See `.ai/standards/EVENT.md`.

### 5. Never Bypass Compliance Modules
Any action gated by verification status (listing activation, deal signing,
bidding) must check compliance through the compliance package. No shortcuts.

### 6. Never Create Duplicate Entities
Before adding a new Prisma model, check `governance/ENTITY_REGISTRY.md` and
`apps/api/prisma/schema.prisma`. If a similar entity exists, extend it.

### 7. Every Feature Requires
- **Documentation** — domain docs updated before or with implementation
- **Tests** — unit tests for logic, integration tests for endpoints
- **Audit Trail** — audit log entry for every state-changing action
- **Security Review** — PII handling, authz checks, input validation verified

### 8. Update Documentation Before Code
Read and update the domain's `docs/` before implementing. This ensures the
design is reviewed before the code is written.

### 9. Code Must Align with PRD
Every feature must trace back to a requirement in the PRD or a domain's
`docs/PRD.md`. Do not build features that aren't in the product spec.

### 10. All Modules Must Be AI-Compatible
Design every module so that AI agents can:
- Parse its types (exported Zod schemas)
- Understand its state machines (pure functions with clear signatures)
- Test its logic (no hidden dependencies)
- Extend it safely (domain boundaries prevent cross-contamination)

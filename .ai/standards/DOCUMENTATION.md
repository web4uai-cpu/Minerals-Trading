# Documentation Standard — Khanij Nexus

## Required Documents per Domain Package

Every domain package (`packages/{domain}/`) must contain these 7 documents in
its `docs/` directory:

| Document | Purpose |
|----------|---------|
| `README.md` | Domain overview: what it owns, boundaries, key concepts |
| `PRD.md` | Product requirements specific to this domain |
| `API_SPEC.md` | HTTP endpoint specifications (method, path, request/response, auth) |
| `WORKFLOWS.md` | Business process flows with state diagrams |
| `SCHEMAS.md` | Data model documentation (tables, fields, relationships) |
| `EVENTS.md` | Domain event contracts (name, payload, when emitted) |
| `TESTS.md` | Test strategy: what to test, key scenarios, coverage targets |

## When to Write Documentation

**Before code.** When starting a new domain or feature:

1. Write or update the domain `README.md` with scope and boundaries.
2. Document the data model in `SCHEMAS.md`.
3. Define events in `EVENTS.md`.
4. Specify endpoints in `API_SPEC.md`.
5. Then implement.

Updates to existing logic must update the corresponding docs in the same PR.

## Architecture Decision Records (ADRs)

Write an ADR when:
- Choosing between alternatives with meaningful trade-offs.
- Making a decision that constrains future options.
- Overriding a convention for a specific reason.

ADR format (see `.ai/memory/decisions/ADR_TEMPLATE.md`):
- **Title**: Short, descriptive.
- **Status**: Proposed → Accepted → Superseded.
- **Context**: What problem prompted this decision.
- **Decision**: What we chose and why.
- **Consequences**: What follows from this choice (good and bad).

ADRs live in `.ai/memory/decisions/{category}/` where category is
`architecture`, `domain`, `compliance`, or `ai`.

## Document Quality Rules

1. **No orphan docs** — every document must be referenced from its domain
   README.md or from `.ai/context/PROJECT_MANIFEST.md`.
2. **No stale docs** — if code changes invalidate a document, update it in the
   same PR. Stale docs are worse than no docs.
3. **No aspirational docs** — document what exists, not what might exist someday.
   Future plans go in ADRs or the build order, not in API specs.
4. **Concise over comprehensive** — a 2-page doc that's read beats a 20-page doc
   that's ignored.

# Coding Standard — Khanij Nexus

## TypeScript

- **Strict mode** — `strict: true` in all tsconfig files. No exceptions.
- **No `any`** in business logic. Permitted only in test fixtures and type-casting
  at system boundaries (e.g., parsing unknown JSON), and must be narrowed
  immediately with Zod.
- **No `as` type assertions** in business logic. Use type guards or Zod parsing.
- **No `@ts-ignore` or `@ts-expect-error`** without a comment explaining the
  specific bug or library limitation being worked around.

## Naming

| Element | Convention | Example |
|---------|-----------|---------|
| Files | `kebab-case.ts` | `trust-score.calculator.ts` |
| Classes / Interfaces / Types | `PascalCase` | `ComplianceService` |
| Functions / Variables | `camelCase` | `computeTrustScore` |
| Constants | `UPPER_SNAKE_CASE` | `REQUIRED_ITEMS_BY_ORG_TYPE` |
| Enums | `PascalCase` (enum), `UPPER_SNAKE_CASE` (values) | `DealStatus.IN_FULFILMENT` |
| Database tables | `snake_case` (via Prisma `@@map`) | `compliance_items` |
| API routes | `kebab-case` | `/api/v1/compliance-items` |

## File Organization

- One exported class/function per file (helpers may be co-located if private).
- Maximum function length: **50 lines**. Extract helpers if longer.
- Maximum file length: **300 lines**. Split into focused modules if longer.

## Import Ordering

1. Node built-ins (`node:crypto`, `node:path`)
2. External packages (`@nestjs/*`, `zod`, `pino`)
3. Workspace packages (`@khanij/types`, `@khanij/compliance`)
4. Relative imports (`./`, `../`)

Blank line between each group.

## Comments

- Default to **no comments**. Well-named identifiers replace explanatory comments.
- Add a comment only when the **why** is non-obvious: a hidden constraint, a
  workaround, a regulatory requirement, behavior that would surprise a reader.
- Never reference tickets, PRs, or "added for X feature" — those rot.

## Error Handling

- Use typed error classes that map to `{ code, message, traceId }`.
- Never expose stack traces or internal IDs to clients.
- Fail closed on ambiguous states — deny the action, log the anomaly.

## Testing

- Co-locate test files: `trust-score.calculator.test.ts` next to
  `trust-score.calculator.ts`.
- Test file naming: `{source-file}.test.ts`.
- Every pure function in `packages/{domain}/src/logic/` must have a test file.

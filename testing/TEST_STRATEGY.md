# Test Strategy — Khanij Nexus

## Test Pyramid

### Unit Tests (~60% of test effort)
- **What:** Pure functions in domain packages, Zod schema validation, value objects
- **Where:** Co-located `*.test.ts` files in `packages/{domain}/src/logic/`
- **Framework:** Jest + ts-jest
- **Coverage target:** 80%+ on business logic

### Integration Tests (~30% of test effort)
- **What:** NestJS controllers with real DI wiring, Prisma against test DB
- **Where:** Co-located `*.test.ts` in `apps/api/src/{module}/`
- **Framework:** Jest + Supertest + `@nestjs/testing`
- **Pattern:** Every endpoint tested for 3 scenarios:
  1. **Happy path** — valid input, authorized user → expected result
  2. **Auth failure** — missing/invalid token, wrong role → 401/403
  3. **Validation failure** — invalid input → 400 with Zod error details

### Contract Tests (~5% of test effort)
- **What:** API contract verification between frontend and backend
- **Where:** `testing/contracts/`
- **Framework:** Pact or manual Zod schema comparison
- **Purpose:** Ensure frontend and backend agree on request/response shapes

### E2E Tests (~5% of test effort)
- **What:** Full user journeys through the web UI
- **Where:** `apps/web/e2e/` (when web frontend exists)
- **Framework:** Playwright
- **Scope:** Golden paths only:
  - Seller onboarding → compliance upload → listing creation
  - Buyer search → RFQ → Quote → Deal creation
  - Dispute filing → Award (Phase 9+)

## Specialized Test Types

### Security Tests
- Auth bypass attempts (missing token, expired token, wrong org)
- Role escalation (BUYER accessing ADMIN endpoints)
- PII exposure (verify encrypted fields never appear in responses/logs)
- Injection (SQL, prompt injection in AI inputs)

### Compliance Tests
- Verify org status gating (listing activation, deal signing)
- TrustScore computation accuracy
- Audit log completeness (every state change has a log entry)
- Append-only enforcement (audit_log, escrow_ledger, compliance_snapshots)

### AI Evaluation Tests
- See `testing/AI_EVALS.md` for metrics and methodology
- Hallucination detection: AI output vs DB ground truth
- Prompt injection resistance: adversarial inputs in search queries

## Test Data

### Shared Fixtures (`testing/fixtures/`)
- Standard orgs: verified seller, pending buyer, suspended trader
- Standard users: one per role
- Mineral catalog: 5 seeded minerals with grade params
- Reference prices: seeded sandbox data per state

### Database Seeding
- Test database created fresh per integration test suite
- Prisma migrations applied, then fixtures loaded
- No shared state between test files

## Running Tests

```bash
pnpm test              # All unit + integration tests
pnpm test --filter=api # API tests only
pnpm test:e2e          # E2E tests (requires running services)
```

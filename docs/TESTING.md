# Testing Strategy — Khanij Nexus

> Coverage target: 80%+ on all business logic (services, guards, calculators).  
> Test types: unit → integration → E2E (Playwright, not Jest).

---

## Test Pyramid

```
           ┌─────────────┐
           │   E2E Tests  │  Playwright — golden paths + auth flows
           │   (< 20)     │
          ┌┴─────────────┴┐
          │  Integration   │  Supertest — happy + auth-fail + validation-fail
          │   Tests        │  per API module (~3 per endpoint)
          │   (~ 150)      │
         ┌┴───────────────┴┐
         │   Unit Tests     │  Jest — services, guards, calculators, utils
         │   (~ 400)        │
         └─────────────────┘
```

---

## Unit Tests

### What to unit test:
- Service methods (mock PrismaService, AiService, etc.)
- Guards (JwtAuthGuard, RolesGuard, ComplianceGuard)
- TrustScoreCalculator
- DealStateMachine
- Money value object
- FieldEncryption utility
- RankingService
- All Zod schemas (validate happy + rejection cases)

### What NOT to unit test:
- Controllers (covered by integration tests)
- Prisma service itself
- Provider sandbox implementations (covered by integration)

### Mock pattern:
```typescript
// Use jest-mock-extended for type-safe mocks
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from '../prisma/prisma.service';

let prisma: DeepMockProxy<PrismaService>;
let service: ListingsService;

beforeEach(() => {
  prisma = mockDeep<PrismaService>();
  service = new ListingsService(prisma, mockAuditService, mockLogger);
});
```

---

## Integration Tests

### What to integration test:
Every controller endpoint with at least 3 test cases:
1. **Happy path** — correct role, valid body, expected response
2. **Auth fail** — wrong role → 403, no token → 401
3. **Validation fail** — invalid body → 400 with Zod error

### Setup pattern:
```typescript
// apps/api/src/test/setup.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';
import request from 'supertest';

export async function createTestApp(): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = module.createNestApplication();
  await app.init();
  return app;
}

// Test database: use a separate DB (TEST_DATABASE_URL env var)
// Runs migrations + seed before each test suite
```

### Auth helper:
```typescript
// apps/api/src/test/auth.helper.ts
export async function getToken(
  app: INestApplication,
  role: UserRole,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: TEST_USERS[role].email, password: 'Test@12345' });
  return res.body.accessToken;
}
```

---

## Key Test Cases by Module

### Auth
```
✓ POST /auth/register creates org + user + returns tokens
✓ POST /auth/login returns accessToken + sets httpOnly cookie
✓ POST /auth/login with wrong password returns 401
✓ POST /auth/refresh rotates tokens
✓ POST /auth/refresh with revoked token returns 401 + revokes family
✓ POST /auth/logout revokes refresh token
```

### Compliance
```
✓ GET /compliance/:orgId returns all 12 items (MISSING by default)
✓ POST /compliance/.../upload changes status to UPLOADED
✓ PATCH /compliance/.../verify (ADMIN) → VERIFIED + snapshot appended
✓ PATCH /compliance/.../verify (SELLER) → 403
✓ TrustScoreCalculator: all VERIFIED → score > 80
✓ TrustScoreCalculator: EXPIRED items → score decays
✓ Nightly sweep: VERIFIED items with past validUntil → EXPIRED
```

### Listings
```
✓ POST /listings (VERIFIED SELLER) → DRAFT listing created
✓ POST /listings (PENDING org) → 403 ComplianceGatingError
✓ PATCH /listings/:id/activate → status=ACTIVE, Elasticsearch indexed
✓ GET /listings scoped to seller's own listings only
✓ Buyer cannot create listing → 403
```

### Discovery
```
✓ POST /discovery/search "62% Fe iron ore" → returns ranked results
✓ Results only include ACTIVE listings from VERIFIED sellers
✓ TrustScore affects ranking (higher TrustScore ranks higher at same price)
✓ AI parse fails gracefully (returns full-text search fallback)
```

### Deals (to build)
```
✓ POST /rfqs (VERIFIED BUYER) → RFQ created, sellers notified
✓ POST /rfqs/:id/quotes (VERIFIED SELLER) → Quote SENT
✓ POST /rfqs/:id/quotes/:id/accept → Deal CREATED + 6 milestones
✓ PATCH /deals/:id/status: invalid transition → 400 DealStateMachineError
✓ EscrowLedger: HELD - RELEASED = correct balance
✓ Deal cannot reach SIGNED if buyer org not VERIFIED
✓ POST /deals/:id/dispute (IN_FULFILMENT) → DISPUTED
```

---

## TrustScore Test Cases

```typescript
describe('TrustScoreCalculator', () => {
  it('returns 0 for org with all MISSING items');
  it('returns ~25 for org with only GST_REG + PAN verified');
  it('returns ~80 for org with all mandatory items verified');
  it('returns 100 for org with all 12 items verified');
  it('applies 0.5 decay factor for items expiring in < 30 days');
  it('excludes EXPIRED items from positive score contribution');
  it('snapshot is appended (not updated) on each recalculation');
});
```

---

## Money Unit Tests

```typescript
describe('Money', () => {
  it('fromRupees(100) → 10000n paise');
  it('fromRupees(99.99) → 9999n paise');
  it('rejects negative amounts');
  it('rejects floats with too many decimal places');
  it('add() → correct BigInt sum');
  it('subtract() → throws if result negative');
  it('toDisplayString() → ₹ 1,00,000.00 format');
});
```

---

## Zod Schema Tests

```typescript
describe('CreateListingSchema', () => {
  it('accepts valid listing with grade params');
  it('rejects when askPriceInPaise is not a positive integer');
  it('rejects when quantityAvailable is 0');
  it('rejects XSS in notes field');
  it('rejects oversized grade JSON (> 50 keys)');
});
```

---

## E2E Tests (Playwright)

Location: `apps/web/e2e/`

### Key flows:
```
✓ Seller registers → uploads documents → admin verifies → creates listing
✓ Buyer searches → sends RFQ → receives quote → accepts → deal room opens
✓ Deal progresses through all 6 milestones → completed
✓ Deal goes to dispute → arbitrator assigned → award issued
✓ Token expiry → refresh → seamless UX (no re-login)
```

---

## CI Test Configuration

```yaml
# turbo.json pipeline
"test": {
  "dependsOn": ["^build"],
  "env": ["TEST_DATABASE_URL", "TEST_REDIS_URL"],
  "outputs": ["coverage/**"]
}
```

CI runs:
1. `pnpm typecheck` (all packages)
2. `pnpm lint` (all packages)
3. `pnpm test` (unit + integration — real test DB)
4. `pnpm --filter @khanij/web e2e` (Playwright — dev server started by CI)
5. Coverage report uploaded to Codecov

---

## Test Data Management

```typescript
// apps/api/src/test/fixtures/
├── orgs.fixture.ts      // Verified buyer + seller, pending org
├── users.fixture.ts     // One user per role
├── listings.fixture.ts  // Active + draft + paused listings
├── compliance.fixture.ts // Fully verified + partial + expired
└── deals.fixture.ts     // One deal per status

// Reset between test suites:
await prisma.$executeRaw`TRUNCATE TABLE organizations CASCADE`;
// Then re-seed fixtures
```

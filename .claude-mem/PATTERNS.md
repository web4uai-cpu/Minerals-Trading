# Established Code Patterns

> Patterns that have been validated in this codebase. When writing new code,
> follow these exactly unless there's a new ADR overriding them.

---

## 1. NestJS Module Template

Established in: `src/compliance/`, `src/listings/`, `src/discovery/`

```
{module}/
├── {module}.module.ts          ← providers list, imports, exports
├── {module}.controller.ts      ← routes only, no logic
├── {module}.controller.test.ts ← Supertest integration tests
├── {module}.service.ts         ← all business logic
├── {module}.service.test.ts    ← Jest unit tests with mocked deps
└── (optional) jobs/            ← BullMQ processors and schedulers
```

Controller: never touches Prisma, never makes AI calls.  
Service: injected by controller; does all DB, AI, cache, audit operations.

---

## 2. Zod Validation at HTTP Boundary

Established in: all controllers via `ZodValidationPipe`

```typescript
@Post()
async create(
  @Body(new ZodValidationPipe(CreateListingSchema)) body: CreateListingDto,
```

Schema comes from `@khanij/types`. The pipe throws a `400 BAD_REQUEST` with
Zod error messages if validation fails — caught by `HttpExceptionFilter`.

---

## 3. AuthZ at Data Layer (orgId scoping)

Established in: `ListingsService`, `ComplianceService`, `DiscoveryService`

Every Prisma query that reads org-specific data includes a `where: { orgId: actor.orgId }` clause.
Never trust a path/body `orgId` parameter — always use `actor.orgId` from the JWT payload.

```typescript
// BAD: uses client-supplied orgId
await this.prisma.listing.findMany({ where: { orgId: params.orgId } });

// GOOD: uses server-verified orgId from JWT
await this.prisma.listing.findMany({ where: { sellerOrgId: actor.orgId } });
```

---

## 4. Audit Log Pattern

Established in: `ComplianceService`, `ListingsService`

```typescript
// After the mutation succeeds (not inside the transaction):
await this.audit.log({
  actor: actor.userId,
  actorOrgId: actor.orgId,
  action: 'listing.activated',
  entityType: 'Listing',
  entityId: listing.id,
  afterHash: sha256(JSON.stringify(listing)),
  ip,
  traceId: TraceContext.get(),
});
```

`beforeHash` is set only when the previous state matters (e.g., `compliance_item.verified`
logs the pre-verify state hash).

---

## 5. Provider Interface + Sandbox Pattern

Established in: `src/providers/` (6 providers)

```typescript
// Interface (never import the concrete class directly in business logic):
export interface KycProvider {
  verifyAadhaar(aadhaarProxy: string, otp: string): Promise<KycVerificationResult>;
}

// Sandbox (injected via DI token `KYC_PROVIDER`):
@Injectable()
export class SandboxKycProvider implements KycProvider { ... }

// NestJS DI wiring in ProvidersModule:
{ provide: KYC_PROVIDER, useClass: SandboxKycProvider }
```

When real provider is built, only change the `useClass` in the module — zero changes to
consuming services.

---

## 6. AI Agent Call Pattern

Established in: `DiscoveryService.search()`

```typescript
// 1. Sanitize input
const sanitized = sanitizeForPrompt(dto.query, 500);

// 2. Call AiService (never Anthropic SDK directly)
const intent = await this.ai.complete({
  agentName: 'search-intent-parser',
  systemPrompt: SEARCH_INTENT_SYSTEM_PROMPT,
  userContent: sanitized,
  outputSchema: SearchIntentOutputSchema,
  orgId: actor.orgId,
  actorUserId: actor.userId,
});

// 3. Use the Zod-validated result
if (intent.confidence < 0.5) return this.fallbackSearch(dto.query);
return this.search.searchListings(intent);
```

---

## 7. TrustScore Recalculation Pattern

Established in: `ComplianceService`

```typescript
// After any compliance item status change:
const snapshot = await this.calculator.compute(orgId);  // pure function, reads DB
await this.prisma.complianceSnapshot.create({            // APPEND, never update
  data: {
    orgId,
    trustScore: snapshot.score,
    breakdown: snapshot.breakdown,
    triggeredBy: 'verify',  // or 'reject', 'expire', 'nightly_sweep'
  },
});
// If all mandatory items verified → org.status = VERIFIED
```

---

## 8. Money Handling Pattern

Established in: `packages/types/src/money.ts`, all financial service code

```typescript
// Input: parse from request body (always string input)
const pricePerUnit = Money.fromRupees(body.pricePerUnitRupees);

// Arithmetic: BigInt only
const totalPaise = pricePerUnit.toPaise() * BigInt(Math.round(qty * 1000)) / 1000n;

// Storage: BigInt column → Prisma handles BigInt serialisation
await this.prisma.quote.create({
  data: { pricePerUnitPaise: pricePerUnit.toPaise(), ... }
});

// Output: always format for display
// In controller response, Money.fromPaise(q.pricePerUnitPaise).toDisplayString()
// In React: <MoneyDisplay paise={quote.pricePerUnitPaise} />
```

---

## 9. Error Response Pattern

Established in: `src/common/filters/http-exception.filter.ts`

All errors thrown as typed classes → caught by filter → formatted as:
```json
{ "code": "COMPLIANCE_GATING", "message": "Organisation is not verified", "traceId": "abc123" }
```

Never include: stack traces, DB column names, internal IDs, Prisma error details.

---

## 10. Test Fixture Pattern

Established in: test files across `src/`

```typescript
// Factories, not raw objects:
const makeOrg = (overrides?: Partial<Organization>): Organization => ({
  id: 'org-test-1',
  type: OrgType.SELLER,
  status: OrgStatus.VERIFIED,
  legalName: 'Test Mining Co',
  state: 'Rajasthan',
  ...overrides,
});

// Usage:
const org = makeOrg({ status: OrgStatus.PENDING });
```

---

<!-- Claude: append new patterns below when a new pattern is established -->

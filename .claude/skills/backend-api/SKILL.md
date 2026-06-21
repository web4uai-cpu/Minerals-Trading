# SKILL: Backend API — NestJS Patterns & Conventions

> Consult before writing any code in `apps/api/src/`.  
> These are the enforced patterns — not suggestions.

---

## Module Structure (mandatory)

Every feature module must contain:

```
apps/api/src/{module}/
├── {module}.module.ts          — imports, providers, exports
├── {module}.controller.ts      — HTTP routes only, no business logic
├── {module}.controller.test.ts — integration tests (supertest)
├── {module}.service.ts         — business logic
├── {module}.service.test.ts    — unit tests (mocked deps)
└── dto/                        — DTOs (re-export Zod schemas from packages/types)
```

---

## Controller Template

```typescript
@Controller('resource')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResourceController {
  constructor(private readonly service: ResourceService) {}

  @Post()
  @Roles(UserRole.SELLER)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(ZodValidationPipe) body: CreateResourceDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<ResourceResponseDto> {
    return this.service.create(body, user, req.ip ?? '');
  }
}
```

**Never in controllers:**
- Database calls
- Business logic
- AI calls
- Audit log calls
- Direct crypto operations

---

## Service Template

```typescript
@Injectable()
export class ResourceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly logger: LoggerService,
  ) {}

  async create(
    dto: CreateResourceDto,
    actor: JwtPayload,
    ip: string,
  ): Promise<ResourceResponseDto> {
    // 1. AuthZ check at data layer (scope by orgId)
    this.assertOrgAccess(actor, dto.orgId);

    // 2. Business logic
    const result = await this.prisma.$transaction(async (tx) => {
      const resource = await tx.resource.create({ data: { ...dto, orgId: actor.orgId } });
      // ... transactional operations
      return resource;
    });

    // 3. Audit log (after successful mutation)
    await this.audit.log({
      actor: actor.userId,
      actorOrgId: actor.orgId,
      action: 'resource.created',
      entityType: 'Resource',
      entityId: result.id,
      afterHash: sha256(JSON.stringify(result)),
      ip,
      traceId: TraceContext.get(),
    });

    // 4. Return DTO (not raw Prisma model)
    return toResponseDto(result);
  }
}
```

---

## Error Classes

```typescript
// apps/api/src/common/errors/
export class KhanijError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
  }
}

// Domain errors:
export class ComplianceGatingError extends KhanijError { ... }
export class InsufficientTrustScoreError extends KhanijError { ... }
export class DealStateMachineError extends KhanijError { ... }
export class EscrowInsufficientFundsError extends KhanijError { ... }
export class AiError extends KhanijError { ... }
```

**HttpExceptionFilter** catches all errors and returns:
```json
{ "code": "COMPLIANCE_GATING", "message": "...", "traceId": "abc123" }
```

No stack traces. No internal IDs. No DB column names.

---

## Idempotency Pattern

All resource-creating POSTs must support `Idempotency-Key` header:

```typescript
@Post()
async create(
  @Headers('idempotency-key') idempotencyKey: string | undefined,
  @Body(ZodValidationPipe) body: CreateDto,
  ...
) {
  if (idempotencyKey) {
    const cached = await this.redis.get(`idempotency:${idempotencyKey}`);
    if (cached) return JSON.parse(cached);
  }
  
  const result = await this.service.create(body, ...);
  
  if (idempotencyKey) {
    await this.redis.set(`idempotency:${idempotencyKey}`, JSON.stringify(result), 'EX', 86400);
  }
  
  return result;
}
```

---

## Prisma Query Patterns

### Always scope by orgId:
```typescript
// BAD
await this.prisma.listing.findMany();

// GOOD
await this.prisma.listing.findMany({ where: { sellerOrgId: actor.orgId } });
```

### Transactional mutations:
```typescript
await this.prisma.$transaction(async (tx) => {
  const deal = await tx.deal.create({ data: { ... } });
  await tx.dealMilestone.createMany({ data: milestones.map(m => ({ ...m, dealId: deal.id })) });
  return deal;
});
```

### Money — never round or cast:
```typescript
// BAD
const total = Number(pricePerUnit) * quantity;

// GOOD
const total = pricePerUnitPaise * BigInt(Math.round(quantity * 1000)) / 1000n;
// Or use Money value object from packages/types
```

---

## Guard Execution Order

```
Request
  → JwtAuthGuard (validates token, injects user into request)
  → RolesGuard (checks role against @Roles() decorator)
  → ComplianceGuard (optional — checks org.status === VERIFIED)
  → ZodValidationPipe (validates body/params/query)
  → Controller method
```

### ComplianceGuard usage:
```typescript
@Post('/listings')
@Roles(UserRole.SELLER)
@UseGuards(ComplianceGuard)  // blocks if org not VERIFIED
async createListing(...) { ... }
```

---

## Logging Rules

```typescript
// Use structured logging — never console.log
this.logger.log({ event: 'listing.activated', listingId, orgId });
this.logger.warn({ event: 'trust_score.low', score, orgId });
this.logger.error({ event: 'ai.call.failed', agentName, error: err.code });

// Never log PII in plaintext:
// BAD: this.logger.log({ gstin: org.gstin })  // might be decrypted
// GOOD: this.logger.log({ orgId: org.id, action: 'gstin.verified' })
```

---

## Test Structure

```typescript
// {module}.service.test.ts — unit test
describe('ListingService', () => {
  let service: ListingService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new ListingService(prisma, mockAuditService, mockLogger);
  });

  describe('activateListing', () => {
    it('activates a DRAFT listing for a VERIFIED org', async () => { ... });
    it('throws ComplianceGatingError if org is PENDING', async () => { ... });
    it('throws ForbiddenException if listing belongs to different org', async () => { ... });
  });
});
```

```typescript
// {module}.controller.test.ts — integration test
describe('ListingController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  it('POST /listings returns 201 for verified seller', async () => {
    const token = await getAuthToken(app, 'seller@verified.com');
    return request(app.getHttpServer())
      .post('/listings')
      .set('Authorization', `Bearer ${token}`)
      .send(validListingDto)
      .expect(201)
      .expect(res => expect(res.body.status).toBe('DRAFT'));
  });

  it('POST /listings returns 403 if org not VERIFIED', async () => { ... });
  it('POST /listings returns 400 for invalid grade params', async () => { ... });
});
```

---

## BullMQ Job Pattern

```typescript
@Processor(LISTING_INDEX_QUEUE)
export class ListingIndexProcessor {
  constructor(
    private readonly search: SearchService,
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  @Process()
  async handle(job: Job<{ listingId: string; action: 'upsert' | 'delete' }>) {
    const { listingId, action } = job.data;
    this.logger.log({ event: 'listing.index.job', listingId, action });

    if (action === 'upsert') {
      const listing = await this.prisma.listing.findUniqueOrThrow({
        where: { id: listingId },
        include: { sellerOrg: true, mineral: true },
      });
      await this.search.indexListing(listing);
    } else {
      await this.search.deleteListing(listingId);
    }
  }
}
```

---

## WebSocket Gateway Pattern

```typescript
@WebSocketGateway({ namespace: 'deals', cors: { origin: process.env.WEB_URL } })
export class DealGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  async handleConnection(client: Socket) {
    // Validate JWT from handshake auth
    const user = await this.authService.verifySocket(client.handshake.auth.token);
    if (!user) { client.disconnect(); return; }
    client.data.user = user;
  }

  @SubscribeMessage('join:deal')
  async handleJoin(client: Socket, dealId: string) {
    // Verify user belongs to this deal
    await this.dealService.assertParticipant(dealId, client.data.user.orgId);
    client.join(`deal:${dealId}`);
  }

  broadcastToRoom(dealId: string, event: string, payload: unknown) {
    this.server.to(`deal:${dealId}`).emit(event, payload);
  }
}
```

---

## Health Check

`GET /health` must check all dependencies:
```typescript
{
  "status": "ok",
  "services": {
    "postgres": "ok" | "error",
    "redis": "ok" | "error",
    "elasticsearch": "ok" | "error"
  }
}
```

Never expose version numbers or internal hostnames in health responses.

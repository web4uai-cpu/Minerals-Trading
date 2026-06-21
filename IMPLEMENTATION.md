# IMPLEMENTATION.md — Khanij Nexus Build Plan

> **For agents:** Read `.claude-mem/CONTEXT.md` first, then this file.
> Work phases in order. Complete every DoD checkpoint before starting the next phase.
> Never skip a phase. Never guess on money, PII, or legal behaviour — stop and ask.
>
> **Start here:** `Phase 5A — Fix escrow BigInt bug` (it is in code right now).

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Done — do not re-implement |
| 🐛 | Bug in existing code — fix before proceeding |
| 🚧 | In progress — complete it |
| ⏳ | Not started — implement in order |
| 🔒 | Locked — do not change without a new ADR |

---

## Completed Phases (reference only — do not re-implement)

### ✅ Phase 1 — Identity & RBAC
Auth module, JWT strategy, guards, decorators, refresh token rotation.  
Key files: `src/auth/`, `prisma/migrations/20260605000001_identity_rbac/`

### ✅ Phase 2 — Compliance Engine
TrustScore calculator, 12-item checklist, nightly expiry sweep.  
Key files: `src/compliance/`, `prisma/migrations/20260608000002_compliance_engine/`

### ✅ Phase 3 — Catalog & Listings
Mineral catalog, seller listing CRUD, Elasticsearch indexing.  
Key files: `src/catalog/`, `src/listings/`, `prisma/migrations/20260608000003_catalog_listings/`

### ✅ Phase 4 — Discovery
AI natural-language search → Elasticsearch → TrustScore-weighted ranking.  
Key files: `src/discovery/`, `src/ai/prompts/parse-search.ts`

---

## Phase 5 — Deal Rooms (🚧 In Progress)

> **DB schema exists** (`20260608000004_deal_rooms`). State machine and escrow service
> exist but are incomplete. Build in sub-phase order.

---

### 🐛 Phase 5A — Fix Escrow BigInt Bugs (do this first)

**File:** `apps/api/src/deals/escrow/escrow.service.ts`

**Bugs found:**
1. `holdFunds(dealId, amountPaise: number)` — parameter must be `bigint`
2. `getBalance()` uses `Number(entry.amountPaise)` arithmetic — must use `BigInt`
3. `getLedger()` converts `amountPaise` to `Number()` — wrong for large values, must keep as `bigint`
4. No module file exists for the deals module yet

**Fix `getBalance` to:**
```typescript
async getBalance(dealId: string): Promise<bigint> {
  const entries = await this.prisma.escrowLedger.findMany({
    where: { dealId },
    select: { type: true, amountPaise: true },
  });
  let balance = 0n;
  for (const entry of entries) {
    if (entry.type === EscrowEntryType.HELD) balance += entry.amountPaise;
    else balance -= entry.amountPaise;
  }
  return balance;
}
```

**Fix all method signatures** to use `bigint` for `amountPaise`.  
**Fix `getLedger`** — return `amountPaise` as `bigint` string (`amountPaise.toString()`).

**DoD:** `pnpm --filter @khanij/api test` passes. No `Number()` calls on `amountPaise` anywhere in the deals directory.

---

### ⏳ Phase 5B — RFQ Module

**New files to create:**

```
apps/api/src/rfq/
├── rfq.module.ts
├── rfq.controller.ts
├── rfq.controller.test.ts
├── rfq.service.ts
└── rfq.service.test.ts
```

**Zod schemas to add in `packages/types/src/schemas.ts`:**
```typescript
export const CreateRfqSchema = z.object({
  mineralId: z.string().uuid(),
  listingId: z.string().uuid().optional(),
  grade: z.record(z.number()),
  quantity: z.number().positive().max(1_000_000),
  unit: z.enum(['MT', 'KG']).default('MT'),
  neededBy: z.string().datetime(),
  notes: z.string().max(1000).optional(),
});

export const RfqResponseSchema = z.object({
  id: z.string(),
  buyerOrgId: z.string(),
  mineral: z.object({ id: z.string(), name: z.string(), category: z.string() }),
  grade: z.record(z.number()),
  quantity: z.number(),
  unit: z.string(),
  neededBy: z.string(),
  status: z.enum(['OPEN', 'QUOTED', 'CLOSED', 'CANCELLED']),
  createdAt: z.string(),
});
```

**Controller endpoints:**
```
POST   /rfqs              → createRfq(body, actor) → 201 RfqResponse
GET    /rfqs              → listRfqs(actor) → RfqResponse[]
  - BUYER: own RFQs
  - SELLER: open RFQs matching seller's active mineral listings (inbox)
GET    /rfqs/:id          → getRfq(id, actor) → RfqResponse + quotes[]
PATCH  /rfqs/:id/cancel   → cancelRfq(id, actor) [BUYER, OPEN only] → RfqResponse
```

**Service rules:**
- `createRfq`: buyer org must be `VERIFIED` (throw `COMPLIANCE_GATING` if not)
- `listRfqs` for SELLER: query active listings by sellerOrgId → get mineralIds → query OPEN RFQs with those mineralIds
- Audit log: `rfq.created`, `rfq.cancelled`
- On create: queue BullMQ job `NOTIFICATION` → `{ eventType: 'RFQ_CREATED', sellerOrgIds: [...] }`

**Tests (3 minimum per endpoint):**
```
POST /rfqs:
  ✓ VERIFIED buyer creates RFQ → 201
  ✓ PENDING org → 403 COMPLIANCE_GATING
  ✓ Invalid grade JSON → 400
  ✓ SELLER cannot create RFQ → 403

GET /rfqs (SELLER inbox):
  ✓ Returns only OPEN RFQs matching seller's minerals
  ✓ Does not return RFQs for minerals seller doesn't list

PATCH /rfqs/:id/cancel:
  ✓ BUYER cancels OPEN RFQ → CANCELLED
  ✓ Cannot cancel QUOTED RFQ → 400 ILLEGAL_RFQ_TRANSITION
  ✓ Cannot cancel another org's RFQ → 403
```

**Add to AppModule imports:** `RfqModule`

**DoD:** All tests pass. `GET /rfqs` returns only OPEN RFQs for the correct seller. Audit log entries present.

---

### ⏳ Phase 5C — Quote Module

**New files to create:**

```
apps/api/src/rfq/quote/
├── quote.controller.ts
├── quote.controller.test.ts
├── quote.service.ts
└── quote.service.test.ts
```

**Zod schemas in `packages/types/src/schemas.ts`:**
```typescript
export const CreateQuoteSchema = z.object({
  pricePerUnitPaise: z.bigint().positive(),
  validUntil: z.string().datetime(),
  terms: z.record(z.unknown()).optional(),
});

export const AcceptQuoteSchema = z.object({
  arbitrationSeat: z.string().min(2).max(100).optional(),
});
```

**Controller endpoints (nested under /rfqs/:rfqId/quotes):**
```
POST  /rfqs/:rfqId/quotes                    → submitQuote [SELLER, VERIFIED]
GET   /rfqs/:rfqId/quotes                    → listQuotes [BUYER who owns RFQ]
POST  /rfqs/:rfqId/quotes/:quoteId/accept    → acceptQuote [BUYER] → creates Deal
POST  /rfqs/:rfqId/quotes/:quoteId/reject    → rejectQuote [BUYER]
```

**Service rules:**
- `submitQuote`: seller org must be `VERIFIED`; RFQ must be `OPEN`; seller must have an active listing for that mineral (or allow quote without listing)
- `acceptQuote` (critical — this is a transaction):
  ```
  BEGIN transaction:
    1. Set accepted quote: status → ACCEPTED
    2. Set all other quotes on this RFQ: status → REJECTED
    3. Set RFQ: status → CLOSED
    4. Create Deal: status=CREATED, from quote + RFQ data
    5. Create 6 DealMilestones: PENDING, sequence 1-6
    6. Write audit: deal.created, rfq.closed, quote.accepted
  COMMIT
  ```
- Quote `validUntil` must be in the future; expired quotes cannot be accepted

**Tests:**
```
POST /rfqs/:id/quotes:
  ✓ VERIFIED seller submits quote → 201 SENT
  ✓ PENDING seller org → 403
  ✓ Seller who has no listing for this mineral → still allowed (tradable without listing)
  ✓ Duplicate quote from same seller on same RFQ → 409 DUPLICATE_QUOTE

POST /rfqs/:id/quotes/:qId/accept:
  ✓ Buyer accepts → Deal CREATED + 6 milestones + other quotes REJECTED
  ✓ Accept expired quote → 400 QUOTE_EXPIRED
  ✓ Seller cannot accept their own quote → 403
  ✓ Entire transaction rolls back if deal creation fails
```

**DoD:** Accepting a quote atomically creates Deal + 6 Milestones + closes RFQ in one transaction. No partial state possible.

---

### ⏳ Phase 5D — Deal REST Module

**New files to create:**

```
apps/api/src/deals/
├── deals.module.ts
├── deals.controller.ts
├── deals.controller.test.ts
├── deals.service.ts
├── deals.service.test.ts
├── deal-state-machine.ts   ← EXISTS (reuse)
└── escrow/
    └── escrow.service.ts   ← EXISTS (after Phase 5A fixes)
```

**Zod schemas in `packages/types/src/schemas.ts`:**
```typescript
export const TransitionDealSchema = z.object({
  to: z.enum(['AGREEMENT_DRAFT', 'SIGNED', 'ESCROW_PENDING', 'IN_FULFILMENT', 'COMPLETED', 'DISPUTED', 'CANCELLED']),
  note: z.string().max(500).optional(),
});

export const SendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
});

export const CompleteMilestoneSchema = z.object({
  note: z.string().max(500).optional(),
});
```

**Controller endpoints:**
```
GET   /deals                           → listDeals(actor) [scoped to org]
GET   /deals/:id                       → getDeal(id, actor) [buyer or seller of deal]
PATCH /deals/:id/status                → transitionDeal(id, body, actor)
POST  /deals/:id/messages              → sendMessage(id, body, actor)
GET   /deals/:id/messages              → getMessages(id, actor) [paginated, last 50]
PATCH /deals/:id/milestones/:type/complete → completeMilestone(id, type, actor)
POST  /deals/:id/dispute               → fileDspute(id, body, actor) [IN_FULFILMENT only]
GET   /deals/:id/escrow                → getEscrowLedger(id, actor)
```

**Service rules for `transitionDeal`:**
```
CREATED → AGREEMENT_DRAFT: either party
AGREEMENT_DRAFT → SIGNED: both parties must have called a "sign" sub-action (track in Deal metadata or separate signatures table). Both orgs must be VERIFIED. (Note: add a `signatures` JSON column to deal or a `deal_signatures` table — decide and create a migration.)
SIGNED → ESCROW_PENDING: buyer triggers; fires EscrowService.holdFunds()
ESCROW_PENDING → IN_FULFILMENT: system/admin after payment confirmed; checks escrowHeld
IN_FULFILMENT → COMPLETED: buyer triggers after receiving goods; releases escrow to seller
IN_FULFILMENT → DISPUTED: either party; freezes escrow
Any → CANCELLED: either party from non-terminal state
```

**IMPORTANT — dual-signature tracking for SIGNED:**
The current DB has no way to track that BOTH parties have signed. Before implementing, choose:
- Option A: Add `buyerSignedAt DateTime?` and `sellerSignedAt DateTime?` to `Deal` + new migration
- Option B: Add a `deal_signatures` table with `(dealId, orgId, signedAt, ipAddress)`
- **Default to Option B** (cleaner audit trail, append-only) — create migration `20260615000005_deal_signatures`

**Message service:**
- Messages with content starting with `/ai ` → strip prefix → pass remaining text to Deal Co-Pilot agent (see Phase 5F)
- AI response saved as `senderType=AI`, `senderOrgId=null`
- Non-AI messages: just INSERT into `deal_messages`

**Tests:**
```
GET /deals:
  ✓ Buyer sees only their deals
  ✓ Seller sees only their deals
  ✓ Admin sees all deals

PATCH /deals/:id/status (CREATED → AGREEMENT_DRAFT):
  ✓ Either party can start agreement draft
  ✓ Correct audit log entry written

PATCH /deals/:id/status (AGREEMENT_DRAFT → SIGNED):
  ✓ Blocked until both parties sign
  ✓ Blocked if either org not VERIFIED
  ✓ After both sign → status changes to SIGNED

PATCH /deals/:id/status (SIGNED → ESCROW_PENDING):
  ✓ EscrowService.holdFunds() called
  ✓ Escrow entry HELD created

PATCH /deals/:id/status (IN_FULFILMENT → COMPLETED):
  ✓ EscrowService.releaseFunds() called
  ✓ Escrow entry RELEASED created

PATCH /deals/:id/status (IN_FULFILMENT → DISPUTED):
  ✓ Escrow frozen (no RELEASED/REFUNDED)
  ✓ Audit: deal.disputed

POST /deals/:id/messages:
  ✓ Buyer sends → saved as BUYER
  ✓ /ai prefix → AI response generated + saved as AI
  ✓ Cannot message on CANCELLED deal → 400
```

**DoD:** Full deal lifecycle works end-to-end via REST. Deal transitions enforce the state machine. Escrow operations are BigInt throughout. All audit log entries present.

---

### ⏳ Phase 5E — WebSocket Gateway (Deal Room Real-Time)

**New files to create:**

```
apps/api/src/deals/
├── deal.gateway.ts
└── deal.gateway.test.ts
```

**Implementation:**
```typescript
@WebSocketGateway({
  namespace: 'deals',
  cors: { origin: process.env.WEB_URL, credentials: true },
})
export class DealGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private readonly authService: AuthService,
    private readonly dealService: DealsService,
    private readonly redis: Redis,  // ← inject Redis client
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) { client.disconnect(); return; }
    const user = await this.authService.verifyAccessToken(token).catch(() => null);
    if (!user) { client.disconnect(); return; }
    client.data.user = user;
  }

  @SubscribeMessage('join:deal')
  async handleJoinDeal(client: Socket, dealId: string) {
    await this.dealService.assertParticipant(dealId, client.data.user.orgId);
    client.join(`deal:${dealId}`);
    client.emit('joined:deal', { dealId });
  }

  @SubscribeMessage('leave:deal')
  handleLeaveDeal(client: Socket, dealId: string) {
    client.leave(`deal:${dealId}`);
  }

  // Called by DealsService after saving a message to DB
  broadcastMessage(dealId: string, message: DealMessageDto) {
    this.server.to(`deal:${dealId}`).emit('deal:message', message);
  }

  broadcastStatusChange(dealId: string, from: DealStatus, to: DealStatus) {
    this.server.to(`deal:${dealId}`).emit('deal:status_changed', { dealId, from, to });
  }

  broadcastMilestoneUpdate(dealId: string, milestone: DealMilestoneDto) {
    this.server.to(`deal:${dealId}`).emit('deal:milestone_updated', { dealId, milestone });
  }
}
```

**Redis pub/sub for multi-pod support:**
```typescript
// On message save in DealsService:
await this.redis.publish(`deal:${dealId}:events`, JSON.stringify({ type: 'message', data: savedMessage }));

// Subscriber in DealGateway (set up in onModuleInit):
await this.redisSubscriber.subscribe(`deal:*:events`);
this.redisSubscriber.on('message', (channel, message) => {
  const dealId = channel.split(':')[1];
  const event = JSON.parse(message);
  this.server.to(`deal:${dealId}`).emit(`deal:${event.type}`, event.data);
});
```

**Install:** `pnpm --filter @khanij/api add @nestjs/websockets @nestjs/platform-socket.io socket.io`

**Add to DealsModule providers:** `DealGateway`

**DoD:** Two browser tabs (buyer + seller) in the same deal room both receive messages in real time. Message round-trip < 500ms on localhost.

---

### ⏳ Phase 5F — Deal Co-Pilot Agent

**New file:** `apps/api/src/ai/prompts/deal-copilot.ts`

**Spec:** See `AI_AGENTS.md` Agent 2 and `docs/AI_AGENTS.md`.

**Key implementation points:**
1. Create `DealContextSchema` and `DealCopilotResponseSchema` in `packages/types/src/schemas.ts`
2. Add `DealCopilotResponseSchema.isDecisionSupport: z.literal(true)` — mandatory
3. PII-strip deal messages before passing to AI (use `stripPii()` from `src/ai/pii-stripper.ts` — create this file)
4. Rate limit: 60/hour per org (configured in `AiService` rate limit map)
5. Triggered when: (a) deal enters `AGREEMENT_DRAFT` → auto-generate first draft, (b) user sends message starting with `/ai`

**`pii-stripper.ts` to create:**
```typescript
// apps/api/src/ai/pii-stripper.ts
export function stripPii(text: string): string {
  return text
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, '[AADHAAR REDACTED]')
    .replace(/[A-Z]{5}\d{4}[A-Z]/g, '[PAN REDACTED]')
    .replace(/\b\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d]Z[A-Z\d]/g, '[GSTIN REDACTED]')
    .replace(/\b[6-9]\d{9}\b/g, '[PHONE REDACTED]');
}
```

**DoD:** Sending `/ai draft the payment clause` in a deal room returns an AI message with a `isDecisionSupport` disclaimer. PII is not present in any Claude API call payload.

---

## Phase 6 — Notifications (BullMQ)

> Build this **after** Phase 5 is complete. Phase 5 services already queue jobs — this phase wires up the processors.

**New files to create:**

```
apps/api/src/notifications/
├── notifications.module.ts
├── notification.processor.ts
├── notification.scheduler.ts  (milestone overdue sweep — 08:00 IST daily)
└── templates/
    └── notification.templates.ts
```

**Install:** `pnpm --filter @khanij/api add @nestjs-modules/mailer nodemailer`

**Queues to implement processors for:**

| Queue constant | Job data | Processor action |
|----------------|----------|-----------------|
| `NOTIFICATION` | `{ eventType, recipientOrgIds, context }` | Call AiService notification-writer agent → send email via Mailer |
| `MILESTONE_SWEEP` | `{ triggeredAt }` | Query milestones where `dueDate < now() AND status=PENDING` → mark `OVERDUE` → queue `NOTIFICATION` |
| `LISTING_INDEX` | `{ listingId, action }` | Elasticsearch upsert/delete (processor may already exist in listings module — check first) |

**Zod schema for job data in `packages/types/src/schemas.ts`:**
```typescript
export const NotificationJobSchema = z.object({
  eventType: z.enum([
    'RFQ_CREATED', 'QUOTE_RECEIVED', 'DEAL_CREATED',
    'MILESTONE_OVERDUE', 'COMPLIANCE_EXPIRING', 'COMPLIANCE_REJECTED',
    'DISPUTE_FILED', 'AWARD_ISSUED'
  ]),
  recipientOrgIds: z.array(z.string()),
  context: z.record(z.string()),
});
```

**Notification writer agent** (`apps/api/src/ai/prompts/notification-writer.ts`): see `AI_AGENTS.md` Agent 8.

**DoD:** Accepting a quote sends an email to both parties. A milestone going overdue triggers a push notification (stub) and email. All emails tested against a local MailHog instance (`docker-compose` already includes `mailhog` — add it if not present).

---

## Phase 7 — Arbitration Module

> **STOP before implementing.** Answer `OPEN_QUESTIONS.md` Q1 (arbitrator assignment) first. The answer changes the DB schema.

**New Prisma migration needed:** `20260615000006_arbitration`

```prisma
// Add to schema.prisma:

enum DisputeStatus {
  FILED
  ASSIGNED
  RESPONDENT_NOTIFIED
  PRELIMINARY_HEARING
  EVIDENCE_CLOSED
  AWARD_DRAFT
  AWARD_ISSUED
  CLOSED
}

enum AwardType {
  BUYER_WINS
  SELLER_WINS
  SPLIT
}

model Dispute {
  id                 String        @id @default(uuid())
  dealId             String        @unique
  claimantOrgId      String
  respondentOrgId    String
  arbitratorUserId   String?
  status             DisputeStatus @default(FILED)
  claimantStatement  String        @db.Text
  respondentStatement String?      @db.Text
  filedAt            DateTime      @default(now())
  assignedAt         DateTime?
  awardIssuedAt      DateTime?
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt

  deal        Deal          @relation(fields: [dealId], references: [id])
  evidence    Evidence[]
  award       DisputeAward?

  @@index([status])
  @@map("disputes")
}

model Evidence {
  id          String   @id @default(uuid())
  disputeId   String
  submittedBy String   // orgId
  label       String
  s3Key       String
  createdAt   DateTime @default(now())

  dispute Dispute @relation(fields: [disputeId], references: [id])

  @@index([disputeId])
  @@map("evidence")
}

model DisputeAward {
  id           String    @id @default(uuid())
  disputeId    String    @unique
  type         AwardType
  buyerAmountPaise  BigInt?
  sellerAmountPaise BigInt?
  rationale    String    @db.Text
  issuedBy     String    // arbitratorUserId
  issuedAt     DateTime  @default(now())

  dispute Dispute @relation(fields: [disputeId], references: [id])

  @@map("dispute_awards")
}
```

**New files to create:**

```
apps/api/src/arbitration/
├── arbitration.module.ts
├── arbitration.controller.ts
├── arbitration.controller.test.ts
├── arbitration.service.ts
├── arbitration.service.test.ts
└── brief-generator.service.ts   ← wraps AI arbitration brief agent
```

**Controller endpoints:**
```
POST  /deals/:dealId/dispute              → fileDispute [BUYER or SELLER, IN_FULFILMENT]
GET   /arbitration                        → listCases [ARBITRATOR: assigned; parties: own]
GET   /arbitration/:id                    → getCase [parties or ARBITRATOR]
POST  /arbitration/:id/evidence           → uploadEvidence [parties, before EVIDENCE_CLOSED]
POST  /arbitration/:id/brief              → generateBrief [ARBITRATOR] → AI brief
POST  /arbitration/:id/award              → issueAward [ARBITRATOR]
  - Executes escrow: BUYER_WINS→refund, SELLER_WINS→release, SPLIT→both
  - Transitions deal to COMPLETED
  - Audit: dispute.award_issued
```

**AI agent:** `apps/api/src/ai/prompts/arbitration-brief.ts` — see `AI_AGENTS.md` Agent 4.  
Always pass `stripPii()` over all statement text before AI call.

**DoD:** Filing a dispute freezes escrow. Arbitrator can generate a brief. Issuing an award executes the correct escrow entries and closes the deal. All in one transaction (award + escrow + deal status + audit log).

---

## Phase 8 — Admin Endpoints

**Add to existing modules (no new module needed):**

```
apps/api/src/compliance/
  ├── admin.compliance.controller.ts   ← NEW: review queue endpoints

apps/api/src/auth/ or new apps/api/src/admin/
  └── admin.controller.ts              ← NEW: org management
```

**Endpoints:**
```
GET   /admin/compliance/queue         → pending ComplianceItem[] [ADMIN]
PATCH /admin/orgs/:id/suspend         → suspend org [ADMIN]
PATCH /admin/orgs/:id/restore         → restore org [ADMIN]
GET   /admin/audit                    → AuditLog[] [ADMIN, REGULATOR_READONLY] — paginated, filtered
GET   /admin/search/reindex           → trigger full Elasticsearch reindex [ADMIN]
GET   /admin/stats                    → GMV, active deals, verified orgs count [ADMIN]
```

**Regulator view (read-only, no mutations):**
```
GET /regulator/analytics              → trade volumes, grade distribution, TrustScore histogram
GET /regulator/orgs                   → verified orgs list (PII masked)
```

All admin responses must mask PII. Use `maskPii()` utility at the service layer.

**DoD:** REGULATOR_READONLY role can call `/regulator/*` but gets 403 on any `/admin/*` write endpoint.

---

## Phase 9 — Web Frontend (`apps/web/`)

> Current state: placeholder page only. Build in sub-phase order.
> Read `.claude/skills/frontend-ui/SKILL.md` and `docs/FRONTEND.md` before starting.
> Read `docs/ANIMATION_3D.md` before any 3D or animation code.

---

### ⏳ Phase 9A — Dependencies, Design Tokens, Base Layout

**Install packages:**
```bash
pnpm --filter @khanij/web add framer-motion gsap @gsap/react lottie-react
pnpm --filter @khanij/web add three @react-three/fiber @react-three/drei
pnpm --filter @khanij/web add recharts d3
pnpm --filter @khanij/web add zustand @tanstack/react-query
pnpm --filter @khanij/web add socket.io-client
pnpm --filter @khanij/web add react-hook-form @hookform/resolvers
pnpm --filter @khanij/web add react-intersection-observer
pnpm --filter @khanij/web add -D @types/three @types/d3
```

**Install shadcn/ui components:**
```bash
cd apps/web
npx shadcn-ui@latest init   # use zinc base, dark mode, CSS variables
npx shadcn-ui@latest add button badge card dialog sheet tabs table select input textarea tooltip toast skeleton progress avatar dropdown-menu accordion command calendar popover
```

**Update `tailwind.config.js`** with design tokens from `.claude/skills/frontend-ui/SKILL.md` (color palette, typography, custom utilities).

**Create `src/app/layout.tsx`:**
- Add `Inter` font via `next/font/google`
- Add `QueryClientProvider` and `Toaster`
- Keep `dark` class on `<html>`

**Create:**
```
apps/web/src/
├── lib/
│   ├── api-client.ts      ← typed fetch wrapper with auth + refresh
│   ├── ws-client.ts       ← Socket.io singleton
│   ├── auth.ts            ← token helpers
│   └── money.ts           ← re-export from @khanij/types
├── store/
│   ├── auth.store.ts      ← Zustand auth store
│   ├── deal.store.ts
│   └── notification.store.ts
└── middleware.ts           ← route protection
```

**DoD:** `pnpm --filter @khanij/web dev` starts. Tailwind design tokens visible in browser. No TS errors.

---

### ⏳ Phase 9B — Auth Pages + Protected Routes

**New files:**
```
apps/web/src/app/
├── (public)/
│   ├── layout.tsx         ← minimal: logo + no sidebar
│   ├── page.tsx           ← landing (REPLACE current placeholder)
│   ├── login/page.tsx
│   └── register/page.tsx
```

**Landing page (`(public)/page.tsx`):**
- Hero with GSAP text animation (`useGSAP` — see `docs/ANIMATION_3D.md`)
- Three feature cards (animated entrance with Framer Motion stagger)
- CTA buttons: "Register your company" and "Sign in"
- Stats section: "50 verified sellers", "500+ listings", etc. (placeholder numbers)
- DO NOT use the 3D Globe here (save for Discovery page — performance)
- Simple mineral icon scatter pattern as background decoration (CSS only)

**Login page:** Email + password form, react-hook-form + Zod validation.  
**Register page:** Multi-step wizard: Step 1 = org type + legal name + state, Step 2 = user details + password.

**middleware.ts:** Redirect unauthenticated users from `/dashboard/*` to `/login`.

**DoD:** User can register, log in, be redirected to `/dashboard`, log out. Refresh token rotation works transparently (no re-login on access token expiry).

---

### ⏳ Phase 9C — Dashboard (Shared + Role-Specific)

**New files:**
```
apps/web/src/
├── app/(dashboard)/
│   ├── layout.tsx            ← DashboardShell (TopNav + Sidebar)
│   └── dashboard/page.tsx
├── components/layout/
│   ├── TopNav.tsx
│   ├── Sidebar.tsx
│   └── DashboardShell.tsx
└── components/shared/
    ├── TrustScoreBadge.tsx
    ├── MoneyDisplay.tsx
    ├── DealStatusPill.tsx
    └── AiDisclaimer.tsx
```

**Dashboard page — BUYER view:**
- TrustScoreGauge (see `docs/ANIMATION_3D.md` — SVG arc gauge, no R3F needed)
- Metric cards: Active RFQs, Pending Quotes, Active Deals
- Recent activity feed

**Dashboard page — SELLER view:**
- TrustScoreGauge
- Metric cards: Active Listings, Open Quotes Sent, Active Deals
- TrustScore history sparkline (Recharts LineChart)

**Sidebar:** Role-aware nav links (see `docs/UI_COMPONENTS.md` Sidebar section).

**DoD:** Dashboard loads data from API. TrustScore gauge animates on mount. Role-appropriate content shown.

---

### ⏳ Phase 9D — Compliance Page

**New files:**
```
apps/web/src/app/(dashboard)/compliance/page.tsx
apps/web/src/components/compliance/
├── ComplianceChecklist.tsx
├── ComplianceItemRow.tsx
└── DocumentUpload.tsx
```

**Compliance page:**
- TrustScoreGauge (same component reused, shown prominently)
- Grid of 12 compliance items, each showing: type label, status badge, validUntil date, upload/view action
- `DocumentUpload` component: drag-and-drop zone with Framer Motion animated border on hover
- Upload progress bar (shadcn `Progress`)
- On upload success: optimistic UI update + Lottie success animation

**DoD:** Seller can upload a compliance document. Status updates in real time (poll or optimistic). Admin-only: verify/reject button visible with ADMIN role.

---

### ⏳ Phase 9E — Discovery Page (with 3D Globe)

**New files:**
```
apps/web/src/app/(dashboard)/discover/page.tsx
apps/web/src/components/discovery/
├── SearchBar.tsx
├── SearchResults.tsx
└── ListingCard.tsx
apps/web/src/components/3d/
├── Globe.tsx           ← lazy-loaded wrapper
└── GlobeScene.tsx      ← R3F scene (ssr: false)
```

**Layout:**
```
┌────────────────────────────────────┐
│  SearchBar (full width)            │
├─────────────┬──────────────────────┤
│  3D Globe   │  Search Results      │
│  (India,    │  ListingCard × N     │
│   state     │  (stagger entrance)  │
│   markers)  │                      │
└─────────────┴──────────────────────┘
```

**Globe:** On state marker click → filters results by state. State glows on hover.  
Full 3D globe implementation in `docs/ANIMATION_3D.md` Scene 1.

**ListingCard:** Framer Motion hover lift + scale. Shows mineral name, grade summary, price/MT (via `MoneyDisplay`), TrustScoreBadge, lead days, state. "Send RFQ" button.

**SearchBar:** Debounced (300ms). On submit → `POST /discovery/search`. Shows AI confidence indicator if response includes confidence < 0.7 ("Showing broad results — try being more specific about grade").

**DoD:** Search returns results < 1s. Globe is interactive. ListingCard "Send RFQ" button opens RFQ creation modal.

---

### ⏳ Phase 9F — Deal Room Page

**New files:**
```
apps/web/src/app/(dashboard)/deals/
├── page.tsx            ← deal list
└── [id]/page.tsx       ← deal room
apps/web/src/components/deal/
├── DealRoom.tsx
├── DealChat.tsx
├── DealMilestones.tsx  ← uses MilestoneTrack 3D component
├── EscrowPanel.tsx
└── AiCopilotInput.tsx
apps/web/src/components/3d/
└── MilestoneTrack.tsx  ← Framer Motion milestone track (see docs/ANIMATION_3D.md Scene 4)
```

**Deal room layout:**
```
┌────────────────────────────────────────────────────────┐
│  Deal header: mineral, quantity, value, status pill    │
├──────────────────┬─────────────────────────────────────┤
│  MilestoneTrack  │  Chat messages                      │
│  (animated)      │  ─ Buyer messages (right)           │
├──────────────────┤  ─ Seller messages (left)           │
│  Deal details    │  ─ AI messages (center + disclaimer)│
│  Escrow panel    │                                     │
│  Documents       │  [ Input + /ai trigger button ]     │
└──────────────────┴─────────────────────────────────────┘
```

**WebSocket integration:**
```typescript
const socket = getDealSocket(accessToken);
socket.emit('join:deal', dealId);
socket.on('deal:message', (msg) => addMessage(msg));
socket.on('deal:status_changed', ({ to }) => setDealStatus(to));
socket.on('deal:milestone_updated', (m) => updateMilestone(m));
```

**AI co-pilot input:** Text box with `/ai` prefix toggle button. When toggled, input placeholder = "Ask AI about this deal...". On submit → `POST /deals/:id/messages` with `/ai ` prefix. AI response appears with `AiDisclaimer` banner.

**DoD:** Two users (buyer + seller) can chat in real time. Milestones animate when updated. Escrow balance shows in ₹. AI disclaimer is always visible on AI messages.

---

### ⏳ Phase 9G — Admin Panel

```
apps/web/src/app/(admin)/
├── layout.tsx                   ← admin shell (stricter nav)
├── admin/page.tsx               ← metrics dashboard
├── admin/compliance/page.tsx    ← pending review queue
├── admin/orgs/page.tsx          ← org list + suspend action
└── admin/audit/page.tsx         ← audit log viewer
```

**Compliance review queue:**
- Table: org name, item type, uploaded date, action buttons (Verify / Reject)
- Click row → opens Sheet drawer with: document preview (PDF iframe or image), org details, previous history, notes field
- Verify/Reject → API call → optimistic UI removal from queue

**Audit log viewer:**
- Filtered table: dateRange, entityType, action, actorOrgId
- Infinite scroll (React Query `useInfiniteQuery`)
- PII masked in display

**DoD:** Admin can review and verify a compliance document. Org's TrustScore updates after verification (shown on org detail).

---

## Phase 10 — Mobile Notifications (Expo)

> Build after web frontend is stable. Minimal scope: push notifications only.

**Files to update:**
```
apps/mobile/app/index.tsx         ← add push notification registration
apps/mobile/src/api/client.ts     ← add Expo push token → POST /users/push-token
```

**Install:** `expo install expo-notifications expo-device`

**Server side:** Add `pushToken` field to `User` model. Create `POST /users/push-token` endpoint. Update `NotificationProcessor` to call Expo push API for recipients with registered tokens.

**DoD:** Installing the app and logging in registers a push token. Accepting a quote sends a push notification to both parties' devices.

---

## Phase 11 — Price Intelligence Agent

**New file:** `apps/api/src/ai/prompts/price-advisor.ts`

Spec in `AI_AGENTS.md` Agent 5. Wire into:
- `ListingsService.create/update` — show price context when seller sets a price
- `QuoteService.submitQuote` — advise seller before submitting

**Add to listing and quote responses:** `priceAdvisory: PriceAdvisorOutput | null`

---

## Phase 12 — Fraud Detection Agent

**New files:**
```
apps/api/src/fraud/
├── fraud.module.ts
├── fraud.service.ts
└── fraud-detection.processor.ts  ← BullMQ processor
```

Spec in `AI_AGENTS.md` Agent 6. Runs as a background job triggered by:
- `deal.created` event → check both orgs
- `rfq.created` event → check buyer
- Deal room message (velocity check only — no full message scan)

SQL heuristics run first. AI called only if SQL flags `MEDIUM` or higher risk. `PAUSE_ORG` recommendation → creates admin review item, never auto-executes.

---

## Cross-Cutting: Before Every Phase

Before starting any phase, run:
```bash
pnpm typecheck          # must pass (zero errors)
pnpm lint               # must pass
pnpm test               # must pass (all existing tests)
docker compose ps       # all 5 services healthy
```

After every phase, run:
```bash
pnpm test --coverage    # coverage must not drop below 80% on changed modules
pnpm typecheck
```

---

## Known Bugs to Fix (not phase-specific)

| File | Bug | Fix |
|------|-----|-----|
| `apps/api/src/deals/escrow/escrow.service.ts` | `amountPaise: number` parameter and `Number()` casts | Change to `bigint` throughout (Phase 5A) |
| `apps/api/src/deals/escrow/escrow.service.ts` | No `deals.module.ts` importing `EscrowService` | Create `deals.module.ts` (Phase 5D) |

---

## Definition of Done (applies to every phase)

- [ ] Strict TypeScript — zero `any` in business logic files
- [ ] Zod schemas in `packages/types` for all new inputs/outputs
- [ ] AuthZ: role guard at route + `orgId` scoping at data layer
- [ ] Audit log entry for every state-changing action
- [ ] PII encrypted at rest, masked in responses
- [ ] Money: BigInt paise end-to-end, no `Number()` casts on financial values
- [ ] Tests: happy + auth-fail + validation-fail per new endpoint
- [ ] Structured logs: `this.logger.log({ event: '...', ... })` — no `console.log`
- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes

---

## Build Order Summary

```
✅ Phase 1  Auth
✅ Phase 2  Compliance
✅ Phase 3  Catalog + Listings
✅ Phase 4  Discovery
🐛 Phase 5A Escrow BigInt bug fix        ← START HERE
⏳ Phase 5B RFQ module
⏳ Phase 5C Quote module
⏳ Phase 5D Deal REST module
⏳ Phase 5E WebSocket gateway
⏳ Phase 5F Deal co-pilot AI agent
⏳ Phase 6  Notifications (BullMQ)
⏳ Phase 7  Arbitration (answer Q1 first)
⏳ Phase 8  Admin + Regulator endpoints
⏳ Phase 9A Web: deps + design tokens
⏳ Phase 9B Web: auth pages + landing
⏳ Phase 9C Web: dashboard
⏳ Phase 9D Web: compliance page
⏳ Phase 9E Web: discovery + 3D globe
⏳ Phase 9F Web: deal room
⏳ Phase 9G Web: admin panel
⏳ Phase 10 Mobile push notifications
⏳ Phase 11 Price intelligence agent
⏳ Phase 12 Fraud detection agent
```

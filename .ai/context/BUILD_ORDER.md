# Build Order — Khanij Nexus

> 12-phase vertical slice. Each phase builds on the previous. Pilot one state
> (Odisha), one mineral (Iron Ore) first, then expand.

## Phase 0: RepoOS Scaffolding ← CURRENT
**Status:** In Progress
**Deliverables:**
- `.ai/` governance layer (constitution, standards, guardrails, workflows)
- `governance/` (data dictionary, entity registry, tech debt, risk register)
- `testing/` (strategy, AI evals, shared fixtures)
- 9 domain package scaffolds
- Extract pure logic into domain packages (trust-score, deal-state-machine, ranking)
- Update root docs (CLAUDE.md, README.md)

**Completion criteria:** `pnpm install && pnpm build && pnpm test` passes with
all existing tests green and new packages resolving.

---

## Phase 1: Identity & RBAC ✅ COMPLETE
JWT auth, refresh token rotation, role guards (BUYER, SELLER, ARBITRATOR, ADMIN,
REGULATOR_READONLY), Argon2id password hashing, org + user registration.

## Phase 2: Verification ✅ COMPLETE
12-item compliance checklist, TrustScore calculator (weighted, time-decay),
compliance item state machine (MISSING→UPLOADED→UNDER_REVIEW→VERIFIED|REJECTED→EXPIRED),
presigned S3 upload, admin verify/reject endpoints.

## Phase 3: Compliance ✅ COMPLETE
Nightly expiry sweep (BullMQ), auto-org verification when all items verified,
compliance snapshots (append-only), compliance profile endpoint.

## Phase 4: Marketplace ✅ COMPLETE
Mineral catalog with seed data (5 minerals), seller listings with ES indexing,
AI-powered discovery (NL query → SearchIntent → Elasticsearch → ranked results),
TrustScore-weighted ranking with transparent breakdown.

---

## Phase 5: Bidding & Deals
**Prerequisites:** Phase 0 complete
**Deliverables:**
- 5A: Fix escrow BigInt bug
- 5B: RFQ module (create, list, seller inbox)
- 5C: Quote module (submit, accept, atomic deal creation)
- 5D: Deal REST module (CRUD, state machine transitions, dual signature)
- 5E: WebSocket gateway (real-time deal room chat)
- 5F: Auction/bidding module (separate from RFQ — packages/bidding)

## Phase 6: Contracts & AI
- Contract drafting AI agent
- Prompt registry implementation in packages/ai
- AI evaluation framework
- Notification system (BullMQ email/push processors)

## Phase 7: Payments
- Invoice generation with GST calculation
- Escrow completion flow
- Settlement rules in packages/finance
- Web frontend (Next.js 14)

## Phase 8: Logistics
- Shipment state machine in packages/logistics
- Delivery proof, tracking events
- Milestone integration (DISPATCH, DELIVERY milestones)
- Mobile app (Expo)

## Phase 9: Arbitration
- Dispute filing, evidence submission
- Arbitration brief AI agent
- Award issuance, escrow resolution
- Dispute state machine in packages/arbitration

## Phase 10: Blockchain
- Audit hash anchoring via AuditAnchor interface
- Evidence immutability verification
- Hash chain implementation in packages/blockchain

## Phase 11: AI Intelligence
- Price intelligence advisor
- Fraud detection agent
- Compliance document reviewer
- Notification content generator

## Phase 12: International Trade
- Multi-country support
- Export/import regulatory rules
- IEC integration
- Cross-border settlement model

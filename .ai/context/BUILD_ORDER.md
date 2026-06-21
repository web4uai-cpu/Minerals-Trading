# Build Order — Khanij Nexus

> 12-phase vertical slice. Each phase builds on the previous. Pilot one state
> (Odisha), one mineral (Iron Ore) first, then expand.

## Phase 0: RepoOS Scaffolding ✅ COMPLETE
`.ai/` governance, `governance/`, `testing/`, 9 domain package scaffolds,
pure logic extraction, root docs.

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

## Phase 5: Bidding & Deals ✅ COMPLETE
RFQ, quote, deal REST, WebSocket deal room, auction/bidding modules.

## Phase 6: Contracts & AI ✅ COMPLETE
Contract drafting AI, prompt registry, AI evals, notification system.

## Phase 7: Payments ✅ COMPLETE
Invoice generation with GST, escrow flow, settlement rules.

## Phase 8: Logistics ✅ COMPLETE
Shipment state machine, delivery proof, tracking events, milestone integration.

## Phase 9: Arbitration ✅ COMPLETE
Dispute filing, evidence submission, AI briefs, award issuance.

## Phase 10: Blockchain ✅ COMPLETE
Audit hash anchoring, evidence immutability, hash chain.

## Phase 11: AI Intelligence ✅ COMPLETE
Price intelligence, fraud detection, compliance reviewer, notification content.

## Phase 12: International Trade ✅ COMPLETE
Trade eligibility rules, country sanctions/FTA, settlement state machine,
forex provider, trade + settlement services with 84 tests.

---

## Phase 13: Web Frontend ✅ COMPLETE
Auth layer, app shell, dashboard, marketplace (AI search), deals list + detail,
listings CRUD, trade application CRUD, compliance upload (S3 presigned),
admin panel (compliance review, trade clearance, settlements).

## Phase 14: Mobile App (Expo) ✅ COMPLETE
Auth (AsyncStorage tokens, login/register), tab navigation (Dashboard,
Marketplace, Deals, Compliance, Profile), AI search, deal cards,
compliance checklist, dark theme matching web.

---

## What's next
- End-to-end integration testing (API + web + mobile)
- Real browser/device testing of all flows
- Docker Compose for local full-stack dev
- CI/CD pipeline (GitHub Actions)
- Production deployment (AWS ap-south-1, K8s)

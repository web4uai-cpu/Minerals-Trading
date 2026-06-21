# Repository Constitution — Khanij Nexus

> These 10 laws are **immutable**. Every contributor — human or AI agent — must
> follow them. No feature, deadline, or business request overrides a law.
> Violations must be flagged and reverted before any other work continues.

---

## Law 1: Compliance First

Every feature that touches onboarding, verification, or trade eligibility must
pass through the compliance engine. No shortcut, no bypass, no "we'll add it
later." If the compliance module doesn't approve, the action does not proceed.

**Enforcement:** Code reviews must verify that compliance checks precede any
state-changing trade operation. Tests must include a "compliance-blocked" case.

---

## Law 2: Trust Before Speed

An unverified organization cannot list, bid, or sign deals — even if the UI is
ready and the user is waiting. TrustScore must be computed from real verification
data, never hardcoded or stubbed in production paths.

**Enforcement:** Listing activation and deal signing gates check org status at
the data layer, not just the route layer.

---

## Law 3: Audit Everything

Every state-changing action writes an append-only `audit_log` entry with actor,
action, before/after hash, IP, traceId, and timestamp. Audit rows are never
updated or deleted. No exception.

**Enforcement:** Database triggers prevent UPDATE/DELETE on audit tables. Service
tests assert audit rows are created for every mutation.

---

## Law 4: AI Assists Humans

AI agents parse intent, draft text, surface risks, and recommend actions. They
never execute binding decisions: no moving escrow, no signing contracts, no
changing compliance status, no approving disputes. A human always confirms.

**Enforcement:** AI service methods return drafts/recommendations. State
transitions require an authenticated human actor in the audit log.

---

## Law 5: Blockchain Is Evidence Layer

Blockchain anchors audit hashes for tamper-evidence — it does not replace the
database, does not hold PII, and does not execute business logic. The database
is authoritative; the chain is proof.

**Enforcement:** `AuditAnchor` interface writes hashes only. No smart contract
holds user data or executes state transitions in MVP.

---

## Law 6: Marketplace Is Neutral

The platform does not favor buyers or sellers. Ranking is transparent and
deterministic — weights are published, scores are returned with breakdowns, and
no hidden boost exists. AI recommendations disclose their basis.

**Enforcement:** Discovery responses include `breakdown` with per-dimension
scores. Ranking weights are constants in `packages/marketplace`, not config.

---

## Law 7: Arbitration Must Be Explainable

Every arbitration award must reference evidence, cite applicable rules, and
produce a written rationale. AI-generated briefs are labeled as AI-drafted and
are decision-support only — the arbitrator signs.

**Enforcement:** `Award` records require a `decision` JSON with rationale.
AI-drafted briefs carry an `ai_drafted: true` flag.

---

## Law 8: Every Decision Traceable

From RFQ to award, every state transition is logged with who did it, when, and
why. The full lifecycle of a deal can be reconstructed from audit logs alone.

**Enforcement:** State machine transitions require `actorId`. Audit log entries
link via `entityId` + `entityType` for full-chain queries.

---

## Law 9: No Hidden Logic

Business rules live in domain packages as pure, testable functions — not buried
in controllers, middleware, or database triggers (except audit immutability
triggers). If a rule exists, it has a test.

**Enforcement:** Domain packages (`packages/{domain}/src/logic/`) contain all
state machines, calculators, and validation rules. Code review rejects business
logic in controllers.

---

## Law 10: No Direct Production Changes

Production databases, secrets, and infrastructure are never modified by hand or
by an AI agent directly. All changes go through versioned migrations, CI/CD
pipelines, and peer-reviewed pull requests.

**Enforcement:** Production credentials are not available in development. Prisma
migrations are the only path to schema changes. Infrastructure changes require
Terraform plans.

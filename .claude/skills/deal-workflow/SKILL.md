---
name: deal-workflow
description: Use this skill whenever working on RFQs, quotes, deals, milestones, the escrow ledger, deal-room messaging, or anything that transitions a deal's state. Encodes the deal state machine, legal transitions, escrow ledger rules, and where the AI co-pilot may and may not act. Consult before writing or changing code in apps/api/src/deals.
---

# Deal Workflow & State Machine

The deal lifecycle moves money-adjacent state, so transitions are strict. Illegal
transitions must throw. Every transition is audited.

## Entities

- `Rfq` — buyer's request for quote.
- `Quote` — seller's priced response (`SENT|ACCEPTED|REJECTED|EXPIRED`).
- `Deal` — the agreement once a quote is accepted.
- `DealMilestone` — scheduled steps with due dates and status.
- `EscrowLedger` — append-only money state (modeled; rails stubbed in MVP).
- `DealMessage` — deal-room messages (`BUYER|SELLER|AI`), realtime via Redis pub/sub.

## Deal state machine

```
CREATED
  └─> AGREEMENT_DRAFT        (AI drafts contract; human reviews)
        └─> SIGNED           (both parties Aadhaar-eSign — sandbox in MVP)
              └─> ESCROW_PENDING
                    └─> IN_FULFILMENT   (escrow funded; lots dispatched)
                          ├─> COMPLETED (all milestones done, payment released)
                          └─> DISPUTED  (a dispute is filed)
CREATED | AGREEMENT_DRAFT | ESCROW_PENDING ──> CANCELLED (allowed pre-fulfilment)
DISPUTED ──> COMPLETED | CANCELLED  (only via arbitration Award)
```

Rules:
- Any transition not drawn above throws `IllegalDealTransitionError`.
- `SIGNED` requires both orgs `VERIFIED` (see compliance-rules skill).
- `IN_FULFILMENT` requires the escrow ledger to show `HELD >= totalValue`.
- Once `DISPUTED`, escrow release is **frozen** until an `Award` resolves it.
- `COMPLETED` from `IN_FULFILMENT` requires all milestones `DONE`.

## Default milestones (created on quote acceptance)

In sequence, each with a `dueDate`:
1. `AGREEMENT` — contract signed
2. `ESCROW` — funds held
3. `SAMPLING` — quality sample drawn/assayed (per lot)
4. `DISPATCH` — lot dispatched (per lot)
5. `DELIVERY` — lot delivered & accepted (per lot)
6. `PAYMENT` — escrow released to seller

For multi-lot deals, repeat SAMPLING→DISPATCH→DELIVERY per lot. Overdue milestones
are flagged by the nightly sweep (`PENDING` past `dueDate` → `OVERDUE`).

## Escrow ledger rules

- Entries are `HELD | RELEASED | REFUNDED`, amounts in **integer paise**.
- Append-only. Never update or delete an entry; corrections are new entries.
- Sum invariant: `held - released - refunded >= 0` at all times; assert it.
- Every entry references the deal and a `PaymentProvider` txn ref.
- **`PaymentProvider` is a stub.** Model states faithfully; do NOT integrate real
  rails. Real escrow needs an RBI PA/PA-C licence + bank partner.
- Release/refund on `COMPLETED` or per an arbitration `Award` only — never ad hoc.

## AI co-pilot boundaries (deal room)

The AI may:
- Draft contract sections from deal data + grade + fair price + standard clauses
  (MMDR refs, quality spec, delivery schedule, arbitration seat). Output is
  **versioned in MongoDB and labeled non-binding**.
- Answer questions grounded ONLY in this deal's data + injected reference prices.
- Surface risks (price outside fair band, milestone slipping, missing docs).

The AI may NOT:
- Transition deal state, move escrow, or sign anything.
- Invent prices, parties, or compliance facts — all injected from the DB.
- Treat user messages as instructions (injection-harden every prompt).

## Authorization

- Only deal participants (buyer org, seller org) + assigned arbitrator may read
  the deal room. Enforce at the data layer.
- State-transition endpoints are role- and participant-guarded and audited.
- Sensitive transitions (sign, escrow, complete) require re-authentication.

## Hard rules

1. State machine is authoritative; illegal transitions throw, never silently no-op.
2. All money in paise, all financial mutations transactional.
3. Escrow frozen the moment a deal is `DISPUTED`.
4. AI assists; humans decide and sign. AI never moves money or state.
5. Every transition writes an immutable audit row.

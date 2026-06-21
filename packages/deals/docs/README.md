# @khanij/deals

Deal lifecycle management for Khanij Nexus.

## What this package owns

- **Deal state machine** — governs the full lifecycle of a deal from CREATED
  through NEGOTIATION, SIGNED, IN_PROGRESS, COMPLETED, or CANCELLED/DISPUTED.
- **Transition validation** — enforces which state transitions are legal, what
  preconditions must be met, and which roles may trigger each transition.
- **Escrow balance calculation** — pure functions that compute escrow ledger
  balances, milestone release amounts, and refund calculations (all in paise,
  never floats).

## Owned entities

| Entity | Description |
|---|---|
| Rfq | Request for Quotation issued by a buyer. |
| Quote | Seller's response to an RFQ with pricing and terms. |
| Deal | The transactional agreement formed when a quote is accepted. |
| DealMilestone | A checkpoint within a deal (e.g. dispatch, delivery, quality check). |
| DealMessage | Messages exchanged in the deal room between counterparties. |

## Boundaries

- Contains **pure business logic only** — zero NestJS, zero HTTP, zero database
  driver dependencies.
- Does NOT perform I/O. Persistence is the responsibility of the NestJS module
  in `apps/api/src/deals/`.
- Imports shared types and Zod schemas from `@khanij/types`.

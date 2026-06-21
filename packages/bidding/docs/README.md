# @khanij/bidding

Auction and bidding system for Khanij Nexus (Phase 5).

## What this package owns

- **Auction state machine** — lifecycle management for auctions from DRAFT
  through OPEN, EXTENDED, CLOSED, AWARDED, and CANCELLED states.
- **Bid validation** — rules ensuring bids meet minimum requirements, are placed
  by eligible (compliant) buyers, and respect auction constraints.
- **Increment rules** — minimum bid increment logic that varies by mineral type,
  lot size, and current price level (all amounts in paise).
- **Anti-sniping logic** — automatic auction extension when bids arrive in the
  final moments, preventing last-second sniping.

## Owned entities

| Entity | Description |
|---|---|
| Auction | A time-bound competitive bidding event for a mineral lot. |
| Bid | A buyer's price offer within an auction. |

## Boundaries

- Contains **pure business logic only** — zero NestJS, zero HTTP, zero database
  driver dependencies.
- Does NOT perform I/O. Persistence is the responsibility of the NestJS module
  in `apps/api/src/bidding/`.
- Imports shared types and Zod schemas from `@khanij/types`.
- This package is planned for Phase 5 and is scaffolded now for structural
  completeness.

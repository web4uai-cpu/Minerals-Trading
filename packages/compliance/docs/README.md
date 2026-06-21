# @khanij/compliance

Compliance verification engine for Khanij Nexus.

## What this package owns

- **TrustScore computation** — deterministic scoring algorithm that rates an
  organisation's compliance posture (0-100 scale).
- **Required items by org type** — rules that define which compliance documents
  and checks are mandatory for each organisation type (Miner, Trader, Processor,
  End-Buyer).
- **Compliance item status transitions** — state machine governing how a
  compliance item moves through PENDING, SUBMITTED, UNDER_REVIEW, VERIFIED,
  REJECTED, EXPIRED states.

## Owned entities

| Entity | Description |
|---|---|
| ComplianceItem | A single verifiable document or check (e.g. mining lease, GSTIN, PAN). |
| ComplianceSnapshot | Point-in-time, append-only record of an org's full compliance state. |

## Boundaries

- Contains **pure business logic only** — zero NestJS, zero HTTP, zero database
  driver dependencies.
- Does NOT perform I/O. Persistence is the responsibility of the NestJS module
  in `apps/api/src/compliance/`.
- Imports shared types and Zod schemas from `@khanij/types`.

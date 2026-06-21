# @khanij/blockchain

Blockchain evidence layer domain package (Phase 10).

## What it owns

- **Audit hash anchoring**: computing deterministic hashes of audit log entries and anchoring them to an external chain for tamper evidence.
- **Hash chain verification**: validating that a sequence of audit hashes forms an unbroken chain, detecting any gaps or modifications.
- **Evidence immutability checks**: confirming that previously anchored records have not been altered since anchoring.

## Entities

- `AuditAnchor` — a record linking an internal audit hash to an external blockchain transaction, with timestamp and verification status.

## Boundaries

- Pure business logic and type definitions only — zero NestJS dependencies.
- This is an **evidence/proof layer only** — it does NOT replace the database, does NOT hold PII, and does NOT execute business logic.
- The actual blockchain integration uses the `AuditAnchor` interface with a no-op implementation for MVP. Real chain integration is out of scope.
- Does NOT store any personally identifiable information; only opaque hashes are anchored.
- Imports shared types and Zod schemas from `@khanij/types`.

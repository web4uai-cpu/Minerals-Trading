# Database Standard — Khanij Nexus

## Prisma Schema

- **Model names**: `PascalCase` in Prisma, mapped to `snake_case` table names
  via `@@map("table_name")`.
- **Field names**: `camelCase` in Prisma, mapped to `snake_case` columns via
  `@map("column_name")`.
- **IDs**: CUID (`@default(cuid())`) for primary keys. UUID for domain entities
  where external systems need stable identifiers.

## Schema Location

Single Prisma schema at `apps/api/prisma/schema.prisma`. Domain packages do NOT
have their own schemas. The schema is the database contract; domain packages
define pure logic, not persistence.

## Migrations

- **Naming**: `YYYYMMDDHHMMSS_description` (e.g., `20260605000001_identity_rbac`).
- **Never auto-migrate in production** — run as a K8s Job before deployment.
- **Every migration must be reversible** — include `down` steps or document why
  rollback is not possible.
- **Seed data** lives in `apps/api/src/{module}/seed/` and runs idempotently.

## Indexing Policy

- Every foreign key column must have an index.
- Every `status` enum column must have an index.
- Every timestamp used in queries (e.g., `createdAt`, `validUntil`) must have an index.
- Composite indexes for common query patterns (e.g., `(orgId, type)` on
  `compliance_items`).
- Unique constraints where business rules require it (e.g., `(orgId, type)` for
  one compliance item per type per org).

## Money

- **Always stored as `BigInt`** — integer paise (1 INR = 100 paise).
- **Never use `Float` or `Decimal`** for financial amounts.
- Column naming: `*InPaise` suffix (e.g., `askPriceInPaise`, `amountPaise`).
- Use the `Money` value object from `@khanij/types` for arithmetic.
- Every financial mutation must be wrapped in a Prisma `$transaction`.

## PII Fields

- Aadhaar, PAN, bank account, GSTIN, phone: **AES-256-GCM encrypted at rest**.
- Use `FieldEncryption` from `@khanij/types` for encrypt/decrypt.
- Never index encrypted fields (deterministic queries not supported).
- Masked in list/search responses — only full value on authorized detail views.

## JSON Columns

- Used for semi-structured data: `grade`, `location`, `terms`, `breakdown`.
- Every JSON column must have a corresponding Zod schema in `@khanij/types`
  documenting its structure.
- Avoid querying JSON fields in WHERE clauses — extract to columns if needed
  for filtering.

## Append-Only Tables

- `audit_log`, `compliance_snapshots`, `escrow_ledger`: INSERT only.
- Database triggers prevent UPDATE and DELETE on these tables.
- These tables grow indefinitely — plan for partitioning (TimescaleDB hypertable
  for `audit_log` in production).

## Connection Pooling

- Use Prisma's built-in connection pool.
- Production: `connection_limit=20` per pod, PgBouncer in front of RDS.
- Monitor: alert if pool utilization exceeds 80%.

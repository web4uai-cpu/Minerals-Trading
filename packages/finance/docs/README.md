# @khanij/finance

Financial operations domain package (Phase 7-8).

## What it owns

- **Invoice generation rules**: when invoices are created, required fields, line-item validation, and numbering sequences.
- **GST calculation**: correct tax rates for mineral commodities, IGST vs CGST+SGST determination based on interstate/intrastate supply, and rounding rules.
- **Settlement rules**: conditions for releasing escrow funds after milestone completion, partial release logic, and dispute-hold behavior.

## Entities

- `Invoice` — a tax-compliant invoice tied to a deal milestone, with line items denominated in paise (BIGINT).
- `EscrowLedger` — append-only ledger tracking every credit, debit, hold, and release against a deal's escrow balance.

## Boundaries

- Pure business logic and type definitions only — zero NestJS dependencies.
- Does NOT move real money; actual payment rails are behind the `PaymentProvider` interface in `apps/api` (stub for MVP, requires RBI PA/PA-C licence for production).
- All monetary values are integers in paise — never floats.
- Imports shared types and Zod schemas from `@khanij/types`.

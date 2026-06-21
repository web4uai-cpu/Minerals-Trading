# ADR-012: Escrow Ledger Is Append-Only

**Status:** Accepted
**Date:** 2026-06-08
**Category:** domain

## Context
Financial ledgers must be auditable. Running balance columns can drift from entry sum.

## Decision
Balance = Σ HELD - Σ RELEASED - Σ REFUNDED. No running balance column. Entries immutable (no UPDATE/DELETE). Every entry references PaymentProvider txn ref.

## Consequences
- (+) Balance always arithmetically correct
- (-) Balance query scans all entries for a deal (typically < 20 — acceptable)

# ADR-004: Money in Paise as BigInt

**Status:** Accepted
**Date:** 2026-06-05
**Category:** architecture

## Context
Floating-point arithmetic causes bugs in financial calculations. JavaScript Number cannot represent all integers > 2^53.

## Decision
All monetary amounts stored in paise (1 INR = 100 paise) as PostgreSQL BIGINT. Application code uses BigInt. Money value object in `packages/types/src/money.ts`.

## Consequences
- (+) Zero floating-point errors, deterministic audit log hashes
- (-) BigInt not JSON-serializable by default — needs custom serializer

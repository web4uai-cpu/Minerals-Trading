# ADR-007: Append-Only Audit Log

**Status:** Accepted
**Date:** 2026-06-05
**Category:** compliance

## Context
MMDR Act, DPDP Act, dispute resolution, and fraud investigation require immutable action records.

## Decision
audit_log table: no UPDATE, no DELETE (enforced by DB trigger). Stores beforeHash/afterHash (SHA-256). 7-year retention. Append-only from application.

## Consequences
- (+) Admissible as evidence in arbitration and court
- (-) Table grows unboundedly — needs TimescaleDB partitioning
- (-) Cannot undo mis-logged entries — must log corrective entry

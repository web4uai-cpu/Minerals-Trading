# ADR-011: Compliance Snapshots Are Append-Only

**Status:** Accepted
**Date:** 2026-06-05
**Category:** compliance

## Context
TrustScore history needed for regulatory and arbitration purposes. Overwriting loses historical data.

## Decision
ComplianceSnapshot rows are INSERT-only. Every recalculation creates a new row. Current score = most recent. Historical score at T = largest createdAt <= T.

## Consequences
- (+) Full TrustScore audit trail — admissible in arbitration
- (-) ~50 rows/year per org — needs indexing on (orgId, createdAt)

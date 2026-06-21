# ADR-015: AWS ap-south-1 (Mumbai) as Sole Deployment Region

**Status:** Accepted
**Date:** 2026-06-05
**Category:** compliance

## Context
DPDP Act 2023 requires personal data of Indian residents not transferred outside India without consent.

## Decision
All infrastructure in ap-south-1 exclusively. No cross-region replication. CDN may serve static assets globally (no PII).

## Consequences
- (+) DPDP compliance by architecture, not policy
- (-) Single-region — mitigated by Multi-AZ within ap-south-1

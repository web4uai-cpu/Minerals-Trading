# ADR-005: Field-Level Encryption for PII (AES-256-GCM)

**Status:** Accepted
**Date:** 2026-06-05
**Category:** architecture

## Context
DPDP Act 2023 requires data protection. DB compromise must not expose PII.

## Decision
PII fields encrypted at rest with AES-256-GCM, per-org derived keys. Never stored in plaintext anywhere. Always masked in API responses.

## Consequences
- (+) DB dump useless without master key
- (-) Cannot filter/sort on encrypted fields in Postgres
- (-) Key rotation requires re-encryption migration

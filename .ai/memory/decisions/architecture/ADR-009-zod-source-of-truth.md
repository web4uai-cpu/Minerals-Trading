# ADR-009: Zod as Single Source of Truth for Types and Validation

**Status:** Accepted
**Date:** 2026-06-05
**Category:** architecture

## Context
TypeScript types are compile-time only. Defining types separately in each layer leads to drift.

## Decision
All shared types and Zod schemas in `packages/types/src/schemas.ts`. One definition → runtime validation + TS types + form validation.

## Consequences
- (+) Breaking a schema fails CI across all consumers
- (-) packages/types is high-traffic change point — needs careful review

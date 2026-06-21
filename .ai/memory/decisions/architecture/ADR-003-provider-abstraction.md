# ADR-003: Provider Abstraction for External Integrations

**Status:** Accepted
**Date:** 2026-06-05
**Category:** architecture

## Context
Required integrations unavailable for MVP (real Aadhaar eKYC, RBI-licensed payments). Need real interfaces with sandbox implementations.

## Decision
Every external integration behind a TypeScript interface with Sandbox and (future) Real implementations. Providers: KycProvider, GovDataProvider, PaymentProvider, PriceFeedProvider, DocumentAiProvider, AuditAnchorProvider.

## Consequences
- (+) Business logic testable without real API keys
- (+) Swapping to real provider is a one-module change
- (-) Risk of sandbox/real behavioural drift

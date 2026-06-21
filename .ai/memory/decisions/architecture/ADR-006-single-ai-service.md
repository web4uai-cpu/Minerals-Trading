# ADR-006: Single AiService for All Claude API Calls

**Status:** Accepted
**Date:** 2026-06-05
**Category:** ai

## Context
Multiple modules need AI. Without central point, inconsistent API key management, rate limits, error handling.

## Decision
`apps/api/src/ai/ai.service.ts` is the only place Anthropic SDK is called. Handles rate limiting, prompt injection sanitization, Zod validation, timeout, audit logging, mock mode.

## Consequences
- (+) Centralised rate limiting and audit
- (+) Prompt injection guard cannot be bypassed
- (-) AiService is a critical shared dependency

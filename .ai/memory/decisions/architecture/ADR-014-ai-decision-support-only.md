# ADR-014: AI Output Is Never Auto-Binding

**Status:** Accepted
**Date:** 2026-06-05
**Category:** ai

## Context
AI drafts contracts, generates briefs, screens documents. These affect legally and financially significant decisions. AI can hallucinate.

## Decision
AI output includes `isDecisionSupport: true`, displayed with AiDisclaimer component, never triggers state transitions without human action. Stored with `senderType: 'AI'` in audit trail.

## Consequences
- (+) Legal liability stays with humans who act on AI output
- (+) Prompt injection cannot execute actions
- (-) Reduces automation potential in V1

# @khanij/ai

AI agent system for Khanij Nexus.

## What this package owns

- **Prompt templates** — versioned, parameterized prompt templates for all AI
  interactions (matching, contract drafting, dispute summarisation, intent
  parsing). Each template enforces strict JSON output schemas.
- **Evaluators** — functions that validate and score AI-generated outputs against
  expected schemas and quality criteria (hallucination checks, schema conformance,
  confidence thresholds).
- **Agent definitions** — declarative configurations for each AI agent persona
  (MatchMaker, ContractDrafter, DisputeAnalyser, ComplianceReviewer) including
  their capabilities, constraints, and output formats.

## Important distinction

This package does **not** contain `AiService` — that orchestration layer lives in
`apps/api/src/ai/ai.service.ts` and handles SDK calls, rate limiting, caching,
and error handling. This package provides the pure, testable building blocks that
`AiService` consumes.

## Boundaries

- Contains **pure business logic only** — zero NestJS, zero HTTP, zero Anthropic
  SDK dependencies.
- Does NOT make API calls. The SDK integration is the responsibility of
  `AiService` in `apps/api/src/ai/`.
- Imports shared types and Zod schemas from `@khanij/types`.

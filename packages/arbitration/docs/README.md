# @khanij/arbitration

Dispute resolution and arbitration domain package (Phase 9).

## What it owns

- **Dispute state machine**: FILED → HEARING → AWARD_ISSUED → CLOSED, with legal transition guards.
- **Evidence management rules**: what constitutes valid evidence, admissibility checks, attachment constraints.
- **Award validation logic**: ensuring awards reference valid disputes, contain required fields, and are immutable once issued.

## Entities

- `Dispute` — a filed dispute between deal parties, tracking state, assigned arbitrator, and timeline.
- `Evidence` — documents, messages, or records submitted by parties to support their case.
- `Award` — the arbitrator's binding decision, including reasoning, amount, and enforcement terms.

## Boundaries

- Pure business logic and type definitions only — zero NestJS dependencies.
- Does NOT handle persistence, HTTP, or authentication; those belong in `apps/api`.
- Does NOT execute payments or settlements; financial outcomes are handed off to `@khanij/finance`.
- Imports shared types and Zod schemas from `@khanij/types`.

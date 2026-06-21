# ADR-001: Monorepo with pnpm Workspaces + Turborepo

**Status:** Accepted
**Date:** 2026-06-05
**Category:** architecture

## Context
Three applications (API, Web, Mobile) + shared code (types, UI, config). Need atomic schema propagation and fast builds.

## Decision
Single pnpm monorepo with Turborepo. `packages/types` is single source of truth. `packages/ui` for shared components. `packages/config` for build configs.

## Consequences
- (+) Schema changes propagate atomically — breaking changes fail all consumers in CI
- (+) Single install, single test, one PR for full-stack changes
- (-) Developers must learn Turborepo cache invalidation
- (-) Shared `pnpm-lock.yaml` — dependency conflicts need careful resolution

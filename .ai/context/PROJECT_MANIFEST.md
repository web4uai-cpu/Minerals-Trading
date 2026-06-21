# Project Manifest — Khanij Nexus

> Package inventory with status, phase, and dependencies.

## Applications

| Package | Scope | Status | Phase | Dependencies |
|---------|-------|--------|-------|-------------|
| `apps/api` | `@khanij/api` | Active | 1–12 | `@khanij/types`, `@khanij/compliance`, `@khanij/deals`, `@khanij/marketplace`, domain packages |
| `apps/web` | `@khanij/web` | Skeleton | 7 | `@khanij/types`, `@khanij/ui` |
| `apps/mobile` | `@khanij/mobile` | Skeleton | 8 | `@khanij/types` |

## Shared Packages

| Package | Scope | Status | Phase | Dependencies |
|---------|-------|--------|-------|-------------|
| `packages/types` | `@khanij/types` | Active | 1 | `zod` |
| `packages/ui` | `@khanij/ui` | Skeleton | 7 | `react` (peer) |
| `packages/config` | `@khanij/config` | Active | 1 | — |

## Domain Packages

| Package | Scope | Status | Phase Introduced | Dependencies |
|---------|-------|--------|-----------------|-------------|
| `packages/compliance` | `@khanij/compliance` | Active | 0 | `@khanij/types` |
| `packages/deals` | `@khanij/deals` | Active | 0 | `@khanij/types` |
| `packages/marketplace` | `@khanij/marketplace` | Active | 0 | `@khanij/types` |
| `packages/bidding` | `@khanij/bidding` | Scaffold | 5 | `@khanij/types` |
| `packages/ai` | `@khanij/ai` | Scaffold | 6 | `@khanij/types` |
| `packages/finance` | `@khanij/finance` | Scaffold | 8 | `@khanij/types` |
| `packages/logistics` | `@khanij/logistics` | Scaffold | 8 | `@khanij/types` |
| `packages/arbitration` | `@khanij/arbitration` | Scaffold | 9 | `@khanij/types` |
| `packages/blockchain` | `@khanij/blockchain` | Scaffold | 10 | `@khanij/types` |

## Status Definitions

- **Active** — has implemented logic, used in production paths
- **Scaffold** — package shell exists (package.json, tsconfig, empty src/index.ts, docs/)
- **Skeleton** — app structure exists but minimal implementation
- **Planned** — not yet created

## Dependency Rule

Domain packages depend **only** on `@khanij/types` and `zod`. They never
depend on `@nestjs/*`, `@prisma/client`, or other domain packages. Cross-domain
communication happens through events wired in `apps/api`.

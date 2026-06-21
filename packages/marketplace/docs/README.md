# @khanij/marketplace

Marketplace catalog and discovery for Khanij Nexus.

## What this package owns

- **Listing rules** — validation logic that determines whether a listing can be
  published (seller compliance status, required fields, mineral-specific
  constraints).
- **Ranking algorithm** — deterministic scoring for search result ordering based
  on relevance, TrustScore, listing freshness, and price competitiveness.
- **Grade validation** — rules for mineral grade specifications (e.g. Fe content
  for iron ore, mesh size for silica sand) ensuring listings meet IBM standards.
- **Mineral catalog types** — the canonical mineral taxonomy with properties,
  units, and grade parameters.

## Owned entities

| Entity | Description |
|---|---|
| Mineral | A mineral type in the catalog with its grade parameters and units. |
| Listing | A seller's published offer to sell a specific mineral at given terms. |

## Boundaries

- Contains **pure business logic only** — zero NestJS, zero HTTP, zero database
  driver dependencies.
- Does NOT perform I/O. Persistence is the responsibility of the NestJS module
  in `apps/api/src/marketplace/`.
- Imports shared types and Zod schemas from `@khanij/types`.

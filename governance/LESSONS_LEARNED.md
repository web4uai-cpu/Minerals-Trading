# Lessons Learned — Khanij Nexus

> Retrospective insights from each build phase. Updated after phase completion.

## Phase 0: RepoOS Scaffolding

- Extracting pure logic from NestJS modules into domain packages requires
  removing framework dependencies (`BadRequestException`, `@prisma/client`).
  Design pure functions to return result objects instead of throwing.
- `pnpm-workspace.yaml` with `packages/*` glob means new packages are
  automatically discovered — no config changes needed.

## Phase 1–4: Foundation through Marketplace

- Provider abstraction (interface + sandbox) proved valuable — allowed building
  complete flows without external API keys.
- Co-locating tests next to source files improves discoverability.
- Zod schemas in `packages/types` as single source of truth prevented
  client/server type drift.
- TrustScore time-decay factor adds meaningful compliance urgency — items
  expiring within 30 days lose proportional weight.

# Technical Debt Register — Khanij Nexus

> Tracked items with severity and target phase for resolution.

| ID | Item | Severity | Location | Target Phase | Notes |
|----|------|----------|----------|-------------|-------|
| ~~TD-001~~ | ~~Escrow BigInt bug~~ | ~~**High**~~ | ~~`apps/api/src/deals/escrow/escrow.service.ts`~~ | ~~5A~~ | **RESOLVED** — All escrow methods now use `bigint`. PaymentProvider interface updated. Pure `computeEscrowBalance` extracted to `@khanij/deals`. |
| TD-002 | Ranking `dealHistory` dimension returns hardcoded `50` (stub) | Medium | `packages/marketplace/src/logic/ranking.ts` | 5 | Wire to actual deal completion data |
| TD-003 | `AiService` returns `null` on failure (fail-open for search) — ADR-006 says it should surface `AI_UNAVAILABLE` error | Medium | `apps/api/src/ai/ai.service.ts` | 6 | Align with ADR-006 |
| TD-004 | No DB trigger preventing UPDATE/DELETE on `audit_log` — only enforced in application layer | Medium | `apps/api/prisma/` | 5 | Add SQL trigger in migration |
| TD-005 | No DB trigger preventing UPDATE/DELETE on `escrow_ledger` | Medium | `apps/api/prisma/` | 5 | Add SQL trigger in migration |
| TD-006 | `ListingDocument` type defined inside `search.service.ts` instead of shared package | Low | `apps/api/src/providers/search/search.service.ts` | 0D | Moved to `packages/marketplace` during extraction |
| TD-007 | Refresh token cleanup job not implemented — table grows unboundedly | Low | `apps/api/src/auth/` | 6 | Add BullMQ cron job |

## Severity Definitions

- **High** — correctness bug or data integrity risk. Fix before building on top.
- **Medium** — deviation from architecture/ADR. Fix in next relevant phase.
- **Low** — code quality improvement. Fix when touching the area.

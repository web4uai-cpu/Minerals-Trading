# Build Workflow — Khanij Nexus

## CI/CD Pipeline

Every pull request must pass these quality gates before merge:

### Gate 1: Typecheck
```
pnpm typecheck
```
All packages and apps must compile with zero TypeScript errors.

### Gate 2: Lint
```
pnpm lint
```
ESLint rules from `@khanij/config` enforced across all workspaces.

### Gate 3: Unit + Integration Tests
```
pnpm test
```
All tests pass. Coverage must meet thresholds:
- Business logic (domain packages): **80%+**
- Controllers: **70%+**
- Overall: **70%+**

### Gate 4: Build
```
pnpm build
```
Turborepo builds all packages in dependency order. Build artifacts are valid.

### Gate 5: Security Scan (future)
- Dependency audit (`pnpm audit`)
- No critical or high vulnerabilities in production dependencies.

## Branch Strategy

- `main` — production-ready, protected.
- `dev` — integration branch for active development.
- Feature branches: `feat/{domain}/{description}` (e.g., `feat/deals/rfq-module`).
- Fix branches: `fix/{domain}/{description}`.

## Deployment Sequence

1. PR merged to `dev` → auto-deploy to staging.
2. Manual promotion `dev` → `main` → auto-deploy to production.
3. Database migrations run as K8s Job before app deployment.

## Turborepo Task Dependencies

```
build    → dependsOn: ["^build"]     (packages build before apps)
test     → dependsOn: ["^build"]     (build first, then test)
typecheck → dependsOn: ["^build"]
lint     → dependsOn: ["^build"]
dev      → cache: false, persistent: true
```

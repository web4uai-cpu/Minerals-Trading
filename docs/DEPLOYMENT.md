# Deployment Guide — Khanij Nexus

> Target: AWS ap-south-1 (Mumbai) — DPDP Act 2023 data residency.  
> Container runtime: Docker → Kubernetes (EKS).

---

## Environments

| Environment | Purpose | URL Pattern |
|-------------|---------|-------------|
| `local` | Developer laptop | `localhost:{port}` |
| `dev` | Shared dev instance (PR previews) | `dev-api.khanijnexus.in` |
| `staging` | Pre-production — production data shape, sandbox providers | `staging-api.khanijnexus.in` |
| `production` | Live | `api.khanijnexus.in` |

---

## Infrastructure Stack

```
AWS ap-south-1
├── EKS (Kubernetes cluster)
│   ├── apps/api (NestJS)         — Deployment: 2–10 replicas, HPA
│   ├── apps/web (Next.js)        — Deployment: 2–5 replicas
│   └── apps/mobile (Expo OTA)    — EAS Build + EAS Update
│
├── RDS (PostgreSQL 16 + TimescaleDB extension)
│   └── Multi-AZ, encrypted at rest, automated backups (7 days)
│
├── ElastiCache (Redis 7)
│   └── cluster mode, TLS, auth token
│
├── OpenSearch (Elasticsearch 8 compatible)
│   └── 3 data nodes, encrypted at rest
│
├── DocumentDB or MongoDB Atlas (ap-south-1 cluster)
│
├── S3 + CloudFront
│   ├── khanij-documents (compliance docs — private, presigned URLs only)
│   └── khanij-static (Next.js static assets — public CDN)
│
├── ECR (container registry)
├── Secrets Manager (all env vars / secrets)
├── CloudWatch (logs + metrics)
└── X-Ray (distributed tracing)
```

---

## Docker Images

### API
```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/ packages/
COPY apps/api/ apps/api/
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @khanij/api build
RUN pnpm --filter @khanij/api exec prisma generate

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 4000
CMD ["node", "dist/main.js"]
```

### Web
```dockerfile
# apps/web/Dockerfile
FROM node:20-alpine AS builder
# ... build Next.js with output: 'standalone'

FROM node:20-alpine AS runner
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.next/standalone ./
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## Kubernetes Manifests

### API Deployment (example)
```yaml
# infra/k8s/api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: khanij-api
  namespace: production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: khanij-api
  template:
    spec:
      containers:
        - name: api
          image: {ECR_URL}/khanij-api:{TAG}
          ports:
            - containerPort: 4000
          env:
            - name: NODE_ENV
              value: production
          envFrom:
            - secretRef:
                name: khanij-api-secrets  # from AWS Secrets Manager via External Secrets
          resources:
            requests: { cpu: 250m, memory: 512Mi }
            limits:   { cpu: 1000m, memory: 1Gi }
          livenessProbe:
            httpGet: { path: /health, port: 4000 }
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet: { path: /health, port: 4000 }
            initialDelaySeconds: 10
            periodSeconds: 5
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: khanij-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: khanij-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 70 }
```

---

## Database Migrations (Production)

**Never auto-migrate in production.** Migrations run as a Kubernetes Job before deploying the new API:

```yaml
# infra/k8s/migrate-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: khanij-migrate-{VERSION}
spec:
  template:
    spec:
      containers:
        - name: migrate
          image: {ECR_URL}/khanij-api:{TAG}
          command: ["npx", "prisma", "migrate", "deploy"]
          envFrom:
            - secretRef:
                name: khanij-api-secrets
      restartPolicy: Never
```

### Migration checklist:
- [ ] Migration is backward-compatible (old API can run against new schema)
- [ ] No DROP COLUMN or DROP TABLE without a previous deprecation release
- [ ] Large table changes use `ALTER TABLE ... ADD COLUMN ... DEFAULT NULL` then backfill job
- [ ] Tested on staging with production-size data

---

## CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml (reference)

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres: { image: timescale/timescaledb:latest-pg16 }
      redis: { image: redis:7-alpine }
      elasticsearch: { image: elasticsearch:8.11.0 }
    steps:
      - pnpm install
      - pnpm typecheck
      - pnpm lint
      - pnpm test --coverage

  build-and-push:
    needs: test
    steps:
      - Build API Docker image
      - Build Web Docker image
      - Push to ECR

  deploy-staging:
    needs: build-and-push
    steps:
      - Run migrate Job in staging namespace
      - kubectl rollout restart deployment/khanij-api -n staging
      - Run smoke tests

  deploy-production:
    needs: deploy-staging
    environment: production  # requires manual approval
    steps:
      - Run migrate Job in production namespace
      - kubectl set image deployment/khanij-api api={IMAGE}
      - kubectl rollout status deployment/khanij-api
```

---

## Secrets Management

```
Development: .env file (gitignored)
CI:          GitHub Actions Secrets → injected as env vars
Production:  AWS Secrets Manager → External Secrets Operator → K8s Secret

Secret naming: /khanij/{environment}/{service}/{key}
Example: /khanij/production/api/jwt-access-secret
```

---

## Monitoring & Alerting

| Signal | Tool | Alert threshold |
|--------|------|----------------|
| API error rate | CloudWatch | > 1% over 5 min |
| API p95 latency | CloudWatch | > 500ms |
| DB connection pool | CloudWatch | > 80% saturation |
| Redis memory | CloudWatch | > 75% |
| Elasticsearch health | CloudWatch | non-green status |
| BullMQ queue depth | Custom metric | > 500 unprocessed jobs |
| JWT invalid attempts | CloudWatch Insights | > 100/min from single IP |

---

## Disaster Recovery

| Scenario | RTO | RPO | Action |
|----------|-----|-----|--------|
| API pod crash | < 1 min | 0 | K8s restarts pod |
| DB instance failure | < 5 min | < 1 min | RDS Multi-AZ failover |
| Redis failure | < 2 min | 0 (cache) | Redis replica promotion |
| Elasticsearch failure | < 10 min | < 1 min (reindex from PG) | Re-index from Postgres |
| Full AZ outage | < 15 min | < 1 min | K8s reschedules to healthy AZ |

---

## Mobile Deployment (Expo)

```bash
# Build production APK/IPA
eas build --platform all --profile production

# Over-the-air update (JS bundle only — no app store review)
eas update --branch production --message "v1.2.3 hotfix"

# Full release (requires app store review)
eas submit --platform all
```

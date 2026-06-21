# Deployment Guide — Khanij Nexus

> **Stack:** Vercel (frontend) · Railway (API + PostgreSQL + Redis) · Expo EAS (mobile)

---

## Architecture

```
┌──────────────┐       ┌────────────────────┐       ┌─────────────────┐
│   Vercel      │──────▶│  Railway — API      │──────▶│ Railway Postgres │
│  Next.js 14   │       │  NestJS + Prisma    │       │  PostgreSQL 16   │
│  apps/web     │       │  apps/api           │       └─────────────────┘
└──────────────┘       │                      │──────▶┌─────────────────┐
                       │                      │       │  Railway Redis   │
┌──────────────┐       │                      │       │  Redis 7         │
│ Expo EAS      │──────▶│                      │       └─────────────────┘
│ apps/mobile   │       └────────────────────┘
└──────────────┘
```

---

## Step 1 — Railway: Create Project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Add **PostgreSQL** plugin → copy `DATABASE_URL` from Variables tab
3. Add **Redis** plugin → copy `REDIS_URL` from Variables tab

---

## Step 2 — Railway: Deploy Backend API

1. In the same project → **New Service** → **GitHub Repo** → select your repo
2. Railway auto-detects `Dockerfile` + `railway.toml` at repo root
3. Set **Root Directory** to `/` (monorepo root)

### Required Environment Variables

Set these in Railway dashboard → API service → **Variables** tab:

```env
# ── Database & Cache (use Railway reference variables) ──
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

# ── Runtime ──
NODE_ENV=production

# ── Auth Secrets (generate with: openssl rand -hex 32) ──
JWT_ACCESS_SECRET=<generate-64-char-hex>
JWT_REFRESH_SECRET=<generate-different-64-char-hex>

# ── PII Encryption (generate with: openssl rand -base64 32) ──
PII_ENCRYPTION_KEY=<generate-base64-32-byte-key>

# ── CORS — your Vercel URL(s), comma-separated ──
CORS_ORIGINS=https://your-app.vercel.app

# ── AI (optional — features degrade without it) ──
ANTHROPIC_API_KEY=sk-ant-xxxx
AI_MODEL=claude-sonnet-4-6

# ── S3 Storage (optional — required for doc uploads) ──
S3_ENDPOINT=https://s3.ap-south-1.amazonaws.com
S3_ACCESS_KEY=<your-key>
S3_SECRET_KEY=<your-secret>
S3_BUCKET=khanij-documents
S3_REGION=ap-south-1
```

### Variables you do NOT need to set

| Variable | Why |
|----------|-----|
| `PORT` | Railway injects automatically |
| `API_PORT` | Falls back to `PORT` |
| `ELASTICSEARCH_*` | Optional — search works without it |
| `SMTP_*` | Optional — notifications disabled |
| `LOG_LEVEL` | Defaults to `info` |

### How deploys work

1. Railway builds the Docker image from `Dockerfile`
2. Start command (from `railway.toml`) runs:
   ```
   npx prisma migrate deploy && node apps/api/dist/main.js
   ```
3. Health check hits `/health` — Railway monitors this endpoint

### First deploy — initialize database

If no migrations exist yet, run once via Railway CLI:
```bash
railway run --service api -- npx prisma db push
```

Or if you have migration files:
```bash
railway run --service api -- npx prisma migrate deploy
```

---

## Step 3 — Vercel: Deploy Frontend

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your GitHub repo
2. Configure:
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `apps/web`
   - Build/output auto-configured via `vercel.json`

### Environment Variables (Vercel Dashboard)

| Variable | Value | Where |
|----------|-------|-------|
| `NEXT_PUBLIC_API_URL` | `https://your-api.up.railway.app` | Settings → Environment Variables |

That's the **only** variable needed for the frontend.

### After first deploy

1. Copy your Vercel URL (e.g., `https://khanij-nexus.vercel.app`)
2. Go back to Railway → API service → Variables
3. Update `CORS_ORIGINS` to include your Vercel URL

### Custom Domain (optional)

1. Vercel → Settings → Domains → Add domain
2. Add the custom domain to `CORS_ORIGINS` in Railway

---

## Step 4 — Mobile App (Expo)

### Development (pointing to Railway API)
```bash
EXPO_PUBLIC_API_URL=https://your-api.up.railway.app npx expo start
```

### Production Build (EAS)

Create `apps/mobile/eas.json`:
```json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://your-api.up.railway.app"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://your-api.up.railway.app"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

```bash
# Build
eas build --platform all --profile production

# OTA update (no app store review)
eas update --branch production --message "v1.x.x"

# App store submit
eas submit --platform all
```

---

## Generate Secrets

Run these to generate all production secrets:

```bash
# JWT secrets (64-char hex strings)
echo "JWT_ACCESS_SECRET=$(openssl rand -hex 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"

# PII encryption key (32-byte base64)
echo "PII_ENCRYPTION_KEY=$(openssl rand -base64 32)"
```

---

## Optional Services

### Elasticsearch (full-text search)

Without it, marketplace search still works (AI intent parsing + DB query).
With it, listings are indexed for fast full-text + faceted search.

Options:
- **Bonsai.io** — free tier, managed ES
- **Elastic Cloud** — official, managed
- Set: `ELASTICSEARCH_NODE`, `ELASTICSEARCH_USERNAME`, `ELASTICSEARCH_PASSWORD`

### S3-Compatible Storage (compliance documents)

Options:
- **AWS S3** — `S3_ENDPOINT=https://s3.ap-south-1.amazonaws.com`
- **Cloudflare R2** — S3-compatible, zero egress fees
- **Backblaze B2** — cheapest S3-compatible
- **MinIO on Railway** — add MinIO plugin for self-hosted

### Email Notifications

Set: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

Options: **Resend**, **AWS SES**, **SendGrid** (free tier)

---

## Post-Deploy Verification Checklist

- [ ] `https://your-api.up.railway.app/health` → returns `200 OK` with version
- [ ] `https://your-app.vercel.app` → loads login page (dark theme)
- [ ] Register a new account → redirects to dashboard
- [ ] Login works with registered credentials
- [ ] Dashboard shows role badge and quick actions
- [ ] Marketplace search returns results (or empty with no seed data)
- [ ] No CORS errors in browser console
- [ ] Railway logs show `Khanij Nexus API running on port XXXX`
- [ ] Mobile app connects to API when `EXPO_PUBLIC_API_URL` is set

---

## Environment Variable Reference

### Required (API will crash without these)

| Variable | Source | Generate |
|---|---|---|
| `DATABASE_URL` | Railway Postgres plugin | Auto-provided |
| `REDIS_URL` | Railway Redis plugin | Auto-provided |
| `JWT_ACCESS_SECRET` | Manual | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Manual | `openssl rand -hex 32` |
| `PII_ENCRYPTION_KEY` | Manual | `openssl rand -base64 32` |
| `CORS_ORIGINS` | Manual | Your Vercel URL |
| `NEXT_PUBLIC_API_URL` | Vercel dashboard | Your Railway API URL |

### Optional (features degrade gracefully)

| Variable | Feature |
|---|---|
| `ANTHROPIC_API_KEY` | AI search, contract drafting, compliance review |
| `S3_ENDPOINT` + keys | Document upload |
| `ELASTICSEARCH_NODE` | Full-text search indexing |
| `SMTP_HOST` + creds | Email notifications |
| `AI_MODEL` | Defaults to `claude-sonnet-4-6` |
| `AI_MAX_TOKENS` | Defaults to `2000` |
| `LOG_LEVEL` | Defaults to `info` |

---

## Troubleshooting

| Issue | Fix |
|---|---|
| CORS error in browser | Add Vercel URL to `CORS_ORIGINS` in Railway |
| `prisma migrate deploy` fails | Check `DATABASE_URL` is the **public** Railway URL |
| API returns 500 on startup | Check Railway logs — missing env var? |
| Health check fails | Ensure `/health` endpoint responds (no auth required) |
| Mobile can't connect | Use Railway **public** URL, not `.railway.internal` |
| Redis connection refused | Use `${{Redis.REDIS_URL}}` reference variable |

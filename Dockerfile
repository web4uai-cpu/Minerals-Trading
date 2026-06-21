# ── Stage 1: Install & Build ──────────────────────────────────
FROM node:20-slim AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/compliance/package.json ./packages/compliance/
COPY packages/config/package.json ./packages/config/
COPY packages/ui/package.json ./packages/ui/
COPY packages/deals/package.json ./packages/deals/
COPY packages/marketplace/package.json ./packages/marketplace/
COPY packages/bidding/package.json ./packages/bidding/
COPY packages/ai/package.json ./packages/ai/
COPY packages/finance/package.json ./packages/finance/
COPY packages/logistics/package.json ./packages/logistics/
COPY packages/arbitration/package.json ./packages/arbitration/
COPY packages/blockchain/package.json ./packages/blockchain/

# Install all deps
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Generate Prisma client (needed for API type imports)
RUN cd apps/api && npx prisma generate

# Build @khanij/types first (all other packages depend on it)
RUN pnpm --filter @khanij/types build

# Build all domain packages (they only depend on types)
RUN pnpm --filter @khanij/compliance build && \
    pnpm --filter @khanij/deals build && \
    pnpm --filter @khanij/marketplace build && \
    pnpm --filter @khanij/bidding build && \
    pnpm --filter @khanij/ai build && \
    pnpm --filter @khanij/finance build && \
    pnpm --filter @khanij/logistics build && \
    pnpm --filter @khanij/arbitration build && \
    pnpm --filter @khanij/blockchain build

# Build the API last
RUN pnpm --filter @khanij/api build

# ── Stage 2: Production Runtime ──────────────────────────────
FROM node:20-slim AS runner

RUN corepack enable && corepack prepare pnpm@9 --activate
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

# Copy built output + node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/package.json ./

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/health').then(r=>{if(!r.ok)throw 1}).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/main.js"]

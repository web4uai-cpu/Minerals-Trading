-- Migration: Add mineral catalog, listings, and price history
-- Created: 2026-06-08
-- Description: Adds Mineral, Listing tables + TimescaleDB price_history hypertable.

-- ─── ListingStatus Enum ─────────────────────────────────────────────────────

CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'SOLD_OUT');

-- ─── minerals ───────────────────────────────────────────────────────────────

CREATE TABLE "minerals" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "category"    TEXT NOT NULL,
  "hsnCode"     TEXT,
  "defaultUnit" TEXT NOT NULL DEFAULT 'MT',
  "gradeParams" JSONB NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "minerals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "minerals_name_key" ON "minerals"("name");

-- ─── listings ───────────────────────────────────────────────────────────────

CREATE TABLE "listings" (
  "id"                TEXT NOT NULL,
  "sellerOrgId"       TEXT NOT NULL,
  "mineralId"         TEXT NOT NULL,
  "grade"             JSONB NOT NULL,
  "quantityAvailable" DECIMAL(12, 2) NOT NULL,
  "unit"              TEXT NOT NULL DEFAULT 'MT',
  "askPriceInPaise"   BIGINT NOT NULL,
  "location"          JSONB NOT NULL,
  "dispatchLeadDays"  INTEGER NOT NULL,
  "status"            "ListingStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "listings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "listings_sellerOrgId_fkey"
    FOREIGN KEY ("sellerOrgId") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "listings_mineralId_fkey"
    FOREIGN KEY ("mineralId") REFERENCES "minerals"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "listings_sellerOrgId_idx" ON "listings"("sellerOrgId");
CREATE INDEX "listings_mineralId_idx" ON "listings"("mineralId");
CREATE INDEX "listings_status_idx" ON "listings"("status");

-- ─── price_history (TimescaleDB hypertable) ─────────────────────────────────
-- Not a Prisma model — managed via raw SQL. Stores every reference price lookup.

CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

CREATE TABLE "price_history" (
  "time"       TIMESTAMPTZ NOT NULL,
  "mineral_id" UUID NOT NULL,
  "grade"      JSONB NOT NULL,
  "state"      TEXT NOT NULL,
  "fair_low"   BIGINT NOT NULL,
  "fair_high"  BIGINT NOT NULL,
  "ref_price"  BIGINT NOT NULL,
  "source"     TEXT NOT NULL DEFAULT 'sandbox'
);

SELECT create_hypertable('price_history', 'time');
CREATE INDEX ON "price_history" ("mineral_id", "state", "time" DESC);

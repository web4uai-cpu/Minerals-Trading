-- Migration: Add compliance items and snapshots
-- Created: 2026-06-08
-- Description: Adds ComplianceItem and ComplianceSnapshot tables for the
--              compliance & verification engine.

-- ─── Enums ──────────────────────────────────────────────────────────────────

CREATE TYPE "ComplianceItemType" AS ENUM (
  'MINING_LEASE',
  'ENV_CLEARANCE',
  'FOREST_CLEARANCE',
  'IBM_RETURNS',
  'ROYALTY_CLEARANCE',
  'SPCB_NOC',
  'GST_REG',
  'PAN',
  'BANK_VERIFICATION',
  'IEC',
  'END_USE_DECLARATION',
  'INDUSTRY_REGISTRATION'
);

CREATE TYPE "ComplianceItemStatus" AS ENUM (
  'MISSING',
  'UPLOADED',
  'UNDER_REVIEW',
  'VERIFIED',
  'REJECTED',
  'EXPIRED'
);

-- ─── compliance_items ────────────────────────────────────────────────────────

CREATE TABLE "compliance_items" (
  "id"            TEXT NOT NULL,
  "orgId"         TEXT NOT NULL,
  "type"          "ComplianceItemType" NOT NULL,
  "status"        "ComplianceItemStatus" NOT NULL DEFAULT 'MISSING',
  "documentRef"   TEXT,
  "validFrom"     TIMESTAMP(3),
  "validUntil"    TIMESTAMP(3),
  "verifiedBy"    TEXT,
  "verifiedAt"    TIMESTAMP(3),
  "rejectionNote" TEXT,
  "uploadedAt"    TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "compliance_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "compliance_items_orgId_type_key" UNIQUE ("orgId", "type"),
  CONSTRAINT "compliance_items_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "compliance_items_orgId_idx" ON "compliance_items"("orgId");
CREATE INDEX "compliance_items_status_idx" ON "compliance_items"("status");

-- ─── compliance_snapshots ────────────────────────────────────────────────────

CREATE TABLE "compliance_snapshots" (
  "id"          TEXT NOT NULL,
  "orgId"       TEXT NOT NULL,
  "trustScore"  INTEGER NOT NULL,
  "breakdown"   JSONB NOT NULL,
  "triggeredBy" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "compliance_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "compliance_snapshots_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "compliance_snapshots_orgId_createdAt_idx"
  ON "compliance_snapshots"("orgId", "createdAt");

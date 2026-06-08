-- Migration: Deal Rooms, Quotes & Workflow
-- Created: 2026-06-08
-- Description: RFQ, Quote, Deal, DealMilestone, EscrowLedger, DealMessage tables.

-- ─── Enums ──────────────────────────────────────────────────────────────────

CREATE TYPE "RfqStatus" AS ENUM ('OPEN', 'QUOTED', 'CLOSED', 'CANCELLED');
CREATE TYPE "QuoteStatus" AS ENUM ('SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');
CREATE TYPE "DealStatus" AS ENUM ('CREATED', 'AGREEMENT_DRAFT', 'SIGNED', 'ESCROW_PENDING', 'IN_FULFILMENT', 'COMPLETED', 'DISPUTED', 'CANCELLED');
CREATE TYPE "MilestoneType" AS ENUM ('AGREEMENT', 'ESCROW', 'SAMPLING', 'DISPATCH', 'DELIVERY', 'PAYMENT');
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'DONE', 'OVERDUE');
CREATE TYPE "EscrowEntryType" AS ENUM ('HELD', 'RELEASED', 'REFUNDED');
CREATE TYPE "MessageSenderType" AS ENUM ('BUYER', 'SELLER', 'AI');

-- ─── rfqs ───────────────────────────────────────────────────────────────────

CREATE TABLE "rfqs" (
  "id"         TEXT NOT NULL,
  "buyerOrgId" TEXT NOT NULL,
  "listingId"  TEXT,
  "mineralId"  TEXT NOT NULL,
  "grade"      JSONB NOT NULL,
  "quantity"   DECIMAL(12, 2) NOT NULL,
  "unit"       TEXT NOT NULL DEFAULT 'MT',
  "neededBy"   TIMESTAMP(3) NOT NULL,
  "notes"      TEXT,
  "status"     "RfqStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "rfqs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rfqs_buyerOrgId_fkey" FOREIGN KEY ("buyerOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "rfqs_mineralId_fkey" FOREIGN KEY ("mineralId") REFERENCES "minerals"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "rfqs_buyerOrgId_idx" ON "rfqs"("buyerOrgId");
CREATE INDEX "rfqs_mineralId_idx" ON "rfqs"("mineralId");
CREATE INDEX "rfqs_status_idx" ON "rfqs"("status");

-- ─── quotes ─────────────────────────────────────────────────────────────────

CREATE TABLE "quotes" (
  "id"                TEXT NOT NULL,
  "rfqId"             TEXT NOT NULL,
  "sellerOrgId"       TEXT NOT NULL,
  "pricePerUnitPaise" BIGINT NOT NULL,
  "validUntil"        TIMESTAMP(3) NOT NULL,
  "terms"             JSONB,
  "status"            "QuoteStatus" NOT NULL DEFAULT 'SENT',
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "quotes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quotes_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "rfqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "quotes_sellerOrgId_fkey" FOREIGN KEY ("sellerOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "quotes_rfqId_idx" ON "quotes"("rfqId");
CREATE INDEX "quotes_sellerOrgId_idx" ON "quotes"("sellerOrgId");
CREATE INDEX "quotes_status_idx" ON "quotes"("status");

-- ─── deals ──────────────────────────────────────────────────────────────────

CREATE TABLE "deals" (
  "id"              TEXT NOT NULL,
  "buyerOrgId"      TEXT NOT NULL,
  "sellerOrgId"     TEXT NOT NULL,
  "quoteId"         TEXT NOT NULL,
  "mineralId"       TEXT NOT NULL,
  "grade"           JSONB NOT NULL,
  "quantity"        DECIMAL(12, 2) NOT NULL,
  "unit"            TEXT NOT NULL DEFAULT 'MT',
  "totalValuePaise" BIGINT NOT NULL,
  "arbitrationSeat" TEXT,
  "status"          "DealStatus" NOT NULL DEFAULT 'CREATED',
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "deals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "deals_buyerOrgId_fkey" FOREIGN KEY ("buyerOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "deals_sellerOrgId_fkey" FOREIGN KEY ("sellerOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "deals_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "deals_buyerOrgId_idx" ON "deals"("buyerOrgId");
CREATE INDEX "deals_sellerOrgId_idx" ON "deals"("sellerOrgId");
CREATE INDEX "deals_quoteId_idx" ON "deals"("quoteId");
CREATE INDEX "deals_status_idx" ON "deals"("status");

-- ─── deal_milestones ────────────────────────────────────────────────────────

CREATE TABLE "deal_milestones" (
  "id"          TEXT NOT NULL,
  "dealId"      TEXT NOT NULL,
  "type"        "MilestoneType" NOT NULL,
  "sequence"    INTEGER NOT NULL,
  "dueDate"     TIMESTAMP(3),
  "status"      "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
  "completedAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "deal_milestones_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "deal_milestones_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "deal_milestones_dealId_type_key" ON "deal_milestones"("dealId", "type");
CREATE INDEX "deal_milestones_dealId_idx" ON "deal_milestones"("dealId");

-- ─── escrow_ledger ──────────────────────────────────────────────────────────

CREATE TABLE "escrow_ledger" (
  "id"          TEXT NOT NULL,
  "dealId"      TEXT NOT NULL,
  "type"        "EscrowEntryType" NOT NULL,
  "amountPaise" BIGINT NOT NULL,
  "txnRef"      TEXT NOT NULL,
  "note"        TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "escrow_ledger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "escrow_ledger_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "escrow_ledger_dealId_idx" ON "escrow_ledger"("dealId");

-- ─── deal_messages ──────────────────────────────────────────────────────────

CREATE TABLE "deal_messages" (
  "id"           TEXT NOT NULL,
  "dealId"       TEXT NOT NULL,
  "senderType"   "MessageSenderType" NOT NULL,
  "senderOrgId"  TEXT,
  "senderUserId" TEXT,
  "content"      TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "deal_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "deal_messages_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "deal_messages_dealId_createdAt_idx" ON "deal_messages"("dealId", "createdAt");

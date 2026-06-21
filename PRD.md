# Khanij Nexus — Product Requirements Document (PRD)

> **Status:** Pre-Alpha | **Version:** 1.0 | **Date:** 2026-06-15  
> **Owner:** Product / Engineering | **Stack freeze:** see CLAUDE.md

---

## 1. Executive Summary

Khanij Nexus is an AI-powered B2B marketplace and dispute-arbitration platform for India's mines and minerals trade. It connects verified buyers and sellers, enforces regulatory compliance, and resolves disputes through structured arbitration — all within a monitored, auditable environment.

**North Star Metric:** Gross Merchandise Value (GMV) of minerals transacted through verified deal rooms.

---

## 2. Problem Statement

India's minerals trade is fragmented across informal networks:
- No central verification of mining leases, environmental clearances, or royalty compliance
- No structured price discovery — deals happen via phone calls and spreadsheets
- Dispute resolution takes months through courts with no evidentiary infrastructure
- Regulators have zero real-time visibility into trade volumes, grades, and origins

**Consequence:** Illegal mining, environmental violations, and non-payment disputes proliferate unchecked.

---

## 3. Target Users & Personas

### 3.1 Seller (Mining Company / Trader)
- **Who:** Rajasthan iron ore miner with a valid mining lease
- **Goal:** List verified stock, find qualified buyers, get paid securely
- **Pain:** Buyers ghost after price discovery; no mechanism to prove provenance
- **Trust signal:** IBM returns, EC, royalty clearance all current → TrustScore ≥ 80

### 3.2 Buyer (Steel Plant / Exporter / Trader)
- **Who:** Procurement head at a mid-size steel plant in Odisha
- **Goal:** Source reliable iron ore within spec (Fe ≥ 62%), get 3rd-party quality proof
- **Pain:** Receives substandard ore; no recourse when seller disappears
- **Trust signal:** Verified end-use declaration, GST registration, bank verification

### 3.3 Arbitrator
- **Who:** Retired district judge or commodity lawyer on the Khanij Nexus panel
- **Goal:** Review dispute briefs, examine evidence, issue awards
- **Pain:** No structured platform — evidence arrives via WhatsApp

### 3.4 Admin (Khanij Nexus staff)
- **Who:** Compliance officer reviewing uploaded documents
- **Goal:** Verify documents against govt registries, update TrustScore
- **Superpower:** Can SUSPEND orgs, reject compliance items, trigger audit sweeps

### 3.5 Regulator (IBDM / State DMG — read-only)
- **Who:** Inspector at the Indian Bureau of Mines
- **Goal:** Real-time view of trade volumes, grades, seller compliance status
- **Constraint:** Read-only, no mutations. All data masked per DPDP Act 2023.

---

## 4. Feature Requirements

### 4.1 Identity & RBAC (Phase 1 — DONE)
| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| F-01 | Org registration (BUYER / SELLER / TRADER / EXPORTER / ARBITRATION_BODY) | P0 | Done |
| F-02 | User accounts with role (BUYER, SELLER, ARBITRATOR, ADMIN, REGULATOR_READONLY) | P0 | Done |
| F-03 | JWT auth (15m access / 7d rotating refresh) + Argon2id passwords | P0 | Done |
| F-04 | RBAC guards at route + data layer | P0 | Done |
| F-05 | Refresh token rotation with device fingerprint | P0 | Done |

### 4.2 Compliance Engine (Phase 2 — DONE)
| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| F-10 | 12-document compliance checklist per org (MINING_LEASE → INDUSTRY_REGISTRATION) | P0 | Done |
| F-11 | Document upload to S3/MinIO with virus scan | P0 | Done |
| F-12 | Admin verify / reject workflow with notes | P0 | Done |
| F-13 | TrustScore calculation (0–100) with breakdown | P0 | Done |
| F-14 | Nightly expiry sweep + score decay | P0 | Done |
| F-15 | Compliance snapshot history (append-only) | P0 | Done |
| F-16 | Sandbox KYC provider (no real Aadhaar eKYC) | P0 | Done |

### 4.3 Catalog & Discovery (Phase 3 — DONE)
| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| F-20 | Mineral catalog with grade parameters (Fe%, moisture%, etc.) | P0 | Done |
| F-21 | Seller listings (DRAFT → ACTIVE, blocked if org not VERIFIED) | P0 | Done |
| F-22 | Elasticsearch indexing on listing activation | P0 | Done |
| F-23 | AI natural-language search → ranked seller results | P0 | Done |
| F-24 | TrustScore-weighted ranking algorithm | P0 | Done |

### 4.4 Deal Rooms (Phase 4 — IN PROGRESS)
| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| F-30 | RFQ creation by verified buyers | P0 | In progress |
| F-31 | Quote submission by verified sellers | P0 | In progress |
| F-32 | Deal creation on quote acceptance | P0 | In progress |
| F-33 | Deal state machine (8 states: CREATED → COMPLETED / DISPUTED) | P0 | In progress |
| F-34 | 6-milestone lifecycle (AGREEMENT → PAYMENT) | P0 | In progress |
| F-35 | Escrow ledger (HELD / RELEASED / REFUNDED, paise, append-only) | P0 | In progress |
| F-36 | Deal-room messaging (buyer, seller, AI) via WebSocket | P0 | Pending |
| F-37 | AI co-pilot: draft quotes, interpret clauses, flag risks | P1 | Pending |
| F-38 | AI contract generation (decision-support, human signs) | P1 | Pending |

### 4.5 Arbitration (Phase 5 — Pending)
| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| F-40 | Dispute filing from DISPUTED deal | P0 | Pending |
| F-41 | Evidence vault (documents, messages, photos) | P0 | Pending |
| F-42 | Arbitrator assignment from panel | P0 | Pending |
| F-43 | Structured hearing timeline with deadlines | P0 | Pending |
| F-44 | AI arbitration brief generation (decision-support) | P1 | Pending |
| F-45 | Award issuance with digital signature | P0 | Pending |
| F-46 | Award enforcement tracking | P1 | Pending |

### 4.6 Web Frontend (Phase 6 — Pending)
| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| F-50 | Onboarding wizard (org registration → compliance upload) | P0 | Pending |
| F-51 | Dashboard (TrustScore gauge, active deals, pending milestones) | P0 | Pending |
| F-52 | Discovery search with 3D globe filter (state/district) | P1 | Pending |
| F-53 | Listing management UI | P0 | Pending |
| F-54 | Deal room UI with real-time chat | P0 | Pending |
| F-55 | Compliance tracker with document upload | P0 | Pending |
| F-56 | Arbitration portal for arbitrators | P0 | Pending |
| F-57 | Admin dashboard (verify docs, manage orgs) | P0 | Pending |
| F-58 | Regulator view (read-only analytics) | P1 | Pending |

### 4.7 Mobile (Phase 7 — Pending)
| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| F-60 | Push notifications for deal milestones | P0 | Pending |
| F-61 | Document upload via camera (OCR auto-fill) | P1 | Pending |
| F-62 | Deal status tracking | P0 | Pending |
| F-63 | Price alerts for listed minerals | P1 | Pending |

---

## 5. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Performance** | API p95 < 200ms on search. Real-time messages < 100ms. |
| **Availability** | 99.9% uptime. Graceful degradation if Elasticsearch is down (fall back to Postgres). |
| **Security** | OWASP Top 10. PII field-level AES-256-GCM encryption. JWT token rotation. Rate limiting (100 req/min per IP). |
| **Compliance** | DPDP Act 2023 (data residency ap-south-1). MMDR Act 1957. Indian Arbitration Act 1996. |
| **Scalability** | Handle 10,000 concurrent users; 1M listings indexed in Elasticsearch. |
| **Auditability** | Every state-change has an append-only audit_log row. 7-year retention. |
| **Observability** | Structured JSON logs (pino) + OpenTelemetry traces. Alerts on error rate > 1%. |

---

## 6. Constraints

- **No real Aadhaar eKYC** — use SandboxKycProvider only.
- **No real payment rails** — model the escrow ledger; stub PaymentProvider.
- **No blockchain** — AuditAnchor interface with no-op impl.
- **Money in paise only** — never floats; BIGINT in DB.
- **Pilot scope:** One state (Rajasthan), one mineral (iron ore) for first go-live.

---

## 7. Success Metrics (MVP Go-Live)

| Metric | Target |
|--------|--------|
| Verified seller orgs | 50 |
| Verified buyer orgs | 100 |
| Active listings | 500 |
| Deals completed | 25 |
| TrustScore ≥ 70 orgs | 80% of verified |
| Dispute resolution time | < 30 days |
| API uptime | 99.9% |

---

## 8. Out of Scope (V1)

- Multi-language UI (Hindi, Odia) — defer to V2
- Grade testing integration (third-party labs) — defer to V2
- Live LME/MCX price feeds — sandbox only
- Blockchain audit anchoring — interface only
- Neo4j fraud detection graph — SQL heuristics for MVP
- Real RBI-licensed payment escrow — requires PA/PA-C licence

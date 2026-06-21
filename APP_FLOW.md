# Khanij Nexus — Application Flow & User Journeys

> All flows assume the user is authenticated unless marked **[Public]**.  
> State names in `UPPER_CASE` match the Prisma enums exactly.

---

## 1. Onboarding Flow

### 1.1 Seller Onboarding

```
[Public] Landing Page
  └─► Register Organization
        │  Fields: legalName, orgType=SELLER, gstin (encrypted), pan (encrypted), state
        │  Creates: Organization (status=PENDING) + User (role=SELLER)
        │  Audit: org.created
        └─► Email verification
              └─► Login → JWT access + refresh token
                    └─► Compliance Checklist Screen
                          │  Shows: 12 compliance items (MISSING)
                          └─► Upload Documents (one by one)
                                │  Each upload: status → UPLOADED, S3 key saved
                                │  Audit: compliance_item.uploaded
                                └─► Wait for Admin Review
                                      │  Admin: VERIFIED or REJECTED (with notes)
                                      │  Audit: compliance_item.verified / rejected
                                      └─► TrustScore recalculated (snapshot appended)
                                            └─► If org VERIFIED → can create listings
```

### 1.2 Buyer Onboarding

```
[Public] Landing Page
  └─► Register Organization (orgType=BUYER)
        └─► Compliance subset upload (END_USE_DECLARATION, GST_REG, PAN, BANK_VERIFICATION)
              └─► Admin review → org VERIFIED
                    └─► Can issue RFQs and accept quotes
```

---

## 2. Discovery & Search Flow

```
Buyer Dashboard → Search Bar (natural language)
  │  Example: "62% Fe iron ore, 5000 MT, Rajasthan, needed in 30 days"
  └─► POST /discovery/search
        │  AI parses intent → { mineralName, gradeMin, quantity, state, deadline }
        │  Elasticsearch query with TrustScore boost
        └─► Results Grid (sorted by TrustScore × price fit × distance)
              │  Each card: seller org name, TrustScore badge, grade range, price, lead days
              └─► Click listing → Listing Detail Page
                    │  Shows: full grade params, quantity, price, seller compliance status
                    └─► "Send RFQ" → RFQ creation flow
```

---

## 3. RFQ → Quote → Deal Flow

```
Buyer: Create RFQ
  │  Fields: mineralId, grade JSON, quantity, neededBy, notes
  │  Status: OPEN
  │  Validates: buyerOrg is VERIFIED
  └─► Sellers notified (BullMQ job → push notification / email)
        │
        ├─► Seller A: Submit Quote
        │     │  Fields: pricePerUnitPaise, validUntil, terms JSON
        │     │  Status: SENT
        │     │  Validates: sellerOrg is VERIFIED
        │     └─► RFQ status: QUOTED (if first quote)
        │
        ├─► Seller B: Submit Quote
        │
        └─► Buyer reviews quotes side-by-side
              └─► Accept Quote
                    │  Creates: Deal (status=CREATED)
                    │  Rejected quote: status=REJECTED
                    │  Accepted quote: status=ACCEPTED
                    │  Creates: 6 DealMilestones (PENDING)
                    │  Audit: deal.created
                    └─► Deal Room opens
```

---

## 4. Deal Room Flow (State Machine)

```
CREATED
  │  AI co-pilot drafts agreement
  └─► Both parties review
        └─► AGREEMENT_DRAFT
              │  Edits, AI clause interpretation on demand
              └─► Both parties digitally sign
                    └─► SIGNED
                          │  Buyer funds escrow (PaymentProvider.hold)
                          │  EscrowLedger: type=HELD, amountPaise=totalValuePaise
                          └─► ESCROW_PENDING
                                │  Payment confirmed
                                └─► IN_FULFILMENT
                                      │  Milestones tick: SAMPLING → DISPATCH → DELIVERY
                                      ├─► [Happy path] All milestones DONE
                                      │     │  Buyer confirms receipt + quality
                                      │     └─► COMPLETED
                                      │           │  Escrow released to seller
                                      │           │  EscrowLedger: type=RELEASED
                                      │           └─► TrustScore boosted for both orgs
                                      │
                                      └─► [Dispute] Either party raises dispute
                                            │  Deal: status=DISPUTED
                                            │  Escrow: frozen (no RELEASED / REFUNDED)
                                            └─► Arbitration flow begins
```

---

## 5. Arbitration Flow

```
DISPUTED Deal → File Dispute
  │  Fields: disputeType, claimantStatement, evidenceDocuments[]
  └─► Dispute created (status=FILED)
        └─► Arbitrator assigned from panel (round-robin or skill match)
              └─► Respondent notified → submits counter-statement (14 days)
                    └─► Evidence vault locked
                          └─► Hearing schedule set (AI suggests timeline)
                                └─► Preliminary hearing (virtual)
                                      └─► AI drafts arbitration brief
                                            │  Sources: deal messages, milestone records, docs
                                            │  Label: "AI-generated decision-support, not binding"
                                            └─► Arbitrator issues AWARD
                                                  │  Types: BUYER_WINS / SELLER_WINS / SPLIT
                                                  └─► Escrow executed per award
                                                        │  BUYER_WINS → REFUNDED
                                                        │  SELLER_WINS → RELEASED
                                                        │  SPLIT → proportional entries
                                                        └─► Deal: status=COMPLETED
```

---

## 6. Admin Compliance Review Flow

```
Admin Dashboard → Pending Reviews queue
  └─► Open compliance item
        │  Shows: uploaded document (PDF/image), org details, previous history
        └─► Verify (with optional note) OR Reject (with mandatory note)
              │  ComplianceItem: status → VERIFIED or REJECTED
              │  If VERIFIED: validFrom, validUntil set, verifiedBy=userId
              │  Audit: compliance_item.verified
              └─► TrustScore recalculated
                    │  ComplianceSnapshot appended
                    └─► If all required items VERIFIED → org status → VERIFIED
                          └─► Seller can now ACTIVATE listings
```

---

## 7. Screen Inventory (Web)

### Public Screens
| Screen | Route | Description |
|--------|-------|-------------|
| Landing | `/` | Hero, value props, 3D globe, CTA |
| Register | `/register` | Org + user registration wizard |
| Login | `/login` | Email/password, remember device |
| About | `/about` | Platform overview |

### Authenticated — Buyer
| Screen | Route | Description |
|--------|-------|-------------|
| Dashboard | `/dashboard` | TrustScore, active RFQs, deals |
| Discovery | `/discover` | NL search + 3D map filter |
| RFQ List | `/rfqs` | My open/closed RFQs |
| RFQ Detail | `/rfqs/:id` | Quotes received, comparison table |
| Deal Room | `/deals/:id` | Chat, milestones, documents, escrow |
| Compliance | `/compliance` | My checklist + upload |
| Profile | `/profile` | Org settings |

### Authenticated — Seller
| Screen | Route | Description |
|--------|-------|-------------|
| Dashboard | `/dashboard` | TrustScore, active listings, open quotes |
| Listings | `/listings` | My listings (DRAFT/ACTIVE/PAUSED) |
| Listing Detail | `/listings/:id` | Edit, analytics |
| New Listing | `/listings/new` | Create listing form |
| RFQs Inbox | `/rfqs/inbox` | Open RFQs matching my minerals |
| Quote Builder | `/rfqs/:id/quote` | Submit quote with AI assist |
| Deal Room | `/deals/:id` | Same as buyer view |
| Compliance | `/compliance` | My 12-item checklist |

### Authenticated — Admin
| Screen | Route | Description |
|--------|-------|-------------|
| Admin Dashboard | `/admin` | Metrics, pending queue count |
| Review Queue | `/admin/compliance` | Pending documents |
| Org Management | `/admin/orgs` | Search, suspend, view history |
| Dispute Queue | `/admin/disputes` | Active arbitrations |
| Audit Log | `/admin/audit` | Immutable event log viewer |

### Authenticated — Arbitrator
| Screen | Route | Description |
|--------|-------|-------------|
| My Cases | `/arbitration` | Assigned disputes |
| Case Detail | `/arbitration/:id` | Evidence vault, briefs, timeline |
| Issue Award | `/arbitration/:id/award` | Award form with AI brief |

### Authenticated — Regulator (Read-only)
| Screen | Route | Description |
|--------|-------|-------------|
| Analytics | `/regulator` | Trade volumes, grades, compliance map |
| Org Explorer | `/regulator/orgs` | Verified orgs, TrustScore distribution |

---

## 8. API Route Map (Summary)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/register | Public | Register org + user |
| POST | /auth/login | Public | Get JWT pair |
| POST | /auth/refresh | Public | Rotate refresh token |
| POST | /auth/logout | Auth | Revoke refresh token |
| GET | /compliance/:orgId | Auth | Get compliance checklist |
| POST | /compliance/:orgId/items/:type/upload | SELLER | Upload document |
| PATCH | /compliance/:orgId/items/:type/verify | ADMIN | Verify/reject item |
| GET | /catalog/minerals | Auth | List all minerals |
| GET | /listings | Auth | Search listings |
| POST | /listings | SELLER | Create listing |
| PATCH | /listings/:id | SELLER | Update listing |
| GET | /discovery/search | BUYER | NL search → ranked sellers |
| POST | /rfqs | BUYER | Create RFQ |
| GET | /rfqs | BUYER/SELLER | List RFQs |
| POST | /rfqs/:id/quotes | SELLER | Submit quote |
| POST | /rfqs/:id/quotes/:qId/accept | BUYER | Accept quote → create deal |
| GET | /deals/:id | Auth | Get deal details |
| POST | /deals/:id/messages | Auth | Send deal-room message |
| POST | /deals/:id/milestones/:type/complete | Auth | Mark milestone done |
| POST | /deals/:id/dispute | Auth | File dispute |
| GET | /health | Public | Health check |

---

## 9. WebSocket Events (Deal Room)

| Event | Direction | Payload |
|-------|-----------|---------|
| `deal:message` | Server → Client | `{ dealId, senderType, content, createdAt }` |
| `deal:milestone_updated` | Server → Client | `{ dealId, milestoneType, status }` |
| `deal:status_changed` | Server → Client | `{ dealId, from, to }` |
| `deal:escrow_event` | Server → Client | `{ dealId, type, amountPaise }` |
| `send:message` | Client → Server | `{ dealId, content }` |

---

## 10. Notification Events (BullMQ → Push/Email)

| Trigger | Recipients | Channel |
|---------|-----------|---------|
| New RFQ matching seller's mineral | Sellers | Push + Email |
| Quote received on RFQ | Buyer | Push + Email |
| Deal created | Both parties | Push + Email |
| Milestone overdue | Both parties | Push + Email |
| Compliance item expiring in 30 days | Seller | Email |
| Compliance item rejected | Seller | Push + Email |
| Dispute filed | Both parties + Arbitrator | Email |
| Award issued | Both parties | Push + Email |

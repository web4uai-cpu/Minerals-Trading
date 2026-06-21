# Khanij Nexus — Data Flow Documentation

> Describes how data moves between layers, services, and stores.  
> Read alongside ARCHITECTURE.md and AI_AGENTS.md.

---

## 1. Request Lifecycle (API Layer)

```
HTTP Request
    │
    ▼
Helmet (security headers)
    │
    ▼
Rate Limiter (Redis — 100 req/min per IP)
    │
    ▼
Logger Middleware (assigns traceId, logs request)
    │
    ▼
JWT Auth Guard (validates access token, injects user context)
    │
    ▼
Roles Guard (checks UserRole against @Roles() decorator)
    │
    ▼
Zod Validation Pipe (validates body/params against schema)
    │
    ▼
Controller (routes to service)
    │
    ▼
Service (business logic)
    │  ├─► Prisma (PostgreSQL — primary data)
    │  ├─► Redis (cache / pub-sub / rate limits)
    │  ├─► Elasticsearch (search index)
    │  ├─► S3/MinIO (document storage)
    │  ├─► AiService (Claude — structured output)
    │  └─► BullMQ (async jobs)
    │
    ▼
Audit Service (appends audit_log row — non-blocking)
    │
    ▼
HTTP Exception Filter (formats errors: { code, message, traceId })
    │
    ▼
JSON Response
```

---

## 2. Data Store Responsibilities

| Store | What it holds | Access pattern |
|-------|--------------|----------------|
| **PostgreSQL** | All primary records (orgs, users, deals, compliance, audit_log) | Read-write, transactional |
| **Redis** | JWT refresh token allow-list, rate limit counters, WebSocket pub/sub, BullMQ queue, price feed cache | Fast read-write, TTL |
| **Elasticsearch** | Active listings index (mineralId, grade, price, location, trustScore) | Write on listing change, read on search |
| **MongoDB** | Deal documents (contracts, amendments, uploaded files metadata) | Document store for semi-structured deal artifacts |
| **S3 / MinIO** | Compliance documents (PDFs, images), contract PDFs, evidence vault files | Write-once on upload, read by presigned URL |

---

## 3. PII Data Flow

```
User Input (Aadhaar, PAN, GSTIN, phone, bank account)
    │
    ▼
[API boundary] — never log, never pass raw to AI
    │
    ▼
Zod validation (format check only, not stored raw)
    │
    ▼
FieldEncryption.encrypt(value, orgId)  ← packages/types/src/encryption.ts
    │  AES-256-GCM, key derived from PII_ENCRYPTION_KEY + orgId
    │
    ▼
Encrypted ciphertext stored in PostgreSQL
    │
    ▼
[On read] FieldEncryption.decrypt() → raw value available only in:
    │  - Compliance verification service (admin verifying)
    │  - KYC provider (during eKYC call)
    │  - Export for regulatory reporting (REGULATOR_READONLY, masked)
    │
    ▼
[API response] Always masked:
    │  GSTIN → "**EFGH****" (first 2 + last 2 visible)
    │  Aadhaar → "XXXX XXXX 1234"
    │  PAN → "XXXXX1234X"
    └  Phone → "+91 XXXXX 12345"
```

### PII Never Goes To:
- AI prompts (stripped before any Claude call)
- Plaintext audit_log entries
- Elasticsearch index
- BullMQ job payloads
- Push notification content

---

## 4. Money Data Flow

```
Price input from user (string or number)
    │
    ▼
[Validation] Money.fromRupees(string) → BigInt in paise
    │  Rejects floats, rejects > MAX_SAFE_VALUE
    │
    ▼
Stored as BIGINT in PostgreSQL (askPriceInPaise, totalValuePaise, amountPaise)
    │
    ▼
[Service layer] All arithmetic uses BigInt operations only
    │  Never cast to Number or float
    │
    ▼
[API response] Money.toDisplayString(paise) → "₹ 62,500.00"
    │  Formatted for display only, never stored as float
    │
    ▼
[Escrow] EscrowLedger entries (HELD → RELEASED or REFUNDED)
    │  Balance = Σ HELD - Σ RELEASED - Σ REFUNDED
    │  Computed on read, never cached as running balance
    └  Every entry is immutable (no UPDATE on escrow_ledger)
```

---

## 5. Compliance Data Flow

```
Admin uploads / verifies a document
    │
    ▼
ComplianceItem updated (status → VERIFIED, validFrom, validUntil set)
    │
    ▼
TrustScoreCalculator.compute(orgId)  ← sync call
    │  Fetches all ComplianceItems for org
    │  Applies weight × status × decay formula
    │  Returns score 0–100 with breakdown JSON
    │
    ▼
ComplianceSnapshot appended (NEVER UPDATE existing snapshot)
    │  { orgId, trustScore, breakdown, triggeredBy, createdAt }
    │
    ▼
[If all required items VERIFIED] → org.status = VERIFIED
    │  Unlocks: listing creation, deal signing
    │
    ▼
[Nightly sweep — BullMQ cron]
    │  ExpiryWeepScheduler fires at 02:00 IST
    │  Marks items with validUntil < now() as EXPIRED
    │  Recalculates TrustScore for affected orgs
    └  Appends new ComplianceSnapshot with triggeredBy="nightly_sweep"
```

---

## 6. Search & Discovery Data Flow

```
Buyer sends natural-language query
    │
    ▼
POST /discovery/search { query: "62% Fe iron ore, 5000 MT, Rajasthan" }
    │
    ▼
AiService → SearchIntentParser agent
    │  Returns: { mineralName, gradeConstraints, quantityMT, state, ... }
    │  Zod-validated
    │
    ▼
ElasticsearchService.searchListings(parsedIntent)
    │  Query: mineral + grade range filter + state filter
    │  Boost: trustScore field (higher TrustScore → higher ranking)
    │  Filter: status=ACTIVE, sellerOrg.status=VERIFIED
    │
    ▼
Results from Elasticsearch (listing IDs + scores)
    │
    ▼
Prisma fetch: enrich with org names, TrustScore, price, location
    │  (Elasticsearch holds enough for ranking; Postgres has full detail)
    │
    ▼
RankingService.rank(results, intent)
    │  Final score = (esScore × 0.4) + (trustScore × 0.4) + (priceScore × 0.2)
    │
    ▼
Response: ranked listings (seller masked: org name only, no PII)
```

---

## 7. Real-time Deal Room Data Flow

```
User sends message in deal room
    │
    ▼
WebSocket → NestJS Gateway
    │
    ▼
DealService.addMessage(dealId, { senderType, content })
    │  Validates: sender belongs to this deal
    │  Saves: DealMessage to PostgreSQL
    │
    ▼
Redis pub/sub: PUBLISH deal:{dealId}:messages { ... }
    │
    ▼
All connected WebSocket clients subscribed to deal:{dealId}:messages
    │  Receive: { dealId, senderType, content, createdAt }
    │
    ▼
[If message starts with /ai] → Deal Co-Pilot agent
    │  AiService call with deal context
    │  Response saved as DealMessage (senderType=AI)
    │  Redis publish → all clients see AI response
    └
```

---

## 8. Audit Log Data Flow

```
Any state-changing action in any service
    │
    ▼
AuditService.log({
    actor,          // userId or "system"
    actorOrgId,
    action,         // "listing.created", "deal.status_changed", etc.
    entityType,     // "Listing", "Deal", etc.
    entityId,
    before,         // optional: serialised before-state
    after,          // optional: serialised after-state
    ip,             // from request context
    traceId,        // from AsyncLocalStorage
})
    │
    ▼
SHA-256 hash of before/after JSON → beforeHash, afterHash
    │
    ▼
INSERT INTO audit_log (immutable row) — never UPDATE or DELETE
    │
    ▼
[Optional] AuditAnchor.anchor(rowId) — no-op in MVP
    │  Interface ready for blockchain anchoring in V2
    │
    ▼
[Regulator view] Read-only query on audit_log
    │  Filters: entityType, dateRange, action prefix
    └  PII columns never returned; all masked at query layer
```

---

## 9. Background Job Data Flow (BullMQ)

```
Triggering event → BullMQ Producer (adds job to Redis queue)
    │
    ├─► NOTIFICATION queue
    │     │  Job: { eventType, recipientIds, context }
    │     └─► NotificationProcessor:
    │           AiService generates push/email content
    │           Push via FCM/APNS (stub in MVP)
    │           Email via SMTP (real in MVP)
    │
    ├─► EXPIRY_SWEEP queue (cron: 02:00 IST)
    │     │  Job: { triggeredAt }
    │     └─► ExpirySweepProcessor:
    │           Queries ComplianceItems where validUntil < now() AND status=VERIFIED
    │           Updates status → EXPIRED (batch)
    │           Recalculates TrustScore for each affected org
    │           Appends ComplianceSnapshot
    │
    ├─► LISTING_INDEX queue
    │     │  Job: { listingId, action: 'upsert' | 'delete' }
    │     └─► ListingIndexProcessor:
    │           Fetches listing + org trustScore from Postgres
    │           Upserts/deletes from Elasticsearch index
    │
    └─► DEAL_MILESTONE_SWEEP queue (cron: 08:00 IST)
          │  Job: { triggeredAt }
          └─► MilestoneSweepProcessor:
                Queries DealMilestones where dueDate < now() AND status=PENDING
                Updates status → OVERDUE
                Queues NOTIFICATION job for both parties
```

---

## 10. Document Upload Data Flow

```
User selects document → POST /compliance/:orgId/items/:type/upload
    │
    ▼
Multer middleware (in-memory buffer, max 10MB, allowed types: PDF, JPEG, PNG)
    │
    ▼
[MVP] VirusScan stub (interface ready for ClamAV or cloud AV)
    │
    ▼
StorageService.upload(buffer, key)
    │  key: compliance/{orgId}/{type}/{timestamp}.{ext}
    │  Returns: S3 presigned URL (read access, 24h TTL for admin review)
    │
    ▼
ComplianceItem updated: documentRef = S3 key, status = UPLOADED, uploadedAt = now()
    │
    ▼
AuditLog: compliance_item.uploaded
    │
    ▼
[Optional MVP] DocumentAiService.extract(ocrText, documentType)
    │  SandboxDocumentAiProvider returns seeded fixture data
    │  Real OCR: Google Document AI or AWS Textract (V2)
    │
    ▼
Admin notification queued (BullMQ → NOTIFICATION queue)
```

---

## 11. Token Rotation Data Flow

```
Login
    │
    ▼
AuthService.login() → { accessToken (15m), refreshToken (7d) }
    │  refreshToken stored as SHA-256(token) in refresh_tokens table
    │  deviceFingerprint saved for anomaly detection
    │
    ▼
Client stores: accessToken in memory, refreshToken in httpOnly cookie
    │
    ▼
[Access token expires] → POST /auth/refresh { refreshToken }
    │
    ▼
AuthService.refresh():
    │  1. Validate token not expired
    │  2. Look up SHA-256(token) in refresh_tokens
    │  3. Check isRevoked=false
    │  4. Issue new { accessToken, refreshToken }
    │  5. Mark old token isRevoked=true, replacedById=newTokenId
    │
    ▼
[Refresh token reuse detected] (old token used after rotation)
    │  Entire token family revoked → force re-login
    └  AuditLog: auth.token_reuse_detected (HIGH severity)
```

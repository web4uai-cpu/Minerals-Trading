# Data Dictionary — Khanij Nexus

> Every persistent field in the system. Source of truth: `apps/api/prisma/schema.prisma`.

## Organizations (`organizations`)

| Field | Type | Constraints | PII | Domain |
|-------|------|-------------|-----|--------|
| id | CUID | PK | No | identity |
| type | OrgType enum | NOT NULL | No | identity |
| legalName | String | NOT NULL | No | identity |
| gstin | String? | AES-256-GCM encrypted | **Yes** | compliance |
| pan | String? | AES-256-GCM encrypted | **Yes** | compliance |
| state | String | NOT NULL | No | identity |
| status | OrgStatus enum | DEFAULT PENDING | No | compliance |
| createdAt | DateTime | DEFAULT now() | No | identity |
| updatedAt | DateTime | Auto-updated | No | identity |

## Users (`users`)

| Field | Type | Constraints | PII | Domain |
|-------|------|-------------|-----|--------|
| id | CUID | PK | No | identity |
| orgId | String | FK → organizations, indexed | No | identity |
| email | String | UNIQUE, NOT NULL | Personal | identity |
| phone | String? | AES-256-GCM encrypted | **Yes** | identity |
| passwordHash | String | Argon2id | No | identity |
| role | UserRole enum | NOT NULL | No | identity |
| status | UserStatus enum | DEFAULT ACTIVE | No | identity |
| lastLoginAt | DateTime? | | No | identity |
| createdAt | DateTime | DEFAULT now() | No | identity |
| updatedAt | DateTime | Auto-updated | No | identity |

## Refresh Tokens (`refresh_tokens`)

| Field | Type | Constraints | PII | Domain |
|-------|------|-------------|-----|--------|
| id | CUID | PK | No | identity |
| userId | String | FK → users, indexed | No | identity |
| orgId | String | FK → organizations | No | identity |
| tokenHash | String | UNIQUE, SHA-256 | No | identity |
| deviceFingerprint | String? | | No | identity |
| isRevoked | Boolean | DEFAULT false | No | identity |
| expiresAt | DateTime | NOT NULL | No | identity |
| replacedById | String? | Rotation chain | No | identity |
| createdAt | DateTime | DEFAULT now() | No | identity |

## Audit Log (`audit_log`)

| Field | Type | Constraints | PII | Domain |
|-------|------|-------------|-----|--------|
| id | CUID | PK | No | governance |
| actor | String | NOT NULL, indexed | No | governance |
| actorOrgId | String? | | No | governance |
| action | String | NOT NULL (e.g. "listing.created") | No | governance |
| entityType | String? | Indexed with entityId | No | governance |
| entityId | String? | Indexed with entityType | No | governance |
| beforeHash | String? | SHA-256 | No | governance |
| afterHash | String? | SHA-256 | No | governance |
| ip | String? | | No | governance |
| traceId | String? | | No | governance |
| createdAt | DateTime | DEFAULT now(), indexed | No | governance |

**Rules:** Append-only. No UPDATE or DELETE. DB trigger enforced.

## Compliance Items (`compliance_items`)

| Field | Type | Constraints | PII | Domain |
|-------|------|-------------|-----|--------|
| id | CUID | PK | No | compliance |
| orgId | String | FK, indexed, UNIQUE(orgId,type) | No | compliance |
| type | ComplianceItemType | 12 enum values | No | compliance |
| status | ComplianceItemStatus | DEFAULT MISSING, indexed | No | compliance |
| documentRef | String? | S3 key | No | compliance |
| validFrom | DateTime? | | No | compliance |
| validUntil | DateTime? | Used in expiry sweep | No | compliance |
| verifiedBy | String? | userId of admin | No | compliance |
| verifiedAt | DateTime? | | No | compliance |
| rejectionNote | String? | | No | compliance |
| uploadedAt | DateTime? | | No | compliance |
| createdAt | DateTime | DEFAULT now() | No | compliance |
| updatedAt | DateTime | Auto-updated | No | compliance |

## Compliance Snapshots (`compliance_snapshots`)

| Field | Type | Constraints | PII | Domain |
|-------|------|-------------|-----|--------|
| id | CUID | PK | No | compliance |
| orgId | String | FK, indexed with createdAt | No | compliance |
| trustScore | Int | 0–100 | No | compliance |
| breakdown | Json | Per-item weights and status | No | compliance |
| triggeredBy | String | upload/verify/reject/expire/nightly_sweep | No | compliance |
| createdAt | DateTime | DEFAULT now() | No | compliance |

**Rules:** Append-only. Never overwrite.

## Minerals (`minerals`)

| Field | Type | Constraints | PII | Domain |
|-------|------|-------------|-----|--------|
| id | UUID | PK | No | marketplace |
| name | String | UNIQUE | No | marketplace |
| category | String | Metallic/Non-Metallic/Minor | No | marketplace |
| hsnCode | String? | HSN tariff code | No | marketplace |
| defaultUnit | String | DEFAULT "MT" | No | marketplace |
| gradeParams | Json | `{ "Fe%": { min, max, unit } }` | No | marketplace |
| createdAt | DateTime | DEFAULT now() | No | marketplace |
| updatedAt | DateTime | Auto-updated | No | marketplace |

## Listings (`listings`)

| Field | Type | Constraints | PII | Domain |
|-------|------|-------------|-----|--------|
| id | UUID | PK | No | marketplace |
| sellerOrgId | String | FK, indexed | No | marketplace |
| mineralId | String | FK, indexed | No | marketplace |
| grade | Json | `{ "Fe%": 62.5 }` | No | marketplace |
| quantityAvailable | Decimal(12,2) | | No | marketplace |
| unit | String | DEFAULT "MT" | No | marketplace |
| askPriceInPaise | BigInt | **Money field** | No | marketplace |
| location | Json | `{ district, state, lat?, lng? }` | No | marketplace |
| dispatchLeadDays | Int | | No | marketplace |
| status | ListingStatus | DEFAULT DRAFT, indexed | No | marketplace |
| createdAt | DateTime | DEFAULT now() | No | marketplace |
| updatedAt | DateTime | Auto-updated | No | marketplace |

## RFQs (`rfqs`)

| Field | Type | Constraints | PII | Domain |
|-------|------|-------------|-----|--------|
| id | UUID | PK | No | deals |
| buyerOrgId | String | FK, indexed | No | deals |
| listingId | String? | Optional FK | No | deals |
| mineralId | String | FK, indexed | No | deals |
| grade | Json | Required grade spec | No | deals |
| quantity | Decimal(12,2) | | No | deals |
| unit | String | DEFAULT "MT" | No | deals |
| neededBy | DateTime | | No | deals |
| notes | String? | | No | deals |
| status | RfqStatus | DEFAULT OPEN, indexed | No | deals |
| createdAt | DateTime | DEFAULT now() | No | deals |
| updatedAt | DateTime | Auto-updated | No | deals |

## Quotes (`quotes`)

| Field | Type | Constraints | PII | Domain |
|-------|------|-------------|-----|--------|
| id | UUID | PK | No | deals |
| rfqId | String | FK, indexed | No | deals |
| sellerOrgId | String | FK, indexed | No | deals |
| pricePerUnitPaise | BigInt | **Money field** | No | deals |
| validUntil | DateTime | | No | deals |
| terms | Json? | Arbitrary terms | No | deals |
| status | QuoteStatus | DEFAULT SENT, indexed | No | deals |
| createdAt | DateTime | DEFAULT now() | No | deals |
| updatedAt | DateTime | Auto-updated | No | deals |

## Deals (`deals`)

| Field | Type | Constraints | PII | Domain |
|-------|------|-------------|-----|--------|
| id | UUID | PK | No | deals |
| buyerOrgId | String | FK, indexed | No | deals |
| sellerOrgId | String | FK, indexed | No | deals |
| quoteId | String | FK, indexed | No | deals |
| mineralId | String | FK | No | deals |
| grade | Json | | No | deals |
| quantity | Decimal(12,2) | | No | deals |
| unit | String | DEFAULT "MT" | No | deals |
| totalValuePaise | BigInt | **Money field** | No | deals |
| arbitrationSeat | String? | Jurisdiction city/state | No | deals |
| status | DealStatus | DEFAULT CREATED, indexed | No | deals |
| createdAt | DateTime | DEFAULT now() | No | deals |
| updatedAt | DateTime | Auto-updated | No | deals |

## Deal Milestones (`deal_milestones`)

| Field | Type | Constraints | PII | Domain |
|-------|------|-------------|-----|--------|
| id | UUID | PK | No | deals |
| dealId | String | FK, indexed, UNIQUE(dealId,type) | No | deals |
| type | MilestoneType | 6 enum values | No | deals |
| sequence | Int | 1–6 ordering | No | deals |
| dueDate | DateTime? | | No | deals |
| status | MilestoneStatus | DEFAULT PENDING | No | deals |
| completedAt | DateTime? | | No | deals |
| createdAt | DateTime | DEFAULT now() | No | deals |
| updatedAt | DateTime | Auto-updated | No | deals |

## Escrow Ledger (`escrow_ledger`)

| Field | Type | Constraints | PII | Domain |
|-------|------|-------------|-----|--------|
| id | UUID | PK | No | finance |
| dealId | String | FK, indexed | No | finance |
| type | EscrowEntryType | HELD/RELEASED/REFUNDED | No | finance |
| amountPaise | BigInt | **Money field** | No | finance |
| txnRef | String | PaymentProvider reference | No | finance |
| note | String? | | No | finance |
| createdAt | DateTime | DEFAULT now() | No | finance |

**Rules:** Append-only. Balance = Σ HELD - Σ RELEASED - Σ REFUNDED.

## Deal Messages (`deal_messages`)

| Field | Type | Constraints | PII | Domain |
|-------|------|-------------|-----|--------|
| id | UUID | PK | No | deals |
| dealId | String | FK, indexed with createdAt | No | deals |
| senderType | MessageSenderType | BUYER/SELLER/AI | No | deals |
| senderOrgId | String? | NULL for AI messages | No | deals |
| senderUserId | String? | | No | deals |
| content | String | | No | deals |
| createdAt | DateTime | DEFAULT now() | No | deals |

## Future Entities (Not Yet in Schema)

| Entity | Domain | Phase | Notes |
|--------|--------|-------|-------|
| Auction | bidding | 5 | Auction listing with rules, status, timing |
| Bid | bidding | 5 | Individual bid entry in an auction |
| Dispute | arbitration | 9 | Filed dispute with category, status, evidence |
| Evidence | arbitration | 9 | Document/testimony submitted for dispute |
| Award | arbitration | 9 | Arbitrator's binding decision |
| Shipment | logistics | 8 | Tracking entity for dispatched goods |
| Invoice | finance | 7 | Generated invoice with GST calculation |
| AuditAnchor | blockchain | 10 | Blockchain hash anchor record |

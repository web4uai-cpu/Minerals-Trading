# Entity Registry — Khanij Nexus

> Master list of all domain entities. Check here before creating new models.

## Existing Entities (16 Prisma Models)

### Identity Domain
| Entity | Table | Owner | Relationships |
|--------|-------|-------|---------------|
| **Organization** | `organizations` | identity | → Users, ComplianceItems, Listings, Rfqs, Quotes, Deals |
| **User** | `users` | identity | → Organization, RefreshTokens |
| **RefreshToken** | `refresh_tokens` | identity | → User, Organization |
| **AuditLog** | `audit_log` | governance | Standalone (append-only) |

### Compliance Domain
| Entity | Table | Owner | Relationships |
|--------|-------|-------|---------------|
| **ComplianceItem** | `compliance_items` | compliance | → Organization |
| **ComplianceSnapshot** | `compliance_snapshots` | compliance | → Organization (append-only) |

### Marketplace Domain
| Entity | Table | Owner | Relationships |
|--------|-------|-------|---------------|
| **Mineral** | `minerals` | marketplace | → Listings, Rfqs |
| **Listing** | `listings` | marketplace | → Organization (seller), Mineral |

### Deals Domain
| Entity | Table | Owner | Relationships |
|--------|-------|-------|---------------|
| **Rfq** | `rfqs` | deals | → Organization (buyer), Mineral, Quotes |
| **Quote** | `quotes` | deals | → Rfq, Organization (seller), Deals |
| **Deal** | `deals` | deals | → Organization (buyer+seller), Quote, Milestones, EscrowLedger, Messages |
| **DealMilestone** | `deal_milestones` | deals | → Deal |
| **DealMessage** | `deal_messages` | deals | → Deal |

### Finance Domain
| Entity | Table | Owner | Relationships |
|--------|-------|-------|---------------|
| **EscrowLedger** | `escrow_ledger` | finance | → Deal (append-only) |

## Planned Entities (Not Yet in Schema)

### Bidding Domain (Phase 5)
| Entity | Owner | Description |
|--------|-------|-------------|
| **Auction** | bidding | Auction listing: mineral, rules, open/close times, status |
| **Bid** | bidding | Individual bid: auctionId, bidderOrgId, amountPaise, timestamp |

### Arbitration Domain (Phase 9)
| Entity | Owner | Description |
|--------|-------|-------------|
| **Dispute** | arbitration | Filed dispute: dealId, category, status, filedBy, filedAt |
| **Evidence** | arbitration | Submitted document/testimony: disputeId, type, S3 ref |
| **Award** | arbitration | Arbitrator decision: disputeId, decision JSON, rationale |

### Logistics Domain (Phase 8)
| Entity | Owner | Description |
|--------|-------|-------------|
| **Shipment** | logistics | Tracking: dealId, status, carrier, tracking events |
| **DeliveryProof** | logistics | Proof of delivery: shipmentId, S3 ref, confirmedBy |

### Finance Domain (Phase 7)
| Entity | Owner | Description |
|--------|-------|-------------|
| **Invoice** | finance | Generated invoice: dealId, line items, GST, total |

### Blockchain Domain (Phase 10)
| Entity | Owner | Description |
|--------|-------|-------------|
| **AuditAnchor** | blockchain | Hash anchor: auditLogId, chainId, txHash, anchoredAt |

## Rules

1. **Check this registry before adding a model** — if a similar entity exists, extend it.
2. **Every new entity must have an owning domain** — no orphan models.
3. **Update this file when adding to schema.prisma** — keep in sync.
4. **PII fields marked in DATA_DICTIONARY.md** — cross-reference before adding sensitive fields.

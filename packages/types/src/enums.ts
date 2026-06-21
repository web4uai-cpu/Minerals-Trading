/**
 * Shared enums — single source of truth.
 * Used by both client and server. Never duplicate these.
 */

/** Organization types on the platform. */
export enum OrgType {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
  TRADER = 'TRADER',
  EXPORTER = 'EXPORTER',
  ARBITRATION_BODY = 'ARBITRATION_BODY',
}

/** Organization verification status. */
export enum OrgStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  SUSPENDED = 'SUSPENDED',
}

/** User roles for RBAC. */
export enum UserRole {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
  ARBITRATOR = 'ARBITRATOR',
  ADMIN = 'ADMIN',
  REGULATOR_READONLY = 'REGULATOR_READONLY',
}

/** User account status. */
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATED = 'DEACTIVATED',
}

/** Compliance item types (documents/attestations required for verification). */
export enum ComplianceItemType {
  MINING_LEASE = 'MINING_LEASE',
  ENV_CLEARANCE = 'ENV_CLEARANCE',
  FOREST_CLEARANCE = 'FOREST_CLEARANCE',
  IBM_RETURNS = 'IBM_RETURNS',
  ROYALTY_CLEARANCE = 'ROYALTY_CLEARANCE',
  SPCB_NOC = 'SPCB_NOC',
  GST_REG = 'GST_REG',
  PAN = 'PAN',
  BANK_VERIFICATION = 'BANK_VERIFICATION',
  IEC = 'IEC',
  END_USE_DECLARATION = 'END_USE_DECLARATION',
  INDUSTRY_REGISTRATION = 'INDUSTRY_REGISTRATION',
}

/** Compliance item verification status — follows the state machine in SKILL.md. */
export enum ComplianceItemStatus {
  MISSING = 'MISSING',
  UPLOADED = 'UPLOADED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

/** Listing status. */
export enum ListingStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  SOLD_OUT = 'SOLD_OUT',
}

/** RFQ status. */
export enum RfqStatus {
  OPEN = 'OPEN',
  QUOTED = 'QUOTED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

/** Quote status. */
export enum QuoteStatus {
  SENT = 'SENT',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

/** Deal state machine — strict transitions defined in SKILLs.md. */
export enum DealStatus {
  CREATED = 'CREATED',
  AGREEMENT_DRAFT = 'AGREEMENT_DRAFT',
  SIGNED = 'SIGNED',
  ESCROW_PENDING = 'ESCROW_PENDING',
  IN_FULFILMENT = 'IN_FULFILMENT',
  COMPLETED = 'COMPLETED',
  DISPUTED = 'DISPUTED',
  CANCELLED = 'CANCELLED',
}

/** Deal milestone types. */
export enum MilestoneType {
  AGREEMENT = 'AGREEMENT',
  ESCROW = 'ESCROW',
  SAMPLING = 'SAMPLING',
  DISPATCH = 'DISPATCH',
  DELIVERY = 'DELIVERY',
  PAYMENT = 'PAYMENT',
}

/** Milestone status. */
export enum MilestoneStatus {
  PENDING = 'PENDING',
  DONE = 'DONE',
  OVERDUE = 'OVERDUE',
}

/** Escrow ledger entry type. */
export enum EscrowEntryType {
  HELD = 'HELD',
  RELEASED = 'RELEASED',
  REFUNDED = 'REFUNDED',
}

/** Dispute category. */
export enum DisputeCategory {
  QUALITY = 'QUALITY',
  QUANTITY = 'QUANTITY',
  PAYMENT = 'PAYMENT',
  DELIVERY = 'DELIVERY',
  OTHER = 'OTHER',
}

/** Dispute status. */
export enum DisputeStatus {
  FILED = 'FILED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  HEARING = 'HEARING',
  AWARD_ISSUED = 'AWARD_ISSUED',
  CLOSED = 'CLOSED',
  WITHDRAWN = 'WITHDRAWN',
}

/** Auction status. */
export enum AuctionStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
  AWARDED = 'AWARDED',
}

/** Auction type — forward (seller auctions) or reverse (buyer auctions). */
export enum AuctionType {
  FORWARD = 'FORWARD',
  REVERSE = 'REVERSE',
}

/** Deal room message sender type. */
export enum MessageSenderType {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
  AI = 'AI',
}

/** Invoice status. */
export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  CANCELLED = 'CANCELLED',
}

/** Shipment status — lifecycle of a physical goods movement. */
export enum ShipmentStatus {
  CREATED = 'CREATED',
  DISPATCHED = 'DISPATCHED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

/** Tracking event type for shipment updates. */
export enum TrackingEventType {
  PICKUP = 'PICKUP',
  CHECKPOINT = 'CHECKPOINT',
  CUSTOMS = 'CUSTOMS',
  EXCEPTION = 'EXCEPTION',
  DELIVERED = 'DELIVERED',
  WEIGHT_VERIFIED = 'WEIGHT_VERIFIED',
}

/** Trade direction for international transactions. */
export enum TradeDirection {
  EXPORT = 'EXPORT',
  IMPORT = 'IMPORT',
}

/** Export clearance status. */
export enum ExportClearanceStatus {
  PENDING = 'PENDING',
  APPLIED = 'APPLIED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

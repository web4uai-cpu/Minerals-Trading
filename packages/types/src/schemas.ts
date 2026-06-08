import { z } from 'zod';
import { OrgType, UserRole, DisputeCategory, ComplianceItemType, ComplianceItemStatus } from './enums';

// ─── JWT ────────────────────────────────────────────────────────

export const JwtPayloadSchema = z.object({
  sub: z.string().cuid(),
  orgId: z.string().cuid(),
  role: z.nativeEnum(UserRole),
  email: z.string().email(),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

// ─── Auth ───────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  legalName: z.string().min(2).max(255),
  orgType: z.nativeEnum(OrgType),
  state: z.string().min(2).max(100),
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number'),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RefreshInput = z.infer<typeof RefreshSchema>;

// ─── Organization ───────────────────────────────────────────────

export const CreateOrgSchema = z.object({
  legalName: z.string().min(2).max(255),
  type: z.nativeEnum(OrgType),
  state: z.string().min(2).max(100),
  gstin: z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}[Z]{1}[A-Z\d]{1}$/).optional(),
  pan: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]{1}$/).optional(),
});

export type CreateOrgInput = z.infer<typeof CreateOrgSchema>;

// ─── Listing ────────────────────────────────────────────────────

export const CreateListingSchema = z.object({
  mineralId: z.string().uuid(),
  grade: z.record(z.string(), z.number()).describe('Grade attributes matching mineral gradeParams'),
  quantityAvailable: z.number().positive(),
  unit: z.enum(['MT', 'KG']),
  askPriceInPaise: z.number().int().positive(),
  location: z.object({
    district: z.string().min(1),
    state: z.string().min(1),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  }),
  dispatchLeadDays: z.number().int().positive(),
});

export type CreateListingInput = z.infer<typeof CreateListingSchema>;

export const UpdateListingSchema = z.object({
  grade: z.record(z.string(), z.number()).optional(),
  quantityAvailable: z.number().positive().optional(),
  unit: z.enum(['MT', 'KG']).optional(),
  askPriceInPaise: z.number().int().positive().optional(),
  location: z.object({
    district: z.string().min(1),
    state: z.string().min(1),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  }).optional(),
  dispatchLeadDays: z.number().int().positive().optional(),
});

export type UpdateListingInput = z.infer<typeof UpdateListingSchema>;

// ─── Discovery ──────────────────────────────────────────────────

export const SearchQuerySchema = z.object({
  query: z.string().min(1).max(1000),
  filters: z
    .object({
      mineralId: z.string().uuid().optional(),
      state: z.string().optional(),
      maxPriceInPaise: z.number().int().positive().optional(),
      minTrustScore: z.number().min(0).max(100).optional(),
    })
    .optional(),
});

export type SearchQueryInput = z.infer<typeof SearchQuerySchema>;

/** AI-parsed search intent (Zod-validated output from Claude). */
export const SearchIntentSchema = z.object({
  mineralId: z.string().uuid().nullable(),
  mineralName: z.string().nullable(),
  gradeMin: z.record(z.string(), z.number()).optional(),
  gradeMax: z.record(z.string(), z.number()).optional(),
  quantity: z.number().positive().nullable(),
  unit: z.enum(['MT', 'KG']).nullable(),
  state: z.string().nullable(),
  neededBy: z.string().datetime().nullable(),
});

export type SearchIntent = z.infer<typeof SearchIntentSchema>;

/** Reference price band from the PriceFeedProvider. */
export interface ReferencePriceResponse {
  mineralId: string;
  grade: Record<string, number>;
  state: string;
  fairLow: number;
  fairHigh: number;
  refPrice: number;
  source: string;
  asOf: string;
}

/** A single match in discovery results — includes ranking breakdown for transparency. */
export interface DiscoveryMatch {
  listing: {
    id: string;
    mineralId: string;
    mineralName: string;
    grade: Record<string, number>;
    quantityAvailable: number;
    unit: string;
    askPriceInPaise: number;
    location: { district: string; state: string; lat?: number; lng?: number };
    dispatchLeadDays: number;
    sellerOrgId: string;
    sellerLegalName: string;
  };
  score: number;
  breakdown: {
    trustScore: { raw: number; weighted: number };
    priceVsFairBand: { raw: number; weighted: number };
    proximity: { raw: number; weighted: number };
    dispatchLeadDays: { raw: number; weighted: number };
    dealHistory: { raw: number; weighted: number };
  };
  fairPriceBand: { fairLow: number; fairHigh: number; refPrice: number };
  sellerTrustScore: number;
}

/** Full discovery search response. */
export interface DiscoverySearchResponse {
  parsedIntent: SearchIntent | null;
  matches: DiscoveryMatch[];
  fairPriceBand: ReferencePriceResponse | null;
  totalMatches: number;
}

// ─── RFQ / Quote ────────────────────────────────────────────────

export const CreateRfqSchema = z.object({
  listingId: z.string().uuid().optional(),
  mineralId: z.string().uuid(),
  grade: z.record(z.string(), z.number()),
  quantity: z.number().positive(),
  unit: z.enum(['MT', 'KG']),
  neededBy: z.string().datetime(),
  notes: z.string().max(2000).optional(),
});

export type CreateRfqInput = z.infer<typeof CreateRfqSchema>;

export const CreateQuoteSchema = z.object({
  rfqId: z.string().uuid(),
  pricePerUnitPaise: z.number().int().positive(),
  validUntil: z.string().datetime(),
  terms: z.record(z.string(), z.unknown()).optional(),
});

export type CreateQuoteInput = z.infer<typeof CreateQuoteSchema>;

// ─── Dispute ────────────────────────────────────────────────────

export const FileDisputeSchema = z.object({
  dealId: z.string().uuid(),
  category: z.nativeEnum(DisputeCategory),
  description: z.string().min(10).max(5000),
});

export type FileDisputeInput = z.infer<typeof FileDisputeSchema>;

// ─── Common response envelope ───────────────────────────────────

export const ErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  traceId: z.string(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ─── Idempotency ────────────────────────────────────────────────

export const IdempotencyKeyHeader = 'idempotency-key';

// ─── Compliance ─────────────────────────────────────────────────

/** Register a compliance item after uploading a document to S3. */
export const RegisterComplianceItemSchema = z.object({
  type: z.nativeEnum(ComplianceItemType),
  documentRef: z.string().min(1).max(1024),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
});

export type RegisterComplianceItemInput = z.infer<typeof RegisterComplianceItemSchema>;

/** Admin verification or rejection of a compliance item. */
export const VerifyComplianceItemSchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED']),
  rejectionNote: z.string().max(1000).optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
});

export type VerifyComplianceItemInput = z.infer<typeof VerifyComplianceItemSchema>;

/** Request a presigned S3 upload URL for a compliance document. */
export const PresignedUploadRequestSchema = z.object({
  itemType: z.nativeEnum(ComplianceItemType),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(128),
});

export type PresignedUploadRequestInput = z.infer<typeof PresignedUploadRequestSchema>;

/** TrustScore breakdown per compliance item (stored in ComplianceSnapshot.breakdown). */
export const TrustScoreBreakdownItemSchema = z.object({
  itemType: z.nativeEnum(ComplianceItemType),
  weight: z.number(),
  status: z.nativeEnum(ComplianceItemStatus),
  effectiveWeight: z.number(),
  decayFactor: z.number().min(0).max(1),
});

export type TrustScoreBreakdownItem = z.infer<typeof TrustScoreBreakdownItemSchema>;

/** The compliance profile returned by GET /compliance/profile. */
export interface ComplianceProfileResponse {
  orgId: string;
  trustScore: number;
  breakdown: TrustScoreBreakdownItem[];
  items: {
    id: string;
    type: ComplianceItemType;
    status: ComplianceItemStatus;
    documentRef: string | null;
    validFrom: string | null;
    validUntil: string | null;
    verifiedAt: string | null;
    rejectionNote: string | null;
    uploadedAt: string | null;
  }[];
  history: {
    trustScore: number;
    triggeredBy: string;
    createdAt: string;
  }[];
}

/** Onboarding checklist item returned by GET /onboarding/checklist. */
export interface OnboardingChecklistItem {
  type: ComplianceItemType;
  label: string;
  required: boolean;
  status: ComplianceItemStatus;
  documentRef: string | null;
}

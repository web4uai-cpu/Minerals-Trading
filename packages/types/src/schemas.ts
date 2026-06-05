import { z } from 'zod';
import { OrgType, DisputeCategory } from './enums';

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

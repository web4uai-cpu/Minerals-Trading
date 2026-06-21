# Security Standard — Khanij Nexus

## PII Classification

| Field | Classification | Handling |
|-------|---------------|----------|
| Aadhaar number | **Critical PII** | AES-256-GCM encrypted, never logged, never indexed, never sent to AI |
| PAN | **Critical PII** | AES-256-GCM encrypted, never logged, masked in responses |
| Bank account + IFSC | **Critical PII** | AES-256-GCM encrypted, never logged, masked in responses |
| GSTIN | **Sensitive PII** | AES-256-GCM encrypted, never logged, masked in list views |
| Phone number | **Sensitive PII** | AES-256-GCM encrypted, never logged |
| Email | **Personal data** | Stored plaintext (needed for login), never sent to AI prompts |
| Legal name | **Business data** | Stored plaintext, indexable |

## Encryption

- Algorithm: **AES-256-GCM** with random 16-byte IV per encryption.
- Key: 32-byte key from `ENCRYPTION_KEY` environment variable.
- Format: `base64(IV + ciphertext + authTag)`.
- Implementation: `FieldEncryption` class in `@khanij/types`.
- Non-deterministic — same plaintext produces different ciphertext each time.

## Never Log PII

- Structured logs (pino) must never contain decrypted PII values.
- Request logging middleware must strip or mask sensitive fields before logging.
- Error messages must not include PII — use entity IDs only.

## Never Send PII to AI

- AI prompts must not contain Aadhaar, PAN, bank details, or phone numbers.
- Strip PII from user-supplied strings before including in any prompt.
- AI service validates that prompt content does not match PII patterns.

## Authentication

- **Access tokens**: JWT, 15-minute expiry, signed with `JWT_SECRET`.
- **Refresh tokens**: SHA-256 hashed in database, 7-day expiry, rotating.
- **Token rotation**: old refresh token is revoked when new one is issued.
  Reuse of a revoked token triggers family-wide revocation.
- **Password hashing**: Argon2id with default parameters.

## Authorization

- **Route level**: `@Roles()` decorator + `RolesGuard` on every protected endpoint.
- **Data level**: Every database query scoped by `orgId` from JWT. Never trust
  client-supplied `orgId`.
- **Roles**: `BUYER`, `SELLER`, `ARBITRATOR`, `ADMIN`, `REGULATOR_READONLY`.

## Data Residency (DPDP Act 2023)

- All data stored in **AWS ap-south-1 (Mumbai)**.
- No cross-region replication.
- No data export to regions outside India without explicit legal review.

## Aadhaar Handling (Aadhaar Act 2016)

- eKYC via `KycProvider` interface — sandbox in MVP.
- Aadhaar number is never stored after verification — store only verification
  status and timestamp.
- If Aadhaar must be stored temporarily (during verification flow), encrypt
  immediately and delete after verification completes.

## API Security

- **Helmet** middleware for HTTP headers.
- **CORS** restricted to `APP_BASE_URL`.
- **Rate limiting** via `@nestjs/throttler`.
- **Input validation** via Zod on every endpoint.
- **No stack traces** in error responses.

## Secrets Management

- All secrets in environment variables, never in code or config files.
- `.env.example` documents required variables without real values.
- Production secrets in AWS Secrets Manager.
- Rotate `JWT_SECRET` and `ENCRYPTION_KEY` on schedule (quarterly).

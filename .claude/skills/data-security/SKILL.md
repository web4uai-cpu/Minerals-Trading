# SKILL: Data Security — PII, Encryption & Compliance Patterns

> Consult before writing any code that touches Aadhaar, PAN, GSTIN, phone numbers,
> bank accounts, money amounts, audit records, or authentication.

---

## Fail-Closed Principle

When in doubt about security, **fail closed**. Return a typed error rather than
proceeding with ambiguous authorization or unvalidated data. A failed transaction
is recoverable; a data breach is not.

---

## PII Fields & Handling

| Field | DB Column | Encryption | API Response |
|-------|-----------|-----------|--------------|
| Aadhaar | `aadhaar_enc` | AES-256-GCM | `XXXX XXXX 1234` |
| PAN | `pan` (in Organization) | AES-256-GCM | `XXXXX1234X` |
| GSTIN | `gstin` (in Organization) | AES-256-GCM | `**EFGH****` |
| Phone | `phone` (in User) | AES-256-GCM | `+91 XXXXX 12345` |
| Bank account | `bank_account_enc` | AES-256-GCM | `XXXXX6789` |

### Encryption Implementation (`packages/types/src/encryption.ts`)

```typescript
const IV_LENGTH = 12;  // GCM nonce
const TAG_LENGTH = 16; // GCM auth tag

export function encrypt(plaintext: string, orgId: string): string {
  const key = deriveKey(process.env.PII_ENCRYPTION_KEY!, orgId);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function deriveKey(masterKey: string, orgId: string): Buffer {
  return crypto.pbkdf2Sync(masterKey, orgId, 100_000, 32, 'sha256');
}
```

**Key rotation:** When `PII_ENCRYPTION_KEY` changes, a migration job re-encrypts all
PII fields. Never rotate in place — write to a new column, verify, then swap.

---

## PII Never Appears In:

- Log files (structured or otherwise)
- Audit log `beforeHash` / `afterHash` (hash the encrypted form, not the plaintext)
- Elasticsearch index
- BullMQ job payloads
- AI prompt content
- API error messages
- Push notification bodies
- Email subjects

---

## Money Integrity Rules

```typescript
// packages/types/src/money.ts

export class Money {
  private constructor(private readonly paise: bigint) {
    if (paise < 0n) throw new MoneyError('NEGATIVE_AMOUNT');
    if (paise > 9_999_999_999_999n) throw new MoneyError('EXCEEDS_MAX');  // ~₹100 crore
  }

  static fromRupees(rupees: string | number): Money {
    if (typeof rupees === 'number' && !Number.isInteger(rupees))
      throw new MoneyError('FLOAT_NOT_ALLOWED');
    const paise = BigInt(Math.round(Number(rupees) * 100));
    return new Money(paise);
  }

  static fromPaise(paise: bigint): Money { return new Money(paise); }

  add(other: Money): Money { return new Money(this.paise + other.paise); }
  subtract(other: Money): Money { return new Money(this.paise - other.paise); }
  toPaise(): bigint { return this.paise; }
  toDisplayString(): string {
    const rupees = Number(this.paise) / 100;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(rupees);
  }
}
```

**Rules enforced:**
- All DB columns for money: `BigInt` (BIGINT in PostgreSQL)
- Never cast to `Number` for arithmetic — use BigInt operations
- Escrow balance computed on-the-fly: `Σ HELD - Σ RELEASED - Σ REFUNDED`
- No running balances stored (prevents inconsistency)

---

## JWT Security

```
Access token:  15-minute TTL, RS256 signed, contains { userId, orgId, role }
Refresh token: 7-day TTL, stored as SHA-256(token) in refresh_tokens table
               → token reuse detection (family revocation)
               → device fingerprint for anomaly detection
```

**Access token leakage:** If compromised, damage window is 15 minutes. Refresh
token is in httpOnly cookie — not accessible to JavaScript.

**Token reuse detection:**
```typescript
if (storedToken.isRevoked) {
  // Entire family revocation
  await this.prisma.refreshToken.updateMany({
    where: { /* ancestor chain */ },
    data: { isRevoked: true }
  });
  throw new UnauthorizedException({ code: 'TOKEN_REUSE_DETECTED' });
}
```

---

## Input Validation at Every Boundary

```typescript
// 1. HTTP body — ZodValidationPipe on every endpoint
@UsePipes(new ZodValidationPipe(CreateListingSchema))

// 2. Query params — parsed and validated, not passed raw to DB
const parsedQuery = SearchQuerySchema.parse(req.query);

// 3. Path params — UUID format validated
@Param('id', ParseUUIDPipe) id: string

// 4. File uploads — size + MIME type + virus scan
// 5. AI responses — Zod schema validation before use
// 6. WebSocket messages — Zod schema on @SubscribeMessage handlers
// 7. BullMQ job data — Zod schema on @Process() handlers
```

---

## SQL Injection Prevention

- **Prisma parameterized queries only.** Raw SQL only via `prisma.$queryRaw` with tagged template literals.
- Never string-concatenate into a Prisma query.
- For Elasticsearch: use structured DSL queries, never template string queries.

---

## Rate Limiting

```
Global: 100 req/min per IP (Redis sliding window)
Auth endpoints: 10 req/min per IP (stricter)
AI endpoints: 60 req/hour per org
Upload endpoints: 20 req/hour per org
```

Rate limit headers returned: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`

---

## CORS Policy

```typescript
app.enableCors({
  origin: [process.env.WEB_URL, process.env.MOBILE_URL],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
  credentials: true,  // for httpOnly refresh token cookie
  maxAge: 3600,
});
```

Never `origin: '*'` in production.

---

## Security Headers (Helmet)

```typescript
app.use(helmet({
  contentSecurityPolicy: { /* strict CSP */ },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
```

---

## Audit Log Immutability

The `audit_log` table has a PostgreSQL row-level trigger that prevents UPDATE and DELETE:

```sql
CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log rows are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_immutable
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
```

Add this trigger in a migration. The application never relies on this trigger for
correctness (it still never UPDATEs audit_log) — the trigger is a defense-in-depth layer.

---

## Document Upload Security

```typescript
// Whitelist MIME types
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;  // 10MB

// S3 key structure (opaque to clients)
const key = `compliance/${orgId}/${itemType}/${uuid()}.${ext}`;

// Presigned URL: read-only, 24-hour TTL for admin review
const url = await s3.getSignedUrlPromise('getObject', {
  Bucket: process.env.S3_BUCKET,
  Key: key,
  Expires: 86400,
});
```

Never return the raw S3 key to clients. Always presigned URLs with TTL.

---

## Data Residency

All infrastructure must be in `ap-south-1` (Mumbai) for DPDP Act 2023 compliance.
PostgreSQL primary + replicas, Redis, Elasticsearch, S3 — all in ap-south-1.
No cross-region replication of PII data.

---

## Secrets Management

```
Development: .env file (never committed — see .env.example)
Production:  AWS Secrets Manager → injected as env vars at container start
             Kubernetes: External Secrets Operator → SecretsManager → Secret → Env
```

Secrets never hardcoded. Never in Dockerfile. Never in turbo.json env list.

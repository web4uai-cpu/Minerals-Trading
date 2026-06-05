# Security Policy

Security and compliance are core features of Khanij Nexus, not add-ons. This
document covers our model, data-handling rules, and how to report issues.

## Reporting a vulnerability

**Do not open a public issue for security problems.**
Email `security@khanijnexus.example` (replace with your real address) with:
steps to reproduce, impact, and affected component. We aim to acknowledge within
48 hours. Coordinated disclosure only; do not exploit beyond proof-of-concept.

## Security model — Zero Trust

No implicit trust inside or outside the network. Every layer verifies independently.

| Layer | Controls |
|-------|----------|
| Identity | KYC-gated onboarding, MFA (TOTP/biometric), RBAC, short-lived JWTs |
| Application | OWASP Top 10 hardening, Zod input validation, CSRF tokens, CSP headers |
| API gateway | WAF, rate limiting (100 req/min/user), JWT + JWKS rotation, AWS Shield |
| Network | Private subnets for all DBs, no public data-layer exposure, mTLS internally |
| Data | AES-256-GCM at rest, TLS 1.3 in transit, field-level PII encryption, HSM keys |
| Infrastructure | Immutable infra, container scanning, SAST/DAST in CI, secrets in Vault |
| Audit | Append-only audit log, dual-approval for admin actions, quarterly pentests |

## PII handling rules (enforce in code review)

These fields are **always** field-level encrypted at rest and **never** logged
in plaintext: **Aadhaar number, PAN, bank account number, GSTIN, phone.**

- List endpoints return masked values (e.g. `XXXXXX1234`) unless the caller is
  explicitly authorized and the access is audited.
- Decryption happens only in the service layer, only when needed, never bulk.
- No PII in URLs, query strings, logs, error messages, or analytics events.
- Right-to-erasure (DPDP Act 2023): a documented, tested deletion path that
  preserves the immutable audit trail in anonymized form.

## Authentication & sessions

- Passwords: Argon2id (never MD5/SHA/bcrypt-without-reason).
- Access token 15 min; refresh token 7 days, **rotating**; refresh-reuse detection
  revokes the whole token family.
- Re-authentication required for sensitive actions (escrow, award issuance,
  changing bank details).
- Account lockout + alerting after repeated failed logins.

## Authorization

- Roles: `BUYER`, `SELLER`, `ARBITRATOR`, `ADMIN`, `REGULATOR_READONLY`.
- Enforced at the route (guards) **and** the data layer (every query scoped by
  `orgId`). A valid token for org A must never read org B's data.
- `REGULATOR_READONLY` can read compliance/aggregate data, never mutate.
- Least privilege: each service/role gets the minimum permissions it needs.

## Money & financial integrity

- Amounts stored as integer **paise** (BIGINT); never floats.
- Every financial mutation is transactional and writes to the append-only
  `escrow_ledger`. Ledger entries are never updated or deleted — only added.
- **Real money movement is out of scope until an RBI PA/PA-C licence and bank
  partner exist.** The `PaymentProvider` is a stub. Do not wire real rails or
  build anything that mimics real settlement.

## Audit trail

- Every state-changing action writes an immutable `audit_log` row: actor, action,
  target, before/after hash, timestamp, IP, traceId.
- Audit rows are append-only at the DB level (no UPDATE/DELETE grants).
- Admin and arbitrator actions additionally require dual approval where they
  affect money or dispute outcomes.

## AI-specific security

- All user input passed to a prompt is treated as untrusted data and delimited;
  prompts instruct the model to ignore embedded instructions (injection defense).
- AI never returns facts it could fabricate (sellers, prices, compliance) —
  those are DB-sourced. AI output that will be acted upon is Zod-validated.
- AI drafts (contracts, briefs) are decision-support only and clearly labeled
  non-binding; a human must sign or rule.

## Secrets & keys

- No secrets in code or git. `.env` is gitignored; `.env.example` documents keys.
- Production secrets in AWS Secrets Manager / HashiCorp Vault.
- Encryption keys via KMS/CloudHSM; rotate per policy. API keys rotate every 30 days.

## Compliance targets

SOC 2 Type II · ISO 27001 · PCI-DSS (when escrow goes live) · DPDP Act 2023 ·
CERT-In incident reporting readiness. Data localised to ap-south-1.

## Secure development checklist (per PR)

- [ ] Inputs validated (Zod), outputs encoded.
- [ ] AuthZ enforced at route + data layer; cross-org access tested.
- [ ] No new PII logged; sensitive fields encrypted & masked.
- [ ] Money paths transactional, amounts in paise.
- [ ] Audit rows written for state changes.
- [ ] No secrets committed; dependencies scanned.
- [ ] AI prompts injection-hardened; AI outputs validated.

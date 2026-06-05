---
name: compliance-rules
description: Use this skill whenever working on org verification, onboarding, document checks, TrustScore, or anything that decides whether a buyer/seller is allowed to transact on Khanij Nexus. Encodes the Indian regulatory requirements, the verification state machine, and the TrustScore formula. Consult before writing or changing any code in apps/api/src/compliance.
---

# Compliance & Verification Rules

This skill is the source of truth for the trust layer. The compliance engine is
the platform's core value — treat its rules as load-bearing, not cosmetic.

## Required compliance items by org type

A `ComplianceItem` is a required attestation. Required sets:

**SELLER (mine owner / lessee / trader):**
- `MINING_LEASE` — valid lease registered with the state govt (has `validUntil`)
- `ENV_CLEARANCE` — MoEFCC Environmental Clearance
- `FOREST_CLEARANCE` — only if mine falls in forest land (conditional)
- `IBM_RETURNS` — Indian Bureau of Mines annual returns, current FY
- `ROYALTY_CLEARANCE` — royalty dues cleared certificate
- `SPCB_NOC` — State Pollution Control Board consent to operate (has `validUntil`)
- `GST_REG` — GST registration + returns
- `PAN` — PAN of the entity
- `BANK_VERIFICATION` — penny-drop verified payout account

**BUYER (industrial consumer):**
- `GST_REG`, `PAN`, `BANK_VERIFICATION`
- `IEC` — Importer/Exporter Code (only if importing/exporting; conditional)
- `END_USE_DECLARATION` — declared mineral end-use
- `INDUSTRY_REGISTRATION` — factory licence / Udyam (conditional by size)

**TRADER / EXPORTER:** SELLER-style financial items + trading licence +
(`IEC` mandatory for EXPORTER).

> The exact set is jurisdiction-specific. When piloting one state, seed that
> state's real requirements. Do not hardcode a national set as if uniform.

## Item status state machine

```
MISSING ──upload──> UPLOADED ──submit──> UNDER_REVIEW
UNDER_REVIEW ──admin verify──> VERIFIED
UNDER_REVIEW ──admin reject──> REJECTED ──reupload──> UPLOADED
VERIFIED ──validUntil passes──> EXPIRED ──reupload──> UPLOADED
```

Rules:
- Only `ADMIN` can move an item to `VERIFIED` or `REJECTED`. Audited.
- Transitions not in this machine throw. No skipping `UNDER_REVIEW`.
- `EXPIRED` is set by the nightly sweep, never manually.
- Every transition appends a versioned snapshot — never overwrite history.

## Gating rules (enforce in code)

- A `Listing` may only become `ACTIVE` if the seller org status is `VERIFIED`.
- An org is `VERIFIED` only when **all mandatory (non-conditional) items** for
  its type are `VERIFIED` and none are `EXPIRED`.
- A `Deal` cannot reach `SIGNED` if either party's org is not `VERIFIED`.
- Conditional items (e.g. `FOREST_CLEARANCE`, `IEC`) are required only when their
  trigger applies; store the trigger reason.

## TrustScore (0–100)

Computed from VERIFIED items, weighted, with time decay on expiring items.

```
base = Σ (weight_i for each VERIFIED mandatory item i)   # weights sum to 100
```

Suggested weights (tune per pilot, keep documented):

| Item | Weight |
|------|--------|
| MINING_LEASE | 20 |
| ENV_CLEARANCE | 15 |
| IBM_RETURNS | 15 |
| ROYALTY_CLEARANCE | 10 |
| SPCB_NOC | 10 |
| GST_REG | 10 |
| BANK_VERIFICATION | 10 |
| PAN | 5 |
| Deal history bonus | 5 |

Decay: if an item expires within **30 days**, multiply its weight contribution by
`daysLeft / 30` (linear). Expired item contributes 0 and drops org below VERIFIED.

Deal-history bonus: small positive signal for completed, dispute-free deals;
capped at its weight. Never let history alone make an unverified org look trusted.

Output is always a versioned snapshot: `{ score, breakdown, computedAt }`.

## Verification via providers (sandbox now)

Verification calls go through interfaces, sandbox impls in MVP:
- `KycProvider.verifyPan` / `verifyGstin` / `pennyDropBank`
- `GovDataProvider.fetchMiningLeaseStatus(leaseId, state)` / `fetchIbmReturns(orgId)`
- `DocumentAiProvider.extractFields(s3Key, docType)` → parsed fields to MongoDB

Never fabricate a "verified" result outside the sandbox provider. Real provider
integration (UIDAI, IBM, NSDL) has authorization prerequisites — out of scope.

## Hard rules

1. Compliance records are append-only and versioned. Never overwrite.
2. TrustScore must be explainable — always return the breakdown.
3. A number on a screen is not verification. Status must trace to a provider
   result or an audited admin action.
4. When unsure whether something is legally sufficient, fail closed and flag for
   human review — do not auto-verify.

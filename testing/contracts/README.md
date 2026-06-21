# Contract Tests — Khanij Nexus

## Purpose

Contract tests verify that the API server and frontend clients agree on
request/response shapes. They catch breaking changes before deployment.

## Approach

Consumer-driven contracts: the frontend defines what it expects from each
endpoint, and the contract test verifies the API satisfies those expectations.

## Implementation (Phase 7+)

When the web frontend is built, contract tests will:

1. Import Zod schemas from `@khanij/types` (shared source of truth)
2. Make real HTTP requests to a test API server
3. Validate responses against the Zod schemas
4. Fail if the response shape doesn't match the schema

Since both frontend and backend use the same Zod schemas from `@khanij/types`,
schema drift is already caught at compile time. Contract tests add runtime
verification as defense in depth.

## File Structure

```
testing/contracts/
├── README.md              (this file)
├── auth.contract.test.ts  (Phase 7)
├── listings.contract.test.ts
├── discovery.contract.test.ts
└── deals.contract.test.ts
```

# ADR-008: JWT with Rotating Refresh Tokens + Token Family Revocation

**Status:** Accepted
**Date:** 2026-06-05
**Category:** architecture

## Context
Short-lived access tokens minimise breach impact. Refresh tokens must rotate to detect theft.

## Decision
Access token: 15min JWT. Refresh token: 7-day, SHA-256 hashed in DB, rotating. Reuse of revoked token triggers family-wide revocation.

## Consequences
- (+) Stolen access token useless after 15 minutes
- (+) Stolen refresh token triggers automatic family revocation
- (-) Family revocation may log out legitimate users on shared devices

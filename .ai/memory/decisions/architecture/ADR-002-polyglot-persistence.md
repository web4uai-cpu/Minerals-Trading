# ADR-002: Polyglot Persistence

**Status:** Accepted
**Date:** 2026-06-05
**Category:** architecture

## Context
Distinct data access patterns: relational transactions, full-text search, real-time pub/sub, semi-structured documents, binary storage.

## Decision
- PostgreSQL 16 + TimescaleDB — primary relational store, audit, time-series
- Redis 7 — token allow-list, rate limiting, BullMQ, WebSocket pub/sub, cache
- Elasticsearch 8 — listings search index (grade facets, geo, TrustScore boost)
- MongoDB — deal document store (contracts, terms, amendments)
- S3/MinIO — binary file storage (compliance docs, evidence)

## Consequences
- (+) Each store optimised for its access pattern
- (-) 5 data stores to maintain and monitor
- **Rule:** Postgres is always authoritative. Elasticsearch is a derived index.

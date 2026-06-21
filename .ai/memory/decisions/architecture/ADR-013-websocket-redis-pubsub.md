# ADR-013: Real-Time Deal Room via WebSocket + Redis Pub/Sub

**Status:** Accepted
**Date:** 2026-06-15
**Category:** architecture

## Context
Deal room needs real-time chat (<500ms). Multiple K8s pods need cross-pod message delivery.

## Decision
NestJS WebSocket Gateway (socket.io) + Redis pub/sub as message bus between pods. JWT auth in handshake. Socket.io rooms per deal.

## Consequences
- (+) Horizontal scaling works via Redis
- (-) Redis adds ~2ms hop per message — acceptable

# @khanij/logistics

Shipment and delivery management domain package (Phase 8).

## What it owns

- **Shipment state machine**: tracking shipment lifecycle from creation through dispatch, in-transit, delivered, and confirmed states.
- **Delivery proof validation**: rules for what constitutes valid proof of delivery (e-POD signatures, photos, weight-bridge slips, timestamps).
- **Tracking event types**: standardized event definitions for location updates, custody transfers, and exception notifications.

## Entities

- `Shipment` — a physical movement of mineral goods tied to a deal milestone, with origin, destination, carrier, and state.
- `DeliveryProof` — evidence that goods were received as specified, including digital signatures, photographic proof, and weight verification.

## Boundaries

- Pure business logic and type definitions only — zero NestJS dependencies.
- Does NOT integrate with real GPS/logistics providers; tracking data comes through defined interfaces in `apps/api`.
- Does NOT handle invoicing or payments; delivery confirmation triggers settlement logic in `@khanij/finance`.
- Imports shared types and Zod schemas from `@khanij/types`.

# Event Standard — Khanij Nexus

## Event Naming

Format: `{Domain}.{Entity}.{PastTenseVerb}`

Examples:
- `Compliance.Item.Verified`
- `Deal.Status.Transitioned`
- `Marketplace.Listing.Activated`
- `Escrow.Funds.Held`
- `Bidding.Auction.Closed`

## Event Payload

Every domain event must include these base fields:

```typescript
interface DomainEvent {
  eventId: string;        // UUID — unique per event instance
  eventType: string;      // e.g., "Compliance.Item.Verified"
  entityId: string;       // ID of the affected entity
  entityType: string;     // e.g., "ComplianceItem", "Deal"
  actorId: string;        // userId or "system" for automated actions
  actorOrgId?: string;    // org context if applicable
  timestamp: string;      // ISO 8601
  payload: Record<string, unknown>;  // domain-specific data
}
```

## Event Definition Location

Domain events are defined as TypeScript types in:
`packages/{domain}/src/events/{entity}.events.ts`

Example: `packages/compliance/src/events/compliance.events.ts`

```typescript
export interface ComplianceItemVerifiedEvent extends DomainEvent {
  eventType: 'Compliance.Item.Verified';
  payload: {
    orgId: string;
    itemType: ComplianceItemType;
    verifiedBy: string;
    newTrustScore: number;
  };
}
```

## Delivery Mechanism

- **Internal (same process)**: NestJS `EventEmitter2` for in-process pub/sub.
- **Async (cross-module)**: BullMQ queues via Redis for reliable delivery.
- **Guarantee**: At-least-once. Consumers must be idempotent.

## Event Ordering

- Events within a single entity are ordered by `timestamp`.
- No global ordering guarantee across entities.
- Use `entityId` + `timestamp` for event replay within an entity.

## Event Storage

- Events are **not persisted as a separate event store** in MVP.
- The audit log serves as the durable record of state changes.
- If event sourcing is adopted later, events will be stored in a dedicated table.

## Rules

1. Events are **past tense** — they describe what happened, not what should happen.
2. Events must be **self-contained** — a consumer should not need to query back
   to understand the event.
3. Events must not contain **PII** — reference IDs only, never encrypted field values.
4. Event producers must not depend on consumer behavior — fire and forget.
5. New event types require an entry in the domain's `EVENTS.md` doc.

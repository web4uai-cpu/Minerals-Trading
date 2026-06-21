import { ShipmentStatus, TrackingEventType } from '@khanij/types';
import { buildTrackingTimeline } from './tracking-events';

describe('tracking-events / buildTrackingTimeline', () => {
  it('builds timeline from events', () => {
    const events = [
      { eventType: TrackingEventType.PICKUP, location: 'Raipur', createdAt: new Date('2025-01-01T08:00:00Z') },
      { eventType: TrackingEventType.CHECKPOINT, location: 'Nagpur', createdAt: new Date('2025-01-02T12:00:00Z'), notes: 'Crossed state border' },
    ];
    const timeline = buildTrackingTimeline(
      events,
      ShipmentStatus.IN_TRANSIT,
      new Date('2025-01-05T00:00:00Z'),
      new Date('2025-01-03T00:00:00Z'),
    );

    expect(timeline.events).toHaveLength(2);
    expect(timeline.events[0]!.eventType).toBe(TrackingEventType.PICKUP);
    expect(timeline.events[1]!.notes).toBe('Crossed state border');
    expect(timeline.currentStatus).toBe(ShipmentStatus.IN_TRANSIT);
    expect(timeline.isDelayed).toBe(false);
  });

  it('detects delayed shipment', () => {
    const timeline = buildTrackingTimeline(
      [{ eventType: TrackingEventType.PICKUP, location: 'Raipur', createdAt: new Date('2025-01-01T08:00:00Z') }],
      ShipmentStatus.IN_TRANSIT,
      new Date('2025-01-03T00:00:00Z'),
      new Date('2025-01-05T00:00:00Z'), // past estimated delivery
    );

    expect(timeline.isDelayed).toBe(true);
  });

  it('not delayed when delivered on time', () => {
    const timeline = buildTrackingTimeline(
      [{ eventType: TrackingEventType.DELIVERED, location: 'Mumbai', createdAt: new Date('2025-01-04T08:00:00Z') }],
      ShipmentStatus.DELIVERED,
      new Date('2025-01-03T00:00:00Z'),
      new Date('2025-01-05T00:00:00Z'), // past estimated but already delivered
    );

    expect(timeline.isDelayed).toBe(false);
  });
});

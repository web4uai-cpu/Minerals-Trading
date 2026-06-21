import { ShipmentStatus, TrackingEventType } from '@khanij/types';

export interface TrackingTimeline {
  shipmentId: string;
  events: Array<{
    eventType: TrackingEventType;
    location: string;
    timestamp: string;
    notes?: string;
  }>;
  currentStatus: ShipmentStatus;
  estimatedDeliveryDate: string;
  isDelayed: boolean;
}

const NON_DELAYED_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.DELIVERED,
  ShipmentStatus.CONFIRMED,
  ShipmentStatus.CANCELLED,
];

export function buildTrackingTimeline(
  events: Array<{ eventType: TrackingEventType; location: string; createdAt: Date; notes?: string }>,
  shipmentStatus: ShipmentStatus,
  estimatedDeliveryDate: Date,
  now?: Date,
): TrackingTimeline {
  const currentTime = now ?? new Date();
  const isDelayed =
    currentTime > estimatedDeliveryDate && !NON_DELAYED_STATUSES.includes(shipmentStatus);

  return {
    shipmentId: '',
    events: events.map((e) => ({
      eventType: e.eventType,
      location: e.location,
      timestamp: e.createdAt.toISOString(),
      notes: e.notes,
    })),
    currentStatus: shipmentStatus,
    estimatedDeliveryDate: estimatedDeliveryDate.toISOString(),
    isDelayed,
  };
}

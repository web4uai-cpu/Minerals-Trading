'use client';

import { useState } from 'react';
import { api, ApiRequestError } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { GlassCard } from '@/components/ui/glass-card';
import { Badge, Button } from '@khanij/ui';

interface TrackingEvent {
  type: string;
  location?: string;
  notes?: string;
  createdAt: string;
}

interface Shipment {
  id: string;
  status: string;
  carrierName: string;
  vehicleNumber: string;
  estimatedDeliveryDate: string;
  weightAtOriginKg?: number;
  trackingEvents?: TrackingEvent[];
}

interface ShipmentTrackerProps {
  dealId: string;
  shipments: Shipment[];
  onUpdate: () => void;
}

const STATUS_VARIANT: Record<string, 'verified' | 'pending' | 'info' | 'default'> = {
  CREATED: 'default',
  DISPATCHED: 'info',
  IN_TRANSIT: 'pending',
  DELIVERED: 'verified',
  CONFIRMED: 'verified',
};

export function ShipmentTracker({ dealId, shipments, onUpdate }: ShipmentTrackerProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    carrierName: '',
    vehicleNumber: '',
    driverName: '',
    driverPhone: '',
    estimatedDeliveryDate: '',
  });

  async function createShipment(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api('/api/v1/shipments', {
        method: 'POST',
        body: JSON.stringify({
          dealId,
          carrierName: form.carrierName,
          vehicleNumber: form.vehicleNumber,
          driverName: form.driverName || undefined,
          driverPhone: form.driverPhone || undefined,
          originDistrict: 'Origin',
          originState: 'State',
          destinationDistrict: 'Destination',
          destinationState: 'State',
          estimatedDeliveryDate: new Date(form.estimatedDeliveryDate).toISOString(),
        }),
      });
      setShowCreate(false);
      onUpdate();
    } catch { /* */ } finally {
      setCreating(false);
    }
  }

  async function dispatch(shipmentId: string) {
    await api(`/api/v1/shipments/${shipmentId}/dispatch`, { method: 'PATCH' });
    onUpdate();
  }

  async function confirmDelivery(shipmentId: string) {
    await api(`/api/v1/shipments/${shipmentId}/confirm-delivery`, {
      method: 'PATCH',
      body: JSON.stringify({ weightAtDestinationKg: 0, receiverName: 'Confirmed', receiverPhone: '+910000000000' }),
    });
    onUpdate();
  }

  return (
    <div className="space-y-4">
      {shipments.length === 0 && !showCreate && (
        <GlassCard className="p-8 text-center">
          <div className="text-base-500 mb-3">No shipments created yet</div>
          <Button size="sm" onClick={() => setShowCreate(true)}>Create Shipment</Button>
        </GlassCard>
      )}

      {showCreate && (
        <GlassCard className="p-5">
          <h4 className="text-sm font-medium text-white mb-3">New Shipment</h4>
          <form onSubmit={createShipment} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input value={form.carrierName} onChange={(e) => setForm((f) => ({ ...f, carrierName: e.target.value }))} className="glass-input px-3 py-2 text-sm text-white" placeholder="Carrier Name" required />
              <input value={form.vehicleNumber} onChange={(e) => setForm((f) => ({ ...f, vehicleNumber: e.target.value }))} className="glass-input px-3 py-2 text-sm text-white" placeholder="Vehicle No." required />
              <input value={form.driverName} onChange={(e) => setForm((f) => ({ ...f, driverName: e.target.value }))} className="glass-input px-3 py-2 text-sm text-white" placeholder="Driver (optional)" />
              <input type="date" value={form.estimatedDeliveryDate} onChange={(e) => setForm((f) => ({ ...f, estimatedDeliveryDate: e.target.value }))} className="glass-input px-3 py-2 text-sm text-white" required />
            </div>
            <div className="flex gap-2">
              <Button size="sm" type="submit" isLoading={creating}>Create</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </form>
        </GlassCard>
      )}

      {shipments.map((shipment) => (
        <GlassCard key={shipment.id} className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-sm font-medium text-white">{shipment.carrierName}</span>
              <span className="text-xs text-base-500 ml-2">{shipment.vehicleNumber}</span>
            </div>
            <Badge variant={STATUS_VARIANT[shipment.status] ?? 'default'}>{shipment.status}</Badge>
          </div>

          <div className="text-xs text-base-500 mb-3">
            ETA: {formatDate(shipment.estimatedDeliveryDate)}
            {shipment.weightAtOriginKg && <span> · {shipment.weightAtOriginKg} kg at origin</span>}
          </div>

          {/* Tracking Timeline */}
          {shipment.trackingEvents && shipment.trackingEvents.length > 0 && (
            <div className="border-l-2 border-white/10 ml-2 pl-4 space-y-2 mb-3">
              {shipment.trackingEvents.map((event, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-accent" />
                  <div className="text-xs">
                    <span className="text-white font-medium">{event.type}</span>
                    {event.location && <span className="text-base-500 ml-1">· {event.location}</span>}
                    <div className="text-base-500">{formatDate(event.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            {shipment.status === 'CREATED' && (
              <Button size="sm" variant="secondary" onClick={() => dispatch(shipment.id)}>Dispatch</Button>
            )}
            {(shipment.status === 'DISPATCHED' || shipment.status === 'IN_TRANSIT') && (
              <Button size="sm" onClick={() => confirmDelivery(shipment.id)}>Confirm Delivery</Button>
            )}
          </div>
        </GlassCard>
      ))}

      {shipments.length > 0 && !showCreate && (
        <Button size="sm" variant="ghost" onClick={() => setShowCreate(true)}>+ Add Shipment</Button>
      )}
    </div>
  );
}

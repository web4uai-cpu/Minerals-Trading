'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { GlassCard } from '@/components/ui/glass-card';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@khanij/ui';

interface Shipment {
  id: string;
  dealId: string;
  status: string;
  carrierName: string;
  vehicleNumber: string;
  driverName?: string;
  estimatedDeliveryDate: string;
  weightAtOriginKg?: number;
  createdAt: string;
  trackingEvents?: { type: string; location?: string; createdAt: string }[];
}

interface Deal { id: string; mineralName: string; }

const STATUS_STEPS = ['CREATED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'CONFIRMED'];
const STATUS_VARIANT: Record<string, 'verified' | 'pending' | 'info' | 'default'> = {
  CREATED: 'default',
  DISPATCHED: 'info',
  IN_TRANSIT: 'pending',
  DELIVERED: 'verified',
  CONFIRMED: 'verified',
};

export default function ShipmentsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Deal[]>('/api/v1/deals')
      .then(async (dealList) => {
        setDeals(dealList);
        const allShipments: Shipment[] = [];
        for (const deal of dealList.slice(0, 10)) {
          const s = await api<Shipment[]>(`/api/v1/deals/${deal.id}/shipments`).catch(() => []);
          allShipments.push(...s);
        }
        setShipments(allShipments);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="max-w-4xl"><div className="skeleton h-8 w-48 mb-6" />{[1,2,3].map((i) => <div key={i} className="skeleton h-32 mb-3" />)}</div>;

  return (
    <div className="max-w-4xl">
      <PageHeader title="Shipments" subtitle="Track all shipments across your deals" />

      {shipments.length === 0 && (
        <GlassCard className="p-12 text-center">
          <div className="text-3xl mb-3">🚛</div>
          <div className="text-base-500">No shipments yet. Shipments are created from the Deal Room.</div>
        </GlassCard>
      )}

      <div className="space-y-4">
        {shipments.map((shipment) => {
          const statusIdx = STATUS_STEPS.indexOf(shipment.status);

          return (
            <GlassCard key={shipment.id} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-sm font-medium text-white">{shipment.carrierName}</span>
                  <span className="text-xs text-base-500 ml-2">{shipment.vehicleNumber}</span>
                  {shipment.driverName && <span className="text-xs text-base-500 ml-2">· {shipment.driverName}</span>}
                </div>
                <Badge variant={STATUS_VARIANT[shipment.status] ?? 'default'}>{shipment.status}</Badge>
              </div>

              {/* Progress dots */}
              <div className="flex items-center gap-1 mb-3">
                {STATUS_STEPS.map((step, idx) => (
                  <div key={step} className="flex items-center">
                    <div className={`w-2.5 h-2.5 rounded-full transition-all ${idx <= statusIdx ? 'bg-accent' : 'bg-white/10'}`} />
                    {idx < STATUS_STEPS.length - 1 && (
                      <div className={`w-6 h-0.5 ${idx < statusIdx ? 'bg-accent/50' : 'bg-white/5'}`} />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-4 text-xs text-base-500">
                <span>ETA: {formatDate(shipment.estimatedDeliveryDate)}</span>
                {shipment.weightAtOriginKg && <span>Weight: {shipment.weightAtOriginKg} kg</span>}
                <span>Created: {formatDate(shipment.createdAt)}</span>
              </div>

              {/* Tracking events */}
              {shipment.trackingEvents && shipment.trackingEvents.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <div className="border-l-2 border-white/10 ml-1 pl-3 space-y-2">
                    {shipment.trackingEvents.map((event, i) => (
                      <div key={i} className="relative text-xs">
                        <div className="absolute -left-[15px] top-0.5 w-1.5 h-1.5 rounded-full bg-accent" />
                        <span className="text-white">{event.type}</span>
                        {event.location && <span className="text-base-500 ml-1">· {event.location}</span>}
                        <span className="text-base-500 ml-1">· {formatDate(event.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

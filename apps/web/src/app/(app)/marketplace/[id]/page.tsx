'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiRequestError } from '@/lib/api-client';
import { formatPaise, formatQuantity, formatDate } from '@/lib/format';
import { GlassCard } from '@/components/ui/glass-card';
import { GradeDisplay } from '@/components/grade-display';
import { PriceBandIndicator } from '@/components/price-band-indicator';
import { Badge, Button } from '@khanij/ui';
import Link from 'next/link';

interface Listing {
  id: string;
  mineralName: string;
  mineralId: string;
  grade: Record<string, number>;
  quantityAvailable: number;
  unit: string;
  askPriceInPaise: number;
  location: { district: string; state: string };
  status: string;
  dispatchLeadDays: number;
  trustScore?: number;
  sellerName?: string;
  createdAt: string;
}

interface PriceRef {
  fairLow: number;
  fairHigh: number;
  refPrice: number;
  source: string;
}

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const listingId = params.id as string;

  const [listing, setListing] = useState<Listing | null>(null);
  const [priceRef, setPriceRef] = useState<PriceRef | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRfq, setShowRfq] = useState(false);
  const [rfqForm, setRfqForm] = useState({ quantity: '', neededBy: '', notes: '' });
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Listing>(`/api/v1/listings/${listingId}`)
      .then((l) => {
        setListing(l);
        return api<PriceRef>(`/price/reference?mineralId=${l.mineralId}&state=${l.location.state}`)
          .catch(() => null);
      })
      .then((p) => { if (p) setPriceRef(p); })
      .catch(() => setError('Listing not found'))
      .finally(() => setLoading(false));
  }, [listingId]);

  async function handleSendRfq(e: React.FormEvent) {
    e.preventDefault();
    if (!listing) return;
    setSending(true);
    setError('');

    try {
      await api('/api/v1/rfqs', {
        method: 'POST',
        body: JSON.stringify({
          listingId: listing.id,
          mineralId: listing.mineralId,
          grade: listing.grade,
          quantity: Number(rfqForm.quantity),
          unit: listing.unit,
          neededBy: new Date(rfqForm.neededBy).toISOString(),
          notes: rfqForm.notes || undefined,
        }),
      });
      setSuccess(true);
      setShowRfq(false);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.body.message);
      else setError('Failed to send RFQ');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl space-y-4">
        <div className="skeleton h-6 w-32" />
        <div className="skeleton h-64" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="max-w-3xl">
        <div className="glass p-6 text-center text-base-500">{error || 'Listing not found'}</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <Link href="/marketplace" className="text-sm text-base-500 hover:text-white mb-6 inline-block no-underline">
        ← Back to Marketplace
      </Link>

      {/* Hero */}
      <GlassCard strong className="p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{listing.mineralName}</h1>
            <p className="text-base-500 mt-1">
              {listing.sellerName ?? 'Seller'} · {listing.location.district}, {listing.location.state}
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono-nums text-2xl font-bold text-accent-light">
              {formatPaise(listing.askPriceInPaise)}
            </div>
            <div className="text-xs text-base-500">per {listing.unit}</div>
          </div>
        </div>

        {priceRef && (
          <PriceBandIndicator
            price={listing.askPriceInPaise}
            fairLow={priceRef.fairLow}
            fairHigh={priceRef.fairHigh}
          />
        )}
      </GlassCard>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <GlassCard className="p-4">
          <div className="text-xs text-base-500 uppercase tracking-wider mb-2">Available Quantity</div>
          <div className="font-mono-nums text-lg font-semibold text-white">
            {formatQuantity(listing.quantityAvailable, listing.unit)}
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-xs text-base-500 uppercase tracking-wider mb-2">Dispatch Lead</div>
          <div className="text-lg font-semibold text-white">{listing.dispatchLeadDays} days</div>
        </GlassCard>
      </div>

      {/* Grade */}
      <GlassCard className="p-5 mb-6">
        <h3 className="text-sm font-medium text-base-500 uppercase tracking-wider mb-4">Grade Specification</h3>
        <GradeDisplay grade={listing.grade} />
      </GlassCard>

      {/* Actions */}
      {success ? (
        <GlassCard className="p-6 text-center">
          <div className="text-sage text-lg font-semibold mb-2">RFQ Sent Successfully!</div>
          <p className="text-sm text-base-500 mb-4">The seller will respond with a quote.</p>
          <Button variant="secondary" onClick={() => router.push('/rfqs')}>View My RFQs</Button>
        </GlassCard>
      ) : showRfq ? (
        <GlassCard strong className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Send Request for Quote</h3>
          {error && <div className="glass px-4 py-2 text-sm text-red-400 mb-4">{error}</div>}
          <form onSubmit={handleSendRfq} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-base-500 uppercase tracking-wider mb-2">Quantity ({listing.unit})</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={rfqForm.quantity}
                  onChange={(e) => setRfqForm((f) => ({ ...f, quantity: e.target.value }))}
                  className="glass-input w-full px-4 py-3 text-sm text-white"
                  placeholder="e.g. 500"
                />
              </div>
              <div>
                <label className="block text-xs text-base-500 uppercase tracking-wider mb-2">Needed By</label>
                <input
                  type="date"
                  required
                  value={rfqForm.neededBy}
                  onChange={(e) => setRfqForm((f) => ({ ...f, neededBy: e.target.value }))}
                  className="glass-input w-full px-4 py-3 text-sm text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-base-500 uppercase tracking-wider mb-2">Notes (optional)</label>
              <textarea
                value={rfqForm.notes}
                onChange={(e) => setRfqForm((f) => ({ ...f, notes: e.target.value }))}
                className="glass-input w-full px-4 py-3 text-sm text-white h-20 resize-none"
                placeholder="Any specific requirements..."
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" isLoading={sending}>Send RFQ</Button>
              <Button variant="ghost" onClick={() => setShowRfq(false)}>Cancel</Button>
            </div>
          </form>
        </GlassCard>
      ) : (
        <Button className="w-full !py-4 !text-base" onClick={() => setShowRfq(true)}>
          Send Request for Quote →
        </Button>
      )}
    </div>
  );
}

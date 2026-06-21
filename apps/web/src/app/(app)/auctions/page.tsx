'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiRequestError } from '@/lib/api-client';
import { formatPaise, formatQuantity } from '@/lib/format';
import { useCountdown } from '@/hooks/use-countdown';
import { GlassCard } from '@/components/ui/glass-card';
import { PageHeader } from '@/components/ui/page-header';
import { Badge, Button } from '@khanij/ui';

interface Auction {
  id: string;
  type: string;
  mineralName?: string;
  mineralId: string;
  quantity: number;
  unit: string;
  reservePriceInPaise?: number;
  currentBestBidPaise?: number;
  bidCount?: number;
  status: string;
  startAt: string;
  endAt: string;
  createdAt: string;
}

interface Mineral { id: string; name: string; }

function AuctionCard({ auction, onClick }: { auction: Auction; onClick: () => void }) {
  const countdown = useCountdown(auction.endAt);

  return (
    <GlassCard hoverable className="p-5" onClick={onClick}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-white">{auction.mineralName ?? 'Mineral'}</h3>
        <Badge variant={auction.status === 'OPEN' ? 'info' : auction.status === 'AWARDED' ? 'verified' : 'default'}>
          {auction.type === 'FORWARD' ? '↑ Forward' : '↓ Reverse'}
        </Badge>
      </div>

      <div className="mb-3">
        <div className="text-xs text-base-500 uppercase mb-1">Current Best Bid</div>
        <div className="font-mono-nums text-xl font-bold text-accent-light">
          {auction.currentBestBidPaise ? formatPaise(auction.currentBestBidPaise) : '—'}
        </div>
      </div>

      <div className="flex justify-between text-sm mb-3">
        <div>
          <span className="text-base-500">Qty: </span>
          <span className="font-mono-nums">{formatQuantity(auction.quantity, auction.unit)}</span>
        </div>
        <div>
          <span className="text-base-500">Bids: </span>
          <span className="font-mono-nums">{auction.bidCount ?? 0}</span>
        </div>
      </div>

      {auction.status === 'OPEN' && !countdown.isExpired && (
        <div className="glass px-3 py-2 text-center">
          <span className="text-[10px] text-base-500 uppercase">Ends in </span>
          <span className="font-mono-nums text-sm text-white font-medium">{countdown.formatted}</span>
        </div>
      )}
      {(auction.status !== 'OPEN' || countdown.isExpired) && (
        <Badge variant={auction.status === 'CLOSED' || auction.status === 'AWARDED' ? 'verified' : 'default'}>
          {auction.status}
        </Badge>
      )}
    </GlassCard>
  );
}

export default function AuctionsPage() {
  const router = useRouter();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [minerals, setMinerals] = useState<Mineral[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    type: 'FORWARD',
    mineralId: '',
    quantity: '',
    unit: 'MT',
    reservePrice: '',
    endHours: '24',
  });

  useEffect(() => {
    Promise.all([
      api<Auction[]>('/api/v1/auctions').catch(() => []),
      api<Mineral[]>('/api/v1/catalog').catch(() => []),
    ]).then(([a, m]) => {
      setAuctions(a);
      setMinerals(m);
      if (m.length > 0 && !form.mineralId) setForm((f) => ({ ...f, mineralId: m[0]?.id ?? '' }));
    }).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const now = new Date();
      const endAt = new Date(now.getTime() + Number(form.endHours) * 3600000);
      await api('/api/v1/auctions', {
        method: 'POST',
        body: JSON.stringify({
          type: form.type,
          mineralId: form.mineralId,
          grade: {},
          quantity: Number(form.quantity),
          unit: form.unit,
          reservePriceInPaise: form.reservePrice ? String(Number(form.reservePrice)) : undefined,
          startAt: now.toISOString(),
          endAt: endAt.toISOString(),
        }),
      });
      setShowCreate(false);
      const refreshed = await api<Auction[]>('/api/v1/auctions').catch(() => []);
      setAuctions(refreshed);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.body.message);
      else setError('Failed to create auction');
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div className="max-w-5xl"><div className="skeleton h-8 w-48 mb-6" /><div className="grid grid-cols-3 gap-4">{[1,2,3].map((i) => <div key={i} className="skeleton h-48" />)}</div></div>;

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Auctions"
        subtitle="Live mineral auctions — forward and reverse bidding"
        action={{ label: showCreate ? 'Cancel' : 'Create Auction', onClick: () => setShowCreate(!showCreate) }}
      />

      {error && <div className="glass px-4 py-3 text-sm text-red-400 mb-4">{error}</div>}

      {showCreate && (
        <GlassCard strong className="p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Create Auction</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-base-500 uppercase mb-2">Type</label>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="glass-input w-full px-3 py-2 text-sm text-white">
                  <option value="FORWARD" className="bg-base-200">Forward (Seller auctions)</option>
                  <option value="REVERSE" className="bg-base-200">Reverse (Buyer auctions)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-base-500 uppercase mb-2">Mineral</label>
                <select value={form.mineralId} onChange={(e) => setForm((f) => ({ ...f, mineralId: e.target.value }))} className="glass-input w-full px-3 py-2 text-sm text-white">
                  {minerals.map((m) => <option key={m.id} value={m.id} className="bg-base-200">{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-base-500 uppercase mb-2">Quantity (MT)</label>
                <input type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} className="glass-input w-full px-3 py-2 text-sm text-white" placeholder="500" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-base-500 uppercase mb-2">Reserve Price (paise, optional)</label>
                <input type="number" value={form.reservePrice} onChange={(e) => setForm((f) => ({ ...f, reservePrice: e.target.value }))} className="glass-input w-full px-3 py-2 text-sm text-white" placeholder="500000" />
              </div>
              <div>
                <label className="block text-xs text-base-500 uppercase mb-2">Duration (hours)</label>
                <input type="number" value={form.endHours} onChange={(e) => setForm((f) => ({ ...f, endHours: e.target.value }))} className="glass-input w-full px-3 py-2 text-sm text-white" />
              </div>
            </div>
            <Button type="submit" isLoading={creating}>Create Auction</Button>
          </form>
        </GlassCard>
      )}

      {auctions.length === 0 && !showCreate && (
        <GlassCard className="p-12 text-center text-base-500">
          No auctions live. Create one to start bidding.
        </GlassCard>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {auctions.map((auction) => (
          <AuctionCard key={auction.id} auction={auction} onClick={() => router.push(`/auctions/${auction.id}`)} />
        ))}
      </div>
    </div>
  );
}

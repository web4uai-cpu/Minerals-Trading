'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiRequestError } from '@/lib/api-client';
import { formatPaise, formatDate } from '@/lib/format';
import { useCountdown } from '@/hooks/use-countdown';
import { GlassCard } from '@/components/ui/glass-card';
import { Badge, Button } from '@khanij/ui';

interface Bid {
  id: string;
  amountPaise: number;
  bidderOrgName?: string;
  createdAt: string;
}

interface AuctionDetail {
  id: string;
  type: string;
  mineralName?: string;
  quantity: number;
  unit: string;
  reservePriceInPaise?: number;
  currentBestBidPaise?: number;
  status: string;
  startAt: string;
  endAt: string;
  bids?: Bid[];
  ownerOrgId?: string;
}

export default function AuctionDetailPage() {
  const params = useParams();
  const auctionId = params.id as string;

  const [auction, setAuction] = useState<AuctionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState('');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');

  const countdown = useCountdown(auction?.endAt ?? new Date().toISOString());

  useEffect(() => {
    loadAuction();
  }, [auctionId]);

  async function loadAuction() {
    try {
      const data = await api<AuctionDetail>(`/api/v1/auctions/${auctionId}`);
      setAuction(data);
    } catch { setError('Auction not found'); } finally { setLoading(false); }
  }

  async function placeBid(e: React.FormEvent) {
    e.preventDefault();
    if (!bidAmount) return;
    setPlacing(true);
    setError('');
    try {
      await api(`/api/v1/auctions/${auctionId}/bids`, {
        method: 'POST',
        body: JSON.stringify({ auctionId, amountPaise: String(Number(bidAmount)) }),
      });
      setBidAmount('');
      await loadAuction();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.body.message);
    } finally {
      setPlacing(false);
    }
  }

  function quickBid(percent: number) {
    const base = auction?.currentBestBidPaise ?? (Number(bidAmount) || 0);
    if (base) setBidAmount(String(Math.round(base * (1 + percent / 100))));
  }

  if (loading) return <div className="max-w-3xl"><div className="skeleton h-64" /></div>;
  if (!auction) return <GlassCard className="p-8 text-center text-base-500 max-w-3xl">{error}</GlassCard>;

  return (
    <div className="max-w-3xl">
      <Link href="/auctions" className="text-sm text-base-500 hover:text-white mb-6 inline-block no-underline">
        ← Back to Auctions
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{auction.mineralName ?? 'Mineral'}</h1>
          <div className="flex gap-2 mt-2">
            <Badge variant="info">{auction.type}</Badge>
            <Badge variant={auction.status === 'OPEN' ? 'verified' : 'default'}>{auction.status}</Badge>
          </div>
        </div>
        {auction.status === 'OPEN' && !countdown.isExpired && (
          <GlassCard glow className="px-5 py-3 text-center">
            <div className="text-[10px] text-base-500 uppercase">Ends in</div>
            <div className="font-mono-nums text-lg font-bold text-white">{countdown.formatted}</div>
          </GlassCard>
        )}
      </div>

      {/* Current State */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <GlassCard className="p-4 text-center">
          <div className="text-[10px] uppercase text-base-500 mb-1">Best Bid</div>
          <div className="font-mono-nums text-lg font-bold text-accent-light">
            {auction.currentBestBidPaise ? formatPaise(auction.currentBestBidPaise) : '—'}
          </div>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <div className="text-[10px] uppercase text-base-500 mb-1">Quantity</div>
          <div className="font-mono-nums text-lg font-bold text-white">{auction.quantity} {auction.unit}</div>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <div className="text-[10px] uppercase text-base-500 mb-1">Total Bids</div>
          <div className="font-mono-nums text-lg font-bold text-white">{auction.bids?.length ?? 0}</div>
        </GlassCard>
      </div>

      {/* Place Bid */}
      {auction.status === 'OPEN' && !countdown.isExpired && (
        <GlassCard strong className="p-5 mb-6">
          <h3 className="text-sm font-medium text-white mb-3">Place Your Bid</h3>
          {error && <div className="text-xs text-red-400 mb-2">{error}</div>}
          <form onSubmit={placeBid} className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs text-base-500 mb-1">Amount (paise)</label>
              <input
                type="number"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                className="glass-input w-full px-4 py-3 text-sm text-white font-mono-nums"
                placeholder="Enter bid amount"
                required
              />
            </div>
            <Button type="submit" isLoading={placing}>Place Bid</Button>
          </form>
          <div className="flex gap-2 mt-3">
            <button onClick={() => quickBid(5)} className="text-xs glass px-3 py-1.5 text-accent-light hover:border-accent/30 transition-all">+5%</button>
            <button onClick={() => quickBid(10)} className="text-xs glass px-3 py-1.5 text-accent-light hover:border-accent/30 transition-all">+10%</button>
            <button onClick={() => quickBid(15)} className="text-xs glass px-3 py-1.5 text-accent-light hover:border-accent/30 transition-all">+15%</button>
          </div>
        </GlassCard>
      )}

      {/* Bid History */}
      <GlassCard className="p-5">
        <h3 className="text-sm font-medium text-base-500 uppercase tracking-wider mb-4">Bid History</h3>
        {!auction.bids || auction.bids.length === 0 ? (
          <div className="text-center text-base-500 py-6">No bids yet. Be the first!</div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {auction.bids
              .sort((a, b) => b.amountPaise - a.amountPaise)
              .map((bid, idx) => (
                <div key={bid.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-2">
                    {idx === 0 && <span className="text-xs text-sage">★</span>}
                    <span className="text-sm text-white">{bid.bidderOrgName ?? 'Bidder'}</span>
                  </div>
                  <div className="text-right">
                    <div className={`font-mono-nums text-sm font-medium ${idx === 0 ? 'text-sage' : 'text-white'}`}>
                      {formatPaise(bid.amountPaise)}
                    </div>
                    <div className="text-[10px] text-base-500">{formatDate(bid.createdAt)}</div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

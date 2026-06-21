'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiRequestError } from '@/lib/api-client';
import { formatPaise, formatQuantity } from '@/lib/format';
import { GlassCard } from '@/components/ui/glass-card';
import { PageHeader } from '@/components/ui/page-header';
import { GradeDisplay } from '@/components/grade-display';
import { Badge, Button } from '@khanij/ui';

interface Mineral {
  id: string;
  name: string;
}

interface Listing {
  id: string;
  mineralName?: string;
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
}

interface SearchResult {
  id: string;
  mineralName: string;
  grade: Record<string, number>;
  pricePerMtPaise: number;
  quantityMt: number;
  state: string;
  sellerName: string;
  trustScore: number;
}

const STATES = [
  'All States', 'Odisha', 'Jharkhand', 'Karnataka', 'Chhattisgarh', 'Goa',
  'Rajasthan', 'Madhya Pradesh', 'Maharashtra', 'Andhra Pradesh',
];

export default function MarketplacePage() {
  const router = useRouter();
  const [mode, setMode] = useState<'browse' | 'search'>('browse');
  const [listings, setListings] = useState<Listing[]>([]);
  const [minerals, setMinerals] = useState<Mineral[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  // Filters
  const [filterMineral, setFilterMineral] = useState('');
  const [filterState, setFilterState] = useState('All States');

  useEffect(() => {
    Promise.all([
      api<Listing[]>('/api/v1/listings').catch(() => []),
      api<Mineral[]>('/api/v1/catalog').catch(() => []),
    ]).then(([l, m]) => {
      setListings(l);
      setMinerals(m);
    }).finally(() => setLoading(false));
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const data = await api<{ results: SearchResult[] }>('/discovery/search', {
        method: 'POST',
        body: JSON.stringify({ query: searchQuery.trim() }),
      });
      setSearchResults(data.results ?? []);
      setMode('search');
    } catch { /* ignore */ } finally {
      setSearching(false);
    }
  }

  const filtered = listings.filter((l) => {
    if (l.status !== 'ACTIVE') return false;
    if (filterMineral && l.mineralId !== filterMineral) return false;
    if (filterState !== 'All States' && l.location.state !== filterState) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="max-w-6xl space-y-4">
        <div className="skeleton h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="skeleton h-52" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <PageHeader title="Marketplace" subtitle="Browse active listings or use AI-powered search" />

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder='AI Search: "Iron ore 62% Fe from Odisha under ₹6000/MT"'
            className="glass-input flex-1 px-5 py-3 text-sm text-white placeholder:text-base-400"
          />
          <Button type="submit" isLoading={searching}>Search</Button>
          {mode === 'search' && (
            <Button variant="ghost" onClick={() => setMode('browse')}>Browse All</Button>
          )}
        </div>
      </form>

      {/* Filters (browse mode) */}
      {mode === 'browse' && (
        <div className="flex gap-3 mb-6 flex-wrap">
          <select
            value={filterMineral}
            onChange={(e) => setFilterMineral(e.target.value)}
            className="glass-input px-4 py-2 text-sm text-white"
          >
            <option value="" className="bg-base-200">All Minerals</option>
            {minerals.map((m) => (
              <option key={m.id} value={m.id} className="bg-base-200">{m.name}</option>
            ))}
          </select>
          <select
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
            className="glass-input px-4 py-2 text-sm text-white"
          >
            {STATES.map((s) => (
              <option key={s} value={s} className="bg-base-200">{s}</option>
            ))}
          </select>
          <div className="ml-auto text-sm text-base-500 self-center">
            {filtered.length} listing{filtered.length !== 1 ? 's' : ''} found
          </div>
        </div>
      )}

      {/* Browse Results */}
      {mode === 'browse' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((listing) => (
            <GlassCard key={listing.id} hoverable className="p-5 flex flex-col" onClick={() => router.push(`/marketplace/${listing.id}`)}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-white">{listing.mineralName ?? 'Mineral'}</h3>
                {listing.trustScore && (
                  <Badge variant={listing.trustScore >= 80 ? 'verified' : listing.trustScore >= 50 ? 'pending' : 'warning'}>
                    {listing.trustScore}
                  </Badge>
                )}
              </div>

              <GradeDisplay grade={listing.grade} compact />

              <div className="mt-auto pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-base-500">Price/MT</span>
                  <span className="font-mono-nums font-semibold text-accent-light">{formatPaise(listing.askPriceInPaise)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-base-500">Available</span>
                  <span className="font-mono-nums">{formatQuantity(listing.quantityAvailable, listing.unit)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-base-500">Location</span>
                  <span>{listing.location.district}, {listing.location.state}</span>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                className="mt-4 w-full"
                onClick={(e) => { e.stopPropagation(); router.push(`/marketplace/${listing.id}`); }}
              >
                Send RFQ →
              </Button>
            </GlassCard>
          ))}

          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16 text-base-500">
              No active listings match your filters. Try broadening your search.
            </div>
          )}
        </div>
      )}

      {/* AI Search Results */}
      {mode === 'search' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {searchResults.map((result) => (
            <GlassCard key={result.id} hoverable className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-white">{result.mineralName}</h3>
                <Badge variant={result.trustScore >= 80 ? 'verified' : result.trustScore >= 50 ? 'pending' : 'warning'}>
                  Trust: {result.trustScore}
                </Badge>
              </div>
              <p className="text-sm text-base-500 mb-3">{result.sellerName} — {result.state}</p>
              <GradeDisplay grade={result.grade} compact />
              <div className="mt-4 flex justify-between text-sm">
                <span className="text-base-500">Price/MT</span>
                <span className="font-mono-nums font-semibold text-accent-light">{formatPaise(result.pricePerMtPaise)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-base-500">Available</span>
                <span className="font-mono-nums">{formatQuantity(result.quantityMt)}</span>
              </div>
            </GlassCard>
          ))}

          {searchResults.length === 0 && (
            <div className="col-span-full text-center py-16 text-base-500">
              No results found. Try a different search query.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { api, ApiRequestError } from '@/lib/api-client';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@khanij/ui';

interface SearchResult {
  id: string;
  mineralName: string;
  grade: Record<string, number>;
  pricePerMtPaise: number;
  quantityMt: number;
  state: string;
  sellerName: string;
  trustScore: number;
  status: string;
}

interface SearchResponse {
  results: SearchResult[];
  intent?: {
    mineral?: string;
    state?: string;
    maxPrice?: number;
    minQuantity?: number;
  };
}

export default function MarketplacePage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [intent, setIntent] = useState<SearchResponse['intent']>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');

    try {
      const data = await api<SearchResponse>('/discovery/search', {
        method: 'POST',
        body: JSON.stringify({ query: query.trim() }),
      });
      setResults(data.results ?? []);
      setIntent(data.intent);
      setSearched(true);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.body.message);
      } else {
        setError('Search failed');
      }
    } finally {
      setLoading(false);
    }
  }

  function formatPaise(paise: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(paise / 100);
  }

  function formatGrade(grade: Record<string, number>): string {
    return Object.entries(grade)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Marketplace</h1>
        <p className="text-base-500 mt-1">
          Search minerals using natural language — AI interprets your intent
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3 mb-8">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Try: "Iron ore 62% Fe from Odisha under ₹6000/MT"'
          className="flex-1 rounded-lg border border-base-300 bg-base-200 px-4 py-2.5 text-sm text-white placeholder:text-base-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <Button type="submit" isLoading={loading}>
          Search
        </Button>
      </form>

      {error && (
        <div className="rounded-md border border-red-800/40 bg-red-900/20 px-4 py-3 text-sm text-red-400 mb-6">
          {error}
        </div>
      )}

      {intent && (
        <div className="flex gap-2 flex-wrap mb-6">
          {intent.mineral && <Badge variant="info">Mineral: {intent.mineral}</Badge>}
          {intent.state && <Badge variant="info">State: {intent.state}</Badge>}
          {intent.maxPrice && (
            <Badge variant="info">Max: {formatPaise(intent.maxPrice)}/MT</Badge>
          )}
          {intent.minQuantity && (
            <Badge variant="info">Min qty: {intent.minQuantity} MT</Badge>
          )}
        </div>
      )}

      {searched && results.length === 0 && (
        <div className="text-center py-12 text-base-500">
          No listings found. Try a different search query.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {results.map((listing) => (
          <Card key={listing.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{listing.mineralName}</CardTitle>
                <Badge
                  variant={
                    listing.trustScore >= 80
                      ? 'verified'
                      : listing.trustScore >= 50
                        ? 'pending'
                        : 'warning'
                  }
                >
                  Trust: {listing.trustScore}
                </Badge>
              </div>
              <CardDescription>{listing.sellerName} — {listing.state}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-base-500">Grade</span>
                  <span className="font-mono">{formatGrade(listing.grade)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-500">Price/MT</span>
                  <span className="font-semibold text-accent-light">
                    {formatPaise(listing.pricePerMtPaise)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-500">Available</span>
                  <span>{listing.quantityMt.toLocaleString()} MT</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

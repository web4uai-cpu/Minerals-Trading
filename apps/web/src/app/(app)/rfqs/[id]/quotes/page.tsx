'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiRequestError } from '@/lib/api-client';
import { formatPaise, formatDate } from '@/lib/format';
import { GlassCard } from '@/components/ui/glass-card';
import { Badge, Button } from '@khanij/ui';
import Link from 'next/link';

interface Quote {
  id: string;
  rfqId: string;
  pricePerUnitPaise: number;
  validUntil: string;
  status: string;
  sellerOrgName?: string;
  sellerTrustScore?: number;
  terms?: Record<string, unknown>;
  createdAt: string;
}

export default function QuoteComparisonPage() {
  const params = useParams();
  const router = useRouter();
  const rfqId = params.id as string;

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Quote[]>(`/api/v1/quotes/by-rfq/${rfqId}`)
      .then(setQuotes)
      .catch(() => setError('Failed to load quotes'))
      .finally(() => setLoading(false));
  }, [rfqId]);

  async function acceptQuote(quoteId: string) {
    setActing(quoteId);
    try {
      await api(`/api/v1/quotes/${quoteId}/accept`, { method: 'PATCH' });
      router.push('/deals');
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.body.message);
    } finally {
      setActing(null);
    }
  }

  async function rejectQuote(quoteId: string) {
    setActing(quoteId);
    try {
      await api(`/api/v1/quotes/${quoteId}/reject`, { method: 'PATCH' });
      setQuotes((prev) => prev.map((q) => q.id === quoteId ? { ...q, status: 'REJECTED' } : q));
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.body.message);
    } finally {
      setActing(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl space-y-4">
        <div className="skeleton h-6 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => <div key={i} className="skeleton h-56" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <Link href="/rfqs" className="text-sm text-base-500 hover:text-white mb-6 inline-block no-underline">
        ← Back to RFQs
      </Link>

      <h1 className="text-2xl font-bold text-white mb-2">Compare Quotes</h1>
      <p className="text-base-500 text-sm mb-8">
        {quotes.length} quote{quotes.length !== 1 ? 's' : ''} received — accept the best offer to create a deal
      </p>

      {error && <div className="glass px-4 py-3 text-sm text-red-400 mb-6">{error}</div>}

      {quotes.length === 0 ? (
        <GlassCard className="p-12 text-center text-base-500">
          No quotes received yet. Sellers will respond soon.
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {quotes
            .sort((a, b) => a.pricePerUnitPaise - b.pricePerUnitPaise)
            .map((quote, idx) => (
              <GlassCard
                key={quote.id}
                strong={idx === 0}
                className={`p-6 relative ${idx === 0 ? 'ring-1 ring-accent/30' : ''}`}
              >
                {idx === 0 && (
                  <div className="absolute -top-2 -right-2">
                    <Badge variant="verified">Best Price</Badge>
                  </div>
                )}

                <div className="mb-4">
                  <div className="text-sm text-base-500 mb-1">
                    {quote.sellerOrgName ?? 'Seller'}
                  </div>
                  {quote.sellerTrustScore && (
                    <Badge variant={quote.sellerTrustScore >= 80 ? 'verified' : 'pending'}>
                      Trust: {quote.sellerTrustScore}
                    </Badge>
                  )}
                </div>

                <div className="font-mono-nums text-3xl font-bold text-accent-light mb-1">
                  {formatPaise(quote.pricePerUnitPaise)}
                </div>
                <div className="text-xs text-base-500 mb-4">per MT</div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-base-500">Valid until</span>
                    <span>{formatDate(quote.validUntil)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-base-500">Submitted</span>
                    <span>{formatDate(quote.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-base-500">Status</span>
                    <Badge variant={quote.status === 'SENT' ? 'info' : quote.status === 'ACCEPTED' ? 'verified' : 'error'}>
                      {quote.status}
                    </Badge>
                  </div>
                </div>

                {quote.status === 'SENT' && (
                  <div className="mt-5 flex gap-2">
                    <Button
                      className="flex-1"
                      isLoading={acting === quote.id}
                      onClick={() => acceptQuote(quote.id)}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="ghost"
                      className="flex-1"
                      isLoading={acting === quote.id}
                      onClick={() => rejectQuote(quote.id)}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </GlassCard>
            ))}
        </div>
      )}
    </div>
  );
}

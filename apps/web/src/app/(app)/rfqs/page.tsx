'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiRequestError } from '@/lib/api-client';
import { formatPaise, formatQuantity, formatDate } from '@/lib/format';
import { useAuth } from '@/context/auth-context';
import { GlassCard } from '@/components/ui/glass-card';
import { PageHeader } from '@/components/ui/page-header';
import { GradeDisplay } from '@/components/grade-display';
import { Badge, Button } from '@khanij/ui';

interface Rfq {
  id: string;
  mineralName?: string;
  mineralId: string;
  grade: Record<string, number>;
  quantity: number;
  unit: string;
  neededBy: string;
  notes?: string;
  status: string;
  quotesCount?: number;
  createdAt: string;
  buyerOrgName?: string;
}

const STATUS_VARIANT: Record<string, 'verified' | 'pending' | 'info' | 'error' | 'default'> = {
  OPEN: 'info',
  QUOTED: 'pending',
  CLOSED: 'verified',
  CANCELLED: 'error',
};

export default function RfqsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isSeller = user?.role === 'SELLER';
  const [tab, setTab] = useState<'mine' | 'inbox'>(isSeller ? 'inbox' : 'mine');
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [loading, setLoading] = useState(true);

  // Quote form state (seller)
  const [quoting, setQuoting] = useState<string | null>(null);
  const [quoteForm, setQuoteForm] = useState({ price: '', validDays: '7' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRfqs();
  }, [tab]);

  async function loadRfqs() {
    setLoading(true);
    try {
      const endpoint = tab === 'mine' ? '/api/v1/rfqs/mine' : '/api/v1/rfqs/inbox';
      const data = await api<Rfq[]>(endpoint);
      setRfqs(data);
    } catch {
      setRfqs([]);
    } finally {
      setLoading(false);
    }
  }

  async function submitQuote(rfqId: string) {
    setSubmitting(true);
    setError('');
    try {
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + Number(quoteForm.validDays));

      await api('/api/v1/quotes', {
        method: 'POST',
        body: JSON.stringify({
          rfqId,
          pricePerUnitPaise: Number(quoteForm.price),
          validUntil: validUntil.toISOString(),
        }),
      });
      setQuoting(null);
      setQuoteForm({ price: '', validDays: '7' });
      await loadRfqs();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.body.message);
      else setError('Failed to submit quote');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title="Requests for Quote" subtitle="Manage your RFQs and respond to buyer requests" />

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('mine')}
          className={`glass px-5 py-2.5 text-sm font-medium transition-all ${tab === 'mine' ? 'border-accent/40 text-accent-light' : 'text-base-500 hover:text-white'}`}
        >
          My RFQs
        </button>
        {isSeller && (
          <button
            onClick={() => setTab('inbox')}
            className={`glass px-5 py-2.5 text-sm font-medium transition-all ${tab === 'inbox' ? 'border-accent/40 text-accent-light' : 'text-base-500 hover:text-white'}`}
          >
            Inbox
          </button>
        )}
      </div>

      {error && <div className="glass px-4 py-3 text-sm text-red-400 mb-4">{error}</div>}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-32" />)}
        </div>
      ) : rfqs.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <div className="text-base-500 mb-4">
            {tab === 'mine' ? 'No RFQs sent yet.' : 'No incoming RFQs.'}
          </div>
          {tab === 'mine' && (
            <Button variant="secondary" onClick={() => router.push('/marketplace')}>
              Browse Marketplace
            </Button>
          )}
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {rfqs.map((rfq) => (
            <GlassCard key={rfq.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-base font-semibold text-white">{rfq.mineralName ?? 'Mineral'}</h3>
                  <p className="text-sm text-base-500 mt-0.5">
                    {tab === 'inbox' && rfq.buyerOrgName && <span>{rfq.buyerOrgName} · </span>}
                    Needed by {formatDate(rfq.neededBy)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[rfq.status] ?? 'default'}>{rfq.status}</Badge>
                  {rfq.quotesCount !== undefined && rfq.quotesCount > 0 && (
                    <Badge variant="info">{rfq.quotesCount} quotes</Badge>
                  )}
                </div>
              </div>

              <div className="flex gap-6 text-sm mb-3">
                <div>
                  <span className="text-base-500">Quantity: </span>
                  <span className="font-mono-nums">{formatQuantity(rfq.quantity, rfq.unit)}</span>
                </div>
              </div>

              <GradeDisplay grade={rfq.grade} compact />

              {rfq.notes && (
                <p className="text-sm text-base-500 mt-3 italic">&ldquo;{rfq.notes}&rdquo;</p>
              )}

              {/* Actions */}
              <div className="mt-4 flex gap-2">
                {tab === 'mine' && rfq.status === 'OPEN' && rfq.quotesCount && rfq.quotesCount > 0 && (
                  <Button size="sm" onClick={() => router.push(`/rfqs/${rfq.id}/quotes`)}>
                    Compare Quotes
                  </Button>
                )}
                {tab === 'inbox' && rfq.status === 'OPEN' && quoting !== rfq.id && (
                  <Button size="sm" variant="secondary" onClick={() => setQuoting(rfq.id)}>
                    Submit Quote
                  </Button>
                )}
              </div>

              {/* Inline Quote Form (seller) */}
              {quoting === rfq.id && (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-base-500 mb-1">Price per {rfq.unit} (paise)</label>
                      <input
                        type="number"
                        value={quoteForm.price}
                        onChange={(e) => setQuoteForm((f) => ({ ...f, price: e.target.value }))}
                        className="glass-input w-full px-3 py-2 text-sm text-white"
                        placeholder="e.g. 585000"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-base-500 mb-1">Valid for (days)</label>
                      <input
                        type="number"
                        value={quoteForm.validDays}
                        onChange={(e) => setQuoteForm((f) => ({ ...f, validDays: e.target.value }))}
                        className="glass-input w-full px-3 py-2 text-sm text-white"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" isLoading={submitting} onClick={() => submitQuote(rfq.id)}>
                      Send Quote
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setQuoting(null)}>Cancel</Button>
                  </div>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

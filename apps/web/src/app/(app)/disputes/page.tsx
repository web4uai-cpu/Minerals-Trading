'use client';

import { useEffect, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { GlassCard } from '@/components/ui/glass-card';
import { PageHeader } from '@/components/ui/page-header';
import { Badge, Button } from '@khanij/ui';

interface Deal { id: string; mineralName: string; status: string; }
interface Dispute {
  id: string;
  dealId: string;
  category: string;
  description: string;
  status: string;
  createdAt: string;
}

const STATUS_VARIANT: Record<string, 'verified' | 'pending' | 'info' | 'warning' | 'error' | 'default'> = {
  FILED: 'info',
  UNDER_REVIEW: 'pending',
  HEARING: 'warning',
  AWARD_ISSUED: 'verified',
  CLOSED: 'default',
};

const CATEGORIES = ['QUALITY', 'QUANTITY', 'PAYMENT', 'DELIVERY', 'OTHER'];

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFile, setShowFile] = useState(false);
  const [filing, setFiling] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ dealId: '', category: 'QUALITY', description: '' });

  useEffect(() => {
    Promise.all([
      api<Deal[]>('/api/v1/deals').catch(() => []),
    ]).then(([d]) => {
      setDeals(d);
      if (d.length > 0) setForm((f) => ({ ...f, dealId: d[0]?.id ?? '' }));
    }).finally(() => setLoading(false));
  }, []);

  async function fileDispute(e: React.FormEvent) {
    e.preventDefault();
    setFiling(true);
    setError('');
    try {
      const dispute = await api<Dispute>('/api/v1/disputes', {
        method: 'POST',
        body: JSON.stringify({
          dealId: form.dealId,
          category: form.category,
          description: form.description,
        }),
      });
      setDisputes((prev) => [dispute, ...prev]);
      setShowFile(false);
      setForm({ dealId: deals[0]?.id ?? '', category: 'QUALITY', description: '' });
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.body.message);
      else setError('Failed to file dispute');
    } finally {
      setFiling(false);
    }
  }

  if (loading) return <div className="max-w-4xl"><div className="skeleton h-8 w-48 mb-6" /><div className="skeleton h-48" /></div>;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Disputes & Arbitration"
        subtitle="File disputes, submit evidence, track proceedings"
        action={{ label: showFile ? 'Cancel' : 'File Dispute', onClick: () => setShowFile(!showFile) }}
      />

      {error && <div className="glass px-4 py-3 text-sm text-red-400 mb-4">{error}</div>}

      {showFile && (
        <GlassCard strong className="p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">File a Dispute</h3>
          <form onSubmit={fileDispute} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-base-500 uppercase mb-2">Deal</label>
                <select value={form.dealId} onChange={(e) => setForm((f) => ({ ...f, dealId: e.target.value }))} className="glass-input w-full px-3 py-2 text-sm text-white">
                  {deals.map((d) => <option key={d.id} value={d.id} className="bg-base-200">{d.mineralName} ({d.status})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-base-500 uppercase mb-2">Category</label>
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="glass-input w-full px-3 py-2 text-sm text-white">
                  {CATEGORIES.map((c) => <option key={c} value={c} className="bg-base-200">{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-base-500 uppercase mb-2">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="glass-input w-full px-4 py-3 text-sm text-white h-24 resize-none"
                placeholder="Describe the issue in detail..."
                required
              />
            </div>
            <Button type="submit" isLoading={filing}>File Dispute</Button>
          </form>
        </GlassCard>
      )}

      {disputes.length === 0 && !showFile && (
        <GlassCard className="p-12 text-center">
          <div className="text-3xl mb-3">⚖️</div>
          <div className="text-base-500 mb-2">No disputes filed</div>
          <p className="text-xs text-base-500">File a dispute against a deal if there&apos;s a quality, quantity, or delivery issue.</p>
        </GlassCard>
      )}

      <div className="space-y-3">
        {disputes.map((dispute) => (
          <GlassCard key={dispute.id} className="p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[dispute.status] ?? 'default'}>{dispute.status}</Badge>
                <Badge>{dispute.category}</Badge>
              </div>
              <span className="text-xs text-base-500">{formatDate(dispute.createdAt)}</span>
            </div>
            <p className="text-sm text-white/80">{dispute.description}</p>

            {/* Status timeline dots */}
            <div className="flex items-center gap-1 mt-3">
              {['FILED', 'UNDER_REVIEW', 'HEARING', 'AWARD_ISSUED', 'CLOSED'].map((s, idx) => {
                const reached = ['FILED', 'UNDER_REVIEW', 'HEARING', 'AWARD_ISSUED', 'CLOSED'].indexOf(dispute.status) >= idx;
                return (
                  <div key={s} className="flex items-center">
                    <div className={`w-2 h-2 rounded-full ${reached ? 'bg-accent' : 'bg-white/10'}`} />
                    {idx < 4 && <div className={`w-4 h-0.5 ${reached ? 'bg-accent/50' : 'bg-white/5'}`} />}
                  </div>
                );
              })}
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

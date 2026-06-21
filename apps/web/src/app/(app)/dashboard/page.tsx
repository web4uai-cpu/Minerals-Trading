'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { formatPaise, formatDate } from '@/lib/format';
import { useAuth } from '@/context/auth-context';
import { GlassCard } from '@/components/ui/glass-card';
import { StatCard } from '@/components/ui/stat-card';
import { Badge, Button } from '@khanij/ui';

interface Deal {
  id: string;
  status: string;
  mineralName: string;
  totalPaise: number;
  createdAt: string;
}

interface Rfq {
  id: string;
  mineralName?: string;
  status: string;
  quantity: number;
  unit: string;
  createdAt: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<Deal[]>('/api/v1/deals').catch(() => []),
      api<Rfq[]>(user?.role === 'SELLER' ? '/api/v1/rfqs/inbox' : '/api/v1/rfqs/mine').catch(() => []),
    ]).then(([d, r]) => {
      setDeals(d);
      setRfqs(r);
    }).finally(() => setLoading(false));
  }, [user?.role]);

  const activeDeals = deals.filter((d) => !['COMPLETED', 'CANCELLED'].includes(d.status)).length;
  const pendingRfqs = rfqs.filter((r) => r.status === 'OPEN').length;
  const totalVolume = deals.reduce((sum, d) => sum + d.totalPaise, 0);
  const recentActivity = [...deals.map((d) => ({ type: 'deal' as const, ...d })), ...rfqs.map((r) => ({ type: 'rfq' as const, ...r, totalPaise: 0 }))]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  if (loading) {
    return (
      <div className="max-w-5xl space-y-4">
        <div className="skeleton h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map((i) => <div key={i} className="skeleton h-24" />)}</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-base-500 mt-1">
          Welcome back — signed in as{' '}
          <Badge variant={user?.role === 'ADMIN' ? 'info' : user?.role === 'SELLER' ? 'verified' : 'pending'}>
            {user?.role}
          </Badge>
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Deals" value={activeDeals} />
        <StatCard label="Pending RFQs" value={pendingRfqs} />
        <StatCard label="Total Volume" value={formatPaise(totalVolume)} />
        <StatCard label="Total Deals" value={deals.length} />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 mb-8 flex-wrap">
        <Button onClick={() => router.push('/marketplace')}>Browse Marketplace</Button>
        <Button variant="secondary" onClick={() => router.push('/rfqs')}>View RFQs</Button>
        <Button variant="secondary" onClick={() => router.push('/auctions')}>Live Auctions</Button>
        {user?.role === 'SELLER' && (
          <Button variant="secondary" onClick={() => router.push('/listings')}>My Listings</Button>
        )}
      </div>

      {/* Recent Activity */}
      <GlassCard className="p-5">
        <h3 className="text-sm font-medium text-base-500 uppercase tracking-wider mb-4">Recent Activity</h3>
        {recentActivity.length === 0 ? (
          <div className="text-center text-base-500 py-8">
            No activity yet. Start by browsing the marketplace.
          </div>
        ) : (
          <div className="space-y-3">
            {recentActivity.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors"
                onClick={() => item.type === 'deal' ? router.push(`/deals/${item.id}`) : router.push('/rfqs')}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${item.type === 'deal' ? 'bg-accent' : 'bg-sage'}`} />
                  <div>
                    <span className="text-sm text-white">{item.mineralName ?? 'Mineral'}</span>
                    <span className="text-xs text-base-500 ml-2">
                      {item.type === 'deal' ? 'Deal' : 'RFQ'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={item.status === 'OPEN' ? 'info' : item.status === 'COMPLETED' ? 'verified' : 'default'}>
                    {item.status}
                  </Badge>
                  <div className="text-[10px] text-base-500 mt-0.5">{formatDate(item.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

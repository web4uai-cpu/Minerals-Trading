'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@khanij/ui';

interface Milestone {
  id: string;
  type: string;
  status: string;
  completedAt: string | null;
}

interface DealDetail {
  id: string;
  status: string;
  mineralName: string;
  quantityMt: number;
  pricePerMtPaise: number;
  totalPaise: number;
  createdAt: string;
  milestones: Milestone[];
}

interface LedgerEntry {
  id: string;
  type: string;
  amountPaise: number;
  createdAt: string;
}

const MILESTONE_VARIANT: Record<string, 'verified' | 'pending' | 'default'> = {
  COMPLETED: 'verified',
  IN_PROGRESS: 'pending',
  PENDING: 'default',
};

export default function DealDetailPage() {
  const params = useParams();
  const dealId = params.id as string;
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api<DealDetail>(`/api/v1/deals/${dealId}`),
      api<LedgerEntry[]>(`/api/v1/deals/${dealId}/ledger`).catch(() => []),
    ])
      .then(([d, l]) => {
        setDeal(d);
        setLedger(l);
      })
      .catch(() => setError('Failed to load deal'))
      .finally(() => setLoading(false));
  }, [dealId]);

  function formatPaise(paise: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(paise / 100);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="max-w-3xl">
        <div className="rounded-md border border-red-800/40 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error || 'Deal not found'}
        </div>
        <Link href="/deals" className="text-accent-light text-sm mt-4 inline-block">
          &larr; Back to deals
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <Link href="/deals" className="text-sm text-base-500 hover:text-white mb-4 inline-block">
        &larr; Back to deals
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{deal.mineralName}</h1>
        <Badge variant={deal.status === 'COMPLETED' ? 'verified' : 'pending'}>
          {deal.status.replace(/_/g, ' ')}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="text-center">
            <div className="text-sm text-base-500">Quantity</div>
            <div className="text-lg font-semibold">{deal.quantityMt.toLocaleString()} MT</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <div className="text-sm text-base-500">Price/MT</div>
            <div className="text-lg font-semibold text-accent-light">
              {formatPaise(deal.pricePerMtPaise)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <div className="text-sm text-base-500">Total Value</div>
            <div className="text-lg font-semibold">{formatPaise(deal.totalPaise)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          {deal.milestones.length === 0 ? (
            <p className="text-sm text-base-500">No milestones yet</p>
          ) : (
            <div className="space-y-3">
              {deal.milestones.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between py-2 border-b border-base-300 last:border-0"
                >
                  <span className="text-sm">{m.type.replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-2">
                    {m.completedAt && (
                      <span className="text-xs text-base-500">
                        {new Date(m.completedAt).toLocaleDateString('en-IN')}
                      </span>
                    )}
                    <Badge variant={MILESTONE_VARIANT[m.status] ?? 'default'}>
                      {m.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {ledger.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Escrow Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ledger.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-2 border-b border-base-300 last:border-0 text-sm"
                >
                  <div>
                    <span className="font-medium">{entry.type}</span>
                    <span className="text-base-500 ml-2">
                      {new Date(entry.createdAt).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                  <span
                    className={
                      entry.type === 'HOLD'
                        ? 'text-accent-light'
                        : entry.type === 'RELEASE'
                          ? 'text-sage'
                          : 'text-red-400'
                    }
                  >
                    {formatPaise(entry.amountPaise)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@khanij/ui';

interface Deal {
  id: string;
  status: string;
  mineralName: string;
  quantityMt: number;
  pricePerMtPaise: number;
  totalPaise: number;
  buyerOrgName?: string;
  sellerOrgName?: string;
  createdAt: string;
}

const STATUS_VARIANT: Record<string, 'verified' | 'pending' | 'warning' | 'error' | 'info' | 'default'> = {
  CREATED: 'default',
  ESCROW_HELD: 'info',
  IN_PROGRESS: 'pending',
  BUYER_SIGNED: 'info',
  DUAL_SIGNED: 'verified',
  COMPLETED: 'verified',
  CANCELLED: 'error',
  DISPUTED: 'warning',
};

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Deal[]>('/api/v1/deals')
      .then(setDeals)
      .catch(() => setError('Failed to load deals'))
      .finally(() => setLoading(false));
  }, []);

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

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Deals</h1>
        <p className="text-base-500 mt-1">Track your active and past deals</p>
      </div>

      {error && (
        <div className="rounded-md border border-red-800/40 bg-red-900/20 px-4 py-3 text-sm text-red-400 mb-6">
          {error}
        </div>
      )}

      {deals.length === 0 && !error && (
        <div className="text-center py-12 text-base-500">
          No deals yet. Start by browsing the{' '}
          <Link href="/marketplace" className="text-accent-light hover:underline">
            marketplace
          </Link>
          .
        </div>
      )}

      <div className="space-y-3">
        {deals.map((deal) => (
          <Link key={deal.id} href={`/deals/${deal.id}`}>
            <Card className="hover:border-accent/50 transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{deal.mineralName}</CardTitle>
                  <Badge variant={STATUS_VARIANT[deal.status] ?? 'default'}>
                    {deal.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <CardDescription>
                  {deal.sellerOrgName ?? 'Seller'} → {deal.buyerOrgName ?? 'Buyer'}
                  {' · '}
                  {new Date(deal.createdAt).toLocaleDateString('en-IN')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className="text-base-500">Quantity: </span>
                    <span>{deal.quantityMt.toLocaleString()} MT</span>
                  </div>
                  <div>
                    <span className="text-base-500">Price/MT: </span>
                    <span className="text-accent-light">{formatPaise(deal.pricePerMtPaise)}</span>
                  </div>
                  <div>
                    <span className="text-base-500">Total: </span>
                    <span className="font-semibold">{formatPaise(deal.totalPaise)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

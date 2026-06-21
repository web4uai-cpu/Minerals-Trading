'use client';

import { useState } from 'react';
import { api, ApiRequestError } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@khanij/ui';
import Link from 'next/link';

interface Settlement {
  id: string;
  sourceCurrency: string;
  targetCurrency: string;
  amountSourcePaise: number;
  amountTargetPaise: number | null;
  forexRateSnapshot: number;
  status: string;
  paymentRef: string | null;
  createdAt: string;
}

const STATUS_VARIANT: Record<string, 'verified' | 'pending' | 'info' | 'error' | 'default'> = {
  PENDING_FOREX: 'default',
  FOREX_LOCKED: 'info',
  PAYMENT_INITIATED: 'pending',
  PAYMENT_CONFIRMED: 'info',
  SETTLED: 'verified',
  FAILED: 'error',
};

export default function SettlementsAdminPage() {
  const [settlementId, setSettlementId] = useState('');
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadSettlement() {
    if (!settlementId.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await api<Settlement>(`/api/v1/settlements/${settlementId.trim()}`);
      setSettlement(data);
    } catch {
      setError('Settlement not found');
      setSettlement(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: 'confirm' | 'settle') {
    if (!settlement) return;
    setActionLoading(true);
    setError('');
    try {
      const updated = await api<Settlement>(
        `/api/v1/settlements/${settlement.id}/${action}`,
        { method: 'PATCH' },
      );
      setSettlement(updated);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.body.message);
    } finally {
      setActionLoading(false);
    }
  }

  function formatPaise(paise: number): string {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 2,
    }).format(paise / 100);
  }

  const inputClass =
    'rounded-lg border border-base-300 bg-base-200 px-3 py-2 text-sm text-white placeholder:text-base-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

  return (
    <div className="max-w-3xl">
      <Link href="/admin" className="text-sm text-base-500 hover:text-white mb-4 inline-block">
        &larr; Back to Admin
      </Link>

      <h1 className="text-2xl font-bold mb-6">Settlement Management</h1>

      <div className="flex gap-2 mb-6">
        <input
          value={settlementId}
          onChange={(e) => setSettlementId(e.target.value)}
          className={inputClass + ' flex-1'}
          placeholder="Enter Settlement ID..."
        />
        <Button onClick={loadSettlement} isLoading={loading}>Load</Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-800/40 bg-red-900/20 px-4 py-3 text-sm text-red-400 mb-6">
          {error}
        </div>
      )}

      {settlement && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {settlement.sourceCurrency} → {settlement.targetCurrency}
              </CardTitle>
              <Badge variant={STATUS_VARIANT[settlement.status] ?? 'default'}>
                {settlement.status.replace(/_/g, ' ')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm mb-6">
              <div className="flex justify-between">
                <span className="text-base-500">Source Amount</span>
                <span>{formatPaise(settlement.amountSourcePaise)} {settlement.sourceCurrency}</span>
              </div>
              {settlement.amountTargetPaise && (
                <div className="flex justify-between">
                  <span className="text-base-500">Target Amount</span>
                  <span>{formatPaise(settlement.amountTargetPaise)} {settlement.targetCurrency}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-base-500">Forex Rate</span>
                <span className="font-mono">{settlement.forexRateSnapshot}</span>
              </div>
              {settlement.paymentRef && (
                <div className="flex justify-between">
                  <span className="text-base-500">Payment Ref</span>
                  <span className="font-mono">{settlement.paymentRef}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-base-500">Created</span>
                <span>{new Date(settlement.createdAt).toLocaleDateString('en-IN')}</span>
              </div>
            </div>

            <div className="flex gap-2">
              {settlement.status === 'PAYMENT_INITIATED' && (
                <Button isLoading={actionLoading} onClick={() => handleAction('confirm')}>
                  Confirm Payment
                </Button>
              )}
              {settlement.status === 'PAYMENT_CONFIRMED' && (
                <Button isLoading={actionLoading} onClick={() => handleAction('settle')}>
                  Mark Settled
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

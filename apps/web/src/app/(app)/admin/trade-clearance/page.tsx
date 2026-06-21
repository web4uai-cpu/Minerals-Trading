'use client';

import { useState } from 'react';
import { api, ApiRequestError } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@khanij/ui';
import Link from 'next/link';

interface TradeApplication {
  id: string;
  direction: string;
  mineralName: string;
  destinationCountry: string;
  clearanceStatus: string;
  quantityMt: number;
  valueFobPaise: number;
  dgftRefNumber: string | null;
  createdAt: string;
}

const STATUS_VARIANT: Record<string, 'verified' | 'pending' | 'info' | 'error' | 'default'> = {
  PENDING: 'default',
  APPLIED: 'info',
  APPROVED: 'verified',
  REJECTED: 'error',
};

export default function TradeClearancePage() {
  const [appId, setAppId] = useState('');
  const [app, setApp] = useState<TradeApplication | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadApplication() {
    if (!appId.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await api<TradeApplication>(`/api/v1/trade/applications/${appId.trim()}`);
      setApp(data);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.body.message);
      else setError('Application not found');
      setApp(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: 'approve' | 'reject') {
    if (!app) return;
    setActionLoading(true);
    setError('');
    try {
      let body = {};
      if (action === 'reject') {
        const reason = prompt('Rejection reason:');
        if (!reason) { setActionLoading(false); return; }
        body = { reason };
      }
      const updated = await api<TradeApplication>(
        `/api/v1/trade/applications/${app.id}/${action}`,
        { method: 'PATCH', body: JSON.stringify(body) },
      );
      setApp(updated);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.body.message);
    } finally {
      setActionLoading(false);
    }
  }

  function formatPaise(paise: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', maximumFractionDigits: 0,
    }).format(paise / 100);
  }

  const inputClass =
    'rounded-lg border border-base-300 bg-base-200 px-3 py-2 text-sm text-white placeholder:text-base-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

  return (
    <div className="max-w-3xl">
      <Link href="/admin" className="text-sm text-base-500 hover:text-white mb-4 inline-block">
        &larr; Back to Admin
      </Link>

      <h1 className="text-2xl font-bold mb-6">Trade Clearance</h1>

      <div className="flex gap-2 mb-6">
        <input
          value={appId}
          onChange={(e) => setAppId(e.target.value)}
          className={inputClass + ' flex-1'}
          placeholder="Enter Trade Application ID..."
        />
        <Button onClick={loadApplication} isLoading={loading}>Load</Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-800/40 bg-red-900/20 px-4 py-3 text-sm text-red-400 mb-6">
          {error}
        </div>
      )}

      {app && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{app.direction} — {app.mineralName}</CardTitle>
              <Badge variant={STATUS_VARIANT[app.clearanceStatus] ?? 'default'}>
                {app.clearanceStatus}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm mb-6">
              <div className="flex justify-between">
                <span className="text-base-500">Destination</span>
                <span>{app.destinationCountry}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-500">Quantity</span>
                <span>{app.quantityMt.toLocaleString()} MT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-500">FOB Value</span>
                <span>{formatPaise(app.valueFobPaise)}</span>
              </div>
              {app.dgftRefNumber && (
                <div className="flex justify-between">
                  <span className="text-base-500">DGFT Ref</span>
                  <span className="font-mono">{app.dgftRefNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-base-500">Created</span>
                <span>{new Date(app.createdAt).toLocaleDateString('en-IN')}</span>
              </div>
            </div>

            {app.clearanceStatus === 'APPLIED' && (
              <div className="flex gap-2">
                <Button isLoading={actionLoading} onClick={() => handleAction('approve')}>
                  Approve Clearance
                </Button>
                <Button variant="destructive" isLoading={actionLoading} onClick={() => handleAction('reject')}>
                  Reject
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

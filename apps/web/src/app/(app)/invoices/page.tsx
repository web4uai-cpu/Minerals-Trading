'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { formatPaise, formatDate } from '@/lib/format';
import { GlassCard } from '@/components/ui/glass-card';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@khanij/ui';

interface Invoice {
  id: string;
  dealId: string;
  status: string;
  totalPaise: number;
  gstPaise?: number;
  cgstPaise?: number;
  sgstPaise?: number;
  igstPaise?: number;
  issuedAt?: string;
  createdAt: string;
}

interface Deal { id: string; mineralName: string; }

const STATUS_VARIANT: Record<string, 'verified' | 'pending' | 'info' | 'default'> = {
  DRAFT: 'default',
  ISSUED: 'info',
  PAID: 'verified',
};

export default function InvoicesPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Deal[]>('/api/v1/deals')
      .then(async (dealList) => {
        setDeals(dealList);
        const allInvoices: Invoice[] = [];
        for (const deal of dealList.slice(0, 10)) {
          const inv = await api<Invoice[]>(`/api/v1/deals/${deal.id}/invoices`).catch(() => []);
          allInvoices.push(...inv);
        }
        setInvoices(allInvoices);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="max-w-4xl"><div className="skeleton h-8 w-48 mb-6" />{[1,2].map((i) => <div key={i} className="skeleton h-40 mb-3" />)}</div>;

  return (
    <div className="max-w-4xl">
      <PageHeader title="Invoices" subtitle="View and manage invoices across deals" />

      {invoices.length === 0 && (
        <GlassCard className="p-12 text-center">
          <div className="text-3xl mb-3">🧾</div>
          <div className="text-base-500">No invoices yet. Generate invoices from the Deal Room.</div>
        </GlassCard>
      )}

      <div className="space-y-4">
        {invoices.map((inv) => {
          const subtotal = inv.totalPaise - (inv.gstPaise ?? 0);

          return (
            <GlassCard key={inv.id} className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-sm font-medium text-white">Invoice</span>
                  <span className="text-xs text-base-500 ml-2 font-mono-nums">{inv.id.slice(0, 8)}</span>
                </div>
                <Badge variant={STATUS_VARIANT[inv.status] ?? 'default'}>{inv.status}</Badge>
              </div>

              <div className="glass p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-base-500">Subtotal</span>
                  <span className="font-mono-nums text-white">{formatPaise(subtotal)}</span>
                </div>
                {inv.cgstPaise !== undefined && inv.cgstPaise > 0 && (
                  <div className="flex justify-between">
                    <span className="text-base-500">CGST (9%)</span>
                    <span className="font-mono-nums text-base-500">{formatPaise(inv.cgstPaise)}</span>
                  </div>
                )}
                {inv.sgstPaise !== undefined && inv.sgstPaise > 0 && (
                  <div className="flex justify-between">
                    <span className="text-base-500">SGST (9%)</span>
                    <span className="font-mono-nums text-base-500">{formatPaise(inv.sgstPaise)}</span>
                  </div>
                )}
                {inv.igstPaise !== undefined && inv.igstPaise > 0 && (
                  <div className="flex justify-between">
                    <span className="text-base-500">IGST (18%)</span>
                    <span className="font-mono-nums text-base-500">{formatPaise(inv.igstPaise)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-white/10 font-semibold">
                  <span className="text-white">Total</span>
                  <span className="font-mono-nums text-accent-light text-base">{formatPaise(inv.totalPaise)}</span>
                </div>
              </div>

              <div className="flex gap-4 text-xs text-base-500 mt-3">
                <span>Created: {formatDate(inv.createdAt)}</span>
                {inv.issuedAt && <span>Issued: {formatDate(inv.issuedAt)}</span>}
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

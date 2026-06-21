'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { formatPaise, formatDate } from '@/lib/format';
import { GlassCard } from '@/components/ui/glass-card';
import { Badge, Button } from '@khanij/ui';

interface Invoice {
  id: string;
  status: string;
  totalPaise: number;
  gstPaise?: number;
  cgstPaise?: number;
  sgstPaise?: number;
  igstPaise?: number;
  issuedAt?: string;
  createdAt: string;
}

interface InvoicePanelProps {
  dealId: string;
  invoices: Invoice[];
  onUpdate: () => void;
}

export function InvoicePanel({ dealId, invoices, onUpdate }: InvoicePanelProps) {
  const [generating, setGenerating] = useState(false);

  async function generateInvoice() {
    setGenerating(true);
    try {
      await api(`/api/v1/deals/${dealId}/invoices`, { method: 'POST' });
      onUpdate();
    } catch { /* */ } finally {
      setGenerating(false);
    }
  }

  async function issueInvoice(invoiceId: string) {
    await api(`/api/v1/invoices/${invoiceId}/issue`, { method: 'PATCH' });
    onUpdate();
  }

  const STATUS_VARIANT: Record<string, 'verified' | 'pending' | 'info' | 'default'> = {
    DRAFT: 'default',
    ISSUED: 'info',
    PAID: 'verified',
  };

  return (
    <div className="space-y-4">
      {invoices.length === 0 && (
        <GlassCard className="p-8 text-center">
          <div className="text-base-500 mb-3">No invoices generated</div>
          <Button size="sm" isLoading={generating} onClick={generateInvoice}>Generate Invoice</Button>
        </GlassCard>
      )}

      {invoices.map((inv) => (
        <GlassCard key={inv.id} className="p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-white">Invoice</span>
            <Badge variant={STATUS_VARIANT[inv.status] ?? 'default'}>{inv.status}</Badge>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-base-500">Subtotal</span>
              <span className="font-mono-nums text-white">{formatPaise(inv.totalPaise - (inv.gstPaise ?? 0))}</span>
            </div>
            {inv.cgstPaise !== undefined && inv.cgstPaise > 0 && (
              <div className="flex justify-between">
                <span className="text-base-500">CGST</span>
                <span className="font-mono-nums text-base-500">{formatPaise(inv.cgstPaise)}</span>
              </div>
            )}
            {inv.sgstPaise !== undefined && inv.sgstPaise > 0 && (
              <div className="flex justify-between">
                <span className="text-base-500">SGST</span>
                <span className="font-mono-nums text-base-500">{formatPaise(inv.sgstPaise)}</span>
              </div>
            )}
            {inv.igstPaise !== undefined && inv.igstPaise > 0 && (
              <div className="flex justify-between">
                <span className="text-base-500">IGST</span>
                <span className="font-mono-nums text-base-500">{formatPaise(inv.igstPaise)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-white/10">
              <span className="text-white font-medium">Total</span>
              <span className="font-mono-nums font-bold text-accent-light">{formatPaise(inv.totalPaise)}</span>
            </div>
          </div>

          <div className="text-xs text-base-500 mt-3">
            Created: {formatDate(inv.createdAt)}
            {inv.issuedAt && <span> · Issued: {formatDate(inv.issuedAt)}</span>}
          </div>

          {inv.status === 'DRAFT' && (
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => issueInvoice(inv.id)}>
              Issue Invoice
            </Button>
          )}
        </GlassCard>
      ))}

      {invoices.length > 0 && invoices.every((i) => i.status !== 'DRAFT') && (
        <Button size="sm" variant="ghost" isLoading={generating} onClick={generateInvoice}>
          + Generate Another Invoice
        </Button>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { formatPaise, formatDate } from '@/lib/format';
import { GlassCard } from '@/components/ui/glass-card';
import { StatCard } from '@/components/ui/stat-card';
import { MilestoneStepper } from '@/components/deal-room/milestone-stepper';
import { EscrowPanel } from '@/components/deal-room/escrow-panel';
import { ShipmentTracker } from '@/components/deal-room/shipment-tracker';
import { InvoicePanel } from '@/components/deal-room/invoice-panel';
import { DealChat } from '@/components/deal-room/deal-chat';
import { Badge, Button } from '@khanij/ui';

interface Milestone { id: string; type: string; status: string; completedAt: string | null; }
interface LedgerEntry { id: string; type: string; amountPaise: number; createdAt: string; }
interface Shipment { id: string; status: string; carrierName: string; vehicleNumber: string; estimatedDeliveryDate: string; weightAtOriginKg?: number; trackingEvents?: { type: string; location?: string; notes?: string; createdAt: string }[]; }
interface Invoice { id: string; status: string; totalPaise: number; gstPaise?: number; cgstPaise?: number; sgstPaise?: number; igstPaise?: number; issuedAt?: string; createdAt: string; }

interface DealDetail {
  id: string;
  status: string;
  mineralName: string;
  quantityMt: number;
  pricePerMtPaise: number;
  totalPaise: number;
  buyerOrgName?: string;
  sellerOrgName?: string;
  createdAt: string;
  milestones: Milestone[];
}

type Tab = 'overview' | 'contract' | 'escrow' | 'shipment' | 'invoice' | 'chat';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'contract', label: 'Contract' },
  { key: 'escrow', label: 'Escrow' },
  { key: 'shipment', label: 'Shipment' },
  { key: 'invoice', label: 'Invoice' },
  { key: 'chat', label: 'Chat' },
];

export default function DealRoomPage() {
  const params = useParams();
  const dealId = params.id as string;

  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contract, setContract] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [draftingContract, setDraftingContract] = useState(false);

  const loadDeal = useCallback(async () => {
    try {
      const [d, l, s, inv] = await Promise.all([
        api<DealDetail>(`/api/v1/deals/${dealId}`),
        api<LedgerEntry[]>(`/api/v1/deals/${dealId}/ledger`).catch(() => []),
        api<Shipment[]>(`/api/v1/deals/${dealId}/shipments`).catch(() => []),
        api<Invoice[]>(`/api/v1/deals/${dealId}/invoices`).catch(() => []),
      ]);
      setDeal(d);
      setLedger(l);
      setShipments(s);
      setInvoices(inv);
    } catch { /* */ } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { loadDeal(); }, [loadDeal]);

  async function draftContract() {
    setDraftingContract(true);
    try {
      const result = await api<{ contract: string }>(`/api/v1/deals/${dealId}/draft-contract`, { method: 'POST' });
      setContract(result.contract ?? 'Contract draft generated.');
    } catch { setContract('Failed to generate contract.'); } finally {
      setDraftingContract(false);
    }
  }

  async function completeMilestone(type: string) {
    await api(`/api/v1/deals/${dealId}/milestones/${type}/complete`, { method: 'PATCH' });
    loadDeal();
  }

  if (loading) {
    return (
      <div className="max-w-4xl space-y-4">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-48" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="max-w-4xl">
        <GlassCard className="p-8 text-center text-base-500">Deal not found</GlassCard>
      </div>
    );
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  return (
    <div className="max-w-4xl">
      <Link href="/deals" className="text-sm text-base-500 hover:text-white mb-4 inline-block no-underline">
        ← Back to Deals
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{deal.mineralName}</h1>
          <p className="text-sm text-base-500 mt-1">
            {deal.sellerOrgName ?? 'Seller'} → {deal.buyerOrgName ?? 'Buyer'}
            {' · '}{formatDate(deal.createdAt)}
          </p>
        </div>
        <Badge variant={deal.status === 'COMPLETED' ? 'verified' : deal.status === 'DISPUTED' ? 'error' : 'pending'}>
          {deal.status.replace(/_/g, ' ')}
        </Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Quantity" value={`${deal.quantityMt.toLocaleString()}`} suffix="MT" />
        <StatCard label="Price/MT" value={formatPaise(deal.pricePerMtPaise)} />
        <StatCard label="Total Value" value={formatPaise(deal.totalPaise)} />
      </div>

      {/* Milestones */}
      <GlassCard className="p-5 mb-6">
        <MilestoneStepper milestones={deal.milestones} onComplete={completeMilestone} />
      </GlassCard>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`glass px-4 py-2 text-xs font-medium whitespace-nowrap transition-all ${
              tab === t.key ? 'border-accent/50 text-accent-light bg-accent/5' : 'text-base-500 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <GlassCard className="p-6">
          <h3 className="text-sm font-medium text-base-500 uppercase tracking-wider mb-4">Deal Details</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-base-500">Status</span><span className="text-white">{deal.status}</span></div>
            <div className="flex justify-between"><span className="text-base-500">Mineral</span><span>{deal.mineralName}</span></div>
            <div className="flex justify-between"><span className="text-base-500">Seller</span><span>{deal.sellerOrgName ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-base-500">Buyer</span><span>{deal.buyerOrgName ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-base-500">Created</span><span>{formatDate(deal.createdAt)}</span></div>
          </div>
        </GlassCard>
      )}

      {tab === 'contract' && (
        <div className="space-y-4">
          {!contract ? (
            <GlassCard className="p-8 text-center">
              <div className="text-base-500 mb-4">Generate an AI-drafted contract for this deal</div>
              <Button isLoading={draftingContract} onClick={draftContract}>
                Generate Contract
              </Button>
            </GlassCard>
          ) : (
            <GlassCard className="p-6">
              <h3 className="text-sm font-medium text-accent-light mb-4">AI-Generated Contract (Decision Support Only)</h3>
              <div className="prose prose-invert prose-sm max-w-none text-white/80 whitespace-pre-wrap font-mono text-xs leading-relaxed">
                {contract}
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {tab === 'escrow' && (
        <EscrowPanel dealId={dealId} ledger={ledger} onUpdate={loadDeal} />
      )}

      {tab === 'shipment' && (
        <ShipmentTracker dealId={dealId} shipments={shipments} onUpdate={loadDeal} />
      )}

      {tab === 'invoice' && (
        <InvoicePanel dealId={dealId} invoices={invoices} onUpdate={loadDeal} />
      )}

      {tab === 'chat' && (
        <DealChat dealId={dealId} apiBaseUrl={apiBase} />
      )}
    </div>
  );
}

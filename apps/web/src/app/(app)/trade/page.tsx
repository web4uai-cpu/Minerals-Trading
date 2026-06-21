'use client';

import { useEffect, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api-client';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@khanij/ui';

interface Deal {
  id: string;
  mineralName: string;
  status: string;
}

interface TradeApplication {
  id: string;
  dealId: string;
  direction: string;
  mineralName: string;
  destinationCountry: string;
  destinationCountryCode: string;
  clearanceStatus: string;
  dgftRefNumber: string | null;
  quantityMt: number;
  valueFobPaise: number;
  createdAt: string;
}

const STATUS_VARIANT: Record<string, 'verified' | 'pending' | 'warning' | 'error' | 'info' | 'default'> = {
  PENDING: 'default',
  APPLIED: 'info',
  APPROVED: 'verified',
  REJECTED: 'error',
  EXPIRED: 'warning',
};

export default function TradePage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [applications, setApplications] = useState<TradeApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    dealId: '',
    direction: 'EXPORT',
    destinationCountry: '',
    destinationCountryCode: '',
    portOfLoading: '',
    portOfDischarge: '',
    mineralName: '',
    hsnCode: '',
    quantityMt: '',
    valueFobPaise: '',
    iecNumber: '',
  });

  useEffect(() => {
    api<Deal[]>('/api/v1/deals')
      .then((d) => {
        setDeals(d);
        if (d.length > 0) setForm((prev) => ({ ...prev, dealId: d[0]?.id ?? '' }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function formatPaise(paise: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', maximumFractionDigits: 0,
    }).format(paise / 100);
  }

  async function loadApplicationsForDeal(dealId: string) {
    try {
      const apps = await api<TradeApplication[]>(`/api/v1/deals/${dealId}/trade-applications`);
      setApplications(apps);
    } catch {
      setApplications([]);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const body: Record<string, unknown> = {
        dealId: form.dealId,
        direction: form.direction,
        destinationCountry: form.destinationCountry,
        destinationCountryCode: form.destinationCountryCode.toUpperCase(),
        portOfLoading: form.portOfLoading,
        portOfDischarge: form.portOfDischarge,
        mineralName: form.mineralName,
        hsnCode: form.hsnCode,
        quantityMt: Number(form.quantityMt),
        valueFobPaise: Number(form.valueFobPaise),
      };
      if (form.iecNumber) body.iecNumber = form.iecNumber;

      const app = await api<TradeApplication>('/api/v1/trade/applications', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setApplications((prev) => [app, ...prev]);
      setShowForm(false);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.body.message);
      else setError('Failed to create application');
    } finally {
      setSaving(false);
    }
  }

  async function applyForClearance(appId: string) {
    try {
      const updated = await api<TradeApplication>(`/api/v1/trade/applications/${appId}/apply`, { method: 'PATCH' });
      setApplications((prev) => prev.map((a) => (a.id === appId ? updated : a)));
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.body.message);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-base-300 bg-base-200 px-3 py-2 text-sm text-white placeholder:text-base-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
  const selectClass =
    'w-full rounded-lg border border-base-300 bg-base-200 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">International Trade</h1>
          <p className="text-base-500 mt-1">Export/import clearance applications</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'New Application'}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-800/40 bg-red-900/20 px-4 py-3 text-sm text-red-400 mb-6">
          {error}
        </div>
      )}

      {showForm && (
        <Card className="mb-8">
          <CardHeader><CardTitle>New Trade Application</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-base-500 mb-1.5">Deal</label>
                  <select value={form.dealId} onChange={(e) => update('dealId', e.target.value)} className={selectClass}>
                    {deals.map((d) => <option key={d.id} value={d.id}>{d.mineralName} ({d.status})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-base-500 mb-1.5">Direction</label>
                  <select value={form.direction} onChange={(e) => update('direction', e.target.value)} className={selectClass}>
                    <option value="EXPORT">Export</option>
                    <option value="IMPORT">Import</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-base-500 mb-1.5">Destination Country</label>
                  <input value={form.destinationCountry} onChange={(e) => update('destinationCountry', e.target.value)} className={inputClass} placeholder="Japan" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-base-500 mb-1.5">Country Code (ISO)</label>
                  <input value={form.destinationCountryCode} onChange={(e) => update('destinationCountryCode', e.target.value)} className={inputClass} placeholder="JP" maxLength={2} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-base-500 mb-1.5">Port of Loading</label>
                  <input value={form.portOfLoading} onChange={(e) => update('portOfLoading', e.target.value)} className={inputClass} placeholder="Paradip" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-base-500 mb-1.5">Port of Discharge</label>
                  <input value={form.portOfDischarge} onChange={(e) => update('portOfDischarge', e.target.value)} className={inputClass} placeholder="Osaka" required />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-base-500 mb-1.5">Mineral Name</label>
                  <input value={form.mineralName} onChange={(e) => update('mineralName', e.target.value)} className={inputClass} placeholder="Manganese Ore" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-base-500 mb-1.5">HSN Code</label>
                  <input value={form.hsnCode} onChange={(e) => update('hsnCode', e.target.value)} className={inputClass} placeholder="26020000" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-base-500 mb-1.5">IEC Number</label>
                  <input value={form.iecNumber} onChange={(e) => update('iecNumber', e.target.value)} className={inputClass} placeholder="ABCDE12345" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-base-500 mb-1.5">Quantity (MT)</label>
                  <input type="number" value={form.quantityMt} onChange={(e) => update('quantityMt', e.target.value)} className={inputClass} placeholder="5000" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-base-500 mb-1.5">FOB Value (paise)</label>
                  <input type="number" value={form.valueFobPaise} onChange={(e) => update('valueFobPaise', e.target.value)} className={inputClass} placeholder="50000000" required />
                </div>
              </div>
              <Button type="submit" isLoading={saving}>Submit Application</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {deals.length > 0 && !showForm && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-base-500 mb-1.5">Load applications for deal</label>
          <div className="flex gap-2">
            <select
              className={selectClass + ' max-w-md'}
              onChange={(e) => { if (e.target.value) loadApplicationsForDeal(e.target.value); }}
              defaultValue=""
            >
              <option value="" disabled>Select a deal...</option>
              {deals.map((d) => <option key={d.id} value={d.id}>{d.mineralName} ({d.status})</option>)}
            </select>
          </div>
        </div>
      )}

      {applications.length === 0 && !showForm && (
        <div className="text-center py-12 text-base-500">
          Select a deal above to view trade applications, or create a new one.
        </div>
      )}

      <div className="space-y-3">
        {applications.map((app) => (
          <Card key={app.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{app.direction} — {app.mineralName}</CardTitle>
                <Badge variant={STATUS_VARIANT[app.clearanceStatus] ?? 'default'}>
                  {app.clearanceStatus}
                </Badge>
              </div>
              <CardDescription>
                To {app.destinationCountry} ({app.destinationCountryCode})
                {app.dgftRefNumber && <> · DGFT: {app.dgftRefNumber}</>}
                {' · '}{new Date(app.createdAt).toLocaleDateString('en-IN')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6 text-sm items-center">
                <div><span className="text-base-500">Qty: </span>{app.quantityMt.toLocaleString()} MT</div>
                <div><span className="text-base-500">FOB: </span>{formatPaise(app.valueFobPaise)}</div>
                {app.clearanceStatus === 'PENDING' && (
                  <Button variant="secondary" size="sm" onClick={() => applyForClearance(app.id)}>
                    Apply for Clearance
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

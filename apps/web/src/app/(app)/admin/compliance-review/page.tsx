'use client';

import { useState } from 'react';
import { api, ApiRequestError } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@khanij/ui';
import Link from 'next/link';

interface ComplianceItem {
  id: string;
  type: string;
  status: string;
  documentRef: string | null;
  orgId: string;
}

interface OrgProfile {
  orgId: string;
  orgStatus: string;
  trustScore: number;
  items: ComplianceItem[];
}

const ITEM_LABELS: Record<string, string> = {
  MINING_LEASE: 'Mining Lease',
  ENV_CLEARANCE: 'Environmental Clearance',
  FOREST_CLEARANCE: 'Forest Clearance',
  IBM_RETURNS: 'IBM Returns',
  ROYALTY_CLEARANCE: 'Royalty Clearance',
  SPCB_NOC: 'SPCB NOC',
  GST_REG: 'GST Registration',
  PAN: 'PAN Card',
  BANK_VERIFICATION: 'Bank Verification',
  IEC: 'Import Export Code',
  END_USE_DECLARATION: 'End-Use Declaration',
  INDUSTRY_REGISTRATION: 'Industry Registration',
};

const STATUS_VARIANT: Record<string, 'verified' | 'pending' | 'info' | 'error' | 'default'> = {
  VERIFIED: 'verified',
  UPLOADED: 'info',
  UNDER_REVIEW: 'pending',
  REJECTED: 'error',
  MISSING: 'default',
};

export default function ComplianceReviewPage() {
  const [orgId, setOrgId] = useState('');
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function loadOrg() {
    if (!orgId.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await api<OrgProfile>(`/compliance/profile?orgId=${orgId.trim()}`);
      setProfile(data);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.body.message);
      else setError('Failed to load org profile');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  async function verifyItem(itemId: string, status: 'VERIFIED' | 'REJECTED', rejectionNote?: string) {
    setActionLoading(itemId);
    try {
      await api(`/compliance/items/${itemId}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ status, rejectionNote }),
      });
      await loadOrg();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.body.message);
    } finally {
      setActionLoading(null);
    }
  }

  const inputClass =
    'rounded-lg border border-base-300 bg-base-200 px-3 py-2 text-sm text-white placeholder:text-base-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

  return (
    <div className="max-w-3xl">
      <Link href="/admin" className="text-sm text-base-500 hover:text-white mb-4 inline-block">
        &larr; Back to Admin
      </Link>

      <h1 className="text-2xl font-bold mb-6">Compliance Review</h1>

      <div className="flex gap-2 mb-6">
        <input
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          className={inputClass + ' flex-1'}
          placeholder="Enter Organization ID..."
        />
        <Button onClick={loadOrg} isLoading={loading}>Load</Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-800/40 bg-red-900/20 px-4 py-3 text-sm text-red-400 mb-6">
          {error}
        </div>
      )}

      {profile && (
        <>
          <div className="flex gap-4 mb-6">
            <Badge variant={profile.orgStatus === 'VERIFIED' ? 'verified' : 'pending'}>
              {profile.orgStatus}
            </Badge>
            <span className="text-sm text-base-500">
              TrustScore: <span className="text-accent-light font-semibold">{profile.trustScore}</span>
            </span>
          </div>

          <Card>
            <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {profile.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-3 border-b border-base-300 last:border-0">
                    <div>
                      <div className="text-sm font-medium">{ITEM_LABELS[item.type] ?? item.type}</div>
                      {item.documentRef && (
                        <div className="text-xs text-base-500 font-mono truncate max-w-xs">
                          {item.documentRef}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_VARIANT[item.status] ?? 'default'}>
                        {item.status}
                      </Badge>
                      {(item.status === 'UPLOADED' || item.status === 'UNDER_REVIEW') && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            isLoading={actionLoading === item.id}
                            onClick={() => verifyItem(item.id, 'VERIFIED')}
                          >
                            Verify
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            isLoading={actionLoading === item.id}
                            onClick={() => {
                              const note = prompt('Rejection reason:');
                              if (note) verifyItem(item.id, 'REJECTED', note);
                            }}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

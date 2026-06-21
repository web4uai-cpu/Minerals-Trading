'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@khanij/ui';

interface ComplianceItem {
  id: string;
  type: string;
  label: string;
  status: string;
  expiresAt: string | null;
}

interface ComplianceProfile {
  orgStatus: string;
  trustScore: number;
  items: ComplianceItem[];
}

const STATUS_VARIANT: Record<string, 'verified' | 'pending' | 'warning' | 'error' | 'default'> = {
  VERIFIED: 'verified',
  UPLOADED: 'info' as 'default',
  UNDER_REVIEW: 'pending',
  REJECTED: 'error',
  EXPIRED: 'warning',
  MISSING: 'default',
};

export default function CompliancePage() {
  const [profile, setProfile] = useState<ComplianceProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<ComplianceProfile>('/api/v1/compliance/profile')
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Compliance</h1>
        <p className="text-base-500 mt-1">
          Verification status and document checklist
        </p>
      </div>

      {profile && (
        <>
          <div className="flex gap-4 mb-8">
            <Card className="flex-1">
              <CardContent className="text-center">
                <div className="text-sm text-base-500">Org Status</div>
                <Badge
                  variant={profile.orgStatus === 'VERIFIED' ? 'verified' : 'pending'}
                  className="mt-1"
                >
                  {profile.orgStatus}
                </Badge>
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardContent className="text-center">
                <div className="text-sm text-base-500">TrustScore</div>
                <div className="text-2xl font-bold text-accent-light mt-1">
                  {profile.trustScore}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Document Checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {profile.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 border-b border-base-300 last:border-0"
                  >
                    <div>
                      <div className="text-sm font-medium">{item.label || item.type}</div>
                      {item.expiresAt && (
                        <div className="text-xs text-base-500">
                          Expires: {new Date(item.expiresAt).toLocaleDateString('en-IN')}
                        </div>
                      )}
                    </div>
                    <Badge variant={STATUS_VARIANT[item.status] ?? 'default'}>
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!profile && (
        <div className="text-center py-12 text-base-500">
          Unable to load compliance profile. Make sure your organization is registered.
        </div>
      )}
    </div>
  );
}

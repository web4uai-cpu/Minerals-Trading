'use client';

import { useEffect, useState, useRef } from 'react';
import { api, ApiRequestError } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@khanij/ui';

interface ComplianceItem {
  id: string;
  type: string;
  status: string;
  documentRef: string | null;
  expiresAt: string | null;
  verifiedAt: string | null;
  rejectionNote: string | null;
}

interface ComplianceProfile {
  orgStatus: string;
  trustScore: number;
  items: ComplianceItem[];
  checklist: { type: string; label: string; required: boolean }[];
}

interface PresignedResponse {
  uploadUrl: string;
  documentRef: string;
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

const STATUS_VARIANT: Record<string, 'verified' | 'pending' | 'warning' | 'error' | 'info' | 'default'> = {
  VERIFIED: 'verified',
  UPLOADED: 'info',
  UNDER_REVIEW: 'pending',
  REJECTED: 'error',
  EXPIRED: 'warning',
  MISSING: 'default',
};

export default function CompliancePage() {
  const [profile, setProfile] = useState<ComplianceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadType, setActiveUploadType] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const data = await api<ComplianceProfile>('/compliance/profile');
      setProfile(data);
    } catch {
      setError('Failed to load compliance profile');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(itemType: string) {
    setActiveUploadType(itemType);
    fileInputRef.current?.click();
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeUploadType) return;

    setUploading(activeUploadType);
    setError('');

    try {
      const { uploadUrl, documentRef } = await api<PresignedResponse>(
        '/compliance/upload-url',
        {
          method: 'POST',
          body: JSON.stringify({
            itemType: activeUploadType,
            fileName: file.name,
            contentType: file.type || 'application/octet-stream',
          }),
        },
      );

      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });

      await api('/compliance/items', {
        method: 'POST',
        body: JSON.stringify({
          type: activeUploadType,
          documentRef,
        }),
      });

      await loadProfile();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.body.message);
      } else {
        setError('Upload failed');
      }
    } finally {
      setUploading(null);
      setActiveUploadType('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold mb-4">Compliance</h1>
        <div className="text-center py-12 text-base-500">
          {error || 'Unable to load compliance profile.'}
        </div>
      </div>
    );
  }

  const itemMap = new Map(profile.items.map((i) => [i.type, i]));

  return (
    <div className="max-w-3xl">
      <input ref={fileInputRef} type="file" className="hidden" onChange={onFileSelected} />

      <div className="mb-8">
        <h1 className="text-2xl font-bold">Compliance</h1>
        <p className="text-base-500 mt-1">
          Verification status and document uploads
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-800/40 bg-red-900/20 px-4 py-3 text-sm text-red-400 mb-6">
          {error}
        </div>
      )}

      <div className="flex gap-4 mb-8">
        <Card className="flex-1">
          <CardContent className="text-center py-6">
            <div className="text-sm text-base-500">Organization Status</div>
            <Badge
              variant={profile.orgStatus === 'VERIFIED' ? 'verified' : 'pending'}
              className="mt-2"
            >
              {profile.orgStatus}
            </Badge>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="text-center py-6">
            <div className="text-sm text-base-500">TrustScore</div>
            <div className="text-3xl font-bold text-accent-light mt-1">
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
            {profile.checklist.map((check) => {
              const item = itemMap.get(check.type);
              const status = item?.status ?? 'MISSING';
              const isUploading = uploading === check.type;

              return (
                <div
                  key={check.type}
                  className="flex items-center justify-between py-3 border-b border-base-300 last:border-0"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {ITEM_LABELS[check.type] ?? check.type}
                      {check.required && (
                        <span className="text-red-400 ml-1">*</span>
                      )}
                    </div>
                    {item?.rejectionNote && (
                      <div className="text-xs text-red-400 mt-0.5">
                        Rejected: {item.rejectionNote}
                      </div>
                    )}
                    {item?.verifiedAt && (
                      <div className="text-xs text-base-500 mt-0.5">
                        Verified: {new Date(item.verifiedAt).toLocaleDateString('en-IN')}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[status] ?? 'default'}>
                      {status}
                    </Badge>
                    {(status === 'MISSING' || status === 'REJECTED' || status === 'EXPIRED') && (
                      <Button
                        variant="secondary"
                        size="sm"
                        isLoading={isUploading}
                        onClick={() => handleUpload(check.type)}
                      >
                        Upload
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

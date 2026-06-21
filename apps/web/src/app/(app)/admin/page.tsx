'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@khanij/ui';
import Link from 'next/link';

export default function AdminPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-base-500 mt-1">Organization and compliance management</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/admin/compliance-review">
          <Card className="h-full hover:border-accent/50 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle>Compliance Review</CardTitle>
              <CardDescription>
                Verify or reject organization compliance documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-accent-light">Open &rarr;</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/trade-clearance">
          <Card className="h-full hover:border-accent/50 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle>Trade Clearance</CardTitle>
              <CardDescription>
                Approve or reject export/import clearance applications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-accent-light">Open &rarr;</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/settlements">
          <Card className="h-full hover:border-accent/50 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle>Settlements</CardTitle>
              <CardDescription>
                Confirm payments and mark cross-border settlements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-accent-light">Open &rarr;</span>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

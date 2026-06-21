'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@khanij/ui';

export default function TradePage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">International Trade</h1>
        <p className="text-base-500 mt-1">
          Export/import clearance applications and cross-border settlements
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Trade Applications</CardTitle>
            <CardDescription>
              Create and track export/import clearance applications linked to your deals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="info">Coming soon</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Settlements</CardTitle>
            <CardDescription>
              Cross-border forex settlement with rate locking and payment tracking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="info">Coming soon</Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

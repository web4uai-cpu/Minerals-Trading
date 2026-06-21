'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@khanij/ui';

export default function DisputesPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Disputes &amp; Arbitration</h1>
        <p className="text-base-500 mt-1">
          File disputes, submit evidence, and track arbitration proceedings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>No Active Disputes</CardTitle>
          <CardDescription>
            Disputes can be filed from a deal detail page when a deal is in progress
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="verified">All clear</Badge>
        </CardContent>
      </Card>
    </div>
  );
}

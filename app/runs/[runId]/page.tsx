'use client';

import { RunDetailPage } from '@flow-studio-runs/RunDetailPage';

export default function Page({ params }: { params: { runId: string } }) {
  return <RunDetailPage runId={params.runId} />;
}

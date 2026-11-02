'use client';

import { Suspense } from 'react';
import { RunsPage } from '@flow-studio-runs/RunsPage';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RunsPage />
    </Suspense>
  );
}

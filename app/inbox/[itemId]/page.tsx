'use client';

import { InboxItemPage } from '@flow-studio-runs/InboxPage';

export default function Page({ params }: { params: { itemId: string } }) {
  return <InboxItemPage itemId={params.itemId} />;
}

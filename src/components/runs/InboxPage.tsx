'use client';

import Link from 'next/link';
import type { RunStatus, WorkItem } from '@flow-studio/model/runtime';
import { runtimeCopy as rc } from '@flow-studio/runtime/copy';
import { ApprovalCard, FlowChangeCard, TaskCard, type FlowCardData } from './InboxCards';
import { Loading, Note, PageFrame, PageTitle, useLoad } from './shared';

const copy = rc.inbox;

interface InboxAnswer { approvals: WorkItem[]; tasks: WorkItem[]; flowChanges: FlowCardData[] }

function Section({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-[15px] font-bold">{title}</h2>
      {empty ? <Note>{copy.empty}</Note> : children}
    </section>
  );
}

/** 05 §7: one page, three sections, each a list of cards, newest first. */
export function InboxPage() {
  const [loaded, reload] = useLoad<InboxAnswer>('/api/runtime/inbox');
  const data = loaded.state === 'ready' ? loaded.data : null;
  return (
    <PageFrame title={<PageTitle>{copy.title}</PageTitle>}>
      {loaded.state === 'loading' ? <Loading /> : null}
      {loaded.state === 'failed' ? <Note>{loaded.message}</Note> : null}
      {data ? (
        <div className="flex max-w-[820px] flex-col gap-6">
          <Section title={copy.approvals} empty={data.approvals.length === 0}>
            {data.approvals.map((item) => <ApprovalCard key={item.id} item={item} onChanged={reload} />)}
          </Section>
          <Section title={copy.tasks} empty={data.tasks.length === 0}>
            {data.tasks.map((item) => <TaskCard key={item.id} item={item} onChanged={reload} />)}
          </Section>
          <Section title={copy.flowChanges} empty={data.flowChanges.length === 0}>
            {data.flowChanges.map((card) => <FlowChangeCard key={card.item.id} card={card} onChanged={reload} />)}
          </Section>
        </div>
      ) : null}
    </PageFrame>
  );
}

interface ItemAnswer { item: WorkItem | null; kind: WorkItem['kind']; flowChange?: FlowCardData | null; own: boolean; runStatus: RunStatus | null }

/** 05 §7: approval links and emails open one item, with the same card and buttons. */
export function InboxItemPage({ itemId }: { itemId: string }) {
  const [loaded, reload] = useLoad<ItemAnswer>(`/api/runtime/work-items/${encodeURIComponent(itemId)}`);
  const body = (): React.ReactNode => {
    if (loaded.state === 'failed') return <Note>{loaded.status === 403 ? copy.notYours : loaded.status === 404 ? copy.gone : loaded.message}</Note>;
    if (loaded.state !== 'ready') return <Loading />;
    const { item, own, runStatus, kind, flowChange } = loaded.data;
    if (own) return <Note>{copy.ownChange}</Note>;
    if (!item) return <Note>{copy.gone}</Note>;
    if (runStatus === 'stopped') return <Note>{copy.stoppedPage}</Note>;
    if (item.status === 'cancelled') return <Note>{copy.withdrawn}</Note>;
    if (item.status !== 'open') return <Note>{copy.answered}</Note>;
    if (kind === 'publish_request') return flowChange ? <FlowChangeCard card={flowChange} onChanged={reload} /> : <Note>{copy.notYours}</Note>;
    if (['approve', 'escalation', 'decide_failed_check'].includes(kind)) return <ApprovalCard item={item} onChanged={reload} />;
    return <TaskCard item={item} onChanged={reload} />;
  };
  return (
    <PageFrame title={<PageTitle>{copy.title}</PageTitle>} right={<Link href="/inbox" className="rounded text-[13px] font-semibold text-cyan-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">{copy.backToInbox}</Link>}>
      <div className="max-w-[820px]">{body()}</div>
    </PageFrame>
  );
}

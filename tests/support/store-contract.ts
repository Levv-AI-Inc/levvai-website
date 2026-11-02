import { describe, expect, it } from 'vitest';
import type { Collection, StoreDriver, StoreWrite } from '@flow-studio/data/driver';
import { decodeRun, encodeRun } from '@flow-studio/data/codec';
import { createRepos } from '@flow-studio/data/repos';
import type { InboundEvent, LedgerLine, OutboxMessage, WorkItem, WorkflowRun } from '@flow-studio/model/runtime';

/**
 * What both stores must do alike. Runs against the memory driver in tests/api and against apps.flowstudio on local
 * Postgres in tests/django, so a difference between them fails a test rather than showing up in production.
 */
const CLOCK = { now: () => '2026-10-20T09:00:00Z', asOf: () => '2026-10-20' };

export function storeContract(name: string, driverFor: () => Promise<StoreDriver> | StoreDriver): void {
  let serial = 0;
  const unique = (prefix: string): string => {
    serial += 1;
    return `${prefix}-${Date.now().toString(36)}-${serial}`;
  };

  const workflowDoc = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    name: 'Contract workflow',
    records: ['work_order'],
    event: 'submitted',
    scope: {},
    status: 'draft',
    version: 0,
    effective: '2026-12-01',
    owner: 'Procurement operations',
    priority: null,
    draft: {
      nodes: {
        T: { id: 'T', kind: 'trigger', label: '', outs: [{ key: 'next', to: 'region' }] },
        region: { id: 'region', kind: 'task', label: 'z', outs: [{ key: 'next', to: 'bu' }] },
        bu: { id: 'bu', kind: 'task', label: 'y', outs: [{ key: 'next', to: 'n10' }] },
        n10: { id: 'n10', kind: 'task', label: 'x', outs: [{ key: 'next', to: 'n2' }] },
        n2: { id: 'n2', kind: 'task', label: 'w', outs: [{ key: 'next', to: 'END' }] },
        END: { id: 'END', kind: 'end', label: '', outcome: 'completed', outs: [] },
      },
    },
    published: null,
    ...overrides,
  });

  const newWorkflow = (id: string, overrides: Record<string, unknown> = {}): StoreWrite => ({
    op: 'insert',
    collection: 'workflows',
    id,
    doc: workflowDoc(id, overrides),
    by: 'Contract',
  });

  const run = (id: string, workflowId: string): WorkflowRun => ({
    id,
    workflowId,
    version: 1,
    recordRef: { type: 'work_order', id: `WO-${id}` },
    event: 'submitted',
    status: 'running',
    startedAt: '2026-10-20T09:00:00Z',
    recordSnapshot: { id: `WO-${id}`, record: 'work_order', event: 'submitted', requester: 'Coordinator' },
    plan: { walk: { path: new Set(['T', 'T:next']) }, limit: Infinity } as unknown as WorkflowRun['plan'],
    steps: {},
    log: [{ at: '2026-10-20T09:00:00Z', by: 'Levv', type: 'started', m: 'Started' }],
  });

  describe(`Store contract · ${name}`, () => {
    it('keeps keys, key order, null, absent and timestamps exactly as written', async () => {
      const driver = await driverFor();
      const id = unique('wf-order');
      const doc = workflowDoc(id, { note: { nothing: null, ratio: 0.1, quote: '“it’s”' }, at: '2026-10-20T09:00:00Z' });
      expect((await driver.tx([{ op: 'insert', collection: 'workflows', id, doc }])).ok).toBe(true);
      const row = await driver.get('workflows', id);
      expect(JSON.stringify(row?.doc)).toBe(JSON.stringify(doc));
      expect(Object.keys((row?.doc as ReturnType<typeof workflowDoc>).draft.nodes)).toEqual(['T', 'region', 'bu', 'n10', 'n2', 'END']);
    });

    it('moves a rev only when asked, and a stale rev conflicts without changing anything', async () => {
      const driver = await driverFor();
      const id = unique('wf-rev');
      await driver.tx([newWorkflow(id)]);
      expect((await driver.get('workflows', id))?.rev).toBe(1);

      const saved = await driver.tx([{ op: 'patch', collection: 'workflows', id, set: { name: 'First' }, expectRev: 1, bumpRev: true }]);
      expect(saved).toEqual({ ok: true, results: [{ id, rev: 2 }] });

      const stale = await driver.tx([{ op: 'patch', collection: 'workflows', id, set: { name: 'Second' }, expectRev: 1, bumpRev: true }]);
      expect(stale).toEqual({ ok: false, index: 0, reason: 'rev', current: 2 });
      expect((await driver.get('workflows', id))?.doc).toMatchObject({ name: 'First' });

      await driver.tx([{ op: 'patch', collection: 'workflows', id, set: { status: 'inactive' } }]);
      expect((await driver.get('workflows', id))?.rev).toBe(2);
    });

    it('applies all the writes of a transaction or none of them', async () => {
      const driver = await driverFor();
      const [a, b] = [unique('wf-tx'), unique('wf-tx')];
      await driver.tx([newWorkflow(a)]);
      const result = await driver.tx([
        newWorkflow(b),
        { op: 'patch', collection: 'workflows', id: a, set: { name: 'Changed' } },
        { op: 'patch', collection: 'workflows', id: a, set: { name: 'Again' }, expectRev: 99 },
      ]);
      expect(result).toMatchObject({ ok: false, index: 2, reason: 'rev' });
      expect(await driver.get('workflows', b)).toBeNull();
      expect((await driver.get('workflows', a))?.doc).toMatchObject({ name: 'Contract workflow' });
    });

    it('reports the same conflict reasons', async () => {
      const driver = await driverFor();
      const id = unique('wf-conflicts');
      await driver.tx([newWorkflow(id)]);
      expect(await driver.tx([newWorkflow(id)])).toMatchObject({ ok: false, reason: 'exists' });
      expect(await driver.tx([{ op: 'patch', collection: 'workflows', id: unique('nope'), set: {} }])).toMatchObject({ ok: false, reason: 'missing' });
      const guarded: StoreWrite = { op: 'patch', collection: 'workflows', id, set: { pending: { submittedBy: 'A' } }, expect: { pending: null } };
      expect((await driver.tx([guarded])).ok).toBe(true);
      expect(await driver.tx([guarded])).toMatchObject({ ok: false, reason: 'expect' });
    });

    it('patch sets and unsets top-level keys and keeps the order of the rest', async () => {
      const driver = await driverFor();
      const id = unique('wf-patch');
      await driver.tx([newWorkflow(id, { desc: 'gone soon' })]);
      await driver.tx([{ op: 'patch', collection: 'workflows', id, set: { name: 'New', basis: 'total' }, unset: ['desc'] }]);
      const keys = Object.keys((await driver.get('workflows', id))?.doc as object);
      expect(keys).not.toContain('desc');
      expect(keys.indexOf('name')).toBe(1);
      expect(keys[keys.length - 1]).toBe('basis');
    });

    it('upsert does nothing when the doc is identical, and moves the rev when it differs', async () => {
      const driver = await driverFor();
      const id = unique('wf-upsert');
      const doc = workflowDoc(id);
      await driver.tx([{ op: 'upsert', collection: 'workflows', id, doc }]);
      await driver.tx([{ op: 'upsert', collection: 'workflows', id, doc }]);
      expect((await driver.get('workflows', id))?.rev).toBe(1);
      await driver.tx([{ op: 'upsert', collection: 'workflows', id, doc: { ...doc, name: 'Changed' } }]);
      expect((await driver.get('workflows', id))?.rev).toBe(2);
    });

    it('lists in position order and filters on the same names', async () => {
      const driver = await driverFor();
      const [first, second] = [unique('wf-list'), unique('wf-list')];
      await driver.tx([newWorkflow(first), newWorkflow(second, { status: 'inactive', published: { nodes: {}, scope: {}, name: 'x' } })]);
      const ids = (await driver.list('workflows')).map((row) => row.id);
      expect(ids.indexOf(first)).toBeLessThan(ids.indexOf(second));
      const inactive = (await driver.list('workflows', { status: 'inactive' })).map((row) => row.id);
      expect(inactive).toContain(second);
      expect(inactive).not.toContain(first);
      const either = (await driver.list('workflows', { status: ['inactive', 'draft'] })).map((row) => row.id);
      expect(either).toEqual(expect.arrayContaining([first, second]));
    });

    it('returns versions with their workflow, oldest first, and allows each only once', async () => {
      const driver = await driverFor();
      const id = unique('wf-versions');
      const version = (n: number) => ({ workflowId: id, version: n, nodes: {}, scope: {}, name: 'x', effective: '2026-10-20', publishedAt: '2026-10-20T09:00:00Z', approvedBy: 'B' });
      await driver.tx([
        newWorkflow(id),
        { op: 'insert', collection: 'versions', id: `${id}:v2`, doc: version(2) },
        { op: 'insert', collection: 'versions', id: `${id}:v1`, doc: version(1) },
      ]);
      expect((await driver.get('workflows', id))?.versions?.map((v) => (v as { version: number }).version)).toEqual([1, 2]);
      expect(await driver.tx([{ op: 'insert', collection: 'versions', id: `${id}:again`, doc: version(1) }])).toMatchObject({ ok: false, reason: 'integrity' });
    });

    it('refuses operations a collection does not allow', async () => {
      const driver = await driverFor();
      const refused: StoreWrite[] = [
        { op: 'patch', collection: 'versions', id: 'x', set: {} },
        { op: 'patch', collection: 'events', id: 'x', set: {} },
        { op: 'upsert', collection: 'events', id: 'x', doc: {} },
        { op: 'insert', collection: 'reference', id: 'x', doc: {} },
        { op: 'delete', collection: 'workflows', id: 'x' } as unknown as StoreWrite,
      ];
      for (const write of refused) await expect(driver.tx([write])).rejects.toThrow();
    });

    it('refuses a doc missing what its columns need, and a date that is not one', async () => {
      const driver = await driverFor();
      await expect(driver.tx([{ op: 'insert', collection: 'workflows', id: unique('bad'), doc: { name: 'x' } }])).rejects.toThrow();
      const id = unique('wf-bad');
      await driver.tx([newWorkflow(id)]);
      const badRun = { ...encodeRun(run(unique('r'), id)), startedAt: 'not a date' };
      await expect(driver.tx([{ op: 'insert', collection: 'runs', id: unique('r'), doc: badRun }])).rejects.toThrow();
    });

    it('updateWhere changes only what matches and needs a filter', async () => {
      const driver = await driverFor();
      const repos = createRepos(driver, CLOCK);
      const id = unique('wf-items');
      await driver.tx([newWorkflow(id)]);
      const runId = unique('run');
      await repos.runs.create(run(runId, id));
      const item = (itemId: string, status: WorkItem['status'], assignee = 'Raj Patel'): WorkItem => ({
        id: itemId, kind: 'task', runId, nodeId: 'n', publishRequestId: null, assignee, status, createdAt: '2026-10-20T09:00:00Z',
      });
      const [a, b, c] = [unique('i'), unique('i'), unique('i')];
      await repos.workItems.open(item(a, 'open'));
      await repos.workItems.open(item(b, 'open'));
      await repos.workItems.open(item(c, 'done'));

      await repos.workItems.holdForRun(runId);
      expect((await repos.workItems.get(a))?.status).toBe('held');
      expect((await repos.workItems.get(c))?.status).toBe('done');
      await repos.workItems.releaseForRun(runId);
      expect((await repos.workItems.get(b))?.status).toBe('open');
      await repos.workItems.close(a, 'done', 'All done');
      expect(await repos.workItems.get(a)).toMatchObject({ status: 'done', decision: 'done', comment: 'All done', doneAt: '2026-10-20T09:00:00Z' });
      await repos.workItems.cancelForRun(runId);
      expect((await repos.workItems.get(b))?.status).toBe('cancelled');
      await expect(driver.tx([{ op: 'updateWhere', collection: 'items', where: {}, set: { status: 'held' } }])).rejects.toThrow();
    });

    it('stores a run: the Set and Infinity in its plan, its rev, and an append-only log', async () => {
      const driver = await driverFor();
      const repos = createRepos(driver, CLOCK);
      const id = unique('wf-run');
      await driver.tx([newWorkflow(id)]);
      const runId = unique('run');
      const created = await repos.runs.create(run(runId, id));
      expect(created.rev).toBe(1);

      const stored = await repos.runs.get(runId);
      const plan = stored?.plan as unknown as { walk: { path: Set<string> }; limit: number };
      expect(plan.walk.path).toEqual(new Set(['T', 'T:next']));
      expect(plan.limit).toBe(Infinity);
      expect(stored?.log).toEqual([{ at: '2026-10-20T09:00:00Z', by: 'Levv', type: 'started', m: 'Started' }]);

      await repos.runs.appendEvent(runId, { at: '2026-10-20T10:00:00Z', by: 'Owen Clarke', type: 'paused', m: 'Supplier dispute' });
      const paused = await repos.runs.update({ ...(stored as WorkflowRun), status: 'paused', pausedBy: 'Owen Clarke' }, 1);
      expect(paused).toMatchObject({ rev: 2, status: 'paused' });
      expect(await repos.runs.update({ ...(stored as WorkflowRun), status: 'running' }, 1)).toEqual({ conflict: true });
      expect((await repos.runs.get(runId))?.log.map((line) => line.type)).toEqual(['started', 'paused']);

      const summaries = await repos.runs.list({ workflowId: id });
      expect(summaries).toMatchObject([{ id: runId, status: 'paused', recordId: `WO-${runId}`, workflowName: 'Contract workflow', updatedAt: '2026-10-20T10:00:00Z' }]);
    });

    it('stores records, ledger lines, outbox messages and inbound events', async () => {
      const driver = await driverFor();
      const repos = createRepos(driver, CLOCK);
      const id = unique('wf-more');
      await driver.tx([newWorkflow(id)]);
      const runId = unique('run');
      await repos.runs.create(run(runId, id));

      const recordId = unique('WO');
      await repos.records.upsert({ id: recordId, type: 'work_order', source: 'levv', updatedAt: '2026-10-20T09:00:00Z', data: { states: [] } as never });
      expect(await repos.records.get('work_order', recordId)).toMatchObject({ id: recordId, type: 'work_order' });
      expect(await repos.records.get('sow', recordId)).toBeNull();

      const workerKey = `${unique('w')}@example.com`;
      const line: LedgerLine = { id: unique('l'), workerKey, runId, nodeId: 'n', gives: 'Site badge', disp: 'return', status: 'open', createdAt: '2026-10-20T09:00:00Z' };
      await repos.ledger.add(line);
      expect(await repos.ledger.openFor(workerKey)).toEqual([line]);
      await repos.ledger.close(line.id);
      expect(await repos.ledger.openFor(workerKey)).toEqual([]);

      const message: OutboxMessage = { id: unique('o'), runId, to: 'Raj Patel', channel: 'Email', subject: 'Hello', body: 'Body', createdAt: '2026-10-20T09:00:00Z' };
      await repos.outbox.enqueue(message);
      expect((await driver.get('outbox', message.id))?.doc).toEqual(message);

      const event: InboundEvent = { id: unique('e'), source: 'levv', recordType: 'work_order', recordId, event: 'submitted', payload: { a: 1 }, receivedAt: '2026-10-20T09:00:00Z', runIds: [] };
      await repos.inbound.add(event);
      await repos.inbound.update(event.id, { outcome: 'started', processedAt: '2026-10-20T09:00:01Z', runIds: [runId] });
      expect(await repos.inbound.findByRecord(recordId)).toMatchObject([{ id: event.id, outcome: 'started', runIds: [runId] }]);
    });

    it('links an account to a person: one account per person, and a null person is no one (decision 5)', async () => {
      const driver = await driverFor();
      const repos = createRepos(driver, CLOCK);
      const person = unique('Person');
      const [one, two] = [unique('account'), unique('account')];
      const link = (accountId: string, who: string | null) => ({ accountId, email: `${accountId}@example.com`, person: who, teams: ['Procurement operations'], linkedBy: 'admin', linkedAt: '2026-10-20T09:00:00Z' });
      expect(await repos.links.set(link(one, person))).toEqual(link(one, person));
      expect(await repos.links.get(one)).toEqual(link(one, person));
      expect(await repos.links.set(link(two, person))).toEqual({ conflict: true });
      expect(await repos.links.get(two)).toBeNull();
      expect(await repos.links.set(link(one, null))).toEqual(link(one, null));
      expect(await repos.links.set(link(two, person))).toEqual(link(two, person));
      expect((await repos.links.list()).map((row) => row.accountId)).toEqual(expect.arrayContaining([one, two]));
    });

    it('a patch with only `expect` checks a row without changing it', async () => {
      const driver = await driverFor();
      const id = unique('wf');
      await driver.tx([{ op: 'insert', collection: 'workflows', id, doc: workflowDoc(id) }]);
      const before = await driver.get('workflows', id);
      expect((await driver.tx([{ op: 'patch', collection: 'workflows', id, expect: { version: 0, status: 'draft' } }])).ok).toBe(true);
      expect((await driver.tx([{ op: 'patch', collection: 'workflows', id, expect: { version: 9 } }])).ok).toBe(false);
      const after = await driver.get('workflows', id);
      expect(after?.doc).toEqual(before?.doc);
      expect(after?.rev).toBe(before?.rev);
    });

    it('answers null for a row that is not there', async () => {
      const driver = await driverFor();
      for (const collection of ['workflows', 'requests', 'runs', 'items'] as Collection[]) {
        expect(await driver.get(collection, unique('nope'))).toBeNull();
      }
    });

    it('decodes what it encoded', () => {
      const encoded = JSON.parse(JSON.stringify(encodeRun(run('codec', 'wf')))) as unknown;
      expect((decodeRun(encoded).plan as unknown as { limit: number }).limit).toBe(Infinity);
    });
  });
}

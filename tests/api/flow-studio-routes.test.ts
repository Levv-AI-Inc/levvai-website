import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createEditor } from '@flow-studio/engine/edit';
import { runTest } from '@flow-studio/engine/compose';
import type { EngineContext, PublishRequest, Workflow, WorkflowSummary } from '@flow-studio/model';
import { normaliseCatalog, normalisePeople } from '@flow-studio/model/load';
import { createIdGen } from '@flow-studio/engine/ids';
import { draftHash } from '@flow-studio/data/draft-fields';
import { GET as engineContextRoute } from '../../app/api/flow-studio/engine-context/route';
import { POST as novaRoute } from '../../app/api/flow-studio/nova/condition/route';
import { GET as listRequests } from '../../app/api/flow-studio/publish-requests/route';
import { POST as approveRoute } from '../../app/api/flow-studio/publish-requests/[id]/approve/route';
import { POST as rejectRoute } from '../../app/api/flow-studio/publish-requests/[id]/reject/route';
import { GET as referenceRoute } from '../../app/api/flow-studio/reference/route';
import { POST as importRoute } from '../../app/api/flow-studio/reference/import/route';
import { GET as samplesRoute } from '../../app/api/flow-studio/samples/route';
import { GET as listRoute, POST as createRoute } from '../../app/api/flow-studio/workflows/route';
import { GET as getRoute } from '../../app/api/flow-studio/workflows/[id]/route';
import { POST as activeRoute } from '../../app/api/flow-studio/workflows/[id]/active/route';
import { PUT as draftRoute } from '../../app/api/flow-studio/workflows/[id]/draft/route';
import { GET as lintRoute } from '../../app/api/flow-studio/workflows/[id]/lint/route';
import { POST as sendRoute } from '../../app/api/flow-studio/workflows/[id]/publish-requests/route';
import { GET as reviewRoute } from '../../app/api/flow-studio/workflows/[id]/publish-review/route';
import { POST as simulateRoute } from '../../app/api/flow-studio/workflows/[id]/simulate/route';
import { expectedOf, casesOf, docEntry, normDeep } from '../support/acceptance-doc';
import { call, resetApp, routeFiles, signIn, setE2EEnv } from '../support/api';
import { loadTestActors, makeContext, TEST_AS_OF, workflowById } from '../support/context';

setE2EEnv();

const ADMIN = 'Flow Admin';
const APPROVER = 'Samira Khan';
const CONFLICT_TOAST = 'This workflow changed since you opened it. Reload to see the latest.';
const OWN_CHANGE = 'You can’t approve your own change.';
const PAST_DATE = 'Pick today or a later date.';

const params = (id: string) => ({ id });

const load = (id: string, user = ADMIN) => call(getRoute, `/api/flow-studio/workflows/${id}`, { user, params: params(id) });
const simulate = (id: string, body: unknown, user = ADMIN) =>
  call(simulateRoute, `/api/flow-studio/workflows/${id}/simulate`, { user, params: params(id), body });
const saveDraft = (id: string, draft: unknown, draftRev: number, user = ADMIN) =>
  call(draftRoute, `/api/flow-studio/workflows/${id}/draft`, { method: 'PUT', user, params: params(id), body: { draft, draftRev } });
const review = (id: string, user = ADMIN) => call(reviewRoute, `/api/flow-studio/workflows/${id}/publish-review`, { user, params: params(id) });
const send = (id: string, body: unknown, user = ADMIN) =>
  call<PublishRequest>(sendRoute, `/api/flow-studio/workflows/${id}/publish-requests`, { user, params: params(id), body });
const approve = (id: string, user = APPROVER, body: unknown = {}) =>
  call(approveRoute, `/api/flow-studio/publish-requests/${id}/approve`, { user, params: params(id), body });
const reject = (id: string, user = APPROVER, body: unknown = { comment: 'Not yet' }) =>
  call(rejectRoute, `/api/flow-studio/publish-requests/${id}/reject`, { user, params: params(id), body });
const setActive = (id: string, active: boolean, user = ADMIN) =>
  call(activeRoute, `/api/flow-studio/workflows/${id}/active`, { user, params: params(id), body: { active } });

const DATA_AND_AI = 'wf-wo-sub-wo-data';
const UK_TECH = 'wf-wo-sub-wo-uk-tech';
const SITE_ACCESS = 'wf-access';

beforeEach(async () => {
  await resetApp();
  for (const user of [ADMIN, APPROVER, 'Owen Clarke', 'Grace Kim', 'Raj Patel']) await signIn(user);
});

describe('simulate', () => {
  it('returns exactly the 06 A.1 result for WO-2214 in wf-wo-sub-wo-uk-tech (EN-022)', async () => {
    const { workflowId, recordId } = casesOf('EN-022');
    expect([workflowId, recordId]).toEqual([UK_TECH, 'WO-2214']);
    const result = await simulate(UK_TECH, { recordId: 'WO-2214' });
    expect(result.status).toBe(200);
    expect(normDeep(result.body)).toStrictEqual(normDeep(expectedOf('EN-022')));
  });

  const allAOne = Array.from({ length: 41 }, (_, i) => `EN-${String(i + 1).padStart(3, '0')}`);
  it.each(allAOne)('answers %s of Part A.1 through the route', async (id) => {
    const { workflowId, recordId, options } = casesOf(id);
    const result = await simulate(workflowId as string, { recordId, ...(options ? { options } : {}) });
    expect(result.status, docEntry(id).title).toBe(200);
    expect(normDeep(result.body)).toStrictEqual(normDeep(expectedOf(id)));
  });

  it('runs on the current draft, not the published version', async () => {
    const { body: found } = await load(UK_TECH);
    const before = await simulate(UK_TECH, { recordId: 'WO-2214' });
    const ed = createEditor(makeContext());
    const nodes = ed.deleteStep(found.workflow.draft.nodes, 'RA_A1');
    const saved = await saveDraft(UK_TECH, { ...found.workflow, draft: { nodes } }, found.draftRev);
    expect(saved.status).toBe(200);
    const after = await simulate(UK_TECH, { recordId: 'WO-2214' });
    expect(after.body).not.toEqual(before.body);
  });

  it('refuses an unknown workflow, an unknown record and a bad body', async () => {
    expect((await simulate('nope', { recordId: 'WO-2214' })).status).toBe(404);
    expect((await simulate(UK_TECH, { recordId: 'nope' })).status).toBe(404);
    const bad = await simulate(UK_TECH, { options: {} });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('INVALID_REQUEST');
  });

  it('takes the Test options: choosing a proposal and trying an edit', async () => {
    const edit = await simulate('wf-asn-chg', { recordId: 'ASN-881', options: { applyEdit: true } });
    expect(edit.status).toBe(200);
    expect(edit.body.editButton).toBe('Undo the edit');
  });
});

describe('publish requests', () => {
  it('422 with the must-fix issues when something blocks it', async () => {
    const { body: created } = await call<Workflow>(createRoute, '/api/flow-studio/workflows', { user: ADMIN, body: {} });
    const ctx = makeContext();
    const ed = createEditor(ctx);
    ed.createWorkflow(null);
    const nodes = ed.insertStep(created.draft.nodes, 'T', 'next', { kind: 'appr' });
    const saved = await saveDraft(created.id, { ...created, scope: { country: ['Atlantis'] }, draft: { nodes } }, 1);
    expect(saved.status).toBe(200);

    const result = await send(created.id, { goLive: TEST_AS_OF });
    expect(result.status).toBe(422);
    const error = (result.body as unknown as { error: { code: string; message: string; mustFix: { m: string }[] } }).error;
    expect(error.code).toBe('MUST_FIX');
    expect(error.message).toBe('Fix what Nova flags before sending this for approval.');
    expect(error.mustFix.map((issue) => issue.m)).toContain('“Approval” doesn’t say who approves yet.');
    expect((await load(created.id)).body.workflow.pending ?? null).toBeNull();
  });

  it('422 "Pick today or a later date." when goLive is in the past', async () => {
    const result = await send(SITE_ACCESS, { goLive: '2026-10-19' });
    expect(result.status).toBe(422);
    expect((result.body as unknown as { error: { message: string } }).error.message).toBe(PAST_DATE);
    expect((await load(SITE_ACCESS)).body.workflow.pending ?? null).toBeNull();
  });

  it('accepts today and later, and rejects a goLive that is not a date', async () => {
    expect((await send(SITE_ACCESS, { goLive: '20 Oct 2026' })).status).toBe(400);
    expect((await send(SITE_ACCESS, { goLive: TEST_AS_OF })).status).toBe(201);
  });

  it('an undecided overlap blocks sending, and a choice that is not about an overlap is refused', async () => {
    const blocked = await send(DATA_AND_AI, { goLive: TEST_AS_OF });
    expect(blocked.status).toBe(422);
    const wrong = await send(DATA_AND_AI, { goLive: TEST_AS_OF, precedence: [{ otherId: 'wf-wo-sub', winner: 'self' }] });
    expect(wrong.status).toBe(422);
    expect((wrong.body as unknown as { error: { code: string } }).error.code).toBe('NOT_AN_OVERLAP');
  });

  it('403 "You can’t approve your own change." when the author approves, and nothing changes', async () => {
    const { body: request } = await send(SITE_ACCESS, { goLive: TEST_AS_OF });
    const result = await approve(request.id, ADMIN);
    expect(result.status).toBe(403);
    expect(result.body.error.message).toBe(OWN_CHANGE);
    const after = (await load(SITE_ACCESS)).body;
    expect(after.workflow.version).toBe(1);
    expect(after.workflow.pending.submittedBy).toBe(ADMIN);
  });

  it('the author cannot reject their own change either, and someone without the permission cannot act', async () => {
    const { body: request } = await send(SITE_ACCESS, { goLive: TEST_AS_OF });
    expect((await reject(request.id, ADMIN)).body.error.message).toBe(OWN_CHANGE);
    const grace = await approve(request.id, 'Grace Kim');
    expect(grace.status).toBe(403);
    expect(grace.body.error.message).toBe('You don’t have the “Approve flow changes” permission.');
    expect((await reject(request.id, 'Owen Clarke')).status).toBe(403);
  });

  it('the first publish of "Data and AI hires" becomes v1 (LP-10)', async () => {
    const before = (await load(DATA_AND_AI)).body.workflow as Workflow;
    expect([before.version, before.status, before.published]).toEqual([0, 'draft', null]);

    const open = await review(DATA_AND_AI);
    expect(open.body.openOverlaps.map((overlap: { id: string }) => overlap.id)).toEqual([UK_TECH]);
    expect(open.body.impact).toBe(26);

    const sent = await send(DATA_AND_AI, { goLive: TEST_AS_OF, precedence: [{ otherId: UK_TECH, winner: 'self' }] });
    expect(sent.status).toBe(201);
    expect(sent.body).toMatchObject({ workflowId: DATA_AND_AI, status: 'pending', requestedBy: ADMIN, goLive: TEST_AS_OF });

    // 03 §13.3: nothing changes on either workflow until the second person approves.
    const waiting = (await load(DATA_AND_AI)).body.workflow as Workflow;
    expect(waiting.pending).toEqual({ submittedBy: ADMIN, submittedAt: '2026-10-20T09:00:00Z', effective: TEST_AS_OF, precedence: [{ otherId: UK_TECH, winner: 'self' }] });
    expect(waiting.priority).toBeNull();
    expect(waiting.version).toBe(0);
    expect((await load(UK_TECH)).body.workflow.priority).toBeNull();

    const approved = await approve(sent.body.id);
    expect(approved.status).toBe(200);
    expect(approved.body).toMatchObject({ version: 1, submittedBy: ADMIN, approvedBy: APPROVER, effective: TEST_AS_OF, name: 'Data and AI hires' });

    const live = (await load(DATA_AND_AI, APPROVER)).body;
    expect(live.workflow).toMatchObject({ version: 1, status: 'live', priority: 1, pending: null, effective: TEST_AS_OF });
    expect(live.workflow.published.nodes).toEqual(live.workflow.draft.nodes);
    expect(live.versions.map((version: { version: number }) => version.version)).toEqual([1]);
    expect((await load(UK_TECH, APPROVER)).body.workflow.priority).toBe(2);
    expect(live.publishedNotice).toBeUndefined();
  });

  it('tells the author once, on their first load after the approval (03 §13.5, LP-11)', async () => {
    const { body: request } = await send(SITE_ACCESS, { goLive: TEST_AS_OF });
    await approve(request.id);
    const first = await load(SITE_ACCESS);
    expect(first.body.workflow.version).toBe(2);
    expect(first.body.publishedNotice).toEqual({ version: 2, effective: TEST_AS_OF });
    expect((await load(SITE_ACCESS)).body.publishedNotice).toBeUndefined();
  });

  it('a request can be decided once, and approving twice cannot make two versions', async () => {
    const { body: request } = await send(SITE_ACCESS, { goLive: TEST_AS_OF });
    expect((await approve(request.id)).status).toBe(200);
    const again = await approve(request.id);
    expect(again.status).toBe(409);
    expect(again.body.error.message).toBe('This change isn’t waiting for approval.');
    expect((await reject(request.id)).status).toBe(409);
    expect((await load(SITE_ACCESS, APPROVER)).body.versions).toHaveLength(2);
  });

  it('sending twice is refused while one is waiting', async () => {
    expect((await send(SITE_ACCESS, { goLive: TEST_AS_OF })).status).toBe(201);
    const again = await send(SITE_ACCESS, { goLive: TEST_AS_OF });
    expect(again.status).toBe(409);
    expect((await call(listRequests, '/api/flow-studio/publish-requests?status=pending', { user: APPROVER })).body).toHaveLength(1);
  });

  it('rejecting needs a comment, clears the wait and publishes nothing', async () => {
    const { body: request } = await send(SITE_ACCESS, { goLive: TEST_AS_OF });
    expect((await reject(request.id, APPROVER, {})).status).toBe(400);
    expect((await reject(request.id, APPROVER, { comment: '   ' })).status).toBe(400);
    const rejected = await reject(request.id, APPROVER, { comment: 'Needs a backup' });
    expect(rejected.status).toBe(200);
    expect(rejected.body).toMatchObject({ status: 'rejected', decidedBy: APPROVER, comment: 'Needs a backup' });
    const after = (await load(SITE_ACCESS)).body.workflow as Workflow;
    expect(after.pending).toBeNull();
    expect(after.version).toBe(1);
    expect((await send(SITE_ACCESS, { goLive: TEST_AS_OF })).status).toBe(201);
  });

  it('what is published is what was sent: later edits stay in the next draft (04 §10)', async () => {
    const { body: found } = await load(SITE_ACCESS);
    const { body: request } = await send(SITE_ACCESS, { goLive: TEST_AS_OF });
    const sentNodes = JSON.stringify(found.workflow.draft.nodes);

    const stepId = Object.keys(found.workflow.draft.nodes).find((id) => id !== 'T' && id !== 'END') as string;
    const editedNodes = { ...found.workflow.draft.nodes, [stepId]: { ...found.workflow.draft.nodes[stepId], label: 'Edited after sending' } };
    expect((await saveDraft(SITE_ACCESS, { ...found.workflow, draft: { nodes: editedNodes } }, found.draftRev)).status).toBe(200);
    await approve(request.id);

    const after = (await load(SITE_ACCESS)).body.workflow as Workflow;
    expect(JSON.stringify(after.published?.nodes)).toBe(sentNodes);
    expect(after.draft.nodes[stepId].label).toBe('Edited after sending');
  });

  it('keeps an inactive workflow inactive when it publishes (03 §13.5)', async () => {
    await setActive(SITE_ACCESS, false);
    const { body: request } = await send(SITE_ACCESS, { goLive: TEST_AS_OF });
    await approve(request.id);
    const after = (await load(SITE_ACCESS)).body.workflow as Workflow;
    expect([after.status, after.version]).toEqual(['inactive', 2]);
  });

  it('creates one inbox copy per approver, never for the author, and the first decision closes every copy (05 §7)', async () => {
    const { resetMemoryStore, memoryDriver } = await import('@flow-studio/data/memory/store');
    await resetMemoryStore();
    const { body: request } = await send(SITE_ACCESS, { goLive: TEST_AS_OF });
    const driver = await memoryDriver();
    const copies = await driver.list('items', { publishRequestId: request.id });
    expect(copies.map((row) => (row.doc as { assignee: string }).assignee)).toEqual([APPROVER]);
    expect(copies[0].doc).toMatchObject({ kind: 'publish_request', runId: null, nodeId: null, status: 'open' });
    await approve(request.id);
    expect((await driver.list('items', { publishRequestId: request.id }))[0].doc).toMatchObject({ status: 'done', decision: 'approved' });
  });

  it('with no other approver the review has the must-fix row and sending is blocked (LP-13, UI-PERM-01)', async () => {
    await resetApp('author-only-approver');
    await signIn(ADMIN);
    const result = await review(SITE_ACCESS);
    expect(result.body.canSend).toBe(false);
    expect(result.body.mustFix).toContainEqual({ sev: 'bad', m: 'Nobody else can approve flow changes yet. Ask an admin to give someone the “Approve flow changes” permission.' });
    expect((await send(SITE_ACCESS, { goLive: TEST_AS_OF })).status).toBe(422);
  });

  it('the list shows pending requests to people with the permission only', async () => {
    const { body: request } = await send(SITE_ACCESS, { goLive: TEST_AS_OF });
    const listed = await call(listRequests, '/api/flow-studio/publish-requests?status=pending', { user: APPROVER });
    expect(listed.body.map((item: PublishRequest) => item.id)).toEqual([request.id]);
    expect((await call(listRequests, '/api/flow-studio/publish-requests', { user: 'Owen Clarke' })).status).toBe(403);
    expect((await call(listRequests, '/api/flow-studio/publish-requests?status=approved', { user: APPROVER })).status).toBe(400);
    await approve(request.id);
    expect((await call(listRequests, '/api/flow-studio/publish-requests?status=pending', { user: APPROVER })).body).toEqual([]);
  });
});

describe('draft saves', () => {
  it('moves draftRev on, and a stale draftRev gets 409 with the exact toast and overwrites nothing', async () => {
    const { body: found } = await load('wf-onboard');
    expect(found.draftRev).toBe(1);
    const first = await saveDraft('wf-onboard', { ...found.workflow, name: 'First save' }, 1);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ draftRev: 2 });

    const stale = await saveDraft('wf-onboard', { ...found.workflow, name: 'Second save' }, 1);
    expect(stale.status).toBe(409);
    expect(stale.body).toEqual({ error: { code: 'CONFLICT', message: CONFLICT_TOAST } });
    expect((await load('wf-onboard')).body.workflow.name).toBe('First save');
    expect((await load('wf-onboard')).body.draftRev).toBe(2);
  });

  it('keeps the key order of draft.nodes through a load and a save', async () => {
    const { body: found } = await load('wf-onboard');
    const seeded = Object.keys(workflowById(makeContext(), 'wf-onboard').draft.nodes);
    expect(Object.keys(found.workflow.draft.nodes)).toEqual(seeded);

    const reordered = Object.fromEntries(Object.entries(found.workflow.draft.nodes as Record<string, unknown>).reverse());
    expect((await saveDraft('wf-onboard', { ...found.workflow, draft: { nodes: reordered } }, 1)).status).toBe(200);
    expect(Object.keys((await load('wf-onboard')).body.workflow.draft.nodes)).toEqual([...seeded].reverse());
  });

  it('takes what an editing operation produces', async () => {
    const { body: found } = await load('wf-wo-sub');
    const ed = createEditor(makeContext());
    const nodes = ed.insertStep(found.workflow.draft.nodes, 'T', 'next', { kind: 'cond' });
    const saved = await saveDraft('wf-wo-sub', { ...found.workflow, draft: { nodes } }, 1);
    expect(saved.status).toBe(200);
    expect(Object.keys((await load('wf-wo-sub')).body.workflow.draft.nodes)).toEqual(Object.keys(nodes as object));
  });

  it('ignores anything a draft save may not change: status, version, published, pending, priority, id', async () => {
    const { body: found } = await load(DATA_AND_AI);
    const forged = {
      ...found.workflow,
      id: 'wf-other',
      status: 'live',
      version: 9,
      priority: 1,
      pending: { submittedBy: 'x', submittedAt: 'x', effective: '2026-10-20' },
      published: found.workflow.draft,
      versions: [],
      name: 'Renamed',
    };
    expect((await saveDraft(DATA_AND_AI, forged, 1)).status).toBe(200);
    const after = (await load(DATA_AND_AI)).body.workflow as Workflow;
    expect(after).toMatchObject({ id: DATA_AND_AI, status: 'draft', version: 0, priority: null, published: null, name: 'Renamed' });
    expect(after.pending ?? null).toBeNull();
  });

  it('a field left out of the draft is removed', async () => {
    const { body: found } = await load('wf-sow-co');
    expect(found.workflow.basis).toBe('running');
    const withoutBasis = { ...found.workflow };
    delete withoutBasis.basis;
    expect((await saveDraft('wf-sow-co', withoutBasis, 1)).status).toBe(200);
    expect((await load('wf-sow-co')).body.workflow.basis).toBeUndefined();
  });

  it('refuses a graph that does not hold together, an unknown workflow and a bad body', async () => {
    const { body: found } = await load('wf-onboard');
    const nodes = { ...found.workflow.draft.nodes, T: { ...found.workflow.draft.nodes.T, outs: [{ key: 'next', to: 'nowhere' }] } };
    const broken = await saveDraft('wf-onboard', { ...found.workflow, draft: { nodes } }, 1);
    expect(broken.status).toBe(422);
    expect(broken.body.error.code).toBe('INVALID_DRAFT');
    expect((await load('wf-onboard')).body.draftRev).toBe(1);
    expect((await saveDraft('nope', found.workflow, 1)).status).toBe(404);
    expect((await saveDraft('wf-onboard', found.workflow, 0)).status).toBe(400);
    for (const notAWorkflow of [null, 'text', 3, []]) expect((await saveDraft('wf-onboard', notAWorkflow, 1)).status).toBe(400);
    expect((await saveDraft('wf-onboard', { name: 'No graph' }, 1)).status).toBe(422);
    const notJson = await call(draftRoute, '/api/flow-studio/workflows/wf-onboard/draft', { method: 'PUT', user: ADMIN, params: params('wf-onboard'), rawBody: '{nope' });
    expect(notJson.status).toBe(400);
  });
});

describe('active and inactive', () => {
  it('switches at once, keeps the version and gives the exact toasts (03 §14.4)', async () => {
    const off = await setActive('wf-jp', false);
    expect(off.status).toBe(200);
    expect(off.body.workflow).toMatchObject({ status: 'inactive', version: 1 });
    expect(off.body.toast).toBe('“Job posting created” is inactive. It can’t be deleted, only turned back on');
    expect(off.body.warning).toBe('No other active workflow covers every job posting, so new job postings that only this one covers won’t start or be approved until one is active. Nothing is approved automatically.');
    const on = await setActive('wf-jp', true);
    expect(on.body.workflow.status).toBe('live');
    expect(on.body.toast).toBe('“Job posting created” is active again');
    expect(on.body.warning).toBeNull();
  });

  it('does not make an open editor conflict: the rev stays, and the next save keeps the status', async () => {
    const { body: found } = await load('wf-jp');
    await setActive('wf-jp', false);
    expect((await load('wf-jp')).body.draftRev).toBe(found.draftRev);
    expect((await saveDraft('wf-jp', { ...found.workflow, name: 'Renamed' }, found.draftRev)).status).toBe(200);
    expect((await load('wf-jp')).body.workflow).toMatchObject({ status: 'inactive', name: 'Renamed' });
  });

  it('a draft has no switch', async () => {
    const result = await setActive(DATA_AND_AI, true);
    expect(result.status).toBe(422);
    expect(result.body.error.message).toBe('Publish it to make it active.');
    expect((await load(DATA_AND_AI)).body.workflow.status).toBe('draft');
  });

  it('shows in the picker text when inactive', async () => {
    await setActive('wf-jp', false);
    const list = (await call<WorkflowSummary[]>(listRoute, '/api/flow-studio/workflows', { user: ADMIN })).body;
    expect(list.find((row) => row.id === 'wf-jp')?.scopeSummary).toBe('Inactive · Everywhere');
  });
});

describe('workflows', () => {
  it('lists every workflow in the order of 04 §3.1', async () => {
    const result = await call<WorkflowSummary[]>(listRoute, '/api/flow-studio/workflows', { user: ADMIN });
    expect(result.status).toBe(200);
    expect(result.body.map((row) => `${row.name} · ${row.scopeSummary}`)).toEqual([
      'Job posting created · Everywhere',
      'Work order submitted · Everywhere',
      'UK Technology work orders · UK · Technology',
      'Data and AI hires · Data',
      'Work order changed · Everywhere',
      'SOW created · Everywhere',
      'SOW change order submitted · Everywhere',
      'Contractor onboarding · Everywhere',
      'Assignment changed · Everywhere',
      'Assignment ending · Everywhere',
      'Contractor offboarding · Everywhere',
      'Site access request · Everywhere',
      'Timesheet submitted · Everywhere',
      'Invoice received · Everywhere',
      'Document renewal · Everywhere',
    ]);
    expect(result.body.filter((row) => row.isVariationOf).map((row) => [row.id, row.isVariationOf])).toEqual([
      [UK_TECH, 'wf-wo-sub'],
      [DATA_AND_AI, 'wf-wo-sub'],
    ]);
    expect(result.body[0]).toEqual({ id: 'wf-jp', name: 'Job posting created', recordType: 'job_posting', event: 'created', status: 'live', version: 1, scopeSummary: 'Everywhere' });
  });

  it('creates a new workflow with the 03 §16.13 defaults, and never reuses an id', async () => {
    const first = await call<Workflow>(createRoute, '/api/flow-studio/workflows', { user: ADMIN, body: {} });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ id: 'nf101', name: 'New workflow', records: ['work_order'], event: 'submitted', status: 'draft', version: 0, effective: '2026-12-01', owner: 'Procurement operations', published: null, onReject: { recipients: ['hm'], resubmitDays: 5 } });
    const second = await call<Workflow>(createRoute, '/api/flow-studio/workflows', { user: ADMIN, body: { fromWorkflowId: 'wf-ts-sub' } });
    expect(second.body).toMatchObject({ id: 'nf102', records: ['timesheet'], event: 'submitted' });
    expect((await load('nf102')).body).toMatchObject({ draftRev: 1, versions: [] });
    expect((await call(createRoute, '/api/flow-studio/workflows', { user: ADMIN, body: { fromWorkflowId: 'nope' } })).status).toBe(404);
    const list = (await call<WorkflowSummary[]>(listRoute, '/api/flow-studio/workflows', { user: ADMIN })).body;
    expect(list.find((row) => row.id === 'nf101')?.isVariationOf).toBeUndefined();
  });

  it('loads a seeded workflow with its stored version approved by "Seed"', async () => {
    const { status, body } = await load('wf-wo-sub-wo-uk-tech');
    expect(status).toBe(200);
    expect(body.versions).toHaveLength(1);
    expect(body.versions[0]).toMatchObject({ version: 3, approvedBy: 'Seed', submittedBy: 'Seed', effective: body.workflow.effective, name: 'UK Technology work orders' });
    expect(body.workflow.versions[0].version).toBe(3);
    expect(body.versions[0].workflowId).toBeUndefined();
  });

  it('answers 404 for a workflow that is not there', async () => {
    expect((await load('nope')).status).toBe(404);
    expect((await call(lintRoute, '/api/flow-studio/workflows/nope/lint', { user: ADMIN, params: params('nope') })).status).toBe(404);
    expect((await review('nope')).status).toBe(404);
  });

  it('lint is the engine result for the stored draft (LP-11)', async () => {
    const result = await call(lintRoute, `/api/flow-studio/workflows/${SITE_ACCESS}/lint`, { user: ADMIN, params: params(SITE_ACCESS) });
    expect(result.body).toEqual({ issues: [], recs: 0 });
  });

  it('publish-review is the engine result (LP-11)', async () => {
    const result = await review(SITE_ACCESS);
    expect(result.body).toEqual({ impact: 0, mustFix: [], overlaps: [], openOverlaps: [], canSend: true, effective: TEST_AS_OF });
  });
});

describe('reference, samples, engine context', () => {
  it('reference has the 01 §5.1 keys, normalised on read', async () => {
    const { status, body } = await call(referenceRoute, '/api/flow-studio/reference', { user: ADMIN });
    expect(status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['catalog', 'digitalWorkers', 'people', 'presets', 'rules', 'systems']);
    expect(body.catalog.FIELD.total_value.id).toBe('total_value');
    expect(body.rules).toHaveLength(3);
    expect(body.people.OOO['Hannah Brooks'].until).toBe('2026-10-24');
  });

  it('samples are the 29 records', async () => {
    const { body } = await call(samplesRoute, '/api/flow-studio/samples', { user: ADMIN });
    expect(body).toHaveLength(29);
    expect(body.map((sample: { id: string }) => sample.id)).toEqual(makeContext().samples.map((sample) => sample.id));
  });

  it('import replaces one key after validating it, and only for those allowed', async () => {
    const { body: before } = await call(referenceRoute, '/api/flow-studio/reference', { user: ADMIN });
    const rules = { approvalRules: before.rules.slice(0, 2) };
    expect((await call(importRoute, '/api/flow-studio/reference/import', { user: APPROVER, body: { key: 'approval-rules', data: rules } })).status).toBe(204);
    expect((await call(referenceRoute, '/api/flow-studio/reference', { user: ADMIN })).body.rules).toHaveLength(2);

    const invalid = await call(importRoute, '/api/flow-studio/reference/import', { user: APPROVER, body: { key: 'approval-rules', data: { approvalRules: [{ id: 'x' }] } } });
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.code).toBe('INVALID_REFERENCE');
    expect((await call(importRoute, '/api/flow-studio/reference/import', { user: APPROVER, body: { key: 'workflows', data: {} } })).status).toBe(400);
    expect((await call(importRoute, '/api/flow-studio/reference/import', { user: ADMIN, body: { key: 'approval-rules', data: rules } })).status).toBe(403);
  });

  it('the engine context survives JSON: the client gets the same Test result as the server', async () => {
    const { status, body } = await call(engineContextRoute, '/api/flow-studio/engine-context', { user: ADMIN });
    expect(status).toBe(200);
    expect(body.asOf).toBe(TEST_AS_OF);
    expect(body.approverAvailability).toEqual({ othersCanApprove: true });
    expect(body.idGen).toBeUndefined();
    const ctx: EngineContext = {
      ...body,
      idGen: createIdGen(101),
      catalog: normaliseCatalog(body.catalog),
      people: normalisePeople(body.people, body.workflows),
    };
    const workflow = workflowById(ctx, UK_TECH);
    const record = ctx.samples.find((sample) => sample.id === 'WO-2214');
    expect(normDeep(runTest({ workflow, record: record as EngineContext['samples'][number], ctx }))).toStrictEqual(normDeep(expectedOf('EN-022')));
  });
});

describe('nova condition', () => {
  const ask = (text: string, nodeId = 'T') =>
    call(novaRoute, '/api/flow-studio/nova/condition', { user: ADMIN, body: { text, workflowId: 'wf-wo-sub', nodeId } });

  it('falls back to the parser without a key, and says so', async () => {
    const result = await ask('total value over $250K');
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ rows: [{ f: 'total_value', op: '>', v: 250000 }], join: 'all', source: 'parser' });
  });

  it('gives the exact messages for empty and unmatched text', async () => {
    const empty = await ask('   ');
    expect([empty.status, empty.body.error.message]).toEqual([422, 'Say when this approver is needed']);
    const unmatched = await ask('the moon is full');
    expect(unmatched.status).toBe(422);
    expect(unmatched.body.error.message).toBe('I couldn’t match that to a field. Try naming the field and value, e.g. “work country is Canada” or “total value over $250K”.');
  });

  it('checks the step exists', async () => {
    expect((await ask('total value over $250K', 'nope')).status).toBe(404);
  });
});

describe('permissions', () => {
  const editorRoutes: [string, () => Promise<{ status: number }>][] = [
    ['list', () => call(listRoute, '/api/flow-studio/workflows', {})],
    ['create', () => call(createRoute, '/api/flow-studio/workflows', { body: {} })],
    ['load', () => load('wf-jp', 'nobody')],
    ['draft', () => saveDraft('wf-jp', {}, 1, 'nobody')],
    ['active', () => setActive('wf-jp', false, 'nobody')],
    ['simulate', () => simulate('wf-jp', { recordId: 'x' }, 'nobody')],
    ['lint', () => call(lintRoute, '/x', { params: params('wf-jp') })],
    ['review', () => review('wf-jp', 'nobody')],
    ['send', () => send('wf-jp', { goLive: TEST_AS_OF }, 'nobody')],
    ['requests', () => call(listRequests, '/x', {})],
    ['approve', () => approve('x', 'nobody')],
    ['reject', () => reject('x', 'nobody')],
    ['reference', () => call(referenceRoute, '/x', {})],
    ['import', () => call(importRoute, '/x', { body: { key: 'catalog', data: {} } })],
    ['samples', () => call(samplesRoute, '/x', {})],
    ['nova', () => call(novaRoute, '/x', { body: { text: 'a', workflowId: 'b', nodeId: 'c' } })],
    ['engine context', () => call(engineContextRoute, '/x', {})],
  ];

  it.each(editorRoutes)('%s needs someone signed in', async (_name, request) => {
    expect((await request()).status).toBe(401);
  });

  const withoutEdit: [string, () => Promise<{ status: number; body: unknown }>][] = [
    ['list', () => call(listRoute, '/x', { user: 'Grace Kim' })],
    ['create', () => call(createRoute, '/x', { user: 'Grace Kim', body: {} })],
    ['load', () => load('wf-jp', 'Grace Kim')],
    ['draft', () => saveDraft('wf-jp', {}, 1, 'Grace Kim')],
    ['active', () => setActive('wf-jp', false, 'Grace Kim')],
    ['simulate', () => simulate('wf-jp', { recordId: 'x' }, 'Grace Kim')],
    ['lint', () => call(lintRoute, '/x', { user: 'Grace Kim', params: params('wf-jp') })],
    ['review', () => review('wf-jp', 'Grace Kim')],
    ['send', () => send('wf-jp', { goLive: TEST_AS_OF }, 'Grace Kim')],
    ['reference', () => call(referenceRoute, '/x', { user: 'Grace Kim' })],
    ['samples', () => call(samplesRoute, '/x', { user: 'Grace Kim' })],
    ['nova', () => call(novaRoute, '/x', { user: 'Grace Kim', body: { text: 'a', workflowId: 'b', nodeId: 'c' } })],
    ['engine context', () => call(engineContextRoute, '/x', { user: 'Grace Kim' })],
  ];

  it.each(withoutEdit)('%s needs flow.edit', async (_name, request) => {
    const result = await request();
    expect(result.status).toBe(403);
    expect((result.body as { error: { code: string } }).error.code).toBe('FORBIDDEN');
  });

  it('admin implies every permission (01 §5)', async () => {
    expect((await call(listRoute, '/x', { user: APPROVER })).status).toBe(200);
    const actors = loadTestActors().actorSets.default.users.find((user) => user.name === APPROVER);
    expect(actors?.permissions).toEqual(['admin']);
  });

  it('checks permissions before reading the body', async () => {
    const result = await call(draftRoute, '/x', { method: 'PUT', user: 'Grace Kim', params: params('wf-jp'), rawBody: '{nope' });
    expect(result.status).toBe(403);
  });
});

describe('nothing is deleted', () => {
  it('no Flow Studio or runtime route exports DELETE', async () => {
    const root = join(__dirname, '..', '..', 'app', 'api');
    const files = [...routeFiles(join(root, 'flow-studio')), ...routeFiles(join(root, 'runtime'))];
    expect(files.length).toBeGreaterThan(25);
    for (const file of files) {
      const route = (await import(/* @vite-ignore */ file)) as Record<string, unknown>;
      expect(route.DELETE, file).toBeUndefined();
      expect(route.dynamic, file).toBe('force-dynamic');
      expect(route.runtime, file).toBe('nodejs');
    }
  });
});

describe('PUT /draft with supersedes: a page that cannot wait for its own save (01 §3.2)', () => {
  const put = (draft: unknown, draftRev: number, supersedes?: string) =>
    call(draftRoute, '/api/flow-studio/workflows/wf-wo-sub/draft', { method: 'PUT', user: ADMIN, params: params('wf-wo-sub'), body: { draft, draftRev, ...(supersedes ? { supersedes } : {}) } });
  const current = async () => (await load('wf-wo-sub')).body as { workflow: Workflow; draftRev: number };
  const named = (workflow: Workflow, name: string): Workflow => ({ ...workflow, name });

  it('replaces the save it names when that one landed first', async () => {
    const { workflow, draftRev } = await current();
    const first = named(workflow, 'First');
    expect((await put(first, draftRev)).status).toBe(200);
    const second = await put(named(workflow, 'Second'), draftRev, draftHash(first));
    expect(second.status).toBe(200);
    expect(second.body.draftRev).toBe(draftRev + 2);
    expect((await current()).workflow.name).toBe('Second');
  });

  it('is an ordinary save when the one it names has not landed, and that one then gets a conflict', async () => {
    const { workflow, draftRev } = await current();
    const first = named(workflow, 'First');
    expect((await put(named(workflow, 'Second'), draftRev, draftHash(first))).status).toBe(200);
    expect((await put(first, draftRev)).status).toBe(409);
    expect((await current()).workflow.name).toBe('Second');
  });

  it('still refuses when someone else saved in between: it is a compare-and-swap, not an override', async () => {
    const { workflow, draftRev } = await current();
    const first = named(workflow, 'First');
    expect((await put(first, draftRev)).status).toBe(200);
    const fresh = await current();
    expect((await put(named(fresh.workflow, 'Someone else'), fresh.draftRev)).status).toBe(200);
    const late = await put(named(workflow, 'Second'), draftRev, draftHash(first));
    expect(late.status).toBe(409);
    expect((await current()).workflow.name).toBe('Someone else');
  });

  it('a stale rev with a fingerprint that matches nothing is a plain conflict', async () => {
    const { workflow, draftRev } = await current();
    expect((await put(named(workflow, 'First'), draftRev)).status).toBe(200);
    expect((await put(named(workflow, 'Second'), draftRev, 'not-a-real-hash')).status).toBe(409);
  });
});

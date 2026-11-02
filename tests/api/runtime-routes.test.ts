import { beforeEach, describe, expect, it } from 'vitest';
import { POST as eventsRoute } from '../../app/api/runtime/events/route';
import { GET as inboxRoute } from '../../app/api/runtime/inbox/route';
import { POST as recordsRoute } from '../../app/api/runtime/records/[type]/[id]/route';
import { GET as runsRoute } from '../../app/api/runtime/runs/route';
import { GET as runRoute } from '../../app/api/runtime/runs/[id]/route';
import { POST as chooseRoute } from '../../app/api/runtime/runs/[id]/choose/route';
import { POST as pauseRoute } from '../../app/api/runtime/runs/[id]/pause/route';
import { POST as resumeRoute } from '../../app/api/runtime/runs/[id]/resume/route';
import { POST as stopRoute } from '../../app/api/runtime/runs/[id]/stop/route';
import { POST as tickRoute } from '../../app/api/runtime/tick/route';
import { GET as itemRoute } from '../../app/api/runtime/work-items/[id]/route';
import { POST as decideRoute } from '../../app/api/runtime/work-items/[id]/decide/route';
import { POST as doneRoute } from '../../app/api/runtime/work-items/[id]/done/route';
import { POST as provideRoute } from '../../app/api/runtime/work-items/[id]/provide-field/route';
import { POST as resubmitRoute } from '../../app/api/runtime/work-items/[id]/resubmit/route';
import { POST as submitRoute } from '../../app/api/runtime/work-items/[id]/submit-items/route';
import { GET as runningRoute } from '../../app/api/flow-studio/workflows/[id]/running/route';
import { POST as importRoute } from '../../app/api/flow-studio/reference/import/route';
import { call, resetApp, signIn, setE2EEnv } from '../support/api';
import { recordOf } from '../support/runtime-world';
import { readRawSeed } from '@flow-studio/data/seed-files';

setE2EEnv();

const FORBIDDEN_RUN = 'Only the workflow owner or an admin can pause, resume or stop it.';
const SERVICE = { 'x-levv-service-token': 'test-service-token' };
const eventFor = (id: string) => {
  const record = recordOf(id);
  return { source: record.source, recordType: record.record, recordId: id, event: record.event, data: { ...record } };
};

let RUN_ID = '';
let ITEM_ID = '';

beforeEach(async () => {
  await resetApp();
  for (const user of ['Flow Admin', 'Samira Khan', 'Owen Clarke', 'Grace Kim', 'Raj Patel', 'Fatima Zahra']) await signIn(user);
  const started = await call(eventsRoute, '/x', { body: eventFor('WO-2231'), headers: SERVICE });
  expect(started.body.outcome).toBe('started');
  RUN_ID = started.body.runIds[0];
  ITEM_ID = (await call(inboxRoute, '/x', { user: 'Raj Patel' })).body.approvals[0].id;
});

describe('POST /api/runtime/events', () => {
  const event = eventFor('WO-2231');

  it('takes the service token or an admin, and nobody else', async () => {
    const byToken = await call(eventsRoute, '/x', { body: event, headers: SERVICE });
    expect(byToken.status).toBe(200);
    expect(byToken.body.outcome).toBe('duplicate');
    expect(typeof byToken.body.inboundEventId).toBe('string');
    expect((await call(eventsRoute, '/x', { body: event, user: 'Samira Khan' })).body.outcome).toBe('duplicate');
    expect((await call(eventsRoute, '/x', { body: event })).status).toBe(403);
    expect((await call(eventsRoute, '/x', { body: event, headers: { 'x-levv-service-token': 'wrong' } })).status).toBe(403);
    expect((await call(eventsRoute, '/x', { body: event, user: 'Flow Admin' })).status).toBe(403);
  });

  it('validates the body', async () => {
    const result = await call(eventsRoute, '/x', { body: { source: 'levv' }, headers: SERVICE });
    expect(result.status).toBe(400);
  });
});

describe('POST /api/runtime/tick', () => {
  it('needs the cron secret', async () => {
    const ticked = await call(tickRoute, '/x', { method: 'POST', headers: { 'x-levv-cron-secret': 'test-cron-secret' } });
    expect(ticked.status).toBe(200);
    expect(ticked.body).toEqual({ processed: 0 });
    expect((await call(tickRoute, '/x', { method: 'POST' })).status).toBe(403);
    expect((await call(tickRoute, '/x', { method: 'POST', headers: { 'x-levv-cron-secret': 'wrong' } })).status).toBe(403);
  });

  it('stays closed when no secret is configured', async () => {
    const saved = process.env.LEVV_CRON_SECRET;
    delete process.env.LEVV_CRON_SECRET;
    expect((await call(tickRoute, '/x', { method: 'POST', headers: { 'x-levv-cron-secret': '' } })).status).toBe(403);
    process.env.LEVV_CRON_SECRET = saved;
  });
});

describe('runs', () => {
  it('list and detail need runs.view', async () => {
    const list = await call(runsRoute, '/x', { user: 'Grace Kim' });
    expect(list.status).toBe(200);
    expect(list.body.runs.map((run: { id: string }) => run.id)).toEqual([RUN_ID]);
    expect(list.body.runs[0]).toMatchObject({ recordId: 'WO-2231', recordTitle: 'Operations analyst', workflowName: 'Work order submitted', version: 1, status: 'running', waitingOn: ['Business sign-off: Raj Patel'] });
    const detail = await call(runRoute, '/x', { user: 'Grace Kim', params: { id: RUN_ID } });
    expect(detail.status).toBe(200);
    expect(detail.body.canControl).toBe(false);
    expect((await call(runRoute, '/x', { user: 'Owen Clarke', params: { id: RUN_ID } })).body.canControl).toBe(true);
    expect((await call(runsRoute, '/x', { user: 'Raj Patel' })).status).toBe(403);
    expect((await call(runsRoute, '/x', {})).status).toBe(401);
  });

  it('filters by status and record', async () => {
    const asked = (query: string) => call(runsRoute, `/x?${query}`, { user: 'Grace Kim' });
    expect((await asked('status=paused')).body.runs).toEqual([]);
    expect((await asked('status=running,paused')).body.runs).toHaveLength(1);
    expect((await asked('recordId=WO-2231')).body.runs).toHaveLength(1);
    expect((await asked('recordId=nope')).body.runs).toEqual([]);
    expect((await asked('workflowId=wf-jp')).body.runs).toEqual([]);
  });

  it('the run’s answer leaves the plan out, and pause and resume change the status', async () => {
    const params = { id: RUN_ID };
    const paused = await call(pauseRoute, '/x', { user: 'Owen Clarke', params, body: {} });
    expect(paused.status).toBe(200);
    expect(paused.body.status).toBe('paused');
    expect(paused.body.plan).toBeUndefined();
    expect((await call(resumeRoute, '/x', { user: 'Samira Khan', params, body: {} })).body.status).toBe('running');
    expect((await call(stopRoute, '/x', { user: 'Owen Clarke', params, body: { reason: 'Done' } })).body.status).toBe('stopped');
  });

  it.each([
    ['pause', pauseRoute, {}],
    ['resume', resumeRoute, {}],
    ['stop', stopRoute, { reason: 'Supplier dispute' }],
  ])('%s is for the owner team or runs.control, with the exact message', async (_name, route, body) => {
    const params = { id: RUN_ID };
    const refused = await call(route, '/x', { user: 'Grace Kim', params, body });
    expect(refused.status).toBe(403);
    expect(refused.body).toEqual({ error: { code: 'FORBIDDEN', message: FORBIDDEN_RUN } });
    expect((await call(route, '/x', { params, body })).status).toBe(401);
    expect((await call(route, '/x', { user: 'Owen Clarke', params: { id: 'nope' }, body })).status).toBe(404);
  });

  it('stop needs a reason (05 §4)', async () => {
    const result = await call(stopRoute, '/x', { user: 'Owen Clarke', params: { id: RUN_ID }, body: {} });
    expect(result.status).toBe(422);
    expect(result.body).toEqual({ error: { code: 'REASON_REQUIRED', message: 'A reason is required to stop a workflow.' } });
  });

  it('choosing a proposal is for the same people, and needs a conflict', async () => {
    const params = { id: RUN_ID };
    expect((await call(chooseRoute, '/x', { user: 'Grace Kim', params, body: { choice: 'a' } })).status).toBe(403);
    expect((await call(chooseRoute, '/x', { user: 'Owen Clarke', params, body: { choice: 'a' } })).body.error.code).toBe('NO_CONFLICT');
    expect((await call(chooseRoute, '/x', { user: 'Owen Clarke', params, body: { choice: 'x' } })).status).toBe(400);
  });
});

describe('inbox and work items', () => {
  it('the inbox is for anyone signed in', async () => {
    const inbox = await call(inboxRoute, '/x', { user: 'Raj Patel' });
    expect(inbox.status).toBe(200);
    expect(inbox.body.approvals).toHaveLength(1);
    expect(inbox.body.approvals[0].brief).toContain('Business sign-off: Operations analyst (WO-2231)');
    expect((await call(inboxRoute, '/x', { user: 'Grace Kim' })).body).toEqual({ approvals: [], tasks: [], flowChanges: [] });
    expect((await call(inboxRoute, '/x', {})).status).toBe(401);
  });

  const actions: [string, unknown, unknown, unknown][] = [
    ['decide', decideRoute, { decision: 'approved' }, { decision: 'maybe' }],
    ['done', doneRoute, {}, { note: 3 }],
    ['submit-items', submitRoute, { items: ['Passport'] }, {}],
    ['provide-field', provideRoute, { field: 'country', value: 'UK' }, {}],
    ['resubmit', resubmitRoute, { comment: 'Fixed' }, { comment: 3 }],
  ];

  it.each(actions)('%s is for the assignee and validates its body', async (_name, route, good, bad) => {
    const params = { id: ITEM_ID };
    expect((await call(route, '/x', { user: 'Raj Patel', params, body: bad })).status).toBe(400);
    expect((await call(route, '/x', { user: 'Grace Kim', params, body: good })).status).toBe(403);
    expect((await call(route, '/x', { params, body: good })).status).toBe(401);
    expect((await call(route, '/x', { user: 'Raj Patel', params: { id: 'nope' }, body: good })).status).toBe(404);
    // The item is an approval: only `decide` fits it, and the others refuse rather than take it for something else.
    const answered = await call(route, '/x', { user: 'Raj Patel', params, body: good });
    expect(answered.status).toBe(_name === 'decide' ? 200 : 422);
    if (_name === 'decide') expect(answered.body.status).toBe('done');
  });

  it('reading an item is for the assignee', async () => {
    const params = { id: ITEM_ID };
    const own = await call(itemRoute, '/x', { user: 'Raj Patel', params });
    expect(own.status).toBe(200);
    expect(own.body).toMatchObject({ kind: 'approve', runStatus: 'running', own: false });
    expect((await call(itemRoute, '/x', { user: 'Grace Kim', params })).status).toBe(403);
  });

  it('RT-08 on the route: a decision on a stopped run answers RUN_STOPPED', async () => {
    await call(stopRoute, '/x', { user: 'Owen Clarke', params: { id: RUN_ID }, body: { reason: 'Withdrawn' } });
    const refused = await call(decideRoute, '/x', { user: 'Raj Patel', params: { id: ITEM_ID }, body: { decision: 'approved' } });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('RUN_STOPPED');
    expect((await call(itemRoute, '/x', { user: 'Raj Patel', params: { id: ITEM_ID } })).body.runStatus).toBe('stopped');
    expect((await call(inboxRoute, '/x', { user: 'Raj Patel' })).body.approvals).toEqual([]);
  });
});

describe('POST /api/runtime/records/:type/:id', () => {
  it('is admin only and validates its body', async () => {
    const params = { type: 'work_order', id: 'WO-2231' };
    const edited = await call(recordsRoute, '/x', { user: 'Samira Khan', params, body: { data: { total_value: 1 } } });
    expect(edited.status).toBe(200);
    expect(edited.body.data.total_value).toBe(1);
    expect((await call(recordsRoute, '/x', { user: 'Samira Khan', params, body: {} })).status).toBe(400);
    expect((await call(recordsRoute, '/x', { user: 'Flow Admin', params, body: { data: {} } })).status).toBe(403);
    expect((await call(recordsRoute, '/x', { user: 'Samira Khan', params: { type: 'work_order', id: 'NOPE' }, body: { data: { a: 1 } } })).status).toBe(404);
  });
});

describe('Beside the runtime', () => {
  it('R-09 through the real import route: the item appears', async () => {
    const started = await call(eventsRoute, '/x', { body: eventFor('WO-2270'), headers: SERVICE });
    const before = await call(runRoute, '/x', { user: 'Samira Khan', params: { id: started.body.runIds[0] } });
    expect(before.body.steps.find((step: { id: string }) => step.id === 'RA_A1').status).toBe('waiting');
    expect((await call(inboxRoute, '/x', { user: 'Fatima Zahra' })).body.approvals).toEqual([]);
    const people = readRawSeed()['people-and-authority'] as { BY_COUNTRY: Record<string, unknown> };
    const data = { ...people, BY_COUNTRY: { ...people.BY_COUNTRY, priv: { Germany: 'Fatima Zahra' } } };
    expect((await call(importRoute, '/x', { user: 'Samira Khan', body: { key: 'people-and-authority', data } })).status).toBe(204);
    expect((await call(inboxRoute, '/x', { user: 'Fatima Zahra' })).body.approvals).toHaveLength(1);
  });

  it('the count behind the switch-off confirmation', async () => {
    const params = { id: 'wf-wo-sub' };
    expect((await call(runningRoute, '/x', { user: 'Flow Admin', params })).body).toEqual({ count: 1 });
    expect((await call(runningRoute, '/x', { user: 'Flow Admin', params: { id: 'wf-jp' } })).body).toEqual({ count: 0 });
    expect((await call(runningRoute, '/x', { user: 'Raj Patel', params })).status).toBe(403);
  });
});

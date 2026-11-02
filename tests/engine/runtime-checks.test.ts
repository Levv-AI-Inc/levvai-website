import { describe, expect, it } from 'vitest';
import { createEditor } from '../../src/flow-studio/engine/edit';
import { applySetup, setupOf, type Setup } from '../support/acceptance-doc';
import { mockAdapters, mockAutocomplete, mockFieldglass, type Adapters } from '../../src/flow-studio/runtime/adapters';
import { resolveWaitUntil, zonedToUtc } from '../../src/flow-studio/runtime/time';
import { readRawSeed } from '../../src/flow-studio/data/seed-files';
import { actor, createWorld, hoursAfter, recordOf, START } from '../support/runtime-world';

/** 05 §9, as written. Mock auto-completion on and the default actors, as its first sentence says. */

const logHas = (log: { m: string }[], text: string): boolean => log.some((event) => event.m === text);

describe('05 §9', () => {
  it('R-01 Event work_order/submitted for WO-2231 from Levv', async () => {
    const world = await createWorld();
    const result = await world.event('WO-2231');
    expect(result.outcome).toBe('started');
    expect(result.runIds).toHaveLength(1);
    const run = await world.run(result.runIds[0]);
    expect(run.workflowId).toBe('wf-wo-sub');
    expect(run.version).toBe(1);
    expect(run.steps.RA_CB.status).toBe('done');
    expect(run.steps.RA_CD.status).toBe('done');
    expect(run.steps.RA_A1.status).toBe('waiting');
    expect(run.steps.RA_A1.assignees).toEqual(['Raj Patel']);
    expect(run.steps.RA_A1.remindAt).toBe(hoursAfter(24));
    expect(run.steps.RA_A1.escalateAt).toBe(hoursAfter(48));
    const items = await world.items(run.id, { kind: 'approve' });
    expect(items.map((item) => item.assignee)).toEqual(['Raj Patel']);
    expect(logHas(run.log, 'Started from Levv event “Submitted”.')).toBe(true);
  });

  it('R-02 The same event again within 24h', async () => {
    const world = await createWorld();
    const first = await world.event('WO-2231');
    world.clock.set(hoursAfter(23));
    const second = await world.event('WO-2231');
    expect(second).toMatchObject({ outcome: 'duplicate', runIds: [] });
    expect((await world.store.runs.list()).map((run) => run.id)).toEqual(first.runIds);
    // After a day, or once the run has ended, the same event is a new request (05 §3.1 step 4).
    world.clock.set(hoursAfter(25));
    expect((await world.event('WO-2231')).outcome).toBe('started');
  });

  it('R-03 Event for WO-2214 (UK · Technology)', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2214');
    expect(run.workflowId).toBe('wf-wo-sub-wo-uk-tech');
    expect((await world.store.workflows.get(run.workflowId))?.workflow.name).toBe('UK Technology work orders');
  });

  it('R-04 Event for a record with no matching workflow (OB-2251)', async () => {
    const world = await createWorld();
    const result = await world.event('OB-2251');
    expect(result).toMatchObject({ outcome: 'no_workflow', runIds: [] });
    expect(await world.store.runs.list()).toEqual([]);
  });

  it('R-05 Raj Patel approves R-01', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    const before = await world.outbox({ runId: run.id });
    await world.decide((await world.itemFor(run.id, 'Raj Patel')).id, 'Raj Patel', 'approved');
    const after = await world.run(run.id);
    expect(after.steps.RA_A1.status).toBe('done');
    expect(after.steps.RA_C2.outcome).toBe('else');
    expect(after.steps.RW.status).toBe('done');
    expect(after.status).toBe('completed');
    const sent = (await world.outbox({ runId: run.id })).slice(before.length);
    expect(sent).toEqual([expect.objectContaining({ to: 'Supplier account manager', channel: 'Email', subject: 'Work order submitted: Tell the supplier' })]);
    expect(logHas(after.log, 'Completed.')).toBe(true);
  });

  it('R-06 Raj Patel rejects R-01 (step reject = requester)', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    await world.decide((await world.itemFor(run.id, 'Raj Patel')).id, 'Raj Patel', 'rejected', 'Over budget');
    const item = await world.itemFor(run.id, 'Grace Kim', 'resubmit');
    expect(item.what).toBe('Fix and resubmit Operations analyst');
    expect(item.dueAt).toBe(new Date(Date.parse(START) + 5 * 24 * 3_600_000).toISOString());
    expect((await world.run(run.id)).steps.RA_A1.status).toBe('waiting');
    expect(logHas((await world.run(run.id)).log, 'Raj Patel rejected: Over budget')).toBe(true);
    await world.advanceTo(hoursAfter(5 * 24 - 1));
    expect((await world.run(run.id)).status).toBe('running');
    await world.advanceTo(hoursAfter(5 * 24));
    const after = await world.run(run.id);
    expect(after.status).toBe('rejected');
    expect(logHas(after.log, 'Rejected at “Business sign-off”.')).toBe(true);
    const told = (await world.outbox({ runId: run.id })).filter((message) => message.subject === 'Rejected: Operations analyst');
    // The Hiring manager (onReject) resolves through ORG.Operations.hm: the record names none.
    expect(told).toEqual([expect.objectContaining({ to: 'Grace Kim', body: 'Operations analyst was rejected at “Business sign-off”. Reason: Over budget' })]);
  });

  it('R-06, resubmitted in time: the step asks again', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    await world.decide((await world.itemFor(run.id, 'Raj Patel')).id, 'Raj Patel', 'rejected', 'Over budget');
    const item = await world.itemFor(run.id, 'Grace Kim', 'resubmit');
    await world.service.resubmit(actor('Grace Kim'), item.id, { total_value: 90000 });
    const asked = await world.itemFor(run.id, 'Raj Patel', 'approve');
    expect(asked.status).toBe('open');
    await world.decide(asked.id, 'Raj Patel', 'approved');
    expect((await world.run(run.id)).status).toBe('completed');
  });

  it('R-07 WO-2214-A through onboarding, Workday step', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2214-A');
    const record = await world.store.records.get('onboarding', 'WO-2214-A');
    expect((record?.data as Record<string, unknown>).workday_worker_id).toBe('WD-WO-2214-A');
    const lines = await world.ledger('wo-2214-a.worker@example.com');
    expect(lines).toContainEqual(expect.objectContaining({ gives: 'Workday account', disp: 'remove', status: 'open' }));
    expect(logHas((await world.run(run.id)).log, 'Workday sent back Workday worker ID: WD-WO-2214-A')).toBe(true);
    expect((await world.run(run.id)).steps.WD.systemRef).toBe('WORKDAY-WO-2214-A-WD');
    const call = world.adaptersUsed.calls.find((candidate) => candidate.system === 'Workday');
    expect(call?.match).toEqual({ key: 'Work email', value: 'wo-2214-a.worker@levvbank.example' });
  });

  const offboardToHrClose = async (data: Record<string, unknown>) => {
    const world = await createWorld();
    const run = await world.start('OFF-902', {}, data);
    await world.done((await world.itemFor(run.id, 'Sam Patel')).id, 'Sam Patel');
    await world.decide((await world.itemFor(run.id, 'Tom Reed', 'collect_review')).id, 'Tom Reed', 'verified');
    await world.advanceTo('2026-10-23T16:00:00Z');
    return { world, run: await world.run(run.id) };
  };

  it('R-08 Offboarding OFF-902, Close in HR system: a brought-back id beats work email', async () => {
    const { world, run } = await offboardToHrClose({ workday_worker_id: 'WD-OFF-902' });
    expect(run.steps.HC.status).toBe('done');
    expect(run.steps.HC.call?.match).toEqual({ key: 'Workday worker ID', value: 'WD-OFF-902' });
    expect(world.adaptersUsed.calls.find((call) => call.system === 'Workday')?.match).toEqual({ key: 'Workday worker ID', value: 'WD-OFF-902' });
  });

  it('R-08, without that field it matches on Work email', async () => {
    const { run } = await offboardToHrClose({});
    expect(run.steps.HC.call?.match).toEqual({ key: 'Work email', value: 'off-902.worker@levvbank.example' });
  });

  it('R-09 WO-2270 (nobody eligible for Privacy in Germany)', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2270');
    expect(run.steps.RA_A1.status).toBe('waiting');
    expect(run.status).toBe('running');
    expect(run.plan.paused).toBe(true);
    const items = await world.items(run.id);
    expect(items.some((item) => item.key === 'priv')).toBe(false);
    expect(logHas(run.log, 'Paused: no eligible Privacy reviewer for Germany')).toBe(true);

    // Everyone who can answer answers. It is still never approved.
    const open = items.filter((item) => item.status === 'open' && item.kind === 'approve');
    expect(open.length).toBeGreaterThan(0);
    for (const item of open) await world.decide(item.id, item.assignee, 'approved');
    const waiting = await world.run(run.id);
    expect(waiting.status).toBe('running');
    expect(waiting.steps.RA_A1.status).toBe('waiting');

    // The import endpoint's effect: reference data adds a Privacy holder for Germany, and re-planning creates the item.
    const raw = readRawSeed()['people-and-authority'] as { BY_COUNTRY: Record<string, Record<string, string | null>> };
    const updated = { ...raw, BY_COUNTRY: { ...raw.BY_COUNTRY, priv: { Germany: 'Fatima Zahra' } } };
    await world.store.reference.replace('people-and-authority', updated, 'Samira Khan');
    await world.service.referenceChanged();
    const item = await world.itemFor(run.id, 'Fatima Zahra', 'approve');
    expect(item.key).toBe('priv');
    await world.decide(item.id, 'Fatima Zahra', 'approved');
    expect((await world.run(run.id)).steps.RA_A1.status).toBe('done');
  });

  it('R-10 Onboarding WO-2214-A: change the record’s start date while “Wait for start date” waits', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2214-A');
    const before = (await world.run(run.id)).steps.W1;
    expect(before.status).toBe('waiting');
    expect(before.waitUntil).toBe('2026-11-02T09:00:00.000Z');
    await world.service.editRecord('onboarding', 'WO-2214-A', { start_date: '2026-11-16' });
    const after = await world.run(run.id);
    expect(after.steps.W1.waitUntil).toBe(zonedToUtc('2026-11-16', '09:00', 'Europe/London'));
    expect(after.log.some((event) => event.type === 'wait_moved' && event.m.startsWith('The Start date changed, so the wait now ends '))).toBe(true);
  });

  it('R-11 ASN-881 run: shorten the extension while approvals are open', async () => {
    const world = await createWorld();
    const run = await world.start('ASN-881');
    // Tenure review asks HR business partner and Legal (Hannah Brooks is away, so Luis Romero).
    const hrbp = await world.itemFor(run.id, 'Erin Walsh', 'approve');
    await world.decide(hrbp.id, 'Erin Walsh', 'approved');
    const legal = await world.itemFor(run.id, 'Luis Romero', 'approve');

    // The sample's edit (ASN-881 "Try an edit"): months drop to 17, the value and end date come down.
    await world.service.editRecord('assignment', 'ASN-881', { months_engaged_after: 17, total_value: 278000, end_date: '2027-03-31' });
    const after = await world.run(run.id);
    expect(after.log.some((event) => event.type === 'record_changed' && event.m.startsWith('Record changed: ') && event.m.endsWith('. Levv re-checked who needs to approve.'))).toBe(true);
    // Legal leaves the path and is told; HR, who already answered, isn't asked again.
    expect((await world.store.workItems.get(legal.id))?.status).toBe('cancelled');
    expect((await world.outbox({ runId: run.id })).some((message) => message.to === 'Luis Romero' && message.subject.startsWith('No longer needed'))).toBe(true);
    expect(after.steps.RA_A1.status).toBe('skipped');
    expect((await world.items(after.id)).filter((item) => item.assignee === 'Erin Walsh' && item.status === 'open')).toEqual([]);
    // The next step on the line goes on: Budget owner.
    expect(after.steps.RA_A2.status).toBe('waiting');
    await world.decide((await world.itemFor(run.id, 'Lena Fischer', 'approve')).id, 'Lena Fischer', 'approved');
    expect((await world.run(run.id)).steps.RA_A2.status).toBe('done');

    // A later cut in what Budget owner depends on keeps their answer (reaskOnDecrease false, 03 §8.4).
    const finance = await world.run(run.id);
    expect(finance.steps.RA_A3.status).toBe('waiting');
    await world.service.editRecord('assignment', 'ASN-881', { total_value: 270000 });
    const again = await world.run(run.id);
    expect(again.steps.RA_A2.status).toBe('done');
    expect((await world.items(run.id)).filter((item) => item.assignee === 'Lena Fischer' && item.status === 'open')).toEqual([]);
    // Going up asks again, and what follows Budget owner stays on the line: nothing is skipped by asking twice.
    await world.service.editRecord('assignment', 'ASN-881', { total_value: 400000 });
    const asked = await world.itemFor(run.id, 'Lena Fischer', 'approve');
    const during = await world.run(run.id);
    expect(during.steps.RA_A2.status).toBe('waiting');
    expect(during.steps.RA_A3.status).toBe('waiting');
    expect(during.steps.RA_A4.status).toBe('pending');
    await world.decide(asked.id, 'Lena Fischer', 'approved');
    await world.decide((await world.itemFor(run.id, 'David Okafor', 'approve')).id, 'David Okafor', 'approved');
    const onwards = await world.run(run.id);
    expect(onwards.status).toBe('running');
    expect(onwards.steps.RA_A4.status).toBe('waiting');
    await world.decide((await world.itemFor(run.id, 'Owen Clarke', 'approve')).id, 'Owen Clarke', 'approved');
    expect((await world.run(run.id)).status).toBe('completed');
  });

  it('R-11, going back: an edit that puts a step back on the path asks it again', async () => {
    const world = await createWorld();
    const run = await world.start('ASN-881');
    const legal = await world.itemFor(run.id, 'Luis Romero', 'approve');
    await world.service.editRecord('assignment', 'ASN-881', { months_engaged_after: 17 });
    expect((await world.store.workItems.get(legal.id))?.status).toBe('cancelled');
    expect((await world.run(run.id)).steps.RA_A1.status).toBe('skipped');
    await world.service.editRecord('assignment', 'ASN-881', { months_engaged_after: 20 });
    const back = await world.run(run.id);
    expect(back.steps.RA_A1.status).toBe('waiting');
    expect((await world.itemFor(run.id, 'Luis Romero', 'approve')).status).toBe('open');
  });

  it('R-12 A check set to Stop flags (UK Technology work orders, EN-070 setup, WO-2240)', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub-wo-uk-tech', (nodes) => {
      const holder = { draft: { nodes } } as never;
      applySetup(holder, setupOf('EN-070') as Setup);
      return (holder as { draft: { nodes: typeof nodes } }).draft.nodes;
    });
    const run = await world.start('WO-2240');
    expect(run.status).toBe('stopped');
    expect(logHas(run.log, 'Stopped at “Duplicate & ghost worker”.')).toBe(true);
    expect(run.endedAt).toBeDefined();
    const sent = await world.outbox({ runId: run.id });
    expect(sent).toEqual([expect.objectContaining({ subject: 'UK Technology work orders: Tell them it stopped' })]);
    expect(await world.items(run.id)).toEqual([]);
  });
});

describe('The runtime beyond the table', () => {
  it('prerequisite: waits, starts when the record reaches it, and tells the owner once after 7 days', async () => {
    const world = await createWorld();
    const held = await world.event('INV-8812', {}, { states: [] });
    expect(held.outcome).toBe('waiting_prerequisite');
    await world.advanceTo(hoursAfter(7 * 24 - 1));
    expect(await world.outbox()).toEqual([]);
    await world.advanceTo(hoursAfter(7 * 24));
    await world.tick();
    const told = await world.outbox();
    expect(told.map((message) => message.channel)).toEqual(['In-app', 'Email']);
    expect(told[0].subject).toBe('Waiting to start: Invoice received');
    expect(told[0].to).toBe('Accounts payable');
    expect(told[0].body).toBe('“Invoice received” is waiting to start for Invoice doesn’t match timesheets (INV-8812): Levv only starts it once the timesheet or milestone is approved. It has waited 7 days.');
  });

  it('an unmet prerequisite on an event with no workflow stays no_workflow, and it never replays', async () => {
    const world = await createWorld();
    const none = await world.event('OB-2251');
    expect(none.outcome).toBe('no_workflow');
    await world.tick();
    expect(await world.store.runs.list()).toEqual([]);
  });

  it('prerequisite met later by a record edit starts the run', async () => {
    const world = await createWorld();
    const invoice = await world.event('INV-8812', {}, { states: [] });
    expect(invoice.outcome).toBe('waiting_prerequisite');
    await world.service.editRecord('invoice', 'INV-8812', { states: ['ts_approved'] });
    const [event] = await world.store.inbound.findByRecord('INV-8812');
    expect(event.outcome).toBe('started');
    expect(event.runIds).toHaveLength(1);
  });

  it('a completed work order earns wo_approved (03 §15 item 2)', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    await world.decide((await world.itemFor(run.id, 'Raj Patel')).id, 'Raj Patel', 'approved');
    expect(((await world.store.records.get('work_order', 'WO-2231'))?.data as { states: string[] }).states).toContain('wo_approved');
  });

  it('LEVV_MOCK_AUTOCOMPLETE never defaults on, and production ignores it', () => {
    expect(mockAutocomplete({})).toBe(false);
    expect(mockAutocomplete({ NODE_ENV: 'production' })).toBe(false);
    expect(mockAutocomplete({ NODE_ENV: 'production', LEVV_MOCK_AUTOCOMPLETE: '1' })).toBe(false);
    expect(mockAutocomplete({ NODE_ENV: 'production', LEVV_MOCK_AUTOCOMPLETE: '1', LEVV_E2E: '1' })).toBe(true);
    expect(mockAutocomplete({ NODE_ENV: 'development', LEVV_MOCK_AUTOCOMPLETE: '1' })).toBe(true);
    expect(mockAutocomplete({ NODE_ENV: 'development' })).toBe(false);
  });

  it('without auto-completion a provider request stays open until handed over, and mock results are marked', async () => {
    const world = await createWorld({ autocomplete: false });
    const run = await world.start('WO-2214-A');
    const open = (await world.items(run.id)).filter((item) => item.kind === 'collect' && item.status === 'open');
    expect(open.length).toBeGreaterThan(0);
    const legal = open.find((item) => item.stepName === 'Legal & compliance');
    expect(legal?.assignee).toBe('the worker');
    expect((await world.run(run.id)).steps.WD.simulated).toBe('Simulated: nothing was sent to Workday. This build has no live connection to it.');
    expect((await world.run(run.id)).log.some((event) => event.type === 'simulated' && event.m.includes('Workday'))).toBe(true);
    const handed = await world.service.submitItems({ name: 'the worker', permissions: [], ownerTeams: {} }, legal?.id as string, legal?.items as string[]);
    expect(handed.status).toBe('done');
    const after = await world.run(run.id);
    expect(after.steps.LG.status).toBe('done');
    expect(after.steps.LG.simulated).toBe('Simulated: E-signature checked nothing. This build has no live connection to it.');
    expect(await world.ledger('wo-2214-a.worker@example.com')).toContainEqual(expect.objectContaining({ gives: 'Confidentiality obligations' }));
  });

  it('a system waiting for confirmation gives up after waitH hours and applies onFail', async () => {
    const adapters = (ctx: Parameters<typeof mockAdapters>[0]): Adapters => {
      const inner = mockAdapters(ctx);
      return {
        ...inner,
        system: (name, record) => ({
          ...inner.system(name, record),
          execute: async () => ({ status: 'pending', ref: 'R-1' }),
          confirm: async () => ({ status: 'pending' }),
        }),
      };
    };
    const world = await createWorld({ adapters });
    const run = await world.start('OFF-902');
    await world.done((await world.itemFor(run.id, 'Sam Patel')).id, 'Sam Patel');
    await world.decide((await world.itemFor(run.id, 'Tom Reed', 'collect_review')).id, 'Tom Reed', 'verified');
    await world.advanceTo('2026-10-23T16:00:00Z');
    const waiting = await world.run(run.id);
    expect(waiting.steps.RV.status).toBe('waiting');
    expect(waiting.steps.RV.confirmBy).toBe('2026-10-24T16:00:00.000Z');
    await world.advanceTo('2026-10-24T16:00:00Z');
    const fix = await world.itemFor(run.id, 'Jordan Lee', 'task');
    expect(fix.what).toBe('Fix Okta: Okta didn’t confirm within 24h');
  });

  it('a Collect & verify failure routes to its generated escalation, and rejecting that is final', async () => {
    const world = await createWorld();
    const run = await world.start('AR-301', {}, { outcomesL: { 'Identity & site details': 'fail' } });
    await world.decide((await world.itemFor(run.id, 'Ravi Kumar', 'approve')).id, 'Ravi Kumar', 'approved');
    const decide = await world.itemFor(run.id, 'Ravi Kumar', 'escalation');
    expect(decide.brief).toContain('What’s asked: decide. Approve to carry on, reject with a comment to stop, or send it back to the requester.');
    expect(await world.decide(decide.id, 'Ravi Kumar', 'rejected')).toMatchObject({ ok: false, code: 'COMMENT_REQUIRED', message: 'Add a comment to reject.' });
    await world.decide(decide.id, 'Ravi Kumar', 'rejected', 'Not this person');
    expect((await world.run(run.id)).status).toBe('rejected');
  });

  it('a failed check with “Ask people to decide”: approve carries on, reject stops the run', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2214-A', {}, { outcomesL: { 'Background check': 'fail' } });
    const stepBefore = await world.run(run.id);
    expect(stepBefore.steps.BG.status).toBe('failed');
    const items = (await world.items(run.id)).filter((item) => item.kind === 'decide_failed_check' && item.status === 'open');
    expect(items.map((item) => item.assignee).sort()).toEqual(['Erin Walsh', 'Luis Romero']);
    await world.decide(items[0].id, items[0].assignee, 'approved');
    await world.decide(items[1].id, items[1].assignee, 'rejected', 'Adverse');
    const after = await world.run(run.id);
    expect(after.status).toBe('stopped');
    expect(after.stoppedBy).toBe(items[1].assignee);
  });

  it('send back: when it comes back the check before it runs again', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2240', {}, {});
    const escalation = await world.itemFor(run.id, 'Owen Clarke', 'escalation');
    await world.decide(escalation.id, 'Owen Clarke', 'sent_back', 'Fix the duplicate');
    const back = await world.itemFor(run.id, 'Tom Reed', 'resubmit');
    // Post-build review, finding 1: a requester can't clear the check's flag themselves. This asserted the run went on after that resubmit; it now can't.
    expect(await world.service.resubmit(actor('Tom Reed'), back.id, { duplicate_found: false }).catch((error) => error.code)).toBe('FIELD_NOT_EDITABLE');
    await world.service.resubmit(actor('Tom Reed'), back.id, { project_code: 'P-1' });
    const again = await world.run(run.id);
    expect(again.steps.RA_CD.outcome).toBe('flag');
    expect((await world.itemFor(run.id, 'Owen Clarke', 'escalation')).status).toBe('open');
  });

  it('send back, and the flag is cleared where it is kept: the check’s answer changes and the run goes on', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2240', {}, {});
    const escalation = await world.itemFor(run.id, 'Owen Clarke', 'escalation');
    await world.decide(escalation.id, 'Owen Clarke', 'sent_back', 'Fix the duplicate');
    const back = await world.itemFor(run.id, 'Tom Reed', 'resubmit');
    await world.service.editRecord('work_order', 'WO-2240', { duplicate_found: false });
    const after = await world.run(run.id);
    expect((await world.store.workItems.get(back.id))?.status).toBe('cancelled');
    expect(after.steps.RA_CD.outcome).toBe('pass');
    expect(after.steps.RA_CDe.status).not.toBe('waiting');
    expect(after.steps.RA_A1.status).toBe('waiting');
    // The window that was open on the withdrawn step can't reject the run later.
    await world.advanceTo(hoursAfter(6 * 24));
    expect((await world.run(run.id)).status).toBe('running');
  });

  it('a check set to Reject goes back to the requester first, and is final when the window ends', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub-wo-uk-tech', (nodes, ctx) => createEditor(ctx).setFlag(nodes, 'RA_CD', 'reject') as typeof nodes);
    const run = await world.start('WO-2240');
    expect(run.status).toBe('running');
    expect(await world.itemFor(run.id, 'Tom Reed', 'resubmit')).toBeDefined();
    await world.advanceTo(hoursAfter(5 * 24));
    const after = await world.run(run.id);
    expect(after.status).toBe('rejected');
    expect(logHas(after.log, 'Rejected at “Duplicate & ghost worker”.')).toBe(true);
  });

  it('Needs information: the owner is asked, and the If decides when the value arrives', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231', {}, { rate_vs_card_pct: null });
    await world.decide((await world.itemFor(run.id, 'Raj Patel')).id, 'Raj Patel', 'approved');
    const item = await world.itemFor(run.id, 'Owen Clarke', 'needs_information');
    expect(item.what).toBe('Needs information: Rate vs rate card (%) is missing, so “Rate over card?” can’t decide. Procurement (Owen Clarke) has been asked to fill it in');
    await world.service.provideField(actor('Owen Clarke'), item.id, 'rate_vs_card_pct', 12);
    const after = await world.run(run.id);
    expect(after.steps.RA_C1.outcome).toBe('p1');
    expect(after.steps.RA_A2.status).toBe('waiting');
  });

  it('nobody approves their own request, even if an edit makes them the requester', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    const item = await world.itemFor(run.id, 'Raj Patel');
    await world.service.editRecord('work_order', 'WO-2231', { requester: 'Raj Patel' });
    const replanned = await world.run(run.id);
    expect(replanned.steps.RA_A1.assignees).not.toContain('Raj Patel');
    expect((await world.store.workItems.get(item.id))?.status).toBe('cancelled');
    expect(await world.decide(item.id, 'Raj Patel', 'approved')).toMatchObject({ ok: false, code: 'RUN_STOPPED' });
    expect((await world.run(run.id)).steps.RA_A1.status).toBe('waiting');
  });

  it('a Chaser copy never lands on the requester', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231', {}, { requester: 'Nadia Rahman' });
    await world.advanceTo(hoursAfter(48));
    const copies = (await world.items(run.id)).filter((item) => item.chaserOf);
    // Raj Patel's manager is the requester, so his copy goes one further up. Grace Kim, also asked, has Raj as her manager.
    expect(copies.map((item) => item.assignee).sort()).toEqual(['Raj Patel', 'Samira Khan']);
  });

  it('whoever answers the original or the Chaser copy first completes both', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    await world.advanceTo(hoursAfter(48));
    const copyItem = await world.itemFor(run.id, 'Nadia Rahman', 'escalation');
    expect(copyItem.stepName).toBe('Business sign-off: no answer from Raj Patel');
    await world.decide(copyItem.id, 'Nadia Rahman', 'approved');
    const original = (await world.items(run.id)).find((item) => item.assignee === 'Raj Patel');
    expect(original?.status).toBe('done');
    expect((await world.run(run.id)).status).toBe('completed');
  });

  it('an unconnected system fails with “Not connected” and goes to the fix task without retries', async () => {
    const world = await createWorld();
    const run = await world.start('INV-8812', {}, { invoice_matches: true });
    await world.tick();
    const nodes = await world.run(run.id);
    expect(nodes.steps.C1.outcome).toBe('p1');
    const mock = mockAdapters({ systems: { SYS: { Coupa: { st: 'off', seen: '', obj: [], back: [] } }, SYS_ACT: {} as never, SYS_KEY: {}, SYS_MAP: {} }, dws: {} as never, presets: { CHECKERS: {} } as never, now: START });
    await expect(mock.system('Coupa', { id: 'X' }).execute({ action: 'create', object: 'Invoice', fields: {}, match: { key: 'k', value: 'v' }, bringBack: [], idempotencyKey: 'x' })).resolves.toEqual({ status: 'failed', error: 'Not connected', retryable: false });
  });

  it('a stored conflict holds approvals until a proposal is chosen, then applies it and what is derived from it (D13)', async () => {
    const world = await createWorld();
    const conflict = { field: 'Bill rate', a: { by: 'Grace Kim', v: '$96/h', total: 150000 }, b: { by: 'Raj Patel', v: '$102/h', total: 159000 } };
    const run = await world.start('ASN-881', {}, { conflict, bill_rate: 83, prev: { total_value: 140000, months_engaged_after: 14, budget_left_after: 60000, changed_fields: [], bill_rate: 80 } });
    const held = await world.run(run.id);
    expect(held.steps.RA_A1.status).toBe('waiting');
    expect((await world.items(run.id)).filter((item) => item.kind === 'approve')).toEqual([]);
    await world.service.chooseProposal(actor('Owen Clarke'), run.id, 'a');
    const data = (await world.store.records.get('assignment', 'ASN-881'))?.data as Record<string, unknown>;
    expect(data).toMatchObject({ bill_rate: 96, total_value: 150000, rate_change_pct: 20, conflict: null });
    expect(logHas((await world.run(run.id)).log, 'Using $96/h from Grace Kim. Raj Patel has been told, and approval links for the other version no longer work.')).toBe(true);
    expect((await world.outbox({ runId: run.id })).some((message) => message.to === 'Raj Patel' && message.subject.startsWith('Your proposed change'))).toBe(true);
    expect((await world.items(run.id)).filter((item) => item.kind === 'approve' && item.status === 'open').length).toBeGreaterThan(0);
  });

  it('`at` is read as company time; dates take the worker’s zone', () => {
    const rec = { start_date: '2026-11-02', worker_tz: 'America/Toronto' };
    const zones = { worker: 'America/Toronto', company: 'Europe/London' };
    expect(resolveWaitUntil({ mode: 'at', at: '2026-07-01T14:30' }, rec, START, zones)).toBe('2026-07-01T13:30:00.000Z');
    expect(resolveWaitUntil({ mode: 'date', field: 'start_date', amount: 0, unit: 'days', dir: 'before', time: '09:00', tz: 'worker' }, rec, START, zones)).toBe('2026-11-02T14:00:00.000Z');
    expect(resolveWaitUntil({ mode: 'date', field: 'start_date', amount: 5, unit: 'business_days', dir: 'before', time: '09:00', tz: 'company' }, rec, START, zones)).toBe('2026-10-26T09:00:00.000Z');
    expect(resolveWaitUntil({ mode: 'date', field: 'start_date', time: '09:00', tz: 'worker' }, {}, START, zones)).toBeNull();
    expect(resolveWaitUntil({ mode: 'for', amount: 3, unit: 'business_days' }, rec, '2026-10-23T09:00:00Z', zones)).toBe('2026-10-28T09:00:00.000Z');
  });

  it('the Fieldglass mock reads queued events (05 §5.2)', async () => {
    const source = mockFieldglass([
      { at: '2026-10-20T08:00:00Z', recordType: 'work_order', recordId: 'A', event: 'approved', data: {} },
      { at: '2026-10-20T10:00:00Z', recordType: 'work_order', recordId: 'B', event: 'approved', data: {} },
    ]);
    expect((await source.poll(START)).map((event) => event.recordId)).toEqual(['B']);
    expect(recordOf('WO-2231').record).toBe('work_order');
  });

  it('the Fieldglass mock raises events once, however often it is polled', async () => {
    const world = await createWorld();
    const source = mockFieldglass([{ at: hoursAfter(1), recordType: 'work_order', recordId: 'FG-1', event: 'submitted', data: { ...recordOf('WO-2231'), id: 'FG-1' } }]);
    // No workflow starts from Fieldglass for a work order submitted in Levv, so it is an event with no workflow; what counts here is once.
    expect(await world.service.pollSource(source, START)).toBe(1);
    expect(await world.service.pollSource(source, START)).toBe(0);
    expect((await world.store.inbound.findByRecord('FG-1')).map((event) => event.source)).toEqual(['fieldglass']);
  });

  it('a group item never asks the requester, even when 03 §6.8 falls back to all its members', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', (nodes) => {
      Object.assign(nodes.RA_A1, { roles: ['g:fin_ctrl'], who: 'group', mode: 'all' });
    });
    const people = readRawSeed()['people-and-authority'] as { GROUPS: Record<string, { n: string; mode: string; members: string[] }> };
    await world.store.reference.replace('people-and-authority', { ...people, GROUPS: { ...people.GROUPS, fin_ctrl: { n: 'Finance controllers', mode: 'any', members: ['Grace Kim'] } } }, 'Samira Khan');
    const run = await world.start('WO-2231');
    expect(run.steps.RA_A1.status).toBe('waiting');
    expect((await world.items(run.id)).filter((item) => item.kind === 'approve')).toEqual([]);
    expect(run.status).toBe('running');
    expect(run.log.some((event) => event.m === 'Paused: Business sign-off')).toBe(true);
  });

  it('mode order asks one at a time; the second is not asked until the first answers', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231', {}, { total_value: 2000000 });
    await world.decide((await world.itemFor(run.id, 'Raj Patel')).id, 'Raj Patel', 'approved');
    const first = await world.itemFor(run.id, 'David Okafor', 'approve');
    expect((await world.items(run.id)).some((item) => item.assignee === 'Rebecca Stone')).toBe(false);
    await world.decide(first.id, 'David Okafor', 'approved');
    const second = await world.itemFor(run.id, 'Rebecca Stone', 'approve');
    expect((await world.run(run.id)).steps.RA_A4.status).toBe('waiting');
    await world.decide(second.id, 'Rebecca Stone', 'approved');
    expect((await world.run(run.id)).status).toBe('completed');
  });

  it('a group of “all” needs every member', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', (nodes) => {
      Object.assign(nodes.RA_A1, { roles: ['g:exco'], who: 'group', mode: 'all' });
    });
    const run = await world.start('WO-2231');
    const open = (await world.items(run.id)).filter((item) => item.kind === 'approve' && item.status === 'open');
    expect(open.length).toBeGreaterThan(1);
    for (const [index, item] of open.entries()) {
      expect((await world.run(run.id)).steps.RA_A1.status).toBe('waiting');
      expect((await world.decide(item.id, item.assignee, 'approved')).ok).toBe(true);
      if (index < open.length - 1) expect((await world.run(run.id)).steps.RA_A1.status).toBe('waiting');
    }
    expect((await world.run(run.id)).steps.RA_A1.status).toBe('done');
  });

  it('a rule task holds the round until it is done', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2214');
    const task = await world.itemFor(run.id, 'Mei Lin', 'task');
    expect(task.what).toBe('Record IR35 status');
    const approvals = (await world.items(run.id)).filter((item) => item.kind === 'approve' && item.status === 'open');
    for (const item of approvals) await world.decide(item.id, item.assignee, 'approved');
    expect((await world.run(run.id)).steps.RA_A1.status).toBe('waiting');
    await world.done(task.id, 'Mei Lin');
    expect((await world.run(run.id)).steps.RA_A1.status).toBe('done');
  });

  it('Not verified is a failure of the check; a “previous” rejection asks the step before it again', async () => {
    const world = await createWorld();
    const off = await world.start('OFF-902');
    const review = await world.itemFor(off.id, 'Tom Reed', 'collect_review');
    expect(await world.decide(review.id, 'Tom Reed', 'not_verified')).toMatchObject({ ok: false, code: 'COMMENT_REQUIRED', message: 'Add a comment to say what’s wrong.' });
    await world.decide(review.id, 'Tom Reed', 'not_verified', 'Hours are wrong');
    const after = await world.run(off.id);
    expect(after.steps.FT.outcome).toBe('fail');
    expect(await world.itemFor(off.id, 'Jordan Lee', 'escalation')).toBeDefined();

    const second = await createWorld();
    await second.publishEdited('wf-wo-sub', (nodes) => {
      (nodes.RA_A2 as { reject: string }).reject = 'previous';
    });
    const run = await second.start('WO-2231', {}, { rate_vs_card_pct: 15 });
    await second.decide((await second.itemFor(run.id, 'Raj Patel')).id, 'Raj Patel', 'approved');
    await second.decide((await second.itemFor(run.id, 'Owen Clarke')).id, 'Owen Clarke', 'rejected', 'Too dear');
    const back = await second.run(run.id);
    expect(back.steps.RA_A1.status).toBe('waiting');
    expect(back.steps.RA_A2.status).toBe('pending');
    expect((await second.itemFor(run.id, 'Raj Patel', 'approve')).status).toBe('open');
    expect(back.steps.RA_A1.decisions?.[0]).toMatchObject({ by: 'Raj Patel', decision: 'approved' });
  });

  it('onFail path takes the Failed exit after the retries; onFail task gives someone “Fix {system}”', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-offboard', (nodes) => {
      const rv = nodes.RV as { sys: { onFail: string }; outs: { key: string; to: string; label?: string }[] };
      rv.sys.onFail = 'path';
      rv.outs = [{ key: 'next', to: 'HC', label: 'Done' }, { key: 'failed', to: 'LC', label: 'Failed' }];
    });
    const run = await world.start('OFF-902', {}, { fail_system: 'Okta' });
    await world.done((await world.itemFor(run.id, 'Sam Patel')).id, 'Sam Patel');
    await world.decide((await world.itemFor(run.id, 'Tom Reed', 'collect_review')).id, 'Tom Reed', 'verified');
    await world.advanceTo('2026-10-23T16:00:00Z');
    await world.advanceTo('2026-10-23T18:00:00Z');
    const after = await world.run(run.id);
    expect(after.steps.RV.outcome).toBe('failed');
    expect(after.steps.RV.taken).toEqual(['failed']);
    expect(after.steps.HC.status).toBe('pending');

    const other = await createWorld();
    const second = await other.start('OFF-902', {}, { fail_system: 'Okta' });
    await other.done((await other.itemFor(second.id, 'Sam Patel')).id, 'Sam Patel');
    await other.decide((await other.itemFor(second.id, 'Tom Reed', 'collect_review')).id, 'Tom Reed', 'verified');
    await other.advanceTo('2026-10-23T16:00:00Z');
    await other.advanceTo('2026-10-23T18:00:00Z');
    const fix = await other.itemFor(second.id, 'Jordan Lee', 'task');
    expect(fix.what).toBe('Fix Okta: Okta is not responding');
    await other.done(fix.id, 'Jordan Lee');
    expect((await other.run(second.id)).steps.RV.status).toBe('done');
  });

  it('the ledger: onboarding writes, offboarding closes, and Stop closes nothing', async () => {
    const world = await createWorld();
    const onboarding = await world.start('WO-2214-A', {}, { personal_email: 'same.person@example.com' });
    expect((await world.ledger('same.person@example.com')).map((line) => line.gives)).toContain('Workday account');
    await world.stop(onboarding, { by: 'Samira Khan', reason: 'Cancelled' });
    expect((await world.ledger('same.person@example.com')).every((line) => line.status === 'open')).toBe(true);
    const off = await world.start('OFF-902', {}, { personal_email: 'same.person@example.com' });
    await world.done((await world.itemFor(off.id, 'Sam Patel')).id, 'Sam Patel');
    await world.decide((await world.itemFor(off.id, 'Tom Reed', 'collect_review')).id, 'Tom Reed', 'verified');
    await world.advanceTo('2026-10-23T16:00:00Z');
    const lines = await world.ledger('same.person@example.com');
    expect(lines.filter((line) => line.disp === 'remove').every((line) => line.status === 'closed')).toBe(true);
    expect(lines.filter((line) => line.disp === 'retain').every((line) => line.status === 'open')).toBe(true);
  });

  it('Run workflow raises an internal event, and its own selection rules apply', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-ts-sub', (nodes) => {
      nodes.NA = { id: 'NA', kind: 'runwf', label: 'Start the invoice', target: 'wf-invoice', outs: [{ key: 'next', to: 'END' }] } as (typeof nodes)[string];
    });
    const run = await world.start('TS-9934', {}, { states: ['active', 'ts_approved'] });
    expect((await world.run(run.id)).log.some((event) => event.m === 'Started “Invoice received”')).toBe(true);
    const started = await world.store.runs.list({ recordId: 'TS-9934' });
    expect(started.map((summary) => summary.workflowId).sort()).toEqual(['wf-invoice', 'wf-ts-sub']);
  });
});

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadSeed, readSeedFile } from '@flow-studio/data/seed-files';
import { computeMergeAt } from '@flow-studio/engine/edit';
import { ensureSys, ensureWait, title } from '@flow-studio/engine/text';
import {
  DEFAULT_TITLE,
  isGroup,
  limitOf,
  oooUntilIso,
  oooUntilText,
  type ApproveNode,
  type CollectNode,
  type CondNode,
  type DwNode,
  type EngineContext,
  type Row,
  type StepKind,
  type SystemNode,
  type TaskNode,
  type WaitNode,
  type WfNode,
  type Workflow,
} from '@flow-studio/model';
import {
  buildSeed,
  normalisePeople,
  normaliseWorkflow,
  SEED_DATA_FILES,
  type RawSeedFiles,
} from '@flow-studio/model/load';
import {
  parseSeedFile,
  SEED_FILE_SCHEMAS,
  SeedValidationError,
  type SeedFileName,
  type SeedPeople,
  type SeedWorkflow,
} from '@flow-studio/model/schemas';
import {
  FIXTURE_DIR,
  loadRuntimeRecords,
  loadTestActors,
  makeContext,
  norm,
  TEST_AS_OF,
  TEST_NOW,
  workflowById,
} from '../support/context';

const ALL_FILES = Object.keys(SEED_FILE_SCHEMAS) as SeedFileName[];

type Json = any;

const raw = (name: string): Json => readSeedFile(FIXTURE_DIR, name);
const rawSeedFiles = (): RawSeedFiles => Object.fromEntries(SEED_DATA_FILES.map((name) => [name, raw(name)])) as RawSeedFiles;
const rawWorkflow = (id: string): Json => raw('workflows').workflows.find((w: Json) => w.id === id);
const allNodes = (workflows: Pick<Workflow, 'draft'>[]) => workflows.flatMap((w) => Object.values(w.draft.nodes));
const isBoundary = (n: Pick<WfNode, 'kind'>) => n.kind === 'trigger' || n.kind === 'end';

let ctx: EngineContext;
const wf = (id: string) => workflowById(ctx, id);
const node = <T extends WfNode = WfNode>(workflowId: string, nodeId: string) => wf(workflowId).draft.nodes[nodeId] as T;

/** The minimal valid stored workflow, for cases the seed does not contain. */
const smallWorkflow = (nodes: Record<string, Json>, extra: Record<string, unknown> = {}): SeedWorkflow =>
  parseSeedFile('workflows', {
    workflows: [
      {
        id: 'wf-x',
        name: 'X',
        records: ['work_order'],
        event: 'submitted',
        scope: {},
        status: 'draft',
        version: 1,
        effective: '2026-09-01',
        owner: 'Procurement operations',
        priority: null,
        draft: {
          nodes: {
            T: { id: 'T', kind: 'trigger', label: '', outs: [{ key: 'next', to: Object.keys(nodes)[0] ?? 'END' }] },
            ...nodes,
            END: { id: 'END', kind: 'end', label: '', outcome: 'completed', outs: [] },
          },
        },
        published: null,
        ...extra,
      },
    ],
  }).workflows[0];

const normaliseSmall = (nodes: Record<string, Json>, extra?: Record<string, unknown>) =>
  normaliseWorkflow(smallWorkflow(nodes, extra), ctx.catalog, ctx.dws, ctx.systems);

const approve = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  kind: 'appr',
  label: id,
  roles: ['proc'],
  outs: [{ key: 'next', to: 'END' }],
  ...extra,
});

beforeEach(() => {
  ctx = makeContext();
});

describe('EN-126 · Structural counts of the seed', () => {
  it('EN-126 raw workflows.json: 15 workflows, 119 configured steps, 40 Approve steps; rules, groups, systems, records', () => {
    const workflows: Json[] = raw('workflows').workflows;
    expect(workflows).toHaveLength(15);
    expect(workflows.filter((w) => w.status === 'live')).toHaveLength(14);
    expect(workflows.filter((w) => w.status === 'draft').map((w) => w.name)).toEqual(['Data and AI hires']);

    const nodes: Json[] = allNodes(workflows);
    expect(nodes.filter((n) => !isBoundary(n))).toHaveLength(119);
    expect(nodes.filter((n) => n.kind === 'appr')).toHaveLength(40);

    expect(raw('approval-rules').approvalRules).toHaveLength(3);
    const groups = raw('people-and-authority').GROUPS;
    expect(Object.values(groups).map((g: Json) => g.n)).toEqual(['Finance controllers', 'Security review board', 'Executive committee']);
    const systems = raw('systems').SYS;
    expect(Object.keys(systems)).toHaveLength(8);
    expect(systems.Coupa.st).toBe('off');
    expect(raw('sample-records').samples).toHaveLength(29);
    expect(raw('history-records').history).toHaveLength(440);
  });

  it('EN-126 after load normalisation: 129 steps and 50 Approve steps', () => {
    const nodes = allNodes(ctx.workflows);
    expect(nodes.filter((n) => !isBoundary(n))).toHaveLength(129);
    expect(nodes.filter((n) => n.kind === 'appr')).toHaveLength(50);
  });

  it('EN-126 the 10 generated “{Step} failed: escalation” steps, one per Collect & verify with failTo "role"', () => {
    const generated = ctx.workflows.flatMap((w) =>
      Object.values(w.draft.nodes)
        .filter((n) => n.kind === 'appr' && n.failOf)
        .map((n) => `${w.id} ${(n as ApproveNode).failOf}`),
    );
    expect(generated.sort()).toEqual(
      [
        'wf-onboard ID',
        'wf-onboard LG',
        'wf-onboard VI',
        'wf-onboard LB',
        'wf-onboard RG',
        'wf-onboard PB',
        'wf-offboard FT',
        'wf-offboard XC',
        'wf-access ID',
        'wf-doc RN',
      ].sort(),
    );
    const collects = allNodes(ctx.workflows).filter((n) => n.kind === 'collect' && n.failTo === 'role');
    expect(collects).toHaveLength(10);
  });

  it('EN-126 every If has mergeAt', () => {
    const ifs = ctx.workflows.flatMap((w) => [
      ...Object.values(w.draft.nodes),
      ...Object.values(w.published?.nodes ?? {}),
    ]).filter((n): n is CondNode => n.kind === 'cond');
    expect(ifs.length).toBeGreaterThan(0);
    for (const cond of ifs) expect(cond.mergeAt, cond.id).toEqual(expect.any(String));
  });

  it('EN-126 “Data and AI hires” has version 0', () => {
    const draft = wf('wf-wo-sub-wo-data');
    expect(draft.name).toBe('Data and AI hires');
    expect(rawWorkflow('wf-wo-sub-wo-data').version).toBe(1);
    expect(draft.version).toBe(0);
    expect(draft.published).toBeNull();
  });

  it('EN-126 seeded workflows without onReject stay without it', () => {
    const without = ctx.workflows.filter((w) => !rawWorkflow(w.id).onReject);
    expect(without.map((w) => w.id).sort()).toEqual(['wf-doc', 'wf-invoice', 'wf-offboard', 'wf-onboard']);
    for (const workflow of without) expect('onReject' in workflow).toBe(false);
  });
});

describe('00 §8 numbers', () => {
  it('15 workflows, 14 live, 1 draft', () => {
    expect(ctx.workflows).toHaveLength(15);
    expect(ctx.workflows.filter((w) => w.status === 'live')).toHaveLength(14);
    expect(ctx.workflows.filter((w) => w.status === 'draft').map((w) => w.name)).toEqual(['Data and AI hires']);
  });

  it('3 approval rules: Client data access, UK off-payroll (IR35), Regulated roles', () => {
    expect(ctx.rules.map((r) => r.name)).toEqual(['Client data access', 'UK off-payroll (IR35)', 'Regulated roles']);
  });

  it('29 samples and 440 history records; 140 of them work order submitted', () => {
    expect(ctx.samples).toHaveLength(29);
    expect(ctx.history).toHaveLength(440);
    expect(ctx.history.filter((h) => h.record === 'work_order' && h.event === 'submitted')).toHaveLength(140);
  });

  it('the canvases hold 159 boxes, of which 50 are Approve steps', () => {
    const nodes = allNodes(ctx.workflows);
    expect(nodes).toHaveLength(159);
    expect(nodes.filter((n) => n.kind === 'appr')).toHaveLength(50);
  });
});

describe('seed files validate (02 §1, 06 §1.2)', () => {
  it('the fixtures are byte-identical copies of docs/flow-studio/seed', () => {
    const docs = join(FIXTURE_DIR, '..', '..', '..', 'docs', 'flow-studio', 'seed');
    const names = readdirSync(docs).sort();
    expect(readdirSync(FIXTURE_DIR).sort()).toEqual(names);
    expect(names).toEqual(ALL_FILES.map((f) => `${f}.json`).sort());
    for (const name of names) {
      expect(readFileSync(join(FIXTURE_DIR, name)).equals(readFileSync(join(docs, name))), name).toBe(true);
    }
  });

  it('loadSeed reads the nine data files; the two fixtures stay out', () => {
    expect(SEED_DATA_FILES).toHaveLength(9);
    expect(SEED_DATA_FILES).not.toContain('runtime-records');
    expect(SEED_DATA_FILES).not.toContain('test-actors');
  });

  it.each(ALL_FILES)('%s passes its Zod schema', (file) => {
    expect(() => parseSeedFile(file, raw(file))).not.toThrow();
  });

  it('parseSeedFile returns the data as stored, not Zod output, and shares nothing with its input', () => {
    const input = raw('workflows');
    const parsed = parseSeedFile('workflows', input);
    expect(JSON.stringify(parsed)).toBe(JSON.stringify(input));
    parsed.workflows[0].name = 'Changed';
    expect(input.workflows[0].name).not.toBe('Changed');
  });

  const firstWorkflow = () => {
    const file = raw('workflows');
    return { file, workflow: file.workflows.find((w: Json) => w.id === 'wf-wo-sub') };
  };

  it.each<[string, (w: Json, file: Json) => void]>([
    ['a removed step kind', (w) => { w.draft.nodes.RA_A1.kind = 'update'; }],
    ['an exit to a missing node', (w) => { w.draft.nodes.RA_A1.outs[0].to = 'NOPE'; }],
    ['a node stored under another id', (w) => { w.draft.nodes.RA_A1.id = 'OTHER'; }],
    ['a graph without END', (w) => { delete w.draft.nodes.END; }],
    ['a graph without T', (w) => { delete w.draft.nodes.T; }],
    ['an If with Otherwise not last', (w) => { w.draft.nodes.RA_C1.outs.reverse(); }],
    ['an If path with no conditions field', (w) => { delete w.draft.nodes.RA_C1.outs[0].rows; }],
    ['an unknown operator', (w) => { w.draft.nodes.RA_C1.outs[0].rows[0].op = '=='; }],
    ['the worker as an approver', (w) => { w.draft.nodes.RA_A1.roles = ['worker']; }],
    ['a renamed node field', (w) => { w.draft.nodes.RA_A1.approvers = w.draft.nodes.RA_A1.roles; delete w.draft.nodes.RA_A1.roles; }],
    ['a workflow on two records', (w) => { w.records = ['work_order', 'sow']; }],
    ['a live workflow that was never published', (w) => { w.published = null; }],
    ['a date in the wrong format', (w) => { w.effective = 'Sep 1'; }],
    ['an unknown scope dimension', (w) => { w.scope = { region: ['EU'] }; }],
    ['a deleted status', (w) => { w.status = 'deleted'; }],
  ])('rejects %s', (_name, change) => {
    const { file, workflow } = firstWorkflow();
    change(workflow, file);
    expect(() => parseSeedFile('workflows', file)).toThrow(SeedValidationError);
  });

  it('a failure names the file and where the problem is', () => {
    const { file, workflow } = firstWorkflow();
    workflow.draft.nodes.RA_A1.outs[0].to = 'NOPE';
    expect(() => parseSeedFile('workflows', file)).toThrow(/Seed file workflows is not valid:[\s\S]*draft\.nodes\.RA_A1\.outs: Exit next points at missing node NOPE/);
  });

  it.each<[SeedFileName, string, (f: Json) => void]>([
    ['approval-rules', 'an unknown rule position', (f) => { f.approvalRules[0].act.position = 'middle'; }],
    ['people-and-authority', 'a missing role table', (f) => { delete f.ROLES; }],
    ['people-and-authority', 'a role with no decision class', (f) => { delete f.ROLES.hm.c; }],
    ['people-and-authority', 'a limit given as text', (f) => { f.LIMIT['Tom Reed'] = '100000'; }],
    ['catalog', 'a record type with no events', (f) => { delete f.EVENTS_FOR.work_order; }],
    ['catalog', 'a field with an unknown type', (f) => { f.FIELDS[0].t = 'date'; }],
    ['digital-workers', 'a worker with an unknown state', (f) => { f.DW.budget.s = 'maybe'; }],
    ['onboarding-presets', 'a missing preset', (f) => { delete f.PRESETS.idrtw; }],
    ['systems', 'a system with an unknown state', (f) => { f.SYS.Coupa.st = 'maybe'; }],
    ['sample-records', 'a sample with no title', (f) => { delete f.samples[0].title; }],
    ['history-records', 'a record with an unknown event', (f) => { f.history[0].event = 'unknown'; }],
    ['runtime-records', 'a record with no states', (f) => { delete f.records[0].states; }],
    ['test-actors', 'an unknown permission', (f) => { f.actorSets.default.users[0].permissions = ['flow.delete']; }],
  ])('%s: rejects %s', (name, _what, change) => {
    const file = raw(name);
    change(file);
    expect(() => parseSeedFile(name, file)).toThrow(SeedValidationError);
  });
});

describe('seed contract across files', () => {
  const rowsOf = (rows: (Row | { rows: unknown[] })[]): Row[] => rows.flatMap((r) => (isGroup(r as Row) ? rowsOf((r as { rows: Row[] }).rows) : [r as Row]));
  const conditionRows = (w: Workflow): Row[] =>
    Object.values(w.draft.nodes).flatMap((n) => {
      if (n.kind === 'cond') return n.outs.flatMap((o) => ('rows' in o ? rowsOf(o.rows) : []));
      if (n.kind === 'appr' && n.when) return rowsOf(n.when.rows);
      return [];
    });

  it('every condition uses a catalog field and an operator allowed for its type', () => {
    const rows = [...ctx.workflows.flatMap(conditionRows), ...ctx.rules.flatMap((r) => rowsOf(r.when.rows))];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const field = ctx.catalog.FIELD[row.f];
      expect(field, row.f).toBeDefined();
      expect(ctx.catalog.OPS[field.t], `${row.f} ${row.op}`).toContain(row.op);
    }
  });

  it('every role a step names exists, and no approver is a role that may not approve', () => {
    const known = (key: string) => Boolean(ctx.people.ROLES[key]);
    for (const n of allNodes(ctx.workflows)) {
      if (n.kind === 'appr') {
        for (const role of n.roles) {
          expect(known(role), `${n.id} ${role}`).toBe(true);
          if (!n.failOf) expect(ctx.people.NOAPPR, `${n.id} ${role}`).not.toContain(role);
        }
      }
      if (n.kind === 'notify') n.recipients.forEach((role) => expect(known(role), `${n.id} ${role}`).toBe(true));
      if (n.kind === 'task') expect(known(n.role), n.id).toBe(true);
      if (n.kind === 'collect') {
        [n.reviewer, n.failRole, n.reverseBy, ...(n.failRoles ?? [])].forEach((role) => expect(known(role), `${n.id} ${role}`).toBe(true));
        expect([n.reviewer, n.failRole, ...(n.failRoles ?? [])]).not.toContain('worker');
      }
    }
  });

  it('every step points at a Digital Worker, system, checker, preset and workflow that exist', () => {
    const ids = new Set(ctx.workflows.map((w) => w.id));
    for (const n of allNodes(ctx.workflows)) {
      if (n.kind === 'dw') expect(ctx.dws.DW[n.worker], n.id).toBeDefined();
      if (n.kind === 'system') expect(ctx.systems.SYS[n.system], n.id).toBeDefined();
      if (n.kind === 'collect') expect(ctx.presets.CHECKERS[n.checker], n.id).toBeDefined();
      if ((n.kind === 'collect' || n.kind === 'system' || n.kind === 'task') && n.preset) {
        expect(ctx.presets.PRESETS[n.preset], n.id).toBeDefined();
      }
      if (n.kind === 'runwf') expect(ids.has(n.target), n.id).toBe(true);
    }
  });

  it('every workflow runs on an event its record type offers', () => {
    for (const w of ctx.workflows) expect(ctx.catalog.EVENTS_FOR[w.records[0]], w.id).toContain(w.event);
  });

  it('checks have Flagged then Passed exits; helpers have one', () => {
    for (const n of allNodes(ctx.workflows).filter((x): x is DwNode => x.kind === 'dw')) {
      const keys = n.outs.map((o) => o.key);
      expect(keys, n.id).toEqual(ctx.dws.CHECK_DW.includes(n.worker) ? ['flag', 'pass'] : ['next']);
    }
  });
});

describe('loading renames and reorders nothing (02 §15, §16)', () => {
  it('does not change the raw files it is given', () => {
    const files = rawSeedFiles();
    const before = JSON.stringify(files);
    buildSeed(files);
    expect(JSON.stringify(files)).toBe(before);
  });

  it('keeps samples and history exactly as stored, including key order (step 9)', () => {
    expect(JSON.stringify(ctx.samples)).toBe(JSON.stringify(raw('sample-records').samples));
    expect(JSON.stringify(ctx.history)).toBe(JSON.stringify(raw('history-records').history));
  });

  it('keeps the data quirks: null stays null, absent stays absent (02 §0, §11)', () => {
    const sample = (id: string) => ctx.samples.find((s) => s.id === id) as Json;
    expect(sample('WO-2280').rate_vs_card_pct).toBeNull();
    expect('rate_vs_card_pct' in sample('WO-2214-C')).toBe(false);
    expect('total_value' in sample('WO-2214-C')).toBe(false);
    expect(sample('AR-301').site).toBe('Toronto office');
    expect(ctx.samples.map((s) => s.id)).toEqual(expect.arrayContaining(['OB-2251', 'ASN-915']));
  });

  it('keeps reference data as stored, including legacy keys', () => {
    expect(JSON.stringify(ctx.rules)).toBe(JSON.stringify(raw('approval-rules').approvalRules));
    expect(JSON.stringify(ctx.dws)).toBe(JSON.stringify(raw('digital-workers')));
    expect(JSON.stringify(ctx.presets)).toBe(JSON.stringify(raw('onboarding-presets')));
    expect(JSON.stringify(ctx.systems)).toBe(JSON.stringify(raw('systems')));
    const catalog = ctx.catalog as Json;
    for (const key of ['APPROVES', 'ELSE_OPTS', 'HOURS', 'APPROVAL_EVENTS', 'HOLDABLE']) expect(catalog[key], key).toBeDefined();
    expect(catalog.K.update).toBe('Update record');
    expect(ctx.rules[0]).toMatchObject({ tab: 'approvals', kind: 'rule', scope: {} });
  });

  it('keeps node key order: stored order, then generated steps', () => {
    const stored = Object.keys(rawWorkflow('wf-onboard').draft.nodes);
    const loaded = Object.keys(wf('wf-onboard').draft.nodes);
    expect(loaded.slice(0, stored.length)).toEqual(stored);
    expect(loaded.slice(stored.length).sort()).toEqual(['ID_fail', 'LB_fail', 'LG_fail', 'PB_fail', 'RG_fail', 'VI_fail'].sort());
  });

  it('keeps scope key order (03 §1.4 prints it that way)', () => {
    expect(Object.keys(wf('wf-wo-sub-wo-uk-tech').scope)).toEqual(['country', 'business_unit']);
  });

  it('keeps legacy node and workflow fields (load but ignore)', () => {
    expect(wf('wf-wo-sub')).toMatchObject({ tab: 'workflows', kind: 'main' });
    expect(node('wf-wo-sub', 'RA_CDe')).toMatchObject({ prechecks: ['brief'] });
    expect(node('wf-wo-sub', 'RA_CD')).toMatchObject({ threshold: 80 });
    expect(node('wf-onboard', 'ID')).toMatchObject({ strength: 'hard', failFlow: 'adverse' });
    expect(node('wf-onboard', 'W1')).toMatchObject({ until: 'Start date' });
  });

  it('only fills: every stored node field keeps its value, except flagCont and the Collect & verify exits', () => {
    for (const stored of raw('workflows').workflows as Json[]) {
      const loaded = wf(stored.id);
      for (const [section, nodes] of [['draft', loaded.draft.nodes], ['published', loaded.published?.nodes ?? {}]] as const) {
        for (const [id, rawNode] of Object.entries<Json>(stored[section]?.nodes ?? {})) {
          const expected = { ...rawNode };
          delete expected.flagCont;
          if (rawNode.kind === 'collect' && rawNode.failTo === 'role') delete expected.outs;
          expect((nodes as Json)[id], `${stored.id} ${section} ${id}`).toMatchObject(expected);
        }
      }
    }
  });

  it('adds no workflow other than the seed ones and keeps file order', () => {
    expect(ctx.workflows.map((w) => w.id)).toEqual(raw('workflows').workflows.map((w: Json) => w.id));
  });

  it('a seeded live workflow is not dirty after loading (02 §4)', () => {
    for (const w of ctx.workflows.filter((x) => x.published)) {
      const draft = { nodes: w.draft.nodes, scope: w.scope, name: w.name };
      const { nodes, scope, name } = w.published as NonNullable<Workflow['published']>;
      expect(JSON.stringify(draft), w.id).toBe(JSON.stringify({ nodes, scope, name }));
    }
  });
});

describe('02 §15 step 1: catalog index', () => {
  it('FIELD indexes all 32 FIELDS by id', () => {
    expect(Object.keys(ctx.catalog.FIELD)).toHaveLength(32);
    expect(ctx.catalog.FIELD.rate_vs_card_pct).toEqual({ id: 'rate_vs_card_pct', l: 'Rate vs rate card (%)', g: 'Levv-calculated', t: 'pct', owner: 'proc' });
    expect(ctx.catalog.FIELD.data_access.risk).toBe(true);
  });
});

describe('02 §15 step 2: pseudo roles', () => {
  it('every approval group has its g: role', () => {
    expect(ctx.people.ROLES['g:fin_ctrl']).toEqual({ n: 'Finance controllers', c: 3, grp: true });
    expect(ctx.people.ROLES['g:sec_board']).toEqual({ n: 'Security review board', c: 3, grp: true });
    expect(ctx.people.ROLES['g:exco']).toEqual({ n: 'Executive committee', c: 3, grp: true });
  });

  it('creates a missing g: role from GROUPS', () => {
    const people: SeedPeople = parseSeedFile('people-and-authority', raw('people-and-authority'));
    delete people.ROLES['g:exco'];
    expect(normalisePeople(people, []).ROLES['g:exco']).toEqual({ n: 'Executive committee', c: 3, grp: true });
  });

  it('the seed references no named person, so no p: role exists', () => {
    expect(Object.keys(ctx.people.ROLES).filter((k) => k.startsWith('p:'))).toEqual([]);
  });

  it('creates a p: role for each place a named person can be referenced', () => {
    const workflow = smallWorkflow({
      A: approve('A', { roles: ['p:Chloe Martin'] }),
      C: {
        id: 'C',
        kind: 'cond',
        label: 'C',
        elseWho: 'p:Else Person',
        outs: [
          { key: 'p1', to: 'D', label: 'Yes', join: 'all', rows: [], who: 'p:Path Person' },
          { key: 'else', to: 'D', label: 'No' },
        ],
      },
      D: { id: 'D', kind: 'dw', label: 'D', worker: 'dup', flagWho: 'p:Flag Person', outs: [{ key: 'flag', to: 'N', label: 'Flagged' }, { key: 'pass', to: 'N', label: 'Passed' }] },
      N: { id: 'N', kind: 'notify', label: 'N', recipients: ['p:Told Person'], channel: 'Email', outs: [{ key: 'next', to: 'END' }] },
    });
    const { ROLES } = normalisePeople(parseSeedFile('people-and-authority', raw('people-and-authority')), [workflow]);
    expect(ROLES['p:Chloe Martin']).toEqual({ n: 'Chloe Martin', c: 3, person: true });
    for (const name of ['Else Person', 'Path Person', 'Flag Person', 'Told Person']) {
      expect(ROLES[`p:${name}`], name).toEqual({ n: name, c: 3, person: true });
    }
  });
});

describe('02 §15 step 3: limits', () => {
  it('null becomes Infinity', () => {
    const unlimited = Object.keys(raw('people-and-authority').LIMIT).filter((p) => raw('people-and-authority').LIMIT[p] === null);
    expect(unlimited).toHaveLength(1);
    expect(ctx.people.LIMIT[unlimited[0]]).toBe(Infinity);
  });

  it('a person in PEOPLE missing from LIMIT has limit 0; stored limits are unchanged', () => {
    expect(raw('people-and-authority').LIMIT['Owen Clarke']).toBeUndefined();
    expect(ctx.people.LIMIT['Owen Clarke']).toBe(0);
    for (const [person, limit] of Object.entries<number | null>(raw('people-and-authority').LIMIT)) {
      if (limit !== null) expect(ctx.people.LIMIT[person], person).toBe(limit);
    }
    for (const person of ctx.people.PEOPLE) expect(typeof ctx.people.LIMIT[person], person).toBe('number');
  });

  it('limitOf treats anyone unknown as 0', () => {
    expect(limitOf(ctx.people, 'Coordinator')).toBe(0);
    expect(limitOf(ctx.people, 'Tom Reed')).toBe(ctx.people.LIMIT['Tom Reed']);
  });
});

describe('02 §15 step 4: out of office', () => {
  it('converts "Mon D" to ISO in 2026 and keeps the delegate', () => {
    expect(ctx.people.OOO['Hannah Brooks']).toEqual({ until: '2026-10-24', to: 'Luis Romero' });
    expect(ctx.people.OOO['Kenji Watanabe']).toEqual({ until: '2026-10-30', to: 'Mia Chen' });
  });

  it('the display string for messages comes back unchanged', () => {
    expect(oooUntilText(ctx.people.OOO['Hannah Brooks'].until)).toBe('Oct 24');
    expect(oooUntilText(ctx.people.OOO['Kenji Watanabe'].until)).toBe('Oct 30');
    expect(oooUntilText(oooUntilIso('Nov 3'))).toBe('Nov 3');
  });

  it('leaves ISO dates alone and refuses anything else', () => {
    expect(oooUntilIso('2026-10-24')).toBe('2026-10-24');
    expect(oooUntilIso('Nov 3')).toBe('2026-11-03');
    expect(() => oooUntilIso('Octember 40')).toThrow();
    expect(() => oooUntilIso('Foo 4')).toThrow();
  });
});

describe('02 §15 step 5: workflow defaults', () => {
  it('source defaults to levv and keeps a stored one', () => {
    expect(rawWorkflow('wf-doc').source).toBeUndefined();
    expect(wf('wf-doc').source).toBe('levv');
    expect(wf('wf-access').source).toBe('zip');
  });

  it('basis defaults to total and keeps a stored one', () => {
    expect(rawWorkflow('wf-wo-sub').basis).toBeUndefined();
    expect(wf('wf-wo-sub').basis).toBe('total');
    expect(wf('wf-sow-co').basis).toBe('running');
  });

  it('days is set only where the event uses it', () => {
    expect(wf('wf-ending').days).toBe(30);
    expect(wf('wf-doc').days).toBe(30);
    expect(wf('wf-offboard').days).toBe(14);
    expect('days' in wf('wf-wo-sub')).toBe(false);
    expect(normaliseSmall({}, { event: 'off_start', records: ['offboarding'] }).days).toBe(14);
    expect(normaliseSmall({}, { event: 'end_30', records: ['assignment'], days: 45 }).days).toBe(45);
  });

  it('onReject gets resubmitDays only where it exists, and keeps its recipients', () => {
    expect(wf('wf-ending').onReject).toEqual({ recipients: ['hm', 'supplier_am'], resubmitDays: 5 });
    expect(normaliseSmall({}, { onReject: { recipients: ['hm'], resubmitDays: 9 } }).onReject?.resubmitDays).toBe(9);
  });

  it('never-published drafts are version 0; published workflows keep their version', () => {
    expect(wf('wf-wo-sub-wo-data').version).toBe(0);
    expect(wf('wf-wo-sub-wo-uk-tech').version).toBe(3);
    expect(wf('wf-wo-sub').version).toBe(1);
  });
});

describe('02 §15 step 6: versions', () => {
  it('builds one version per published workflow from its snapshot', () => {
    const w = wf('wf-wo-sub-wo-uk-tech');
    expect(w.versions).toEqual([
      { version: 3, nodes: w.published?.nodes, scope: { country: ['UK'], business_unit: ['Technology'] }, name: 'UK Technology work orders', effective: '2026-09-01' },
    ]);
  });

  it('a draft has no versions', () => {
    expect('versions' in wf('wf-wo-sub-wo-data')).toBe(false);
  });

  it('a version is a separate copy, so editing the workflow cannot change a pinned version', () => {
    const w = wf('wf-wo-sub');
    (w.published as NonNullable<Workflow['published']>).nodes.RA_A1.label = 'Edited';
    w.draft.nodes.RA_A1.label = 'Edited';
    expect(w.versions?.[0].nodes.RA_A1.label).toBe('Business sign-off');
  });

  it('versions and published hold normalised nodes: a run pinned to one can take the Failed exit', () => {
    const w = wf('wf-onboard');
    expect(w.published?.nodes.ID_fail).toBeDefined();
    expect(w.versions?.[0].nodes.ID_fail).toEqual(w.draft.nodes.ID_fail);
  });
});

describe('02 §15 step 7: node defaults', () => {
  it('Approve: fills the Chaser and keeps every stored value', () => {
    const a = node<ApproveNode>('wf-wo-sub', 'RA_A1');
    expect(rawWorkflow('wf-wo-sub').draft.nodes.RA_A1.remind).toBeUndefined();
    expect(a).toMatchObject({ who: 'roles', remind: 24, sla: 48, mode: 'all', material: ['total_value', 'end_date', 'cost_center'], reaskOnDecrease: true, reject: 'requester', authority: false });
    const filled = normaliseSmall({ A: approve('A') }).draft.nodes.A;
    expect(filled).toMatchObject({ who: 'roles', remind: 24, sla: 48, mode: 'all', material: [], reaskOnDecrease: true, reject: 'requester', authority: false });
    const kept = normaliseSmall({ A: approve('A', { remind: 6, sla: 12, mode: 'order', material: ['scope'], reaskOnDecrease: false, reject: 'end', authority: true, who: 'roles' }) }).draft.nodes.A;
    expect(kept).toMatchObject({ remind: 6, sla: 12, mode: 'order', material: ['scope'], reaskOnDecrease: false, reject: 'end', authority: true });
  });

  it('Approve: who is derived from the roles', () => {
    const { draft } = normaliseSmall({
      A: approve('A', { roles: ['g:fin_ctrl'], outs: [{ key: 'next', to: 'B' }] }),
      B: approve('B', { roles: ['p:Chloe Martin'], outs: [{ key: 'next', to: 'C' }] }),
      C: approve('C', { roles: [] }),
    });
    expect((draft.nodes.A as ApproveNode).who).toBe('group');
    expect((draft.nodes.B as ApproveNode).who).toBe('person');
    expect((draft.nodes.C as ApproveNode).who).toBe('roles');
  });

  it('seeded escalation steps get remind 24 and keep sla 48', () => {
    expect(rawWorkflow('wf-wo-sub').draft.nodes.RA_CDe.remind).toBeUndefined();
    expect(node('wf-wo-sub', 'RA_CDe')).toMatchObject({ escalation: true, remind: 24, sla: 48 });
  });

  it('Chaser defaults: Approve 24/48, Task and Collect & verify 48/96 (00 F4)', () => {
    expect(node('wf-wo-sub', 'RA_A1')).toMatchObject({ remind: 24, sla: 48 });
    expect(node<TaskNode>('wf-ending', 'K1')).toMatchObject({ remind: 48, sla: 96 });
    expect(node<CollectNode>('wf-onboard', 'BG')).toMatchObject({ remind: 48, sla: 96 });
    expect(node<CollectNode>('wf-access', 'ID')).toMatchObject({ remind: 48, sla: 96 });
  });

  it('Collect & verify: from defaults to worker; a stored provider stays', () => {
    const collect = (extra: Record<string, unknown>) => ({
      id: 'C', kind: 'collect', label: 'C', items: [], verify: 'person', checker: 'persona', reviewer: 'people_ops',
      failTo: 'approval', failRole: 'people_ops', gives: '', reverse: '', reverseWhen: 'after', reverseBy: 'hm',
      outs: [{ key: 'next', to: 'END' }], ...extra,
    });
    expect(normaliseSmall({ C: collect({}) }).draft.nodes.C).toMatchObject({ from: 'worker', failMode: 'all', failRoles: ['hrbp'] });
    expect(normaliseSmall({ C: collect({ from: 'hm', failMode: 'any', failRoles: ['legal'] }) }).draft.nodes.C).toMatchObject({ from: 'hm', failMode: 'any', failRoles: ['legal'] });
    expect(normaliseSmall({ C: collect({ failTo: 'role' }) }).draft.nodes.C).not.toHaveProperty('failRoles');
    expect(node<CollectNode>('wf-onboard', 'VI').from).toBe('supplier_am');
  });

  it('Collect & verify with failTo "approval" gets no Failed exit and no generated step', () => {
    const bg = node<CollectNode>('wf-onboard', 'BG');
    expect(bg.failTo).toBe('approval');
    expect(bg.outs).toEqual(rawWorkflow('wf-onboard').draft.nodes.BG.outs);
    expect(bg.failNode).toBeUndefined();
    expect(wf('wf-onboard').draft.nodes.BG_fail).toBeUndefined();
  });

  /* The roles and rejoin targets are the ones 04 Appendix A states for each box. */
  it.each([
    ['wf-onboard', 'VI', 'Vendor insurance failed: escalation', 'people_ops', 'END'],
    ['wf-onboard', 'LB', 'Laptop and badge failed: escalation', 'people_ops', 'END'],
    ['wf-onboard', 'LG', 'Legal & compliance failed: escalation', 'people_ops', 'C1'],
    ['wf-onboard', 'ID', 'Identity & eligibility failed: escalation', 'people_ops', 'BG'],
    ['wf-onboard', 'RG', 'Registration verified failed: escalation', 'people_ops', 'SA'],
    ['wf-onboard', 'PB', 'Payroll & banking failed: escalation', 'people_ops', 'END'],
    ['wf-offboard', 'FT', 'Final timesheet & expenses failed: escalation', 'people_ops', 'M1'],
    ['wf-offboard', 'XC', 'Exit confirmations failed: escalation', 'people_ops', 'M1'],
    ['wf-access', 'ID', 'Identity & site details failed: escalation', 'sec', 'BG'],
    ['wf-doc', 'RN', 'Renewed document failed: escalation', 'hrbp', 'END'],
  ])('%s %s: generates “%s” for %s, rejoining %s', (workflowId, collectId, label, role, rejoins) => {
    const id = `${collectId}_fail`;
    const collect = node<CollectNode>(workflowId, collectId);
    expect(collect.failNode).toBe(id);
    expect(collect.outs).toEqual([
      { key: 'next', to: rejoins, label: 'Done' },
      { key: 'fail', to: id, label: 'Failed' },
    ]);
    expect(node(workflowId, id)).toEqual({
      id,
      kind: 'appr',
      label,
      roles: [role],
      who: 'roles',
      mode: 'all',
      authority: false,
      material: [],
      reaskOnDecrease: true,
      reject: 'requester',
      remind: 24,
      sla: 48,
      escalation: true,
      failOf: collectId,
      outs: [{ key: 'next', to: rejoins }],
    });
    expect(wf(workflowId).published?.nodes[id]).toEqual(node(workflowId, id));
  });

  it('a stored failNode is left alone', () => {
    const { draft } = normaliseSmall({
      C: {
        id: 'C', kind: 'collect', label: 'C', items: [], verify: 'person', checker: 'persona', reviewer: 'people_ops',
        failTo: 'role', failRole: 'people_ops', failNode: 'C_fail', gives: '', reverse: '', reverseWhen: 'after', reverseBy: 'hm',
        outs: [{ key: 'next', to: 'END' }, { key: 'fail', to: 'C_fail', label: 'Failed' }],
      },
      C_fail: approve('C_fail', { escalation: true, failOf: 'C', roles: ['people_ops'], sla: 72 }),
    });
    expect((draft.nodes.C_fail as ApproveNode).sla).toBe(72);
    expect((draft.nodes.C as CollectNode).outs).toHaveLength(2);
  });

  it('Digital Worker checks: flagDo defaults to note; helpers get none', () => {
    const check = (id: string, extra: Record<string, unknown> = {}) => ({
      id, kind: 'dw', label: id, worker: 'budget', outs: [{ key: 'flag', to: 'END', label: 'Flagged' }, { key: 'pass', to: 'END', label: 'Passed' }], ...extra,
    });
    expect(normaliseSmall({ D: check('D') }).draft.nodes.D).toMatchObject({ flagDo: 'note', flagCont: 'END' });
    expect(normaliseSmall({ D: check('D', { flagDo: 'reject' }) }).draft.nodes.D).toMatchObject({ flagDo: 'reject' });
    const helper = node<DwNode>('wf-invoice', 'DI');
    expect(helper.worker).toBe('invoice');
    expect(helper.flagDo).toBeUndefined();
    expect('flagCont' in helper).toBe(false);
  });

  it('flagCont is recomputed from the Passed exit: wf-access CD was stale at "AP"', () => {
    expect(rawWorkflow('wf-access').draft.nodes.CD.flagCont).toBe('AP');
    expect(node('wf-access', 'CD')).toMatchObject({ flagCont: 'AP_A1' });
    expect(node('wf-wo-sub', 'RA_CD')).toMatchObject({ flagCont: 'RA_A1' });
  });

  it('System: a stored sys is kept; a missing or mismatched one is built with ensureSys', () => {
    const rv = node<SystemNode>('wf-offboard', 'RV');
    expect(rv.sys).toEqual(rawWorkflow('wf-offboard').draft.nodes.RV.sys);
    const step = (extra: Record<string, unknown>) => ({
      id: 'S', kind: 'system', label: 'Provision', system: 'Workday', via: '', gives: '', reverse: '', reverseWhen: 'after', reverseBy: 'it',
      outs: [{ key: 'next', to: 'END' }], ...extra,
    });
    const built = normaliseSmall({ S: step({}) }).draft.nodes.S as SystemNode;
    expect(built.sys).toEqual(ensureSys({ label: 'Provision', system: 'Workday' }, ctx.systems));
    expect(built.sys.system).toBe('Workday');
    const stale = { ...rv.sys, system: 'Okta' };
    const rebuilt = normaliseSmall({ S: step({ sys: stale }) }).draft.nodes.S as SystemNode;
    expect(rebuilt.sys.system).toBe('Workday');
  });

  it('Wait: a stored w is kept; a missing one is built from until', () => {
    expect(node<WaitNode>('wf-onboard', 'W1').w).toEqual(rawWorkflow('wf-onboard').draft.nodes.W1.w);
    const wait = { id: 'W', kind: 'wait', label: 'W', until: 'End date', outs: [{ key: 'next', to: 'END' }] };
    expect((normaliseSmall({ W: wait }).draft.nodes.W as WaitNode).w).toEqual({ mode: 'date', field: 'end_date', amount: 0, unit: 'days', dir: 'before', time: '17:00', tz: 'worker' });
  });

  it('If: onMissing defaults to ask and a stored one stays', () => {
    expect(node('wf-wo-sub', 'RA_C1')).toMatchObject({ onMissing: 'ask' });
    const cond = (extra: Record<string, unknown>) => ({
      id: 'C', kind: 'cond', label: 'C', outs: [{ key: 'p1', to: 'END', label: 'Yes', join: 'all', rows: [] }, { key: 'else', to: 'END', label: 'No' }], ...extra,
    });
    expect(normaliseSmall({ C: cond({ onMissing: 'cautious' }) }).draft.nodes.C).toMatchObject({ onMissing: 'cautious' });
  });

  it('removed hours fields move to the generated step and disappear (02 §16, 00 F5)', () => {
    const { draft } = normaliseSmall({
      C: {
        id: 'C', kind: 'cond', label: 'C', elseSla: 12, elseDo: 'escalate', elseNode: 'E2',
        outs: [
          { key: 'p1', to: 'E1', label: 'Yes', join: 'all', rows: [], do: 'escalate', node: 'E1', sla: 24 },
          { key: 'else', to: 'E2', label: 'No' },
        ],
      },
      E1: approve('E1', { escalation: true, sla: 48, outs: [{ key: 'next', to: 'D' }] }),
      E2: approve('E2', { escalation: true, sla: 48, outs: [{ key: 'next', to: 'D' }] }),
      D: { id: 'D', kind: 'dw', label: 'D', worker: 'dup', flagDo: 'escalate', flagNode: 'E3', flagSla: 36, outs: [{ key: 'flag', to: 'E3', label: 'Flagged' }, { key: 'pass', to: 'END', label: 'Passed' }] },
      E3: approve('E3', { escalation: true, sla: 48 }),
    });
    expect((draft.nodes.E1 as ApproveNode).sla).toBe(24);
    expect((draft.nodes.E2 as ApproveNode).sla).toBe(12);
    expect((draft.nodes.E3 as ApproveNode).sla).toBe(36);
    expect(draft.nodes.C).not.toHaveProperty('elseSla');
    expect((draft.nodes.C as CondNode).outs[0]).not.toHaveProperty('sla');
    expect(draft.nodes.D).not.toHaveProperty('flagSla');
  });
});

describe('02 §15 step 7: mergeAt on every seeded If (03 §16.2)', () => {
  /* Where each If's paths meet, read from the canvases in 04 Appendix A. wf-wo-sub RA_C1 → RA_C2 is also in 06 EN-044. */
  it.each([
    ['wf-onboard', 'C1', 'SA'],
    ['wf-ending', 'C1', 'END'],
    ['wf-ending', 'RA_C1', 'RA_PL'],
    ['wf-ending', 'RA_C2', 'RA_C3'],
    ['wf-ending', 'RA_C3', 'RA_POL'],
    ['wf-asn-chg', 'RA_C1', 'RA_PL'],
    ['wf-asn-chg', 'RA_C2', 'RA_C3'],
    ['wf-asn-chg', 'RA_C3', 'RA_POL'],
    ['wf-invoice', 'C1', 'END'],
    ['wf-wo-sub', 'RA_C1', 'RA_C2'],
    ['wf-wo-sub', 'RA_C2', 'RW'],
    ['wf-wo-sub-wo-uk-tech', 'RA_C1', 'RA_C2'],
    ['wf-wo-sub-wo-uk-tech', 'RA_C2', 'RW'],
    ['wf-jp', 'RA_C1', 'NA'],
    ['wf-sow-sub', 'RA_C1', 'RA_C2'],
    ['wf-sow-sub', 'RA_C2', 'NA'],
    ['wf-sow-co', 'RA_C1', 'RA_C2'],
    ['wf-sow-co', 'RA_C2', 'NA'],
    ['wf-ts-sub', 'RA_C1', 'NA'],
    ['wf-wo-chg', 'RA_C1', 'RA_C2'],
    ['wf-wo-chg', 'RA_C2', 'NA'],
  ])('%s %s meets at %s', (workflowId, condId, mergeAt) => {
    expect(node<CondNode>(workflowId, condId).mergeAt).toBe(mergeAt);
  });

  it('that table covers all 21 seeded Ifs', () => {
    expect(allNodes(ctx.workflows).filter((n) => n.kind === 'cond')).toHaveLength(21);
  });
});

describe('02 §15 step 8: no garbage collection on load', () => {
  it('keeps an unreachable node', () => {
    const { draft } = normaliseSmall({ A: approve('A'), Lonely: approve('Lonely') });
    expect(draft.nodes.Lonely).toBeDefined();
  });

  it('every generated step is reachable from T', () => {
    for (const w of ctx.workflows) {
      const seen = new Set<string>(['T']);
      const queue = ['T'];
      while (queue.length) {
        for (const out of w.draft.nodes[queue.shift() as string].outs) {
          if (!seen.has(out.to)) {
            seen.add(out.to);
            queue.push(out.to);
          }
        }
      }
      for (const n of Object.values(w.draft.nodes)) {
        if (n.kind === 'appr' && n.failOf) expect(seen.has(n.id), `${w.id} ${n.id}`).toBe(true);
      }
    }
  });
});

describe('normalising again changes nothing', () => {
  it('workflows', () => {
    for (const w of ctx.workflows) {
      const again = normaliseWorkflow(w as unknown as SeedWorkflow, ctx.catalog, ctx.dws, ctx.systems);
      expect(JSON.stringify(again), w.id).toBe(JSON.stringify(w));
    }
  });

  it('people', () => {
    const again = normalisePeople(ctx.people, ctx.workflows as unknown as SeedWorkflow[]);
    expect(again.OOO).toEqual(ctx.people.OOO);
    expect(again.LIMIT).toEqual(ctx.people.LIMIT);
    expect(again.ROLES).toEqual(ctx.people.ROLES);
  });
});

describe('computeMergeAt (03 §16.2)', () => {
  const graph = (cond: Json, rest: Record<string, Json> = {}) =>
    smallWorkflow({ C: { id: 'C', kind: 'cond', label: 'C', ...cond }, ...rest }).draft.nodes as Record<string, WfNode>;
  const path = (to: string, extra: Record<string, unknown> = {}) => ({ key: 'p1', to, label: 'Yes', join: 'all', rows: [], ...extra });
  const rejected = { R: { id: 'R', kind: 'end', label: 'Rejected', outcome: 'rejected', outs: [] } };

  it('no carrying-on path gives END', () => {
    const nodes = graph({ outs: [path('R'), { key: 'else', to: 'R', label: 'No' }] }, rejected);
    expect(computeMergeAt(nodes, 'C')).toBe('END');
  });

  it('one carrying-on path gives its target', () => {
    const nodes = graph({ outs: [path('R'), { key: 'else', to: 'A', label: 'No' }] }, { ...rejected, A: approve('A') });
    expect(computeMergeAt(nodes, 'C')).toBe('A');
  });

  it('a stored reject or stop is not carrying on, even if its target is not an End', () => {
    const nodes = graph({ outs: [path('A', { do: 'reject' }), { key: 'else', to: 'B', label: 'No' }] }, { A: approve('A'), B: approve('B') });
    expect(computeMergeAt(nodes, 'C')).toBe('B');
    const elseStops = graph({ elseDo: 'stop', outs: [path('A'), { key: 'else', to: 'B', label: 'No' }] }, { A: approve('A'), B: approve('B') });
    expect(computeMergeAt(elseStops, 'C')).toBe('A');
  });

  it('a path to its generated step starts from that step’s next', () => {
    const nodes = graph(
      { outs: [path('G', { do: 'escalate', node: 'G' }), { key: 'else', to: 'A', label: 'No' }] },
      { G: approve('G', { outs: [{ key: 'next', to: 'A' }] }), A: approve('A') },
    );
    expect(computeMergeAt(nodes, 'C')).toBe('A');
  });

  it('several paths meet at the common node nearest the If, not at a later one', () => {
    const nodes = graph(
      { outs: [path('A'), { key: 'else', to: 'B', label: 'No' }] },
      { A: approve('A', { outs: [{ key: 'next', to: 'M' }] }), B: approve('B', { outs: [{ key: 'next', to: 'M' }] }), M: approve('M', { outs: [{ key: 'next', to: 'Z' }] }), Z: approve('Z') },
    );
    expect(computeMergeAt(nodes, 'C')).toBe('M');
  });

  it('a path that goes straight to the merge step makes it the answer', () => {
    const nodes = graph(
      { outs: [path('A'), { key: 'else', to: 'M', label: 'No' }] },
      { A: approve('A', { outs: [{ key: 'next', to: 'M' }] }), M: approve('M') },
    );
    expect(computeMergeAt(nodes, 'C')).toBe('M');
  });

  it('paths with nothing in common give the last start', () => {
    const nodes = graph(
      { outs: [path('R1'), { key: 'else', to: 'R2', label: 'No' }] },
      {
        R1: { id: 'R1', kind: 'end', label: '', outcome: 'completed', outs: [] },
        R2: { id: 'R2', kind: 'end', label: '', outcome: 'completed', outs: [] },
      },
    );
    expect(computeMergeAt(nodes, 'C')).toBe('R2');
  });
});

describe('load-time helpers', () => {
  it.each<[string | undefined, Record<string, unknown>]>([
    ['Start date', { mode: 'date', field: 'start_date', amount: 0, unit: 'days', dir: 'before', time: '09:00', tz: 'worker' }],
    ['Start date minus 5 days', { mode: 'date', field: 'start_date', amount: 5, unit: 'days', dir: 'before', time: '09:00', tz: 'worker' }],
    ['Start date plus 2 days', { mode: 'date', field: 'start_date', amount: 2, unit: 'days', dir: 'after', time: '09:00', tz: 'worker' }],
    ['End date', { mode: 'date', field: 'end_date', amount: 0, unit: 'days', dir: 'before', time: '17:00', tz: 'worker' }],
    ['The last day', { mode: 'date', field: 'end_date', amount: 0, unit: 'days', dir: 'before', time: '17:00', tz: 'worker' }],
    ['Two days', { mode: 'for', amount: 2, unit: 'days' }],
    [undefined, { mode: 'for', amount: 2, unit: 'days' }],
  ])('ensureWait(%s) (03 §1.8)', (until, expected) => {
    expect(ensureWait(until)).toEqual(expected);
  });

  it('ensureSys follows the legacy actions (03 §1.10)', () => {
    const build = (actions: string[] | undefined, label = 'Step', system = 'Workday') => ensureSys({ label, system, actions }, ctx.systems);
    expect(build(undefined).action).toBe('create');
    expect(build(['push']).action).toBe('create');
    expect(build(['push'], 'Remove access').action).toBe('close');
    expect(build(['push'], 'Deactivate the user').action).toBe('close');
    expect(build(['reconcile']).action).toBe('check');
    expect(build(['reconcile']).check).toBe(true);
    expect(build(['push', 'reconcile']).action).toBe('create');
    expect(build(['pull']).action).toBe('read');
    expect(build(['pull']).read).toEqual([ctx.systems.SYS.Workday.back[0]]);
    expect(build([]).action).toBe('create');
  });

  it('ensureSys fills the same defaults as a new System step (02 §5.14) and copies the field map', () => {
    const sys = ensureSys({ label: 'System step', system: 'Workday' }, ctx.systems);
    expect(sys).toEqual({
      system: 'Workday',
      action: 'create',
      object: 'Contingent worker',
      match: 'Work email',
      map: ctx.systems.SYS_MAP['Contingent worker'],
      read: [],
      wait: 'confirm',
      waitH: 24,
      state: 'Completed',
      onFail: 'task',
      failRole: 'people_ops',
      retries: 3,
      check: false,
    });
    expect(sys.map).not.toBe(ctx.systems.SYS_MAP['Contingent worker']);
    expect(sys.map[0]).not.toBe(ctx.systems.SYS_MAP['Contingent worker'][0]);
  });

  it('ensureSys keeps a previous object the system offers, and falls back for an unknown system', () => {
    expect(ensureSys({ label: 'S', system: 'Workday', sys: { object: 'Not offered' } }, ctx.systems).object).toBe(ctx.systems.SYS.Workday.obj[0]);
    const other = ctx.systems.SYS.Workday.obj[1];
    expect(ensureSys({ label: 'S', system: 'Workday', sys: { object: other } }, ctx.systems).object).toBe(other);
    const unknown = ensureSys({ label: 'S', system: 'Nowhere' }, ctx.systems);
    expect(unknown).toMatchObject({ system: 'Nowhere', object: ctx.systems.SYS.Workday.obj[0], match: 'Work email' });
  });

  it('title falls back to the default for the kind (02 §2, 03 §1.2)', () => {
    expect(title({ kind: 'appr', label: '' })).toBe('Approval');
    expect(title({ kind: 'appr', label: 'Business sign-off' })).toBe('Business sign-off');
    const kinds = Object.keys(DEFAULT_TITLE) as StepKind[];
    expect(kinds).toHaveLength(14);
    expect(DEFAULT_TITLE).toMatchObject({ trigger: 'Trigger', cond: 'Condition', plan: 'Within plan', policy: 'Policy approve', collect: 'Collect & verify', system: 'System' });
  });

  it('isGroup tells a group from a row (02 §3)', () => {
    expect(isGroup({ join: 'any', rows: [] })).toBe(true);
    expect(isGroup({ f: 'total_value', op: '>=', v: 1 })).toBe(false);
  });
});

describe('test context factory (06 §1.2)', () => {
  it('builds the canonical EngineContext with the fixed date and clock', () => {
    expect(ctx.asOf).toBe(TEST_AS_OF);
    expect(ctx.asOf).toBe('2026-10-20');
    expect(ctx.now).toBe(TEST_NOW);
    expect(ctx.now).toBe('2026-10-20T09:00:00Z');
    expect(ctx.approverAvailability).toEqual({ othersCanApprove: true });
    expect(Object.keys(ctx).sort()).toEqual(
      ['approverAvailability', 'asOf', 'catalog', 'dws', 'history', 'idGen', 'now', 'people', 'presets', 'rules', 'samples', 'systems', 'workflows'].sort(),
    );
  });

  it('takes the overrides the tests need', () => {
    expect(makeContext({ approverAvailability: { othersCanApprove: false } }).approverAvailability.othersCanApprove).toBe(false);
    expect(makeContext({ asOf: '2026-10-25' }).asOf).toBe('2026-10-25');
  });

  it('no test can see another test’s changes', () => {
    const first = makeContext();
    first.workflows[0].name = 'Changed';
    first.people.LIMIT['Tom Reed'] = -1;
    first.samples.length = 0;
    first.catalog.FIELD.total_value.l = 'Changed';
    first.people.ROLES.hm.n = 'Changed';
    const second = makeContext();
    expect(second.workflows[0].name).toBe('Contractor onboarding');
    expect(second.people.LIMIT['Tom Reed']).not.toBe(-1);
    expect(second.samples).toHaveLength(29);
    expect(second.catalog.FIELD.total_value.l).toBe('Total value');
    expect(second.people.ROLES.hm.n).toBe('Hiring manager');
  });

  it('cloning keeps Infinity limits', () => {
    const unlimited = Object.values(ctx.people.LIMIT).filter((v) => v === Infinity);
    expect(unlimited).toHaveLength(1);
  });

  it('each context has its own id generator, starting at 101', () => {
    const first = makeContext();
    expect(first.idGen.next('workflow')).toBe('nf101');
    expect(first.idGen.next('node')).toBe('n102');
    expect(first.idGen.next('node')).toBe('n103');
    expect(makeContext().idGen.next('workflow')).toBe('nf101');
  });

  it('the id generator shares one counter and reserves ids (03 §16.0)', () => {
    const gen = ctx.idGen;
    gen.reserve(['RA_A1', 'p1', 'b3', 'n5', 'T', 'END', 'wf-wo-sub']);
    expect(gen.next('node')).toBe('n101');
    gen.reserve(['n102', 'n103']);
    expect(gen.next('path')).toBe('p104');
    expect(gen.next('branch')).toBe('b105');
    gen.reserve(['nf200']);
    expect(gen.next('workflow')).toBe('nf201');
    gen.reserve(new Set(['p150']));
    expect(gen.next('node')).toBe('n202');
  });

  it('the default seed directory holds the same data as the fixtures', () => {
    expect(loadSeed()).toEqual(loadSeed(FIXTURE_DIR));
  });

  it('reads the two fixtures loadSeed leaves out', () => {
    const actors = loadTestActors();
    expect(actors.actorSets.default.users.map((u) => u.name)).toContain('Flow Admin');
    expect(actors.actorSets['author-only-approver'].users.filter((u) => u.name !== 'Flow Admin' && u.permissions.some((p) => p === 'flow.approve_changes' || p === 'admin'))).toEqual([]);
    const records = loadRuntimeRecords().records;
    expect(records).toHaveLength(11);
    expect(records.find((r) => r.id === 'AR-301')?.source).toBe('zip');
  });

  it('norm is the only string tolerance (06 §1.3)', () => {
    expect(norm('It isn’t “here” ‘now’')).toBe('It isn\'t "here" \'now\'');
    expect(norm('Case Stays')).toBe('Case Stays');
  });
});

import { computeMergeAt, ensureCollectEscalation } from '../engine/edit';
import { ensureSys, ensureWait } from '../engine/text';
import type { Catalog } from './catalog';
import type { DigitalWorkers, Presets, Systems } from './helpers';
import { ensurePseudoRole, oooUntilIso, type PeopleAuthority, type RoleKey } from './people';
import type { HistoryRecord, SampleRecord } from './records';
import type { ApprovalRule } from './rules';
import {
  parseSeedFile,
  type SeedCatalog,
  type SeedFileContents,
  type SeedFileName,
  type SeedNode,
  type SeedPeople,
  type SeedWorkflow,
} from './schemas';
import type { ApproveNode, CollectNode, CondNode, DwNode, Out, SystemNode, WaitNode, WfNode, Workflow } from './workflow';

/** The nine data files loadSeed reads (06 §1.2). runtime-records and test-actors are fixtures tests read directly. */
export const SEED_DATA_FILES = [
  'workflows',
  'approval-rules',
  'people-and-authority',
  'catalog',
  'digital-workers',
  'onboarding-presets',
  'systems',
  'sample-records',
  'history-records',
] as const satisfies readonly SeedFileName[];

export type SeedDataFileName = (typeof SEED_DATA_FILES)[number];
export type RawSeedFiles = Record<SeedDataFileName, unknown>;

/** The validated, normalised seed: everything in EngineContext except the time and id values. */
export interface SeedData {
  catalog: Catalog;
  people: PeopleAuthority;
  rules: ApprovalRule[];
  dws: DigitalWorkers;
  presets: Presets;
  systems: Systems;
  workflows: Workflow[];
  samples: SampleRecord[];
  history: HistoryRecord[];
}

/** 02 §15 step 1. */
export function normaliseCatalog(catalog: SeedCatalog): Catalog {
  const FIELD = Object.fromEntries(catalog.FIELDS.map((field) => [field.id, field]));
  return { ...catalog, FIELD };
}

/** Every role key a node refers to. */
function roleRefs(node: SeedNode): RoleKey[] {
  const fields = node as unknown as Record<string, unknown>;
  const refs: unknown[] = [
    fields.roles, fields.recipients, fields.failRoles,
    fields.flagWho, fields.elseWho, fields.fyi, fields.role, fields.reviewer, fields.failRole, fields.reverseBy, fields.fallback,
    (fields.sys as { failRole?: RoleKey } | undefined)?.failRole,
    node.outs.map((out) => (out as Out & { who?: RoleKey }).who),
  ];
  return refs.flat().filter((ref): ref is RoleKey => typeof ref === 'string');
}

/** 02 §15 steps 2–4. Takes the workflows because named-person roles are created from their references. */
export function normalisePeople(seed: SeedPeople, workflows: SeedWorkflow[]): PeopleAuthority {
  const LIMIT: PeopleAuthority['LIMIT'] = {};
  for (const person of seed.PEOPLE) LIMIT[person] = 0;
  for (const [person, limit] of Object.entries(seed.LIMIT)) LIMIT[person] = limit ?? Infinity;

  const OOO: PeopleAuthority['OOO'] = {};
  for (const [person, away] of Object.entries(seed.OOO)) OOO[person] = { ...away, until: oooUntilIso(away.until) };

  const ROLES = { ...seed.ROLES };
  for (const [key, group] of Object.entries(seed.GROUPS)) {
    ROLES[`g:${key}`] ??= { n: group.n, c: 3, grp: true };
  }
  const people: PeopleAuthority = { ...seed, ROLES, LIMIT, OOO };
  for (const workflow of workflows) {
    const graphs = workflow.published ? [workflow.draft, workflow.published] : [workflow.draft];
    for (const graph of graphs) {
      for (const node of Object.values(graph.nodes)) {
        for (const ref of roleRefs(node)) ensurePseudoRole(people, ref);
      }
    }
  }
  return people;
}

/** Removed hours fields (02 §16): the generated escalation's `sla` is the only timer. */
function moveLegacySla(nodes: Record<string, WfNode>, owner: Record<string, unknown>, field: string, target: string | null | undefined) {
  if (!(field in owner)) return;
  const generated = target ? nodes[target] : undefined;
  if (generated?.kind === 'appr') generated.sla = owner[field] as number;
  delete owner[field];
}

/** 02 §15 step 7. Changes `nodes` in place. */
function normaliseNodes(nodes: Record<string, WfNode>, dws: DigitalWorkers, systems: Systems): void {
  for (const node of Object.values(nodes)) {
    switch (node.kind) {
      case 'appr':
        fillApprove(node);
        break;
      case 'collect':
        fillCollect(nodes, node);
        break;
      case 'task':
        node.remind ??= 48;
        node.sla ??= 96;
        break;
      case 'dw':
        if (dws.CHECK_DW.includes(node.worker)) {
          node.flagDo ??= 'note';
          const pass = node.outs.find((out) => out.key === 'pass');
          if (pass) (node as DwNode & { flagCont?: string }).flagCont = pass.to;
        }
        moveLegacySla(nodes, node as unknown as Record<string, unknown>, 'flagSla', node.flagNode);
        break;
      case 'system':
        fillSystem(node, systems);
        break;
      case 'wait':
        fillWait(node);
        break;
      case 'cond':
        node.onMissing ??= 'ask';
        moveLegacySla(nodes, node as unknown as Record<string, unknown>, 'elseSla', node.elseNode);
        for (const out of node.outs as (Out & { node?: string | null })[]) {
          moveLegacySla(nodes, out as unknown as Record<string, unknown>, 'sla', out.node);
        }
        break;
      default:
        break;
    }
  }
  for (const node of Object.values(nodes)) {
    if (node.kind === 'cond') (node as CondNode).mergeAt ??= computeMergeAt(nodes, node.id);
  }
}

function fillApprove(node: ApproveNode): void {
  node.who ??= node.roles.some((role) => role.startsWith('g:'))
    ? 'group'
    : node.roles.some((role) => role.startsWith('p:'))
      ? 'person'
      : 'roles';
  node.remind ??= 24;
  node.sla ??= 48;
  node.mode ??= 'all';
  node.material ??= [];
  node.reaskOnDecrease ??= true;
  node.reject ??= 'requester';
  node.authority ??= false;
}

function fillCollect(nodes: Record<string, WfNode>, node: CollectNode): void {
  node.from ??= 'worker';
  node.remind ??= 48;
  node.sla ??= 96;
  if (node.failTo === 'approval') {
    node.failMode ??= 'all';
    node.failRoles ??= ['hrbp'];
  }
  if (node.failTo === 'role' && !node.failNode) ensureCollectEscalation(nodes, node.id);
}

function fillSystem(node: SystemNode, systems: Systems): void {
  const stored = node as SystemNode & { actions?: string[] };
  if (!stored.sys || stored.sys.system !== stored.system) stored.sys = ensureSys(stored, systems);
}

function fillWait(node: WaitNode): void {
  const stored = node as WaitNode & { until?: string };
  stored.w ??= ensureWait(stored.until);
}

/** 02 §15 steps 5–7 for one workflow. Does not change its input. */
export function normaliseWorkflow(seed: SeedWorkflow, catalog: Pick<Catalog, 'DAY_EVENTS'>, dws: DigitalWorkers, systems: Systems): Workflow {
  const workflow = structuredClone(seed) as Workflow;

  workflow.source ??= 'levv';
  workflow.basis ??= 'total';
  if (workflow.event === 'off_start') workflow.days ??= 14;
  else if (catalog.DAY_EVENTS.includes(workflow.event)) workflow.days ??= 30;
  if (workflow.onReject) workflow.onReject.resubmitDays ??= 5;

  normaliseNodes(workflow.draft.nodes, dws, systems);
  if (workflow.published === null) {
    workflow.version = 0;
  } else {
    normaliseNodes(workflow.published.nodes, dws, systems);
    workflow.versions ??= [
      {
        version: workflow.version,
        nodes: structuredClone(workflow.published.nodes),
        scope: structuredClone(workflow.published.scope),
        name: workflow.published.name,
        effective: workflow.effective,
      },
    ];
  }
  return workflow;
}

/** Validates every data file, applies 02 §15 in order and returns new objects. Pure: no file system, no clock. */
export function buildSeed(raw: RawSeedFiles): SeedData {
  const file = <N extends SeedDataFileName>(name: N): SeedFileContents[N] => parseSeedFile(name, raw[name]);

  const catalog = normaliseCatalog(file('catalog'));
  const dws = file('digital-workers');
  const systems = file('systems');
  const seedWorkflows = file('workflows').workflows;

  return {
    catalog,
    people: normalisePeople(file('people-and-authority'), seedWorkflows),
    rules: file('approval-rules').approvalRules,
    dws,
    presets: file('onboarding-presets'),
    systems,
    workflows: seedWorkflows.map((workflow) => normaliseWorkflow(workflow, catalog, dws, systems)),
    samples: file('sample-records').samples,
    history: file('history-records').history,
  };
}

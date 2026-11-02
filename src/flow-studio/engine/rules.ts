import type { EngineContext } from '../model/context';
import type { RoleKey } from '../model/people';
import type { Stage, StageItem } from '../model/results';
import type { ApprovalRule } from '../model/rules';
import type { WfNode } from '../model/workflow';
import { evalCondition, type Rec } from './conditions';
import { copy } from './copy';
import { conditionText } from './text';

/** Engine §7.1. Rule events stay as seeded: "Client data access" does not match a SOW `created` (D2, a data note). */
export function rulesMatching(rec0: Rec, ctx: Pick<EngineContext, 'rules'>): ApprovalRule[] {
  return ctx.rules.filter(
    (rule) =>
      rule.status === 'live' &&
      rule.records.includes(rec0.record as ApprovalRule['records'][number]) &&
      rule.event === rec0.event &&
      evalCondition(rule.when, rec0),
  );
}

export function blankItem(roles: RoleKey[], nodeId: string | null, why: string | null): StageItem {
  return { roles, any: roles.length > 1, nodeId, why, people: [], paused: false, notes: [], cls: 1, checks: [], stageIndex: 0 };
}

function ruleItems(rule: ApprovalRule, prevRoles: Set<RoleKey>, ctx: Pick<EngineContext, 'catalog'>): StageItem[] {
  if (!rule.act.approve) return [];
  const roles = rule.act.roles.filter((role) => !prevRoles.has(role));
  const why = copy.companyWideRule(conditionText(rule.when, ctx.catalog));
  const make = (keys: RoleKey[]): StageItem => ({ ...blankItem(keys, null, why), ruleId: rule.id });
  if (rule.act.mode === 'any' && roles.length >= 2) return [make(roles)];
  return roles.map((role) => make([role]));
}

const onlyEscalations = (stage: Stage, nodes: Record<string, WfNode>): boolean =>
  stage.items.length > 0 &&
  stage.items.every((item) => {
    const node = item.nodeId ? nodes[item.nodeId] : undefined;
    return node?.kind === 'appr' && node.escalation === true;
  });

/** Engine §7.2: adds each matching rule's approvers and task into the rounds, and returns the flags. */
export function addRuleItems(
  rules: ApprovalRule[],
  stages: Stage[],
  prevRoles: Set<RoleKey>,
  nodes: Record<string, WfNode>,
  ctx: Pick<EngineContext, 'catalog'>,
): { field: string; ruleId: string }[] {
  const flags: { field: string; ruleId: string }[] = [];
  for (const rule of rules) {
    const items = ruleItems(rule, prevRoles, ctx);
    const tasks = rule.act.task ? [{ ruleId: rule.id, title: rule.act.taskTitle || copy.taskFallback, role: rule.act.taskRole, person: '' }] : [];
    if (rule.act.flag) flags.push({ field: rule.act.flagField, ruleId: rule.id });
    if (items.length === 0 && tasks.length === 0) continue;

    if (rule.act.position === 'first') {
      stages.unshift({ label: rule.name, items, tasks });
    } else if (rule.act.position === 'last' || stages.length === 0) {
      stages.push({ label: rule.name, items, tasks });
    } else {
      const joined = stages.find((stage) => !onlyEscalations(stage, nodes)) ?? stages[0];
      joined.items.push(...items);
      joined.tasks.push(...tasks);
      joined.label += ` + ${rule.name}`;
    }
  }
  return flags;
}

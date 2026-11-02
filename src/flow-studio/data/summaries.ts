import { copy } from '../engine/copy';
import { scopeText } from '../engine/text';
import type { Catalog } from '../model/catalog';
import type { WorkflowSummary } from '../model/runtime';
import type { Workflow } from '../model/workflow';

const isCatchAll = (workflow: Workflow): boolean => Object.values(workflow.scope).every((values) => !values || values.length === 0);

/** 04 §3.1: record order, then event order, then the catch-all with its variations under it in file order. */
export function workflowSummaries(workflows: Workflow[], catalog: Pick<Catalog, 'RECORDS' | 'EVENTS_FOR'>): WorkflowSummary[] {
  const recordOrder = Object.keys(catalog.RECORDS);
  const rank = (list: string[], value: string): number => {
    const index = list.indexOf(value);
    return index === -1 ? list.length : index;
  };
  const groups = new Map<string, Workflow[]>();
  for (const workflow of workflows) {
    const key = `${workflow.records[0]}|${workflow.event}`;
    groups.set(key, [...(groups.get(key) ?? []), workflow]);
  }
  const ordered = Array.from(groups.values()).sort((a, b) => {
    const [x, y] = [a[0], b[0]];
    const records = rank(recordOrder, x.records[0]) - rank(recordOrder, y.records[0]);
    if (records !== 0) return records;
    const events = catalog.EVENTS_FOR[x.records[0]] ?? [];
    return rank(events, x.event) - rank(events, y.event);
  });

  const summaries: WorkflowSummary[] = [];
  for (const group of ordered) {
    const catchAll = group.find(isCatchAll);
    const rows = catchAll ? [catchAll, ...group.filter((workflow) => workflow !== catchAll)] : group;
    for (const workflow of rows) {
      const summary: WorkflowSummary = {
        id: workflow.id,
        name: workflow.name,
        recordType: workflow.records[0],
        event: workflow.event,
        status: workflow.status,
        version: workflow.version,
        scopeSummary: `${workflow.status === 'inactive' ? copy.pickerInactivePrefix : ''}${scopeText(workflow.scope)}`,
      };
      if (catchAll && workflow !== catchAll && !isCatchAll(workflow)) summary.isVariationOf = catchAll.id;
      summaries.push(summary);
    }
  }
  return summaries;
}

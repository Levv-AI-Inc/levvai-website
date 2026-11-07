import { checkResult } from '../engine/checks';
import type { Rec } from '../engine/conditions';
import type { EngineContext } from '../model/context';
import type { DwNode } from '../model/workflow';

/** What a flagged check said, for the reason a rejection carries (05 §3.4.2). */
export const conditionsOutcome = (node: DwNode, rec: Rec, ctx: Pick<EngineContext, 'dws'>): string => checkResult(node.worker, rec, ctx).m;

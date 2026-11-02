import type { FlowStore } from '../data/repos';
import { createIdGen } from '../engine/ids';
import { othersCanApprove } from '../engine/publish';
import type { EngineContext } from '../model/context';
import type { Clock } from './clock';

/** 02 §0.1, built per request from the store. `othersCanApprove` is computed for the caller as the author (03 §13.1 item 7). */
export async function buildEngineContext(store: FlowStore, clock: Clock, author: { id?: string; name: string }): Promise<EngineContext> {
  const [workflows, samples, history, users] = await Promise.all([
    store.workflows.all(),
    store.records.samples(),
    store.records.history(),
    store.actingUsers(),
  ]);
  const reference = await store.reference.bundleFor(workflows);
  const idGen = createIdGen(101);
  idGen.reserve(workflows.map((workflow) => workflow.id));
  return {
    ...reference,
    workflows,
    samples,
    history,
    asOf: clock.asOf(),
    now: clock.now(),
    idGen,
    approverAvailability: { othersCanApprove: othersCanApprove(author, users) },
  };
}

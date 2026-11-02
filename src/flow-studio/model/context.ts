import type { Catalog } from './catalog';
import type { DigitalWorkers, Presets, Systems } from './helpers';
import type { PeopleAuthority } from './people';
import type { HistoryRecord, SampleRecord } from './records';
import type { ApprovalRule } from './rules';
import type { Workflow } from './workflow';

/** Deterministic id generator (engine §16.0). Implementation: engine/ids.ts createIdGen. */
export interface IdGen {
  next(kind: 'workflow' | 'node' | 'path' | 'branch'): string; // 'nf{n}' | 'n{n}' | 'p{n}' | 'b{n}', then n += 1
  reserve(ids: Iterable<string>): void;  // raises the counter above the number in any id matching /^(nf|n|p|b)(\d+)$/
}

/** Everything the engine reads. Built from the seeds (§15) and passed to every engine function. Only data and strings: no functions except idGen's methods. */
export interface EngineContext {
  catalog: Catalog;                 // §2 (+ FIELD index, §15 step 1)
  people: PeopleAuthority;          // §7
  rules: ApprovalRule[];            // §6 (only status 'live' ones are applied)
  dws: DigitalWorkers;              // §8
  presets: Presets;                 // §9
  systems: Systems;                 // §10
  workflows: Workflow[];            // §4 (all statuses)
  samples: SampleRecord[];          // §11 ("Try a record")
  history: HistoryRecord[];         // §11 (last 90 days)
  asOf: string;                     // YYYY-MM-DD: "today" (absences, "Goes live on" default, new-workflow date). Tests: '2026-10-20'.
  now: string;                      // ISO date-time: timers, submittedAt, run times. Tests: '2026-10-20T09:00:00Z'.
  idGen: IdGen;                     // deterministic id generator (engine §16.0). Tests: createIdGen(101) per context.
  approverAvailability: { othersCanApprove: boolean };
                                    // server-computed for the current author: does any other user hold flow.approve_changes
                                    // (or admin)? (engine §13.1 item 7). Tests: true, false with actor set 'author-only-approver'.
}

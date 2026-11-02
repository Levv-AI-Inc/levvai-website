import type { EventKey, RecordKey } from './catalog';
import type { Condition } from './condition';
import type { RoleKey } from './people';

/** A company-wide rule. Applies to EVERY workflow whose record+event matches, when `when` is true. */
export interface ApprovalRule {
  id: string;                 // "ao-data" | "ao-ir35" | "ao-reg"
  name: string;               // "Client data access" | "UK off-payroll (IR35)" | "Regulated roles"
  records: RecordKey[];       // e.g. ["work_order","sow"]
  event: EventKey;            // e.g. "submitted". NOTE: seed rules use 'submitted'; SOWs now start on 'created' (see engine §7.1).
  when: Condition;            // e.g. {join:'any', rows:[{f:'data_access',op:'yes'},{f:'digital_worker_access',op:'yes'}]}
  status: 'live' | 'draft' | 'inactive'; // only 'live' rules apply
  version: number;            // display only
  effective: string;          // ISO date (display only in Flow Studio)
  owner: string;              // e.g. "Information Security"
  act: RuleAction;
  published?: unknown;        // snapshot kept by the admin area; Flow Studio ignores it
  // Legacy, ignore: tab ("approvals"), kind ("rule"), scope ({}).
}

export interface RuleAction {
  approve: boolean;           // add approvers
  roles: RoleKey[];           // approvers to add (when approve)
  mode: 'all' | 'any';        // all = each role separately; any = one "any one of" item
  position: 'first' | 'with' | 'last';
  /* where the approvers go: first = a new round before every other round; with = into the first approval round on the
     path that is not only escalations (all seed rules); last = a new round after every other round. */
  task: boolean;              // add a task
  taskRole: RoleKey;          // who does the task (seed 'tax')
  taskTitle: string;          // e.g. "Record IR35 status"
  flag: boolean;              // mark the request
  flagField: string;          // bool FieldDef.id to set to yes, e.g. "registration_required"
}

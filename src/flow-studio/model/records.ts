import type { EventKey, RecordKey } from './catalog';
import type { RoleKey } from './people';

export interface RecordData {
  id: string;                 // "WO-2214", "H-WO-17"
  record: RecordKey;          // record type
  event: EventKey;            // event that happened
  requester: string;          // who raised it (a PEOPLE name, or "Coordinator" = someone with no role)
  hiring_manager?: string;    // the hiring manager named on the record. Overrides ORG hm/hm_mgr resolution
                              // and produces "<hm> is the hiring manager on the record (raised by <requester>)".
  sponsor?: string;           // access requests: the employee who asked for the person
  sponsor_delegate?: string;  // shown as "Sponsor (Grace Kim, or their delegate Raj Patel)"
  worker_name?: string;       // the person it is about ("Worker (Jordan Ellis)"); absent → "the worker"
  cost_centers?: string[];    // split funding: BUSINESS UNIT keys of ORG (prototype), e.g. ["Finance","Marketing"].
                              // With 2+ entries every cost-center-owner approval is asked once per entry.
  prev?: Partial<RecordData>; // change events: the previous approved version's values (only the fields that differ are required)
  original_total?: number;    // SOW change orders: the original SOW value (running-total basis)
  /** Simulation-only (samples): */
  title?: string;             // shown under "Try a record" (strip " (approved)")
  note?: string;              // author's note (not shown)
  conflict?: { field: string; a: Proposal; b: Proposal }; // two pending proposals for one field (ASN-920)
  edit?: { label: string; set: Partial<RecordData>; decreased: string[] }; // "Try an edit: <label>" (ASN-881)
  decided?: RoleKey[];        // roles that had already approved before the edit (ASN-881: ["cco","hrbp"])
  outcomes?: Record<string, 'fail' | 'unsure' | 'done'>;  // simulated step outcomes keyed by node id
  outcomesL?: Record<string, 'fail' | 'unsure' | 'done'>; // the same keyed by step label (checked when the id has none)
  // FIELDS values (see §2), e.g. total_value, country, business_unit, rate_vs_card_pct (null = blank → Needs information), …
  [field: string]: unknown;
  // Legacy, ignore: other_assignments, reason.
}
export interface Proposal { by: string; v: string; total: number } // v = display value ("$96/h"); total = resulting total_value
export type SampleRecord = RecordData & { title: string };
export type HistoryRecord = RecordData;

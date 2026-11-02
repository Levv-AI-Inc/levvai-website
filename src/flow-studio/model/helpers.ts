import type { RoleKey } from './people';
import type { SysAction } from './workflow';

export interface DigitalWorker {
  id: string;                 // 'budget','rate','dup','tenure' (checks); 'intake','invoice','docs','access','startguard','sweeper',
                              // 'recovery','closer' (helpers); 'brief','chaser','timesheet','offboard','milestone','distribution' (legacy)
  n: string;                  // name, e.g. "Duplicate & ghost worker", "Access provisioner"
  s: 'ready' | 'setup' | 'off'; // ready = usable; setup = "Needs setup"/"Needs a connection first"; off = not licensed (not draggable)
  p: string;                  // SVG path data for the 24x24 icon
}
export interface DigitalWorkers {
  DW: Record<string, DigitalWorker>;
  DWD: Record<string, string>;               // short description (step menu line), e.g. dup "Finds the same person under another supplier"
  DWX: Record<string, { d: string; u: string }>; // hover card: d = what it does, u = where to use it
  DW_SET: { workflows: string[]; onboarding: string[]; offboarding: string[]; access: string[] };
  /* which DWs the rail and step menu show per workflow context (engine §1.11 dwContext):
     workflows ["tenure","rate","budget","dup","intake","invoice"]; onboarding ["docs","access","startguard"];
     offboarding ["sweeper","recovery","closer"]; access ["dup","docs","access"]. Never the Chaser.
     The step menu hides s:'off'; the rail shows them greyed and not draggable. */
  CHECK_DW: string[];                        // ["budget","rate","dup","tenure"]: checks with Passed / Flagged exits
  // DWS: same objects as DW, as an array (ignore).
}

export type PresetKey =
  | 'idrtw' | 'bgcheck' | 'docs' | 'training' | 'hris' | 'access' | 'equip' | 'pay'           // ph 'on' (onboarding)
  | 'revoke' | 'recover' | 'finalts' | 'handover' | 'exitconf' | 'hrclose' | 'wclose' | 'ledger'; // ph 'off' (offboarding)

export interface Preset {
  ph: 'on' | 'off';           // shown in the step menu of onboarding ('on') or offboarding ('off') workflows only,
                              // under "Onboarding steps" / "Offboarding steps"
  n: string;                  // step name, e.g. "Identity & right to work"
  d: string;                  // step-menu description
  kind: 'collect' | 'system' | 'task';
  p: Record<string, unknown>; // settings copied onto the node (field names as in §5.8–§5.10)
}
export interface Presets {
  PRESETS: Record<PresetKey, Preset>;
  PRE_STATES: Record<PrereqKey, string>;     // long labels ("Nothing: it can start any time", "Work order is approved", …)
  PRE_SHORT: Record<PrereqKey, string>;      // short labels used in "Built in: Levv only starts this once the <short>."
  RTW: Record<string, string>;               // country -> right-to-work rule, shown in the idrtw box
  BGPKG: Record<'std' | 'fs' | 'enh', string>; // background packages
  CHECKERS: Record<string, string>;          // verifier key -> label: persona Persona, checkr Checkr, esign E-signature,
                                             // workday Workday, servicenow ServiceNow, dw:docs Document collector,
                                             // dw:access Access, onfido Onfido, yoti Yoti
}
export type PrereqKey = 'none' | 'jp_approved' | 'wo_approved' | 'wo_accepted' | 'cleared' | 'ob_done' | 'active' | 'sow_approved' | 'ts_approved';

export interface SystemDef {
  st: 'ok' | 'off';           // ok = connected ("Connected · last checked <seen>"); off = not connected (Coupa)
  seen: string;               // "4 min ago" (display)
  obj: string[];              // objects it can create/update ("What")
  back: string[];             // fields it can bring back ("Bring back to Levv")
}
export interface Systems {
  SYS: Record<string, SystemDef>;            // 8 systems: SAP Fieldglass, Workday, SAP S/4HANA, ServiceNow, Okta, Microsoft Entra ID, Coupa (off), Badge system
  SYS_ACT: Record<SysAction, string>;
  SYS_KEY: Record<string, string[]>;         // system -> matching keys (first one is the default)
  SYS_MAP: Record<string, [string, string][]>; // object -> default field map ("Nova matched these automatically"); '_' = fallback
}

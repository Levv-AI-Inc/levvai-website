import type { Provider } from './workflow';

/** A role key. Plain keys come from ROLES; pseudo keys are 'g:<GROUPS key>' and 'p:<PEOPLE name>'. */
export type RoleKey = string;

export type DecisionClass = 1 | 2 | 3 | 4;
/* CLASS_N: 1 "business sign-off", 2 "specialist review", 3 "commercial review", 4 "executive sign-off".
   Class decides merging ("same kind of decision") and special rules: class 2 (specialist) never moves up a manager chain
   and never uses signing limits; a class-2 delegate must be eligible (DELEG_OK). */

export interface RoleDef {
  n: string;                  // label, e.g. "Hiring manager", "Information Security"
  c: DecisionClass;           // decision class
  actor?: true;               // worker only: can do tasks, provide items and be told; can never approve, review or be escalated to
  grp?: true;                 // a pseudo role for an approval group (key 'g:…'); n = group name, c = 3
  person?: true;              // a pseudo role for a named person (key 'p:…'); n = the person name, c = 3 (created on demand)
}
/* Seed ROLES (key · label · class):
 worker Worker 1 actor · sponsor Sponsor 1 · hm Hiring manager 1 · hm_mgr Hiring manager's manager 1 · cco Cost center owner 1
 dh Department head 1 · sow_owner SOW owner 1 · hrbp HR business partner 2 · sec Information Security 2 · priv Privacy 2
 legal Legal 2 · compliance Compliance 2 · tax Tax 2 · proc Procurement 3 · fbp Finance business partner 3
 supplier_am Supplier account manager 3 · vpf VP Finance 4 · cfo CFO 4 · people_ops People Ops 2 · it IT service desk 2
 ap Accounts payable 3 · g:fin_ctrl Finance controllers 3 grp · g:sec_board Security review board 3 grp · g:exco Executive committee 3 grp
 Pseudo person roles 'p:<Name>' are not in the seed: create {n:<Name>, c:3, person:true} when referenced. */
export type Roles = Record<RoleKey, RoleDef>;

/** Business-role holders per business unit (ORG). Keys hm, hm_mgr, cco, dh. */
export type Org = Record<string /* business unit */, { hm: string; hm_mgr: string; cco: string; dh: string }>;
/* Technology: hm Tom Reed, hm_mgr Priya Shah, cco Priya Shah, dh Alan Brooks
   Operations: hm Grace Kim, hm_mgr Raj Patel, cco Raj Patel, dh Nadia Rahman
   Finance:    hm Omar Haddad, hm_mgr Lena Fischer, cco Lena Fischer, dh Ivan Petrov
   Marketing:  hm Sofia Reyes, hm_mgr Ben Carter, cco Alicia Ng, dh Alicia Ng */

/** ORGX: organisation lookups. */
export interface OrgX {
  LE: Record<string, string>;        // country -> legal entity ("UK" -> "Levv Bank UK Ltd")
  LE_SHORT: Record<string, string>;  // legal entity -> short label for Applies to ("Levv Bank UK Ltd" -> "UK entity")
  CC: Record<string, string>;        // cost center -> name ("CC-100" -> "Platform engineering"); Applies-to label "CC-100 Platform engineering"
  CC_OF: Record<string, string[]>;   // business unit -> its cost centers
  SITE: Record<string, string>;      // country -> default site
  WT: Record<string, string>;        // engagement type -> default worker type
}

export interface OutOfOffice {
  until: string;              // seed "Oct 24" / "Oct 30" → normalise to ISO "2026-10-24" / "2026-10-30" (§15). Displayed as "Oct 24".
  to: string;                 // their delegate (a PEOPLE name)
  from?: string;              // production: ISO start date (absent = already away)
}

export interface ApprovalGroup {
  n: string;                  // "Finance controllers"
  members: string[];          // PEOPLE names
  mode: 'any' | 'all';        // any = any one member approves; all = every (eligible) member approves
}

export interface PeopleAuthority {
  ROLES: Roles;
  PEOPLE: string[];                           // everyone who can be named (31 names, sorted)
  TITLES: Record<string, string>;             // person -> job title, e.g. "Alan Brooks" -> "Head of Technology UK"
  ORG: Org;
  ORGX: OrgX;
  MGR: Record<string, string>;                // person -> their manager (the manager chain used for self-approval and signing limits)
  LIMIT: Record<string, number>;              // person -> signing limit in USD. Infinity = unlimited (seed null, §15 step 3).
                                              // Missing person = 0 (no authority): read it with limitOf().
  CENTRAL: Record<RoleKey, string>;           // central role -> holder, e.g. proc -> "Owen Clarke", sec -> "Kenji Watanabe".
                                              // supplier_am -> "Supplier account manager" (a placeholder, not a person).
  BACKUP: Record<RoleKey, string>;            // role -> backup person: sec Ravi Kumar, legal Luis Romero, compliance Ama Boateng, tax Mei Lin
  OOO: Record<string, OutOfOffice>;           // who is away: Hannah Brooks (until Oct 24, to Luis Romero), Kenji Watanabe (until Oct 30, to Mia Chen)
  DELEG_OK: Record<string, RoleKey[]>;        // delegate -> class-2 roles they may cover: "Luis Romero": ["legal"], "Mia Chen": []
  GROUPS: Record<string, ApprovalGroup>;      // fin_ctrl (any), sec_board (any), exco (all)
  BY_COUNTRY: Record<RoleKey, Record<string, string | null>>;
                                              // role -> country -> holder. null = nobody eligible → the approval pauses.
                                              // Seed: {"priv":{"Germany":null}}
  CANDIDATES: Record<RoleKey, string[]>;      // eligible people the admin area can assign when paused (not used by Flow Studio)
  ALIAS: [RoleKey, string[]][];               // words people use for roles (plain-words parsers)
  FLAT: [string, RoleKey][];                  // ALIAS flattened, longest phrase first
  CLASS_N: Record<DecisionClass, string>;      // JSON object keys are strings ("1"…"4"): validate with string keys and convert with Number(k)
  ACTOR_ONLY: RoleKey[];                      // ["worker"]: never approves, reviews, decides or is escalated to
  NOAPPR: RoleKey[];                          // ["it","ap","people_ops","worker"]: never offered as approvers / deciders
                                              // (Approve "Who approves", If "Who approves"/"Escalate to", flag "Escalate to").
                                              // They CAN be reviewers, task owners and failed-check deciders
                                              // (Collect & verify failRole / failRoles: any role except the worker).
  PROVIDERS: Provider[];                      // ["worker","sponsor","supplier_am","hm","it"]: Collect "Who provides it"
}

/** §15 step 3: a person missing from LIMIT has limit 0. */
export const limitOf = (people: Pick<PeopleAuthority, 'LIMIT'>, person: string): number => people.LIMIT[person] ?? 0;

/** §15 step 2: a named person referenced as 'p:<Name>' gets a pseudo role on demand. */
export function ensurePseudoRole(people: Pick<PeopleAuthority, 'ROLES'>, key: RoleKey): void {
  if (key.startsWith('p:') && !people.ROLES[key]) people.ROLES[key] = { n: key.slice(2), c: 3, person: true };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** §15 step 4: seed "Oct 24" → ISO "2026-10-24". ISO input is returned as it is. */
export function oooUntilIso(until: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(until)) return until;
  const m = /^([A-Z][a-z]{2}) (\d{1,2})$/.exec(until);
  const month = m ? MONTHS.indexOf(m[1]) : -1;
  if (!m || month < 0) throw new Error(`Out-of-office date “${until}” is not “Mon D”`);
  return `2026-${String(month + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

/** The display form used in messages ("is out until Oct 24"): the inverse of oooUntilIso for one ISO date. */
export function oooUntilText(until: string): string {
  const [, month, day] = until.split('-');
  return `${MONTHS[Number(month) - 1]} ${Number(day)}`;
}

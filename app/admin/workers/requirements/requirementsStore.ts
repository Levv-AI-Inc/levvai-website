'use client'

/* ─────────────────────────────────────────────
   REQUIREMENT CATALOG — the atom of the system.
   Enhancement: every requirement now carries how it
   is UNWOUND, not just how it is satisfied. Offboarding
   reads this side; it is never authored separately.
───────────────────────────────────────────── */

export type ValidationStrategy = 'manual' | 'third_party'
export type ApproverGroup = 'HR' | 'LEGAL' | 'IT' | 'FINANCE' | 'SECURITY' | 'PROCUREMENT'
export type OwnerRole = 'Worker' | 'Supplier' | 'Hiring Manager' | 'IT' | 'System'

/* ── Nova's role inside validation is narrow ──
   Nova is a PRE-CHECK, never the approver. It reads the upload transiently to
   run a bounded set of concrete checks, flags anything off, and hands to the
   human who actually approves. It does NOT store the document's data — the
   extraction is ephemeral, in service of a flag. The checks are a fixed menu
   the user toggles, not a free-text rule builder. */
export type NovaCheckKind = 'doc_type' | 'name_match' | 'not_expired' | 'legible'

export const NOVA_CHECKS: { kind: NovaCheckKind; label: string; desc: string }[] = [
  { kind: 'doc_type',    label: 'Right document type', desc: 'It\u2019s the document asked for \u2014 flags a license where a passport was required.' },
  { kind: 'name_match',  label: 'Name matches worker', desc: 'The name on the document matches the worker\u2019s record.' },
  { kind: 'not_expired', label: 'Not expired',         desc: 'Valid through the engagement \u2014 flags a document that lapses mid-contract.' },
  { kind: 'legible',     label: 'Legible & complete',  desc: 'Readable, in focus, nothing cut off or missing.' },
]

export const NOVA_CHECK_LABEL: Record<NovaCheckKind, string> =
  Object.fromEntries(NOVA_CHECKS.map(c => [c.kind, c.label])) as Record<NovaCheckKind, string>

export type Nova = {
  checks: NovaCheckKind[]   // routing is implicit: Nova flags to whoever Approves the requirement
}

/* ── NEW: the unwind plan (the wedge) ──
   Captured at definition. A requirement is not fully
   defined until it knows how it comes undone. */
export type UnwindCondition =
  | 'on end-date'
  | 'within 3 days of end-date'
  | 'immediately on exit'
  | 'on final invoice'

/* The unwind is a verb applied to the grant. Structured, not free text. */
export type UnwindVerb =
  | 'Revoke' | 'Deactivate' | 'Archive' | 'Purge' | 'Expire'
  | 'Recover' | 'Release' | 'Collect' | 'Close' | 'Reverse'

export const UNWIND_VERBS: UnwindVerb[] = [
  'Revoke', 'Deactivate', 'Archive', 'Purge', 'Expire', 'Recover', 'Release', 'Collect', 'Close', 'Reverse',
]

export type Unwind = {
  verb: UnwindVerb                        // what we do at exit (the choice)
  action: string                          // composed: `${verb} ${requirement name}`
  mode: 'automated' | 'manual'            // automated = Nova runs it · manual = a team does it
  owner: ApproverGroup                    // the team whose queue it lands in WHEN manual
  condition: UnwindCondition              // when it fires
  reconcile?: boolean                     // confirm against source-of-truth, not fire-and-forget
}

/* Which verbs a system can run on its own vs which need a person.
   Revoke/Archive/etc are status & data changes an integration handles;
   Recover/Collect are physical, Release/Close are team judgement calls. */
export const VERB_MODE: Record<UnwindVerb, 'automated' | 'manual'> = {
  Revoke: 'automated', Deactivate: 'automated', Archive: 'automated',
  Purge: 'automated', Expire: 'automated', Reverse: 'automated',
  Recover: 'manual', Collect: 'manual', Release: 'manual', Close: 'manual',
}

/* who/what actually runs a given unwind, for display */
export function unwindRunner(u: Pick<Unwind, 'mode' | 'owner'>): string {
  return u.mode === 'automated' ? 'Nova' : u.owner
}

export function composeAction(verb: UnwindVerb, name: string): string {
  return `${verb} ${name.trim() || 'requirement'}`
}

/* ── NEW: applicability ──
   undefined = applies to every engagement. The resolver
   evaluates this when compiling a worker-specific run. */
export type Applicability = {
  workerTypes?: ('Contingent' | 'SOW' | 'Staff-aug')[]
  clientTags?: string[]                   // e.g. 'HEALTHCARE', 'REGULATED'
  jurisdictions?: string[]
}

/* ── NEW: accepted variants ──
   one requirement, multiple acceptable formats (any one satisfies).
   This is the "passport OR license OR national ID" case — format
   choice that lives INSIDE the requirement, not an ANY gate. */
export type AcceptedVariant = { id: string; label: string }

/* ── NEW: document exchange — the FULFILLMENT axis ──
   Independent of validation (strategy/approver) and reversal (unwind).
   The customer may SUPPLY a template, the worker SIGNS / FILLS / ACKNOWLEDGES
   it, and a returned copy may be captured. One field expresses four real shapes:
     • supplied + signed back   → NDA, Standard of Conduct, Article 23-A, SEC statement
     • supplied + acknowledged  → personal-investment policy, training attestations
     • worker-supplied + upload → bring-your-own document
     • (field omitted)          → no document involved
   Nova can pre-check the RETURNED artifact (signature present, legible, not
   expired); the human approver still renders the verdict. */
export type DocMethod = 'esign' | 'upload' | 'acknowledge'

export const DOC_METHODS: { kind: DocMethod; label: string; verb: string; desc: string }[] = [
  { kind: 'esign',       label: 'E-sign',        verb: 'signs',        desc: 'Worker signs the supplied form in-app; a signed copy is returned.' },
  { kind: 'upload',      label: 'Upload signed', verb: 'uploads',      desc: 'Worker signs offline and uploads the signed copy back.' },
  { kind: 'acknowledge', label: 'Acknowledge',   verb: 'acknowledges', desc: 'Worker reads and attests; a timestamped acknowledgment is recorded, no file.' },
]

export const DOC_METHOD_LABEL: Record<DocMethod, string> =
  Object.fromEntries(DOC_METHODS.map(m => [m.kind, m.label])) as Record<DocMethod, string>

export type RequirementDocument = {
  template: { name: string; version: string } | null   // customer attaches at definition time; null = worker brings their own
  method: DocMethod                                      // how the owner completes it
  capturesReturn: boolean                                // store the signed/completed artifact that comes back
  provider?: string                                      // optional e-sign routing (e.g. 'DocuSign'); omit = native
}

/* acknowledge never captures a returned file — keep the two coherent
   (mirrors coerceApprover: the model self-corrects an incoherent combo) */
export function coerceDocument(d: RequirementDocument): RequirementDocument {
  return d.method === 'acknowledge' ? { ...d, capturesReturn: false } : d
}

/* one-line summary of how a requirement is fulfilled, for display */
export function docSummary(d: RequirementDocument): string {
  const src = d.template ? `${d.template.name} ${d.template.version}` : 'worker-supplied document'
  if (d.method === 'acknowledge') return `Acknowledge ${src}`
  return `${DOC_METHOD_LABEL[d.method]} ${src}${d.capturesReturn ? ' · returns a copy' : ''}`
}

/* ── Nova — a thin screener, not a decider ──
   When a requirement is "Approved by Nova", Nova does ONE narrow check and
   then hands to a person. It never auto-approves a compliance call. The
   canonical shape is Nova + NovaCheckKind defined at the top of this file. */


export type Requirement = {
  id: string
  name: string
  owner: OwnerRole                        // RACI: Responsible (who executes)
  strategy: ValidationStrategy
  fallbackApprover: ApproverGroup         // human validator (manual) / fallback (auto)
  unwind: Unwind                          // ← REQUIRED: how it's undone
  applicability?: Applicability           // undefined = all workers
  acceptedVariants?: AcceptedVariant[]    // any one satisfies
  document?: RequirementDocument          // present when a doc is supplied and/or returned
  nova?: Nova                             // present only when AI pre-check is enabled
  integration?: { provider: string }
}

/* ── Approver — who renders the verdict that a requirement is satisfied ──
   A human group, or an Integration (external system returns pass/fail).
   Nova is NOT here: Nova reads & flags, it never renders a verdict.
   Nova is optional support layered on a human-approved requirement. */
export type Approver = 'Integration' | ApproverGroup

export const HUMAN_APPROVERS: ApproverGroup[] = ['HR', 'LEGAL', 'SECURITY', 'IT', 'PROCUREMENT', 'FINANCE']

/* ── The resolution layer (mocked) ──
   "Approved by" is a ROLE (stable, survives reorgs), not a person. The role
   resolves to whoever currently holds it — pulled live from the org graph /
   HRIS in production. Here it's mocked. You assign the role once (usually
   pre-filled from the requirement); the people are computed, never authored. */
export type Person = { id: string; name: string; title: string }

export const DIRECTORY: Record<ApproverGroup, { role: string; people: Person[] }> = {
  HR:          { role: 'People Ops sign-off',        people: [{ id: 'p1', name: 'Dana Reyes', title: 'HR Business Partner' }, { id: 'p2', name: 'Tom Okafor', title: 'People Ops Lead' }] },
  LEGAL:       { role: 'Legal sign-off',             people: [{ id: 'p3', name: 'Priya Nair', title: 'Senior Counsel' }] },
  SECURITY:    { role: 'Security review',            people: [{ id: 'p4', name: 'Alex Stone', title: 'Security Analyst' }, { id: 'p5', name: 'Jin Park', title: 'Security Lead' }] },
  IT:          { role: 'IT provisioning',            people: [{ id: 'p6', name: 'Sam Patel', title: 'IT Admin' }, { id: 'p7', name: 'Lena Cho', title: 'Systems Engineer' }] },
  PROCUREMENT: { role: 'Vendor & insurance sign-off', people: [{ id: 'p8', name: 'Sarah Chen', title: 'Procurement Lead' }, { id: 'p9', name: 'Marcus Lee', title: 'Vendor Manager' }] },
  FINANCE:     { role: 'Finance sign-off',           people: [{ id: 'p10', name: 'Olu Bello', title: 'Controller' }] },
}

export function resolvePeople(a: Approver): Person[] {
  return a === 'Integration' ? [] : (DIRECTORY[a]?.people ?? [])
}

export function roleLabel(a: Approver): string {
  return a === 'Integration' ? 'Integration' : (DIRECTORY[a]?.role ?? a)
}

/* Owner → which approvers are coherent. System is automated (Integration
   only); everyone else can be a human team or an Integration. */
export function allowedApprovers(owner: OwnerRole): Approver[] {
  if (owner === 'System') return ['Integration']
  return ['Integration', ...HUMAN_APPROVERS]
}

export function coerceApprover(owner: OwnerRole, approver: Approver): Approver {
  const a = allowedApprovers(owner)
  return a.includes(approver) ? approver : a[0]
}

export function approverLabel(a: Approver): string {
  if (a === 'Integration') return 'Integration'
  return a
}

/* approver → the stored strategy + validator */
export function applyApprover(approver: Approver): { strategy: ValidationStrategy; fallbackApprover: ApproverGroup } {
  if (approver === 'Integration') return { strategy: 'third_party', fallbackApprover: 'IT' }
  return { strategy: 'manual', fallbackApprover: approver }
}

/* reverse: read the current approver back off a requirement */
export function currentApprover(r: { strategy: ValidationStrategy; fallbackApprover: ApproverGroup }): Approver {
  if (r.strategy === 'third_party') return 'Integration'
  return r.fallbackApprover
}

/* Nova default — starts with the universal check; user toggles the rest */
export function defaultNova(): Nova {
  return { checks: ['doc_type'] }
}

/* ── Helpers: auto-register a sensible unwind on create ──
   so offboarding is never an afterthought. User refines in config. */
export function unwindOwnerFor(owner: OwnerRole): ApproverGroup | OwnerRole {
  const map: Record<OwnerRole, ApproverGroup | OwnerRole> = {
    Worker: 'HR',
    IT: 'IT',
    Supplier: 'PROCUREMENT',
    'Hiring Manager': 'HR',
    System: 'System',
  }
  return map[owner] ?? 'HR'
}

export function defaultUnwind(name: string, owner: OwnerRole): Unwind {
  return {
    verb: 'Revoke',
    action: composeAction('Revoke', name),
    mode: 'automated',
    owner: unwindOwnerFor(owner) as ApproverGroup,
    condition: 'on end-date',
    reconcile: false,
  }
}

/* ── Category ──
   An explicit, editable attribute of the requirement. It drives the
   unwind (what verb, who, when, whether to reconcile) from a real field
   instead of re-guessing the name every time. The name only PRE-SELECTS
   it; the user can correct it once and it sticks. This is the same field
   Nova would eventually classify into — rules still own the decision. */
export type RequirementCategory =
  | 'identity' | 'legal' | 'screening' | 'access'
  | 'asset' | 'insurance' | 'training' | 'payment' | 'other'

type CategorySpec = {
  label: string
  verb: UnwindVerb
  owner: ApproverGroup | OwnerRole
  condition: UnwindCondition
  reconcile: boolean
}

export const CATEGORY_META: Record<RequirementCategory, CategorySpec> = {
  identity:  { label: 'Identity',  verb: 'Purge',   owner: 'HR',          condition: 'on end-date',               reconcile: false },
  legal:     { label: 'Legal',     verb: 'Expire',  owner: 'LEGAL',       condition: 'on end-date',               reconcile: false },
  screening: { label: 'Screening', verb: 'Archive', owner: 'SECURITY',    condition: 'on end-date',               reconcile: false },
  access:    { label: 'Access',    verb: 'Revoke',  owner: 'IT',          condition: 'immediately on exit',       reconcile: true  },
  asset:     { label: 'Asset',     verb: 'Recover', owner: 'IT',          condition: 'within 3 days of end-date', reconcile: true  },
  insurance: { label: 'Insurance', verb: 'Release', owner: 'PROCUREMENT', condition: 'on final invoice',          reconcile: true  },
  training:  { label: 'Training',  verb: 'Archive', owner: 'HR',          condition: 'on end-date',               reconcile: false },
  payment:   { label: 'Payment',   verb: 'Close',   owner: 'FINANCE',     condition: 'on final invoice',          reconcile: false },
  other:     { label: 'Other',     verb: 'Revoke',  owner: 'HR',          condition: 'on end-date',               reconcile: false },
}

export const CATEGORY_KEYS = Object.keys(CATEGORY_META) as RequirementCategory[]

/* name → category, used only to PRE-SELECT the field */
export function inferCategory(name: string): RequirementCategory {
  const n = name.toLowerCase()
  if (/\b(nda|agreement|contract|consent|policy|acknowledg|sign)/.test(n)) return 'legal'
  if (/\b(background|screen|vetting|criminal|drug|reference check|check)/.test(n)) return 'screening'
  if (/\b(id|identity|passport|licen[sc]e|photo|visa|right to work|i-?9)/.test(n)) return 'identity'
  if (/\b(access|account|sso|okta|vpn|login|credential|email|seat)/.test(n)) return 'access'
  if (/\b(asset|laptop|device|hardware|equipment|badge|phone|key)/.test(n)) return 'asset'
  if (/\b(insurance|coi|liability|coverage|certificate)/.test(n)) return 'insurance'
  if (/\b(training|certification|course|module)/.test(n)) return 'training'
  if (/\b(bank|payment|payroll|tax|w-?9|deposit|invoice)/.test(n)) return 'other'
  return 'other'
}

/* category (the decision) → unwind. Deterministic & auditable. */
export function unwindForCategory(category: RequirementCategory, name: string): Unwind {
  const m = CATEGORY_META[category] ?? CATEGORY_META.other
  return {
    verb: m.verb,
    action: composeAction(m.verb, name),
    mode: VERB_MODE[m.verb],
    owner: m.owner as ApproverGroup,
    condition: m.condition,
    reconcile: m.reconcile,
  }
}

/* convenience: infer + build in one step */
export function smartUnwind(name: string, _owner?: OwnerRole): Unwind {
  return unwindForCategory(inferCategory(name), name)
}

/* ── Seed data — now reversible ── */
let requirements: Requirement[] = [
  {
    id: 'gov-id',
    name: 'Government ID Photo Check',
    owner: 'Worker',
    strategy: 'manual',
    fallbackApprover: 'HR',
    acceptedVariants: [
      { id: 'passport', label: 'Passport' },
      { id: 'license', label: 'Driver License' },
      { id: 'national', label: 'National ID' },
    ],
    unwind: { verb: 'Purge', action: 'Purge Government ID Photo Check', mode: 'automated', owner: 'HR', condition: 'on end-date', reconcile: false },
  },
  {
    id: 'bg-check',
    name: 'Background Screening',
    owner: 'Worker',
    strategy: 'third_party',
    fallbackApprover: 'SECURITY',
    unwind: { verb: 'Archive', action: 'Archive Background Screening', mode: 'automated', owner: 'SECURITY', condition: 'on end-date', reconcile: false },
    integration: { provider: 'Checkr' },
  },
  {
    id: 'coi',
    name: 'Certificate of Insurance (COI)',
    owner: 'Supplier',
    strategy: 'manual',
    fallbackApprover: 'PROCUREMENT',
    nova: { checks: ['not_expired'] },
    applicability: { workerTypes: ['SOW'] },
    unwind: { verb: 'Release', action: 'Release Certificate of Insurance (COI)', mode: 'manual', owner: 'PROCUREMENT', condition: 'on final invoice', reconcile: true },
  },
  {
    id: 'nda-sign',
    name: 'Non-Disclosure Agreement',
    owner: 'Worker',
    strategy: 'manual',
    fallbackApprover: 'LEGAL',
    document: { template: { name: 'Mutual NDA', version: 'v3' }, method: 'esign', capturesReturn: true },
    nova: { checks: ['legible'] },
    unwind: { verb: 'Expire', action: 'Expire Non-Disclosure Agreement', mode: 'automated', owner: 'LEGAL', condition: 'on end-date', reconcile: false },
  },
]

export function getRequirements() {
  return requirements
}

export function setRequirements(next: Requirement[]) {
  requirements = next
}
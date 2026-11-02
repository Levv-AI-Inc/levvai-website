# Levv Flow Studio — 00 Overview, decisions and scope

Read this first. It says what you are building, the decisions that are final, what is in and out of scope, and how the other documents fit together.

---

## 1. What Flow Studio is

Levv manages contingent workers (contractors, agency staff, SOW projects) for large companies. Every record in Levv (a work order, an assignment change, a SOW, a timesheet, an invoice, an access request, onboarding, offboarding) goes through a process: checks, approvals, documents, system updates, notifications.

**Flow Studio is where an admin builds those processes**, called **workflows**, on one visual canvas without code. A workflow:

- **starts on an event** for a record type, for example "Work order · Submitted" or "Onboarding · Starts", which can come from Levv or from another system ("Starts from": SAP Fieldglass, Workday, SAP S/4HANA, Zip, ServiceNow);
- **applies to** some or all of the company: business unit, cost center, legal entity, work country, site, worker type, job family;
- **runs left to right** through steps:
  - **If** splits the path;
  - **Approve** asks people to sign off;
  - **Digital Worker checks** flag problems;
  - **Collect & verify** gets documents and details;
  - **System** steps create or update things in Workday, ServiceNow and others;
  - **Notify**, **Task**, **Wait**, **Parallel** and **Run workflow** do the rest;
- **can be tested** on sample records before it goes live. Test names every person who would be asked and says why, in plain words.

It replaces what SAP Fieldglass needs hundreds of admin screens and a systems integrator to configure. Admins should feel it is obvious. The guiding word from the founders is **intuitive**, and everything built must be **intentional**: no setting without a clear purpose.

The product brand voice is "Conversational VMS". Nova is Levv's AI assistant. In Flow Studio it does two things: it checks a workflow for problems ("Nova checks"), and it turns plain words into conditions (✦ Set). Nova never approves anything.

---

## 2. Principles (apply them to every decision the documents do not cover)

1. **One place to build.** A workflow is the whole process, including who must say yes. There are no separate approval screens.
2. **Plain words everywhere.** Test, panels and messages explain decisions the way a person would: "Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK)". No codes or jargon in the UI.
3. **People decide; Levv checks and helps.**
   - Digital Workers never approve or reject.
   - The worker the request is about never approves, reviews or is escalated to.
   - Nobody eligible means the step pauses. It is never approved automatically.
4. **Ask each person once.** One person is asked once per kind of decision on a path. A request is never approved by the person who raised it.
5. **No pills.** Every selection, single or multiple (people, roles, values, options), uses the same searchable dropdown component. On/off settings are switches.
6. **Nothing is deleted.** Workflows are switched Active / Inactive and never deleted. A step inside a workflow can be deleted while editing.
7. **Safe changes.**
   - Publishing shows the impact on the last 90 days of records and catches overlaps and must-fix problems.
   - A second person approves every publish.
   - Anything already running keeps the version it started on.
8. **The line is the rule.** The canvas order is the order things happen. A step waits for the steps before it on its path.
9. **Respect data ownership.** Records that come from another system stay owned by that system. Levv reads them, reacts to events and writes back only through System steps.

---

## 3. Final decisions (dated; all documents follow these)

| # | Decision | Date |
| --- | --- | --- |
| F1 | **Approvals live inside workflows** as Approve steps. No approval flows, approval library, drill-in or breadcrumbs. A workflow If path can "Ask someone to approve" (e.g. over $500K this person approves, otherwise that person). | 26 Oct |
| F2 | **Variations are separate workflows.** If a business unit approves differently, it gets its own workflow on the same record + event with a narrower Applies to (seed: "UK Technology work orders", "Data and AI hires"). The most specific one runs. Publish catches overlaps and asks which wins. | 26 Oct |
| F3 | **Things that must match everywhere are managed outside Flow Studio:** who holds each role, signing limits, absences and delegates, approval groups, company-wide approval rules (IR35, client data access, regulated roles), and the "Needs fixing" list of paused approvals. Flow Studio reads them (seed files) and the engine applies them. There is **no Settings button or page** in Flow Studio. | 26 Oct |
| F4 | **The Chaser is built into every step that waits on a person** (Approve, Task, Collect & verify): "Remind after (hours)" and "Then escalate to … after (hours)". Defaults: Approve 24/48, Task and Collect & verify 48/96. It is not a step and not a Digital Worker. | 26 Oct |
| F5 | **Escalations have one timer.** Every escalation (from an If path, a check's flag, or a failed Collect & verify) is a generated Approve step with `escalation: true`. Its Chaser `sla` (default 48) is the only timer. "Escalate after (hours)" fields elsewhere edit that same value. | 27 Oct |
| F6 | **The Update record step is removed.** Step menu: Decide [If] · Approvals [Approve, Auto-approve, Fits plan?] · People [Collect & verify, Task] · Systems [System, Notify] · Timing [Wait, Parallel, Run workflow]. Onboarding and offboarding workflows also offer ready-made steps. Digital Workers are dragged from the rail. | 26 Oct |
| F7 | **No pills anywhere** (see principle 5). Includes "What's required", which is a dropdown of common items with "+ Add “…”" for new ones. | 26 Oct |
| F8 | **Active / Inactive, never delete.** | 25 Oct |
| F9 | **Running workflows: manual Pause, Resume and Stop.** No automatic handling of cancellations or changes from other systems in this version. Stop needs a reason and is final. Only the workflow owner or an admin can use these. Each running workflow is stored with its own status (running, paused, stopped, completed, rejected) and is pinned to the version it started on. Wait steps already follow date changes on the record. | 27 Oct |
| F10 | **Incoming data is an event.** Everything another system sends becomes an event on a record. Workflows start from events ("Starts from") and System steps bring values back ("Bring back to Levv", e.g. the Workday worker ID, saved on the record and used by later steps). | 26 Oct |
| F11 | Defaults: a new workflow tells the Hiring manager about a final rejection; the first publish of a draft is "Live v1"; a new Approve step is named "Approval" and shows "Choose who approves" until approvers are picked; group and person modes start empty. | 27 Oct |
| F12 | The publish approver is any user with the "Approve flow changes" permission who is not the author. An overlap choice made at publish only takes effect when that person approves. | 27 Oct |
| F13 | Every fix listed in 03-engine §20 (D1–D32) and 04-ui §16 is required, except items that 04-ui §16 labels "recommended": those are optional unless a test in 06 asserts them. Undo on Delete this step is required. Where production behaviour deliberately differs from the prototype, the documents say so. | 27 Oct |

**Decision numbers used in other documents.** 03-engine §20 cites these decisions as R1–R12, and 06-acceptance-tests cites them as "final decisions (00 §3) T1–T12". They map to the table above as follows:

| 03 | 06 | Means | See |
| --- | --- | --- | --- |
| R1 | T1 | Prototype fixes are production requirements | F13 |
| R2 | T2 | A new workflow tells the Hiring manager about a final rejection | F11 |
| R3 | T3 | The first publish of a draft is v1 | F11 |
| R4 | T4 | A new Approve step is named "Approval" and shows "Choose who approves"; group and person modes start empty | F11 |
| R5 | T5 | One escalation timer; generated escalation steps (including "{Step} failed: escalation") | F5 |
| R6 | T6 | Chaser validation: escalation after the reminder | F4 |
| R7 | (T9) | Publish impact count as in the prototype | F12 |
| R8 | T9 | Identical scopes overlap | F2, F12 |
| R9 | T9 | Publish approver and when the overlap choice applies | F12 |
| R10 | T11 | Operational roles may decide failed checks | §7 item 4 |
| R11 | T10 | Absences compared with `asOf` (tests: 2026-10-20) | 03 D28 |
| R12 | T12 | Rule events stay as seeded (data note) | §7 item 3 |
| — | T7 | "Try a record" is a single-select list, not pills | F7 |
| — | T8 | No Settings button, page or "Approval rules ›" in the DOM | F3 |

---

## 4. Scope

### 4.1 In scope (build all of it)

1. **Data model and seed loader**: every type in 02-data-model, loading the seed JSON without renaming fields.
2. **Engine**: pure TypeScript, no React (03-engine):
   - which workflow runs for a record;
   - graph walk; condition evaluation; Needs information;
   - approval planning: role → person, self-approval move-up, ask once, decision classes, signing authority, absences (delegate → backup → pause), groups, named people with backup, split funding, approval rules, covered, not asked again, running totals, conflicting proposals, auto-approve, Fits plan?;
   - Digital Worker check results; Collect & verify, System, Wait, Notify and Task outcomes;
   - the Test simulation and its exact wording; Nova checks; publish review and overlaps; active/inactive rules; graph editing operations; the plain-words condition writer.
3. **Flow Studio UI** (04-ui):
   - flow picker, canvas, step menu, every step panel, the Digital Workers rail;
   - Test drawer, Nova drawer, publish dialog, active/inactive, new workflow;
   - the one searchable dropdown component (SelectMenu); toasts and keyboard.
4. **Persistence and API**: workflows (draft + published versions), publish requests, read-only reference data, sample and history records, workflow runs (01-architecture).
5. **Runtime** (05-runtime):
   - event intake; starting runs; moving along the line;
   - Approve decisions (approve / reject / send back) and minimal "My approvals" and "My tasks" lists;
   - the Chaser and Wait scheduler;
   - Collect & verify and System steps through adapter interfaces with deterministic mock adapters;
   - ledger lines;
   - run list and run detail with **Pause / Resume / Stop**; an audit log.
6. **Tests**: every test in 06-acceptance-tests (239 tests: engine, UI end-to-end, lint/publish, runtime).

### 4.2 Out of scope for this build (do not build; leave clean extension points)

- Admin screens for people, roles, limits, absences, groups and approval rules (F3). Load them from the seed and from a JSON import endpoint. They are read-only in Flow Studio.
- Real connectors to Fieldglass, Workday, ServiceNow, Okta, Entra ID, S/4HANA, Coupa, badge systems, Persona, Onfido, Yoti, Checkr. Build the adapter interfaces and mocks only.
- Automatic reaction to cancellations or changes from other systems (F9). Manual Pause / Resume / Stop only.
- The worker-facing portal. The "Worker sees: …" lines are computed and shown in Test; the portal itself is a separate product area.
- A decision audit screen beyond the run log; the Ask Nova command bar; budget reservation; payroll maths.

---

## 5. The documents, in reading order

| File | What it is | Size |
| --- | --- | --- |
| `00-overview.md` | This file: product, principles, decisions, scope | short |
| `01-architecture.md` | Tech stack, folders, persistence schema, API routes, permissions, how engine / UI / runtime fit, build order | medium |
| `02-data-model.md` | Every type, field and default, matching the seed JSON exactly; load-time normalisation; legacy fields to ignore | large |
| `03-engine.md` | Every rule and algorithm, with exact user-visible strings; worked examples; deviations from the prototype (03 §20) | very large |
| `04-ui.md` | Every screen, panel, field, label, option, default, state, interaction and string; the dropdown component; copy deck; differences from the prototype (04 §16) | very large |
| `05-runtime.md` | Running workflows: runs, steps, decisions, scheduler, adapters, Pause / Resume / Stop, run screens, inboxes, events | medium |
| `06-acceptance-tests.md` | 239 tests with exact expected outputs; the definition of done | very large |
| `seed/*.json` | Reference and sample data (15 workflows, 3 approval rules, people and authority, catalog, Digital Workers, ready-made steps, systems, 29 sample records, 440 history records) | data |
| `reference/flow-studio-v35.html` | The clickable prototype. Open it in a browser to see the intended behaviour and look. **Do not copy its code**: it was built in quick layered patches. | reference |

**Precedence when two documents disagree:** 00 → 03 → 02 → 04 → 06. 06 §7.3 records any known contradictions and what the tests follow (none at present). Where the specs say a behaviour "deviates from the prototype", the spec wins over the prototype.

---

## 6. Glossary

| Term | Meaning |
| --- | --- |
| Record | A business object: work order, assignment, SOW, timesheet, expense, invoice, worker, onboarding, job posting, offboarding, access request (catalog `RECORDS`). |
| Event | Something that happens to a record ("Submitted", "Change order submitted", "End date in 30 days", "Starts") (catalog `EVENTS`, `EVENTS_FOR`). |
| Workflow | What runs when an event happens for records within its Applies to. Draft + published versions. Active or Inactive. |
| Applies to | Scope filters on record fields. Several picks in one field = any of them; fields combine with AND. Empty = everywhere. |
| Step / node | A box on the canvas. Kinds: trigger (Start), cond (If), appr (Approve), policy (Auto-approve), plan (Fits plan?), dw (Digital Worker), collect (Collect & verify), task, system, notify, wait, parallel, runwf (Run workflow), end. |
| Path | One branch of an If, with conditions and a Then. "Otherwise" (or "No") catches the rest. |
| Approval round | The people asked at one Approve step on the path, after resolving roles to people. Test reports "N approval rounds on this path". |
| Role | A business role resolved per record (Hiring manager, Cost center owner…), a central role (Procurement, Legal…), an approval group (`g:`) or a named person (`p:`). |
| Decision class | 1 business sign-off, 2 specialist review, 3 commercial review, 4 executive sign-off. Used for "ask once". |
| Approval rule | Company-wide rule (managed outside Flow Studio) that adds approvers, tasks or flags to every matching workflow. |
| Digital Worker | Levv's automated helper. Checks (Budget, Rate, Duplicate & ghost worker, Tenure & classification) come out Passed or Flagged. Helpers do jobs (collect documents, provision access…). Never decide. |
| Chaser | Built-in reminder and escalation timer on steps that wait on a person. |
| Ledger | The record of everything given to a worker (accounts, access, equipment, obligations), which offboarding must close. |
| Test | Simulation of a workflow on a sample record, showing the path, every person and why. |
| Run | One real execution of a workflow version for a record. Status running / paused / stopped / completed / rejected. |

---

## 7. Open questions (non-blocking: build the documented default and keep it easy to change)

1. "Any one" approvers only drop the requester; no delegation, limits or move-up (03-engine D30). Kept for v1.
2. Assignment events only start once the worker is cleared to start (built-in prerequisite in 03-engine §15 and 04-ui §16 open questions). Kept as documented.
3. Approval rule events: SOWs now start on `created`, but the seeded rules match `submitted`, so rules do not apply to new SOWs (03-engine D2). This is a data fix for the admin area; leave the engine as documented.
4. People Ops, IT service desk and Accounts payable may decide failed checks, but cannot approve requests (decision R10).
5. Sample records `OB-2251` and `ASN-915` fit no workflow. They are kept unused.

---

## 8. Numbers to sanity-check your build

- 15 workflows (14 live, 1 draft: "Data and AI hires"); 3 approval rules (Client data access, UK off-payroll (IR35), Regulated roles).
- 29 sample records; 440 history records. Work order submitted shows "140 records in the last 90 days".
- After loading the seed and creating the generated "failed: escalation" steps (02-data-model §15), the canvases hold 159 boxes, of which 50 are Approve steps.
- 239 acceptance tests: engine 126, UI 82, lint/Nova/publish 16, runtime 15.

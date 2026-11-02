# 06 · Acceptance tests — Levv Flow Studio

Status: build input for Codex · Oracles: prototype v35 (`reference/flow-studio-v35.html`) for everything the prototype does right; `03-engine.md` (§20 D1–D32 required, D30 kept), `04-ui.md` (§16) and the final decisions in `00-overview.md` §3 where production differs · Cross-checked against the v35 human test script (63 scripts) and the automated browser run of the prototype on 26 Oct 2026 · Updated 27 Oct 2026

This file is the acceptance contract for Flow Studio: the workflow builder in which approvals are **Approve steps inside workflows**. Every test below is meant to be implemented as an automated test: **Vitest** for the pure engine (Part A, and the pure parts of Part C and Part D) and **Playwright** for the UI (Part B, and the UI parts of Part C and Part D). A feature is done when its tests pass. A test may be changed only by changing this file.

Final product decisions these tests enforce (they override anything older in the prototype or the human script):

1. Approvals are Approve steps inside workflows. There is no approval screen, no approval flow to open, no drill-in, no breadcrumb.
2. There is no Settings page or Settings button in Flow Studio. People, signing limits, absences, approval groups and approval rules are managed elsewhere; the engine reads them from the seed (`people-and-authority.json`, `approval-rules.json`).
3. The Chaser is built into every step that waits on a person (Approve, Task, Collect & verify). It is not a Digital Worker and is not in the rail.
4. There is no Update record step.
5. There are no pills. Every selection is a searchable dropdown, and no native browser `<select>` is visible anywhere.
6. Workflows are never deleted. They are Active or Inactive.
7. Every running workflow can be paused, resumed and stopped by hand (runtime; Part D).
8. The prototype’s three defects found here are fixed in production: an If path set back to Carry on rejoins where the paths meet (`mergeAt`); change orders use one walk on the running total; an Approve step with nobody chosen shows “Choose who approves”.
9. A new workflow tells Hiring manager about a final rejection by default; the first publish of a never-published draft is v1; the Approve kind is “Approve” and a new step is named “Approval”; group and person modes start empty.
10. Escalations have one timer (the generated escalation step’s Chaser `sla`, default 48, remind 24), edited by “Escalate after (hours)” on the If path, check and Collect & verify panels; Collect & verify → Escalate creates a “{Step} failed: escalation” step on a “Failed” exit. Escalation must come after the reminder.
11. “Try a record” is a vertical single-select list of rows. Identical scopes overlap at publish; the overlap choice applies when a second person with “Approve flow changes” (not the author) approves.
12. Absences are compared with `asOf` (tests: 2026-10-20). Failed-check deciders may be operational roles; only the worker is excluded. Approval-rule events stay as seeded (SOWs start on `created`, so “Client data access” does not apply to SOW-77; data note, engine D2).

Numbering note: elsewhere in this file, “decision N”, “TN” and “final decision (00 §3) N” all mean row TN of the decision-number table in `00-overview.md` §3 (for example “decision 9” = T9, overlaps and the publish approver). They do not refer to the numbered list above.

How the expected values were obtained: every engine expectation in Part A was produced by running the prototype’s own engine on the seed data with the stated setup, from a fresh load, and every UI string in Part B and Part C was read from the prototype’s screen. Strings are copied verbatim, including curly quotes and apostrophes. Where production differs from the prototype (a defect, or a later decision), the test says so with a **DEVIATION** note naming the engine D-number, the UI §16 item or the final decision (00 §3); Appendix 7 lists every one. Part D has no prototype at all and is marked **NEW IN PRODUCTION — NO PROTOTYPE ORACLE**.

## Contents

1. How to run
2. Part A — Engine tests
3. Part B — UI end-to-end tests
4. Part C — Lint, Nova and publish tests
5. Part D — Runtime: Pause, Resume, Stop
6. Traceability
7. Appendix — where the human script, the automated browser run and the prototype disagree

## 1. How to run

### 1.1 Test layers

| Layer | Runner | Folder (suggested) | What it covers | Talks to |
| --- | --- | --- | --- | --- |
| Engine | Vitest | `tests/engine/` | Part A, Part C lint and publish-impact functions, Part D state machine | Pure TypeScript functions only. No React, no DOM, no network, no database |
| UI end-to-end | Playwright (Chromium) | `tests/e2e/` | Part B, the UI halves of Part C and Part D | The running Next.js app (`next build && next start`, or `next dev` locally) seeded with the same fixtures |

Engine tests must not import anything from `app/` or any React component. The UI tests must not import engine code; they drive the browser with visible labels and roles only (see 1.5).

### 1.2 Fixtures

All tests load every seed file from `docs/flow-studio/seed/` (copy them to `tests/fixtures/seed/` unchanged):

| File | Used for |
| --- | --- |
| `workflows.json` | The 15 workflows (14 live, 1 draft). Each has `draft` (the editable version, which is what Test runs) and `published` (null for the never-published draft “Data and AI hires”) |
| `sample-records.json` | The 29 “Try a record” records. Test runs one of these through a workflow |
| `people-and-authority.json` | Roles, holders, managers, signing limits, backups, absences, delegates, groups, country rules |
| `approval-rules.json` | The 3 company-wide approval rules (Client data access, UK off-payroll (IR35), Regulated roles) |
| `catalog.json` | Records, events, fields, operators, labels, option lists, step menu groups (`ADD.workflows`) |
| `digital-workers.json` | Digital Workers, which ones the rail shows (`DW_SET`), the four checks (`CHECK_DW`) |
| `onboarding-presets.json` | Ready-made onboarding and offboarding steps, right-to-work rules, verification providers |
| `systems.json` | The 8 connected systems, actions, match keys, default field mappings |
| `history-records.json` | The 440 records “from the last 90 days” used for publish impact, overlaps and Nova counts |
| `runtime-records.json` | Part D and 05 §9 only: the BusinessRecords runs start from (dates, emails, worker time zone, prerequisite `states`). Not read by `loadSeed()` |
| `test-actors.json` | Users, permissions and owner teams for every layer: actor sets `default` and `author-only-approver`. Not read by `loadSeed()` |

Rules:

- **Load once, clone per test.** `loadSeed()` reads the nine files once; every test receives a deep clone (`structuredClone`). No test may see another test’s changes.
- **Engine reset:** `beforeEach` builds a fresh `EngineContext` (data model §0.1) from the clone: `{ catalog, people, rules, dws, presets, systems, workflows, samples, history, asOf: '2026-10-20', now: '2026-10-20T09:00:00Z', idGen: createIdGen(101), approverAvailability: { othersCanApprove: true } }` (`othersCanApprove` is false only for actor set `author-only-approver`).
- **UI reset:** every UI test starts from a freshly seeded app. Provide a test-only endpoint, enabled only when `LEVV_E2E=1`, `POST /api/test/reset`, that reloads all nine files into the store, clears runtime runs, and returns 204. Call it in `beforeEach` (body `{ actors: 'author-only-approver' }` only where a test says so), then `POST /api/test/sign-in` as **Flow Admin** (or the actor the test names; helper `signIn(name)`), then open `/flow-studio/wf-wo-sub` (UI §2.1; tests open workflows by URL or with the picker, never through `/flow-studio`’s remembered-workflow redirect, except UI-N1). Tests also run their own cleanup steps (written under **Cleanup**) so a failure report shows what changed, but correctness must never depend on cleanup because the reset runs first.
- **asOf and the clock.** Absences in the seed are “out until Oct 24” and “out until Oct 30” (normalised on load to 2026-10-24 / 2026-10-30, data model §15). The engine compares them with `ctx.asOf` (engine §0, D28): tests use **`asOf = '2026-10-20'`**, so Hannah Brooks and Kenji Watanabe are away (one test, in A.2b, uses 2026-10-25). In both layers also freeze “now” at **2026-10-20T09:00:00Z** (engine: `ctx.now = '2026-10-20T09:00:00Z'`; Playwright: `page.clock.setFixedTime(new Date('2026-10-20T09:00:00Z'))` before navigation, and the server reads `LEVV_FIXED_NOW`), so “today” for “Goes live on” is 2026-10-20. When a browser test needs a later server time (Part D), it calls `POST /api/test/clock` (01 §5.3), which also runs the scheduler tick; the engine layer simply sets `ctx.now` / `advanceClock`.
- **Actors.** All actors come from `seed/test-actors.json` (one file for every layer). The person using the UI is **Flow Admin** (`flow.edit`, `flow.approve_changes`, `runs.view`). Publishing is approved by another user with that permission (**Samira Khan**, `admin`); the author can never approve their own change (Part C). Part D uses Owen Clarke (owner team “Procurement operations”), Samira Khan (admin), Grace Kim and Raj Patel from the same file (5.1). Engine tests read the same file for `canApprove`, run permissions and `approverAvailability`.
- **Mock auto-completion.** The e2e app runs with `LEVV_MOCK_AUTOCOMPLETE=1` (05 §5.2): provider item requests are fulfilled at once and verifiers return the Test result; tasks, approvals and reviews wait for a person. Runtime engine tests use the same mock behaviour.
- **Load normalisation.** Apply data model §15 on load in both layers: `version` 0 for never-published drafts, `mergeAt` on every If, Chaser defaults, and a generated “{Step} failed: escalation” step for every Collect & verify whose If it fails is Escalate (10 in the seed). Engine tests run on normalised data; the generated steps never appear in Test unless a step fails.
- **Viewport.** Playwright runs at **1440×900** unless a test says otherwise (UI-DD-09 uses 1440×600).
- **Generated ids are deterministic.** Every new id comes from the engine’s id generator (engine §16.0): one counter shared by workflow ids (`nf{n}`), step ids (`n{n}`) and added path/branch keys (`p{n}`, `b{n}`), starting at 101 in every fresh test context and reserving the ids already present in the graph being edited (and the workflow’s own id). So a new workflow is `nf101`, its first steps are `n102`, `n103`, and the next added path is `p104`, exactly as the A.3 graphs and A.4 expectations show. Each engine test builds its own context, so the counter never leaks between tests. UI tests never read ids.

### 1.3 Exact strings

Every expected string must match **exactly**. The only tolerance is typographic quote and apostrophe normalisation, applied to both sides before comparing:

```ts
export const norm = (s: string) =>
  s.replace(/[\u2018\u2019\u02BC]/g, "'").replace(/[\u201C\u201D]/g, '"');
expect(norm(actual)).toBe(norm(expected));
```

Nothing else is tolerated: not case, not punctuation, not a trailing full stop, not word order, not an extra space inside a sentence. Specifically:

- **How UI text is read.** Read `textContent`, collapse runs of whitespace to one space and trim. That is how text is extracted, not a tolerance.
- **Status labels are sentence case in the data and the DOM** (“Passed”, “Approval”, “Not asked again”). The Test panel draws them in capitals with CSS `text-transform: uppercase`, which is why the automated browser run’s output shows “PASSED”. Compare `textContent`, never `innerText`, for these labels.
- **Order matters** for path entries, step cards, people inside a round, notes inside a round, dropdown options and lint items, unless a test says “in any order”.
- **Icons are not part of strings.** The Test panel prefixes lines with icons (⚑, Σ, ✓, ·, 👁, ↑, ⏸, !). Expected strings in this file never include the icon unless it is written inside the quotes (for example the “✦ Set” button, the “▶ Test” button, the “+ Add a path” link).
- Money is formatted as in the prototype: `$120K`, `$1M`, `$250K`. Hours are `24h` inside sentences and plain numbers in inputs.

### 1.4 The engine contract the tests call

Part A calls one function, `runTest(input)` = `composeTest(simulateTest(workflow, record, ctx, options), ctx)` (engine §10–§11). The types are defined normatively in data model §12.1 (`TestRunResult`, `TestRunOptions`) and repeated here; shapes and strings are normative.

```ts
type TestRunInput = {
  workflow: Workflow;            // one entry from workflows.json, using workflow.draft.nodes (after any setup)
  record: SampleRecord;          // one entry from sample-records.json
  ctx: EngineContext;            // data model §0.1
  options?: {
    conflictChoice?: 'a' | 'b';  // ASN-920: which proposed change was chosen (“Use $96/h” = 'a', “Use $102/h” = 'b')
    applyEdit?: boolean;         // ASN-881: apply record.edit.set (“Try an edit: …”)
    asOf?: string;               // overrides ctx.asOf (default '2026-10-20')
  };
};

type TestRunResult = {
  summary: string | null;        // the sentence(s) at the top of Test. null = no summary box (workflows with no Approve, Auto-approve or Fits plan? step)
  inactiveNotice?: string;       // only when workflow.status === 'inactive'
  notices?: string[];            // Σ Comparing…, ✓ Using…, ⚑ Marked…, then “For real requests, “{winner}” runs for this record.” (D16), without icons
  conflict?: { badge: 'Conflict'; message: string; choices: string[] };
  editButton?: string;           // “Try an edit: …” or, once applied, “Undo the edit”
  undoButton?: 'Undo';           // shown after a conflict choice
  path: string;                  // every decision taken, in order, as “Step → Outcome”, joined with “ | ”. Empty string when nothing was decided
  fromApprovalRules?: Array<{ n: number; people: string; notes: string[]; tasks?: string[] }>;  // rule-only rounds (D5), shown above the steps
  removedByEdit?: string[];      // “Removed by the edit” lines (D7)
  steps: Array<{
    id: string;                  // node id in the workflow graph
    title: string;
    status: string;              // the status badge text, sentence case
    message: string;             // the line under the badge
    workerSees?: string;         // Collect & verify steps only: what the worker’s portal shows
    rounds?: Array<{ n: number; people: string; notes: string[] }>;  // approval rounds attached to this step
    tasks?: string[];            // rule-task lines under this step (D5): “Task: {title} · {Role} ({person}). Must be done before the request is approved”
  }>;
};
```

Formatting rules the expectations rely on:

- **Step order** is the order the engine reaches steps: breadth-first from Start, following each step’s exits in their stored order, taking only the exit chosen at an If, a check or Fits plan?, and all exits of a Parallel. Start, End, If and Parallel boxes are not listed as steps; their outcomes appear in `path`.
- **`people`** lists each person in the round as `Role (Person)` joined with “, ”. When the approver is a named person the entry is just the name (`Chloe Martin`), or `Name (Backup)` when the backup stands in. An approval group is `Group name (any one of A, B, C)` (D11). A paused seat is `Role (—)`. When the record carries decisions already made (`decided`, ASN-881), each entry is followed by `: {status}` (“Approved”, “Waiting”, “Stands”, “Asked again”, “New”; D7).
- **`notes`** are the reasons Levv gives for that round (self-approval moved up, merged roles, absence and delegation, split funding, paused seats), in the order the engine produced them, without icons.
- `rounds[].n` is the round number shown on the card. Every expectation in this file has one round per Approve step.

### 1.5 How UI tests address the screen

UI tests use only what a person can see: button text, field labels, headings, ARIA roles and accessible names. They never use prototype DOM ids, `data-*` attributes or CSS classes. The UI must therefore expose:

| Thing on screen | Accessible role and name the tests use |
| --- | --- |
| Top bar | `banner` containing the texts below |
| Workflow picker | `button` (`aria-haspopup="listbox"`) whose name is the open workflow’s name; it opens a `listbox` of workflows grouped by record · event, with “+ New workflow” in the footer |
| Canvas box | `button` named by the box title (for example “Business sign-off”). Boxes with no title use the step kind (“Approve”) |
| Add a step on a line | `button` named “Add a step here” |
| Step panel | `complementary` or `dialog` whose heading is the step kind (“Approve”, “If”, “Digital Worker”, “Collect & verify”, “Task”, “System”, “Wait”, “Workflow settings”) and whose sub-heading is the step name |
| Dropdown (every choice) | `button` with `aria-haspopup="listbox"`, labelled by the visible field label; its text is the current value or the placeholder. Opening it shows a `listbox` with a `textbox` named “Search” (placeholder “Search…”) and `option`s; multi-select lists set `aria-multiselectable="true"` |
| Active switch | `checkbox` or `switch` named “Active” |
| Top-bar buttons | `button` “Nova” (count badge = Fix before publishing + Check items), `button` “Test”, `button` “Publish” |
| Test panel | heading “Test” with the record title as sub-heading; under the label “Try a record” a `radiogroup` of `radio` rows (line 1 the record title, line 2 “{id} · {note}”); no pills |
| Close a panel | `button` named “Close” (shown as “×”) |
| Toast | `status` region |

Helper steps used throughout Part B (implement once in `tests/e2e/helpers.ts`):

- **signIn(name):** `POST /api/test/sign-in { user: name }`, then reload the page.
- **openWorkflow(name):** click the picker button, click the option whose first line is `name`.
- **openStep(title):** click the canvas box named `title`; the step panel opens.
- **openTest(recordTitle):** click “Test” (if the Test panel is not open), then click the `radio` row whose first line is `recordTitle` in the “Try a record” list.
- **choose(fieldLabel, optionText):** click the dropdown labelled `fieldLabel`, type nothing, click the option `optionText`.
- **searchPick(fieldLabel, query):** click the dropdown, type `query` into Search, press Enter.
- **openAdvanced():** expand the “Advanced” section of the open panel.
- **testCard(title):** the step card in the Test panel whose title is `title`; exposes status, message, “Worker sees” line and round lines.

When a Then says “the Test panel equals EN-xxx”, the UI test asserts, from the screen: the summary box text = `summary`; the notices; the path chips (one chip per entry, text `Step → Outcome`); and, for every step card in order, its title, status badge, message, “Worker sees: …” line and each round line `n · people · notes joined with “; ”`. That keeps the UI test exactly as strict as the engine test, without repeating the JSON.

### 1.6 Setup mutations

Variations (Part A.2) start from the seed and change the workflow’s data before running Test. A setup is applied to `workflow.draft.nodes` like this:

```ts
type Setup = {
  remove?: string[];                         // node ids to delete
  add?: Record<string, Node>;                // nodes to add (whole node)
  patch?: Record<string, Record<string, unknown | null>>;  // shallow per-field replace; null deletes the field
  workflow?: Partial<Workflow>;              // workflow-level fields, e.g. { status: 'inactive' }
};
function applySetup(wf: Workflow, s: Setup) {
  s.remove?.forEach(id => delete wf.draft.nodes[id]);
  Object.entries(s.add ?? {}).forEach(([id, n]) => (wf.draft.nodes[id] = structuredClone(n)));
  Object.entries(s.patch ?? {}).forEach(([id, p]) =>
    Object.entries(p).forEach(([k, v]) => (v === null ? delete (wf.draft.nodes[id] as any)[k] : ((wf.draft.nodes[id] as any)[k] = structuredClone(v)))));
  Object.assign(wf, s.workflow ?? {});
}
```

Each setup is exactly what the prototype’s editor wrote when the script’s UI action was performed, so Part A.4 can also assert that the editor operation produces this data. Approver references in `roles` use `g:<groupId>` for an approval group (`g:fin_ctrl` = Finance controllers) and `p:<Person name>` for a named person (`p:Chloe Martin`); everything else is a role key from `people-and-authority.json`.

### 1.7 Markers used in this file

- **DEVIATION** — production differs from prototype v35, either because the prototype is wrong or because of a later decision (engine §20 D-number, UI §16 item or final decision (00 §3)). The test states the production behaviour, says what the prototype does, and Appendix 7.2 lists it.
- **NEW IN PRODUCTION — NO PROTOTYPE ORACLE** — behaviour that does not exist in the prototype (Part D). Expected strings there are the proposed product copy and become the oracle once this file is accepted.

## 2. Part A — Engine tests

Pure functions, no UI. Each test: build the context from the seed (1.2), apply the setup (1.6), call `runTest`, and compare the whole result with the expected JSON using the string rule in 1.3. Properties not listed in an expectation must be absent (`notices`, `conflict`, `inactiveNotice`, `workerSees`, `rounds`).

### A.1 Every sample record through its workflow (seed as loaded, no setup)

These are the worked examples: each of the 15 workflows with every sample record that fits its trigger (same record type and event). “UK Technology work orders” and “Data and AI hires” are tested with all 7 submitted work orders, because Test lets you try any fitting record even when Applies to would not pick that workflow for it. Two records in the seed fit no workflow and have no test: **OB-2251** (Onboarding · Check failed) and **ASN-915** (Assignment · Ended early); see Appendix item 15.

| Test | Workflow (id) | Record | Script | What it shows |
| --- | --- | --- | --- | --- |
| EN-001 | Contractor onboarding (`wf-onboard`) | `WO-2214-A` Senior cloud engineer | W1 | Standard onboarding |
| EN-002 | Contractor onboarding (`wf-onboard`) | `WO-2240-A` Data engineer, trading data | — | Regulated role: Registration required? → Yes |
| EN-003 | Contractor onboarding (`wf-onboard`) | `WO-2251-A` Analyst, checks need attention | W2 | Identity unsure, background check failed |
| EN-004 | Assignment ending (`wf-ending`) | `ASN-902` Cloud engineer, ending Nov 16 | W4 (end) | End: Extending? → No |
| EN-005 | Assignment ending (`wf-ending`) | `ASN-907` Designer, manager extends | W4 (extend) | Extend, approved automatically inside plan |
| EN-006 | Assignment changed (`wf-asn-chg`) | `ASN-881` Data analyst extension and rate rise | A9, A10 | Conditional approver, absence and delegation |
| EN-007 | Assignment changed (`wf-asn-chg`) | `ASN-920` Analyst rate change, two proposals | A17 | Two conflicting proposals |
| EN-008 | Contractor offboarding (`wf-offboard`) | `OFF-902` Cloud engineer, not extended | W3 | Normal end |
| EN-009 | Contractor offboarding (`wf-offboard`) | `OFF-915` Data analyst, ended early (ended early) | — | Early end |
| EN-010 | Site access request (`wf-access`) | `AR-301` Visiting engineer, 2 weeks on site | W8 | Clean access request |
| EN-011 | Site access request (`wf-access`) | `AR-305` Returning vendor technician | W9 | Already badged: flagged and escalated |
| EN-012 | Document renewal (`wf-doc`) | `WK-330` Forklift certificate expiring | W6 | Renewal from the worker |
| EN-013 | Invoice received (`wf-invoice`) | `INV-8812` Invoice doesn’t match timesheets | W5 (mismatch) | Exception task |
| EN-014 | Invoice received (`wf-invoice`) | `INV-8813` Invoice matches | W5 (match) | Straight-through |
| EN-015 | Work order submitted (`wf-wo-sub`) | `WO-2214` Senior cloud engineer | — | Rules added, self-approval moves up, backup for Information Security |
| EN-016 | Work order submitted (`wf-wo-sub`) | `WO-2240` Data engineer, trading data | — | Duplicate flagged and escalated, regulated role |
| EN-017 | Work order submitted (`wf-wo-sub`) | `WO-2231` Operations analyst | N5, A6, A7, A8 (baseline) | Canada; requester is also an approver |
| EN-018 | Work order submitted (`wf-wo-sub`) | `WO-2260` Cleared engineer, project Atlas | — | Custom fields |
| EN-019 | Work order submitted (`wf-wo-sub`) | `WO-2270` Data platform engineer, Germany | Known demo item | Nobody eligible for Privacy in Germany: paused |
| EN-020 | Work order submitted (`wf-wo-sub`) | `WO-2275` Analytics lead, split funding | A12 | Split funding: one cost center owner per cost center |
| EN-021 | Work order submitted (`wf-wo-sub`) | `WO-2280` Ops contractor, no rate card yet | A13 | Missing information |
| EN-022 | UK Technology work orders (`wf-wo-sub-wo-uk-tech`) | `WO-2214` Senior cloud engineer | A1, A2, A3, A11 | The variation runs; rules added; no self-approval; one person asked once; ineligible delegate |
| EN-023 | UK Technology work orders (`wf-wo-sub-wo-uk-tech`) | `WO-2240` Data engineer, trading data | A4 (and A5 baseline) | Flagged check escalates first |
| EN-024 | UK Technology work orders (`wf-wo-sub-wo-uk-tech`) | `WO-2231` Operations analyst | — |  |
| EN-025 | UK Technology work orders (`wf-wo-sub-wo-uk-tech`) | `WO-2260` Cleared engineer, project Atlas | — |  |
| EN-026 | UK Technology work orders (`wf-wo-sub-wo-uk-tech`) | `WO-2270` Data platform engineer, Germany | — | Paused Privacy seat |
| EN-027 | UK Technology work orders (`wf-wo-sub-wo-uk-tech`) | `WO-2275` Analytics lead, split funding | — | Split funding where one cost center owner is also the manager |
| EN-028 | UK Technology work orders (`wf-wo-sub-wo-uk-tech`) | `WO-2280` Ops contractor, no rate card yet | — | Missing information |
| EN-029 | Data and AI hires (`wf-wo-sub-wo-data`) | `WO-2214` Senior cloud engineer | P5 context | Draft variation; Data governance review covered by the rule’s Privacy seat |
| EN-030 | Data and AI hires (`wf-wo-sub-wo-data`) | `WO-2240` Data engineer, trading data | P5 context |  |
| EN-031 | Data and AI hires (`wf-wo-sub-wo-data`) | `WO-2231` Operations analyst | P5 context |  |
| EN-032 | Data and AI hires (`wf-wo-sub-wo-data`) | `WO-2260` Cleared engineer, project Atlas | P5 context |  |
| EN-033 | Data and AI hires (`wf-wo-sub-wo-data`) | `WO-2270` Data platform engineer, Germany | P5 context | Two paused Privacy seats |
| EN-034 | Data and AI hires (`wf-wo-sub-wo-data`) | `WO-2275` Analytics lead, split funding | P5 context |  |
| EN-035 | Data and AI hires (`wf-wo-sub-wo-data`) | `WO-2280` Ops contractor, no rate card yet | P5 context | No rate condition in this variation, so nothing is missing |
| EN-036 | Job posting created (`wf-jp`) | `JP-5120` Junior data analyst, 6 months (job posting) | A15 (and P2 baseline) | Inside the approved plan, approved automatically |
| EN-037 | SOW created (`wf-sow-sub`) | `SOW-77` Document review program | — | A new SOW by value. “Client data access” does not apply although `digital_worker_access` is true, because the seeded rule event is `submitted` and SOWs start on `created`; that is a data note, not an engine rule (engine §7.1, D2; final decision (00 §3) T12) |
| EN-038 | SOW change order submitted (`wf-sow-co`) | `SOW-77-CO1` Document review: new module | — | Change order: only what changed (running total $240K) |
| EN-039 | SOW change order submitted (`wf-sow-co`) | `SOW-77-CO3` Document review: third top-up | A14 | Running total; not asked again |
| EN-040 | Timesheet submitted (`wf-ts-sub`) | `TS-9934` Timesheet, week of Oct 12 | A16 | Approved automatically on matching hours |
| EN-041 | Work order changed (`wf-wo-chg`) | `WO-2214-C` Senior cloud engineer — rate change | W7 | A change approved by the workflow’s own Approve steps |

#### EN-001 · Contractor onboarding × WO-2214-A “Senior cloud engineer”

- Workflow `wf-onboard` · record `WO-2214-A` · script: W1 · Standard onboarding
- Setup: none

```json
{
  "summary": null,
  "path": "Registration required? → No",
  "steps": [
    {
      "id": "VI",
      "title": "Vendor insurance",
      "status": "Review: Procurement",
      "message": "Asked of Supplier account manager: Certificate of insurance. Waiting for Procurement (Owen Clarke)",
      "workerSees": "Waiting for review"
    },
    {
      "id": "LB",
      "title": "Laptop and badge",
      "status": "Review: IT service desk",
      "message": "Asked of IT service desk (Sam Patel): Laptop, Building badge. Waiting for IT service desk (Sam Patel)",
      "workerSees": "Waiting for review"
    },
    {
      "id": "LG",
      "title": "Legal & compliance",
      "status": "Verified automatically",
      "message": "Asked of the worker: Contractor agreement, Non-disclosure agreement, Code of conduct. Verified by E-signature",
      "workerSees": "Done"
    },
    {
      "id": "WD",
      "title": "Workday provisioning",
      "status": "Done in Workday",
      "message": "Create contingent worker in Workday, matched on Work email, 7 fields sent; reads back Workday worker ID; waits up to 24h for Workday to confirm; then checks it matches the ledger. Ledger: Workday account (remove access at exit)"
    },
    {
      "id": "ID",
      "title": "Identity & eligibility",
      "status": "Verified automatically",
      "message": "Asked of the worker: Photo ID, Right to work. Verified by Persona",
      "workerSees": "Done"
    },
    {
      "id": "BG",
      "title": "Background check",
      "status": "Verified automatically",
      "message": "Asked of the worker: Criminal record, Employment history. Verified by Checkr",
      "workerSees": "Done"
    },
    {
      "id": "SA",
      "title": "System access",
      "status": "Done in ServiceNow",
      "message": "Create access request in ServiceNow, matched on Work email, 4 fields sent; waits up to 24h for ServiceNow to confirm; then checks it matches the ledger. Done by the Access provisioner Digital Worker. Ledger: System access (remove access at exit)"
    },
    {
      "id": "W1",
      "title": "Wait for start date",
      "status": "Waits",
      "message": "Waits until Start date, 09:00 in the worker’s time zone"
    },
    {
      "id": "PB",
      "title": "Payroll & banking",
      "status": "Verified automatically",
      "message": "Asked of the worker: Bank details, Tax forms. Verified by Workday",
      "workerSees": "Done"
    }
  ]
}
```

#### EN-002 · Contractor onboarding × WO-2240-A “Data engineer, trading data”

- Workflow `wf-onboard` · record `WO-2240-A` · script: — · Regulated role: Registration required? → Yes
- Setup: none

```json
{
  "summary": null,
  "path": "Registration required? → Yes",
  "steps": [
    {
      "id": "VI",
      "title": "Vendor insurance",
      "status": "Review: Procurement",
      "message": "Asked of Supplier account manager: Certificate of insurance. Waiting for Procurement (Owen Clarke)",
      "workerSees": "Waiting for review"
    },
    {
      "id": "LB",
      "title": "Laptop and badge",
      "status": "Review: IT service desk",
      "message": "Asked of IT service desk (Sam Patel): Laptop, Building badge. Waiting for IT service desk (Sam Patel)",
      "workerSees": "Waiting for review"
    },
    {
      "id": "LG",
      "title": "Legal & compliance",
      "status": "Verified automatically",
      "message": "Asked of the worker: Contractor agreement, Non-disclosure agreement, Code of conduct. Verified by E-signature",
      "workerSees": "Done"
    },
    {
      "id": "WD",
      "title": "Workday provisioning",
      "status": "Done in Workday",
      "message": "Create contingent worker in Workday, matched on Work email, 7 fields sent; reads back Workday worker ID; waits up to 24h for Workday to confirm; then checks it matches the ledger. Ledger: Workday account (remove access at exit)"
    },
    {
      "id": "ID",
      "title": "Identity & eligibility",
      "status": "Verified automatically",
      "message": "Asked of the worker: Photo ID, Right to work. Verified by Persona",
      "workerSees": "Done"
    },
    {
      "id": "BG",
      "title": "Background check",
      "status": "Verified automatically",
      "message": "Asked of the worker: Criminal record, Employment history. Verified by Checkr",
      "workerSees": "Done"
    },
    {
      "id": "RG",
      "title": "Registration verified",
      "status": "Review: Compliance",
      "message": "Asked of the worker: Regulatory registration. Waiting for Compliance (Daniel Osei)",
      "workerSees": "Waiting for review"
    },
    {
      "id": "SA",
      "title": "System access",
      "status": "Waiting",
      "message": "Waiting on Registration verified"
    },
    {
      "id": "W1",
      "title": "Wait for start date",
      "status": "Waiting",
      "message": "Waiting on System access"
    },
    {
      "id": "PB",
      "title": "Payroll & banking",
      "status": "Waiting",
      "message": "Asked of the worker: Bank details, Tax forms. Waiting on Wait for start date",
      "workerSees": "Not started yet"
    }
  ]
}
```

#### EN-003 · Contractor onboarding × WO-2251-A “Analyst, checks need attention”

- Workflow `wf-onboard` · record `WO-2251-A` · script: W2 · Identity unsure, background check failed
- Setup: none
- **DEVIATION** (prototype output differs; engine spec §20): D4 — a step held up behind an If names the nearest real blocking step, not the If; D17 — a failed check keeps its “Asked of …” prefix.

```json
{
  "summary": null,
  "path": "Registration required? → No",
  "steps": [
    {
      "id": "VI",
      "title": "Vendor insurance",
      "status": "Review: Procurement",
      "message": "Asked of Supplier account manager: Certificate of insurance. Waiting for Procurement (Owen Clarke)",
      "workerSees": "Waiting for review"
    },
    {
      "id": "LB",
      "title": "Laptop and badge",
      "status": "Review: IT service desk",
      "message": "Asked of IT service desk (Sam Patel): Laptop, Building badge. Waiting for IT service desk (Sam Patel)",
      "workerSees": "Waiting for review"
    },
    {
      "id": "LG",
      "title": "Legal & compliance",
      "status": "Verified automatically",
      "message": "Asked of the worker: Contractor agreement, Non-disclosure agreement, Code of conduct. Verified by E-signature",
      "workerSees": "Done"
    },
    {
      "id": "WD",
      "title": "Workday provisioning",
      "status": "Done in Workday",
      "message": "Create contingent worker in Workday, matched on Work email, 7 fields sent; reads back Workday worker ID; waits up to 24h for Workday to confirm; then checks it matches the ledger. Ledger: Workday account (remove access at exit)"
    },
    {
      "id": "ID",
      "title": "Identity & eligibility",
      "status": "Unsure: People Ops",
      "message": "Asked of the worker: Photo ID, Right to work. Persona wasn't sure, so People Ops (Jordan Lee) reviews",
      "workerSees": "Waiting for review"
    },
    {
      "id": "BG",
      "title": "Background check",
      "status": "Failed: decision needed",
      "message": "Asked of the worker: Criminal record, Employment history. Failed. HR business partner and Legal must decide whether to carry on",
      "workerSees": "In progress",
      "rounds": [
        {
          "n": 1,
          "people": "HR business partner (Erin Walsh), Legal (Luis Romero)",
          "notes": [
            "Hannah Brooks is out until Oct 24. Delegated to Luis Romero"
          ]
        }
      ]
    },
    {
      "id": "SA",
      "title": "System access",
      "status": "Waiting",
      "message": "Waiting on Background check"
    },
    {
      "id": "W1",
      "title": "Wait for start date",
      "status": "Waiting",
      "message": "Waiting on System access"
    },
    {
      "id": "PB",
      "title": "Payroll & banking",
      "status": "Waiting",
      "message": "Asked of the worker: Bank details, Tax forms. Waiting on Wait for start date",
      "workerSees": "Not started yet"
    }
  ]
}
```

#### EN-004 · Assignment ending × ASN-902 “Cloud engineer, ending Nov 16”

- Workflow `wf-ending` · record `ASN-902` · script: W4 (end) · End: Extending? → No
- Setup: none

```json
{
  "summary": "No one needs to approve on this path.",
  "path": "Extending? → No",
  "steps": [
    {
      "id": "K1",
      "title": "Extend or end?",
      "status": "Done",
      "message": "Decide whether to extend: done by Hiring manager (Tom Reed)"
    },
    {
      "id": "NE",
      "title": "Confirm the end date",
      "status": "Sent",
      "message": "Email to Hiring manager (Tom Reed), Supplier account manager"
    }
  ]
}
```

#### EN-005 · Assignment ending × ASN-907 “Designer, manager extends”

- Workflow `wf-ending` · record `ASN-907` · script: W4 (extend) · Extend, approved automatically inside plan
- Setup: none

```json
{
  "summary": "No one needs to approve on this path. Approved automatically. No one had to act.",
  "path": "Extending? → Yes | Tenure & classification → Passed | Tenure over 18 months? → No | Within plan? → Inside plan | New total over $250K? → No | Rate changed? → No",
  "steps": [
    {
      "id": "K1",
      "title": "Extend or end?",
      "status": "Done",
      "message": "Decide whether to extend: done by Hiring manager (Sofia Reyes)"
    },
    {
      "id": "RA_CT",
      "title": "Tenure & classification",
      "status": "Passed",
      "message": "12 months engaged after this change (cap 18)"
    },
    {
      "id": "RA_PL",
      "title": "Within plan?",
      "status": "Inside the plan",
      "message": "Fits the budget Finance approved"
    },
    {
      "id": "RA_POL",
      "title": "Auto-approve if no one else needed",
      "status": "Approved automatically",
      "message": "Approved automatically: inside plan, no threshold crossed"
    }
  ]
}
```

#### EN-006 · Assignment changed × ASN-881 “Data analyst extension and rate rise”

- Workflow `wf-asn-chg` · record `ASN-881` · script: A9, A10 · Conditional approver, absence and delegation
- Setup: none
- **DEVIATION** (prototype output differs; engine spec §20): D7 — with approvals already decided, each round item shows its status (Approved, Waiting, Stands, Asked again, New) and the “Removed by the edit” lines.

```json
{
  "summary": "4 approval rounds on this path.",
  "editButton": "Try an edit: Manager shortens the extension to Mar 31",
  "path": "Tenure & classification → Flagged | Tenure over 18 months? → Yes | Within plan? → Outside plan | New total over $250K? → Yes | Rate changed? → Yes",
  "steps": [
    {
      "id": "RA_CT",
      "title": "Tenure & classification",
      "status": "Flagged",
      "message": "20 months engaged after this change (cap 18)"
    },
    {
      "id": "RA_A1",
      "title": "Tenure review",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "HR business partner (Erin Walsh): Approved, Legal (Luis Romero): Waiting",
          "notes": [
            "Hannah Brooks is out until Oct 24. Delegated to Luis Romero"
          ]
        }
      ]
    },
    {
      "id": "RA_PL",
      "title": "Within plan?",
      "status": "Outside the plan",
      "message": "Outside the approved budget, so it goes to an approver"
    },
    {
      "id": "RA_A2",
      "title": "Budget owner",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Cost center owner (Lena Fischer): Approved",
          "notes": []
        }
      ]
    },
    {
      "id": "RA_A3",
      "title": "Finance sign-off",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "VP Finance (David Okafor): Waiting",
          "notes": []
        }
      ]
    },
    {
      "id": "RA_A4",
      "title": "Rate review",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Procurement (Owen Clarke): Waiting",
          "notes": []
        }
      ]
    },
    {
      "id": "RA_POL",
      "title": "Auto-approve if no one else needed",
      "status": "Not used",
      "message": "Someone approves on this path, so it doesn’t auto-approve"
    },
    {
      "id": "NS",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ]
}
```

#### EN-007 · Assignment changed × ASN-920 “Analyst rate change, two proposals”

- Workflow `wf-asn-chg` · record `ASN-920` · script: A17 · Two conflicting proposals
- Setup: none

```json
{
  "summary": "Nothing is approved yet: approvals wait until one of the two proposed changes is chosen.",
  "conflict": {
    "badge": "Conflict",
    "message": "Two proposed changes to the bill rate: $96/h from Grace Kim and $102/h from Raj Patel. Nothing is overwritten; approvals wait until one version is chosen.",
    "choices": [
      "Use $96/h",
      "Use $102/h"
    ]
  },
  "path": "Tenure & classification → Passed | Tenure over 18 months? → No | Within plan? → Inside plan | New total over $250K? → No | Rate changed? → Yes",
  "steps": [
    {
      "id": "RA_CT",
      "title": "Tenure & classification",
      "status": "Passed",
      "message": "10 months engaged after this change (cap 18)"
    },
    {
      "id": "RA_PL",
      "title": "Within plan?",
      "status": "Inside the plan",
      "message": "Fits the budget Finance approved"
    },
    {
      "id": "RA_A4",
      "title": "Rate review",
      "status": "Not needed",
      "message": "Only needed when Bill rate change (%) > 5%"
    },
    {
      "id": "RA_POL",
      "title": "Auto-approve if no one else needed",
      "status": "Approved automatically",
      "message": "Approved automatically: inside plan, no threshold crossed"
    },
    {
      "id": "NS",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ]
}
```

#### EN-008 · Contractor offboarding × OFF-902 “Cloud engineer, not extended”

- Workflow `wf-offboard` · record `OFF-902` · script: W3 · Normal end
- Setup: none

```json
{
  "summary": null,
  "path": "",
  "steps": [
    {
      "id": "HO",
      "title": "Knowledge handover",
      "status": "To do: Hiring manager",
      "message": "Confirm handover is done: Hiring manager (Tom Reed)"
    },
    {
      "id": "FT",
      "title": "Final timesheet & expenses",
      "status": "Review: Hiring manager",
      "message": "Asked of the worker: Final timesheet, Final expenses. Waiting for Hiring manager (Tom Reed)",
      "workerSees": "Waiting for review"
    },
    {
      "id": "RE",
      "title": "Return equipment",
      "status": "To do: IT service desk",
      "message": "Collect laptop and badge: IT service desk (Sam Patel)"
    },
    {
      "id": "XC",
      "title": "Exit confirmations",
      "status": "Verified automatically",
      "message": "Asked of the worker: Confidentiality reminder acknowledged, Company data returned or deleted. Verified by E-signature",
      "workerSees": "Done"
    },
    {
      "id": "M1",
      "title": "Wait for the last day",
      "status": "Waiting",
      "message": "Waiting on Final timesheet & expenses, Return equipment"
    },
    {
      "id": "RV",
      "title": "Remove access",
      "status": "Waiting",
      "message": "Waiting on Wait for the last day"
    },
    {
      "id": "HC",
      "title": "Close in HR system",
      "status": "Waiting",
      "message": "Waiting on Remove access"
    },
    {
      "id": "LC",
      "title": "Ledger clear check",
      "status": "Waiting",
      "message": "Waiting on Close in HR system"
    },
    {
      "id": "WC",
      "title": "Close the work order",
      "status": "Waiting",
      "message": "Waiting on Ledger clear check"
    }
  ]
}
```

#### EN-009 · Contractor offboarding × OFF-915 “Data analyst, ended early (ended early)”

- Workflow `wf-offboard` · record `OFF-915` · script: — · Early end
- Setup: none

```json
{
  "summary": null,
  "path": "",
  "steps": [
    {
      "id": "HO",
      "title": "Knowledge handover",
      "status": "To do: Hiring manager",
      "message": "Confirm handover is done: Hiring manager (Omar Haddad)"
    },
    {
      "id": "FT",
      "title": "Final timesheet & expenses",
      "status": "Review: Hiring manager",
      "message": "Asked of the worker: Final timesheet, Final expenses. Waiting for Hiring manager (Omar Haddad)",
      "workerSees": "Waiting for review"
    },
    {
      "id": "RE",
      "title": "Return equipment",
      "status": "To do: IT service desk",
      "message": "Collect laptop and badge: IT service desk (Sam Patel)"
    },
    {
      "id": "XC",
      "title": "Exit confirmations",
      "status": "Verified automatically",
      "message": "Asked of the worker: Confidentiality reminder acknowledged, Company data returned or deleted. Verified by E-signature",
      "workerSees": "Done"
    },
    {
      "id": "M1",
      "title": "Wait for the last day",
      "status": "Waiting",
      "message": "Waiting on Final timesheet & expenses, Return equipment"
    },
    {
      "id": "RV",
      "title": "Remove access",
      "status": "Waiting",
      "message": "Waiting on Wait for the last day"
    },
    {
      "id": "HC",
      "title": "Close in HR system",
      "status": "Waiting",
      "message": "Waiting on Remove access"
    },
    {
      "id": "LC",
      "title": "Ledger clear check",
      "status": "Waiting",
      "message": "Waiting on Close in HR system"
    },
    {
      "id": "WC",
      "title": "Close the work order",
      "status": "Waiting",
      "message": "Waiting on Ledger clear check"
    }
  ]
}
```

#### EN-010 · Site access request × AR-301 “Visiting engineer, 2 weeks on site”

- Workflow `wf-access` · record `AR-301` · script: W8 · Clean access request
- Setup: none

```json
{
  "summary": "1 approval round on this path.",
  "path": "Duplicate & ghost worker → Passed",
  "steps": [
    {
      "id": "CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No active badge or open request for this person"
    },
    {
      "id": "AP_A1",
      "title": "Security approves access",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Information Security (Ravi Kumar)",
          "notes": [
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves"
          ]
        }
      ]
    },
    {
      "id": "ID",
      "title": "Identity & site details",
      "status": "Verified automatically",
      "message": "Asked of Worker (Jordan Ellis): Photo ID, Date of birth, Signed site safety rules. Verified by Persona",
      "workerSees": "Done"
    },
    {
      "id": "BG",
      "title": "Background check",
      "status": "Verified automatically",
      "message": "Asked of Worker (Jordan Ellis): Criminal record. Verified by Checkr",
      "workerSees": "Done"
    },
    {
      "id": "BD",
      "title": "Issue the badge",
      "status": "Done in Badge system",
      "message": "Create badge in Badge system, matched on Personal email, 7 fields sent; waits up to 24h for Badge system to confirm. Ledger: Site badge (remove access at exit)"
    },
    {
      "id": "NT",
      "title": "Badge ready",
      "status": "Sent",
      "message": "Email to Worker (Jordan Ellis), Sponsor (Grace Kim, or their delegate Raj Patel)"
    }
  ]
}
```

#### EN-011 · Site access request × AR-305 “Returning vendor technician”

- Workflow `wf-access` · record `AR-305` · script: W9 · Already badged: flagged and escalated
- Setup: none

```json
{
  "summary": "1 approval round on this path.",
  "path": "Duplicate & ghost worker → Flagged",
  "steps": [
    {
      "id": "CD",
      "title": "Duplicate & ghost worker",
      "status": "Flagged",
      "message": "This person already has an active badge from an earlier request"
    },
    {
      "id": "CDf",
      "title": "Duplicate & ghost worker flagged: escalation",
      "status": "Escalated",
      "message": "They must approve (it carries on), reject with a comment (it stops), or send it back to the requester. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Information Security (Ravi Kumar)",
          "notes": [
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves"
          ]
        }
      ]
    },
    {
      "id": "AP_A1",
      "title": "Security approves access",
      "status": "Covered",
      "message": "The same person already approves this kind of decision on this path"
    },
    {
      "id": "ID",
      "title": "Identity & site details",
      "status": "Verified automatically",
      "message": "Asked of Worker (Sam Rivera): Photo ID, Date of birth, Signed site safety rules. Verified by Persona",
      "workerSees": "Done"
    },
    {
      "id": "BG",
      "title": "Background check",
      "status": "Verified automatically",
      "message": "Asked of Worker (Sam Rivera): Criminal record. Verified by Checkr",
      "workerSees": "Done"
    },
    {
      "id": "BD",
      "title": "Issue the badge",
      "status": "Done in Badge system",
      "message": "Create badge in Badge system, matched on Personal email, 7 fields sent; waits up to 24h for Badge system to confirm. Ledger: Site badge (remove access at exit)"
    },
    {
      "id": "NT",
      "title": "Badge ready",
      "status": "Sent",
      "message": "Email to Worker (Sam Rivera), Sponsor (Tom Reed)"
    }
  ]
}
```

#### EN-012 · Document renewal × WK-330 “Forklift certificate expiring”

- Workflow `wf-doc` · record `WK-330` · script: W6 · Renewal from the worker
- Setup: none

```json
{
  "summary": null,
  "path": "",
  "steps": [
    {
      "id": "RN",
      "title": "Renewed document",
      "status": "Verified automatically",
      "message": "Asked of the worker: Updated certificate. Verified by Document collector",
      "workerSees": "Done"
    }
  ]
}
```

#### EN-013 · Invoice received × INV-8812 “Invoice doesn’t match timesheets”

- Workflow `wf-invoice` · record `INV-8812` · script: W5 (mismatch) · Exception task
- Setup: none

```json
{
  "summary": null,
  "path": "Matches? → No",
  "steps": [
    {
      "id": "DI",
      "title": "Match the invoice",
      "status": "Done",
      "message": "Matches each invoice line to approved time, expenses and milestones, and holds anything that doesn’t match."
    },
    {
      "id": "KX",
      "title": "Resolve exception",
      "status": "To do: Accounts payable",
      "message": "Resolve the invoice exception with the supplier: Accounts payable (Nina Shah)"
    }
  ]
}
```

#### EN-014 · Invoice received × INV-8813 “Invoice matches”

- Workflow `wf-invoice` · record `INV-8813` · script: W5 (match) · Straight-through
- Setup: none

```json
{
  "summary": null,
  "path": "Matches? → Yes",
  "steps": [
    {
      "id": "DI",
      "title": "Match the invoice",
      "status": "Done",
      "message": "Matches each invoice line to approved time, expenses and milestones, and holds anything that doesn’t match."
    },
    {
      "id": "PY",
      "title": "Release for payment",
      "status": "Done in SAP S/4HANA",
      "message": "Update supplier invoice in SAP S/4HANA, matched on Work order ID, 2 fields sent; reads back Posting status; waits up to 24h for SAP S/4HANA to confirm"
    }
  ]
}
```

#### EN-015 · Work order submitted × WO-2214 “Senior cloud engineer”

- Workflow `wf-wo-sub` · record `WO-2214` · script: — · Rules added, self-approval moves up, backup for Information Security
- Setup: none
- **DEVIATION** (prototype output differs; engine spec §20): D5 — rule tasks are shown under the step whose round they joined (the prototype never shows them in workflow Test); D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "3 approval rounds on this path. Approval rules add approvers: Client data access, UK off-payroll (IR35).",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Over 10% | Value band → Over $250K",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$120K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Tom Reed), Cost center owner (Alan Brooks), Information Security (Ravi Kumar), Privacy (Fatima Zahra)",
          "notes": [
            "Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK)",
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves"
          ]
        }
      ],
      "tasks": [
        "Task: Record IR35 status · Tax (Mei Lin). Must be done before the request is approved"
      ]
    },
    {
      "id": "RA_A2",
      "title": "Rate review",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Procurement (Owen Clarke)",
          "notes": []
        }
      ]
    },
    {
      "id": "RA_A3",
      "title": "Finance sign-off",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Finance business partner (Chloe Martin)",
          "notes": []
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ],
  "notices": [
    "For real requests, “UK Technology work orders” runs for this record."
  ]
}
```

#### EN-016 · Work order submitted × WO-2240 “Data engineer, trading data”

- Workflow `wf-wo-sub` · record `WO-2240` · script: — · Duplicate flagged and escalated, regulated role
- Setup: none
- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "2 approval rounds on this path. Approval rules add approvers: Client data access, Regulated roles.",
  "notices": [
    "Marked: Registration required (later steps can react to this)",
    "For real requests, “UK Technology work orders” runs for this record."
  ],
  "path": "Budget check → Passed | Duplicate & ghost worker → Flagged | Rate over card? → Otherwise | Value band → Otherwise",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$40K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Flagged",
      "message": "Same person is active through another supplier (WO-1877)"
    },
    {
      "id": "RA_CDe",
      "title": "Duplicate found: escalation",
      "status": "Escalated",
      "message": "They must approve (it carries on), reject with a comment (it stops), or send it back to the requester. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Procurement (Owen Clarke)",
          "notes": []
        }
      ]
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Priya Shah), Information Security (Ravi Kumar), Privacy (Fatima Zahra), Compliance (Daniel Osei)",
          "notes": [
            "Tom Reed raised this request, so the step moves up to Priya Shah (Head of Platform)",
            "Priya Shah also covers Cost center owner. Same kind of decision, so one approval",
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves"
          ]
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ]
}
```

#### EN-017 · Work order submitted × WO-2231 “Operations analyst”

- Workflow `wf-wo-sub` · record `WO-2231` · script: N5, A6, A7, A8 (baseline) · Canada; requester is also an approver
- Setup: none

```json
{
  "summary": "1 approval round on this path.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Otherwise | Value band → Otherwise",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$30K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Raj Patel)",
          "notes": [
            "Grace Kim raised this request, so the step moves up to Raj Patel (Operations Director)",
            "Raj Patel also covers Cost center owner. Same kind of decision, so one approval"
          ]
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ]
}
```

#### EN-018 · Work order submitted × WO-2260 “Cleared engineer, project Atlas”

- Workflow `wf-wo-sub` · record `WO-2260` · script: — · Custom fields
- Setup: none
- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "1 approval round on this path.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Otherwise | Value band → Otherwise",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$90K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Tom Reed), Cost center owner (Priya Shah)",
          "notes": []
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ],
  "notices": [
    "For real requests, “UK Technology work orders” runs for this record."
  ]
}
```

#### EN-019 · Work order submitted × WO-2270 “Data platform engineer, Germany”

- Workflow `wf-wo-sub` · record `WO-2270` · script: Known demo item · Nobody eligible for Privacy in Germany: paused
- Setup: none

```json
{
  "summary": "2 approval rounds on this path. Approval rules add approvers: Client data access. Part of the approval is paused: nobody eligible, so it waits until someone eligible is assigned.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Otherwise | Value band → Over $250K",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$80K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Paused",
      "message": "Nobody eligible right now, so it waits until someone is assigned. Nothing is approved automatically",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Tom Reed), Cost center owner (Priya Shah), Information Security (Ravi Kumar), Privacy (—)",
          "notes": [
            "Tom Reed is the hiring manager on the record (raised by Coordinator)",
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves",
            "Paused: no eligible Privacy reviewer for Germany. It waits until someone eligible is assigned (owner: Procurement operations). No one unqualified stands in"
          ]
        }
      ]
    },
    {
      "id": "RA_A3",
      "title": "Finance sign-off",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Finance business partner (Chloe Martin)",
          "notes": []
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ]
}
```

#### EN-020 · Work order submitted × WO-2275 “Analytics lead, split funding”

- Workflow `wf-wo-sub` · record `WO-2275` · script: A12 · Split funding: one cost center owner per cost center
- Setup: none

```json
{
  "summary": "3 approval rounds on this path.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Over 10% | Value band → Over $250K",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$60K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Omar Haddad), Cost center owner (Lena Fischer), Cost center owner (Alicia Ng)",
          "notes": [
            "Omar Haddad is the hiring manager on the record (raised by Coordinator)",
            "Charged to Finance, so its cost center owner approves",
            "Charged to Marketing, so its cost center owner approves"
          ]
        }
      ]
    },
    {
      "id": "RA_A2",
      "title": "Rate review",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Procurement (Owen Clarke)",
          "notes": []
        }
      ]
    },
    {
      "id": "RA_A3",
      "title": "Finance sign-off",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Finance business partner (Chloe Martin)",
          "notes": []
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ]
}
```

#### EN-021 · Work order submitted × WO-2280 “Ops contractor, no rate card yet”

- Workflow `wf-wo-sub` · record `WO-2280` · script: A13 · Missing information
- Setup: none

```json
{
  "summary": "1 approval round on this path. Needs information: Rate vs rate card (%) is missing, so “Rate over card?” can’t decide. Procurement (Owen Clarke) has been asked to fill it in.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Needs information",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$50K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Grace Kim), Cost center owner (Raj Patel)",
          "notes": [
            "Grace Kim is the hiring manager on the record (raised by Coordinator)"
          ]
        }
      ]
    }
  ]
}
```

#### EN-022 · UK Technology work orders × WO-2214 “Senior cloud engineer”

- Workflow `wf-wo-sub-wo-uk-tech` · record `WO-2214` · script: A1, A2, A3, A11 · The variation runs; rules added; no self-approval; one person asked once; ineligible delegate
- Setup: none
- **DEVIATION** (prototype output differs; engine spec §20): D5 — rule tasks are shown under the step whose round they joined (the prototype never shows them in workflow Test).

```json
{
  "summary": "3 approval rounds on this path. Approval rules add approvers: Client data access, UK off-payroll (IR35).",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Over 10% | Value band → Over $250K",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$120K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager's manager (Alan Brooks), Information Security (Ravi Kumar), Privacy (Fatima Zahra)",
          "notes": [
            "Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK)",
            "Alan Brooks also covers Cost center owner. Same kind of decision, so one approval",
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves"
          ]
        }
      ],
      "tasks": [
        "Task: Record IR35 status · Tax (Mei Lin). Must be done before the request is approved"
      ]
    },
    {
      "id": "RA_A2",
      "title": "Rate review",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Procurement (Owen Clarke)",
          "notes": []
        }
      ]
    },
    {
      "id": "RA_A4",
      "title": "Finance sign-off",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "VP Finance (David Okafor)",
          "notes": []
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ]
}
```

#### EN-023 · UK Technology work orders × WO-2240 “Data engineer, trading data”

- Workflow `wf-wo-sub-wo-uk-tech` · record `WO-2240` · script: A4 (and A5 baseline) · Flagged check escalates first
- Setup: none

```json
{
  "summary": "2 approval rounds on this path. Approval rules add approvers: Client data access, Regulated roles.",
  "notices": [
    "Marked: Registration required (later steps can react to this)"
  ],
  "path": "Budget check → Passed | Duplicate & ghost worker → Flagged | Rate over card? → Otherwise | Value band → Otherwise",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$40K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Flagged",
      "message": "Same person is active through another supplier (WO-1877)"
    },
    {
      "id": "RA_CDe",
      "title": "Duplicate found: escalation",
      "status": "Escalated",
      "message": "They must approve (it carries on), reject with a comment (it stops), or send it back to the requester. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Procurement (Owen Clarke)",
          "notes": []
        }
      ]
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager's manager (Priya Shah), Information Security (Ravi Kumar), Privacy (Fatima Zahra), Compliance (Daniel Osei)",
          "notes": [
            "Priya Shah also covers Cost center owner. Same kind of decision, so one approval",
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves"
          ]
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ]
}
```

#### EN-024 · UK Technology work orders × WO-2231 “Operations analyst”

- Workflow `wf-wo-sub-wo-uk-tech` · record `WO-2231` · script: —
- Setup: none
- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "1 approval round on this path.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Otherwise | Value band → Otherwise",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$30K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager's manager (Raj Patel)",
          "notes": [
            "Raj Patel also covers Cost center owner. Same kind of decision, so one approval"
          ]
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ],
  "notices": [
    "For real requests, “Work order submitted” runs for this record."
  ]
}
```

#### EN-025 · UK Technology work orders × WO-2260 “Cleared engineer, project Atlas”

- Workflow `wf-wo-sub-wo-uk-tech` · record `WO-2260` · script: —
- Setup: none

```json
{
  "summary": "1 approval round on this path.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Otherwise | Value band → Otherwise",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$90K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager's manager (Priya Shah)",
          "notes": [
            "Priya Shah also covers Cost center owner. Same kind of decision, so one approval"
          ]
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ]
}
```

#### EN-026 · UK Technology work orders × WO-2270 “Data platform engineer, Germany”

- Workflow `wf-wo-sub-wo-uk-tech` · record `WO-2270` · script: — · Paused Privacy seat
- Setup: none
- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "2 approval rounds on this path. Approval rules add approvers: Client data access. Part of the approval is paused: nobody eligible, so it waits until someone eligible is assigned.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Otherwise | Value band → Over $250K",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$80K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Paused",
      "message": "Nobody eligible right now, so it waits until someone is assigned. Nothing is approved automatically",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager's manager (Priya Shah), Information Security (Ravi Kumar), Privacy (—)",
          "notes": [
            "Priya Shah also covers Cost center owner. Same kind of decision, so one approval",
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves",
            "Paused: no eligible Privacy reviewer for Germany. It waits until someone eligible is assigned (owner: Procurement operations). No one unqualified stands in"
          ]
        }
      ]
    },
    {
      "id": "RA_A4",
      "title": "Finance sign-off",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "VP Finance (David Okafor)",
          "notes": []
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ],
  "notices": [
    "For real requests, “Work order submitted” runs for this record."
  ]
}
```

#### EN-027 · UK Technology work orders × WO-2275 “Analytics lead, split funding”

- Workflow `wf-wo-sub-wo-uk-tech` · record `WO-2275` · script: — · Split funding where one cost center owner is also the manager
- Setup: none
- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "3 approval rounds on this path.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Over 10% | Value band → Over $250K",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$60K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager's manager (Lena Fischer), Cost center owner (Alicia Ng)",
          "notes": [
            "Lena Fischer also covers Cost center owner. Same kind of decision, so one approval",
            "Charged to Marketing, so its cost center owner approves"
          ]
        }
      ]
    },
    {
      "id": "RA_A2",
      "title": "Rate review",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Procurement (Owen Clarke)",
          "notes": []
        }
      ]
    },
    {
      "id": "RA_A4",
      "title": "Finance sign-off",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "VP Finance (David Okafor)",
          "notes": []
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ],
  "notices": [
    "For real requests, “Work order submitted” runs for this record."
  ]
}
```

#### EN-028 · UK Technology work orders × WO-2280 “Ops contractor, no rate card yet”

- Workflow `wf-wo-sub-wo-uk-tech` · record `WO-2280` · script: — · Missing information
- Setup: none
- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "1 approval round on this path. Needs information: Rate vs rate card (%) is missing, so “Rate over card?” can’t decide. Procurement (Owen Clarke) has been asked to fill it in.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Needs information",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$50K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager's manager (Raj Patel)",
          "notes": [
            "Raj Patel also covers Cost center owner. Same kind of decision, so one approval"
          ]
        }
      ]
    }
  ],
  "notices": [
    "For real requests, “Work order submitted” runs for this record."
  ]
}
```

#### EN-029 · Data and AI hires × WO-2214 “Senior cloud engineer”

- Workflow `wf-wo-sub-wo-data` · record `WO-2214` · script: P5 context · Draft variation; Data governance review covered by the rule’s Privacy seat
- Setup: none
- **DEVIATION** (prototype output differs; engine spec §20): D5 — rule tasks are shown under the step whose round they joined (the prototype never shows them in workflow Test); D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "1 approval round on this path. Approval rules add approvers: Client data access, UK off-payroll (IR35).",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$120K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Tom Reed), Cost center owner (Alan Brooks), Information Security (Ravi Kumar), Privacy (Fatima Zahra)",
          "notes": [
            "Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK)",
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves"
          ]
        }
      ],
      "tasks": [
        "Task: Record IR35 status · Tax (Mei Lin). Must be done before the request is approved"
      ]
    },
    {
      "id": "RA_A2",
      "title": "Data governance review",
      "status": "Covered",
      "message": "The same person already approves this kind of decision on this path"
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ],
  "notices": [
    "For real requests, “UK Technology work orders” runs for this record."
  ]
}
```

#### EN-030 · Data and AI hires × WO-2240 “Data engineer, trading data”

- Workflow `wf-wo-sub-wo-data` · record `WO-2240` · script: P5 context
- Setup: none
- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "2 approval rounds on this path. Approval rules add approvers: Client data access, Regulated roles.",
  "notices": [
    "Marked: Registration required (later steps can react to this)",
    "For real requests, “UK Technology work orders” runs for this record."
  ],
  "path": "Budget check → Passed | Duplicate & ghost worker → Flagged",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$40K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Flagged",
      "message": "Same person is active through another supplier (WO-1877)"
    },
    {
      "id": "RA_CDe",
      "title": "Duplicate found: escalation",
      "status": "Escalated",
      "message": "They must approve (it carries on), reject with a comment (it stops), or send it back to the requester. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Procurement (Owen Clarke)",
          "notes": []
        }
      ]
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Priya Shah), Information Security (Ravi Kumar), Privacy (Fatima Zahra), Compliance (Daniel Osei)",
          "notes": [
            "Tom Reed raised this request, so the step moves up to Priya Shah (Head of Platform)",
            "Priya Shah also covers Cost center owner. Same kind of decision, so one approval",
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves"
          ]
        }
      ]
    },
    {
      "id": "RA_A2",
      "title": "Data governance review",
      "status": "Covered",
      "message": "The same person already approves this kind of decision on this path"
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ]
}
```

#### EN-031 · Data and AI hires × WO-2231 “Operations analyst”

- Workflow `wf-wo-sub-wo-data` · record `WO-2231` · script: P5 context
- Setup: none
- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "2 approval rounds on this path.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$30K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Raj Patel)",
          "notes": [
            "Grace Kim raised this request, so the step moves up to Raj Patel (Operations Director)",
            "Raj Patel also covers Cost center owner. Same kind of decision, so one approval"
          ]
        }
      ]
    },
    {
      "id": "RA_A2",
      "title": "Data governance review",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Privacy (Fatima Zahra)",
          "notes": []
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ],
  "notices": [
    "For real requests, “Work order submitted” runs for this record."
  ]
}
```

#### EN-032 · Data and AI hires × WO-2260 “Cleared engineer, project Atlas”

- Workflow `wf-wo-sub-wo-data` · record `WO-2260` · script: P5 context
- Setup: none
- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "2 approval rounds on this path.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$90K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Tom Reed), Cost center owner (Priya Shah)",
          "notes": []
        }
      ]
    },
    {
      "id": "RA_A2",
      "title": "Data governance review",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Privacy (Fatima Zahra)",
          "notes": []
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ],
  "notices": [
    "For real requests, “UK Technology work orders” runs for this record."
  ]
}
```

#### EN-033 · Data and AI hires × WO-2270 “Data platform engineer, Germany”

- Workflow `wf-wo-sub-wo-data` · record `WO-2270` · script: P5 context · Two paused Privacy seats
- Setup: none
- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "2 approval rounds on this path. Approval rules add approvers: Client data access. Part of the approval is paused: nobody eligible, so it waits until someone eligible is assigned.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$80K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Paused",
      "message": "Nobody eligible right now, so it waits until someone is assigned. Nothing is approved automatically",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Tom Reed), Cost center owner (Priya Shah), Information Security (Ravi Kumar), Privacy (—)",
          "notes": [
            "Tom Reed is the hiring manager on the record (raised by Coordinator)",
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves",
            "Paused: no eligible Privacy reviewer for Germany. It waits until someone eligible is assigned (owner: Procurement operations). No one unqualified stands in"
          ]
        }
      ]
    },
    {
      "id": "RA_A2",
      "title": "Data governance review",
      "status": "Paused",
      "message": "Nobody eligible right now, so it waits until someone is assigned. Nothing is approved automatically",
      "rounds": [
        {
          "n": 1,
          "people": "Privacy (—)",
          "notes": [
            "Paused: no eligible Privacy reviewer for Germany. It waits until someone eligible is assigned (owner: Procurement operations). No one unqualified stands in"
          ]
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ],
  "notices": [
    "For real requests, “Work order submitted” runs for this record."
  ]
}
```

#### EN-034 · Data and AI hires × WO-2275 “Analytics lead, split funding”

- Workflow `wf-wo-sub-wo-data` · record `WO-2275` · script: P5 context
- Setup: none
- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "2 approval rounds on this path.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$60K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Omar Haddad), Cost center owner (Lena Fischer), Cost center owner (Alicia Ng)",
          "notes": [
            "Omar Haddad is the hiring manager on the record (raised by Coordinator)",
            "Charged to Finance, so its cost center owner approves",
            "Charged to Marketing, so its cost center owner approves"
          ]
        }
      ]
    },
    {
      "id": "RA_A2",
      "title": "Data governance review",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Privacy (Fatima Zahra)",
          "notes": []
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ],
  "notices": [
    "For real requests, “Work order submitted” runs for this record."
  ]
}
```

#### EN-035 · Data and AI hires × WO-2280 “Ops contractor, no rate card yet”

- Workflow `wf-wo-sub-wo-data` · record `WO-2280` · script: P5 context · No rate condition in this variation, so nothing is missing
- Setup: none
- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "2 approval rounds on this path.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$50K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Grace Kim), Cost center owner (Raj Patel)",
          "notes": [
            "Grace Kim is the hiring manager on the record (raised by Coordinator)"
          ]
        }
      ]
    },
    {
      "id": "RA_A2",
      "title": "Data governance review",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Privacy (Fatima Zahra)",
          "notes": []
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ],
  "notices": [
    "For real requests, “Work order submitted” runs for this record."
  ]
}
```

#### EN-036 · Job posting created × JP-5120 “Junior data analyst, 6 months (job posting)”

- Workflow `wf-jp` · record `JP-5120` · script: A15 (and P2 baseline) · Inside the approved plan, approved automatically
- Setup: none

```json
{
  "summary": "No one needs to approve on this path. Approved automatically. No one had to act.",
  "path": "Within plan? → Inside plan",
  "steps": [
    {
      "id": "RA_PL",
      "title": "Within plan?",
      "status": "Inside the plan",
      "message": "Fits the budget Finance approved"
    },
    {
      "id": "RA_POL",
      "title": "Approve within plan",
      "status": "Approved automatically",
      "message": "Approved automatically: fits the approved plan"
    },
    {
      "id": "NA",
      "title": "Send to suppliers",
      "status": "Sent",
      "message": "Email to Procurement (Owen Clarke)"
    }
  ]
}
```

#### EN-037 · SOW created × SOW-77 “Document review program”

- Workflow `wf-sow-sub` · record `SOW-77` · script: — · A new SOW by value. “Client data access” does not apply although `digital_worker_access` is true, because the seeded rule event is `submitted` and SOWs start on `created`; that is a data note, not an engine rule (engine §7.1, D2; final decision (00 §3) T12)
- Setup: none

```json
{
  "summary": "3 approval rounds on this path.",
  "path": "Legal needed? → Yes | Value band → Over $250K",
  "steps": [
    {
      "id": "RA_A1",
      "title": "Procurement review",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Procurement (Owen Clarke)",
          "notes": []
        }
      ]
    },
    {
      "id": "RA_A2",
      "title": "Legal review",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Legal (Luis Romero)",
          "notes": [
            "Hannah Brooks is out until Oct 24. Delegated to Luis Romero"
          ]
        }
      ]
    },
    {
      "id": "RA_A3",
      "title": "Finance review",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Finance business partner (Chloe Martin)",
          "notes": []
        }
      ]
    },
    {
      "id": "NA",
      "title": "Tell the SOW owner it’s approved",
      "status": "Sent",
      "message": "Email to SOW owner (Grace Kim)"
    }
  ]
}
```

#### EN-038 · SOW change order submitted × SOW-77-CO1 “Document review: new module”

- Workflow `wf-sow-co` · record `SOW-77-CO1` · script: — · Change order: only what changed (running total $240K)
- Setup: none
- **DEVIATION.** This workflow compares the *running total of changes* (`basis: "running"` on the workflow). The prototype uses the running total to decide who approves but the *new total* to draw the path, so it shows “Value band → Over $1M” and marks “Finance and VP review” as **Covered** although nobody on the path covers it, while the summary still says “1 approval round on this path”. Production must use the same amount for both. Expected (the prototype’s own engine with the running total applied to the path):

```json
{
  "summary": "1 approval round on this path.",
  "notices": [
    "Comparing the running total of changes: $240K since the original $820K. This change alone is $240K"
  ],
  "path": "Scope changed? → Yes | Value band → Otherwise",
  "steps": [
    {
      "id": "RA_A1",
      "title": "Procurement review",
      "status": "Not asked again",
      "message": "Procurement: approved the original; nothing they depend on changed"
    },
    {
      "id": "RA_A2",
      "title": "Legal review",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Legal (Luis Romero)",
          "notes": [
            "Hannah Brooks is out until Oct 24. Delegated to Luis Romero"
          ]
        }
      ]
    },
    {
      "id": "NA",
      "title": "Tell the SOW owner it’s approved",
      "status": "Sent",
      "message": "Email to SOW owner (Grace Kim)"
    }
  ]
}
```

Prototype output, for reference only (do not assert): path `Scope changed? → Yes | Value band → Over $1M`; steps Procurement review [Not asked again] Procurement: approved the original; nothing they depend on changed; Legal review [Approval] If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h; Finance and VP review [Covered] The same person already approves this kind of decision on this path; Tell the SOW owner it’s approved [Sent] Email to SOW owner (Grace Kim).

#### EN-039 · SOW change order submitted × SOW-77-CO3 “Document review: third top-up”

- Workflow `wf-sow-co` · record `SOW-77-CO3` · script: A14 · Running total; not asked again
- Setup: none
- **DEVIATION.** This workflow compares the *running total of changes* (`basis: "running"` on the workflow). The prototype uses the running total to decide who approves but the *new total* to draw the path, so it shows “Value band → Over $1M” and marks “Finance and VP review” as **Covered** although nobody on the path covers it, while the summary still says “1 approval round on this path”. Production must use the same amount for both. Expected (the prototype’s own engine with the running total applied to the path):

```json
{
  "summary": "1 approval round on this path.",
  "notices": [
    "Comparing the running total of changes: $360K since the original $820K. This change alone is $60K"
  ],
  "path": "Scope changed? → No | Value band → Over $250K",
  "steps": [
    {
      "id": "RA_A1",
      "title": "Procurement review",
      "status": "Not asked again",
      "message": "Procurement: approved the original; nothing they depend on changed"
    },
    {
      "id": "RA_A3",
      "title": "Finance review",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Finance business partner (Chloe Martin)",
          "notes": []
        }
      ]
    },
    {
      "id": "NA",
      "title": "Tell the SOW owner it’s approved",
      "status": "Sent",
      "message": "Email to SOW owner (Grace Kim)"
    }
  ]
}
```

Prototype output, for reference only (do not assert): path `Scope changed? → No | Value band → Over $1M`; steps Procurement review [Not asked again] Procurement: approved the original; nothing they depend on changed; Finance and VP review [Covered] The same person already approves this kind of decision on this path; Tell the SOW owner it’s approved [Sent] Email to SOW owner (Grace Kim).

#### EN-040 · Timesheet submitted × TS-9934 “Timesheet, week of Oct 12”

- Workflow `wf-ts-sub` · record `TS-9934` · script: A16 · Approved automatically on matching hours
- Setup: none

```json
{
  "summary": "No one needs to approve on this path. Approved automatically. No one had to act.",
  "path": "Over schedule? → No",
  "steps": [
    {
      "id": "RA_POL",
      "title": "Approve scheduled hours",
      "status": "Approved automatically",
      "message": "Approved automatically: hours match the schedule and work order"
    },
    {
      "id": "NA",
      "title": "Tell the supplier it can invoice",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ]
}
```

#### EN-041 · Work order changed × WO-2214-C “Senior cloud engineer — rate change”

- Workflow `wf-wo-chg` · record `WO-2214-C` · script: W7 · A change approved by the workflow’s own Approve steps
- Setup: none

```json
{
  "summary": "1 approval round on this path.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Otherwise | Value band → Otherwise",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "No budget data on this record"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Tom Reed), Cost center owner (Alan Brooks)",
          "notes": [
            "Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK)"
          ]
        }
      ]
    },
    {
      "id": "NA",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ]
}
```

### A.2 Variations exercised by the scripts

Each test changes the seed workflow with the setup shown, then runs Test. The setup is the data the editor writes for the script’s UI action (Part A.4 tests the editor operations themselves).

#### EN-042 · A flagged check can reject (Duplicate & ghost worker → Reject)

- Workflow `wf-wo-sub-wo-uk-tech` (UK Technology work orders) · record `WO-2240` “Data engineer, trading data” · script: A5
- The Rejected end replaces the escalation box. Nobody is asked, including approvers that approval rules would add; the rules line and the “Marked: Registration required” line are not shown. “Levv tells Hiring manager” comes from the workflow’s `onReject.recipients` = `["hm"]`.
- Setup:

```json
{
  "remove": [
    "RA_CDe"
  ],
  "add": {
    "RA_CDf": {
      "id": "RA_CDf",
      "kind": "end",
      "label": "Rejected",
      "outcome": "rejected",
      "outs": []
    }
  },
  "patch": {
    "RA_CD": {
      "flagDo": "reject",
      "outs": [
        {
          "key": "flag",
          "to": "RA_CDf",
          "label": "Flagged"
        },
        {
          "key": "pass",
          "to": "RA_A1",
          "label": "Passed"
        }
      ],
      "flagNode": "RA_CDf"
    }
  }
}
```

- **DEVIATION** (prototype output differs; engine spec §20): D20 — the flags line is hidden when the request is rejected before anyone is asked.
- Expected:

```json
{
  "summary": "No one needs to approve on this path. Rejected at “Duplicate & ghost worker”. It goes back to the requester with the reason; Levv tells Hiring manager.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Flagged",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$40K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Flagged",
      "message": "Same person is active through another supplier (WO-1877)"
    }
  ]
}
```

#### EN-043 · Setting the flag back to Escalate re-creates the escalation box

- Workflow `wf-wo-sub-wo-uk-tech` (UK Technology work orders) · record `WO-2240` “Data engineer, trading data” · script: A5 cleanup
- Expected result equals the A4 result (EN-023) except the escalation box: it is re-created with the default name “Duplicate & ghost worker flagged: escalation” and id `RA_CDf`; the seed’s “Duplicate found: escalation” (`RA_CDe`) is not restored. This is the prototype’s behaviour and is accepted (Appendix item 4).
- Setup:

```json
{
  "remove": [
    "RA_CDe"
  ],
  "add": {
    "RA_CDf": {
      "id": "RA_CDf",
      "kind": "appr",
      "label": "Duplicate & ghost worker flagged: escalation",
      "outs": [
        {
          "key": "next",
          "to": "RA_A1"
        }
      ],
      "roles": [
        "proc"
      ],
      "mode": "all",
      "authority": false,
      "material": [],
      "reaskOnDecrease": true,
      "sla": 48,
      "reject": "requester",
      "prechecks": [
        "brief"
      ],
      "who": "roles",
      "escalation": true,
      "remind": 24
    }
  },
  "patch": {
    "RA_CD": {
      "flagDo": "escalate",
      "flagNode": "RA_CDf",
      "outs": [
        {
          "key": "flag",
          "to": "RA_CDf",
          "label": "Flagged"
        },
        {
          "key": "pass",
          "to": "RA_A1",
          "label": "Passed"
        }
      ]
    }
  }
}
```

- Expected:

```json
{
  "summary": "2 approval rounds on this path. Approval rules add approvers: Client data access, Regulated roles.",
  "notices": [
    "Marked: Registration required (later steps can react to this)"
  ],
  "path": "Budget check → Passed | Duplicate & ghost worker → Flagged | Rate over card? → Otherwise | Value band → Otherwise",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$40K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Flagged",
      "message": "Same person is active through another supplier (WO-1877)"
    },
    {
      "id": "RA_CDf",
      "title": "Duplicate & ghost worker flagged: escalation",
      "status": "Escalated",
      "message": "They must approve (it carries on), reject with a comment (it stops), or send it back to the requester. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Procurement (Owen Clarke)",
          "notes": []
        }
      ]
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager's manager (Priya Shah), Information Security (Ravi Kumar), Privacy (Fatima Zahra), Compliance (Daniel Osei)",
          "notes": [
            "Priya Shah also covers Cost center owner. Same kind of decision, so one approval",
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves"
          ]
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ]
}
```

#### EN-044 · If → Otherwise rejects

- Workflow `wf-wo-sub` (Work order submitted) · record `WO-2231` “Operations analyst” · script: A6
- The request is rejected at “Rate over card?” after Business sign-off has been asked. Rate review and Value band are never reached.
- Setup:

```json
{
  "add": {
    "RA_C1_else": {
      "id": "RA_C1_else",
      "kind": "end",
      "label": "Rejected",
      "outcome": "rejected",
      "outs": []
    }
  },
  "patch": {
    "RA_C1": {
      "outs": [
        {
          "key": "p1",
          "to": "RA_A2",
          "label": "Over 10%",
          "join": "all",
          "rows": [
            {
              "f": "rate_vs_card_pct",
              "op": ">",
              "v": 10
            }
          ]
        },
        {
          "key": "else",
          "to": "RA_C1_else",
          "label": "Otherwise"
        }
      ],
      "elseDo": "reject",
      "elseNode": "RA_C1_else",
      "elseWho": "cco",
      "mergeAt": "RA_C2"
    }
  }
}
```

- Expected:

```json
{
  "summary": "1 approval round on this path. Rejected at “Rate over card?”. It goes back to the requester with the reason; Levv tells Hiring manager.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Otherwise",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$30K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Raj Patel)",
          "notes": [
            "Grace Kim raised this request, so the step moves up to Raj Patel (Operations Director)",
            "Raj Patel also covers Cost center owner. Same kind of decision, so one approval"
          ]
        }
      ]
    }
  ]
}
```

#### EN-045 · If → Otherwise escalates to an approval group

- Workflow `wf-wo-sub` (Work order submitted) · record `WO-2231` “Operations analyst” · script: A7
- **DEVIATION from the human script and the automated browser run.** That run did A7 straight after A6 without reloading and inherited a prototype bug (see the round-trip test in A.4): its Otherwise line pointed at Rate review, so it reported “3 approval rounds” with Rate review after the escalation. From a fresh seed the Otherwise path continues to “Value band” (where the paths meet), so the correct result is 2 rounds and no Rate review.
- Setup:

```json
{
  "add": {
    "RA_C1_else": {
      "id": "RA_C1_else",
      "kind": "appr",
      "label": "Otherwise: escalation",
      "roles": [
        "g:fin_ctrl"
      ],
      "mode": "all",
      "authority": false,
      "material": [],
      "reaskOnDecrease": true,
      "sla": 48,
      "reject": "requester",
      "prechecks": [
        "brief"
      ],
      "who": "group",
      "escalation": true,
      "outs": [
        {
          "key": "next",
          "to": "RA_C2"
        }
      ],
      "remind": 24
    }
  },
  "patch": {
    "RA_C1": {
      "outs": [
        {
          "key": "p1",
          "to": "RA_A2",
          "label": "Over 10%",
          "join": "all",
          "rows": [
            {
              "f": "rate_vs_card_pct",
              "op": ">",
              "v": 10
            }
          ]
        },
        {
          "key": "else",
          "to": "RA_C1_else",
          "label": "Otherwise"
        }
      ],
      "elseDo": "escalate",
      "elseNode": "RA_C1_else",
      "elseWho": "g:fin_ctrl",
      "mergeAt": "RA_C2"
    }
  }
}
```

- **DEVIATION** (prototype output differs; engine spec §20): D11 — the group name is not repeated inside the brackets.
- Expected:

```json
{
  "summary": "2 approval rounds on this path.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Otherwise | Value band → Otherwise",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$30K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Raj Patel)",
          "notes": [
            "Grace Kim raised this request, so the step moves up to Raj Patel (Operations Director)",
            "Raj Patel also covers Cost center owner. Same kind of decision, so one approval"
          ]
        }
      ]
    },
    {
      "id": "RA_C1_else",
      "title": "Otherwise: escalation",
      "status": "Escalated",
      "message": "They must approve (it carries on), reject with a comment (it stops), or send it back to the requester. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Finance controllers (any one of Chloe Martin, Lena Fischer, David Okafor)",
          "notes": []
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ]
}
```

#### EN-046 · If → a path asks someone to approve (named person)

- Workflow `wf-wo-sub` (Work order submitted) · record `WO-2231` “Operations analyst” · script: A8
- **DEVIATION from the human script.** The script says “Chloe Martin, then Rate review”. That was the same artefact of the automated browser run as A7. From a fresh seed the approval on the Otherwise path carries on to “Value band”, then “Tell the supplier”.
- Setup:

```json
{
  "add": {
    "RA_C1_else": {
      "id": "RA_C1_else",
      "kind": "appr",
      "label": "Otherwise: approval",
      "roles": [
        "p:Chloe Martin"
      ],
      "mode": "all",
      "authority": false,
      "material": [],
      "reaskOnDecrease": true,
      "sla": 48,
      "reject": "requester",
      "prechecks": [
        "brief"
      ],
      "who": "person",
      "escalation": false,
      "outs": [
        {
          "key": "next",
          "to": "RA_C2"
        }
      ],
      "remind": 24
    }
  },
  "patch": {
    "RA_C1": {
      "outs": [
        {
          "key": "p1",
          "to": "RA_A2",
          "label": "Over 10%",
          "join": "all",
          "rows": [
            {
              "f": "rate_vs_card_pct",
              "op": ">",
              "v": 10
            }
          ]
        },
        {
          "key": "else",
          "to": "RA_C1_else",
          "label": "Otherwise"
        }
      ],
      "elseDo": "approve",
      "elseNode": "RA_C1_else",
      "elseWho": "p:Chloe Martin",
      "mergeAt": "RA_C2"
    }
  }
}
```

- Expected:

```json
{
  "summary": "2 approval rounds on this path.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Otherwise | Value band → Otherwise",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$30K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Raj Patel)",
          "notes": [
            "Grace Kim raised this request, so the step moves up to Raj Patel (Operations Director)",
            "Raj Patel also covers Cost center owner. Same kind of decision, so one approval"
          ]
        }
      ]
    },
    {
      "id": "RA_C1_else",
      "title": "Otherwise: approval",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Chloe Martin",
          "notes": []
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ]
}
```

#### EN-047 · Records that do not take Otherwise are unaffected by the A6 change

- Workflow `wf-wo-sub` · setup: the same as EN-044 · records `WO-2214`, `WO-2275`, `WO-2280`
- Expected: each result is identical to its seed result: `WO-2214` = EN-015, `WO-2275` = EN-020, `WO-2280` = EN-021 (Needs information stops at “Rate over card?” before any path is chosen).

#### EN-048 · Records that do not take Otherwise are unaffected by the A7 change

- Workflow `wf-wo-sub` · setup: the same as EN-045 · records `WO-2214`, `WO-2275`, `WO-2280`
- Expected: each result is identical to its seed result: `WO-2214` = EN-015, `WO-2275` = EN-020, `WO-2280` = EN-021 (Needs information stops at “Rate over card?” before any path is chosen).

#### EN-049 · Records that do not take Otherwise are unaffected by the A8 change

- Workflow `wf-wo-sub` · setup: the same as EN-046 · records `WO-2214`, `WO-2275`, `WO-2280`
- Expected: each result is identical to its seed result: `WO-2214` = EN-015, `WO-2275` = EN-020, `WO-2280` = EN-021 (Needs information stops at “Rate over card?” before any path is chosen).

#### EN-050 · Chaser override on an Approve step (Remind after 12)

- Workflow `wf-wo-sub` (Work order submitted) · record `WO-2231` “Operations analyst” · script: N5
- Only the Business sign-off message changes: “Chaser reminds after 12h …”.
- Setup:

```json
{
  "patch": {
    "RA_A1": {
      "remind": 12
    }
  }
}
```

- Expected:

```json
{
  "summary": "1 approval round on this path.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Otherwise | Value band → Otherwise",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$30K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 12h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Raj Patel)",
          "notes": [
            "Grace Kim raised this request, so the step moves up to Raj Patel (Operations Director)",
            "Raj Patel also covers Cost center owner. Same kind of decision, so one approval"
          ]
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ]
}
```

#### EN-051 · Chaser override of both numbers (remind 12, escalate after 72)

- Workflow `wf-wo-sub` (Work order submitted) · record `WO-2231` “Operations analyst” · script: N5 (extended)
- Setup:

```json
{
  "patch": {
    "RA_A1": {
      "remind": 12,
      "sla": 72
    }
  }
}
```

- Expected:

```json
{
  "summary": "1 approval round on this path.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Otherwise | Value band → Otherwise",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$30K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 12h and escalates to their manager after 72h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Raj Patel)",
          "notes": [
            "Grace Kim raised this request, so the step moves up to Raj Patel (Operations Director)",
            "Raj Patel also covers Cost center owner. Same kind of decision, so one approval"
          ]
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ]
}
```

#### EN-052 · Nova condition “rate is more than 15% over the rate card” on Rate review — record at 14%

- Workflow `wf-wo-sub` (Work order submitted) · record `WO-2214` “Senior cloud engineer” · script: A18
- `WO-2214` has `rate_vs_card_pct` 14, so Rate review is not needed. The Rate over card? path is still taken (14 > 10).
- Setup:

```json
{
  "patch": {
    "RA_A2": {
      "whenPrompt": "rate is more than 15% over the rate card",
      "when": {
        "join": "all",
        "rows": [
          {
            "f": "rate_vs_card_pct",
            "op": ">",
            "v": 15
          }
        ]
      }
    }
  }
}
```

- **DEVIATION** (prototype output differs; engine spec §20): D5 — rule tasks are shown under the step whose round they joined (the prototype never shows them in workflow Test); D16 — Test says which workflow real requests for this record would run.
- Expected:

```json
{
  "summary": "2 approval rounds on this path. Approval rules add approvers: Client data access, UK off-payroll (IR35).",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Over 10% | Value band → Over $250K",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$120K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Tom Reed), Cost center owner (Alan Brooks), Information Security (Ravi Kumar), Privacy (Fatima Zahra)",
          "notes": [
            "Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK)",
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves"
          ]
        }
      ],
      "tasks": [
        "Task: Record IR35 status · Tax (Mei Lin). Must be done before the request is approved"
      ]
    },
    {
      "id": "RA_A2",
      "title": "Rate review",
      "status": "Not needed",
      "message": "Only needed when Rate vs rate card (%) > 15%"
    },
    {
      "id": "RA_A3",
      "title": "Finance sign-off",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Finance business partner (Chloe Martin)",
          "notes": []
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ],
  "notices": [
    "For real requests, “UK Technology work orders” runs for this record."
  ]
}
```

#### EN-053 · Same condition — another record under 15%

- Workflow `wf-wo-sub` (Work order submitted) · record `WO-2275` “Analytics lead, split funding” · script: A18
- Setup:

```json
{
  "patch": {
    "RA_A2": {
      "whenPrompt": "rate is more than 15% over the rate card",
      "when": {
        "join": "all",
        "rows": [
          {
            "f": "rate_vs_card_pct",
            "op": ">",
            "v": 15
          }
        ]
      }
    }
  }
}
```

- Expected:

```json
{
  "summary": "2 approval rounds on this path.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Over 10% | Value band → Over $250K",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$60K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Omar Haddad), Cost center owner (Lena Fischer), Cost center owner (Alicia Ng)",
          "notes": [
            "Omar Haddad is the hiring manager on the record (raised by Coordinator)",
            "Charged to Finance, so its cost center owner approves",
            "Charged to Marketing, so its cost center owner approves"
          ]
        }
      ]
    },
    {
      "id": "RA_A2",
      "title": "Rate review",
      "status": "Not needed",
      "message": "Only needed when Rate vs rate card (%) > 15%"
    },
    {
      "id": "RA_A3",
      "title": "Finance sign-off",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Finance business partner (Chloe Martin)",
          "notes": []
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ]
}
```

#### EN-054 · Same condition — record that never reaches Rate review

- Workflow `wf-wo-sub` (Work order submitted) · record `WO-2231` “Operations analyst” · script: A18
- Result is identical to EN-017.
- Setup:

```json
{
  "patch": {
    "RA_A2": {
      "whenPrompt": "rate is more than 15% over the rate card",
      "when": {
        "join": "all",
        "rows": [
          {
            "f": "rate_vs_card_pct",
            "op": ">",
            "v": 15
          }
        ]
      }
    }
  }
}
```

- Expected:

```json
{
  "summary": "1 approval round on this path.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Otherwise | Value band → Otherwise",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$30K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Raj Patel)",
          "notes": [
            "Grace Kim raised this request, so the step moves up to Raj Patel (Operations Director)",
            "Raj Patel also covers Cost center owner. Same kind of decision, so one approval"
          ]
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ]
}
```

#### EN-055 · Rate review names Chloe Martin with no backup

- Workflow `wf-wo-sub` (Work order submitted) · record `WO-2214` “Senior cloud engineer” · script: A19
- Chloe Martin is also the Finance business partner on Finance sign-off, so that step is Covered. The lint warning for this setup is LP-06.
- Setup:

```json
{
  "patch": {
    "RA_A2": {
      "roles": [
        "p:Chloe Martin"
      ],
      "who": "person",
      "backup": ""
    }
  }
}
```

- **DEVIATION** (prototype output differs; engine spec §20): D5 — rule tasks are shown under the step whose round they joined (the prototype never shows them in workflow Test); D16 — Test says which workflow real requests for this record would run.
- Expected:

```json
{
  "summary": "2 approval rounds on this path. Approval rules add approvers: Client data access, UK off-payroll (IR35).",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Over 10% | Value band → Over $250K",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$120K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Tom Reed), Cost center owner (Alan Brooks), Information Security (Ravi Kumar), Privacy (Fatima Zahra)",
          "notes": [
            "Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK)",
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves"
          ]
        }
      ],
      "tasks": [
        "Task: Record IR35 status · Tax (Mei Lin). Must be done before the request is approved"
      ]
    },
    {
      "id": "RA_A2",
      "title": "Rate review",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Chloe Martin",
          "notes": [
            "Chloe Martin also covers Finance business partner (a later step). Same kind of decision, so one approval"
          ]
        }
      ]
    },
    {
      "id": "RA_A3",
      "title": "Finance sign-off",
      "status": "Covered",
      "message": "The same person already approves this kind of decision on this path"
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ],
  "notices": [
    "For real requests, “UK Technology work orders” runs for this record."
  ]
}
```

#### EN-056 · Sponsor provides Identity & site details (clean request)

- Workflow `wf-access` (Site access request) · record `AR-301` “Visiting engineer, 2 weeks on site” · script: W10
- Setup:

```json
{
  "patch": {
    "ID": {
      "from": "sponsor"
    }
  }
}
```

- Expected:

```json
{
  "summary": "1 approval round on this path.",
  "path": "Duplicate & ghost worker → Passed",
  "steps": [
    {
      "id": "CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No active badge or open request for this person"
    },
    {
      "id": "AP_A1",
      "title": "Security approves access",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Information Security (Ravi Kumar)",
          "notes": [
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves"
          ]
        }
      ]
    },
    {
      "id": "ID",
      "title": "Identity & site details",
      "status": "Verified automatically",
      "message": "Asked of Sponsor (Grace Kim, or their delegate Raj Patel): Photo ID, Date of birth, Signed site safety rules. Verified by Persona",
      "workerSees": "Done"
    },
    {
      "id": "BG",
      "title": "Background check",
      "status": "Verified automatically",
      "message": "Asked of Worker (Jordan Ellis): Criminal record. Verified by Checkr",
      "workerSees": "Done"
    },
    {
      "id": "BD",
      "title": "Issue the badge",
      "status": "Done in Badge system",
      "message": "Create badge in Badge system, matched on Personal email, 7 fields sent; waits up to 24h for Badge system to confirm. Ledger: Site badge (remove access at exit)"
    },
    {
      "id": "NT",
      "title": "Badge ready",
      "status": "Sent",
      "message": "Email to Worker (Jordan Ellis), Sponsor (Grace Kim, or their delegate Raj Patel)"
    }
  ]
}
```

#### EN-057 · Sponsor provides Identity & site details (record without a sponsor delegate)

- Workflow `wf-access` (Site access request) · record `AR-305` “Returning vendor technician” · script: W10 (extended)
- Setup:

```json
{
  "patch": {
    "ID": {
      "from": "sponsor"
    }
  }
}
```

- Expected:

```json
{
  "summary": "1 approval round on this path.",
  "path": "Duplicate & ghost worker → Flagged",
  "steps": [
    {
      "id": "CD",
      "title": "Duplicate & ghost worker",
      "status": "Flagged",
      "message": "This person already has an active badge from an earlier request"
    },
    {
      "id": "CDf",
      "title": "Duplicate & ghost worker flagged: escalation",
      "status": "Escalated",
      "message": "They must approve (it carries on), reject with a comment (it stops), or send it back to the requester. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Information Security (Ravi Kumar)",
          "notes": [
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves"
          ]
        }
      ]
    },
    {
      "id": "AP_A1",
      "title": "Security approves access",
      "status": "Covered",
      "message": "The same person already approves this kind of decision on this path"
    },
    {
      "id": "ID",
      "title": "Identity & site details",
      "status": "Verified automatically",
      "message": "Asked of Sponsor (Tom Reed): Photo ID, Date of birth, Signed site safety rules. Verified by Persona",
      "workerSees": "Done"
    },
    {
      "id": "BG",
      "title": "Background check",
      "status": "Verified automatically",
      "message": "Asked of Worker (Sam Rivera): Criminal record. Verified by Checkr",
      "workerSees": "Done"
    },
    {
      "id": "BD",
      "title": "Issue the badge",
      "status": "Done in Badge system",
      "message": "Create badge in Badge system, matched on Personal email, 7 fields sent; waits up to 24h for Badge system to confirm. Ledger: Site badge (remove access at exit)"
    },
    {
      "id": "NT",
      "title": "Badge ready",
      "status": "Sent",
      "message": "Email to Worker (Sam Rivera), Sponsor (Tom Reed)"
    }
  ]
}
```

#### EN-058 · Deleting Budget check keeps the line

- Workflow `wf-wo-sub` (Work order submitted) · record `WO-2231` “Operations analyst” · script: W13
- Start now connects straight to Duplicate & ghost worker; no other node changes.
- Setup:

```json
{
  "remove": [
    "RA_CB"
  ],
  "patch": {
    "T": {
      "outs": [
        {
          "key": "next",
          "to": "RA_CD"
        }
      ]
    }
  }
}
```

- Expected:

```json
{
  "summary": "1 approval round on this path.",
  "path": "Duplicate & ghost worker → Passed | Rate over card? → Otherwise | Value band → Otherwise",
  "steps": [
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Raj Patel)",
          "notes": [
            "Grace Kim raised this request, so the step moves up to Raj Patel (Operations Director)",
            "Raj Patel also covers Cost center owner. Same kind of decision, so one approval"
          ]
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ]
}
```

#### EN-059 · Test on an inactive workflow says so

- Workflow `wf-jp` (Job posting created) · record `JP-5120` “Junior data analyst, 6 months (job posting)” · script: P2
- Setup:

```json
{
  "workflow": {
    "status": "inactive"
  }
}
```

- Expected:

```json
{
  "summary": "No one needs to approve on this path. Approved automatically. No one had to act.",
  "inactiveNotice": "This workflow is inactive. Real requests don’t use it. Below is what it would do if you turned it back on.",
  "path": "Within plan? → Inside plan",
  "steps": [
    {
      "id": "RA_PL",
      "title": "Within plan?",
      "status": "Inside the plan",
      "message": "Fits the budget Finance approved"
    },
    {
      "id": "RA_POL",
      "title": "Approve within plan",
      "status": "Approved automatically",
      "message": "Approved automatically: fits the approved plan"
    },
    {
      "id": "NA",
      "title": "Send to suppliers",
      "status": "Sent",
      "message": "Email to Procurement (Owen Clarke)"
    }
  ]
}
```

#### EN-060 · Remove access with “take a Failed path” still runs the same for a normal end

- Workflow `wf-offboard` (Contractor offboarding) · record `OFF-902` “Cloud engineer, not extended” · script: W12
- The Failed exit is only taken when Okta reports a failure, which no sample record does, so the result equals EN-008.
- Setup:

```json
{
  "add": {
    "RVf": {
      "id": "RVf",
      "kind": "task",
      "label": "Fix the Okta error",
      "role": "people_ops",
      "title": "Fix what failed in Okta, then retry",
      "outs": [
        {
          "key": "next",
          "to": "HC"
        }
      ]
    }
  },
  "patch": {
    "RV": {
      "outs": [
        {
          "key": "next",
          "to": "HC",
          "label": "Done"
        },
        {
          "key": "failed",
          "to": "RVf",
          "label": "Failed"
        }
      ],
      "sys": {
        "system": "Okta",
        "action": "close",
        "object": "User",
        "match": "Work email",
        "map": [
          [
            "Worker name",
            "Display name"
          ],
          [
            "Work email",
            "Login"
          ],
          [
            "Job title",
            "Title"
          ],
          [
            "Hiring manager",
            "Manager"
          ],
          [
            "Business unit",
            "Department"
          ],
          [
            "End date",
            "Deactivate on"
          ]
        ],
        "read": [],
        "wait": "confirm",
        "waitH": 24,
        "state": "Completed",
        "onFail": "path",
        "failRole": "people_ops",
        "retries": 3,
        "check": true
      }
    }
  }
}
```

- Expected:

```json
{
  "summary": null,
  "path": "",
  "steps": [
    {
      "id": "HO",
      "title": "Knowledge handover",
      "status": "To do: Hiring manager",
      "message": "Confirm handover is done: Hiring manager (Tom Reed)"
    },
    {
      "id": "FT",
      "title": "Final timesheet & expenses",
      "status": "Review: Hiring manager",
      "message": "Asked of the worker: Final timesheet, Final expenses. Waiting for Hiring manager (Tom Reed)",
      "workerSees": "Waiting for review"
    },
    {
      "id": "RE",
      "title": "Return equipment",
      "status": "To do: IT service desk",
      "message": "Collect laptop and badge: IT service desk (Sam Patel)"
    },
    {
      "id": "XC",
      "title": "Exit confirmations",
      "status": "Verified automatically",
      "message": "Asked of the worker: Confidentiality reminder acknowledged, Company data returned or deleted. Verified by E-signature",
      "workerSees": "Done"
    },
    {
      "id": "M1",
      "title": "Wait for the last day",
      "status": "Waiting",
      "message": "Waiting on Final timesheet & expenses, Return equipment"
    },
    {
      "id": "RV",
      "title": "Remove access",
      "status": "Waiting",
      "message": "Waiting on Wait for the last day"
    },
    {
      "id": "HC",
      "title": "Close in HR system",
      "status": "Waiting",
      "message": "Waiting on Remove access"
    },
    {
      "id": "LC",
      "title": "Ledger clear check",
      "status": "Waiting",
      "message": "Waiting on Close in HR system"
    },
    {
      "id": "WC",
      "title": "Close the work order",
      "status": "Waiting",
      "message": "Waiting on Ledger clear check"
    }
  ]
}
```

#### EN-061 · Two proposals: “Use $96/h” chosen

- Workflow `wf-asn-chg` (Assignment changed) · record `ASN-920` “Analyst rate change, two proposals” · script: A17
- Options: `{"conflictChoice": "a"}`
- Expected:

```json
{
  "summary": "No one needs to approve on this path. Approved automatically. No one had to act.",
  "undoButton": "Undo",
  "notices": [
    "Using $96/h from Grace Kim. Raj Patel has been told, and approval links for the other version no longer work."
  ],
  "path": "Tenure & classification → Passed | Tenure over 18 months? → No | Within plan? → Inside plan | New total over $250K? → No | Rate changed? → Yes",
  "steps": [
    {
      "id": "RA_CT",
      "title": "Tenure & classification",
      "status": "Passed",
      "message": "10 months engaged after this change (cap 18)"
    },
    {
      "id": "RA_PL",
      "title": "Within plan?",
      "status": "Inside the plan",
      "message": "Fits the budget Finance approved"
    },
    {
      "id": "RA_A4",
      "title": "Rate review",
      "status": "Not needed",
      "message": "Only needed when Bill rate change (%) > 5%"
    },
    {
      "id": "RA_POL",
      "title": "Auto-approve if no one else needed",
      "status": "Approved automatically",
      "message": "Approved automatically: inside plan, no threshold crossed"
    },
    {
      "id": "NS",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ]
}
```

#### EN-062 · Two proposals: “Use $102/h” chosen

- Workflow `wf-asn-chg` (Assignment changed) · record `ASN-920` “Analyst rate change, two proposals” · script: A17
- Options: `{"conflictChoice": "b"}`
- Expected:

```json
{
  "summary": "No one needs to approve on this path. Approved automatically. No one had to act.",
  "undoButton": "Undo",
  "notices": [
    "Using $102/h from Raj Patel. Grace Kim has been told, and approval links for the other version no longer work."
  ],
  "path": "Tenure & classification → Passed | Tenure over 18 months? → No | Within plan? → Inside plan | New total over $250K? → No | Rate changed? → Yes",
  "steps": [
    {
      "id": "RA_CT",
      "title": "Tenure & classification",
      "status": "Passed",
      "message": "10 months engaged after this change (cap 18)"
    },
    {
      "id": "RA_PL",
      "title": "Within plan?",
      "status": "Inside the plan",
      "message": "Fits the budget Finance approved"
    },
    {
      "id": "RA_A4",
      "title": "Rate review",
      "status": "Not needed",
      "message": "Only needed when Bill rate change (%) > 5%"
    },
    {
      "id": "RA_POL",
      "title": "Auto-approve if no one else needed",
      "status": "Approved automatically",
      "message": "Approved automatically: inside plan, no threshold crossed"
    },
    {
      "id": "NS",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ]
}
```

#### EN-063 · Try an edit: Manager shortens the extension to Mar 31

- Workflow `wf-asn-chg` (Assignment changed) · record `ASN-881` “Data analyst extension and rate rise” · script: A9 (extended)
- Applies `record.edit.set` from the seed. Months engaged drop to 17, so Tenure review is no longer needed and is not listed.
- Options: `{"applyEdit": true}`
- **DEVIATION** (prototype output differs; engine spec §20): D7 — with approvals already decided, each round item shows its status (Approved, Waiting, Stands, Asked again, New) and the “Removed by the edit” lines.
- Expected:

```json
{
  "summary": "3 approval rounds on this path.",
  "editButton": "Undo the edit",
  "path": "Tenure & classification → Passed | Tenure over 18 months? → No | Within plan? → Outside plan | New total over $250K? → Yes | Rate changed? → Yes",
  "steps": [
    {
      "id": "RA_CT",
      "title": "Tenure & classification",
      "status": "Passed",
      "message": "17 months engaged after this change (cap 18)"
    },
    {
      "id": "RA_PL",
      "title": "Within plan?",
      "status": "Outside the plan",
      "message": "Outside the approved budget, so it goes to an approver"
    },
    {
      "id": "RA_A2",
      "title": "Budget owner",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Cost center owner (Lena Fischer): Stands",
          "notes": []
        }
      ]
    },
    {
      "id": "RA_A3",
      "title": "Finance sign-off",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "VP Finance (David Okafor): Waiting",
          "notes": []
        }
      ]
    },
    {
      "id": "RA_A4",
      "title": "Rate review",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Procurement (Owen Clarke): Waiting",
          "notes": []
        }
      ]
    },
    {
      "id": "RA_POL",
      "title": "Auto-approve if no one else needed",
      "status": "Not used",
      "message": "Someone approves on this path, so it doesn’t auto-approve"
    },
    {
      "id": "NS",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ],
  "removedByEdit": [
    "HR business partner: approved, no longer needed",
    "Legal: withdrawn, approver told"
  ]
}
```

### A.2b Production behaviour decided after the prototype (engine spec §20, final decisions (00 §3) T5, T10–T12)

The prototype cannot produce these results. Each expectation is derived from the prototype output of the nearest seed case (named) with only the change the spec requires, using the spec’s exact wording. Each is marked **DEVIATION**.

#### EN-064 · One escalation timer: the If path’s “Escalate after (hours)” is the generated step’s Chaser

- Script / decision: T5 / A7 (engine §15.6, §16.4, D31)
- **DEVIATION** — the hours box on the If path writes `RA_C1_else.sla`; there is no `elseSla`. Test shows the same number in the escalation’s Chaser line. Derived from EN-045.
- Setup:

```json
{
  "add": {
    "RA_C1_else": {
      "id": "RA_C1_else",
      "kind": "appr",
      "label": "Otherwise: escalation",
      "roles": [
        "g:fin_ctrl"
      ],
      "mode": "all",
      "authority": false,
      "material": [],
      "reaskOnDecrease": true,
      "sla": 72,
      "reject": "requester",
      "prechecks": [
        "brief"
      ],
      "who": "group",
      "escalation": true,
      "outs": [
        {
          "key": "next",
          "to": "RA_C2"
        }
      ],
      "remind": 24
    }
  },
  "patch": {
    "RA_C1": {
      "outs": [
        {
          "key": "p1",
          "to": "RA_A2",
          "label": "Over 10%",
          "join": "all",
          "rows": [
            {
              "f": "rate_vs_card_pct",
              "op": ">",
              "v": 10
            }
          ]
        },
        {
          "key": "else",
          "to": "RA_C1_else",
          "label": "Otherwise"
        }
      ],
      "elseDo": "escalate",
      "elseNode": "RA_C1_else",
      "elseWho": "g:fin_ctrl",
      "mergeAt": "RA_C2"
    }
  }
}
```

- Expected:

```json
{
  "summary": "2 approval rounds on this path.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Otherwise | Value band → Otherwise",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$30K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Raj Patel)",
          "notes": [
            "Grace Kim raised this request, so the step moves up to Raj Patel (Operations Director)",
            "Raj Patel also covers Cost center owner. Same kind of decision, so one approval"
          ]
        }
      ]
    },
    {
      "id": "RA_C1_else",
      "title": "Otherwise: escalation",
      "status": "Escalated",
      "message": "They must approve (it carries on), reject with a comment (it stops), or send it back to the requester. Chaser reminds after 24h and escalates to their manager after 72h",
      "rounds": [
        {
          "n": 1,
          "people": "Finance controllers (any one of Chloe Martin, Lena Fischer, David Okafor)",
          "notes": []
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ]
}
```

#### EN-065 · One escalation timer: the check’s “Escalate after (hours)” is the generated step’s Chaser

- Script / decision: T5 / A4 (engine §16.6, D31)
- **DEVIATION** — the check panel’s “Escalate after (hours)” writes `RA_CDe.sla` (no `flagSla`). Derived from EN-023.
- Setup:

```json
{
  "patch": {
    "RA_CDe": {
      "sla": 24,
      "remind": 12
    }
  }
}
```

- Expected:

```json
{
  "summary": "2 approval rounds on this path. Approval rules add approvers: Client data access, Regulated roles.",
  "notices": [
    "Marked: Registration required (later steps can react to this)"
  ],
  "path": "Budget check → Passed | Duplicate & ghost worker → Flagged | Rate over card? → Otherwise | Value band → Otherwise",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$40K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Flagged",
      "message": "Same person is active through another supplier (WO-1877)"
    },
    {
      "id": "RA_CDe",
      "title": "Duplicate found: escalation",
      "status": "Escalated",
      "message": "They must approve (it carries on), reject with a comment (it stops), or send it back to the requester. Chaser reminds after 12h and escalates to their manager after 24h",
      "rounds": [
        {
          "n": 1,
          "people": "Procurement (Owen Clarke)",
          "notes": []
        }
      ]
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager's manager (Priya Shah), Information Security (Ravi Kumar), Privacy (Fatima Zahra), Compliance (Daniel Osei)",
          "notes": [
            "Priya Shah also covers Cost center owner. Same kind of decision, so one approval",
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves"
          ]
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ]
}
```

#### EN-066 · A named person who is away is replaced by the step’s backup

- Script / decision: T10 (engine §6.7 B7, D8, D28)
- **DEVIATION** — the prototype ignores `backup` and uses the person’s own delegate. With `asOf = 2026-10-20` Hannah Brooks is away (until Oct 24), so the backup approves. Derived from EN-015; only Rate review changes.
- Setup:

```json
{
  "patch": {
    "RA_A2": {
      "roles": [
        "p:Hannah Brooks"
      ],
      "who": "person",
      "backup": "Lena Fischer"
    }
  }
}
```

- Expected:

```json
{
  "summary": "3 approval rounds on this path. Approval rules add approvers: Client data access, UK off-payroll (IR35).",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Over 10% | Value band → Over $250K",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$120K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Tom Reed), Cost center owner (Alan Brooks), Information Security (Ravi Kumar), Privacy (Fatima Zahra)",
          "notes": [
            "Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK)",
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves"
          ]
        }
      ],
      "tasks": [
        "Task: Record IR35 status · Tax (Mei Lin). Must be done before the request is approved"
      ]
    },
    {
      "id": "RA_A2",
      "title": "Rate review",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hannah Brooks (Lena Fischer)",
          "notes": [
            "Hannah Brooks is out until Oct 24, so Lena Fischer (backup) approves"
          ]
        }
      ]
    },
    {
      "id": "RA_A3",
      "title": "Finance sign-off",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Finance business partner (Chloe Martin)",
          "notes": []
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ],
  "notices": [
    "For real requests, “UK Technology work orders” runs for this record."
  ]
}
```

#### EN-067 · A named person who is away with no backup pauses the step

- Script / decision: T10 (engine §6.7 B7–B8, D8, D9)
- **DEVIATION** — paused, never approved automatically; the owner in the paused note is the workflow’s `owner` (“Procurement operations” for this workflow). Derived from EN-015. Lint also warns (LP-06).
- Setup:

```json
{
  "patch": {
    "RA_A2": {
      "roles": [
        "p:Hannah Brooks"
      ],
      "who": "person",
      "backup": ""
    }
  }
}
```

- Expected:

```json
{
  "summary": "3 approval rounds on this path. Approval rules add approvers: Client data access, UK off-payroll (IR35). Part of the approval is paused: nobody eligible, so it waits until someone eligible is assigned.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Over 10% | Value band → Over $250K",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$120K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Tom Reed), Cost center owner (Alan Brooks), Information Security (Ravi Kumar), Privacy (Fatima Zahra)",
          "notes": [
            "Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK)",
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves"
          ]
        }
      ],
      "tasks": [
        "Task: Record IR35 status · Tax (Mei Lin). Must be done before the request is approved"
      ]
    },
    {
      "id": "RA_A2",
      "title": "Rate review",
      "status": "Paused",
      "message": "Nobody eligible right now, so it waits until someone is assigned. Nothing is approved automatically",
      "rounds": [
        {
          "n": 1,
          "people": "Hannah Brooks (—)",
          "notes": [
            "Paused: Hannah Brooks is away and no backup is set. It waits until someone eligible is assigned (owner: Procurement operations). No one unqualified stands in"
          ]
        }
      ]
    },
    {
      "id": "RA_A3",
      "title": "Finance sign-off",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Finance business partner (Chloe Martin)",
          "notes": []
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ],
  "notices": [
    "For real requests, “UK Technology work orders” runs for this record."
  ]
}
```

#### EN-068 · Absences compare “until” with asOf: back on 25 Oct

- Script / decision: T10 / D28 (engine §6.7 B7)
- Workflow `wf-wo-sub` (Work order submitted) · record `WO-2214` “Senior cloud engineer” · derived from EN-015 and EN-067
- **DEVIATION** — the prototype treats every absence as current. Run with `ctx.asOf = "2026-10-25"`: Hannah Brooks (until 2026-10-24) is back, so she approves herself; Kenji Watanabe (until 2026-10-30) is still away, so the Information Security backup note stays. Same run of `SOW-77` on `wf-sow-sub` gives Legal review round `{"n":1,"people":"Legal (Hannah Brooks)","notes":[]}` instead of the delegation to Luis Romero.
- Setup:

```json
{
  "patch": {
    "RA_A2": {
      "roles": [
        "p:Hannah Brooks"
      ],
      "who": "person",
      "backup": ""
    }
  }
}
```

- Options: `{"asOf": "2026-10-25"}`
- Expected:

```json
{
  "summary": "3 approval rounds on this path. Approval rules add approvers: Client data access, UK off-payroll (IR35).",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Over 10% | Value band → Over $250K",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$120K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Tom Reed), Cost center owner (Alan Brooks), Information Security (Ravi Kumar), Privacy (Fatima Zahra)",
          "notes": [
            "Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK)",
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves"
          ]
        }
      ],
      "tasks": [
        "Task: Record IR35 status · Tax (Mei Lin). Must be done before the request is approved"
      ]
    },
    {
      "id": "RA_A2",
      "title": "Rate review",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hannah Brooks",
          "notes": []
        }
      ]
    },
    {
      "id": "RA_A3",
      "title": "Finance sign-off",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Finance business partner (Chloe Martin)",
          "notes": []
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ],
  "notices": [
    "For real requests, “UK Technology work orders” runs for this record."
  ]
}
```

#### EN-069 · “Stop the workflow and tell someone” on an If path ends the run stopped

- Script / decision: T11 / V11 (engine §16.4, D23)
- Workflow `wf-wo-sub` (Work order submitted) · record `WO-2231` “Operations analyst” · derived from EN-017 (UI-STOP-01 uses the same case)
- **DEVIATION** — the prototype sends the generated Notify to the normal End (Completed) and prints no Stopped sentence. Production adds an End with outcome `stopped`; the run status is `stopped`. Expected outcome of the run: `"stopped"`.
- Setup:

```json
{
  "add": {
    "RA_C1_else": {
      "id": "RA_C1_else",
      "kind": "notify",
      "label": "Otherwise: tell them it stopped",
      "recipients": [
        "hm"
      ],
      "channel": "Email",
      "outs": [
        {
          "key": "next",
          "to": "RA_C1_else_end"
        }
      ]
    },
    "RA_C1_else_end": {
      "id": "RA_C1_else_end",
      "kind": "end",
      "label": "Stopped",
      "outcome": "stopped",
      "outs": []
    }
  },
  "patch": {
    "RA_C1": {
      "outs": [
        {
          "key": "p1",
          "to": "RA_A2",
          "label": "Over 10%",
          "join": "all",
          "rows": [
            {
              "f": "rate_vs_card_pct",
              "op": ">",
              "v": 10
            }
          ]
        },
        {
          "key": "else",
          "to": "RA_C1_else",
          "label": "Otherwise"
        }
      ],
      "elseDo": "stop",
      "elseNode": "RA_C1_else",
      "elseWho": "hm",
      "mergeAt": "RA_C2"
    }
  }
}
```

- Expected:

```json
{
  "summary": "1 approval round on this path. Stopped at “Rate over card?”. Levv tells Hiring manager.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Otherwise",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$30K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Raj Patel)",
          "notes": [
            "Grace Kim raised this request, so the step moves up to Raj Patel (Operations Director)",
            "Raj Patel also covers Cost center owner. Same kind of decision, so one approval"
          ]
        }
      ]
    },
    {
      "id": "RA_C1_else",
      "title": "Otherwise: tell them it stopped",
      "status": "Sent",
      "message": "Email to Hiring manager (Grace Kim)"
    }
  ]
}
```

#### EN-070 · A check set to Stop ends the run stopped and asks no rule approvers

- Script / decision: T11 (engine §6.11, §16.6, D20, D23)
- Workflow `wf-wo-sub-wo-uk-tech` (UK Technology work orders) · record `WO-2240` “Data engineer, trading data” · derived from EN-023 (same graph as EN-042; no “For real requests …” notice because this variation is the one selected)
- **DEVIATION** — the prototype still keeps the approval-rule approvers as a round when a check stops the request. Production treats a stop like a rejection for rule rounds, the rules line and the flags line. (The generated End id is `RA_CDf_end`, the flag node id + `_end`, engine §16.0/§16.6.)
- Setup:

```json
{
  "remove": [
    "RA_CDe"
  ],
  "add": {
    "RA_CDf": {
      "id": "RA_CDf",
      "kind": "notify",
      "label": "Tell them it stopped",
      "recipients": [
        "proc"
      ],
      "channel": "Email",
      "outs": [
        {
          "key": "next",
          "to": "RA_CDf_end"
        }
      ]
    },
    "RA_CDf_end": {
      "id": "RA_CDf_end",
      "kind": "end",
      "label": "Stopped",
      "outcome": "stopped",
      "outs": []
    }
  },
  "patch": {
    "RA_CD": {
      "flagDo": "stop",
      "flagWho": "proc",
      "flagNode": "RA_CDf",
      "outs": [
        {
          "key": "flag",
          "to": "RA_CDf",
          "label": "Flagged"
        },
        {
          "key": "pass",
          "to": "RA_A1",
          "label": "Passed"
        }
      ]
    }
  }
}
```

- Expected:

```json
{
  "summary": "No one needs to approve on this path. Stopped at “Duplicate & ghost worker”. Levv tells Procurement.",
  "path": "Budget check → Passed | Duplicate & ghost worker → Flagged",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$40K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Flagged",
      "message": "Same person is active through another supplier (WO-1877)"
    },
    {
      "id": "RA_CDf",
      "title": "Tell them it stopped",
      "status": "Sent",
      "message": "Email to Procurement (Owen Clarke)"
    }
  ]
}
```

#### EN-071 · Approval rules apply to a workflow with no Approve step: “From approval rules”

- Script / decision: T12 (engine §6, §7.2–§7.3, §11 item 6, D5)
- **DEVIATION** — the prototype ignores rules on workflows without an Approve or Auto-approve step. Production plans whenever a rule matches; the rule-only round is shown in a block titled “From approval rules” above the step list (`fromApprovalRules`), with the IR35 task line under it.
- Workflow: the A.3 “New workflow” fields with this graph (`draft.nodes`): `{"T": {"id": "T", "kind": "trigger", "label": "", "outs": [{"key": "next", "to": "RW"}]}, "RW": {"id": "RW", "kind": "notify", "label": "Tell the supplier", "recipients": ["supplier_am"], "channel": "Email", "outs": [{"key": "next", "to": "END"}]}, "END": {"id": "END", "kind": "end", "label": "", "outcome": "completed", "outs": []}}`. Record `WO-2214`.
- Expected:

```json
{
  "summary": "1 approval round on this path. Approval rules add approvers: Client data access, UK off-payroll (IR35).",
  "notices": [
    "For real requests, “UK Technology work orders” runs for this record."
  ],
  "path": "",
  "fromApprovalRules": [
    {
      "n": 1,
      "people": "Information Security (Ravi Kumar), Privacy (Fatima Zahra)",
      "notes": [
        "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves"
      ],
      "tasks": [
        "Task: Record IR35 status · Tax (Mei Lin). Must be done before the request is approved"
      ]
    }
  ],
  "steps": [
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ]
}
```

#### EN-072 · Switching an Approve step to “An approval group” starts empty

- Script / decision: T4 (engine §16.11, D6)
- **DEVIATION** — the prototype silently picks the first group (Finance controllers). Production starts empty (“Choose a group”), Test shows “Choose who approves” and publish is blocked (L11). Derived from EN-015.
- Setup:

```json
{
  "patch": {
    "RA_A2": {
      "roles": [],
      "who": "group"
    }
  }
}
```

- Expected:

```json
{
  "summary": "2 approval rounds on this path. Approval rules add approvers: Client data access, UK off-payroll (IR35).",
  "path": "Budget check → Passed | Duplicate & ghost worker → Passed | Rate over card? → Over 10% | Value band → Over $250K",
  "steps": [
    {
      "id": "RA_CB",
      "title": "Budget check",
      "status": "Passed",
      "message": "$120K left in plan after this request"
    },
    {
      "id": "RA_CD",
      "title": "Duplicate & ghost worker",
      "status": "Passed",
      "message": "No duplicate worker or leftover access found"
    },
    {
      "id": "RA_A1",
      "title": "Business sign-off",
      "status": "Approval",
      "message": "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Hiring manager (Tom Reed), Cost center owner (Alan Brooks), Information Security (Ravi Kumar), Privacy (Fatima Zahra)",
          "notes": [
            "Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK)",
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves"
          ]
        }
      ],
      "tasks": [
        "Task: Record IR35 status · Tax (Mei Lin). Must be done before the request is approved"
      ]
    },
    {
      "id": "RA_A2",
      "title": "Rate review",
      "status": "Choose who approves",
      "message": "Pick who approves this step. Nothing is approved automatically"
    },
    {
      "id": "RA_A3",
      "title": "Finance sign-off",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Finance business partner (Chloe Martin)",
          "notes": []
        }
      ]
    },
    {
      "id": "RW",
      "title": "Tell the supplier",
      "status": "Sent",
      "message": "Email to Supplier account manager"
    }
  ],
  "notices": [
    "For real requests, “UK Technology work orders” runs for this record."
  ]
}
```

#### EN-073 · A System step on a system that isn’t connected pauses

- Script / decision: engine §10.3 System, D18
- **DEVIATION** — the prototype shows “Done in Coupa”. Coupa has `st: "off"` in `systems.json`.
- Workflow: the A.3 “New workflow” fields with this graph: `{"T": {"id": "T", "kind": "trigger", "label": "", "outs": [{"key": "next", "to": "CP"}]}, "CP": {"id": "CP", "kind": "system", "label": "Raise purchase order", "system": "Coupa", "sys": {"system": "Coupa", "action": "create", "object": "Purchase order", "match": "Work order ID", "map": [], "read": [], "wait": "confirm", "waitH": 24, "state": "Completed", "onFail": "task", "failRole": "people_ops", "retries": 3, "check": false}, "outs": [{"key": "next", "to": "END"}]}, "END": {"id": "END", "kind": "end", "label": "", "outcome": "completed", "outs": []}}`. Record `WO-2231` (no approval rule matches it, so there is no summary).
- Expected:

```json
{
  "summary": null,
  "path": "",
  "steps": [
    {
      "id": "CP",
      "title": "Raise purchase order",
      "status": "Paused: not connected",
      "message": "Coupa isn’t connected yet, so this step pauses and People Ops is asked to do it by hand"
    }
  ]
}
```

#### EN-074 · Run workflow says what it starts

- Script / decision: engine §10.3 Run workflow, D19
- **DEVIATION** — the prototype shows the kind name and no message.
- Workflow: the A.3 “New workflow” fields with this graph: `{"T": {"id": "T", "kind": "trigger", "label": "", "outs": [{"key": "next", "to": "RW1"}]}, "RW1": {"id": "RW1", "kind": "runwf", "label": "Run workflow", "target": "wf-onboard", "outs": [{"key": "next", "to": "END"}]}, "END": {"id": "END", "kind": "end", "label": "", "outcome": "completed", "outs": []}}`. Record `WO-2231`.
- Expected:

```json
{
  "summary": null,
  "path": "",
  "steps": [
    {
      "id": "RW1",
      "title": "Run workflow",
      "status": "Started",
      "message": "Starts “Contractor onboarding”"
    }
  ]
}
```

### A.3 Building approvals in a new workflow (I-scripts)

The I-scripts build a workflow from “+ New workflow”: a draft named “New workflow” (version 0) that runs when a **Work order is submitted**, `scope` `{}`, with `onReject.recipients = ["hm"]` stored at creation (final decisions (00 §3) T2), so a rejection summary ends “; Levv tells Hiring manager.”. The new Approve step’s default name is “Approval” (T4), so its `label` is `"Approval"`. Because “Work order submitted” is live and also Everywhere, the new draft overlaps it (T9); that affects Nova and Publish (Part C), not Test. Each test below supplies the whole graph as it stands after that script’s step (ids as the id generator produces them, engine §16.0) and runs Test with two records: `WO-2231` (Operations analyst: Canada, Payrolled, $95K, requester Grace Kim) and `WO-2214` (Senior cloud engineer: UK, Off-payroll, $480K). Workflow fields for every test in this section:

```json
{ "id": "nf101", "name": "New workflow", "records": ["work_order"], "event": "submitted", "scope": {}, "status": "draft", "version": 0, "effective": "2026-12-01", "owner": "Procurement operations", "priority": null, "source": "levv", "onReject": { "recipients": ["hm"], "resubmitDays": 5 }, "published": null }
```

#### I1 graph · Approve step added, nobody chosen yet

Graph (`draft.nodes`):

```json
{
  "T": {
    "id": "T",
    "kind": "trigger",
    "label": "",
    "outs": [
      {
        "key": "next",
        "to": "n102"
      }
    ]
  },
  "END": {
    "id": "END",
    "kind": "end",
    "label": "",
    "outcome": "completed",
    "outs": []
  },
  "n102": {
    "id": "n102",
    "kind": "appr",
    "label": "Approval",
    "roles": [],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "outs": [
      {
        "key": "next",
        "to": "END"
      }
    ]
  }
}
```

##### EN-075 · I1 graph × WO-2231 “Operations analyst”

- **DEVIATION** (engine §20 D6, D16; final decisions (00 §3) T1). The prototype reports this empty Approve step as “Covered · The same person already approves this kind of decision on this path”, which is false: nobody approves. Production shows “Choose who approves” (status, red) with “Pick who approves this step. Nothing is approved automatically” and never lets Auto-approve approve. Publishing is blocked by LP-01.

```json
{
  "summary": "No one needs to approve on this path.",
  "notices": [
    "For real requests, “Work order submitted” runs for this record."
  ],
  "path": "",
  "steps": [
    {
      "id": "n102",
      "title": "Approval",
      "status": "Choose who approves",
      "message": "Pick who approves this step. Nothing is approved automatically"
    }
  ]
}
```

#### I2 graph · Approve step: Cost center owner

Graph (`draft.nodes`):

```json
{
  "T": {
    "id": "T",
    "kind": "trigger",
    "label": "",
    "outs": [
      {
        "key": "next",
        "to": "n102"
      }
    ]
  },
  "END": {
    "id": "END",
    "kind": "end",
    "label": "",
    "outcome": "completed",
    "outs": []
  },
  "n102": {
    "id": "n102",
    "kind": "appr",
    "label": "Approval",
    "roles": [
      "cco"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "outs": [
      {
        "key": "next",
        "to": "END"
      }
    ]
  }
}
```

##### EN-076 · I2 graph × WO-2231 “Operations analyst”

- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "1 approval round on this path.",
  "path": "",
  "steps": [
    {
      "id": "n102",
      "title": "Approval",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Cost center owner (Raj Patel)",
          "notes": []
        }
      ]
    }
  ],
  "notices": [
    "For real requests, “Work order submitted” runs for this record."
  ]
}
```

##### EN-077 · I2 graph × WO-2214 “Senior cloud engineer”

- **DEVIATION** (prototype output differs; engine spec §20): D5 — rule tasks are shown under the step whose round they joined (the prototype never shows them in workflow Test); D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "1 approval round on this path. Approval rules add approvers: Client data access, UK off-payroll (IR35).",
  "path": "",
  "steps": [
    {
      "id": "n102",
      "title": "Approval",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Cost center owner (Alan Brooks), Information Security (Ravi Kumar), Privacy (Fatima Zahra)",
          "notes": [
            "Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK)",
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves"
          ]
        }
      ],
      "tasks": [
        "Task: Record IR35 status · Tax (Mei Lin). Must be done before the request is approved"
      ]
    }
  ],
  "notices": [
    "For real requests, “UK Technology work orders” runs for this record."
  ]
}
```

#### I3 graph · An If in front of it (default “Over $500K?”)

Graph (`draft.nodes`):

```json
{
  "T": {
    "id": "T",
    "kind": "trigger",
    "label": "",
    "outs": [
      {
        "key": "next",
        "to": "n103"
      }
    ]
  },
  "END": {
    "id": "END",
    "kind": "end",
    "label": "",
    "outcome": "completed",
    "outs": []
  },
  "n102": {
    "id": "n102",
    "kind": "appr",
    "label": "Approval",
    "roles": [
      "cco"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "outs": [
      {
        "key": "next",
        "to": "END"
      }
    ]
  },
  "n103": {
    "id": "n103",
    "kind": "cond",
    "label": "Over $500K?",
    "outs": [
      {
        "key": "p1",
        "to": "n102",
        "label": "Yes",
        "join": "all",
        "rows": [
          {
            "f": "total_value",
            "op": ">=",
            "v": 500000
          }
        ]
      },
      {
        "key": "else",
        "to": "n102",
        "label": "No"
      }
    ],
    "mergeAt": "n102"
  }
}
```

##### EN-078 · I3 graph × WO-2231 “Operations analyst”

- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "1 approval round on this path.",
  "path": "Over $500K? → No",
  "steps": [
    {
      "id": "n102",
      "title": "Approval",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Cost center owner (Raj Patel)",
          "notes": []
        }
      ]
    }
  ],
  "notices": [
    "For real requests, “Work order submitted” runs for this record."
  ]
}
```

##### EN-079 · I3 graph × WO-2214 “Senior cloud engineer”

- **DEVIATION** (prototype output differs; engine spec §20): D5 — rule tasks are shown under the step whose round they joined (the prototype never shows them in workflow Test); D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "1 approval round on this path. Approval rules add approvers: Client data access, UK off-payroll (IR35).",
  "path": "Over $500K? → No",
  "steps": [
    {
      "id": "n102",
      "title": "Approval",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Cost center owner (Alan Brooks), Information Security (Ravi Kumar), Privacy (Fatima Zahra)",
          "notes": [
            "Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK)",
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves"
          ]
        }
      ],
      "tasks": [
        "Task: Record IR35 status · Tax (Mei Lin). Must be done before the request is approved"
      ]
    }
  ],
  "notices": [
    "For real requests, “UK Technology work orders” runs for this record."
  ]
}
```

#### I4 graph · Path 1 is “Engagement type is Off-payroll”, renamed “Off-payroll”

Graph (`draft.nodes`):

```json
{
  "T": {
    "id": "T",
    "kind": "trigger",
    "label": "",
    "outs": [
      {
        "key": "next",
        "to": "n103"
      }
    ]
  },
  "END": {
    "id": "END",
    "kind": "end",
    "label": "",
    "outcome": "completed",
    "outs": []
  },
  "n102": {
    "id": "n102",
    "kind": "appr",
    "label": "Approval",
    "roles": [
      "cco"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "outs": [
      {
        "key": "next",
        "to": "END"
      }
    ]
  },
  "n103": {
    "id": "n103",
    "kind": "cond",
    "label": "Over $500K?",
    "outs": [
      {
        "key": "p1",
        "to": "n102",
        "label": "Off-payroll",
        "join": "all",
        "rows": [
          {
            "f": "engagement",
            "op": "in",
            "v": [
              "Off-payroll"
            ]
          }
        ]
      },
      {
        "key": "else",
        "to": "n102",
        "label": "No"
      }
    ],
    "mergeAt": "n102"
  }
}
```

##### EN-080 · I4 graph × WO-2231 “Operations analyst”

- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "1 approval round on this path.",
  "path": "Over $500K? → No",
  "steps": [
    {
      "id": "n102",
      "title": "Approval",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Cost center owner (Raj Patel)",
          "notes": []
        }
      ]
    }
  ],
  "notices": [
    "For real requests, “Work order submitted” runs for this record."
  ]
}
```

##### EN-081 · I4 graph × WO-2214 “Senior cloud engineer”

- **DEVIATION** (prototype output differs; engine spec §20): D5 — rule tasks are shown under the step whose round they joined (the prototype never shows them in workflow Test); D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "1 approval round on this path. Approval rules add approvers: Client data access, UK off-payroll (IR35).",
  "path": "Over $500K? → Off-payroll",
  "steps": [
    {
      "id": "n102",
      "title": "Approval",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Cost center owner (Alan Brooks), Information Security (Ravi Kumar), Privacy (Fatima Zahra)",
          "notes": [
            "Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK)",
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves"
          ]
        }
      ],
      "tasks": [
        "Task: Record IR35 status · Tax (Mei Lin). Must be done before the request is approved"
      ]
    }
  ],
  "notices": [
    "For real requests, “UK Technology work orders” runs for this record."
  ]
}
```

#### I5 graph · “No” escalates to Cost center owner

Graph (`draft.nodes`):

```json
{
  "T": {
    "id": "T",
    "kind": "trigger",
    "label": "",
    "outs": [
      {
        "key": "next",
        "to": "n103"
      }
    ]
  },
  "END": {
    "id": "END",
    "kind": "end",
    "label": "",
    "outcome": "completed",
    "outs": []
  },
  "n102": {
    "id": "n102",
    "kind": "appr",
    "label": "Approval",
    "roles": [
      "cco"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "outs": [
      {
        "key": "next",
        "to": "END"
      }
    ]
  },
  "n103": {
    "id": "n103",
    "kind": "cond",
    "label": "Over $500K?",
    "outs": [
      {
        "key": "p1",
        "to": "n102",
        "label": "Off-payroll",
        "join": "all",
        "rows": [
          {
            "f": "engagement",
            "op": "in",
            "v": [
              "Off-payroll"
            ]
          }
        ]
      },
      {
        "key": "else",
        "to": "n103_else",
        "label": "No"
      }
    ],
    "elseDo": "escalate",
    "elseNode": "n103_else",
    "elseWho": "cco",
    "mergeAt": "n102"
  },
  "n103_else": {
    "id": "n103_else",
    "kind": "appr",
    "label": "No: escalation",
    "roles": [
      "cco"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "who": "roles",
    "escalation": true,
    "outs": [
      {
        "key": "next",
        "to": "n102"
      }
    ],
    "remind": 24
  }
}
```

##### EN-082 · I5 graph × WO-2231 “Operations analyst”

- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "1 approval round on this path.",
  "path": "Over $500K? → No",
  "steps": [
    {
      "id": "n103_else",
      "title": "No: escalation",
      "status": "Escalated",
      "message": "They must approve (it carries on), reject with a comment (it stops), or send it back to the requester. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Cost center owner (Raj Patel)",
          "notes": []
        }
      ]
    },
    {
      "id": "n102",
      "title": "Approval",
      "status": "Covered",
      "message": "The same person already approves this kind of decision on this path"
    }
  ],
  "notices": [
    "For real requests, “Work order submitted” runs for this record."
  ]
}
```

##### EN-083 · I5 graph × WO-2214 “Senior cloud engineer”

- **DEVIATION** (prototype output differs; engine spec §20): D5 — rule tasks are shown under the step whose round they joined (the prototype never shows them in workflow Test); D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "1 approval round on this path. Approval rules add approvers: Client data access, UK off-payroll (IR35).",
  "path": "Over $500K? → Off-payroll",
  "steps": [
    {
      "id": "n102",
      "title": "Approval",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Cost center owner (Alan Brooks), Information Security (Ravi Kumar), Privacy (Fatima Zahra)",
          "notes": [
            "Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK)",
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves"
          ]
        }
      ],
      "tasks": [
        "Task: Record IR35 status · Tax (Mei Lin). Must be done before the request is approved"
      ]
    }
  ],
  "notices": [
    "For real requests, “UK Technology work orders” runs for this record."
  ]
}
```

#### I6 graph · A second path is added (“Path 2”); “No” becomes “Otherwise”

Graph (`draft.nodes`):

```json
{
  "T": {
    "id": "T",
    "kind": "trigger",
    "label": "",
    "outs": [
      {
        "key": "next",
        "to": "n103"
      }
    ]
  },
  "END": {
    "id": "END",
    "kind": "end",
    "label": "",
    "outcome": "completed",
    "outs": []
  },
  "n102": {
    "id": "n102",
    "kind": "appr",
    "label": "Approval",
    "roles": [
      "cco"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "outs": [
      {
        "key": "next",
        "to": "END"
      }
    ]
  },
  "n103": {
    "id": "n103",
    "kind": "cond",
    "label": "Over $500K?",
    "outs": [
      {
        "key": "p1",
        "to": "n102",
        "label": "Off-payroll",
        "join": "all",
        "rows": [
          {
            "f": "engagement",
            "op": "in",
            "v": [
              "Off-payroll"
            ]
          }
        ]
      },
      {
        "key": "p104",
        "to": "n102",
        "label": "Path 2",
        "join": "all",
        "do": "continue",
        "rows": [
          {
            "f": "total_value",
            "op": ">=",
            "v": 100000
          }
        ]
      },
      {
        "key": "else",
        "to": "n103_else",
        "label": "Otherwise"
      }
    ],
    "elseDo": "escalate",
    "elseNode": "n103_else",
    "elseWho": "cco",
    "mergeAt": "n102"
  },
  "n103_else": {
    "id": "n103_else",
    "kind": "appr",
    "label": "Otherwise: escalation",
    "roles": [
      "cco"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "who": "roles",
    "escalation": true,
    "outs": [
      {
        "key": "next",
        "to": "n102"
      }
    ],
    "remind": 24
  }
}
```

##### EN-084 · I6 graph × WO-2231 “Operations analyst”

- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "1 approval round on this path.",
  "path": "Over $500K? → Otherwise",
  "steps": [
    {
      "id": "n103_else",
      "title": "Otherwise: escalation",
      "status": "Escalated",
      "message": "They must approve (it carries on), reject with a comment (it stops), or send it back to the requester. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Cost center owner (Raj Patel)",
          "notes": []
        }
      ]
    },
    {
      "id": "n102",
      "title": "Approval",
      "status": "Covered",
      "message": "The same person already approves this kind of decision on this path"
    }
  ],
  "notices": [
    "For real requests, “Work order submitted” runs for this record."
  ]
}
```

##### EN-085 · I6 graph × WO-2214 “Senior cloud engineer”

- **DEVIATION** (prototype output differs; engine spec §20): D5 — rule tasks are shown under the step whose round they joined (the prototype never shows them in workflow Test); D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "1 approval round on this path. Approval rules add approvers: Client data access, UK off-payroll (IR35).",
  "path": "Over $500K? → Off-payroll",
  "steps": [
    {
      "id": "n102",
      "title": "Approval",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Cost center owner (Alan Brooks), Information Security (Ravi Kumar), Privacy (Fatima Zahra)",
          "notes": [
            "Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK)",
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves"
          ]
        }
      ],
      "tasks": [
        "Task: Record IR35 status · Tax (Mei Lin). Must be done before the request is approved"
      ]
    }
  ],
  "notices": [
    "For real requests, “UK Technology work orders” runs for this record."
  ]
}
```

#### I7 graph · Path 2 asks Procurement to approve

Graph (`draft.nodes`):

```json
{
  "T": {
    "id": "T",
    "kind": "trigger",
    "label": "",
    "outs": [
      {
        "key": "next",
        "to": "n103"
      }
    ]
  },
  "END": {
    "id": "END",
    "kind": "end",
    "label": "",
    "outcome": "completed",
    "outs": []
  },
  "n102": {
    "id": "n102",
    "kind": "appr",
    "label": "Approval",
    "roles": [
      "cco"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "outs": [
      {
        "key": "next",
        "to": "END"
      }
    ]
  },
  "n103": {
    "id": "n103",
    "kind": "cond",
    "label": "Over $500K?",
    "outs": [
      {
        "key": "p1",
        "to": "n102",
        "label": "Off-payroll",
        "join": "all",
        "rows": [
          {
            "f": "engagement",
            "op": "in",
            "v": [
              "Off-payroll"
            ]
          }
        ]
      },
      {
        "key": "p104",
        "to": "n103_p104",
        "label": "Path 2",
        "join": "all",
        "do": "approve",
        "rows": [
          {
            "f": "total_value",
            "op": ">=",
            "v": 100000
          }
        ],
        "node": "n103_p104",
        "who": "proc"
      },
      {
        "key": "else",
        "to": "n103_else",
        "label": "Otherwise"
      }
    ],
    "elseDo": "escalate",
    "elseNode": "n103_else",
    "elseWho": "cco",
    "mergeAt": "n102"
  },
  "n103_else": {
    "id": "n103_else",
    "kind": "appr",
    "label": "Otherwise: escalation",
    "roles": [
      "cco"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "who": "roles",
    "escalation": true,
    "outs": [
      {
        "key": "next",
        "to": "n102"
      }
    ],
    "remind": 24
  },
  "n103_p104": {
    "id": "n103_p104",
    "kind": "appr",
    "label": "Path 2: approval",
    "roles": [
      "proc"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "who": "roles",
    "escalation": false,
    "outs": [
      {
        "key": "next",
        "to": "n102"
      }
    ],
    "remind": 24
  }
}
```

##### EN-086 · I7 graph × WO-2231 “Operations analyst”

- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "1 approval round on this path.",
  "path": "Over $500K? → Otherwise",
  "steps": [
    {
      "id": "n103_else",
      "title": "Otherwise: escalation",
      "status": "Escalated",
      "message": "They must approve (it carries on), reject with a comment (it stops), or send it back to the requester. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Cost center owner (Raj Patel)",
          "notes": []
        }
      ]
    },
    {
      "id": "n102",
      "title": "Approval",
      "status": "Covered",
      "message": "The same person already approves this kind of decision on this path"
    }
  ],
  "notices": [
    "For real requests, “Work order submitted” runs for this record."
  ]
}
```

##### EN-087 · I7 graph × WO-2214 “Senior cloud engineer”

- **DEVIATION** (prototype output differs; engine spec §20): D5 — rule tasks are shown under the step whose round they joined (the prototype never shows them in workflow Test); D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "1 approval round on this path. Approval rules add approvers: Client data access, UK off-payroll (IR35).",
  "path": "Over $500K? → Off-payroll",
  "steps": [
    {
      "id": "n102",
      "title": "Approval",
      "status": "Approval",
      "message": "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Cost center owner (Alan Brooks), Information Security (Ravi Kumar), Privacy (Fatima Zahra)",
          "notes": [
            "Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK)",
            "Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves"
          ]
        }
      ],
      "tasks": [
        "Task: Record IR35 status · Tax (Mei Lin). Must be done before the request is approved"
      ]
    }
  ],
  "notices": [
    "For real requests, “UK Technology work orders” runs for this record."
  ]
}
```

#### I8 graph · Off-payroll rejects

Graph (`draft.nodes`):

```json
{
  "T": {
    "id": "T",
    "kind": "trigger",
    "label": "",
    "outs": [
      {
        "key": "next",
        "to": "n103"
      }
    ]
  },
  "END": {
    "id": "END",
    "kind": "end",
    "label": "",
    "outcome": "completed",
    "outs": []
  },
  "n102": {
    "id": "n102",
    "kind": "appr",
    "label": "Approval",
    "roles": [
      "cco"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "outs": [
      {
        "key": "next",
        "to": "END"
      }
    ]
  },
  "n103": {
    "id": "n103",
    "kind": "cond",
    "label": "Over $500K?",
    "outs": [
      {
        "key": "p1",
        "to": "n103_p1",
        "label": "Off-payroll",
        "join": "all",
        "rows": [
          {
            "f": "engagement",
            "op": "in",
            "v": [
              "Off-payroll"
            ]
          }
        ],
        "do": "reject",
        "node": "n103_p1",
        "who": "cco"
      },
      {
        "key": "p104",
        "to": "n103_p104",
        "label": "Path 2",
        "join": "all",
        "do": "approve",
        "rows": [
          {
            "f": "total_value",
            "op": ">=",
            "v": 100000
          }
        ],
        "node": "n103_p104",
        "who": "proc"
      },
      {
        "key": "else",
        "to": "n103_else",
        "label": "Otherwise"
      }
    ],
    "elseDo": "escalate",
    "elseNode": "n103_else",
    "elseWho": "cco",
    "mergeAt": "n102"
  },
  "n103_else": {
    "id": "n103_else",
    "kind": "appr",
    "label": "Otherwise: escalation",
    "roles": [
      "cco"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "who": "roles",
    "escalation": true,
    "outs": [
      {
        "key": "next",
        "to": "n102"
      }
    ],
    "remind": 24
  },
  "n103_p104": {
    "id": "n103_p104",
    "kind": "appr",
    "label": "Path 2: approval",
    "roles": [
      "proc"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "who": "roles",
    "escalation": false,
    "outs": [
      {
        "key": "next",
        "to": "n102"
      }
    ],
    "remind": 24
  },
  "n103_p1": {
    "id": "n103_p1",
    "kind": "end",
    "label": "Rejected",
    "outcome": "rejected",
    "outs": []
  }
}
```

##### EN-088 · I8 graph × WO-2231 “Operations analyst”

- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "1 approval round on this path.",
  "path": "Over $500K? → Otherwise",
  "steps": [
    {
      "id": "n103_else",
      "title": "Otherwise: escalation",
      "status": "Escalated",
      "message": "They must approve (it carries on), reject with a comment (it stops), or send it back to the requester. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Cost center owner (Raj Patel)",
          "notes": []
        }
      ]
    },
    {
      "id": "n102",
      "title": "Approval",
      "status": "Covered",
      "message": "The same person already approves this kind of decision on this path"
    }
  ],
  "notices": [
    "For real requests, “Work order submitted” runs for this record."
  ]
}
```

##### EN-089 · I8 graph × WO-2214 “Senior cloud engineer”

- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run; T2 — a new workflow tells Hiring manager about a final rejection by default.

```json
{
  "summary": "No one needs to approve on this path. Rejected at “Over $500K?”. It goes back to the requester with the reason; Levv tells Hiring manager.",
  "path": "Over $500K? → Off-payroll",
  "steps": [],
  "notices": [
    "For real requests, “UK Technology work orders” runs for this record."
  ]
}
```

#### I9 graph · Path 2 also rejects; Otherwise stays on Escalate

Graph (`draft.nodes`):

```json
{
  "T": {
    "id": "T",
    "kind": "trigger",
    "label": "",
    "outs": [
      {
        "key": "next",
        "to": "n103"
      }
    ]
  },
  "END": {
    "id": "END",
    "kind": "end",
    "label": "",
    "outcome": "completed",
    "outs": []
  },
  "n102": {
    "id": "n102",
    "kind": "appr",
    "label": "Approval",
    "roles": [
      "cco"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "outs": [
      {
        "key": "next",
        "to": "END"
      }
    ]
  },
  "n103": {
    "id": "n103",
    "kind": "cond",
    "label": "Over $500K?",
    "outs": [
      {
        "key": "p1",
        "to": "n103_p1",
        "label": "Off-payroll",
        "join": "all",
        "rows": [
          {
            "f": "engagement",
            "op": "in",
            "v": [
              "Off-payroll"
            ]
          }
        ],
        "do": "reject",
        "node": "n103_p1",
        "who": "cco"
      },
      {
        "key": "p104",
        "to": "n103_p104",
        "label": "Path 2",
        "join": "all",
        "do": "reject",
        "rows": [
          {
            "f": "total_value",
            "op": ">=",
            "v": 100000
          }
        ],
        "node": "n103_p104",
        "who": "proc"
      },
      {
        "key": "else",
        "to": "n103_else",
        "label": "Otherwise"
      }
    ],
    "elseDo": "escalate",
    "elseNode": "n103_else",
    "elseWho": "cco",
    "mergeAt": "n102"
  },
  "n103_else": {
    "id": "n103_else",
    "kind": "appr",
    "label": "Otherwise: escalation",
    "roles": [
      "cco"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "who": "roles",
    "escalation": true,
    "outs": [
      {
        "key": "next",
        "to": "n102"
      }
    ],
    "remind": 24
  },
  "n103_p1": {
    "id": "n103_p1",
    "kind": "end",
    "label": "Rejected",
    "outcome": "rejected",
    "outs": []
  },
  "n103_p104": {
    "id": "n103_p104",
    "kind": "end",
    "label": "Rejected",
    "outcome": "rejected",
    "outs": []
  }
}
```

##### EN-090 · I9 graph × WO-2231 “Operations analyst”

- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "1 approval round on this path.",
  "path": "Over $500K? → Otherwise",
  "steps": [
    {
      "id": "n103_else",
      "title": "Otherwise: escalation",
      "status": "Escalated",
      "message": "They must approve (it carries on), reject with a comment (it stops), or send it back to the requester. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Cost center owner (Raj Patel)",
          "notes": []
        }
      ]
    },
    {
      "id": "n102",
      "title": "Approval",
      "status": "Covered",
      "message": "The same person already approves this kind of decision on this path"
    }
  ],
  "notices": [
    "For real requests, “Work order submitted” runs for this record."
  ]
}
```

##### EN-091 · I9 graph × WO-2214 “Senior cloud engineer”

- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run; T2 — a new workflow tells Hiring manager about a final rejection by default.

```json
{
  "summary": "No one needs to approve on this path. Rejected at “Over $500K?”. It goes back to the requester with the reason; Levv tells Hiring manager.",
  "path": "Over $500K? → Off-payroll",
  "steps": [],
  "notices": [
    "For real requests, “UK Technology work orders” runs for this record."
  ]
}
```

#### I10 graph · Path 2 deleted

Graph (`draft.nodes`):

```json
{
  "T": {
    "id": "T",
    "kind": "trigger",
    "label": "",
    "outs": [
      {
        "key": "next",
        "to": "n103"
      }
    ]
  },
  "END": {
    "id": "END",
    "kind": "end",
    "label": "",
    "outcome": "completed",
    "outs": []
  },
  "n102": {
    "id": "n102",
    "kind": "appr",
    "label": "Approval",
    "roles": [
      "cco"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "outs": [
      {
        "key": "next",
        "to": "END"
      }
    ]
  },
  "n103": {
    "id": "n103",
    "kind": "cond",
    "label": "Over $500K?",
    "outs": [
      {
        "key": "p1",
        "to": "n103_p1",
        "label": "Off-payroll",
        "join": "all",
        "rows": [
          {
            "f": "engagement",
            "op": "in",
            "v": [
              "Off-payroll"
            ]
          }
        ],
        "do": "reject",
        "node": "n103_p1",
        "who": "cco"
      },
      {
        "key": "else",
        "to": "n103_else",
        "label": "Otherwise"
      }
    ],
    "elseDo": "escalate",
    "elseNode": "n103_else",
    "elseWho": "cco",
    "mergeAt": "n102"
  },
  "n103_else": {
    "id": "n103_else",
    "kind": "appr",
    "label": "Otherwise: escalation",
    "roles": [
      "cco"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "who": "roles",
    "escalation": true,
    "outs": [
      {
        "key": "next",
        "to": "n102"
      }
    ],
    "remind": 24
  },
  "n103_p1": {
    "id": "n103_p1",
    "kind": "end",
    "label": "Rejected",
    "outcome": "rejected",
    "outs": []
  }
}
```

##### EN-092 · I10 graph × WO-2231 “Operations analyst”

- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "1 approval round on this path.",
  "path": "Over $500K? → Otherwise",
  "steps": [
    {
      "id": "n103_else",
      "title": "Otherwise: escalation",
      "status": "Escalated",
      "message": "They must approve (it carries on), reject with a comment (it stops), or send it back to the requester. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Cost center owner (Raj Patel)",
          "notes": []
        }
      ]
    },
    {
      "id": "n102",
      "title": "Approval",
      "status": "Covered",
      "message": "The same person already approves this kind of decision on this path"
    }
  ],
  "notices": [
    "For real requests, “Work order submitted” runs for this record."
  ]
}
```

##### EN-093 · I10 graph × WO-2214 “Senior cloud engineer”

- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run; T2 — a new workflow tells Hiring manager about a final rejection by default.

```json
{
  "summary": "No one needs to approve on this path. Rejected at “Over $500K?”. It goes back to the requester with the reason; Levv tells Hiring manager.",
  "path": "Over $500K? → Off-payroll",
  "steps": [],
  "notices": [
    "For real requests, “UK Technology work orders” runs for this record."
  ]
}
```

#### I11 graph · Either/or added to Off-payroll

Graph (`draft.nodes`):

```json
{
  "T": {
    "id": "T",
    "kind": "trigger",
    "label": "",
    "outs": [
      {
        "key": "next",
        "to": "n103"
      }
    ]
  },
  "END": {
    "id": "END",
    "kind": "end",
    "label": "",
    "outcome": "completed",
    "outs": []
  },
  "n102": {
    "id": "n102",
    "kind": "appr",
    "label": "Approval",
    "roles": [
      "cco"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "outs": [
      {
        "key": "next",
        "to": "END"
      }
    ]
  },
  "n103": {
    "id": "n103",
    "kind": "cond",
    "label": "Over $500K?",
    "outs": [
      {
        "key": "p1",
        "to": "n103_p1",
        "label": "Off-payroll",
        "join": "all",
        "rows": [
          {
            "f": "engagement",
            "op": "in",
            "v": [
              "Off-payroll"
            ]
          },
          {
            "join": "any",
            "rows": [
              {
                "f": "total_value",
                "op": ">=",
                "v": 250000
              },
              {
                "f": "role_regulated",
                "op": "yes"
              }
            ]
          }
        ],
        "do": "reject",
        "node": "n103_p1",
        "who": "cco"
      },
      {
        "key": "else",
        "to": "n103_else",
        "label": "Otherwise"
      }
    ],
    "elseDo": "escalate",
    "elseNode": "n103_else",
    "elseWho": "cco",
    "mergeAt": "n102"
  },
  "n103_else": {
    "id": "n103_else",
    "kind": "appr",
    "label": "Otherwise: escalation",
    "roles": [
      "cco"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "who": "roles",
    "escalation": true,
    "outs": [
      {
        "key": "next",
        "to": "n102"
      }
    ],
    "remind": 24
  },
  "n103_p1": {
    "id": "n103_p1",
    "kind": "end",
    "label": "Rejected",
    "outcome": "rejected",
    "outs": []
  }
}
```

##### EN-094 · I11 graph × WO-2231 “Operations analyst”

- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run.

```json
{
  "summary": "1 approval round on this path.",
  "path": "Over $500K? → Otherwise",
  "steps": [
    {
      "id": "n103_else",
      "title": "Otherwise: escalation",
      "status": "Escalated",
      "message": "They must approve (it carries on), reject with a comment (it stops), or send it back to the requester. Chaser reminds after 24h and escalates to their manager after 48h",
      "rounds": [
        {
          "n": 1,
          "people": "Cost center owner (Raj Patel)",
          "notes": []
        }
      ]
    },
    {
      "id": "n102",
      "title": "Approval",
      "status": "Covered",
      "message": "The same person already approves this kind of decision on this path"
    }
  ],
  "notices": [
    "For real requests, “Work order submitted” runs for this record."
  ]
}
```

##### EN-095 · I11 graph × WO-2214 “Senior cloud engineer”

- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run; T2 — a new workflow tells Hiring manager about a final rejection by default.

```json
{
  "summary": "No one needs to approve on this path. Rejected at “Over $500K?”. It goes back to the requester with the reason; Levv tells Hiring manager.",
  "path": "Over $500K? → Off-payroll",
  "steps": [],
  "notices": [
    "For real requests, “UK Technology work orders” runs for this record."
  ]
}
```

#### I12 graph · Every condition removed from Off-payroll

Graph (`draft.nodes`):

```json
{
  "T": {
    "id": "T",
    "kind": "trigger",
    "label": "",
    "outs": [
      {
        "key": "next",
        "to": "n103"
      }
    ]
  },
  "END": {
    "id": "END",
    "kind": "end",
    "label": "",
    "outcome": "completed",
    "outs": []
  },
  "n102": {
    "id": "n102",
    "kind": "appr",
    "label": "Approval",
    "roles": [
      "cco"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "outs": [
      {
        "key": "next",
        "to": "END"
      }
    ]
  },
  "n103": {
    "id": "n103",
    "kind": "cond",
    "label": "Over $500K?",
    "outs": [
      {
        "key": "p1",
        "to": "n103_p1",
        "label": "Off-payroll",
        "join": "all",
        "rows": [],
        "do": "reject",
        "node": "n103_p1",
        "who": "cco"
      },
      {
        "key": "else",
        "to": "n103_else",
        "label": "Otherwise"
      }
    ],
    "elseDo": "escalate",
    "elseNode": "n103_else",
    "elseWho": "cco",
    "mergeAt": "n102"
  },
  "n103_else": {
    "id": "n103_else",
    "kind": "appr",
    "label": "Otherwise: escalation",
    "roles": [
      "cco"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "who": "roles",
    "escalation": true,
    "outs": [
      {
        "key": "next",
        "to": "n102"
      }
    ],
    "remind": 24
  },
  "n103_p1": {
    "id": "n103_p1",
    "kind": "end",
    "label": "Rejected",
    "outcome": "rejected",
    "outs": []
  }
}
```

##### EN-096 · I12 graph × WO-2231 “Operations analyst”

- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run; T2 — a new workflow tells Hiring manager about a final rejection by default.

```json
{
  "summary": "No one needs to approve on this path. Rejected at “Over $500K?”. It goes back to the requester with the reason; Levv tells Hiring manager.",
  "path": "Over $500K? → Off-payroll",
  "steps": [],
  "notices": [
    "For real requests, “Work order submitted” runs for this record."
  ]
}
```

##### EN-097 · I12 graph × WO-2214 “Senior cloud engineer”

- **DEVIATION** (prototype output differs; engine spec §20): D16 — Test says which workflow real requests for this record would run; T2 — a new workflow tells Hiring manager about a final rejection by default.

```json
{
  "summary": "No one needs to approve on this path. Rejected at “Over $500K?”. It goes back to the requester with the reason; Levv tells Hiring manager.",
  "path": "Over $500K? → Off-payroll",
  "steps": [],
  "notices": [
    "For real requests, “UK Technology work orders” runs for this record."
  ]
}
```

### A.4 Editor operations on the workflow graph (pure functions)

The editor changes the workflow through pure functions, so the same data comes out whether the change is made in the UI or by a test. The names and signatures are those of engine §16 (canonical), bound to the test's context with `createEditor(ctx)`. `wf(id)` is a fresh clone of that seed workflow's normalised `draft.nodes`; `wfObj(id)` is the whole normalised workflow; `<Ix graph>` is the A.3 graph. Before each call the harness reserves the starting workflow's ids, including its own id (engine §16.0). Each test starts from the seed workflow named, applies the operation, and compares the changed nodes with the expected data (other nodes must be untouched, compare with `toEqual`).

#### EN-098 · Set a check’s flag action to Reject

- Script: A5
- Call: `setFlag(wf('wf-wo-sub-wo-uk-tech'), 'RA_CD', 'reject')`
- Expected: the escalation node `RA_CDe` is removed, a Rejected end `RA_CDf` is added, and `RA_CD` points its Flagged exit at it. Exactly the setup of EN-042:

```json
{
  "remove": [
    "RA_CDe"
  ],
  "add": {
    "RA_CDf": {
      "id": "RA_CDf",
      "kind": "end",
      "label": "Rejected",
      "outcome": "rejected",
      "outs": []
    }
  },
  "patch": {
    "RA_CD": {
      "flagDo": "reject",
      "outs": [
        {
          "key": "flag",
          "to": "RA_CDf",
          "label": "Flagged"
        },
        {
          "key": "pass",
          "to": "RA_A1",
          "label": "Passed"
        }
      ],
      "flagNode": "RA_CDf"
    }
  }
}
```

#### EN-099 · Set the flag action back to Escalate

- Script: A5 cleanup
- Call: `setFlag(<result of the previous test>, 'RA_CD', 'escalate')`
- Expected: `RA_CDf` becomes an escalation Approve step to Procurement that continues to Business sign-off:

```json
{
  "RA_CD": {
    "flagDo": "escalate",
    "flagNode": "RA_CDf",
    "outs": [
      {
        "key": "flag",
        "to": "RA_CDf",
        "label": "Flagged"
      },
      {
        "key": "pass",
        "to": "RA_A1",
        "label": "Passed"
      }
    ]
  },
  "RA_CDf": {
    "id": "RA_CDf",
    "kind": "appr",
    "label": "Duplicate & ghost worker flagged: escalation",
    "outs": [
      {
        "key": "next",
        "to": "RA_A1"
      }
    ],
    "roles": [
      "proc"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "who": "roles",
    "escalation": true,
    "remind": 24
  }
}
```

#### EN-100 · Otherwise → Reject

- Script: A6
- Call: `setPathThen(wf('wf-wo-sub'), 'RA_C1', 'else', 'reject')`
- Expected: a Rejected end `RA_C1_else` is added and the Otherwise exit points at it; the If keeps `mergeAt: "RA_C2"` (where its paths meet, set on load by engine §16.2 and never recomputed while editing paths):

```json
{
  "add": {
    "RA_C1_else": {
      "id": "RA_C1_else",
      "kind": "end",
      "label": "Rejected",
      "outcome": "rejected",
      "outs": []
    }
  },
  "patch": {
    "RA_C1": {
      "outs": [
        {
          "key": "p1",
          "to": "RA_A2",
          "label": "Over 10%",
          "join": "all",
          "rows": [
            {
              "f": "rate_vs_card_pct",
              "op": ">",
              "v": 10
            }
          ]
        },
        {
          "key": "else",
          "to": "RA_C1_else",
          "label": "Otherwise"
        }
      ],
      "elseDo": "reject",
      "elseNode": "RA_C1_else",
      "elseWho": "cco",
      "mergeAt": "RA_C2"
    }
  }
}
```

#### EN-101 · Otherwise → Escalate to Finance controllers

- Script: A7
- Call: `setPathThen(wf('wf-wo-sub'), 'RA_C1', 'else', 'escalate', 'g:fin_ctrl')`
- Expected: an escalation Approve step `RA_C1_else` (“Otherwise: escalation”, group Finance controllers, `remind` 24, `sla` 48 — its Chaser is the only escalation timer, T5) is added and continues to Value band (`mergeAt`):

```json
{
  "add": {
    "RA_C1_else": {
      "id": "RA_C1_else",
      "kind": "appr",
      "label": "Otherwise: escalation",
      "roles": [
        "g:fin_ctrl"
      ],
      "mode": "all",
      "authority": false,
      "material": [],
      "reaskOnDecrease": true,
      "sla": 48,
      "reject": "requester",
      "prechecks": [
        "brief"
      ],
      "who": "group",
      "escalation": true,
      "outs": [
        {
          "key": "next",
          "to": "RA_C2"
        }
      ],
      "remind": 24
    }
  },
  "patch": {
    "RA_C1": {
      "outs": [
        {
          "key": "p1",
          "to": "RA_A2",
          "label": "Over 10%",
          "join": "all",
          "rows": [
            {
              "f": "rate_vs_card_pct",
              "op": ">",
              "v": 10
            }
          ]
        },
        {
          "key": "else",
          "to": "RA_C1_else",
          "label": "Otherwise"
        }
      ],
      "elseDo": "escalate",
      "elseNode": "RA_C1_else",
      "elseWho": "g:fin_ctrl",
      "mergeAt": "RA_C2"
    }
  }
}
```

#### EN-102 · Otherwise → Ask Chloe Martin to approve

- Script: A8
- Call: `setPathThen(wf('wf-wo-sub'), 'RA_C1', 'else', 'approve', 'p:Chloe Martin')`
- Expected: an Approve step `RA_C1_else` (“Otherwise: approval”, named person) is added and continues to Value band:

```json
{
  "add": {
    "RA_C1_else": {
      "id": "RA_C1_else",
      "kind": "appr",
      "label": "Otherwise: approval",
      "roles": [
        "p:Chloe Martin"
      ],
      "mode": "all",
      "authority": false,
      "material": [],
      "reaskOnDecrease": true,
      "sla": 48,
      "reject": "requester",
      "prechecks": [
        "brief"
      ],
      "who": "person",
      "escalation": false,
      "outs": [
        {
          "key": "next",
          "to": "RA_C2"
        }
      ],
      "remind": 24
    }
  },
  "patch": {
    "RA_C1": {
      "outs": [
        {
          "key": "p1",
          "to": "RA_A2",
          "label": "Over 10%",
          "join": "all",
          "rows": [
            {
              "f": "rate_vs_card_pct",
              "op": ">",
              "v": 10
            }
          ]
        },
        {
          "key": "else",
          "to": "RA_C1_else",
          "label": "Otherwise"
        }
      ],
      "elseDo": "approve",
      "elseNode": "RA_C1_else",
      "elseWho": "p:Chloe Martin",
      "mergeAt": "RA_C2"
    }
  }
}
```

#### EN-103 · Setting a path back to Carry on restores the original line (round trip)

- Script: A6, A7, A8 cleanup
- Call: `setPathThen(setPathThen(wf('wf-wo-sub'), 'RA_C1', 'else', mode), 'RA_C1', 'else', 'continue') for mode in reject, escalate, approve`
- **DEVIATION.** In the prototype, switching from **Reject** back to Carry on reconnects Otherwise to `RA_A2` (Rate review) instead of `RA_C2` (Value band), because it recomputes “where paths meet” while the rejected path is excluded; the canvas card then reads “Over 10% · carries on · Otherwise · carries on” and every record under 10% gets an unwanted Rate review. Escalate and Approve round-trip correctly. Production stores `mergeAt` on the If and uses it (engine §16.2, §16.4, D22; final decisions (00 §3) T1).
- Expected: for every mode, the resulting `draft.nodes` deep-equal the seed’s, except the bookkeeping fields `elseDo: "continue"`, `elseNode: null`, `elseWho` and `mergeAt: "RA_C2"` on `RA_C1`. In particular the Otherwise exit is `{"key":"else","to":"RA_C2","label":"Otherwise"}` and Test of `WO-2231` equals EN-017.

#### EN-104 · Insert an Approve step on a line

- Script: I1
- Call: `insertStep(<new-workflow graph: T → END>, 'T', 'next', { kind: 'appr' })` (workflow `nf101`)
- Expected: one Approve node named “Approval” with no approvers, continuing to End. The canvas box reads “Approval” / “Choose who approves” with a “!” marker; the panel title is the kind, “Approve” (final decisions (00 §3) T4; **DEVIATION**: the prototype leaves the name empty and the canvas shows “Approve”):

```json
{
  "T": {
    "id": "T",
    "kind": "trigger",
    "label": "",
    "outs": [
      {
        "key": "next",
        "to": "n102"
      }
    ]
  },
  "END": {
    "id": "END",
    "kind": "end",
    "label": "",
    "outcome": "completed",
    "outs": []
  },
  "n102": {
    "id": "n102",
    "kind": "appr",
    "label": "Approval",
    "roles": [],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "outs": [
      {
        "key": "next",
        "to": "END"
      }
    ]
  }
}
```

#### EN-105 · Insert an If in front of it

- Script: I3
- Call: `insertStep(<I2 graph>, 'T', 'next', { kind: 'cond' })`
- Expected: a default If “Over $500K?” with path “Yes” (`total_value ≥ 500000`) and “No”, both carrying on to “Approval”:

```json
{
  "id": "n103",
  "kind": "cond",
  "label": "Over $500K?",
  "outs": [
    {
      "key": "p1",
      "to": "n102",
      "label": "Yes",
      "join": "all",
      "rows": [
        {
          "f": "total_value",
          "op": ">=",
          "v": 500000
        }
      ]
    },
    {
      "key": "else",
      "to": "n102",
      "label": "No"
    }
  ],
  "mergeAt": "n102"
}
```

#### EN-106 · Add a path

- Script: I6
- Call: `addPath(<I5 graph>, 'n103')`
- Expected: a new path `p104` “Path 2” (`total_value ≥ 100000`, `do: "continue"`) is inserted before Otherwise and points at “Approval” (`n102`, where paths meet), not at the escalation box; the last path is renamed “Otherwise”:

```json
{
  "id": "n103",
  "kind": "cond",
  "label": "Over $500K?",
  "outs": [
    {
      "key": "p1",
      "to": "n102",
      "label": "Off-payroll",
      "join": "all",
      "rows": [
        {
          "f": "engagement",
          "op": "in",
          "v": [
            "Off-payroll"
          ]
        }
      ]
    },
    {
      "key": "p104",
      "to": "n102",
      "label": "Path 2",
      "join": "all",
      "do": "continue",
      "rows": [
        {
          "f": "total_value",
          "op": ">=",
          "v": 100000
        }
      ]
    },
    {
      "key": "else",
      "to": "n103_else",
      "label": "Otherwise"
    }
  ],
  "elseDo": "escalate",
  "elseNode": "n103_else",
  "elseWho": "cco",
  "mergeAt": "n102"
}
```

#### EN-107 · A path asks Procurement to approve

- Script: I7
- Call: `setPathThen(<I6 graph>, 'n103', 'p104', 'approve', 'proc')`
- Expected: adds `n103_p104` “Path 2: approval” (Procurement) continuing to `n102`:

```json
{
  "n103": {
    "id": "n103",
    "kind": "cond",
    "label": "Over $500K?",
    "outs": [
      {
        "key": "p1",
        "to": "n102",
        "label": "Off-payroll",
        "join": "all",
        "rows": [
          {
            "f": "engagement",
            "op": "in",
            "v": [
              "Off-payroll"
            ]
          }
        ]
      },
      {
        "key": "p104",
        "to": "n103_p104",
        "label": "Path 2",
        "join": "all",
        "do": "approve",
        "rows": [
          {
            "f": "total_value",
            "op": ">=",
            "v": 100000
          }
        ],
        "node": "n103_p104",
        "who": "proc"
      },
      {
        "key": "else",
        "to": "n103_else",
        "label": "Otherwise"
      }
    ],
    "elseDo": "escalate",
    "elseNode": "n103_else",
    "elseWho": "cco",
    "mergeAt": "n102"
  },
  "n103_p104": {
    "id": "n103_p104",
    "kind": "appr",
    "label": "Path 2: approval",
    "roles": [
      "proc"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "who": "roles",
    "escalation": false,
    "outs": [
      {
        "key": "next",
        "to": "n102"
      }
    ],
    "remind": 24
  }
}
```

#### EN-108 · A path rejects

- Script: I8
- Call: `setPathThen(<I7 graph>, 'n103', 'p1', 'reject')`
- Expected: adds a Rejected end `n103_p1` (`outcome: "rejected"`) and points Off-payroll at it:

```json
{
  "n103": {
    "id": "n103",
    "kind": "cond",
    "label": "Over $500K?",
    "outs": [
      {
        "key": "p1",
        "to": "n103_p1",
        "label": "Off-payroll",
        "join": "all",
        "rows": [
          {
            "f": "engagement",
            "op": "in",
            "v": [
              "Off-payroll"
            ]
          }
        ],
        "do": "reject",
        "node": "n103_p1",
        "who": "cco"
      },
      {
        "key": "p104",
        "to": "n103_p104",
        "label": "Path 2",
        "join": "all",
        "do": "approve",
        "rows": [
          {
            "f": "total_value",
            "op": ">=",
            "v": 100000
          }
        ],
        "node": "n103_p104",
        "who": "proc"
      },
      {
        "key": "else",
        "to": "n103_else",
        "label": "Otherwise"
      }
    ],
    "elseDo": "escalate",
    "elseNode": "n103_else",
    "elseWho": "cco",
    "mergeAt": "n102"
  },
  "n103_p1": {
    "id": "n103_p1",
    "kind": "end",
    "label": "Rejected",
    "outcome": "rejected",
    "outs": []
  }
}
```

#### EN-109 · At least one path has to carry on

- Script: I9
- Call: `setPathThen(<I8 graph with Path 2 also set to reject>, 'n103', 'else', 'reject')`
- Expected: the operation is refused: it returns `{ ok: false, message: "At least one path has to carry on" }` and the graph is unchanged (Otherwise stays an escalation). The preceding call that set Path 2 to reject succeeds because Otherwise still carries on. Graph after both calls:

```json
{
  "T": {
    "id": "T",
    "kind": "trigger",
    "label": "",
    "outs": [
      {
        "key": "next",
        "to": "n103"
      }
    ]
  },
  "END": {
    "id": "END",
    "kind": "end",
    "label": "",
    "outcome": "completed",
    "outs": []
  },
  "n102": {
    "id": "n102",
    "kind": "appr",
    "label": "Approval",
    "roles": [
      "cco"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "outs": [
      {
        "key": "next",
        "to": "END"
      }
    ]
  },
  "n103": {
    "id": "n103",
    "kind": "cond",
    "label": "Over $500K?",
    "outs": [
      {
        "key": "p1",
        "to": "n103_p1",
        "label": "Off-payroll",
        "join": "all",
        "rows": [
          {
            "f": "engagement",
            "op": "in",
            "v": [
              "Off-payroll"
            ]
          }
        ],
        "do": "reject",
        "node": "n103_p1",
        "who": "cco"
      },
      {
        "key": "p104",
        "to": "n103_p104",
        "label": "Path 2",
        "join": "all",
        "do": "reject",
        "rows": [
          {
            "f": "total_value",
            "op": ">=",
            "v": 100000
          }
        ],
        "node": "n103_p104",
        "who": "proc"
      },
      {
        "key": "else",
        "to": "n103_else",
        "label": "Otherwise"
      }
    ],
    "elseDo": "escalate",
    "elseNode": "n103_else",
    "elseWho": "cco",
    "mergeAt": "n102"
  },
  "n103_else": {
    "id": "n103_else",
    "kind": "appr",
    "label": "Otherwise: escalation",
    "roles": [
      "cco"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "who": "roles",
    "escalation": true,
    "outs": [
      {
        "key": "next",
        "to": "n102"
      }
    ],
    "remind": 24
  },
  "n103_p1": {
    "id": "n103_p1",
    "kind": "end",
    "label": "Rejected",
    "outcome": "rejected",
    "outs": []
  },
  "n103_p104": {
    "id": "n103_p104",
    "kind": "end",
    "label": "Rejected",
    "outcome": "rejected",
    "outs": []
  }
}
```

#### EN-110 · Delete a path

- Script: I10
- Call: `deletePath(<I9 graph>, 'n103', 'p104')`
- Expected: Path 2 and its box are gone; Off-payroll and Otherwise remain:

```json
{
  "T": {
    "id": "T",
    "kind": "trigger",
    "label": "",
    "outs": [
      {
        "key": "next",
        "to": "n103"
      }
    ]
  },
  "END": {
    "id": "END",
    "kind": "end",
    "label": "",
    "outcome": "completed",
    "outs": []
  },
  "n102": {
    "id": "n102",
    "kind": "appr",
    "label": "Approval",
    "roles": [
      "cco"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "outs": [
      {
        "key": "next",
        "to": "END"
      }
    ]
  },
  "n103": {
    "id": "n103",
    "kind": "cond",
    "label": "Over $500K?",
    "outs": [
      {
        "key": "p1",
        "to": "n103_p1",
        "label": "Off-payroll",
        "join": "all",
        "rows": [
          {
            "f": "engagement",
            "op": "in",
            "v": [
              "Off-payroll"
            ]
          }
        ],
        "do": "reject",
        "node": "n103_p1",
        "who": "cco"
      },
      {
        "key": "else",
        "to": "n103_else",
        "label": "Otherwise"
      }
    ],
    "elseDo": "escalate",
    "elseNode": "n103_else",
    "elseWho": "cco",
    "mergeAt": "n102"
  },
  "n103_else": {
    "id": "n103_else",
    "kind": "appr",
    "label": "Otherwise: escalation",
    "roles": [
      "cco"
    ],
    "mode": "all",
    "authority": false,
    "material": [],
    "reaskOnDecrease": true,
    "sla": 48,
    "reject": "requester",
    "prechecks": [
      "brief"
    ],
    "who": "roles",
    "escalation": true,
    "outs": [
      {
        "key": "next",
        "to": "n102"
      }
    ],
    "remind": 24
  },
  "n103_p1": {
    "id": "n103_p1",
    "kind": "end",
    "label": "Rejected",
    "outcome": "rejected",
    "outs": []
  }
}
```

#### EN-111 · Add an either/or condition

- Script: I11
- Call: `addEitherOr(<I10 graph>, 'n103', 'p1')`
- Expected: appends a group `{join:"any"}` with two default rows (`total_value ≥ 250000`, `role_regulated yes`). `rowsText` of the path reads exactly “Engagement type is Off-payroll and (Total value ≥ $250K or Regulated role is yes)”:

```json
{
  "id": "n103",
  "kind": "cond",
  "label": "Over $500K?",
  "outs": [
    {
      "key": "p1",
      "to": "n103_p1",
      "label": "Off-payroll",
      "join": "all",
      "rows": [
        {
          "f": "engagement",
          "op": "in",
          "v": [
            "Off-payroll"
          ]
        },
        {
          "join": "any",
          "rows": [
            {
              "f": "total_value",
              "op": ">=",
              "v": 250000
            },
            {
              "f": "role_regulated",
              "op": "yes"
            }
          ]
        }
      ],
      "do": "reject",
      "node": "n103_p1",
      "who": "cco"
    },
    {
      "key": "else",
      "to": "n103_else",
      "label": "Otherwise"
    }
  ],
  "elseDo": "escalate",
  "elseNode": "n103_else",
  "elseWho": "cco",
  "mergeAt": "n102"
}
```

#### EN-112 · Delete a step and reconnect

- Script: W13
- Call: `deleteStep(wf('wf-wo-sub'), 'RA_CB')`
- Expected: removes `RA_CB` and repoints every exit that led to it at the step it led to (for a check: its Passed exit), so `T.outs[0].to` becomes `RA_CD`:

```json
{
  "remove": [
    "RA_CB"
  ],
  "patch": {
    "T": {
      "outs": [
        {
          "key": "next",
          "to": "RA_CD"
        }
      ]
    }
  }
}
```

#### EN-113 · System step: take a Failed path, then switch back

- Script: W12
- Call: `setSystemOnFail(wf('wf-offboard'), 'RV', 'path')`, then `setSystemOnFail(<that result>, 'RV', 'task')`
- Expected: the first call sets `sys.onFail` to "path", labels the normal exit “Done” and adds a Failed exit to a new task `RVf` (“Fix the Okta error”, People Ops, “Fix what failed in Okta, then retry”) that continues to `HC`; the second call removes `RVf` and the Failed exit and the graph deep-equals the seed again. Data after the first call:

```json
{
  "added": {
    "RVf": {
      "id": "RVf",
      "kind": "task",
      "label": "Fix the Okta error",
      "role": "people_ops",
      "title": "Fix what failed in Okta, then retry",
      "outs": [
        {
          "key": "next",
          "to": "HC"
        }
      ]
    }
  },
  "removed": [],
  "changed": {
    "RV": {
      "outs": {
        "from": [
          {
            "key": "next",
            "to": "HC"
          }
        ],
        "to": [
          {
            "key": "next",
            "to": "HC",
            "label": "Done"
          },
          {
            "key": "failed",
            "to": "RVf",
            "label": "Failed"
          }
        ]
      },
      "sys": {
        "from": {
          "system": "Okta",
          "action": "close",
          "object": "User",
          "match": "Work email",
          "map": [
            [
              "Worker name",
              "Display name"
            ],
            [
              "Work email",
              "Login"
            ],
            [
              "Job title",
              "Title"
            ],
            [
              "Hiring manager",
              "Manager"
            ],
            [
              "Business unit",
              "Department"
            ],
            [
              "End date",
              "Deactivate on"
            ]
          ],
          "read": [],
          "wait": "confirm",
          "waitH": 24,
          "state": "Completed",
          "onFail": "task",
          "failRole": "people_ops",
          "retries": 3,
          "check": true
        },
        "to": {
          "system": "Okta",
          "action": "close",
          "object": "User",
          "match": "Work email",
          "map": [
            [
              "Worker name",
              "Display name"
            ],
            [
              "Work email",
              "Login"
            ],
            [
              "Job title",
              "Title"
            ],
            [
              "Hiring manager",
              "Manager"
            ],
            [
              "Business unit",
              "Department"
            ],
            [
              "End date",
              "Deactivate on"
            ]
          ],
          "read": [],
          "wait": "confirm",
          "waitH": 24,
          "state": "Completed",
          "onFail": "path",
          "failRole": "people_ops",
          "retries": 3,
          "check": true
        }
      }
    }
  }
}
```

#### EN-114 · Collect & verify: the sponsor provides it

- Script: W10
- Call: `setField(wf('wf-access'), 'ID', 'from', 'sponsor')`
- Expected: only `ID.from` changes, from "worker" to "sponsor".

#### EN-115 · Approve step: a named person

- Script: A19
- Call: `setApprovers(wf('wf-wo-sub'), 'RA_A2', { who: 'person', person: 'Chloe Martin' })` (engine §16.11)
- Expected: switching to “A named person” sets `who: "person"`, `roles: []`, `backup: ""` (nothing auto-picked; the dropdown shows “Choose a person”); picking Chloe Martin sets `roles: ["p:Chloe Martin"]`. Switching to “An approval group” instead sets `who: "group"`, `roles: []` (“Choose a group”); picking Finance controllers sets `roles: ["g:fin_ctrl"]`. Switching back to Roles restores `["proc"]`. Choosing `backup: "Lena Fischer"` sets that field; picking the backup’s name as the person clears the backup. (**DEVIATION**, T4/D6: the prototype auto-picks the first group or Alan Brooks.)

#### EN-116 · Escalation hours live on the generated step (one timer)

- Script: T5
- Call: `setEscalateAfter(setPathThen(wf('wf-wo-sub'), 'RA_C1', 'else', 'escalate', 'g:fin_ctrl'), 'RA_C1', 'else', 72)`; `setEscalateAfter(wf('wf-wo-sub'), 'RA_CD', null, 24)`
- Expected: the first call sets `RA_C1_else.sla = 72` and nothing on `RA_C1`; the second sets `RA_CDe.sla = 24`. Reading the hours box (`getEscalateAfter`) returns the generated step’s `sla`, so editing the Chaser of the generated step changes what the If/check panel shows, and vice versa. No `elseSla`, `flagSla` or path `sla` field exists. Replacing an escalation keeps the old `sla` (switch Otherwise to “Ask someone to approve” and back to “Escalate”: still 72). **DEVIATION**: the prototype stores separate `elseSla` / `flagSla` (D31).

#### EN-117 · Collect & verify escalation creates a generated step

- Script: T5 (engine §16.12, D31)
- Call: `setCollectFail(wf('wf-onboard'), 'ID', 'role', 'people_ops')`
- Expected: adds Approve `ID_fail` `{label: "Identity & eligibility failed: escalation", roles: ["people_ops"], who: "roles", escalation: true, failOf: "ID", reject: "requester", remind: 24, sla: 48}` continuing to `ID`’s next step, sets `ID.failTo = "role"`, `ID.failNode = "ID_fail"` and adds the out `{key: "fail", to: "ID_fail", label: "Failed"}` after `next`. `setCollectFail(…, "approval")` removes the out and the node. **DEVIATION**: the prototype only stores the role.

#### EN-118 · Stop on an If path and on a check

- Script: T11
- Call: `setPathThen(wf('wf-wo-sub'), 'RA_C1', 'else', 'stop', 'hm'); setFlag(wf('wf-wo-sub-wo-uk-tech'), 'RA_CD', 'stop', 'proc')`
- Expected: each creates a Notify (“Otherwise: tell them it stopped” / “Tell them it stopped”, Email, to the chosen role) followed by its own End with `outcome: "stopped"`, exactly the setups of EN-069 and EN-070. The guard counts Stop like Reject (“At least one path has to carry on”). **DEVIATION**: the prototype points the Notify at the normal End (D23).

#### EN-119 · A new workflow’s defaults

- Script: T2, T3, T4 (engine §16.13, UI §12)
- Call: `createWorkflow(wfObj('wf-wo-sub'))` in a fresh context (returns id `nf101`)
- Expected: returns `{name: "New workflow", records: ["work_order"], event: "submitted", scope: {}, status: "draft", version: 0, effective: "2026-12-01", owner: "Procurement operations", priority: null, source: "levv", onReject: {recipients: ["hm"], resubmitDays: 5}, draft: {nodes: {T → END, END outcome "completed"}}, published: null}`; toast “New draft. Set when it runs, then press + to add steps”. Inserting an Approve step gives it the name “Approval”. **DEVIATION**: the prototype stores no `onReject` (“No one”) and version 1.

#### EN-120 · Background check preset defaults

- Script: D25 (engine §20)
- Call: `insertStep(wf('wf-onboard'), 'BG', 'next', { kind: 'collect', preset: 'bgcheck' })`
- Expected: the new step has `failTo: "approval"`, `failRoles: ["hrbp","legal"]`, `failMode: "all"`, items Criminal record and Employment history, checker Checkr, verify auto; it is not blocked from publishing; its step-menu description is “Criminal, credit and sanctions checks; adverse results go to the people set under “If it fails”” (engine D25, UI §16.15, seed `PRESETS.bgcheck.d`). **DEVIATION**: the prototype has no `failRoles` and says “… go to an approval”.

#### EN-121 · Chaser numbers are stored on the step

- Script: N5
- Call: `setField(wf('wf-wo-sub'), 'RA_A1', 'remind', 12)`
- Expected: `RA_A1.remind` = 12 (it had no `remind`, meaning the default); `sla` stays 48.

#### EN-122 · Chaser defaults and wording per step kind

- Script: N4, N5, N6
- Function: `chaserFor(node) → { remindAfterHours, escalateAfterHours, escalateTo, label }`
- Expected (seed values; a step without `remind` uses the default; `sla` is the escalation hours):

| Step | Kind | Remind after (hours) | Then escalate after (hours) | Escalates to | Label on the panel |
| --- | --- | --- | --- | --- | --- |
| Work order submitted → Business sign-off (`RA_A1`) | Approve | 24 | 48 | their manager | “Then escalate to their manager after (hours)” |
| Assignment ending → Extend or end? (`K1`) | Task | 48 | 96 | their manager | “Then escalate to their manager after (hours)” |
| Contractor onboarding → Background check (`BG`), provided by Worker | Collect & verify | 48 | 96 | the hiring manager | “Then escalate to the hiring manager after (hours)” |
| Site access request → Identity & site details (`ID`), provided by Worker | Collect & verify | 48 | 96 | the hiring manager | “Then escalate to the hiring manager after (hours)” |

Rule: Approve (including every generated escalation) defaults to 24 / 48, Task and Collect & verify default to 48 / 96. `sla` must be greater than `remind` (LP-14). A Collect & verify step provided by the worker or the supplier account manager escalates to “the hiring manager”; every other step escalates to “their manager”. Test shows the Chaser only on Approve cards that are waiting: “Chaser reminds after {r}h and escalates to {who} after {s}h”, appended to the step message after “. ”.

#### EN-123 · Nova writes a condition from plain words

- Script: A18
- Function: `parseWhen("rate is more than 15% over the rate card", catalog)`
- Expected: `{"join":"all","rows":[{"f":"rate_vs_card_pct","op":">","v":15}]}` and the read-back sentence “Read as: asked only if Rate vs rate card (%) > 15%. Check it below, then Test.”
- Storing it: `RA_A2.when` = that object and `RA_A2.whenPrompt` = the typed text (exactly the setup of EN-052). The canvas card then reads “Procurement · only if Rate vs rate card (%) > 15%”, and a step that is skipped says “Only needed when Rate vs rate card (%) > 15%” with status “Not needed”.
- The test uses the deterministic parser (engine §17.3); see the next-but-one test for the full oracle and the model-first path.

#### EN-124 · Condition text and evaluation edge cases

- Engine §1.3, §2.1, D14, D15
- `rowText({f:"changed_fields", op:"includes", v:"bill_rate"})` = “Fields changed includes bill rate” (**DEVIATION**: the prototype prints “bill_rate”).
- `evalRow({f:"total_value", op:">=", v:null}, {total_value: 0})` and the same with `v: ""` are both `false`: an empty number never matches (**DEVIATION**: the prototype compares with 0).
- `conditionText({join:"all", rows:[]})` = “Always”; `rowText({f:"rate_vs_card_pct", op:">", v:15})` = “Rate vs rate card (%) > 15%”; `rowText({f:"total_value", op:">=", v:1000000})` = “Total value ≥ $1M”.
- `fmt`: 0 → “$0”; 950 → “$950”; 1500 → “$1.5K”; 62500 → “$62.5K”; 120000 → “$120K”; 1000000 → “$1M”; 1060000 → “$1.06M”; 2400000 → “$2.4M”; −36000 → “−$36K” (U+2212); 12345678 → “$12.35M”.

#### EN-125 · Plain-words parser oracle (fallback parser, no model call)

- Engine §17.3. `parseWhenRules(text)` must return exactly these rows (and `join` from the “or / any of” rule in §17.1), each as its own `it.each` case:

| Input | Rows | join |
| --- | --- | --- |
| rate is more than 15% over the rate card | rate_vs_card_pct > 15 | all |
| the bill rate goes up more than 5% | rate_change_pct > 5 | all |
| the bill rate goes up more than 5%, or the work country is UK | rate_change_pct > 5; country in [UK] | any |
| total value over $250K | total_value > 250000 | all |
| over $1.5m | total_value > 1500000 | all |
| budget left under $10k | budget_left_after < 10000 | all |
| rate above market by 8% | rate_vs_market_pct > 8 | all |
| bill rate over $120 | bill_rate > 120 | all |
| engaged more than 18 months | months_engaged_after > 18 | all |
| longer than 26 weeks | months_engaged_after > 6 | all |
| less than 10 days until the start | days_to_start < 10 | all |
| the end date changes | changed_fields includes end_date | all |
| cost center is changed | changed_fields includes cost_center | all |
| client data access | data_access yes | all |
| not a regulated role | role_regulated no | all |
| regulated role and country is Germany | role_regulated yes; country in [Germany] | all |
| business unit is not Finance | business_unit not_in [Finance] | all |
| job family is Data or Analytics | job_family in [Data, Analytics] | any |
| cost center CC-110 | cost_center in [CC-110] | all |
| site is London | site in [London] | all |
| worker type is SOW consultant | worker_type in [SOW consultant] | all |
| engagement off-payroll | engagement in [Off-payroll] | all |
| security clearance enhanced | security_clearance in [Enhanced] | all |
| below $50k total value | total_value < 50000 | all |
| legal entity Levv Bank UK Ltd | country in [UK]; legal_entity in [Levv Bank UK Ltd] | all |
| hello world | (none) | — |

- No rows → the message “I couldn’t match that to a field. Try naming the field and value, e.g. “work country is Canada” or “total value over $250K”.” and `when` unchanged. Empty input → toast “Say when this approver is needed”.
- Production’s model-first path (engine §17.2) is tested with a stubbed `callGPT`: a valid answer is used; an answer with an unknown field or a wrong operator for the field type is discarded and the parser result is used; a timeout falls back to the parser.

#### EN-126 · Structural counts of the seed

- Script: “Summary” of the human script
- Expected from the raw `workflows.json`: 15 workflows (14 `live`, 1 `draft`: “Data and AI hires”); 119 configured steps (all nodes except Start and End); 40 of them Approve steps (`kind: "appr"`); 3 approval rules; 3 approval groups (Finance controllers, Security review board, Executive committee); 8 connected systems (Coupa `st: "off"`); 29 sample records; 440 history records.
- After load normalisation (data model §15): 129 steps and 50 Approve steps (the 10 generated “{Step} failed: escalation” steps, one per Collect & verify with `failTo: "role"`: `wf-onboard` ID, LG, VI, LB, RG, PB; `wf-offboard` FT, XC; `wf-access` ID; `wf-doc` RN); every If has `mergeAt`; “Data and AI hires” has `version` 0; seeded workflows without `onReject` stay without it.

## 3. Part B — UI end-to-end tests

One test per script in the v35 human test run, using the script’s numbering, then the dropdown component tests and the no-pills crawl. Actions use visible labels (1.5). “Equals EN-xxx” means the full comparison described in 1.5.

### B.1 Navigation (N1–N6)

#### UI-N1 · Lands on a workflow; no Settings

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. Load `/flow-studio/wf-wo-sub`.
2. Also load `/flow-studio` with empty localStorage.

**Then**

- The top bar shows, in order: the logo “levv.”, the chip “Flows” (no tooltip), the picker button “Work order submitted” with its caret, the status “Live v1”, the button “Nova” (Sparkles icon) with the count “0”, the button “Test” (Play icon), the button “Publish”.
- `page.locator("text=Settings")`, `getByRole("button", { name: /Settings/ })` and `text=Approval rules` all have count 0 in the DOM (not merely hidden), and nothing opens people, groups, approval rules or “Needs fixing” (final decisions (00 §3) T8). **DEVIATION**: the prototype still renders a hidden “⚙ Settings” button and a hidden “Approval rules ›” picker entry.
- `/flow-studio` with no remembered workflow redirects to the first live workflow in picker order, “Job posting created” (UI §2.1); with a remembered workflow it opens that one.
- The canvas shows the Work order submitted workflow (UI-N3).

**Cleanup** none (the next test resets).

#### UI-N2 · The picker lists workflows and their variations

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. Click the picker button “Work order submitted”.
2. Read the list.
3. Press Escape; open it again; click the picker button.

**Then**

- The list (`role="listbox"`) shows exactly these 13 group headings and 15 workflows, in this order (record-lifecycle order, UI §3.1; **DEVIATION**: the prototype uses insertion order):

| # | Group heading (textContent; drawn in capitals) | Workflow | Second line |
| --- | --- | --- | --- |
| 1 | Job posting · Created | Job posting created | Everywhere |
| 2 | Work order · Submitted | Work order submitted | Everywhere |
| 3 |  | UK Technology work orders | UK · Technology |
| 4 |  | Data and AI hires | Data |
| 5 | Work order · Changed | Work order changed | Everywhere |
| 6 | SOW · Created | SOW created | Everywhere |
| 7 | SOW · Change order submitted | SOW change order submitted | Everywhere |
| 8 | Onboarding · Starts | Contractor onboarding | Everywhere |
| 9 | Assignment · Changed | Assignment changed | Everywhere |
| 10 | Assignment · End date in 30 days | Assignment ending | Everywhere |
| 11 | Offboarding · Starts | Contractor offboarding | Everywhere |
| 12 | Access request · Submitted | Site access request | Everywhere |
| 13 | Timesheet · Submitted | Timesheet submitted | Everywhere |
| 14 | Invoice · Received | Invoice received | Everywhere |
| 15 | Worker · Document expiring in 30 days | Document renewal | Everywhere |

- “UK Technology work orders” and “Data and AI hires” are indented under “Work order submitted” (variation rows). The row of the open workflow has `aria-current="true"`.
- After the last workflow there is exactly one footer entry, “+ New workflow”. Nothing else (no “Approval rules”, no Settings, no delete).
- Escape closes the list and focuses the picker button; clicking the picker button again also closes it.

**Cleanup** none (the next test resets).

#### UI-N3 · Approvals are on the canvas

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. Look at the canvas.

**Then**

- The canvas has exactly these 12 boxes (box text, lines joined with “ | ”), in any visual position:

  - “Work order submitted | Everywhere”
  - “Tell the supplier | Supplier account manager”
  - “End | Completed”
  - “Business sign-off | Together: Hiring manager + Cost center owner”
  - “Rate over card? | Over 10% | → Rate review | Otherwise | carries on”
  - “Rate review | Procurement”
  - “Value band | Over $1M | → Executive sign-off | Over $250K | → Finance sign-off | Otherwise | carries on”
  - “Finance sign-off | Finance business partner”
  - “Executive sign-off | In order: VP Finance + CFO”
  - “Flagged | Passed | Budget check | If flagged: approvers see it”
  - “Flagged | Passed | Duplicate & ghost worker | If flagged: escalate to Procurement”
  - “Duplicate found: escalation | Procurement”
- Reading the main line left to right: Budget check → Duplicate & ghost worker → Business sign-off → Rate over card? → Rate review → Value band → Finance sign-off / Executive sign-off → Tell the supplier → End. The Flagged line of Duplicate & ghost worker goes to “Duplicate found: escalation”, which continues to Business sign-off.
- There is no box or button called “Request approval”, and no box opens a separate approval screen.

**Cleanup** none (the next test resets).

#### UI-N4 · An Approve step explains itself

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openStep(“Business sign-off”).

**Then**

- The panel heading is “Approve” with sub-heading “Business sign-off”.
- Top to bottom it shows: “Name” (value “Business sign-off”); “Who approves” dropdown reading “Roles”; the sentence “Hiring manager, Cost center owner approve, together. Levv finds the right person for each request.”; a multi-select dropdown reading “Hiring manager, Cost center owner”; “How many” dropdown reading “Everyone, together”; the note “Approvers get a brief: what’s asked, what changed, and the result of any checks earlier on the line.”; the Chaser box (UI-N5); a collapsed “Advanced”; the button “Delete this step”.

**Cleanup** none (the next test resets).

#### UI-N5 · The Chaser is built into the step

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openStep(“Business sign-off”).
2. In the Chaser box read the two number boxes.
3. Change “Remind after (hours)” to 12.
4. openTest(“Operations analyst”).

**Then**

- The Chaser box has the heading “Chaser” with the tag “built in”, a number box “Remind after (hours)” = 24, a number box “Then escalate to their manager after (hours)” = 48, and the line “Runs by itself while this step waits. Reminders stop the moment someone acts.” No error is shown (UI-ESC-03 covers the validation).
- After step 3 the Test card “Business sign-off” has the message “Together. If rejected: back to the requester to fix. Chaser reminds after 12h and escalates to their manager after 48h”.
- The whole Test panel equals EN-050.

**Cleanup** set “Remind after (hours)” back to 24.

#### UI-N6 · Chaser is on every step that waits on a person, not in the rail

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“Assignment ending”).
2. openStep(“Extend or end?”).
3. openWorkflow(“Contractor onboarding”).
4. openStep(“Background check”).

**Then**

- “Extend or end?” is a Task panel with a Chaser box: “Remind after (hours)” = 48, “Then escalate to their manager after (hours)” = 96.
- “Background check” is a Collect & verify panel with a Chaser box: “Remind after (hours)” = 48, “Then escalate to the hiring manager after (hours)” = 96 (it is provided by the Worker).
- The Digital Workers rail on Assignment ending lists exactly: Tenure & classification, Rate check, Budget check, Duplicate & ghost worker, Job posting writer, Invoice match. On Contractor onboarding it lists exactly: Document collector, Access provisioner, Start-date guardian. Neither contains “Chaser”, and no workflow’s rail contains “Chaser” (check all 15).
- The “+” step menu on any line has no “Chaser” and no “Update record” (UI-I1 lists the full menu).

**Cleanup** none (the next test resets).

### B.2 Approval routing (A1–A19)

#### UI-A1 · The variation runs, rules are added

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“UK Technology work orders”).
2. openTest(“Senior cloud engineer”).

**Then**

- The top bar reads “UK Technology work orders ▾” and “Live v3”. The Start box reads “Work order submitted | UK · Technology”.
- “Try a record” is a vertical single-select list (`role="radiogroup"`, one `role="radio"` row per record; final decisions (00 §3) T7). It lists exactly these rows, in order (line 1 / line 2): “Senior cloud engineer” / “WO-2214 · Worked example 1”, “Data engineer, trading data” / “WO-2240 · Regulated role, possible duplicate”, “Operations analyst” / “WO-2231 · Catch-all flow, requester is an approver”, “Cleared engineer, project Atlas” / “WO-2260 · Custom fields”, “Data platform engineer, Germany” / “WO-2270 · No eligible Privacy reviewer; Security delegate not eligible”, “Analytics lead, split funding” / “WO-2275 · Raised on behalf of the manager, two cost centers”, “Ops contractor, no rate card yet” / “WO-2280 · Missing information”. The “Senior cloud engineer” row has `aria-checked="true"`; ArrowDown moves the selection to the next row and re-runs Test. No pills.
- The Test heading is “Test” with sub-heading “Senior cloud engineer”.
- Summary: “3 approval rounds on this path. Approval rules add approvers: Client data access, UK off-payroll (IR35).”
- Rate review round: “Procurement (Owen Clarke)”. Finance sign-off round: “VP Finance (David Okafor)”.
- Under Business sign-off’s round line there is the rule-task line “Task: Record IR35 status · Tax (Mei Lin). Must be done before the request is approved” (final decisions (00 §3) T12, engine D5).
- The whole Test panel equals EN-022.
- Then openWorkflow(“Work order submitted”) (Test stays open on the same record): the notices include “For real requests, “UK Technology work orders” runs for this record.” (engine D16) and the panel equals EN-015.

**Cleanup** none (the next test resets).

#### UI-A2 · Nobody approves their own request

**Given** a freshly reset app, then the When steps of UI-A1 repeated (tests stay independent).

**When**

1. Read the Business sign-off card.

**Then**

- Its round line contains the note “Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK)” and the people “Hiring manager’s manager (Alan Brooks)” first. (Exact text from EN-022: people “Hiring manager's manager (Alan Brooks), Information Security (Ravi Kumar), Privacy (Fatima Zahra)”.)

**Cleanup** none (the next test resets).

#### UI-A3 · One person is asked once

**Given** a freshly reset app, then the When steps of UI-A1 repeated (tests stay independent).

**When**

1. Read the Business sign-off card.

**Then**

- Its notes include “Alan Brooks also covers Cost center owner. Same kind of decision, so one approval”, and “Cost center owner” does not appear as a separate seat in the round.

**Cleanup** none (the next test resets).

#### UI-A4 · A flagged check escalates first

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“UK Technology work orders”).
2. openTest(“Data engineer, trading data”).

**Then**

- The card “Duplicate found: escalation” has status “Escalated”, the message “They must approve (it carries on), reject with a comment (it stops), or send it back to the requester. Chaser reminds after 24h and escalates to their manager after 48h”, and round “Procurement (Owen Clarke)”.
- The card “Duplicate & ghost worker” has status “Flagged” and message “Same person is active through another supplier (WO-1877)”.
- Business sign-off’s round includes “Compliance (Daniel Osei)”. The notice “Marked: Registration required (later steps can react to this)” is shown under the summary.
- The whole Test panel equals EN-023.

**Cleanup** none (the next test resets).

#### UI-A5 · A flagged check can reject

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“UK Technology work orders”).
2. openStep(“Duplicate & ghost worker”).
3. choose(“If it flags something”, “Reject it and send it back to the requester”).
4. openTest(“Data engineer, trading data”).

**Then**

- The “If it flags something” dropdown offers exactly, in order: “Carry on: the flag is recorded”, “Escalate: someone must decide”, “Reject it and send it back to the requester”, “Stop the workflow and tell someone”.
- The canvas no longer has “Duplicate found: escalation”; the Flagged line ends in a box “Rejected | Rejected”, and the check’s box reads “Flagged | Passed | Duplicate & ghost worker | If flagged: rejected”.
- Summary: “No one needs to approve on this path. Rejected at “Duplicate & ghost worker”. It goes back to the requester with the reason; Levv tells Hiring manager.” The text “Approval rules add approvers” does not appear.
- The line “Marked: Registration required (later steps can react to this)” is not shown (engine D20; **DEVIATION**: the prototype shows it).
- Before step 3, with Escalate selected, the panel shows “Escalate to” = “Procurement”, the say box “They must act. Approve (it carries on), reject with a comment (it stops), or send it back to the requester.” and the number box “Escalate after (hours)” = 48 (UI §7.6; final decisions (00 §3) T5).
- The whole Test panel equals EN-042.

**Cleanup** openStep(“Duplicate & ghost worker”), choose(“If it flags something”, “Escalate: someone must decide”). Then the Flagged line goes to a box “Duplicate & ghost worker flagged: escalation” (Escalate to: Procurement, Escalate after 48) and Test of “Data engineer, trading data” equals EN-043.

#### UI-A6 · If → Otherwise rejects

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openStep(“Rate over card?”).
2. In the Otherwise card, choose(“Then”, “Reject it and send it back to the requester”).
3. openTest(“Operations analyst”).

**Then**

- The Otherwise “Then” dropdown offered exactly: “Carry on to “Value band””, “Ask someone to approve”, “Escalate: someone must decide”, “Reject it and send it back to the requester”, “Stop the workflow and tell someone”.
- The canvas card “Rate over card?” reads “Rate over card? | Over 10% | → Rate review | Otherwise | rejected” and a box “Rejected” with a red ✕ ends the Otherwise line. (**DEVIATION**: the prototype shows “Over 10% | carries on” because it recomputes where the paths meet; production keeps `mergeAt` = Value band, D22.)
- Summary: “1 approval round on this path. Rejected at “Rate over card?”. It goes back to the requester with the reason; Levv tells Hiring manager.” Only the Business sign-off card has a round (“Hiring manager (Raj Patel)”).
- The whole Test panel equals EN-044.

**Cleanup** openStep(“Rate over card?”), Otherwise → choose(“Then”, “Carry on to “Value band””). The card reads “Rate over card? | Over 10% | → Rate review | Otherwise | carries on” and Test of “Operations analyst” equals EN-017. (**DEVIATION**: the prototype reconnects Otherwise to Rate review here; see the round-trip test in A.4.)

#### UI-A7 · If → Otherwise escalates to a group

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openStep(“Rate over card?”).
2. Otherwise → choose(“Then”, “Escalate: someone must decide”).
3. choose(“Escalate to”, “Finance controllers”).
4. openTest(“Operations analyst”).

**Then**

- After step 2 the Otherwise card shows “Escalate to” (default “Cost center owner”), the line “They must act: approve (it carries on), reject with a comment, or send it back to the requester.” and a number box “Escalate after (hours)” = 48 (UI §7.2; the prototype labels it “If they don’t act within (hours), it goes to their manager”).
- The canvas card reads “Rate over card? | Over 10% | → Rate review | Otherwise | escalate · Finance controllers”, and a new box “Otherwise: escalation | Finance controllers” sits on the Otherwise line.
- Test card “Otherwise: escalation”: status “Escalated”, round “Finance controllers (any one of Chloe Martin, Lena Fischer, David Okafor)” (engine D11; **DEVIATION**: the prototype repeats the group name inside the brackets).
- Summary “2 approval rounds on this path.”; there is no Rate review card. The whole Test panel equals EN-045.

DEVIATION from the automated browser run and the human script: see EN-045.

**Cleanup** Otherwise → choose(“Then”, “Carry on to “Value band””); the “Otherwise: escalation” box disappears and the card is back to the seed text.

#### UI-A8 · If → a path asks someone to approve

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openStep(“Rate over card?”).
2. Otherwise → choose(“Then”, “Ask someone to approve”).
3. choose(“Who approves”, “Chloe Martin”).
4. openTest(“Operations analyst”).

**Then**

- After step 2 the Otherwise card shows “Who approves” (default “Procurement”) and the line “Then it carries on to “Value band”.”
- The canvas card reads “Rate over card? | Over 10% | → Rate review | Otherwise | approval · Chloe Martin”, and a box “! | Otherwise: approval | Chloe Martin · no backup” sits on the Otherwise line. The Nova count is “1”: ““Otherwise: approval” names Chloe Martin with no backup. If they’re away, it pauses.” (warning; see LP-06).
- Test card “Otherwise: approval”: status “Approval”, round “Chloe Martin”. The next card is “Tell the supplier” (status “Sent”), not Rate review.
- The whole Test panel equals EN-046.

DEVIATION from the human script (“then Rate review”): see EN-046.

**Cleanup** Otherwise → choose(“Then”, “Carry on to “Value band””); the card reads “Rate over card? | Over 10% | → Rate review | Otherwise | carries on” and the Nova count is “0”.

#### UI-A9 · An approver only sometimes needed

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“Assignment changed”).
2. openTest(“Data analyst extension and rate rise”).

**Then**

- “Try a record” lists the rows “Data analyst extension and rate rise” / “ASN-881 · Worked example 2, edit mid-approval” and “Analyst rate change, two proposals” / “ASN-920 · Two pending changes”. The button “Try an edit: Manager shortens the extension to Mar 31” is shown.
- Summary “4 approval rounds on this path.” Cards with rounds (each person followed by the decision so far, engine D7): Tenure review (“HR business partner (Erin Walsh): Approved, Legal (Luis Romero): Waiting”), Budget owner (“Cost center owner (Lena Fischer): Approved”), Finance sign-off (“VP Finance (David Okafor): Waiting”), Rate review (“Procurement (Owen Clarke): Waiting”).
- After “Try an edit”: Budget owner reads “Cost center owner (Lena Fischer): Stands”, Finance sign-off and Rate review “…: Waiting”, Tenure review is gone, and a block “Removed by the edit” follows the step cards with the lines “HR business partner: approved, no longer needed” and “Legal: withdrawn, approver told”.
- The canvas card “Rate review” reads “Rate review | Procurement · only if Bill rate change (%) > 5%”.
- The whole Test panel equals EN-006. Clicking “Try an edit: Manager shortens the extension to Mar 31” makes it equal EN-063 and the button reads “Undo the edit”.

**Cleanup** click “Undo the edit” if it was clicked.

#### UI-A10 · Absence covered by a delegate

**Given** a freshly reset app, then the When steps of UI-A9 (without the edit) repeated (tests stay independent).

**When**

1. Read the Tenure review card.

**Then**

- Round: “HR business partner (Erin Walsh): Approved, Legal (Luis Romero): Waiting” with the note “Hannah Brooks is out until Oct 24. Delegated to Luis Romero” (with the frozen `asOf` 2026-10-20).

**Cleanup** none (the next test resets).

#### UI-A11 · Ineligible delegate → backup

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“UK Technology work orders”).
2. openTest(“Senior cloud engineer”).

**Then**

- Business sign-off notes include “Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves” and the round includes “Information Security (Ravi Kumar)”.

**Cleanup** none (the next test resets).

#### UI-A12 · Split funding

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openTest(“Analytics lead, split funding”).

**Then**

- Business sign-off round: “Hiring manager (Omar Haddad), Cost center owner (Lena Fischer), Cost center owner (Alicia Ng)” with notes “Omar Haddad is the hiring manager on the record (raised by Coordinator)”; “Charged to Finance, so its cost center owner approves”; “Charged to Marketing, so its cost center owner approves”.
- Then Rate review (“Procurement (Owen Clarke)”) and Finance sign-off (“Finance business partner (Chloe Martin)”).
- The whole Test panel equals EN-020.

**Cleanup** none (the next test resets).

#### UI-A13 · Missing information

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openTest(“Ops contractor, no rate card yet”).

**Then**

- Summary: “1 approval round on this path. Needs information: Rate vs rate card (%) is missing, so “Rate over card?” can’t decide. Procurement (Owen Clarke) has been asked to fill it in.”
- The path chips are “Budget check → Passed”, “Duplicate & ghost worker → Passed”, “Rate over card? → Needs information”, and there are no cards after Business sign-off.
- The whole Test panel equals EN-021.

**Cleanup** none (the next test resets).

#### UI-A14 · Running total; not asked again

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“SOW change order submitted”).
2. openTest(“Document review: third top-up”).

**Then**

- The notice reads “Comparing the running total of changes: $360K since the original $820K. This change alone is $60K” (no full stop at the end).
- Card “Procurement review”: status “Not asked again”, message “Procurement: approved the original; nothing they depend on changed”.
- Card “Finance review”: status “Approval”, round “Finance business partner (Chloe Martin)”. The path chips are “Scope changed? → No”, “Value band → Over $250K”.
- The whole Test panel equals EN-039.

DEVIATION from the human script, the automated browser run and the prototype (“Finance and VP review: Covered”, path “Value band → Over $1M”): see EN-039.

**Cleanup** none (the next test resets).

#### UI-A15 · Approved automatically inside the plan

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“Job posting created”).
2. openTest(“Junior data analyst, 6 months (job posting)”).

**Then**

- Summary: “No one needs to approve on this path. Approved automatically. No one had to act.”
- Card “Approve within plan”: status “Approved automatically”, message “Approved automatically: fits the approved plan”. Card “Send to suppliers”: status “Sent”, message “Email to Procurement (Owen Clarke)”.
- The whole Test panel equals EN-036.

**Cleanup** none (the next test resets).

#### UI-A16 · Approved automatically on matching hours

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“Timesheet submitted”).
2. openTest(“Timesheet, week of Oct 12”).

**Then**

- Card “Approve scheduled hours”: “Approved automatically” · “Approved automatically: hours match the schedule and work order”. Card “Tell the supplier it can invoice”: “Sent” · “Email to Supplier account manager”.
- The whole Test panel equals EN-040.

**Cleanup** none (the next test resets).

#### UI-A17 · Two changes at once

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“Assignment changed”).
2. openTest(“Analyst rate change, two proposals”).
3. Click “Use $96/h”.
4. Click “Undo”.
5. Click “Use $102/h”.
6. Click “Undo”.

**Then**

- After step 2: summary “Nothing is approved yet: approvals wait until one of the two proposed changes is chosen.”; a box with the badge “Conflict” and the text “Two proposed changes to the bill rate: $96/h from Grace Kim and $102/h from Raj Patel. Nothing is overwritten; approvals wait until one version is chosen.” and buttons “Use $96/h”, “Use $102/h”; card “Rate review” · “Not needed” · “Only needed when Bill rate change (%) > 5%”. Equals EN-007.
- After step 3: equals EN-061 (notice “Using $96/h from Grace Kim. Raj Patel has been told, and approval links for the other version no longer work.” with an “Undo” button).
- After step 4: back to the step-2 state. After step 5: equals EN-062. After step 6: back to the step-2 state.

**Cleanup** none (the next test resets).

#### UI-A18 · Nova writes a condition from plain words

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openStep(“Rate review”).
2. openAdvanced().
3. In the “Only needed when” box (placeholder “e.g. the bill rate goes up more than 5%, or the work country is UK”) type “rate is more than 15% over the rate card”.
4. Click “✦ Set”.
5. openTest(“Senior cloud engineer”).

**Then**

- Before step 3 the Advanced section shows “Only needed when” with the help line “Leave empty and this approver is always asked. Tell Nova when they’re needed, in your own words.”
- After step 4 the panel shows “Read as: asked only if Rate vs rate card (%) > 15%. Check it below, then Test.”, an “Asked only if” group reading “all of these”, and one condition row: field “Rate vs rate card (%)”, operator “>”, value 15. The row has “×”, and the group has “+ Add a condition”, “+ Add an either/or condition” and “Always ask this approver”.
- The canvas card reads “Rate review | Procurement · only if Rate vs rate card (%) > 15%”.
- Test equals EN-052 (Rate review: “Not needed” · “Only needed when Rate vs rate card (%) > 15%”).

**Cleanup** click “Always ask this approver”; the condition row disappears and the card reads “Rate review | Procurement”.

#### UI-A19 · A named person without a backup is flagged

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openStep(“Rate review”).
2. choose(“Who approves”, “A named person”).
3. choose(“Person”, “Chloe Martin”).
4. Click “Nova”.

**Then**

- After step 2 the panel shows “Person” reading the placeholder “Choose a person” (nothing is picked for you; final decisions (00 §3) T4), “Backup when they’re away” (= “No backup”, shown as a real value) and the line “A named person doesn’t follow reorgs. If they leave or change role, Nova flags every step that names them.” The canvas box reads “! | Rate review | Choose who approves” and the Nova count is “1” (““Rate review” doesn’t say who approves yet.”). **DEVIATION**: the prototype picks Alan Brooks automatically.
- The “Person” list has 31 people, each “Name” or “Name · Title” (for example “Alan Brooks · Head of Technology UK”, “Chloe Martin”).
- After step 3 the canvas card reads “! | Rate review | Chloe Martin · no backup”. The top bar shows “Live v1 · unpublished changes” and the Nova count “1”.
- The Nova panel (heading “Nova”, sub-heading “Checks and suggestions”) says “Nova checked this flow against 140 real records from the last 90 days.” and lists one item labelled “Check”: ““Rate review” names Chloe Martin with no backup. If they’re away, it pauses.” with a “Show me” button that selects the Rate review box.
- See LP-06 for the engine side and for choosing a backup.

**Cleanup** none (the next test resets).

### B.3 Building approvals in a workflow (I1–I12)

Setup for every I-test: picker → “+ New workflow”. It opens as a draft “New workflow” with Start → End; the top bar reads “New workflow”, “Draft”; the toast reads “New draft. Set when it runs, then press + to add steps”; Workflow settings opens with “Draft” / “Publish it to make it active.”, “Runs when” = “Work order submitted”, and “When a request is finally rejected, tell” = “Hiring manager” (stored at creation, shown once the first Approve step exists; final decisions (00 §3) T2). The Start box reads “Work order submitted | Everywhere”. Because “Work order submitted” is also Everywhere, Nova reports the overlap from the start (L14, final decisions (00 §3) T9): “Overlaps with “Work order submitted” on 140 past records (Everywhere and Everywhere). Set which one wins before publishing.” is listed as “Fix before publishing” in every I-test, so the Nova counts below include it. Each I-test continues from the previous one in the same page; the reset runs before UI-I1 only. Run them as one Playwright `test.describe.serial` block.

#### UI-I1 · Add an Approve step

**Given** the I-setup above.

**When**

1. Click “Add a step here” on the line after Start.
2. Read the menu.
3. Click “Approve”.

**Then**

- The menu is titled “Add a step” with sub-heading “Workflows do the work” and has exactly these groups and items: search box (placeholder “Search steps and Digital Workers”) · DECIDE: If (“Split the path using any field, including your own”) · APPROVALS: Approve (“Roles sign off. Levv finds the right people”), Auto-approve (“Approve instantly and keep an audit receipt”), Fits plan? (“Check the request fits a budget Finance already approved”) · PEOPLE: Collect & verify (“Ask for documents or checks and verify them, automatically or by a person”), Task (“A to-do for a person that isn’t a yes/no decision”) · SYSTEMS: System (“Create, update or check something in another system”), Notify (“Send an FYI, no action needed”) · TIMING: Wait (“Pause for a set time, or until a date on the record (e.g. 5 working days before the start date)”), Parallel (“Run branches at the same time”), Run workflow (“Start another workflow”) · DIGITAL WORKERS: Tenure & classification (“Counts months engaged and tenure caps”), Rate check (“Compares the rate with the rate card and market”), Budget check (“Checks budget left after this request”), Duplicate & ghost worker (“Finds the same person under another supplier”), Job posting writer (“Turns a plain request into a job posting”; **DEVIATION**, UI §16.16: the prototype says “… into a requisition”), Invoice match (“Matches invoices to time and milestones”, with the badge “Needs setup”). Group headings are drawn in capitals by CSS. There is no “Update record”, no “Chaser”, no “Request approval”.
- A box appears between Start and End with title “Approval” and subtitle “Choose who approves”, with a “!” marker (final decisions (00 §3) T4; **DEVIATION**, UI §16.3: the prototype shows “Approve” on the canvas).
- The panel heading is the kind “Approve” with sub-heading “Approval”; it shows “Name” (value “Approval”, placeholder “Approve”), “Who approves” = “Roles”, the line “Pick roles. Levv finds the right person for each request.”, a multi-select dropdown with placeholder “Choose roles”, the brief note, the Chaser box (24 / 48), “Advanced” and “Delete this step”. There is no “How many” until two roles are chosen.
- The Nova count is “2”: ““Approval” doesn’t say who approves yet.” and the overlap (LP-01).

Engine: the inserted node is A.4 “Insert an Approve step on a line”; Test of it is EN-075 (DEVIATION).

**Cleanup** none (the I-tests continue).

#### UI-I2 · Pick who approves and test

**Given** UI-I1 state.

**When**

1. searchPick(“Who approves” roles dropdown, “cost”) — i.e. click the “Choose roles” dropdown, type “cost”, press Enter.
2. Press Escape.
3. openTest(“Operations analyst”).

**Then**

- While typing, the list shows exactly one option, “Cost center owner”. After Enter it is ticked and the list stays open; after Escape it closes and the field reads “Cost center owner”.
- The sentence reads “Cost center owner approve. Levv finds the right person for each request.” The canvas box reads “Approval | Cost center owner”; the Nova count is “1” (only the overlap remains, so the box has no “!”).
- Summary “1 approval round on this path.”; card “Approval” · “Approval” · round “Cost center owner (Raj Patel)”. Equals EN-076.

**Cleanup** none (the I-tests continue).

#### UI-I3 · Add an If in front of it

**Given** UI-I2 state.

**When**

1. Click “Close” on the Test panel.
2. Click “Add a step here” on the line after Start, then “If”.

**Then**

- The If panel (heading “If”, sub-heading “Over $500K?”) shows “Levv checks the paths from the top and takes the first one that matches. If none match, it goes to “No”. All paths meet again at “Approval”.”
- Path card 1: “Take this path when” [all ▾] “of these are true:” with one row “Total value” “≥” (value 500000), “+ Add a condition”, “+ Add an either/or condition”, then “Then” = “Carry on to “Approval””. The “No” card reads “when none of the paths above match” and its Then = “Carry on to “Approval””. Then “+ Add a path”, “+ Add a step after the paths meet”, “Advanced”, “Delete this step”.
- Each “Then” dropdown offers exactly: “Carry on to “Approval””, “Ask someone to approve”, “Escalate: someone must decide”, “Reject it and send it back to the requester”, “Stop the workflow and tell someone”.
- The canvas If box reads “Over $500K? | ! | Yes | carries on | No | carries on”; Nova count “2” (““Over $500K?” sends every path to the same place, so it does nothing yet.” plus the overlap).

**Cleanup** none (the I-tests continue).

#### UI-I4 · Values are a searchable dropdown

**Given** UI-I3 state.

**When**

1. In path 1 choose(field dropdown, “Engagement type”).
2. Click the value dropdown (placeholder “Choose values”), type “off”, press Enter, press Escape.
3. Clear the path name box (accessible name “Path name”, placeholder “Name this path”) and type “Off-payroll”.

**Then**

- The field list offers 32 fields in this order: Total value, Bill rate per hour, Work country, Business unit, Job family, Engagement type, Client data access, Vendor’s digital worker has system access, Regulated role, Non-standard terms, Scope changed, Fields changed, Hours over schedule, Registration required, Manager chose to extend, Urgent start, Cost center, Legal entity, Site, Worker type, Worker is a former employee, Supplier tier, Rate vs rate card (%), Rate vs market median (%), Budget left after request, Months engaged after change, Possible duplicate worker, Days until start date, Invoice matches time and work order, Bill rate change (%), Security clearance, Project code. (The apostrophe in “Vendor’s” may be straight; 1.3.)
- After choosing Engagement type the operator reads “is”. The value list, before typing, shows Off-payroll, Payrolled, Fixed fee, Time and materials; while “off” is typed only “Off-payroll” is listed; after Enter it is ticked; the field reads “Off-payroll”.
- The canvas If box reads “Over $500K? | ! | Off-payroll | carries on | No | carries on”. The stored path is `{"f":"engagement","op":"in","v":["Off-payroll"]}`.
- No pills anywhere in the panel (UI-NP-01 rule applied to this panel).

**Cleanup** none (the I-tests continue).

#### UI-I5 · No can escalate

**Given** UI-I4 state.

**When**

1. In the “No” card choose(“Then”, “Escalate: someone must decide”).

**Then**

- An “Escalate to” dropdown reading “Cost center owner” and the number box “Escalate after (hours)” = 48 appear, with the line “They must act: approve (it carries on), reject with a comment, or send it back to the requester.” (UI §7.2.) Opening the new “No: escalation” box shows the same 48 in its Chaser “Then escalate to their manager after (hours)” (one timer, final decisions (00 §3) T5).
- The canvas If box reads “Over $500K? | Off-payroll | carries on | No | escalate · Cost center owner”, and one new box “No: escalation | Cost center owner” appears on the No line only.
- Test of “Operations analyst” equals EN-082.

**Cleanup** none (the I-tests continue).

#### UI-I6 · A new path doesn’t inherit another path’s steps

**Given** UI-I5 state.

**When**

1. Click “+ Add a path”.

**Then**

- A card “2” appears with name “Path 2”, one row “Total value” “≥” (100000) and Then “Carry on to “Approval””. Both path cards now have “Delete path”.
- The explanation now ends “If none match, it goes to “Otherwise”. All paths meet again at “Approval”.” The last card is titled “Otherwise”.
- The canvas If box reads “Over $500K? | Off-payroll | carries on | Path 2 | carries on | Otherwise | escalate · Cost center owner”; the escalation box now reads “Otherwise: escalation | Cost center owner”; Path 2’s line goes straight to “Approval”.

**Cleanup** none (the I-tests continue).

#### UI-I7 · A path routes to its own approver

**Given** UI-I6 state.

**When**

1. In Path 2 choose(“Then”, “Ask someone to approve”).
2. choose(“Who approves”, “Procurement”).

**Then**

- The canvas If box reads “Over $500K? | Off-payroll | carries on | Path 2 | approval · Procurement | Otherwise | escalate · Cost center owner”, and a box “Path 2: approval | Procurement” appears on its own line.
- Path 2 shows “Then it carries on to “Approval”.”
- Test of “Operations analyst” equals EN-086; of “Senior cloud engineer” equals EN-087.

**Cleanup** none (the I-tests continue).

#### UI-I8 · A path can reject

**Given** UI-I7 state.

**When**

1. In Off-payroll choose(“Then”, “Reject it and send it back to the requester”).

**Then**

- A box “Rejected | Rejected” appears at the end of the Off-payroll line. Its icon is a red circled ✕ (colour `#fb7185` in the prototype), not a green tick. The canvas If box reads “… Off-payroll | rejected | Path 2 | approval · Procurement | Otherwise | escalate · Cost center owner”.
- Test of “Senior cloud engineer” equals EN-089 (summary “No one needs to approve on this path. Rejected at “Over $500K?”. It goes back to the requester with the reason; Levv tells Hiring manager.” — the new workflow’s default final-rejection recipient, final decisions (00 §3) T2; **DEVIATION**: the prototype stores no recipient).

**Cleanup** none (the I-tests continue).

#### UI-I9 · At least one path must carry on

**Given** UI-I8 state.

**When**

1. In Path 2 choose(“Then”, “Reject it and send it back to the requester”).
2. In Otherwise choose(“Then”, “Reject it and send it back to the requester”).

**Then**

- Step 1 is accepted (the Path 2 box becomes “Rejected | Rejected”).
- Step 2 is refused: the toast reads “At least one path has to carry on”, and the Otherwise “Then” still reads “Escalate: someone must decide”; the box “Otherwise: escalation” is still there.

**Cleanup** none (the I-tests continue).

#### UI-I10 · Paths can be deleted

**Given** UI-I9 state.

**When**

1. Click “Delete path” on Path 2.

**Then**

- The toast reads “Path deleted”. The panel has the Off-payroll card and the Otherwise card only; Off-payroll no longer shows “Delete path” (only one path left). Path 2’s Rejected box is gone; the canvas If box reads “Over $500K? | Off-payroll | rejected | Otherwise | escalate · Cost center owner”.

**Cleanup** none (the I-tests continue).

#### UI-I11 · Either/or condition

**Given** UI-I10 state.

**When**

1. In the Off-payroll card click “+ Add an either/or condition”.

**Then**

- A box appears reading “Either/or:” [any one ▾] “of these” with “×”, two rows (“Total value” “≥” 250000; “Regulated role” “is yes”) and “+ Add another option”.
- The path rule reads “Engagement type is Off-payroll and (Total value ≥ $250K or Regulated role is yes)” (wherever the UI summarises it; the engine function `rowsText` must return exactly this).

**Cleanup** none (the I-tests continue).

#### UI-I12 · A path with no conditions is flagged

**Given** UI-I11 state.

**When**

1. Click “×” on every condition row and on the either/or box in the Off-payroll card until it has no conditions.
2. Click “Nova”.

**Then**

- The Nova panel says “Nova checked this flow against 140 real records from the last 90 days.” and lists exactly two items, in any order: “Check” · “Path “Off-payroll” in “Over $500K?” has no conditions, so it matches everything.” with “Show me”, and “Fix before publishing” · “Overlaps with “Work order submitted” on 140 past records (Everywhere and Everywhere). Set which one wins before publishing.” with “Choose which wins”.
- The canvas If box shows the “!” marker. Test of “Operations analyst” now equals EN-096.

**Cleanup** none (the reset runs before the next test).

### B.4 Workflows (W1–W15)

#### UI-W1 · Standard onboarding

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“Contractor onboarding”).
2. openTest(“Senior cloud engineer”).

**Then**

- “Try a record” lists the rows “Senior cloud engineer” / “WO-2214-A · Onboarding, standard”, “Data engineer, trading data” / “WO-2240-A · Onboarding, regulated role”, “Analyst, checks need attention” / “WO-2251-A · ID unclear, background adverse”. There is no summary box (no Approve step in this workflow and no approval rule matches onboarding records).
- Path chip: “Registration required? → No”. Card “Vendor insurance”: “Review: Procurement” · “Asked of Supplier account manager: Certificate of insurance. Waiting for Procurement (Owen Clarke)”. Card “Laptop and badge”: “Review: IT service desk” · “Asked of IT service desk (Sam Patel): Laptop, Building badge. Waiting for IT service desk (Sam Patel)”. Card “Legal & compliance”: “Verified automatically” · “… Verified by E-signature”. Card “Workday provisioning”: “Done in Workday”.
- Every Collect & verify card has a “Worker sees: …” line.
- The whole Test panel equals EN-001.

**Cleanup** none (the next test resets).

#### UI-W2 · Onboarding when checks go wrong

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“Contractor onboarding”).
2. openTest(“Analyst, checks need attention”).

**Then**

- Card “Identity & eligibility”: “Unsure: People Ops” · “Asked of the worker: Photo ID, Right to work. Persona wasn't sure, so People Ops (Jordan Lee) reviews”.
- Card “Background check”: “Failed: decision needed” · “Asked of the worker: Criminal record, Employment history. Failed. HR business partner and Legal must decide whether to carry on” · round “HR business partner (Erin Walsh), Legal (Luis Romero)” with note “Hannah Brooks is out until Oct 24. Delegated to Luis Romero” (engine D17; **DEVIATION**: the prototype drops the “Asked of …” prefix).
- System access reads “Waiting” · “Waiting on Background check” (engine D4; **DEVIATION**: the prototype says “Waiting on Registration required?”); Wait for start date and Payroll & banking read “Waiting”.
- The whole Test panel equals EN-003.

**Cleanup** none (the next test resets).

#### UI-W3 · Offboarding

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“Contractor offboarding”).
2. openTest(“Cloud engineer, not extended”).

**Then**

- “Try a record” lists the rows “Cloud engineer, not extended” / “OFF-902” followed by “ · ” and the empty note, and “Data analyst, ended early (ended early)” / “OFF-915 · Ended early”.
- Cards: “Knowledge handover” (“To do: Hiring manager” · “Confirm handover is done: Hiring manager (Tom Reed)”), “Final timesheet & expenses” (“Review: Hiring manager”), “Return equipment” (“To do: IT service desk”), “Exit confirmations” (“Verified automatically”), then five cards reading “Waiting”.
- The whole Test panel equals EN-008.

**Cleanup** none (the next test resets).

#### UI-W4 · Extend or end

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“Assignment ending”).
2. openTest(“Designer, manager extends”).
3. openTest(“Cloud engineer, ending Nov 16”).

**Then**

- After step 2 the Test panel equals EN-005: “Extend or end?” · “Done” · “Decide whether to extend: done by Hiring manager (Sofia Reyes)”; “Tenure & classification” · “Passed” · “12 months engaged after this change (cap 18)”; “Within plan?” · “Inside the plan”; “Auto-approve if no one else needed” · “Approved automatically” · “Approved automatically: inside plan, no threshold crossed”.
- After step 3 it equals EN-004: path “Extending? → No”; “Confirm the end date” · “Sent” · “Email to Hiring manager (Tom Reed), Supplier account manager”.

**Cleanup** none (the next test resets).

#### UI-W5 · Invoice exception and straight-through

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“Invoice received”).
2. openTest(“Invoice doesn’t match timesheets”).
3. openTest(“Invoice matches”).

**Then**

- After step 2 it equals EN-013: “Resolve exception” · “To do: Accounts payable” · “Resolve the invoice exception with the supplier: Accounts payable (Nina Shah)”.
- After step 3 it equals EN-014: “Release for payment” · “Done in SAP S/4HANA” · “Update supplier invoice in SAP S/4HANA, matched on Work order ID, 2 fields sent; reads back Posting status; waits up to 24h for SAP S/4HANA to confirm”.

**Cleanup** none (the next test resets).

#### UI-W6 · Document renewal

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“Document renewal”).
2. openTest(“Forklift certificate expiring”).

**Then**

- One card “Renewed document” · “Verified automatically” · “Asked of the worker: Updated certificate. Verified by Document collector” · “Worker sees: Done”. Equals EN-012.

**Cleanup** none (the next test resets).

#### UI-W7 · A change has its own approvals

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“Work order changed”).
2. Look at the canvas.
3. openTest(“Senior cloud engineer — rate change”).

**Then**

- The canvas has its own boxes: “Work order changed | Everywhere”, “Tell the supplier | Supplier account manager”, “End | Completed”, “Business sign-off | Together: Hiring manager + Cost center owner”, “Rate over card? | Over 10% | → Rate review | Otherwise | carries on”, “Rate review | Procurement”, “Value band | Over $1M | → Executive sign-off | Over $250K | → Finance sign-off | Otherwise | carries on”, “Finance sign-off | Finance business partner”, “Executive sign-off | In order: VP Finance + CFO”, “Flagged | Passed | Budget check | If flagged: approvers see it”, “Flagged | Passed | Duplicate & ghost worker | If flagged: escalate to Procurement”, “Duplicate found: escalation | Procurement”.
- Summary “1 approval round on this path.”; Business sign-off round “Hiring manager (Tom Reed), Cost center owner (Alan Brooks)” with note “Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK)”; then “Tell the supplier” · “Sent”.
- The whole Test panel equals EN-041.

**Cleanup** none (the next test resets).

#### UI-W8 · Access request, clean

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“Site access request”).
2. openTest(“Visiting engineer, 2 weeks on site”).

**Then**

- The Start box reads “Access request submitted in Zip | Everywhere”.
- “Duplicate & ghost worker” · “Passed” · “No active badge or open request for this person”; “Security approves access” · “Approval” · round “Information Security (Ravi Kumar)” with the Kenji Watanabe backup note; “Identity & site details” · “Asked of Worker (Jordan Ellis): Photo ID, Date of birth, Signed site safety rules. Verified by Persona”; “Issue the badge” · “Done in Badge system”; “Badge ready” · “Email to Worker (Jordan Ellis), Sponsor (Grace Kim, or their delegate Raj Patel)”.
- The whole Test panel equals EN-010.

**Cleanup** none (the next test resets).

#### UI-W9 · Access request, already badged

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“Site access request”).
2. openTest(“Returning vendor technician”).

**Then**

- “Duplicate & ghost worker” · “Flagged” · “This person already has an active badge from an earlier request”; “Duplicate & ghost worker flagged: escalation” · “Escalated” · round “Information Security (Ravi Kumar)”; “Security approves access” · “Covered” · “The same person already approves this kind of decision on this path”.
- The whole Test panel equals EN-011.

**Cleanup** none (the next test resets).

#### UI-W10 · The sponsor can provide instead

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“Site access request”).
2. openStep(“Identity & site details”).
3. choose(“Who provides it”, “Sponsor”).
4. openTest(“Visiting engineer, 2 weeks on site”).

**Then**

- The canvas box’s title is “Identity & site details” and its subtitle “Sponsor provides · Persona, then Information Security” (the box also has “Done” / “Failed” exit labels because If it fails is Escalate, final decisions (00 §3) T5).
- The Chaser box now reads “Then escalate to their manager after (hours)” (a sponsor is not the worker or the supplier, engine V7).
- Card “Identity & site details” message: “Asked of Sponsor (Grace Kim, or their delegate Raj Patel): Photo ID, Date of birth, Signed site safety rules. Verified by Persona”. Equals EN-056.

**Cleanup** choose(“Who provides it”, “Worker”).

#### UI-W11 · The worker never approves

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“Assignment ending”).
2. openStep(“Extend or end?”); open the “Who” dropdown; read it; Escape.
3. openWorkflow(“Work order submitted”).
4. openStep(“Business sign-off”); open the roles dropdown; read it; Escape.
5. On “Duplicate & ghost worker” open “Escalate to”; on Contractor onboarding → “Background check” open the “If it fails” deciders dropdown; read both.

**Then**

- The Task “Who” list is exactly (24): Worker, Sponsor, Hiring manager, Hiring manager's manager, Cost center owner, Department head, SOW owner, HR business partner, Information Security, Privacy, Legal, Compliance, Tax, Procurement, Finance business partner, Supplier account manager, VP Finance, CFO, People Ops, IT service desk, Accounts payable, Finance controllers, Security review board, Executive committee. It starts with Worker, Sponsor, Hiring manager.
- The approver roles list is exactly (17): Sponsor, Hiring manager, Hiring manager's manager, Cost center owner, Department head, SOW owner, HR business partner, Information Security, Privacy, Legal, Compliance, Tax, Procurement, Finance business partner, Supplier account manager, VP Finance, CFO. It has no “Worker”.
- Neither the check’s “Escalate to” list nor the Collect & verify “If it fails” lists contain “Worker”. The failure lists do offer the operational roles People Ops, IT service desk and Accounts payable (final decision (00 §3) T11, engine §16.11; **DEVIATION**: the prototype offers only approver roles to the deciders).

**Cleanup** none (the next test resets).

#### UI-W12 · System failure path

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“Contractor offboarding”).
2. openStep(“Remove access”).
3. choose(“If it fails”, “Then take a Failed path (add your own steps)”).
4. choose(“If it fails”, “Then give someone a task to fix it”).

**Then**

- The “If it fails” dropdown offers exactly: “Then give someone a task to fix it”, “Then take a Failed path (add your own steps)”, “Then pause the workflow and alert the owner”, with the line “Levv retries 3 times over an hour first.”
- After step 3 the canvas box reads “Done | Failed | Remove access | Close or deactivate user in Okta” (a Failed exit appears). After step 4 it reads “Remove access | Close or deactivate user in Okta” again (no Failed exit).

**Cleanup** none (the next test resets).

#### UI-W13 · Deleting a check keeps the line

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openStep(“Budget check”).
2. Click “Delete this step”.

**Then**

- Toast “Step deleted. Lines reconnected” with an “Undo” link (UI §14.1). The Budget check box is gone; Start’s line goes straight to “Duplicate & ghost worker”; the other 11 boxes are unchanged (the UI-N3 list minus Budget check). The top bar status reads “Live v1 · unpublished changes”.
- Test of “Operations analyst” equals EN-058.

**Cleanup** none (the next test resets).

#### UI-W14 · Wait follows the record’s date

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“Contractor onboarding”).
2. openStep(“Wait for start date”).

**Then**

- Panel heading “Wait”, sub-heading “Wait for start date”: “Wait” = “Until a date on the record”; “Offset” 0 with unit “days”; “Before or after” = “Before”; “Date” = “Start date”; “At” 09:00; “Time zone” = “The worker’s”; the sentence “Waits until Start date, 09:00 in the worker’s time zone. If the date on the record changes, the wait moves with it.”; “Delete this step”.
- The canvas box reads “Wait for start date | Until Start date, 09:00”.

**Cleanup** none (the next test resets).

#### UI-W15 · A failed check asks people to decide

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“Contractor onboarding”).
2. openStep(“Background check”).

**Then**

- The line “Adverse results go to the people set under “If it fails”. The worker can’t start until they decide.” is shown.
- “If it fails” reads “Ask people to decide”; next to it a multi-select (placeholder “Choose who decides”) reads “HR business partner, Legal”; under it “They approve to carry on, or reject to stop.” There is no control to pick a separate approval flow, and the box has no “Failed” exit (that only exists for Escalate, UI-ESC-04).

**Cleanup** none (the next test resets).

### B.5 Dropdowns and workflow settings (D1–D5)

#### UI-D1 · Applies to is a searchable dropdown

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“Job posting created”).
2. Click the Start box (panel “Workflow settings”).
3. Record the canvas scroll position and zoom.
4. searchPick(“Work country”, “can”), keeping the list open to read it, then Escape.

**Then**

- Before typing, the Work country list shows UK, Canada, US, Germany (none ticked) and the footer “None selected: applies to all” with “Clear”.
- While “can” is typed only “Canada” is listed. After Enter it is ticked, the footer reads “1 selected”, and after Escape the field reads “Canada”.
- The summary line under Applies to reads “Applies to: Canada. Several picks in one field means any of them; fields combine with AND. Levv reads these from the record.” The Start box reads “Job posting created | Canada”.
- The canvas scroll position and zoom are unchanged.

**Cleanup** open Work country and click “Clear”; the field reads “Any work country” and Applies to reads “Everywhere”.

#### UI-D2 · Scrolling keeps the list attached

**Given** a freshly reset app at **1440×600** on Job posting created, Start box open, “More: site, worker type, job family” expanded, and the Site field scrolled to the middle of the panel.

**When**

1. Open the “Site” dropdown.
2. Scroll the panel down by 60 px (mouse wheel over the panel).
3. Scroll the panel back to the top.

**Then**

- The list shows London, New York, Toronto, Frankfurt, Remote. Its top edge is 4 px (±1) below the Site field’s bottom edge.
- After step 2 the field has moved up and the list’s top edge is again 4 px (±1) below the field; the list is still open.
- After step 3 the field is below the bottom of the window and the list is closed.

**Cleanup** none (the next test resets).

#### UI-D3 · Who hears about a final rejection

**Given** a freshly reset app; openWorkflow(“Job posting created”) and click the Start box.

**When**

1. Read the panel.

**Then**

- It shows “When a request is finally rejected, tell” with a dropdown reading “Hiring manager”, and the line “Each Approve step decides whether a rejection goes back to the requester first. This is who hears when it’s final.”
- The panel order is (UI §7.1): Active row, Name, Runs when (“Job posting created”), Starts from (“Levv”), When a request is finally rejected, tell, “Applies to (leave empty for everything)” (Business unit, Cost center, Legal entity, Work country, “More: site, worker type, job family”), the Applies-to summary, Advanced (Effective date, Owner). There is no work-order note on this workflow (it only shows for Work order records: “When the work order is approved, here or in SAP Fieldglass, Contractor onboarding starts by itself.”).

**Cleanup** none (the next test resets).

#### UI-D4 · Owner is a dropdown

**Given** a freshly reset app; openWorkflow(“Job posting created”) and click the Start box.

**When**

1. openAdvanced().
2. Open “Owner”.
3. Type “hr”, press Enter.

**Then**

- Advanced shows “Effective date” (2026-09-01) and “Owner”. Owner reads “Procurement operations”. The list has two group headings, “Teams” (Accounts payable, Compliance, Finance operations, HR operations, IT operations, Information Security, Legal operations, Procurement operations, Security operations, Tax) and “A person” (the 31 people).
- With “hr” typed the list shows “HR operations” under Teams and “Fatima Zahra · Privacy lead” under A person. After Enter the list closes and Owner reads “HR operations”.

**Cleanup** choose(“Owner”, “Procurement operations”).

#### UI-D5 · Who approves is never pills

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openStep(“Business sign-off”).
2. Open “Who approves”; read; Escape.
3. Open the roles dropdown; read; Escape.
4. choose(“Who approves”, “An approval group”).

**Then**

- “Who approves” offers exactly “Roles”, “An approval group”, “A named person” (single select; picking closes the list).
- The roles list is a multi-select (“2 selected”, Clear) with the 17 roles of UI-W11 and no Worker.
- After step 4 a group dropdown shows the placeholder “Choose a group” and no sentence; the canvas box reads “! | Business sign-off | Choose who approves” and Test shows “Choose who approves” (final decisions (00 §3) T4; **DEVIATION**: the prototype picks Finance controllers for you). choose(group, “Finance controllers”) (options: Finance controllers, Security review board, Executive committee) then shows “Finance controllers: Chloe Martin, Lena Fischer, David Okafor. Any one of them can approve.” and the box reads “Business sign-off | Finance controllers”.
- No pill, chip, toggle-button group, radio button, checkbox or native select is visible in the panel.

**Cleanup** choose(“Who approves”, “Roles”) and re-tick Hiring manager and Cost center owner if they were cleared (the reset also restores them).

### B.6 Active / inactive and publishing (P1–P6)

#### UI-P1 · Switch a workflow off

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“Job posting created”).
2. Click the Start box.
3. Turn the “Active” switch off.

**Then**

- Before: the switch reads “Active” with “New events start this workflow.”
- After: it reads “Inactive” with “Nothing new uses this workflow. Anything already running finishes on it. Turn it back on any time.” and the warning “No other active workflow covers every job posting, so new job postings that only this one covers won’t start or be approved until one is active. Nothing is approved automatically.”
- Toast: ““Job posting created” is inactive. It can’t be deleted, only turned back on”. Top bar status: “Inactive · v1”. In the picker the second line of Job posting created reads “Inactive · Everywhere”.
- Turning the switch off on “UK Technology work orders” instead shows only the first sentence block (no warning), because “Work order submitted” still covers every work order.
- Turning it off on “Site access request” shows the warning with proper plurals: “No other active workflow covers every access request, so new access requests that only this one covers won’t start or be approved until one is active. Nothing is approved automatically.” (engine D29). Turning a workflow back on shows the toast ““{name}” is active again”.

**Cleanup** turn “Active” back on; the status reads “Live v1”.

#### UI-P2 · Test on an inactive workflow says so

**Given** a freshly reset app, then the When steps of UI-P1 repeated (Job posting created is Inactive).

**When**

1. openTest(“Junior data analyst, 6 months (job posting)”).
2. Turn “Active” back on.

**Then**

- The Test panel shows the inactive note first, above the summary (UI §16.24; **DEVIATION**: the prototype shows it under the summary): “This workflow is inactive. Real requests don’t use it. Below is what it would do if you turned it back on.” Otherwise it equals EN-059.
- After step 2 the status reads “Live v1” and the notice is gone.

**Cleanup** none (the next test resets).

#### UI-P3 · Nothing can be deleted

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. For each of the 15 workflows: open it from the picker, click the Start box, expand Advanced, and collect every visible button, link and menu item in the top bar, the picker and the Workflow settings panel.

**Then**

- None of them contains “Delete”, “Remove”, “Archive” or “Discard” (case-insensitive). The only lifecycle control is the “Active” switch (draft workflows show “Draft · Publish it to make it active.” instead).
- Step panels still have “Delete this step” and If panels “Delete path”; those edit the draft and are allowed.

**Cleanup** none (the next test resets).

#### UI-P4 · Publish is blocked when nobody approves

**Given** a freshly reset app.

**When**

1. Picker → “+ New workflow”.
2. Click “Add a step here” after Start → “Approve”; leave Who approves empty.
3. Click “Publish”.

**Then**

- The dialog is titled “Publish “New workflow”” and reads, in order: “Applies to new runs. 140 records in the last 90 days would have started this workflow. Anything already running keeps its current version.”; the must-fix row “× ““Approval” doesn’t say who approves yet.”” (icon ×, text ““Approval” doesn’t say who approves yet.”); the overlap question “This overlaps “Work order submitted” on 140 records. Which one should run?” with a dropdown “Choose…” (options “New workflow”, “Work order submitted”; identical Everywhere scopes, final decisions (00 §3) T9); “Goes live on” = 2026-12-01; “Cancel” and “Send for approval”.
- “Send for approval” is disabled. After closing the dialog and choosing “Cost center owner”, it is still disabled until the overlap is answered; after choosing “New workflow” in the overlap dropdown, “✓ Ready to send for approval.” is shown and the button is enabled.

**Cleanup** none (the next test resets).

#### UI-P5 · Overlaps are caught at publish

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“Data and AI hires”) (status “Draft”).
2. Click “Publish”.
3. Open the “Which one should run?” dropdown; read; choose “Data and AI hires”.

**Then**

- The dialog reads “Applies to new runs. 26 records in the last 90 days would have started this workflow. Anything already running keeps its current version.” and “This overlaps “UK Technology work orders” on 2 records. Which one should run?” with a dropdown reading “Choose…”. “Send for approval” is disabled.
- The dropdown offers exactly “Data and AI hires”, “UK Technology work orders”. After choosing, “✓ Ready to send for approval.” appears and “Send for approval” is enabled. Nothing changes on either workflow until a second person approves (LP-10 has the full flow, ending in “Live v1”).

**Cleanup** click “Cancel”.

#### UI-P6 · Impact before going live

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“Site access request”).
2. Click “Publish”.
3. Click “Send for approval”.

**Then**

- The dialog reads “Applies to new runs. 0 records in the last 90 days would have started this workflow. Anything already running keeps its current version.”, “✓ Ready to send for approval.”, “Goes live on” = 2026-10-20 (the effective date 2026-10-01 is in the past, so it defaults to today; a past date shows “Pick today or a later date.” and disables Send; UI §10.1), “Cancel”, “Send for approval” (enabled).
- After step 3 the dialog reads “Sent for approval. Anyone with the “Approve flow changes” permission can approve it. You can’t approve your own change.” with a single “Close” button, and the top bar status reads “Waiting for approval”. There is no “Sent to Samira Khan” and no “Approve as Samira (demo)” anywhere (final decision (00 §3) T9; **DEVIATION**). Full flow in LP-11.

**Cleanup** click “Close”.

### B.7 The dropdown component

Every choice in Flow Studio uses one component. These tests run on fields named in each test but the rules apply to every instance.

#### UI-DD-01 · Search filters the list

**Given** Job posting created → Start box open.

**When**

1. Open “Work country”.
2. Type “can”.
3. Clear the search and type “zzz”.

**Then**

- On open the search box (accessible name “Search”, placeholder “Search…”) has focus and is empty; the first option is highlighted.
- With “can” only “Canada” is listed (match is case-insensitive “contains”).
- With “zzz” the list shows “No matches” and no options.

**Cleanup** Escape.

#### UI-DD-02 · Multi select stays open, counts, and Clear

**Given** Job posting created → Start box open.

**When**

1. Open “Work country”; click “UK”; click “Canada”; click “US”; click “Germany”.
2. Click “Clear”.
3. Press Escape.

**Then**

- After each click the list stays open, the search text is kept, and the clicked option is ticked. The footer reads “1 selected”, “2 selected”, “3 selected”, “4 selected”; the field reads “UK”, “UK, Canada”, “UK, Canada +1”, “UK, Canada +2”.
- After Clear nothing is ticked, the footer reads “None selected: applies to all” (Applies-to fields; other multi-selects say “None selected”), the field shows its placeholder “Any work country”, and Applies to reads “Everywhere”. The list stays open.
- Escape closes the list and focus returns to the field button.

**Cleanup** none (the next test resets).

#### UI-DD-03 · Single select (radio style) closes on pick

**Given** Contractor onboarding → “Identity & eligibility” open.

**When**

1. Open “How it’s verified”.
2. Click “A person reviews”.

**Then**

- The list offers “Automatically”, “Automatically, a person if unsure” (ticked), “A person reviews”, has no footer and no Clear.
- After the click the list closes immediately, the field reads “A person reviews”, and the step’s `verify` is “person”; the panel still shows “Reviewer” (“People Ops”).

**Cleanup** choose(“How it’s verified”, “Automatically, a person if unsure”).

#### UI-DD-04 · Keyboard: arrows, Enter, Escape, Tab

**Given** Job posting created → Start box open.

**When**

1. Open “Work country”.
2. Press ArrowDown twice, then ArrowUp once.
3. Press Enter.
4. Press ArrowUp five times.
5. Press Escape.
6. Open it again and press Tab.

**Then**

- After step 2 the highlighted option is “Canada” (UK → Canada → US → Canada). Highlight never wraps.
- Enter toggles the highlighted option (Canada ticked) and, because this is a multi-select, the list stays open.
- ArrowUp stops on the first option (“UK”).
- Escape closes the list and focuses the field button. Tab closes the list.
- On a single-select (for example “Runs when”) Enter picks the highlighted option and closes the list.

**Cleanup** open Work country, Clear, Escape.

#### UI-DD-05 · “+ Add “Visa letter”” adds an item

**Given** Contractor onboarding → “Identity & eligibility” open.

**When**

1. Open “What’s required” (reads “Photo ID, Right to work”).
2. Type “Visa letter”.
3. Press Enter.
4. Type “photo”, press Enter, press Escape.

**Then**

- On open the list shows the 24 common items with Photo ID and Right to work ticked first, then the rest alphabetically (Bank details, Building badge, Certificate of insurance, Code of conduct, Company data returned or deleted, Confidentiality reminder acknowledged, Contractor agreement, Credit check, Criminal record, Date of birth, Employment history, Final expenses, Final timesheet, Laptop, Non-disclosure agreement, Professional licence, Proof of address, Regulatory registration, Sanctions check, Signed site safety rules, Tax forms, Updated certificate); footer “2 selected”.
- With “Visa letter” typed the list shows only “+ Add “Visa letter””, highlighted.
- After Enter the item is added and ticked, the search is cleared, the list stays open, “Visa letter” is listed third (ticked items first), the footer reads “3 selected”, and the field reads “Photo ID, Right to work +1”. The step’s `items` is `["Photo ID","Right to work","Visa letter"]`.
- With “photo” typed the list shows “Photo ID” (ticked) and “+ Add “photo”” (the add option appears unless the text equals an item exactly, ignoring case). Enter toggles the highlighted “Photo ID” off; `items` becomes `["Right to work","Visa letter"]` and the field reads “Right to work, Visa letter”.

**Cleanup** none (the next test resets).

#### UI-DD-06 · The list stays open after toggling a multi option

**Given** Work order submitted → “Business sign-off” open.

**When**

1. Open the roles dropdown (“Hiring manager, Cost center owner”).
2. Click “Procurement”.
3. Click “Procurement” again.

**Then**

- After each click the list is still open, its scroll position is unchanged, and the footer reads “3 selected” then “2 selected”. The sentence above updates to “Hiring manager, Cost center owner, Procurement approve, together. …” and back.

**Cleanup** Escape.

#### UI-DD-07 · Click outside, resize and other fields close the list

**Given** Job posting created → Start box open.

**When**

1. Open “Work country”; click on an empty part of the canvas.
2. Open it again; resize the window to 1300×900.
3. Open it again; click the “Business unit” field.

**Then**

- Step 1 closes the list without changing the value. Step 2 closes the list. Step 3 closes the Work country list and opens the Business unit list. Only one list is ever open.

**Cleanup** resize back to 1440×900.

#### UI-DD-08 · Single select with groups

**Given** Job posting created → Start box open.

**When**

1. Open “Runs when”.

**Then**

- The list has 11 group headings in order: Job posting, Work order, SOW, Onboarding, Assignment, Offboarding, Access request, Timesheet, Expense, Invoice, Worker; 42 events under them, starting “Job posting created” (ticked, highlighted), “Job posting changed”, “Job posting approved”, “Job posting filled”, “Job posting withdrawn or cancelled”, “Work order submitted”…, and ending “Worker document expiring in N days”, “Worker document expired”. Day-based options that are not selected read “… in N days” (“Assignment end date in N days”; UI §7.1 item 4; **DEVIATION**: the prototype prints this workflow’s day count in every option). There is no footer.
- Typing “expired” leaves the heading “Worker” and the option “Worker document expired” only (headings with no matching option are hidden).

**Cleanup** Escape.

#### UI-DD-09 · The list follows its field when the panel scrolls (1440×600)

**Given** see UI-D2.

**When**

1. As UI-D2.

**Then**

- As UI-D2. In addition: the list opens below the field when the space below is at least min(220 px, space above), otherwise above it; its width is max(field width, 240 px) and its height at most 320 px.

**Cleanup** none (the next test resets).

#### UI-DD-10 · Dropdowns in the publish dialog

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“Data and AI hires”); click “Publish”; open “Which one should run?”.

**Then**

- It is the same component (search box, options “Data and AI hires”, “UK Technology work orders”, no pills), and choosing closes it (single select).

**Cleanup** click “Cancel”.

### B.8 No pills and no native selects anywhere

#### UI-NP-01 · Crawl every step panel of every workflow

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. For each of the 15 workflows in the picker: open it; for every box on the canvas (Start, every step, End): click it, expand every collapsed section (“Advanced”, “More: site, worker type, job family”), and inspect the panel.
2. Also inspect: the “+” step menu, the If panel after “+ Add a path”, the Approve panel after choosing “An approval group” and “A named person”, the publish dialog of “Data and AI hires”.

**Then**

- 159 boxes are visited: the seed’s 119 steps + 15 Start + 15 End, plus the 10 “… failed: escalation” steps that loading creates for Collect & verify steps whose If it fails is Escalate (data model §15 step 7; final decisions (00 §3) T5).
- In every panel, no visible element is a native `select`, an `input[type=radio]`, an `input[type=checkbox]` outside a dropdown list or the Active switch, or a pill/chip/segmented button group (any group of two or more toggle buttons representing one choice). Every choice is a button with `aria-haspopup="listbox"`.
- No page error is logged during the crawl (`page.on("pageerror")` collects nothing).

**Cleanup** none (the next test resets).

### B.9 Decisions made after the prototype

No prototype oracle for these; the expected text comes from the engine and UI specs and the final decisions in `00-overview.md` §3. Each is a **DEVIATION** from prototype v35.

#### UI-ESC-01 · One escalation timer on an If path (T5)

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openStep(“Rate over card?”); Otherwise → choose(“Then”, “Escalate: someone must decide”).
2. Set “Escalate after (hours)” to 72.
3. openStep(“Otherwise: escalation”).
4. In its Chaser set “Then escalate to their manager after (hours)” to 36.
5. openStep(“Rate over card?”).
6. openTest(“Operations analyst”).

**Then**

- After step 3 the generated step’s Chaser shows “Remind after (hours)” = 24 and “Then escalate to their manager after (hours)” = 72.
- After step 5 the Otherwise card’s “Escalate after (hours)” shows 36: both fields edit the same value (`RA_C1_else.sla`); nothing else stores escalation hours.
- Test card “Otherwise: escalation” ends “Chaser reminds after 24h and escalates to their manager after 36h”.

**Cleanup** none (the next test resets).

#### UI-ESC-02 · One escalation timer on a check (T5)

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“UK Technology work orders”); openStep(“Duplicate & ghost worker”).
2. Set “Escalate after (hours)” to 24 and, on “Duplicate found: escalation”, set “Remind after (hours)” to 12.
3. openTest(“Data engineer, trading data”).

**Then**

- The check panel’s “Escalate after (hours)” and the escalation step’s Chaser “Then escalate to their manager after (hours)” both show 24.
- Test equals EN-065 (the escalation card ends “Chaser reminds after 12h and escalates to their manager after 24h”).

**Cleanup** none (the next test resets).

#### UI-ESC-03 · Escalation has to come after the reminder (T6)

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openStep(“Business sign-off”); set “Then escalate to their manager after (hours)” to 24 (equal to Remind after).
2. Click “Nova”.
3. Click “Publish”.
4. Close the dialog; set it to 12; then to 72.

**Then**

- After step 1 the text “Escalation has to come after the reminder.” appears under the two Chaser inputs, both inputs get the error style, and the typed values are kept (24 / 24). The Nova count is “1”.
- Nova lists “Fix before publishing” · ““Business sign-off”: escalation has to come after the reminder.” with “Show me”.
- The publish dialog lists the must-fix row “× ““Business sign-off”: escalation has to come after the reminder.”” and “Send for approval” is disabled.
- At 12 the error stays (12 ≤ 24). At 72 it disappears, the Nova count returns to “0” and Publish shows “✓ Ready to send for approval.”. The same rule applies to Task and Collect & verify Chasers and to the “Escalate after (hours)” fields (they edit an escalation step’s `sla`).

**Cleanup** none (the next test resets).

#### UI-ESC-04 · Collect & verify → If it fails → Escalate creates a step (T5)

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“Contractor onboarding”).
2. Look at the “Identity & eligibility” box and the canvas.
3. openStep(“Identity & eligibility”); choose(“If it fails”, “Ask people to decide”).
4. choose(“If it fails”, “Escalate: someone must decide”); set “Escalate after (hours)” to 60.
5. openStep(“Identity & eligibility failed: escalation”).

**Then**

- On load the box has two exits labelled “Done” and “Failed”; the Failed exit leads to a box “Identity & eligibility failed: escalation” (subtitle “People Ops”) that rejoins where Identity & eligibility’s normal (“Done”) exit goes. The same exists for every Collect & verify step whose If it fails is Escalate (10 in the seed).
- After step 3 the Failed exit and the generated box disappear, and the deciders dropdown (placeholder “Choose who decides”) appears with “They approve to carry on, or reject to stop.”
- After step 4 the escalate dropdown (accessible name “Escalate to”) reads “People Ops”, “Escalate after (hours)” reads 60, and the generated box is back.
- Step 5 opens an Approve panel (heading “Approve”) whose Chaser reads 24 / 60 “Then escalate to their manager after (hours)”.

**Cleanup** none (the next test resets).

#### UI-STOP-01 · “Stop the workflow and tell someone” ends stopped (T11)

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openStep(“Rate over card?”); Otherwise → choose(“Then”, “Stop the workflow and tell someone”).
2. Read “Who to tell”.
3. openTest(“Operations analyst”).

**Then**

- “Who to tell” defaults to “Hiring manager”. The card row reads “Otherwise | stop”; a box “Otherwise: tell them it stopped” (subtitle “Hiring manager”) leads to an End box whose subtitle is “Stopped”.
- Test equals EN-069: summary “1 approval round on this path. Stopped at “Rate over card?”. Levv tells Hiring manager.” and the card “Otherwise: tell them it stopped” · “Sent” · “Email to Hiring manager (Grace Kim)”.
- Then setting the “Over 10%” path to Stop as well is refused with the toast “At least one path has to carry on”.

**Cleanup** none (the next test resets).

#### UI-RULE-01 · Rule tasks and rule-only rounds are visible in Test (T12)

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openTest(“Senior cloud engineer”) on Work order submitted.
2. Picker → “+ New workflow”; add a Notify step “Tell the supplier” (Who to tell: Supplier account manager); openTest(“Senior cloud engineer”).

**Then**

- Step 1: under Business sign-off’s round line: “Task: Record IR35 status · Tax (Mei Lin). Must be done before the request is approved”; the panel equals EN-015.
- Step 2: a summary box appears although the workflow has no Approve step; above the step list a block titled “From approval rules” shows the round line “1 Information Security (Ravi Kumar), Privacy (Fatima Zahra) · Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves” and the IR35 task line; equals EN-071.

**Cleanup** none (the next test resets).

#### UI-BASIS-01 · Amount to compare for changes (D27)

**Given** a freshly reset app at 1440×900 on `/flow-studio/wf-wo-sub` (Work order submitted).

**When**

1. openWorkflow(“SOW change order submitted”); click the Start box.
2. openWorkflow(“Job posting created”); click the Start box.

**Then**

- The SOW change order settings show “Amount to compare for changes” reading “The running total of all changes” (options “The new total”, “The change amount”, “The running total of all changes”) and the help “Value conditions in this flow use this amount. Running total stops many small changes adding up past a limit unseen.”
- Job posting created (event created) has no such field.

**Cleanup** none (the next test resets).

#### UI-PERM-01 · Nobody else can approve flow changes (decision 9)

**Given** `POST /api/test/reset { actors: "author-only-approver" }` (only the author, Flow Admin, has “Approve flow changes”), then `signIn("Flow Admin")`.

**When**

1. openWorkflow(“Site access request”); click “Publish”.

**Then**

- The must-fix row “Nobody else can approve flow changes yet. Ask an admin to give someone the “Approve flow changes” permission.” is shown and “Send for approval” is disabled.

**Cleanup** none (the next test resets).

## 4. Part C — Lint, Nova and publish tests

Lint is a pure function `lintWorkflow(workflow, ctx) → LintResult` (engine §12). Its `issues` use the `Issue` type of data model §13 exactly: `{ sev: 'bad' | 'warn' | 'tip' | 'info'; m: string; node?: string; fix?: string; fl?: string; overlap?: string }`, where `overlap` is the id of the other workflow. The expectations below list `issues`; a property that is not listed must be absent (no case here has a one-click fix, so `fix` and `fl` are absent). `bad` blocks publishing, `warn`, `tip` and `info` do not. Nova shows the items with labels: `bad` → “Fix before publishing”, `warn` → “Check”, `tip` → “Suggestion”, `info` → no label; “Show me” when it names a step, “Choose which wins” on an overlap. The Nova count in the top bar is the number of `bad` + `warn` items. Publish review is a pure function `publishReview(workflow, ctx, precedence?) → PublishReview` over `history-records.json` (engine §13), using the type of data model §13 exactly: `{ impact: number; mustFix: Issue[]; overlaps: Overlap[]; openOverlaps: Overlap[]; canSend: boolean; effective: string }` with `Overlap = { id, name, scope, priority, count }`. `precedence` is the overlap choice made in the open dialog (engine §13.3); an overlap stays in `openOverlaps` until a choice is given or a priority exists. The impact count is the prototype’s: records with the same record type and event whose values fall inside this workflow’s Applies to (it does not subtract records a narrower workflow would take). Each test has an engine half (Vitest, exact data) and a UI half (Playwright, exact text), unless marked. Where several items are listed they may come in any order unless stated.

Publishing actors (fixture `seed/test-actors.json`, 06 §1.2): the signed-in author **Flow Admin** (edits workflows, has “Approve flow changes”), the approver **Samira Khan** (admin, so she has “Approve flow changes”), and **Grace Kim** (no flow permission). The approver is any user with “Approve flow changes” other than the author (final decision (00 §3) T9).

#### LP-01 · An Approve step with nobody chosen blocks publish (P4)

- Setup: new workflow with one Approve step and empty Who approves (A.3 I1 graph).
- Engine: items, in any order: `{ "sev": "bad", "node": "n102", "m": "“Approval” doesn’t say who approves yet." }` (L11) and `{ "sev": "bad", "overlap": "wf-wo-sub", "m": "Overlaps with “Work order submitted” on 140 past records (Everywhere and Everywhere). Set which one wins before publishing." }` (L14, identical Everywhere scopes). `publishReview`: `impact` 140, `mustFix` = `[{ "sev": "bad", "node": "n102", "m": "“Approval” doesn’t say who approves yet." }]` (overlaps are not must-fix rows), `overlaps` = `openOverlaps` = `[{ "id": "wf-wo-sub", "name": "Work order submitted", "scope": {}, "priority": null, "count": 140 }]`, `canSend` false, `effective` "2026-12-01".
- UI: UI-P4. Nova count “2”.

#### LP-02 · A named Approve step emptied on a live workflow

- Setup: Work order submitted, `RA_A2.roles = []`.
- Engine: `[{ "sev": "bad", "node": "RA_A2", "m": "“Rate review” doesn’t say who approves yet." }]`.
- UI: Top bar “Live v1 · unpublished changes”, Nova count “1”; the publish dialog lists the row and disables “Send for approval”.

#### LP-03 · An escalation step with nobody

- Setup: Work order submitted, `RA_CDe.roles = []`.
- Engine: `[{ "sev": "bad", "node": "RA_CDe", "m": "“Duplicate found: escalation” doesn’t say who approves yet." }]`.
- UI: Publish blocked with that row.

#### LP-04 · Ask people to decide with nobody chosen

- Setup: Contractor onboarding, `BG.failRoles = []`.
- Engine: `[{ "sev": "bad", "node": "BG", "m": "“Background check” doesn’t say who decides when it fails." }]`.
- UI: Nova “Fix before publishing …”; publish blocked.

#### LP-05 · Empty path

- Setup: I12 graph; separately Work order submitted with `RA_C1.outs[0].rows = []`; separately with `RA_C2.outs[0].rows = []`.
- Engine: I12: the L10 item `{ "sev": "warn", "node": "n103", "m": "Path “Off-payroll” in “Over $500K?” has no conditions, so it matches everything." }` (plus the overlap item). Live `RA_C1`: `[{ "sev": "warn", "node": "RA_C1", "m": "Path “Over 10%” in “Rate over card?” has no conditions, so it matches everything." }]`. Live `RA_C2` (not the last path): `[{ "sev": "warn", "node": "RA_C2", "m": "Path “Over $1M” in “Value band” has no conditions, so it matches everything and the paths below it never run." }]`.
- UI: UI-I12. A warning does not block: for the live cases the dialog shows “✓ Ready to send for approval.”

#### LP-06 · Named person without a backup

- Setup: Work order submitted, Rate review → A named person → Chloe Martin (setup of EN-055).
- Engine: `[{ "sev": "warn", "node": "RA_A2", "m": "“Rate review” names Chloe Martin with no backup. If they’re away, it pauses." }]`. With `backup: "Lena Fischer"` the list is `[]` and Test is unchanged (round “Chloe Martin”). The same warning appears for “Otherwise: approval” in UI-A8 and for Hannah Brooks in EN-067.
- UI: UI-A19; then choose(“Backup when they’re away”, “Lena Fischer”): the Nova count returns to “0”, the panel says “Looks good” / “Nothing to fix.”, and the box subtitle reads “Chloe Martin · backup Lena Fischer”. Publish shows “✓ Ready to send for approval.” in both cases.

#### LP-07 · An If that sends every path to the same place

- Setup: Work order submitted, `RA_C1.outs[0].to = "RA_C2"`; and the I3 graph.
- Engine: Live: `[{ "sev": "warn", "node": "RA_C1", "m": "“Rate over card?” sends every path to the same place, so it does nothing yet." }]`. I3: the same message for “Over $500K?” (`node: "n103"`), plus the overlap item.
- UI: Nova “Check …”; not blocking.

#### LP-08 · Collect & verify that asks for nothing

- Setup: Contractor onboarding, `LB.items = []`.
- Engine: `[{ "sev": "warn", "node": "LB", "m": "“Laptop and badge” doesn’t ask for anything yet." }]`.
- UI: Nova “Check …”; not blocking.

#### LP-09 · Seed workflows: Nova and impact counts

- **DEVIATION**: the prototype’s Nova has no overlap check (engine D24), so it shows “Looks good” on “Data and AI hires”.
- Setup: seed as loaded (including the generated “… failed: escalation” steps).
- Engine: Every seed workflow lints clean except “Data and AI hires”, which gets the L14 overlap (engine §12.2: “With the seed every workflow has no issues … except “Data and AI hires””). Records per workflow, in picker order:

| Workflow | Records in the last 90 days | Nova header | Nova items | Publish dialog |
| --- | --- | --- | --- | --- |
| Job posting created | 50 | “Nova checked this flow against 50 real records from the last 90 days.” | none (“Looks good” / “Nothing to fix.”) | “✓ Ready to send for approval.” |
| Work order submitted | 140 | “Nova checked this flow against 140 real records from the last 90 days.” | none (“Looks good” / “Nothing to fix.”) | “✓ Ready to send for approval.” |
| UK Technology work orders | 16 | “Nova checked this flow against 16 real records from the last 90 days.” | none (“Looks good” / “Nothing to fix.”) | “✓ Ready to send for approval.” |
| Data and AI hires | 26 | “Nova checked this flow against 26 real records from the last 90 days.” | 1: “Fix before publishing” · “Overlaps with “UK Technology work orders” on 2 past records (Data and UK · Technology). Set which one wins before publishing.” | “This overlaps “UK Technology work orders” on 2 records. Which one should run?”, Send disabled |
| Work order changed | 0 | “No past records would have reached this flow. Nova checked the design only.” | none (“Looks good” / “Nothing to fix.”) | “✓ Ready to send for approval.” |
| SOW created | 36 | “Nova checked this flow against 36 real records from the last 90 days.” | none (“Looks good” / “Nothing to fix.”) | “✓ Ready to send for approval.” |
| SOW change order submitted | 24 | “Nova checked this flow against 24 real records from the last 90 days.” | none (“Looks good” / “Nothing to fix.”) | “✓ Ready to send for approval.” |
| Contractor onboarding | 40 | “Nova checked this flow against 40 real records from the last 90 days.” | none (“Looks good” / “Nothing to fix.”) | “✓ Ready to send for approval.” |
| Assignment changed | 60 | “Nova checked this flow against 60 real records from the last 90 days.” | none (“Looks good” / “Nothing to fix.”) | “✓ Ready to send for approval.” |
| Assignment ending | 30 | “Nova checked this flow against 30 real records from the last 90 days.” | none (“Looks good” / “Nothing to fix.”) | “✓ Ready to send for approval.” |
| Contractor offboarding | 0 | “No past records would have reached this flow. Nova checked the design only.” | none (“Looks good” / “Nothing to fix.”) | “✓ Ready to send for approval.” |
| Site access request | 0 | “No past records would have reached this flow. Nova checked the design only.” | none (“Looks good” / “Nothing to fix.”) | “✓ Ready to send for approval.” |
| Timesheet submitted | 60 | “Nova checked this flow against 60 real records from the last 90 days.” | none (“Looks good” / “Nothing to fix.”) | “✓ Ready to send for approval.” |
| Invoice received | 0 | “No past records would have reached this flow. Nova checked the design only.” | none (“Looks good” / “Nothing to fix.”) | “✓ Ready to send for approval.” |
| Document renewal | 0 | “No past records would have reached this flow. Nova checked the design only.” | none (“Looks good” / “Nothing to fix.”) | “✓ Ready to send for approval.” |
- UI: For each workflow the Nova count is “0”, except “Data and AI hires” (“1”); the publish dialog starts “Applies to new runs. N records in the last 90 days would have started this workflow. Anything already running keeps its current version.” with N from the table.

#### LP-10 · Overlap on publish: “Data and AI hires” vs “UK Technology work orders”

- **DEVIATION**: the prototype names Samira Khan, offers “Approve as Samira (demo)”, applies the priority choice before approval and publishes the draft as “Live v2” (final decisions (00 §3) T3 and T9; engine §13.4–§13.5; UI §16.31–33).
- Setup: seed as loaded; “Data and AI hires” is a never-published draft (`published: null`, so `version` 0 after load).
- Engine: `publishReview(wf-wo-sub-wo-data)`: `impact` 26, `mustFix` [], `overlaps` = `openOverlaps` = `[{ "id": "wf-wo-sub-wo-uk-tech", "name": "UK Technology work orders", "scope": { "country": ["UK"], "business_unit": ["Technology"] }, "priority": null, "count": 2 }]`, `canSend` false until a choice is made (with `precedence` given, `openOverlaps` = [] and `canSend` true). Choosing “Data and AI hires” stores `pending.precedence = { otherId: "wf-wo-sub-wo-uk-tech", winner: "self" }` on send; both workflows keep `priority: null` while it waits. When Samira Khan approves: `wf-wo-sub-wo-data.priority = 1`, `wf-wo-sub-wo-uk-tech.priority = 2`, `version` = 1, `status` = "live", a WorkflowVersion with `submittedBy` "Flow Admin" and `approvedBy` "Samira Khan". An approval attempted by the author returns an error and changes nothing. Publishing UK Technology work orders shows no overlap (the other one is a draft).
- UI: UI-P5, then “Send for approval”: “Sent for approval. Anyone with the “Approve flow changes” permission can approve it. You can’t approve your own change.” with one “Close” button; top bar “Waiting for approval”. After the approval is recorded as Samira Khan (`signIn("Samira Khan")`, then approve in `/inbox` or with `POST /api/flow-studio/publish-requests/:id/approve`; there is no approve button in Flow Studio), the test signs in as Flow Admin again and reloads the workflow: top bar “Live v1” and the toast “Published as v1, live on 20 Oct 2026”.

#### LP-11 · Site access request is ready to send: 0 records

- **DEVIATION**: the prototype pre-fills the past date 2026-10-01 and its toast says “live on 2026-10-01”; production defaults to today and formats the date (UI §10.1, §16.25).
- Setup: seed as loaded.
- Engine: `publishReview(wf-access)`: `impact` 0, `mustFix` [], `overlaps` [], `openOverlaps` [], `canSend` true; lint `issues` `[]`. After approval `version` = 2.
- UI: UI-P6; after Samira Khan approves (as in LP-10) and Flow Admin reloads the workflow: top bar “Live v2”, toast “Published as v2, live on 20 Oct 2026” (shown once; a second reload shows no toast, engine §13.5).

#### LP-12 · Identical “Everywhere” scopes overlap (T9)

- **DEVIATION**: the prototype does not treat identical scopes as an overlap (engine D24, UI §16.32).
- Setup: new workflow (Work order submitted, Everywhere) with an Approve step for Cost center owner.
- Engine: lint = `[{ "sev": "bad", "overlap": "wf-wo-sub", "m": "Overlaps with “Work order submitted” on 140 past records (Everywhere and Everywhere). Set which one wins before publishing." }]`. `publishReview`: `impact` 140, `overlaps` = `openOverlaps` = `[{ "id": "wf-wo-sub", "name": "Work order submitted", "scope": {}, "priority": null, "count": 140 }]`, `mustFix` [], `canSend` false. No overlap with “UK Technology work orders” (strictly inside) or “Data and AI hires” (draft). Choosing either option (passed as `precedence`) empties `openOverlaps` and makes `canSend` true; priorities change only on approval (winner `priority` 1, the other 2).
- UI: Dialog: impact 140, “This overlaps “Work order submitted” on 140 records. Which one should run?” with “Choose…” (options “New workflow”, “Work order submitted”), Send disabled; after choosing “✓ Ready to send for approval.” and Send enabled.

#### LP-13 · The approver is anyone with “Approve flow changes” except the author

- Setup: `seed/test-actors.json`, actor sets `default` and `author-only-approver` (06 §1.2).
- Engine: `canApprove(user, pending)` is true for Samira Khan, false for Flow Admin (author) and Grace Kim (no permission). If no user other than the author has the permission (`ctx.approverAvailability.othersCanApprove` false), `publishReview.mustFix` contains `{ "sev": "bad", "m": "Nobody else can approve flow changes yet. Ask an admin to give someone the “Approve flow changes” permission." }` and `canSend` is false.
- UI: UI-PERM-01; signed in as Grace Kim there is no way to approve; signed in as the author, the pending change shows no approve action.

#### LP-14 · Chaser: escalation has to come after the reminder (T6)

- **DEVIATION**: the prototype has no such check (engine D32).
- Setup: Work order submitted `RA_A1.remind = 24, sla = 24`; separately `sla = 12`; separately Assignment ending `K1.remind = 96, sla = 96`; separately `RA_CDe.sla = 24` (remind 24 by default).
- Engine: Each gives one bad item (L18): ““Business sign-off”: escalation has to come after the reminder.”, the same for `sla = 12`, ““Extend or end?”: escalation has to come after the reminder.”, ““Duplicate found: escalation”: escalation has to come after the reminder.”; `mustFix` contains that issue and `canSend` is false. `RA_A1.sla = 25` is valid.
- UI: UI-ESC-03.

#### LP-15 · Production-only Nova checks (D24: L13, L15, L16, L17) and L8/L9

- **DEVIATION**: L13, L15–L17 do not exist in the prototype (engine D24).
- Setup: Work order submitted with an extra unreachable Notify `{"id":"OLD","kind":"notify","label":"Old reminder","recipients":["hm"],"channel":"Email","outs":[{"key":"next","to":"END"}]}`; separately `RA_A2.roles = ["worker"]`; separately the D19 graph with `target` removed; separately a new workflow with a Wait `{"id":"HOLD","kind":"wait","label":"Hold","w":{"mode":"at"}}` (no `at`); separately the D18 Coupa graph; separately `RW.recipients = []`.
- Engine: “OLD”: `{ "sev": "warn", "node": "OLD", "m": "“Old reminder” can’t be reached from Start, so it never runs." }` · worker: `{ "sev": "bad", "node": "RA_A2", "m": "“Rate review” asks the worker to approve or decide. The worker can’t approve, review or be escalated to." }` · no target: `{ "sev": "bad", "node": "RW1", "m": "“Run workflow” doesn’t say which workflow to start." }` · Wait: `{ "sev": "warn", "node": "HOLD", "m": "“Hold” doesn’t have a date and time yet." }` · Coupa: `{ "sev": "warn", "node": "CP", "m": "“Raise purchase order” uses Coupa, which isn’t connected yet. It will give the work to a person until it is." }` · no recipients: `{ "sev": "warn", "node": "RW", "m": "“Tell the supplier” doesn’t tell anyone yet." }`. (New-workflow cases also carry the overlap item.)
- UI: Engine only (the UI cannot create an unreachable step or pick the worker as an approver).

#### LP-16 · “1 record” in the impact sentence (D26)

- **DEVIATION**: the prototype says “1 records”.
- Setup: any workflow with a history fixture holding exactly one matching record.
- Engine: `publishReview(…).impact` = 1.
- UI: The dialog reads “Applies to new runs. 1 record in the last 90 days would have started this workflow. Anything already running keeps its current version.”

## 5. Part D — Runtime: Pause, Resume, Stop

**NEW IN PRODUCTION — NO PROTOTYPE ORACLE.** The prototype only simulates workflows in Test; it has no running instances. Every running workflow in production must have manual Pause, Resume and Stop (engine §15.12: Pause freezes timers and stops new steps from starting; Resume restarts them with the remaining time; Stop cancels open steps and ends the run `stopped`). Data shapes follow data model §14 (`WorkflowRun`, `StepRun`, `RunEvent`). The run screens are specified elsewhere, so the UI strings below are proposed copy; once this file is accepted they are the oracle.

### 5.1 Fixtures for Part D

- **Run:** start `wf-wo-sub` for record `WO-2231` at 2026-10-20T09:00:00Z with the frozen clock (1.2). Engine: build the run from the `WO-2231` entry of `seed/runtime-records.json`. Browser: `POST /api/runtime/events` with header `x-levv-service-token` and `{ source: 'levv', recordType: 'work_order', recordId: 'WO-2231', event: 'submitted', data: <that record> }`. The engine’s plan for it is EN-017: Budget check and Duplicate & ghost worker pass instantly; the run waits at **Business sign-off** for Raj Patel, with the Chaser set to remind after 24h and escalate to his manager after 48h; “Tell the supplier” has not started.
- **Actors** (`seed/test-actors.json`, `default` set): `Owen Clarke` is a member of the owning team **Procurement operations** (owner of `wf-wo-sub`); `Samira Khan` is an admin; `Grace Kim` (the requester; `runs.view` only) and `Raj Patel` (the approver; no permissions) can neither pause, resume nor stop. Browser halves sign in with `signIn(name)`.
- **Engine API (suggested names; behaviour normative):** permission checks read the `default` actor set of `seed/test-actors.json`; `pauseRun(run, { by, reason? })`, `resumeRun(run, { by })`, `stopRun(run, { by, reason })`, each returning `{ ok: true, run }` or `{ ok: false, code, message }`; `advanceClock(ms)`; `run.status` ∈ `running | paused | stopped | completed | rejected`; Pause sets `pausedBy`, `pausedAt`, `pauseReason: 'manual'` (cleared on Resume); Stop sets `stoppedBy`, `stoppedAt`, `stopReason`; every action appends a `RunEvent` to `run.log`: `{ at, by, type: 'paused' | 'resumed' | 'stopped', m }` where `m` is the reason text (`''` when none); `run.steps[id].status` ∈ `pending | active | waiting | done | skipped | failed | cancelled`, with `remindAt` / `escalateAt` on waiting steps.
- **Server time in browser halves:** before each timed action the test calls `POST /api/test/clock { now }` with the time the engine half uses (for example 2026-10-20T10:00:00Z before pressing Pause in RT-01).
- **UI:** the run is shown on a run page with a status chip and the buttons “Pause”, “Resume” and “Stop”. Stopping asks for a reason in a dialog titled “Stop this workflow?” with the text “Steps that haven’t started will never start. This can’t be undone.”, a required text box “Reason”, “Cancel” and “Stop workflow” (disabled until the reason has a non-space character).

### 5.2 Tests

#### RT-01 · Running → paused

**Given** the 5.1 run, status `running`, waiting at Business sign-off.

**When** `pauseRun(run, { by: "Owen Clarke", reason: "Supplier dispute" })` at 2026-10-20T10:00:00Z.

**Then**

- `ok: true`; `run.status` = `paused`, `pausedBy` = "Owen Clarke", `pausedAt` = "2026-10-20T10:00:00.000Z", `pauseReason` = "manual"; Business sign-off stays `waiting` (nothing is cancelled).
- `run.log` gains `{ at: "2026-10-20T10:00:00.000Z", by: "Owen Clarke", type: "paused", m: "Supplier dispute" }`.
- UI (`POST /api/test/clock { now: "2026-10-20T10:00:00Z" }`, then Pause with reason “Supplier dispute”): the chip reads “Paused”; the buttons are “Resume” and “Stop” (no “Pause”); the history line reads “Paused by Owen Clarke on 20 Oct 2026, 10:00 UTC: Supplier dispute”.

#### RT-02 · Paused → running

**Given** RT-01 state.

**When** `resumeRun(run, { by: "Owen Clarke" })` at 2026-10-20T12:00:00Z.

**Then**

- `ok: true`; `run.status` = `running`; `pausedBy`/`pausedAt`/`pauseReason` are cleared; `run.log` gains `{ at: "2026-10-20T12:00:00.000Z", by: "Owen Clarke", type: "resumed", m: "" }`.
- UI (`POST /api/test/clock { now: "2026-10-20T12:00:00Z" }`, then Resume): chip “Running”; buttons “Pause” and “Stop”; history line “Resumed by Owen Clarke on 20 Oct 2026, 12:00 UTC”.

#### RT-03 · Pause reason is optional

**Given** the 5.1 run.

**When** `pauseRun(run, { by: "Owen Clarke" })`.

**Then**

- `ok: true`; the log entry has `m: ""`; UI history line “Paused by Owen Clarke on 20 Oct 2026, 09:00 UTC”.

#### RT-04 · Running → stopped needs a reason

**Given** the 5.1 run.

**When** `stopRun(run, { by: "Owen Clarke", reason: "" })`, then `stopRun(run, { by: "Owen Clarke", reason: "   " })`, then `stopRun(run, { by: "Owen Clarke", reason: "Request withdrawn by the hiring manager" })`.

**Then**

- The first two return `{ ok: false, code: "REASON_REQUIRED", message: "A reason is required to stop a workflow." }` and change nothing.
- The third returns `ok: true`; `run.status` = `stopped`, `stoppedBy` = "Owen Clarke", `stopReason` = "Request withdrawn by the hiring manager", `endedAt` set; Business sign-off becomes `cancelled`; “Tell the supplier” stays `pending`; `run.log` gains `{ at: "2026-10-20T09:00:00.000Z", by: "Owen Clarke", type: "stopped", m: "Request withdrawn by the hiring manager" }`.
- UI: in the Stop dialog “Stop workflow” is disabled while the Reason box is empty or spaces; after stopping the chip reads “Stopped”, no Pause/Resume/Stop buttons remain, and the history line reads “Stopped by Owen Clarke on 20 Oct 2026, 09:00 UTC: Request withdrawn by the hiring manager”.

#### RT-05 · Paused → stopped

**Given** RT-01 state (paused).

**When** `stopRun(run, { by: "Samira Khan", reason: "Duplicate request" })`.

**Then**

- `ok: true`; `run.status` = `stopped`; the log has the pause entry followed by `{ by: "Samira Khan", type: "stopped", m: "Duplicate request", … }`.

#### RT-06 · Stopped is final

**Given** RT-04 state (stopped).

**When** `resumeRun(run, { by: "Owen Clarke" })`, `pauseRun(run, { by: "Owen Clarke" })`, `stopRun(run, { by: "Owen Clarke", reason: "again" })`.

**Then**

- Each returns `{ ok: false, code: "RUN_STOPPED", message: "This workflow is stopped. It can’t be resumed." }`; status and log are unchanged.

#### RT-07 · Invalid transitions on a running or paused run

**Given** the 5.1 run.

**When** `resumeRun` while `running`; then pause it and call `pauseRun` again.

**Then**

- `resumeRun` on a running run returns `{ ok: false, code: "NOT_PAUSED", message: "This workflow isn’t paused." }`.
- A second `pauseRun` returns `{ ok: false, code: "ALREADY_PAUSED", message: "This workflow is already paused." }`. Neither adds a log entry.

#### RT-08 · Steps after a Stop never start

**Given** RT-04 state (stopped).

**When** Raj Patel tries to approve Business sign-off (through the approval link or API); then `advanceClock(7 days)`.

**Then**

- The approval is rejected with `{ ok: false, code: "RUN_STOPPED" }` and his approval link (`/inbox/[itemId]`, signed in as Raj Patel) shows “This request was stopped. No action is needed.”
- After 7 days no step has started: “Tell the supplier” is still `pending`; no notification, task, system call or approval request was sent after the stop time (assert the outbox is empty after the stop).

#### RT-09 · Chaser reminders are suspended while paused

**Given** the 5.1 run (Business sign-off waiting since 09:00 on 20 Oct; remind after 24h, escalate after 48h).

**When** At +10h pause; `advanceClock` to +40h (still paused); resume at +40h; then advance to +54h and to +78h.

**Then**

- While paused (to +40h) no reminder and no escalation is sent, although the 24h reminder time passes.
- The Chaser clock does not run while paused: the reminder is sent at +54h (24h of running time = 10h before the pause + 14h after resuming) and the escalation to Raj Patel’s manager at +78h (48h of running time).
- Exactly one reminder and one escalation are in the outbox at +78h. While paused Business sign-off keeps its remaining times; after resuming its `remindAt` = 2026-10-22T15:00:00.000Z (+54h) and `escalateAt` = 2026-10-23T15:00:00.000Z (+78h).

#### RT-10 · Nothing starts while paused

**Given** the 5.1 run paused at +1h.

**When** Raj Patel approves Business sign-off at +2h; `advanceClock` to +5h; resume at +5h.

**Then**

- His decision is recorded (Business sign-off `done`, approver Raj Patel, at +2h) but “Tell the supplier” does not start while paused.
- On resume “Tell the supplier” starts immediately (at +5h) and the run completes: `run.status` = `completed`.

#### RT-11 · Only the workflow owner or an admin

**Given** the 5.1 run.

**When** `pauseRun` / `stopRun` by `Grace Kim` (requester) and by `Raj Patel` (approver); then by `Owen Clarke` (owner team) and `Samira Khan` (admin).

**Then**

- Grace Kim and Raj Patel get `{ ok: false, code: "FORBIDDEN", message: "Only the workflow owner or an admin can pause, resume or stop it." }`; nothing changes and nothing is logged.
- Owen Clarke and Samira Khan succeed.
- UI: signed in as Grace Kim, the run page shows the status chip but no Pause, Resume or Stop buttons; a direct POST to the action endpoint returns 403 with that message.

#### RT-12 · Every action is recorded with who, when and why

**Given** the 5.1 run.

**When** pause (Owen Clarke, “Waiting for budget”) at +1h; resume (Samira Khan) at +3h; stop (Owen Clarke, “Budget withdrawn”) at +4h.

**Then**

- The manual entries in `run.log` are exactly three, in this order: paused / Owen Clarke / 2026-10-20T10:00:00.000Z / “Waiting for budget”; resumed / Samira Khan / 2026-10-20T12:00:00.000Z; stopped / Owen Clarke / 2026-10-20T13:00:00.000Z / “Budget withdrawn”.
- The log survives a reload of the app (it is stored with the run, not in browser storage). In the browser, set the server time with `POST /api/test/clock` before each action (10:00, 12:00, 13:00).

#### RT-13 · Every running workflow has the controls

**Given** one run started for each of these, from the records in `seed/runtime-records.json` (their `states` meet each built-in prerequisite; AR-301’s event comes from source `zip`): `wf-onboard`/`WO-2214-A`, `wf-offboard`/`OFF-902`, `wf-access`/`AR-301`, `wf-invoice`/`INV-8812`, `wf-wo-sub`/`WO-2231`.

**When** Open each run page as Samira Khan.

**Then**

- Each shows “Running” with “Pause” and “Stop”. Pausing any of them works as RT-01. Runs that have completed (for example `wf-ts-sub`/`TS-9934`, approved automatically) show “Completed” and no controls.

#### RT-14 · Turning a workflow Inactive does not pause or stop its runs

**Given** the 5.1 run; Work order submitted is then switched to Inactive.

**When** Read the run.

**Then**

- `run.status` stays `running` and it continues on its version (“Anything already running finishes on it.”, UI-P1). Pause/Resume/Stop still work on it.

#### RT-15 · Resuming a run paused by a failed system call

**Given** a run of `wf-offboard` for `OFF-902` (record from `seed/runtime-records.json` plus `fail_system: "Okta"`) with `RV.sys.onFail = "pause"`. Mock auto-completion (05 §5.2) fulfils the worker’s items, so “Exit confirmations” is verified; the test then marks “Return equipment” done as Sam Patel (IT service desk) and the “Final timesheet & expenses” review `verified` as Tom Reed (hiring manager), and moves the clock to 2026-10-23T16:00:00Z (17:00 on the last day in Europe/London), so “Wait for the last day” ends and Remove access calls Okta, which fails after the 3 retries (+5, +20, +60 minutes; advance the clock past them).

**When** Read the run; then remove `fail_system` from the record (Okta is fixed) and call `resumeRun(run, { by: "Samira Khan" })`.

**Then**

- The run is `paused` with `pauseReason` = "system_failure" and `pausedBy` = "Levv"; the workflow owner (HR operations) is alerted (engine §15.9). Remove access is `failed`.
- Resume retries Remove access and the run carries on (`running`); the log has `{ by: "Levv", type: "paused", … }` then `{ by: "Samira Khan", type: "resumed", … }`. Stop works on it as in RT-05.

## 6. Traceability

| Test | Part | Spec area | Seed workflows / records / files used |
| --- | --- | --- | --- |
| EN-001 | A | Engine · worked example | `wf-onboard`, `WO-2214-A` |
| EN-002 | A | Engine · worked example | `wf-onboard`, `WO-2240-A` |
| EN-003 | A | Engine · worked example | `wf-onboard`, `WO-2251-A` |
| EN-004 | A | Engine · worked example | `wf-ending`, `ASN-902` |
| EN-005 | A | Engine · worked example | `wf-ending`, `ASN-907` |
| EN-006 | A | Engine · worked example | `wf-asn-chg`, `ASN-881` |
| EN-007 | A | Engine · worked example | `wf-asn-chg`, `ASN-920` |
| EN-008 | A | Engine · worked example | `wf-offboard`, `OFF-902` |
| EN-009 | A | Engine · worked example | `wf-offboard`, `OFF-915` |
| EN-010 | A | Engine · worked example | `wf-access`, `AR-301` |
| EN-011 | A | Engine · worked example | `wf-access`, `AR-305` |
| EN-012 | A | Engine · worked example | `wf-doc`, `WK-330` |
| EN-013 | A | Engine · worked example | `wf-invoice`, `INV-8812` |
| EN-014 | A | Engine · worked example | `wf-invoice`, `INV-8813` |
| EN-015 | A | Engine · worked example | `wf-wo-sub`, `WO-2214` |
| EN-016 | A | Engine · worked example | `wf-wo-sub`, `WO-2240` |
| EN-017 | A | Engine · worked example | `wf-wo-sub`, `WO-2231` |
| EN-018 | A | Engine · worked example | `wf-wo-sub`, `WO-2260` |
| EN-019 | A | Engine · worked example | `wf-wo-sub`, `WO-2270` |
| EN-020 | A | Engine · worked example | `wf-wo-sub`, `WO-2275` |
| EN-021 | A | Engine · worked example | `wf-wo-sub`, `WO-2280` |
| EN-022 | A | Engine · worked example | `wf-wo-sub-wo-uk-tech`, `WO-2214` |
| EN-023 | A | Engine · worked example | `wf-wo-sub-wo-uk-tech`, `WO-2240` |
| EN-024 | A | Engine · worked example | `wf-wo-sub-wo-uk-tech`, `WO-2231` |
| EN-025 | A | Engine · worked example | `wf-wo-sub-wo-uk-tech`, `WO-2260` |
| EN-026 | A | Engine · worked example | `wf-wo-sub-wo-uk-tech`, `WO-2270` |
| EN-027 | A | Engine · worked example | `wf-wo-sub-wo-uk-tech`, `WO-2275` |
| EN-028 | A | Engine · worked example | `wf-wo-sub-wo-uk-tech`, `WO-2280` |
| EN-029 | A | Engine · worked example | `wf-wo-sub-wo-data`, `WO-2214` |
| EN-030 | A | Engine · worked example | `wf-wo-sub-wo-data`, `WO-2240` |
| EN-031 | A | Engine · worked example | `wf-wo-sub-wo-data`, `WO-2231` |
| EN-032 | A | Engine · worked example | `wf-wo-sub-wo-data`, `WO-2260` |
| EN-033 | A | Engine · worked example | `wf-wo-sub-wo-data`, `WO-2270` |
| EN-034 | A | Engine · worked example | `wf-wo-sub-wo-data`, `WO-2275` |
| EN-035 | A | Engine · worked example | `wf-wo-sub-wo-data`, `WO-2280` |
| EN-036 | A | Engine · worked example | `wf-jp`, `JP-5120` |
| EN-037 | A | Engine · worked example | `wf-sow-sub`, `SOW-77` |
| EN-038 | A | Engine · worked example · change orders (running total) | `wf-sow-co`, `SOW-77-CO1` |
| EN-039 | A | Engine · worked example · change orders (running total) | `wf-sow-co`, `SOW-77-CO3` |
| EN-040 | A | Engine · worked example | `wf-ts-sub`, `TS-9934` |
| EN-041 | A | Engine · worked example | `wf-wo-chg`, `WO-2214-C` |
| EN-042 | A | Engine · checks · rejection | `wf-wo-sub-wo-uk-tech`, `WO-2240` |
| EN-043 | A | Engine · checks · escalation | `wf-wo-sub-wo-uk-tech`, `WO-2240` |
| EN-044 | A | Engine · If paths · reject | `wf-wo-sub`, `WO-2231` |
| EN-045 | A | Engine · If paths · escalate to group | `wf-wo-sub`, `WO-2231`, `people-and-authority.json#GROUPS.fin_ctrl` |
| EN-046 | A | Engine · If paths · ask someone to approve | `wf-wo-sub`, `WO-2231` |
| EN-047 | A | Engine · If paths · isolation | `wf-wo-sub`, `WO-2214`, `WO-2275`, `WO-2280` |
| EN-048 | A | Engine · If paths · isolation | `wf-wo-sub`, `WO-2214`, `WO-2275`, `WO-2280` |
| EN-049 | A | Engine · If paths · isolation | `wf-wo-sub`, `WO-2214`, `WO-2275`, `WO-2280` |
| EN-050 | A | Engine · Chaser | `wf-wo-sub`, `WO-2231` |
| EN-051 | A | Engine · Chaser | `wf-wo-sub`, `WO-2231` |
| EN-052 | A | Engine · conditional approver (Only needed when) | `wf-wo-sub`, `WO-2214` |
| EN-053 | A | Engine · conditional approver (Only needed when) | `wf-wo-sub`, `WO-2275` |
| EN-054 | A | Engine · conditional approver (Only needed when) | `wf-wo-sub`, `WO-2231` |
| EN-055 | A | Engine · named person | `wf-wo-sub`, `WO-2214` |
| EN-056 | A | Engine · Collect & verify · provider | `wf-access`, `AR-301` |
| EN-057 | A | Engine · Collect & verify · provider | `wf-access`, `AR-305` |
| EN-058 | A | Engine · delete step | `wf-wo-sub`, `WO-2231` |
| EN-059 | A | Engine · Active / Inactive | `wf-jp`, `JP-5120` |
| EN-060 | A | Engine · System step failure path | `wf-offboard`, `OFF-902` |
| EN-061 | A | Engine · conflicting changes | `wf-asn-chg`, `ASN-920` |
| EN-062 | A | Engine · conflicting changes | `wf-asn-chg`, `ASN-920` |
| EN-063 | A | Engine · changes re-ask only affected people | `wf-asn-chg`, `ASN-881` |
| EN-064 | A | Engine · escalation timer | `wf-wo-sub`, `WO-2231` |
| EN-065 | A | Engine · escalation timer | `wf-wo-sub-wo-uk-tech`, `WO-2240` |
| EN-066 | A | Engine · named person · absence | `wf-wo-sub`, `WO-2214`, `people-and-authority.json#OOO` |
| EN-067 | A | Engine · named person · paused | `wf-wo-sub`, `WO-2214`, `people-and-authority.json#OOO` |
| EN-068 | A | Engine · absences asOf | `wf-wo-sub`, `WO-2214`, `wf-sow-sub`, `SOW-77` |
| EN-069 | A | Engine · stop | `wf-wo-sub`, `WO-2231` |
| EN-070 | A | Engine · stop | `wf-wo-sub-wo-uk-tech`, `WO-2240` |
| EN-071 | A | Engine · approval rules everywhere | `new workflow`, `WO-2214`, `approval-rules.json` |
| EN-072 | A | Engine · Approve modes | `wf-wo-sub`, `WO-2214` |
| EN-073 | A | Engine · System steps | `new workflow`, `WO-2231`, `systems.json` |
| EN-074 | A | Engine · Run workflow | `new workflow`, `WO-2231`, `wf-onboard` |
| EN-075 | A | Engine · building approvals in a workflow | `new workflow`, `WO-2231` |
| EN-076 | A | Engine · building approvals in a workflow | `new workflow`, `WO-2231` |
| EN-077 | A | Engine · building approvals in a workflow | `new workflow`, `WO-2214` |
| EN-078 | A | Engine · building approvals in a workflow | `new workflow`, `WO-2231` |
| EN-079 | A | Engine · building approvals in a workflow | `new workflow`, `WO-2214` |
| EN-080 | A | Engine · building approvals in a workflow | `new workflow`, `WO-2231` |
| EN-081 | A | Engine · building approvals in a workflow | `new workflow`, `WO-2214` |
| EN-082 | A | Engine · building approvals in a workflow | `new workflow`, `WO-2231` |
| EN-083 | A | Engine · building approvals in a workflow | `new workflow`, `WO-2214` |
| EN-084 | A | Engine · building approvals in a workflow | `new workflow`, `WO-2231` |
| EN-085 | A | Engine · building approvals in a workflow | `new workflow`, `WO-2214` |
| EN-086 | A | Engine · building approvals in a workflow | `new workflow`, `WO-2231` |
| EN-087 | A | Engine · building approvals in a workflow | `new workflow`, `WO-2214` |
| EN-088 | A | Engine · building approvals in a workflow | `new workflow`, `WO-2231` |
| EN-089 | A | Engine · building approvals in a workflow | `new workflow`, `WO-2214` |
| EN-090 | A | Engine · building approvals in a workflow | `new workflow`, `WO-2231` |
| EN-091 | A | Engine · building approvals in a workflow | `new workflow`, `WO-2214` |
| EN-092 | A | Engine · building approvals in a workflow | `new workflow`, `WO-2231` |
| EN-093 | A | Engine · building approvals in a workflow | `new workflow`, `WO-2214` |
| EN-094 | A | Engine · building approvals in a workflow | `new workflow`, `WO-2231` |
| EN-095 | A | Engine · building approvals in a workflow | `new workflow`, `WO-2214` |
| EN-096 | A | Engine · building approvals in a workflow | `new workflow`, `WO-2231` |
| EN-097 | A | Engine · building approvals in a workflow | `new workflow`, `WO-2214` |
| EN-098 | A | Editor · checks | `wf-wo-sub-wo-uk-tech` |
| EN-099 | A | Editor · checks | `wf-wo-sub-wo-uk-tech` |
| EN-100 | A | Editor · If paths | `wf-wo-sub` |
| EN-101 | A | Editor · If paths | `wf-wo-sub` |
| EN-102 | A | Editor · If paths | `wf-wo-sub` |
| EN-103 | A | Editor · If paths | `wf-wo-sub`, `WO-2231` |
| EN-104 | A | Editor · insert step | `new workflow` |
| EN-105 | A | Editor · insert step | `new workflow` |
| EN-106 | A | Editor · If paths | `new workflow` |
| EN-107 | A | Editor · If paths | `new workflow` |
| EN-108 | A | Editor · If paths | `new workflow` |
| EN-109 | A | Editor · If paths · guard | `new workflow` |
| EN-110 | A | Editor · If paths | `new workflow` |
| EN-111 | A | Editor · conditions | `new workflow` |
| EN-112 | A | Editor · delete step | `wf-wo-sub` |
| EN-113 | A | Editor · System steps | `wf-offboard` |
| EN-114 | A | Editor · Collect & verify | `wf-access` |
| EN-115 | A | Editor · Approve | `wf-wo-sub` |
| EN-116 | A | Editor · escalation timer | `wf-wo-sub` |
| EN-117 | A | Editor · Collect & verify | `wf-onboard` |
| EN-118 | A | Editor · stop | `wf-wo-sub`, `wf-wo-sub-wo-uk-tech` |
| EN-119 | A | Editor · new workflow | `wf-wo-sub` |
| EN-120 | A | Editor · presets | `wf-onboard`, `onboarding-presets.json` |
| EN-121 | A | Editor · Chaser | `wf-wo-sub` |
| EN-122 | A | Engine · Chaser | `wf-wo-sub`, `wf-ending`, `wf-onboard`, `wf-access` |
| EN-123 | A | Engine · Nova condition writer | `wf-wo-sub`, `catalog.json` |
| EN-124 | A | Engine · conditions and text | `catalog.json` |
| EN-125 | A | Engine · Nova condition writer | `catalog.json` |
| EN-126 | A | Seed integrity | `all seed files` |
| UI-N1 | B | Navigation · top bar · no Settings | `wf-wo-sub` |
| UI-N2 | B | Navigation · picker · variations | `all 15 workflows` |
| UI-N3 | B | Canvas · Approve steps | `wf-wo-sub` |
| UI-N4 | B | Approve step panel | `wf-wo-sub` |
| UI-N5 | B | Chaser | `wf-wo-sub`, `WO-2231` |
| UI-N6 | B | Chaser · rail | `wf-ending`, `wf-onboard` |
| UI-A1 | B | Routing · variations · approval rules | `wf-wo-sub-wo-uk-tech`, `WO-2214`, `approval-rules.json` |
| UI-A2 | B | Routing · self-approval | `wf-wo-sub-wo-uk-tech`, `WO-2214` |
| UI-A3 | B | Routing · merged roles | `wf-wo-sub-wo-uk-tech`, `WO-2214` |
| UI-A4 | B | Checks · escalation · approval rules | `wf-wo-sub-wo-uk-tech`, `WO-2240` |
| UI-A5 | B | Checks · rejection | `wf-wo-sub-wo-uk-tech`, `WO-2240` |
| UI-A6 | B | If paths · reject | `wf-wo-sub`, `WO-2231` |
| UI-A7 | B | If paths · escalate to group | `wf-wo-sub`, `WO-2231`, `GROUPS.fin_ctrl` |
| UI-A8 | B | If paths · ask someone to approve | `wf-wo-sub`, `WO-2231` |
| UI-A9 | B | Routing · conditional approver | `wf-asn-chg`, `ASN-881` |
| UI-A10 | B | Routing · absence · delegate | `wf-asn-chg`, `ASN-881`, `OOO` |
| UI-A11 | B | Routing · absence · backup | `wf-wo-sub-wo-uk-tech`, `WO-2214`, `BACKUP`, `DELEG_OK` |
| UI-A12 | B | Routing · split funding | `wf-wo-sub`, `WO-2275` |
| UI-A13 | B | Routing · missing data | `wf-wo-sub`, `WO-2280` |
| UI-A14 | B | Changes · running total · not asked again | `wf-sow-co`, `SOW-77-CO3` |
| UI-A15 | B | Auto-approve · plan | `wf-jp`, `JP-5120` |
| UI-A16 | B | Auto-approve | `wf-ts-sub`, `TS-9934` |
| UI-A17 | B | Changes · conflicts | `wf-asn-chg`, `ASN-920` |
| UI-A18 | B | Nova · conditional approver | `wf-wo-sub`, `WO-2214` |
| UI-A19 | B | Lint · named person | `wf-wo-sub` |
| UI-I1 | B | Building approvals · insert Approve | `new workflow` |
| UI-I2 | B | Building approvals · roles | `new workflow`, `WO-2231` |
| UI-I3 | B | Building approvals · If | `new workflow` |
| UI-I4 | B | Dropdowns · values · conditions | `new workflow` |
| UI-I5 | B | If paths · escalate | `new workflow`, `WO-2231` |
| UI-I6 | B | If paths · add path | `new workflow` |
| UI-I7 | B | If paths · ask someone to approve | `new workflow`, `WO-2231`, `WO-2214` |
| UI-I8 | B | If paths · reject | `new workflow`, `WO-2214` |
| UI-I9 | B | If paths · guard | `new workflow` |
| UI-I10 | B | If paths · delete path | `new workflow` |
| UI-I11 | B | Conditions · either/or | `new workflow` |
| UI-I12 | B | Lint · empty path | `new workflow` |
| UI-W1 | B | Onboarding | `wf-onboard`, `WO-2214-A` |
| UI-W2 | B | Onboarding · failed checks decided by people | `wf-onboard`, `WO-2251-A` |
| UI-W3 | B | Offboarding | `wf-offboard`, `OFF-902` |
| UI-W4 | B | Assignment ending | `wf-ending`, `ASN-907`, `ASN-902` |
| UI-W5 | B | Invoices | `wf-invoice`, `INV-8812`, `INV-8813` |
| UI-W6 | B | Document renewal | `wf-doc`, `WK-330` |
| UI-W7 | B | Changes · own approvals | `wf-wo-chg`, `WO-2214-C` |
| UI-W8 | B | Access requests | `wf-access`, `AR-301` |
| UI-W9 | B | Checks · escalation · covered | `wf-access`, `AR-305` |
| UI-W10 | B | Collect & verify · provider | `wf-access`, `AR-301` |
| UI-W11 | B | People · worker never decides | `wf-ending`, `wf-wo-sub`, `wf-onboard` |
| UI-W12 | B | System steps · failure | `wf-offboard` |
| UI-W13 | B | Delete step | `wf-wo-sub`, `WO-2231` |
| UI-W14 | B | Timing · Wait | `wf-onboard` |
| UI-W15 | B | Collect & verify · failure decided by people | `wf-onboard` |
| UI-D1 | B | Dropdowns · Applies to | `wf-jp` |
| UI-D2 | B | Dropdowns · positioning | `wf-jp` |
| UI-D3 | B | Workflow settings · final rejection | `wf-jp` |
| UI-D4 | B | Workflow settings · owner | `wf-jp` |
| UI-D5 | B | Dropdowns · approvers | `wf-wo-sub` |
| UI-P1 | B | Active / Inactive | `wf-jp`, `wf-wo-sub-wo-uk-tech` |
| UI-P2 | B | Active / Inactive · Test | `wf-jp`, `JP-5120` |
| UI-P3 | B | Never delete | `all 15 workflows` |
| UI-P4 | B | Publish · must-fix | `new workflow`, `history-records.json` |
| UI-P5 | B | Publish · overlaps | `wf-wo-sub-wo-data`, `wf-wo-sub-wo-uk-tech`, `history-records.json` |
| UI-P6 | B | Publish · impact · second person | `wf-access`, `history-records.json` |
| UI-DD-01 | B | Dropdown · search | `wf-jp` |
| UI-DD-02 | B | Dropdown · multi select · Clear | `wf-jp` |
| UI-DD-03 | B | Dropdown · single select | `wf-onboard` |
| UI-DD-04 | B | Dropdown · keyboard | `wf-jp` |
| UI-DD-05 | B | Dropdown · add typed item | `wf-onboard` |
| UI-DD-06 | B | Dropdown · multi select | `wf-wo-sub` |
| UI-DD-07 | B | Dropdown · closing | `wf-jp` |
| UI-DD-08 | B | Dropdown · groups | `wf-jp`, `catalog.json` |
| UI-DD-09 | B | Dropdown · positioning | `wf-jp` |
| UI-DD-10 | B | Dropdown · publish overlap choice | `wf-wo-sub-wo-data` |
| UI-NP-01 | B | Dropdowns · no pills | `all 15 workflows` |
| UI-ESC-01 | B | Escalation timer | `wf-wo-sub`, `WO-2231` |
| UI-ESC-02 | B | Escalation timer | `wf-wo-sub-wo-uk-tech`, `WO-2240` |
| UI-ESC-03 | B | Chaser validation | `wf-wo-sub` |
| UI-ESC-04 | B | Collect & verify · generated escalation | `wf-onboard` |
| UI-STOP-01 | B | Stop | `wf-wo-sub`, `WO-2231` |
| UI-RULE-01 | B | Approval rules | `wf-wo-sub`, `new workflow`, `WO-2214` |
| UI-BASIS-01 | B | Workflow settings · change basis | `wf-sow-co`, `wf-jp` |
| UI-PERM-01 | B | Publish · approver permission | `wf-access` |
| LP-01 | C | Lint · no approver · publish blocked | `new workflow`, `history-records.json` |
| LP-02 | C | Lint · no approver | `wf-wo-sub` |
| LP-03 | C | Lint · no approver | `wf-wo-sub` |
| LP-04 | C | Lint · failure deciders | `wf-onboard` |
| LP-05 | C | Lint · empty path | `new workflow`, `wf-wo-sub` |
| LP-06 | C | Lint · named person | `wf-wo-sub` |
| LP-07 | C | Lint · If does nothing | `wf-wo-sub`, `new workflow` |
| LP-08 | C | Lint · Collect & verify | `wf-onboard` |
| LP-09 | C | Nova · publish impact | `all 15 workflows`, `history-records.json` |
| LP-10 | C | Publish · overlaps · second person | `wf-wo-sub-wo-data`, `wf-wo-sub-wo-uk-tech`, `history-records.json`, `test-actors.json` |
| LP-11 | C | Publish · impact | `wf-access`, `history-records.json` |
| LP-12 | C | Publish · overlaps | `new workflow`, `wf-wo-sub`, `history-records.json` |
| LP-13 | C | Publish · second person | `wf-access`, `test-actors.json` |
| LP-14 | C | Lint · Chaser validation | `wf-wo-sub`, `wf-ending` |
| LP-15 | C | Lint · production checks | `wf-wo-sub`, `new workflow`, `systems.json` |
| LP-16 | C | Publish · impact | `history fixture` |
| RT-01 | D | Runtime | `wf-wo-sub`, `WO-2231`, `runtime-records.json`, `test-actors.json` |
| RT-02 | D | Runtime | `wf-wo-sub`, `WO-2231`, `runtime-records.json`, `test-actors.json` |
| RT-03 | D | Runtime | `wf-wo-sub`, `WO-2231`, `runtime-records.json`, `test-actors.json` |
| RT-04 | D | Runtime | `wf-wo-sub`, `WO-2231`, `runtime-records.json`, `test-actors.json` |
| RT-05 | D | Runtime | `wf-wo-sub`, `WO-2231`, `runtime-records.json`, `test-actors.json` |
| RT-06 | D | Runtime | `wf-wo-sub`, `WO-2231`, `runtime-records.json`, `test-actors.json` |
| RT-07 | D | Runtime | `wf-wo-sub`, `WO-2231`, `runtime-records.json`, `test-actors.json` |
| RT-08 | D | Runtime | `wf-wo-sub`, `WO-2231`, `runtime-records.json`, `test-actors.json` |
| RT-09 | D | Runtime | `wf-wo-sub`, `WO-2231`, `runtime-records.json`, `test-actors.json` |
| RT-10 | D | Runtime | `wf-wo-sub`, `WO-2231`, `runtime-records.json`, `test-actors.json` |
| RT-11 | D | Runtime | `wf-wo-sub`, `WO-2231`, `runtime-records.json`, `test-actors.json` |
| RT-12 | D | Runtime | `wf-wo-sub`, `WO-2231`, `runtime-records.json`, `test-actors.json` |
| RT-13 | D | Runtime | `wf-onboard`/`WO-2214-A`, `wf-offboard`/`OFF-902`, `wf-access`/`AR-301`, `wf-invoice`/`INV-8812`, `wf-wo-sub`/`WO-2231`, `wf-ts-sub`/`TS-9934`, `runtime-records.json`, `test-actors.json` |
| RT-14 | D | Runtime | `wf-wo-sub`, `WO-2231`, `runtime-records.json`, `test-actors.json` |
| RT-15 | D | Runtime | `wf-offboard`, `OFF-902`, `runtime-records.json`, `test-actors.json` |

Counts: Part A 126 engine tests · Part B 82 UI tests (63 scripts + 10 dropdown + 1 crawl + 8 post-prototype decisions) · Part C 16 · Part D 15 · total 239.

Script coverage: every script N1–N6, A1–A19, I1–I12, W1–W15, D1–D5, P1–P6 has a UI test with the same number (UI-xx) and, where it runs Test, an engine test (Part A index).

## 7. Appendix — disagreements and every deviation from the prototype

### 7.1 Where the human script, the automated browser run and the prototype disagree

“Asserted” is what the tests above expect.

| # | Where | Human script (v35) | Automated run output | Prototype (fresh load) | Asserted |
| --- | --- | --- | --- | --- | --- |
| 1 | Section names in the automated run | N1…P6 | Labels shift from A8 on: automated run “A8,A9” = script A9/A10, “A11” = A12, “A12” = A13, “A13” = A14, “A14” = A15, “A15” = A16, “A16” = A17, “A17” = A18, “A18” = A19; “I0” = I1, “I0b” = I2, “I1”…“I10” = I3…I12, “I11 publish blocked” = P4; “A7b If approve” = A8 | — | Script numbering |
| 2 | A7 | Otherwise escalates; “any one of Chloe Martin, Lena Fischer, David Okafor” | “3 approval rounds”, Rate review after the escalation (ran after A6 without reloading) | 2 rounds, continues to Value band | Fresh-load result; group text per D11 (final decision (00 §3) T1) |
| 3 | A6 cleanup | “Set it back to Carry on” | not checked | Reject → Carry on reconnects Otherwise to Rate review (bug) | Rejoins Value band via `mergeAt` (D22, decision 1) |
| 4 | A5 cleanup | “Set it back to Escalate” | not checked | Re-creates the box as “Duplicate & ghost worker flagged: escalation” | Prototype (matches engine §16.6 and UI §4.5) |
| 5 | A8 | “Chloe Martin, then Rate review” | same (artefact of the automated run) | Chloe Martin, then Tell the supplier | Fresh-load result (decision 1) |
| 6 | A14, SOW-77-CO1 | “Finance and VP review: Covered” | same | Approvals on the running total, path on the new total | One walk on the running total (D1, decision 1) |
| 7 | A14 string | “… This change alone is $60K.” | no full stop | no full stop | No full stop |
| 8 | A15 | “suppliers are told” | “Email to Procurement (Owen Clarke)” | same as the automated run | Prototype string (recipient is a product question) |
| 9 | A1, A4 | “Approval rules add approvers: … UK off-payroll (IR35).” | same, no task shown | same | Summary as is, plus the IR35 task line under Business sign-off (D5, decision T12) |
| 10 | New workflow | Defaults: Hiring manager hears about a final rejection | — | “No one” | Hiring manager (decision 2) |
| 11 | I1 | “An “Approval” box appears” | nodes `trigger,end,appr` | Canvas box “Approve” | “Approval” / “Choose who approves” (decision 4) |
| 12 | I1 Test | not in script | not run | Empty Approve step shown “Covered” | “Choose who approves” (D6, decision 1) |
| 13 | Known demo items | “Nova shows a suggestion on some workflows (e.g. Work order submitted)” | — | Nova clean on all 15 | Clean, except “Data and AI hires” (overlap, D24) |
| 14 | N1, Settings | No Settings button | `settings visible=false` | Hidden “⚙ Settings” and “Approval rules ›” still in the DOM | Not in the DOM (decision 8) |
| 15 | Sample records | “Every record is now tested from a workflow” (table lists 27) | — | OB-2251 and ASN-915 fit no workflow | Not tested; open question |
| 16 | P5 version | — | — | Never-published draft publishes as “Live v2” | “Live v1” (decision 3) |
| 17 | N5, N6 | Chaser boxes | ERROR (obsolete selectors) | Chaser boxes as in UI-N5/N6 | Prototype (checked against the prototype’s own Chaser boxes) |
| 18 | D2 | “closes only when the field scrolls off screen” | not run | Closes when the field leaves the window | Prototype rule, tested at 1440×600 |
| 19 | Status labels | — | “PASSED”, “APPROVAL” | Sentence case, capitals by CSS | Sentence case (`textContent`) |
| 20 | Doc version labels | “What an admin can do in v33”, “Automated run … on v34” in a v35 document | — | v35 | Cosmetic |
| 21 | Rails | “Only the helpers that fit this workflow” | — | Document renewal and Invoice received show the approval set | Not asserted beyond “no Chaser” |
| 22 | Worker sees | “Each worker-facing step shows Worker sees” | — | Every Collect & verify card shows it | Prototype (matches engine §10.3) |
| 23 | P6 | “a go-live date” | — | Pre-fills 2026-10-01 (past) | Today, 2026-10-20 (UI §10.1, §16.25) |

### 7.2 Every deviation from the prototype that the tests assert

| Ref | Production behaviour (prototype differs) | Tests |
| --- | --- | --- |
| Engine D1 · decision 1 | One walk on the basis-adjusted record for change orders | EN-038, EN-039, UI-A14 |
| Engine D2 (data note) · decision 12 | Rule events stay as seeded; “Client data access” does not apply to SOW-77 | EN-037 |
| Engine D3 (kept) | Approvals never put later steps into Waiting in Test | all Part A |
| Engine D4 | Waiting names the nearest real blocking step | EN-003, UI-W2 |
| Engine D5 · T12 | Rule tasks shown under the step whose round they joined; rules apply to every matching workflow; rule-only rounds in “From approval rules” | every WO-2214 case (EN-015, EN-022, EN-029, A18/A19 and I-stage cases), EN-071, UI-A1, UI-RULE-01 |
| Engine D6 · decisions 1, 4 | Empty Approve step: “Choose who approves”, never covered or auto-approved; group/person start empty | EN-075, EN-072, UI-I1, UI-D5, UI-A19, LP-01 |
| Engine D7 | Decided items show Approved / Waiting / Stands …; “Removed by the edit” | EN-006, EN-063, UI-A9, UI-A10 |
| Engine D8 · T10 | A named person who is away → the step’s backup; no backup → paused | EN-066, EN-067 |
| Engine D9 | Paused note uses the workflow’s owner | EN-019, EN-026, EN-033, EN-067 |
| Engine D10 | One resolver for every person label | (no seed output changes) |
| Engine D11 | “Finance controllers (any one of …)” | EN-045, UI-A7 |
| Engine D12 | “This is an executive sign-off” | not reachable with the seed; no test |
| Engine D13 | Production applies the chosen proposal’s field value | Test applies only `total` (EN-061, EN-062); production behaviour belongs to runtime tests not in scope |
| Engine D14 | List values print “bill rate”, not “bill_rate” | EN-124 |
| Engine D15 | An empty number never matches | EN-124 |
| Engine D16 | “For real requests, “{winner}” runs for this record.” | every work-order case where another workflow wins; UI-A1 |
| Engine D17 | Failed check keeps the “Asked of …” prefix | EN-003, UI-W2 |
| Engine D18 | Disconnected system: “Paused: not connected” | EN-073, LP-15 |
| Engine D19 | Run workflow: “Started” · “Starts “{target}”” | EN-074 |
| Engine D20 | Flags line hidden when rejected or stopped | EN-042, EN-070, UI-A5 |
| Engine D21 | Every Needs-information hit, “are missing” for 2+ | not reachable with the seed (single missing field); no test |
| Engine D22 · decision 1 | `mergeAt` stored and used | round-trip editor test, EN-045, EN-046, UI-A6–A8 |
| Engine D23 · T11 | Stop ends with outcome `stopped` and “Stopped at …” | EN-069, EN-070, UI-STOP-01 |
| Engine D24 · decision 9 | Overlap and unreachable/worker/run-target/date checks; identical scopes overlap | LP-01, LP-09, LP-12, LP-15, UI-I1–UI-I12, UI-P4 |
| Engine D25 | Background check preset defaults `failRoles: ["hrbp","legal"]` | editor test “Background check preset defaults” |
| Engine D26 | “1 record” | LP-16 |
| Engine D27 | “Amount to compare for changes” in workflow settings | UI-BASIS-01 |
| Engine D28 · decision 10 | Absences compared with `asOf` (2026-10-20 in tests) | EN-068 and every absence note |
| Engine D29 | Proper plurals in the inactive warning | UI-P1 |
| Engine D30 (kept) | “Any one” items only drop the requester | (no deviation) |
| Engine D31 · decision 5 | One escalation timer; Collect & verify escalation step on a “Failed” exit | EN-064, EN-065, editor tests, UI-ESC-01, UI-ESC-02, UI-ESC-04, UI-W10, UI-NP-01 |
| Engine D32 · decision 6 | Escalation must come after the reminder | LP-14, UI-ESC-03 |
| Decision 2 · UI §16.35 | New workflow tells Hiring manager | I8–I12 cases, editor test “A new workflow’s defaults”, UI-I8 |
| Decision 3 · UI §16.31 | First publish of a never-published draft is v1 | LP-10, UI-P5 |
| Decision 7 · UI §16.2 | “Try a record” is a single-select list of rows | UI-A1, UI-A9, UI-W1, UI-W3, helper `openTest` |
| Decision 8 · UI §16.1, §16.30 | Settings, Settings page and “Approval rules ›” not in the DOM; no “Approve as Samira (demo)” | UI-N1, UI-N2, UI-P6 |
| Decision 9 · UI §16.32–33 | Overlap choice applies on approval; approver = anyone with “Approve flow changes” except the author; must-fix row when nobody else has it | LP-10, LP-12, LP-13, UI-P5, UI-P6, UI-PERM-01 |
| Decision 11 · engine §16.11 | Failed-check deciders may be operational roles | UI-W11, UI-ESC-04 |
| UI §16.3 · decision 4 | Kind “Approve”; new step named “Approval”; canvas “Approval” / “Choose who approves” | UI-I1, editor test “Insert an Approve step” |
| UI §16.5 | “No backup” / “No one” shown as real values | UI-A19 |
| UI §16.12 | “… in N days” labels in Runs when | UI-DD-08 |
| UI §16.15 · engine D25 | Background check description “Criminal, credit and sanctions checks; adverse results go to the people set under “If it fails”” | EN-120 |
| UI §16.16 | “Turns a plain request into a job posting” | UI-I1 |
| UI §16.22 | Picker in record-lifecycle order, variations indented | UI-N2 |
| UI §16.24 | Inactive note first in Test | UI-P2 |
| UI §16.25 | “Goes live on” never in the past; formatted toast date | UI-P6, LP-10, LP-11 |
| UI §16.28 | Curly quotes everywhere | string rule 1.3 |
| UI §16.29 | Undo link on the step-deleted toast | UI-W13 |
| UI §16.34 | Collect & verify escalation step | UI-ESC-04 |
| UI §16.6–11, 13–14, 17–21, 23 | Panel and layout details not covered by a script | not asserted here (04-ui.md is the reference) |

### 7.3 Where the specs disagree with each other (what the tests follow)

None known. The differences earlier versions listed here were resolved in the documents themselves (27 Oct 2026): picker order (02 §1), the inactive note first (03 §11), the Background check description (03 D25 everywhere), the deciders for “Ask people to decide” (04 `DECIDER_ROLES`), the summary for rules-only plans and the “Stopped at …” summary (04 §8.2), the “For real requests …” notice (04 §8.2, 03 §19 intro), ASN-881 status suffixes (03 §19 intro), the escalation-hours label (02 §5.4), the If box on the canvas (03 §18.1), Nova on a new catch-all workflow (04 §12), and the lint/publish result shapes (data model §13, Part C).

If you find a new disagreement, follow the precedence 00 → 03 → 02 → 04 → 06, do not weaken the test, and record the case in `IMPLEMENTATION_NOTES.md`.

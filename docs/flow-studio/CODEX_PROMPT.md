# Codex prompts — Levv Flow Studio

## How to use this file

1. Copy the package into the repo first (see README.md): `docs/flow-studio/` (00–06, `seed/`, `reference/`) and `AGENTS.md` at the root.
2. Run the build as **nine Codex tasks, in order** (M0 → M8). For each task, paste **the Master prompt** followed by **that milestone's prompt**. Don't start the next task until the previous one is merged and its tests are green.
3. After each task, read `docs/flow-studio/BUILD_REPORT.md` and `IMPLEMENTATION_NOTES.md`. Check the "Review" bullets under the milestone.
4. If you would rather run everything in one long task, paste the Master prompt followed by **all** milestone prompts. Expect a much longer run, and review at the end.

---

## Master prompt (paste at the start of every task)

```text
You are building "Levv Flow Studio" in this repository: a visual workflow builder (approvals are steps inside workflows) plus a runtime that runs published workflows with manual Pause / Resume / Stop.

The complete specification is in docs/flow-studio/. You must follow it exactly:
- 00-overview.md: product, principles, FINAL decisions F1–F13, scope (in / out), precedence, open questions with their defaults
- 01-architecture.md: stack, folder layout, Prisma schema (only if the repo has no DB layer), repositories, API routes, permissions, time/clock, Nova (callGPT), test harness, build order M0–M8
- 02-data-model.md: every TypeScript type with field meanings and defaults; seed loading and normalisation (§15); legacy fields to ignore (§16)
- 03-engine.md: every rule and algorithm as pure functions with EXACT user-visible strings; worked examples; §20 deviations from the prototype (D1–D32) that you must build
- 04-ui.md: every screen, panel, field, option, default, state, interaction and string; the SelectMenu dropdown (§13); copy deck (§15); §16 differences from the prototype that you must build; Appendix A seeded canvases
- 05-runtime.md: runs, executors, scheduler, adapters (deterministic mocks), ledger, inbox, run screens, Pause / Resume / Stop with exact copy and error codes
- 06-acceptance-tests.md: 239 tests (engine 126, UI 82, lint/Nova/publish 16, runtime 15) with exact expected outputs. This is the definition of done
- seed/*.json: the data contract and fixtures. Field names are the data model; never rename them
- reference/flow-studio-v35.html: the clickable prototype. Open it in a browser to compare behaviour and look. NEVER copy its code (it is a patched single-file prototype)

Precedence when documents disagree: 00 > 03 > 02 > 04 > 06 (06 §7.3 records any known cases). The spec wins over the prototype where it says it deviates.

Stack (fixed): Next.js App Router, TypeScript strict, Tailwind CSS, lucide-react, Zod, Vitest, Playwright. AI only through the existing callGPT helper (OpenAI GPT-4.1-mini); add no other AI provider. Use the repo's existing database layer, auth and design-system components (the Workers Index page is the design source of truth). Only if missing: Prisma + PostgreSQL per 01 §4, and the dev user switcher per 01 §6.3. Add no UI libraries the repo doesn't already have.

Non-negotiable rules (also in AGENTS.md):
1. One thing to build: workflows. Approvals are Approve steps on the canvas. Never build approval flows/tabs/library/drill-in/breadcrumbs, a "Request approval" step, an Update record step, a Milestone step, or any Settings page/button ("Approval rules ›" must not exist in the DOM).
2. No pills and no native <select> anywhere: every selection uses the single SelectMenu component (04 §13). Switches stay switches.
3. Nothing is deleted: no delete for workflows, versions or runs; Active/Inactive instead.
4. People decide: Digital Workers never approve/reject; the worker never approves/reviews/is escalated to; nobody eligible = paused, never auto-approved; nobody approves their own request.
5. Exact copy, including curly quotes, kept in shared copy.ts modules.
6. One pure engine (no React/DOM/network/DB/system clock) used by both Test and real runs.
7. Accessible roles and names per 06 §1.5; full keyboard support.

How to work:
- Read AGENTS.md and the documents relevant to this task before coding. Follow the repo's conventions.
- Do not ask me questions. When the spec is silent, apply 00 §2 principles, choose the simplest option, and record it in docs/flow-studio/IMPLEMENTATION_NOTES.md under "Decisions made during the build".
- Implement the tests from 06 exactly as written, using the test ids in their names. Never weaken a test to make it pass; if you believe one is wrong, record why in IMPLEMENTATION_NOTES and follow the precedence rule.
- Run lint, typecheck and the relevant tests before finishing. At the end, update docs/flow-studio/BUILD_REPORT.md: what you built, test counts (pass/fail by part), known gaps, decisions made.
```

---

## M0 — Discover and plan

```text
TASK M0: Discover the repo and plan. Write no feature code in this task.

1. Read AGENTS.md and every file in docs/flow-studio/ (00–06; skim 06 Part B/C/D for structure). Open docs/flow-studio/reference/flow-studio-v35.html in a browser and click through: the picker, a few step panels, Test on "Senior cloud engineer" in "UK Technology work orders", Nova and Publish.
2. Inspect the repo and write docs/flow-studio/IMPLEMENTATION_NOTES.md with:
   - framework layout (app/ vs src/app, route groups, where shared components live), package manager, scripts;
   - auth/session: how to get the current user; any roles/permissions system; how you will map flow.edit, flow.approve_changes, runs.view, runs.control, reference.import, admin (01 §6); how owner teams map (01 §6.2);
   - database layer (ORM, migrations) or "none — will add Prisma + PostgreSQL per 01 §4";
   - design system: the Workers Index page path; the components and tokens you will reuse (Button, Badge, Input, Switch, Dialog, Drawer/Sheet, Toast, Tooltip, Card, typography); what you must build new;
   - the callGPT helper: file path, signature, how to request JSON output;
   - test tooling present or to add (Vitest, Playwright, Zod);
   - any conflict between the repo and the spec, and how you will resolve it;
   - the exact folder plan you will use (adapting 01 §2).
3. Add the npm scripts from AGENTS.md as placeholders only if they don't exist (they may fail until later milestones).
4. Copy docs/flow-studio/seed/*.json unchanged to tests/fixtures/seed/.
5. Create docs/flow-studio/BUILD_REPORT.md with a milestone table (M0–M8) and the M0 result.

Done when IMPLEMENTATION_NOTES.md and BUILD_REPORT.md exist and the fixtures are copied.
```

**Review:** the notes find the real design-system components and the `callGPT` signature, and the folder plan is sensible. If the repo has no database, decide whether Postgres is OK and set `DATABASE_URL`.

---

## M1 — Data model, seed loader, fixtures

```text
TASK M1: Implement docs/flow-studio/02-data-model.md.

1. Create every type in 02 (catalog, conditions, workflow, every node kind, approval rules, people and authority, digital workers, presets, systems, records, simulation result types, Nova and publish types, runtime types) in src/flow-studio/model/ (or the folder chosen in IMPLEMENTATION_NOTES), with the field comments from 02.
2. Create Zod schemas for every seed file; loadSeed() that reads the nine seed data files (not the fixtures runtime-records.json and test-actors.json, which tests read directly), validates them and applies the normalisation in 02 §15 in order. This includes generated "{Step} failed: escalation" steps, mergeAt on every If, Chaser defaults, version 0 for never-published drafts, and OOO dates converted to 2026. Ignore the legacy fields in 02 §16.
3. Build the test context factory used by 06 §1.2 (load once, structuredClone per test, asOf '2026-10-20', fixed clock 2026-10-20T09:00:00Z).
4. Implement the seed-count and normalisation tests from 06 Part A.4 (and any Part A test that only checks loading): 15 workflows (14 live, 1 draft), 3 approval rules, 29 samples, 440 history records, 159 boxes, 50 Approve steps, 10 generated failed-escalation steps, etc.

Done when npm run typecheck passes and the M1 tests pass.
```

**Review:** `loadSeed()` runs without renaming fields; the counts match 00 §8.

---

## M2 — Engine

```text
TASK M2: Implement docs/flow-studio/03-engine.md completely, as pure functions in src/flow-studio/engine/ (module split per 01 §2), with every string in engine/copy.ts.

Implement in this order, running the matching tests from 06 Part A and Part C after each:
1. §1 text helpers; §2 conditions (evalRow, evalCondition, scopeMatch, needs information); §3 selectWorkflow.
2. §4 walkWorkflow; §5 Digital Worker check results.
3. §6 planApprovals: inputs, change-amount basis, walk, previous approvers, rounds, resolveRoleHolder, people per item (self-approval move-up, absences with asOf, delegate eligibility, backup, pause, signing authority, split funding, raised on behalf), groups, rules, merging ("ask once"), rejection/stop/auto, checks and brief.
4. §7 approval rules; §8 change requests (not asked again, running totals, conflicting proposals, edits during approval / Try an edit statuses); §9 Auto-approve and Fits plan?.
5. §10 simulateTest and §11 composeTest. The output must match the TestRunResult type in 02 §12.1 (repeated in 06 §1.4) exactly (summary, notices, conflict, path string, steps with status/message/workerSees/rounds/tasks, fromApprovalRules, removedByEdit).
6. §12 lint (all rules, exact messages, severities, publish-blocking flags, record counts from history); §13 publish review, overlaps (identical scopes overlap), send for approval, approval by a second person (precedence applied only then), version numbering (first publish = v1), status texts; §14 active/inactive.
7. §16 graph editing operations (insert, delete, paths, setPathThen with mergeAt, add/delete path, either/or, presets, Digital Worker placement, generated escalation steps, Chaser validation) and the plain-words parser (nova-parse.ts) with the full table from 03/06.
8. Every deviation in §20 (D1–D32) must be implemented; the tests marked DEVIATION assert them.

Write all Part A (126) and Part C engine-level (lint/publish) tests from 06 as Vitest tests in tests/engine/, named with their ids. They must import only engine/model code and fixtures.

Done when every Part A test and every engine-level Part C test passes. Report the count.
```

**Review:** pick 3 worked examples from 03 (WO-2214, ASN-881, AR-305) and compare the Vitest output with the prototype's Test panel. They should match word for word, except where 03 §20 says otherwise.

---

## M3 — Persistence and API

```text
TASK M3: Persistence and API per docs/flow-studio/01-architecture.md §4–§6 and §9.

1. Implement the repository interfaces (01 §4.3) twice: in-memory (for tests) and database-backed (the repo's DB layer, or Prisma + PostgreSQL per 01 §4.1 with a migration).
2. npm run seed:flow-studio (idempotent) per 01 §4.2, and POST /api/flow-studio/reference/import (admin).
3. All Flow Studio routes in 01 §5.1 with Zod validation, exact error messages, optimistic concurrency on draft saves (409 + toast text from 01 §3.2), permission checks (01 §6). No DELETE routes.
4. Runtime route stubs from 01 §5.2 (handlers can return 501 until M7, except auth and validation).
5. POST /api/test/reset (only when LEVV_E2E=1) and the LEVV_FIXED_NOW clock (01 §5.3, §8).
6. Permissions: map onto the repo's auth; if there is none, add the dev user switcher (01 §6.3) with the seeded people plus "Flow Admin". Load users, permissions and owner teams from seed/test-actors.json (06 §1.2; actor sets default and author-only-approver), and add the test-only routes of 01 §5.3: POST /api/test/reset {actors?}, POST /api/test/sign-in {user}, POST /api/test/clock {now|advanceMs}.
7. API tests (Vitest against route handlers with the in-memory repos): simulate returns exactly the 06 A.1 result for WO-2214 in wf-wo-sub-wo-uk-tech; publish request rules (must-fix 422, past date 422 "Pick today or a later date.", author can't approve 403 "You can’t approve your own change."); first publish of "Data and AI hires" becomes v1.

Done when the seed script runs against the database, the API tests pass, and all engine tests still pass.
```

---

## M4 — UI foundation: SelectMenu, page shell, picker, canvas (read-only)

```text
TASK M4: UI foundation per docs/flow-studio/04-ui.md §0–§4 and §13–§14.

1. SelectMenu (04 §13) as one reusable component: single and multi select, search with filtering, option groups, checkmarks, "N selected" + Clear footer for multi, addable lists ("+ Add “…”"), placeholder states, keyboard (Up/Down/Enter/Escape/Tab), positioning that stays attached on scroll and closes when the field scrolls off screen, a11y (button aria-haspopup="listbox", aria-expanded, listbox, option, aria-multiselectable, labelled by the field label, search textbox named "Search"). Write the B.7 dropdown tests (UI-DD-01…) as Playwright tests against a small test page or the real panels.
2. Routes /flow-studio and /flow-studio/[workflowId] (04 §2), page frame, top bar exactly as specified (logo, "Flows", workflow picker button with status dot, status text per 03 §13.6, Nova with count badge, Test, Publish). No Settings button.
3. Flow picker (04 §3): grouping by record · event in record-lifecycle order, variations indented with their Applies-to summary, "+ New workflow" footer, keyboard, navigation behaviour.
4. Canvas (04 §4) rendering every seeded workflow read-only with the exact layout algorithm, node visuals per kind, subtitles, exit labels, If cards, escalation boxes, merge points, "+" insertion buttons ("Add a step here"), zoom −/Fit/+, selection highlight. Compare with 04 Appendix A for every seeded workflow and with the reference prototype.
5. Digital Workers rail (04 §4.10; step-menu entries in 04 §5) showing only DW_SET for the workflow's context, with hover cards (no Chaser).
6. Playwright: 06 B.1 N1–N4 and the B.7 dropdown tests; plus a test that the DOM contains no Settings button, Settings page or "Approval rules ›".

Done when those tests pass and every seeded canvas matches Appendix A.
```

**Review:** open `/flow-studio/wf-onboard` next to the reference prototype. Check that the layout, colours and labels match the spec's description.

---

## M5 — Editing: step menu, every panel, rail drag, autosave

```text
TASK M5: Editing per docs/flow-studio/04-ui.md §5–§7 and §12, using engine/edit.ts (03 §16) for every change.

1. Step menu (04 §5): groups Decide [If] · Approvals [Approve, Auto-approve, Fits plan?] · People [Collect & verify, Task] · Systems [System, Notify] · Timing [Wait, Parallel, Run workflow], ready-made onboarding/offboarding steps in those workflows, Digital Workers, search with empty state "No steps match “…”.".
2. Step panel frame and shared blocks (04 §6): header, Name, Chaser block (04 §6.3: Remind after / Then escalate to {their manager|the hiring manager} after, validation "Escalation has to come after the reminder."), Advanced sections, "Delete this step", option sets (§6.7).
3. Every panel field by field (04 §7): workflow settings (first box) incl. Active switch, Runs when, Amount to compare for changes (directly below Runs when, events changed / change_order only), Starts from, explainers, When a request is finally rejected tell (new workflow default Hiring manager), Applies to + More + summary, Advanced (Effective date, Owner); If (path cards, conditions on two lines, all/any inline, either/or groups, Then options incl. Ask someone to approve, Escalate after (hours) bound to the generated step, Steps added on the canvas, Delete path, Add a path, Add a step after the paths meet, guard toast "At least one path has to carry on"); Approve (Who approves modes starting empty, explainer sentence, How many, brief note, Chaser, Advanced: Only needed when + ✦ Set via POST /api/flow-studio/nova/condition, If rejected, Check signing authority, Ask again only if these change, Ask again when a value goes down); Auto-approve; Fits plan?; every Digital Worker check panel (with Escalate after (hours)); Collect & verify generic and every preset (What's required as an addable SelectMenu; If it fails → Failed exit + generated escalation); Task (incl. Gives the worker something); System (all sections); Notify; Wait (every mode, sentence rules); Parallel; Run workflow; End.
4. Dragging a Digital Worker from the rail onto a "+" and the placement rules (04 §5, 03 §16).
5. Autosave with draftRev and the conflict toast (01 §3.2); "· unpublished changes" status.
6. New workflow (04 §12): "+ New workflow" → Draft, Start → End, defaults.
7. Playwright: 06 B.3 (I1–I12), B.4 panel-level checks (W10–W15), B.5 (D1–D5), B.8 (no pills and no native selects in any step panel across all workflows), and B.9 items about editing.

Done when those tests pass and all earlier tests still pass.
```

---

## M6 — Test drawer, Nova, Publish, Active / Inactive

```text
TASK M6: Per docs/flow-studio/04-ui.md §8–§11 and §15–§16, using engine simulate/compose, lint, publish and active functions.

1. Test drawer (04 §8): inactive note first, "Try a record" as a single-select radio list (title, then "{id} · {note}"), summary box, notices (Σ, ✓, ⚑, "For real requests, “…” runs for this record."), conflict box with choice buttons and Undo, "Try an edit" / "Undo the edit", path chips, step cards (status badge in sentence case styled uppercase, message, Worker sees line, numbered round lines, rule task lines, "From approval rules", "Removed by the edit"), canvas path highlighting; recompute on every edit.
2. Nova drawer (04 §9): header text, "Fix before publishing" and "Check" groups, "Show me" (selects and scrolls to the step), count badge in the top bar.
3. Publish dialog (04 §10): impact sentence, must-fix list with disabled "Send for approval", overlap question answered with a SelectMenu (stored as precedence; applied on approval), "Goes live on" (default effective date if today or later, else today; past dates rejected with "Pick today or a later date."), the "nobody else can approve" must-fix row, Cancel / Send for approval, the sent message ("Sent for approval. Anyone with the “Approve flow changes” permission can approve it. You can’t approve your own change."), the toast with the date as "20 Oct 2026".
4. Active / Inactive (04 §11, 03 §14) with every text, including warnings for workflows that hold approvals or are the only active workflow for an event.
5. Copy review against 04 §15; apply every 04 §16 difference.
6. Playwright: every remaining 06 Part B test (B.2 A1–A19, B.4, B.6 P1–P6, B.9) and the UI halves of Part C.

Done when all of Part B and Part C pass.
```

**Review:** walk through 06 Part B on the build and compare each screen with the reference prototype, except for the documented deviations (06 §7.2).

---

## M7 — Runtime

```text
TASK M7: Implement docs/flow-studio/05-runtime.md.

1. Event intake POST /api/runtime/events (05 §3.1): store InboundEvent, upsert BusinessRecord, de-duplicate, selectWorkflow (Active, source, effective version), built-in prerequisites with the 7-day owner alert, create the run pinned to its version with recordSnapshot and plan, then advance.
2. advance(run) (05 §3.2) and an executor per step kind (05 §3.4): If with needs-information tasks; checks with flagDo; Approve with rounds, modes, groups, rule approvers, paused items (never auto-approve), decisions approve / reject (with requester resubmit window from onReject.resubmitDays, previous, end) / send back, escalation comments; Auto-approve; Fits plan?; Collect & verify (provider, verifier, reviewer, failures, generated escalations, ledger); System (adapter call, 3 retries over an hour, confirm with Give up after, Bring back to Levv saved on the record and preferred as the match key later, onFail task / path / pause with system_failure); Notify (outbox); Task; Chaser; Wait (moves with record dates); Run workflow; End outcomes completed / rejected / stopped and end notifications.
3. Scheduler POST /api/runtime/tick (05 §3.3) protected by the x-levv-cron-secret header (env LEVV_CRON_SECRET, 01 §5.2); document how to call it every minute in the deployment (and a dev interval).
4. Pause / Resume / Stop (05 §4) with permissions (owner team or admin), exact errors, frozen timers shifted on resume, Stop final and cancelling open steps and work items, decisions on paused runs recorded but nothing starts.
5. Adapters (05 §5): interfaces plus deterministic mocks that return exactly what Test simulates for the same record (03 §10.2); Notifier mock writes OutboxMessage; Fieldglass EventSource mock.
6. Ledger (05 §3.6). Record edits re-plan open runs (05 §2) and move waits.
7. Screens: /runs list and /runs/[runId] detail (05 §6) with status chips, read-only canvas with run statuses, step list with timers, banners, Pause and Stop dialogs with exact copy, history lines; /inbox and /inbox/[itemId] (05 §7) with Approvals, Tasks and Flow changes to approve, dialogs, empty states, and "This request was stopped. No action is needed." for stopped items. Approving a publish request from the inbox publishes the version (03 §13.5).
8. Tests: all 15 Part D tests (RT-01…RT-15, engine and UI halves) and the 05 §9 checks R-01…R-12.

Done when Part D and R-01…R-12 pass and all earlier tests still pass.
```

---

## M8 — Hardening and final report

```text
TASK M8: Hardening.

1. Keyboard-only walkthrough of every screen (picker, canvas selection and "+", every panel, SelectMenu, Test, Nova, Publish, runs, inbox): fix focus order, visible focus, Escape behaviour (04 §14).
2. Empty, loading and error states everywhere, with the copy from 04/05 (no blank panels, no raw error codes shown to users).
3. Performance: a 40-step workflow edits smoothly; simulateTest under 150 ms for the largest seeded workflow; the picker and inbox handle 500 items.
4. Copy pass: grep the UI for straight quotes in user-visible strings; compare with 04 §15 and 05 §5.3/§8.
5. Run the full suite: lint, typecheck, test:engine, test:e2e. All 239 tests from 06 plus R-01…R-12 must pass.
6. Finalise docs/flow-studio/BUILD_REPORT.md: test counts per part (pass/fail), every decision made during the build, known gaps, and anything in 00 §7 open questions that needs product input.

Done when the full suite is green and the report is complete.
```

**Review:** the report shows 0 failures. Read the decisions it lists and confirm or change them.

# Flow Studio build report

| Milestone | Scope | Status | Tests (pass / fail) |
| --- | --- | --- | --- |
| M0 | Discover and plan | **Done** | none yet; no tests exist by design |
| M1 | Data model, seed loader, fixtures | **Done** | 165 / 0 |
| M2 | Engine | **Done** | 656 / 0 |
| M3 | Persistence and API | **Done** | 656 engine, 198 API, 15 Django contract, 90 backend: all pass, 0 fail |
| M4 | UI foundation and the Workflows admin tab | **Done** | 670 engine, 200 API, 50 end-to-end: all pass, 0 fail |
| M5 | Editing | **Done**, with the Test, Nova and Publish screens still to come in M6 | 676 engine, 200 API, 145 end-to-end, Django proof: all pass, 0 fail |
| M6 | Test, Nova, Publish, Active/Inactive | **Done** | 676 engine, 202 API, 223 end-to-end (three runs), Django proof: all pass, 0 fail |
| M7 | Runtime | **Done**, on mock adapters by design (00 §4.2) | 750 engine, 208 API, 273 end-to-end (two full runs), Django proof with 13 races, 92 backend: all pass, 0 fail |
| M8 | Hardening and final report | **Done** | 755 engine, 208 API, 349 end-to-end (two full runs), Django proof with 13 races, 92 backend: all pass, 0 fail |
| Post-build review | 14 findings from an independent review, their siblings, a second round and a last round | **Done** | 894 engine, 238 API, 349 end-to-end (two full runs), Django proof with 14 races, 99 backend: all pass, 0 fail |

## Post-build review

An independent review after M8 found defects that every acceptance test missed. All 14 findings reproduced, each with a regression test seen failing on M8's code (`6dc1bbf`, run from a clean checkout) and passing now. Finding 2 was also reproduced on local Django with real sessions. **This changes M8's "Where it stands": the build was green and unsafe at the same time, and the suites below are green again only for what they test.** Reasons and decisions are in `IMPLEMENTATION_NOTES.md`, "Post-build review" and binding decision 5.

Test files: `PBR` = `tests/engine/post-build-review.test.ts`, `ID` = `tests/api/identity.test.ts`, `DJ` = `tests/django-e2e/identity.spec.ts`.

| # | Finding | Reproduced | Outcome | Regression tests |
| --- | --- | --- | --- | --- |
| 1 | Resubmit could rewrite control fields: `prev`, `requester`, `states` | Yes, all three | **Fixed.** Requesters get an allow list; anything else is 422 and nothing is written. A resubmit can't pick an approver. provide-field and the record route checked too. (Round 2 replaced this round's refusal of a resubmit that dropped its step; see below) | PBR 1a to 1i; ID "The routes refuse control fields" |
| 2 | Identity was a user-chosen name | Yes, on local Django: took Raj's item, paused as the owner, approved own change | **Fixed.** Decision 5 replaced: Django user id plus a tenant-scoped link, set only with `reference.import`. Migration `0003_account_link` | DJ, all 6; ID; backend `AccountLinkTests`; store contract |
| 3 | An Approve step missing from the plan was marked approved with nobody asked | Yes, triggers A and B | **Fixed, fail closed.** Needs a real decision or a positive reason in the plan; otherwise re-plans from the run's path and record, then waits. An event that changes who must approve re-plans | PBR 3a to 3e, "a step the plan can’t account for waits" |
| 4 | "Not needed" never asked after an edit made it needed | Yes | **Fixed** with 5 to 7 | PBR 4, 4b, 4c |
| 5 | A new rule approver joining a finished round was never asked | Yes | **Fixed** | PBR 5 |
| 6 | A rule-only round could be skipped with nothing left to start | Yes, both cases | **Fixed** | PBR 6a, 6b, 6c |
| 7 | In order: an edit didn't re-ask earlier rounds | Yes | **Fixed** | PBR 7a, 7b, 7c |
| 8 | A draft save changed live routing and pinned runs with no approval | Yes | **Fixed.** 01 §4.1's snapshot list omits `records` and `event`; versions now carry them. Real runs read only the published or pinned version; Test keeps the draft | PBR 8a to 8i |
| 9 | A rejection while paused was lost if someone else approved | Yes | **Fixed.** First answer wins, as on a running run | PBR Finding 9 |
| 10 | A Chaser copy of a withdrawn approver still satisfied the role | Yes | **Fixed.** Cancelled with its original, and its holder told | PBR Finding 10 |
| 11 | The worker wasn't excluded from approving | Yes | **Fixed** in the engine, so Test and runs agree, and at decision. No 06 output changed; seeded workers aren't approvers (asserted) | PBR 11a to 11h |
| 12 | An event could be stored without its data | Yes | **Fixed.** Event, record and open runs' changes commit together; `pollSource` shares it | PBR 12a to 12e |
| 13 | Overlaps checked only when sending | Yes | **Fixed.** Rechecked at approval, 409 `OVERLAP_OPEN`; concurrent approvals can't both pass | PBR Finding 13; race on memory and Postgres |
| 14 | Publish overwrote a status switch; adapters called before the claim, with a new run id each attempt | Yes, both | **Fixed.** Publish writes status only from draft. A run claims first, then advances; a crash in the gap is picked up by the tick | PBR 14a to 14e |

Controls that passed before and after, on purpose, so a fix can't overshoot: PBR 1e, 3b (F9 still holds), 4c, 7b, 9's running-run and Chaser cases, 10's copy of someone still asked, 11e, 11h, 12e, 13's choice made when sending, 14b, 14d. **14d did not fail on M8 as I expected, so it guards the fix without proving the bug:** the memory store runs the two events one after the other. 14c is the test that fails on M8 for that finding. 4c passes on M8 only because M8 never reopened the step; the sibling test "a second edit…" is the one that fails there.

**Siblings found and fixed: 12.** The worst: an edit blanking what a decided If read completed the run with no End reached; a second edit took what followed a re-asked step off the line; and a withdrawn step's resubmit window went on to reject the run. All 12 are in the notes.

**Found, not fixed, for a decision.** A role's holder changing after they approved (03 §8.4 keeps the role's approval); events trust the sender for `requester` on a new record. Round 2 fixed the failed-check deciders and made the switch's overlap visible, and that overlap stays an open question.

**Pre-existing, not changed:** A pre-existing security issue in an existing account endpoint, outside Flow Studio, was reported to the team privately. Not changed here.

**Tests changed, none from 06:** `runtime-checks.test.ts` "send back…", whose input is what finding 1 now refuses, split in two with more asserted; `server-helpers.test.ts`, whose test asserted the overruled decision; the Django proof's expected names. **No 06 test changed, and no fix contradicted one.**

### Round 2

The re-review confirmed the 14 fixes hold on their original inputs, and demonstrated variants and new defects. All reproduced, each with a test in `tests/engine/post-build-review-2.test.ts` (`PBR2`) seen failing on the first round's code (`6b8b619`). Reasons and wording: notes, "Post-build review, round 2".

| Item | Severity | Reproduced | Outcome | Regression tests |
| --- | --- | --- | --- | --- |
| A | High | Yes: SOW Legal, rule on a clearance, IR35 task, and the $300K to $200K refusal | **Fixed, the owner's decision; the last round corrected how** (no old exits, per seat). A requester's resubmit can add but never remove; the run keeps a floor every re-plan honours; whoever sent it back sees it again. `RESUBMIT_DROPS_APPROVAL` is gone. Not a spec conflict: 03 §8.4 is about edits, only 05 joins them to resubmits. Edits still shrink | PBR2 A1 to A11, PBR 1f |
| B | Medium-high | Yes, by edit, by event, and a rejection | **Fixed.** Withdrawal happens at re-plan on any run status | PBR2 B1 to B3 |
| C | Medium-high | Yes | **Fixed.** Admin's event: deny list, attributed, nothing stored on refusal. Both paths: `requester`, `prev`, `original_total`, `changed_fields` can't change while a run is open; the token's are dropped and logged. New records and the token's `states` work as 05 §3.1 needs | PBR2 C1 to C5; ID "POST /runtime/events" |
| D | Medium | Yes, and the copy | **Fixed,** as `askRound` does, and by event | PBR2 D1 to D5 |
| G | Medium-low | Yes | **Fixed.** A System retry and a verifier wait for the approval. An open Task may finish, doesn't pass it, and writes its ledger line because it happened | PBR2 G1 to G4 |
| E | Medium-low | Yes | **Fixed.** Not merged into a step it leads to, so the person is asked at both; the runtime fails closed too | PBR2 E |
| F | Low | Yes | **Fixed.** Leading rule rounds are always asked | PBR2 F |
| H | Low | Yes | **Fixed.** Goes to the requester's manager, or waits and says why | PBR2 H1, H2 |
| I | Low | Yes, both | **Fixed.** Imports look at running and paused runs | PBR2 I1, I2 |
| J | | Yes | **Warning, not a block,** as 03 §14.4 requires, and the log no longer claims a priority. **Open product question** | PBR2 J1 to J3 |
| K | Small | Yes | **Fixed:** own-property checks, `__proto__`, the docstring, the pinned name | PBR2 K1 to K3 |
| Safety net | | New | A run with nothing open and nothing scheduled pauses with a system reason and tells its owner. It never approves. It wakes when something changes | PBR2 N1 to N5 |

**Explained how:** a person kept by a resubmit gets a `kept` run log line, a sentence in their brief and a note on the round line. Test has no resubmit, so it shows none of this and its output is unchanged.

**Controls in PBR2 that pass on the first round's code, on purpose:** A7, A11, C2, C3, C5, G3, J3, N4. G3 records that finishing a task never did pass the approval; the ledger decision is now on record.

**Tests changed, none from 06:** PBR 1f, as instructed; PBR 1h, because the item now goes to the manager. **No 06 test changed, and no fix contradicted one.**

### Last round

A final re-check found three Medium defects and one Low, all in round 2's work or left by it. All reproduced in `tests/engine/post-build-review-3.test.ts` (`PBR3`) and failed on `bc7ecc2`.

| # | Severity | Outcome | Regression tests |
| --- | --- | --- | --- |
| 1 | Medium | **Fixed.** The floor compares per step and role, groups included. A person asked for something else no longer counts. "Who approved the original" is frozen before the first resubmit, both ways. **This corrects round 2's claim that the people comparison caught it "by construction": it didn't** | PBR3 1a to 1e (1f is a control) |
| 2 | Medium | **Fixed.** The floor keeps no exits: an If takes only what the record selects. A kept Approve step is asked with no exit onward, and System, Notify and Run workflow wait for it. No System or Notify runs on a branch the record doesn't select, and a corrected value can't reach an unrelated rejecting If. **A Task on such a branch isn't kept: please confirm** | PBR3 2a to 2e (2f to 2h are controls for X2, X4, X6); PBR2 A1 to A11 for V1, V1b, V1c, X5 |
| 3 | Medium | **Fixed.** `requester` and the event route's other control fields are a 422 on the record route while a run is open. A stored conflict can't name a control field through `/choose`; Stop is the way out of one | PBR3 3a, 3b, 3d (3c is a control); ID "POST /runtime/records and /choose" |
| 4 | Low | **Fixed.** A retry held behind an approval no longer counts as scheduled, and the owner is told once per stuck episode | PBR3 4a, 4b (4c is a control) |

**Open, left alone as instructed:**

- **A mistaken raise keeps its approvals for the rest of the run,** with no route to clear it.
- **A token's `prev` with no open run starts a run that can complete with nobody asked.** Trust in change events. **It must be handled before events are connected.**

## Final report (M8)

Read this section first. The milestone sections below it are the history of how each part was built.

**Where it stands:** the build is complete against the spec on mock adapters, and every suite is green on this machine, after the post-build review above found what those suites had missed. **It has never run on the hosted database or in production.** Nothing in it is connected to a real system, sends a real message or receives a real event. The "Before production" checklist below lists what stands between this and a live tenant.

### Test counts

| Suite | Pass | Fail |
| --- | --- | --- |
| `lint` | clean | 0 |
| `typecheck` | clean | 0 |
| root `tsc --noEmit -p tsconfig.json --incremental false` | clean | 0 |
| `test:engine` | 894 (755 at M8 + 66 in `post-build-review.test.ts` + 45 in `post-build-review-2.test.ts` + 26 in `post-build-review-3.test.ts` + 1 split test + 1 race) | 0 |
| `test:api` | 238 (208 at M8 + 28 in `identity.test.ts` + 2 store contract; the old naming test was replaced, not added) | 0 |
| `test:e2e` | 349, two full runs in a row after the fixes, no retries configured, no intermittent failure | 0 |
| `test:django`, on local Docker Postgres | 17 store contract, 40 proof checks, 17 browser (16 + 1 next-day), 14 races | 0 |
| `next build` | passes, 97 static pages | |
| backend `manage.py test` | 99 (92 + 7 `AccountLinkTests`) | 0 |
| backend `makemigrations --check` | no changes | |

These are the numbers after all three rounds of the post-build review, from the final run, whose logs are not in the repo. The rest of this section, including the 06 table, was written at M8; every 06 id still passes as written.

| Part | Ids in 06 | Have a test | All pass | Fail |
| --- | --- | --- | --- | --- |
| A, engine | 126 | 126 | 126 | 0 |
| B, UI | 82 | 82 | 82 | 0 |
| C, lint, Nova, publish | 16 | 16 | 16 | 0 |
| D, runtime | 15 | 15 | 15 | 0 |
| **06 total** | **239** | **239** | **239** | **0** |
| 05 §9, R-01 to R-12 | 12 | 12 | 12 | 0 |

This table is not hand-kept: a script read the ids from the headings of `06-acceptance-tests.md` and matched them against the Vitest and Playwright JSON results of the final run. An id with no test, or with any failing test, would have shown up.

"Passes" means every test carrying that id passed, in the engine half and the browser half. Part C's LP-15 is engine only, as 06 says. R-01 to R-12: 05 §9 asks for Vitest only, and the browser half is my addition.

**Assertions that differ from 06's letter: five.** Each follows a higher-precedence document, and none is left failing. Both quotes are below.

| Id | 06 says | The higher document says | What the test does |
| --- | --- | --- | --- |
| **EN-104** | The new Approve node, listed with no `who` and no `remind` | 02 §5.14: "`{kind:'appr', label:'Approval', roles:[], who:'roles', mode:'all', authority:false, material:[], reaskOnDecrease:true, remind:24, sla:48, reject:'requester'}`"; 03 §16.1: "Create the node (DM §5.14)" | Adds exactly those two fields to 06's object. They are the defaults when absent, so nothing behaves differently |
| **EN-106** | A.4's general rule: "other nodes must be untouched" | 03 §16.5: "Sync generated labels", and 06's own I6 graph has `n103_else` as "Otherwise: escalation" where I5 has "No: escalation" | Asserts the If as listed and the whole graph equal to I6, which is stricter than the general rule |
| **LP-07** | `RA_C1.outs[0].to = "RA_C2"` gives one item: "“Rate over card?” sends every path to the same place, so it does nothing yet." | 03 §12.2 L13, required by D24: "a node not reachable from `T` (other than `END`) \| warn \| “{t}” can’t be reached from Start, so it never runs." | Expects 06's item plus the L13 item for `RA_A2`. On screen, Carry on removes Rate review, so Nova shows exactly 06's one item |
| **UI-ESC-01** | "Test card “Otherwise: escalation” ends “Chaser reminds after 24h and escalates to their manager after 36h”" | 03 §10.4 item 6: "Else → ok "Covered", m "The same person already approves this kind of decision on this path"", through 03 §6.10 | The default Escalate to is Cost center owner, who already approves on WO-2231, so it asserts Covered. It then changes Escalate to to Procurement and asserts 06's ending, so the one-timer point is still proved through Test. **Needs product input, below** |
| **UI-RULE-01** | Step 2 "equals EN-071", whose step has `"id": "RW"` | 03 §16.0: a step made on screen gets `n102` | This one comparison drops `id` on both sides. 06 §1.5 compares title, badge and message, not ids. Everything else in EN-071 is compared |

Readings of 06 that weaken nothing, recorded in the notes: EN-117 "adds" (the node already exists once normalised, so the test asserts the end state and also adds it from `approval`), EN-123's signature, LP-10's array, LP-13's `admin`, LP-15's `outs`, UI-I11's `rowsText` alias, 06 UI-P6's single Close, and 06 §1.5's round lines against 04 §8.2.

**Tests changed in M8, all mine, none from 06:** `runtime-screens.spec.ts` asserted the raw `159000` in the Record panel and now asserts `$159K`. `ui-panels.spec.ts` follows the new lost-edit wording and also checks that the toast outlasts 2.8 s. The `admin-workflows.spec.ts` test at a 1000 wide window is renamed for the new widths, and its limit went from under 720 to under 500. No test was skipped or weakened.

**Flakiness.** None in the final run: both `test:e2e` runs passed 349 of 349, and Playwright retries are off, so nothing was retried into passing. Four things you should know instead. (1) The final run's `test:engine` first failed 1 of 755, on a check I had just added to `tests/engine/performance.test.ts`: I guessed more than 10 step cards and EN-001 has 9. It failed every time, so it was not intermittent. The check now says exactly 9, and the suite was rerun at 755 of 755. Nothing else was rerun for it, because only that test file changed. (2) An early M8 run reported 1.1 hours, with `/runs: filters…` and `/runs/[id]: every control…` at about 17 minutes each, the second timing out in `beforeEach`. The machine had slept. Those tests had wrong expectations of mine as well, since fixed; the same specs then ran 75 tests in 2.5 minutes. (3) M4's one unexplained `test:api` failure was never identified, because its log was cut off, and it has not come back in any run since. (4) Both e2e logs carry the same 16 server lines, "The render was aborted by the server without a reason": Next cancelling a server render when a test navigates away mid-stream. No test fails on them, but they would show in production logs too.

### Performance

Measured in this build, in headless Chromium on `next start`, on the **memory store**. What Django adds to the 500-item reads is not measured. Latency is the browser's Event Timing, from input to next paint. The prompt's "edits smoothly" gives no number, so I used 200 ms, Core Web Vitals' "good".

| Target | Measured (two final runs) | Limit in the test | Result |
| --- | --- | --- | --- |
| `simulateTest`, largest seeded workflow (`wf-onboard`, 20 boxes), every fitting record, 25 rounds | median 0.04 ms, worst 0.62 ms | **150 ms** (the prompt's) | Pass |
| `simulateTest`, slowest of all 15, worst single call | 27.4 ms (one call, median 0.03 ms) | 150 ms | Pass |
| 40 steps: `simulateTest` + `composeTest` | median 0.29 ms, worst 18.3 ms | 150 ms | Pass |
| 40 steps: edit, layout and lint for one keystroke, no browser | median 0.36 ms, worst 4.8 ms | median 50 ms | Pass |
| 40 steps: page to canvas | 114 to 140 ms | none | |
| 40 steps: worst keystroke in a panel, input to paint | 24 ms | 200 ms | Pass |
| 40 steps: worst interaction inserting a step | 24 ms | 200 ms | Pass |
| 40 steps: worst interaction opening Test and changing record | 24 ms | 200 ms | Pass |
| Picker, 515 workflows: page to canvas | 257 to 263 ms | 3000 ms | Pass |
| Picker: worst interaction opening it | 64 ms | 200 ms | Pass |
| Picker: worst arrow key | 24 ms | 200 ms | Pass |
| Picker: worst keystroke in a panel, lint reading all 515 | 16 to 24 ms | 200 ms | Pass |
| Inbox, 500 items: route answer | 7 ms | none | |
| Inbox: page to 500 cards | 160 to 172 ms | 3000 ms | Pass |
| Inbox: Approve to the list showing 499 | 166 to 183 ms | 3000 ms | Pass |
| Inbox: worst interaction | 16 to 24 ms | 200 ms | Pass |
| `/runs`, 499 rows: page to rows | about 1380 ms | 3000 ms | Pass, and the slowest thing here |
| `/runs`: worst keystroke filtering | 24 to 32 ms | 200 ms | Pass |

Event Timing rounds to 8 ms, so 24 means 24 or a little less. The 3000 ms and 200 ms limits are mine; only the 150 ms is the prompt's. These timings are from a machine with an Apple M2 Max, so a slower laptop will read higher. The 40-step workflow is `tests/support/forty-steps.ts`.

No code needed changing for performance. Creating 500 workflows through the route took about 31 s, or 62 ms each, because each new workflow reserves every id. Provisioning that many would notice; a person would not.

### What changed for the five items left open

1. **`/runs` and `/inbox` colours: fixed.** These routes' `main` uses `grow basis-0` instead of `flex-1`: the same flex, but not what the `globals.css` rules match. So chips and buttons are cyan and the canvas is slate-950, the 93 rules are untouched, and no other page changes. Asserted by computed style, with two controls: adding `flex-1` back turns the chip blue, and a probe on `/admin/users` is still repainted.
2. **Record panel and cancelled steps: fixed.** Catalog labels, then 02 §14's "the worker’s time zone"; `$95K`, `3%`, `16 Nov 2026`, Yes and No. A stopped approval reads "Cancelled", without "If rejected…". `$95K` is 03 §1.1's `fmt`, the spec's only money format, so large values round: 159,550 reads `$159.6K`. **Tell me if the Record panel should show exact figures.**
3. **My own wording: reviewed.** "Flow Studio couldn’t load…" stays. NOT_SEEDED now says who to ask: "Flow Studio isn’t set up for this organisation yet. Contact Levv support to load its workflows." **This assumes a support route exists.** The lost-edit toast adds "Check it and make your change again." and stays 10 s. Run screens no longer blame "someone else" for a network failure.
4. **`/admin/workflows` at 0.5: improved, with a trade-off.** The embedded column now opens at 0.7 where a workflow would fit smaller, so a title is 9.1 px rather than 6.5 and a subtitle 8 rather than 5.75. `/flow-studio` stays at 0.5 and Fit, −, + stay 04's on both routes. The cost: 1 of 15 workflows fits the column without scrolling, against 3 of 15 at 0.5, so 12 scroll either way. Beside a drawer, 354 px of canvas holds about 2.3 steps rather than 3.2. To offset that, a box pressed under the drawer now moves clear of it. The canvas beside a drawer is still narrow: only a wider column changes that. The run page's canvas got the same opening zoom and the zoom controls it lacked. It is one constant, `ZOOM_OPEN_COLUMN`.
5. **About 1100 wide: fixed.** Between 500 and 720 the embedded shell now has its own layout: no rail (Digital Workers stay in the step menu), top bar on one or two rows instead of three, and the 390 drawer beside the canvas with the pressed box in view, rather than a full-width sheet. Below 500 (a window under about 1084) it is 04's sheet, and `/flow-studio` is unchanged.

### Hardening found and fixed

Keyboard tests with real Tab presses, on every screen. **04 §14.3's "The first Tab enters the panel header" had never been built.** Focus fell to the page after inserting a step, Show me, picking a workflow, deleting, Delete path, Pause, Stop and answering a card. Eleven kinds of control had no focus ring, including every "+" and every input. The rail's hover card was mouse-only, and `prefers-reduced-motion` covered only the toast. `/runs`, `/inbox` and the detail pages were blank while loading, and an expired session showed a message instead of going to sign-in. A tenant with no workflows sat on the skeleton forever. Full list in the notes, "M8: hardening".

### Known gaps

**Not exercised at all:**

- The hosted database, production, real tenants, and the live URL map.
- **The live `callGPT` path.** No API key exists here, so ✦ Set has only run through the deterministic parser on screen and a stubbed `callGPT` in `tests/api/nova-model.test.ts`. `temperature: 0` and the 8 s limit have never met the real API.
- A screen reader, and any browser but Chromium. Colour contrast was not audited.
- The 500-item and 40-step numbers on Django.

**Behaviour you may trip over:**

- A panel walk by keyboard covers one box of every kind, ready-made step and Digital Worker, about 30 of the 159. The no-pills and copy crawls cover all 159.
- SelectMenu's Clear cannot be reached by keyboard, because 04 §13.5 has Tab close the list. Taking rows off with Enter does the same thing, more slowly.
- Fit's floor of 0.35 does not show a long workflow whole: `wf-ending` would need 0.2. Ctrl/⌘ + wheel zoom (04 "recommended") is not built.
- In the `narrow` layout there is no rail, so a Digital Worker cannot be dragged; the step menu has them all.
- A browser crash with no `pagehide` can lose the last debounced edit. The unsaved-edit journal is per browser, not per person.
- A run with nothing open and nothing scheduled is paused by Levv at the next tick and its owner told; a person is the only way forward. A Wait with no date yet counts.
- A signed-in account is a person only once it is linked. An unlinked one has an empty inbox with no explanation, and there is no screen for linking yet: it is `POST /api/flow-studio/account-links`.
- A tenant with one admin can never publish (F12 as designed). Real tenants may hit this first.
- Only admins, the account linked to a person named as a workflow's owner, and accounts linked to its owner team can pause, resume or stop on a real session.
- `tests/django` and the Django proof need Docker and a local Django, so they are a separate command. No CI runs anything.

**By design, out of scope (00 §4.2):** real connectors, admin screens for people and rules, the worker portal, reaction to cancellations in other systems.

### Open questions needing product input

Each has a default built and is cheap to change.

1. **UI-ESC-01: should a "someone must decide" escalation merge with an earlier approval by the same person?** 06 expects a Chaser line on WO-2231's escalation; 03 §6.10 and §10.4 make it Covered, because the default Escalate to already approves on that path. 03 outranks 06, so it is Covered. 03 §15 item 13 says never to ask twice, but a decision that someone "must act" on is arguably a different kind of decision.
2. **Can a failed check's escalation be covered by an earlier approval? A run and Test currently disagree.** Test shows Covered, as 03 §10.4 says. The run asks anyway, because the failure happens after that approval: covering it would carry a failed check past someone who never saw it. 05 §5.2 says "A run and its Test therefore always agree", and here they do not. I chose safety. If you answer (1) "don't merge", both agree.
3. **Is a duplicate event turned away once its run has ended?** 05 §3.1 step 4: "started in the last 24 hours and is not ended". Built as written, so a retried event on a workflow that finishes at once (TS-9934, auto-approved) starts a second run and notifies twice. De-duplicating ended runs too would block a legitimate resubmission within 24 hours.
4. **Nova count colour at 0.** 03 §12.1: "(grey when 0)". 04 §9: "emerald at 0", as are 04 §1.3 and the prototype. 03 outranks 04, so it is grey. One class in `TopBar.tsx`.
5. **Do generated steps count in the If card's "+1"?** 04 §4.4: "“ +{n}” when the path has more steps". 03 §16.3's `laneSteps` counts the generated escalation, so a card reads "→ Registration verified +1", while 04 Appendix A writes that path with the escalation in brackets. Built as 03.
6. **What does approval publish when the draft changed after sending?** 03 §13.5: "`published = {nodes: deepCopy(draft.nodes), scope, name}`". 04 §10: "The canvas stays editable; further edits go into the next draft." 01 §4.1: "`snapshot` … the draft being published". Read literally, 03 publishes edits nobody reviewed. I publish the snapshot that was sent, and the workflow then reads "Live v1 · unpublished changes". This is the one place I read 03 against its letter, so please confirm it.
7. **The five tests in the table above.** Confirm the readings. UI-ESC-01 is question 1; the other four change no behaviour.
8. **Exact figures in the Record panel, and whether "Contact Levv support" is the right place to send someone** (item 2 and 3 above).
9. **00 §7's own list,** built as its defaults: "any one" approvers only drop the requester (D30); assignment events start only once the worker is cleared to start; SOW rules match `submitted` while SOWs start on `created`, so rules do not apply to new SOWs, which is a data fix (D2); People Ops, IT service desk and Accounts payable may decide failed checks but not approve requests (R10); `OB-2251` and `ASN-915` fit no workflow and stay unused.
10. **R-06's Hiring manager is the requester** when a work order names none, through `ORG.Operations.hm`. Allowed by the rules, odd to read.

### Before production

Nothing here has been done. Do it in this order.

- [ ] **Load balancer.** `/api/*` and `/admin/*` go to Django today, so without this the Next routes answer 404. In `levvai-lb-urlmap`, add frontend rules for `/admin/workflows`, `/admin/workflows/*`, `/api/flow-studio/*` and `/api/runtime/*`. **Do not add `/api/test/*`.** Confirm that `/flow-studio`, `/flow-studio/*`, `/runs`, `/runs/*`, `/inbox` and `/inbox/*` reach the frontend; I never inspected the live URL map. Check whether the frontend route rewrites the Host header (notes, decision 2).
- [ ] **Env, `levvai-website`:** `FLOW_STUDIO_STORE=django`, `FLOW_STUDIO_BACKEND_URL`, `FLOW_STUDIO_STORE_TOKEN`, `LEVV_SERVICE_TOKEN`, `LEVV_CRON_SECRET`, and `OPENAI_API_KEY` if ✦ Set should use the model. **Never set** `LEVV_E2E`, `LEVV_MOCK_AUTOCOMPLETE` or `LEVV_FIELDGLASS_EVENTS_FILE`.
- [ ] **Env, `levvai-backend`:** `FLOW_STUDIO_STORE_TOKEN`, the same value. If it is unset the store answers 503, so this fails closed.
- [ ] **Deploy** the `flow-studio` branch of both repos. Nothing has been pushed or merged.
- [ ] **Migrations on the hosted database have NOT been run.** `python scripts/run_migrations.py` applies `apps.flowstudio` `0001_initial`, `0002_run_claim` and `0003_account_link`. Every run in this build used the local Docker Postgres. Take a backup first; this is the first time this app meets that database.
- [ ] **Seed or import per tenant.** `npm run seed:flow-studio` with `FLOW_STUDIO_BACKEND_URL`, `FLOW_STUDIO_STORE_TOKEN`, `FLOW_STUDIO_SEED_TENANT_HOST=<tenant>.levvai.com` and `FLOW_STUDIO_SEED_ALLOW_REMOTE=1`; neither that flag nor a real tenant has ever been used. Until then, a tenant reads "isn’t set up". **The seed's people are fictional:** import real ones through `POST /api/flow-studio/reference/import`, or every approval goes to names nobody signs in as and waits forever.
- [ ] **The per-tenant scheduler.** One Cloud Scheduler job per tenant, every minute, `POST /api/runtime/tick` with `x-levv-cron-secret`; the command is in the notes. Without it no reminder, escalation or Wait ever fires. Provisioning a tenant must also create its job.
- [ ] **Real adapters** (05 §5). Every one is a mock. A System step reports "done" with a made-up ref, and **a verifier reports a background check as passed having checked nothing**, with a "Simulated" line beside it. Nobody should act on these before real adapters exist.
- [ ] **Real message sending.** The Notifier writes `OutboxMessage` and `sentAt` is never set. **Nobody is told anything:** approvers see work only by opening `/inbox`.
- [ ] **Something must raise events. Nothing does yet.** Whatever does has to set `requester` to the linked person, not a display name, and **has to be trusted about `prev`**: a token's `prev` with no open run starts a run that can complete with nobody asked. Handle that first. `POST /api/runtime/events` works with the token, but no Levv screen calls it when a record is submitted and nothing polls Fieldglass. Until this exists a real tenant has no runs.
- [ ] **Exercise the live `callGPT` path** once with a real key: temperature, the 8 s limit, the JSON parse and the fallback.
- [ ] **Fix the pre-existing account security issue** that was reported to the team privately.
- [ ] **Link accounts to people, in every tenant. Required.** After the seed or import, someone with `reference.import` calls `POST /api/flow-studio/account-links` `{accountId, person, teams?}` for each person who decides, by Django user id (`GET` on the same route lists members). Until an account is linked it has an empty inbox and approves nothing, including flow changes. A tenant with nobody linked can't publish: Nova shows "nobody else can approve". `teams` is the owner-team membership, so only linked teams, admins and the linked owner can pause, resume or stop. There is no screen for this yet.
- [ ] **A second linked admin in every tenant,** or nothing can ever be published there.
- [ ] **Re-measure the 500-item pages on Django,** once a real tenant has that much.

### Every decision made during the build

Reasons are in `IMPLEMENTATION_NOTES.md`, under the milestone named. "Mine" means the spec is silent.

**Before M0 (binding, from the project owner, three corrected in M0):** shared shell with `/admin/workflows` embedded and `/flow-studio` full page; `isStandalone` in `app/layout.tsx`, since `ClientShell.tsx` is dead code; Django store with TypeScript logic; `OrderedJSONField` (`json`, not `jsonb`), because `jsonb` reorders keys and changes results; a store token as well as the session; identity by name, **overruled after the post-build review: identity by Django user id and a tenant-scoped link**; an in-house canvas.

**M0–M1:** Node 20 with a separate strict tsconfig; root `downlevelIteration`, no regex named groups in app code; `next build` ignores ESLint because existing code has 28 errors; port 3310. `published.nodes` normalised too; `versions` built after step 7; validation returns the input, never Zod's output; unknown keys pass through; `loadSeed` outside `model/`; normalising twice changes nothing; `flagCont` on every check; `oooUntilText` rather than a second field; `LIMIT` filled with 0.

**M2:** `engine/resolve.ts` to avoid a cycle; nobody approves their own request, checked again after limits and delegates; rule-only rounds removed before merging; `auto` false when stopped; `walkOutcome` from taken edges; `stopped.by` is the step before the generated Notify; reject default `who` is `cco`; a generated step passes its `sla` on; `setPathThen` refuses with `{ok:false}`; a new Collect gets its escalation at insert; `setApprovers` keeps the last list in the editor; `selectWorkflow` reads the published scope.

**M3:** one repository layer over two drivers; rows hold the entity verbatim in `doc`; `insert`, `upsert`, `patch`, `updateWhere` in one transaction, no delete op; `patch` for no lost updates; which writes move `draftRev`; a draft save takes only editable fields; service-context writes only for `authorNotifiedAt`; a cookie that does not resolve is refused; `LEVV_E2E` refuses the Django store; picker order in `summaries.ts`; ids; status codes; reject needs a comment and the author cannot reject; `publishedVersion`; `POST /active`'s shape; the seed refuses a remote backend two ways; a workflow published past its seed is skipped; `callGPT`'s optional argument.

**M4:** placeholder plus portal for the embed; shell in the route's `layout.tsx`, pages return `null`; the aside's height on this route only; `variant`; 18 px lane margin; a step with no way in is drawn; load failures; a deep-linked `?step=` scrolls; page search entry; remembered workflow is one key per browser; the Workflows tab after Approval Chains.

**M5:** `use-editing.ts` as the one way to change a workflow; 800 ms autosave, one request at a time; a 409 stops saving; `ctx` keeps its identity; memoised layout; `ConditionEditor` holds no state; deleting a generated step leaves its owner coherent; Runs when resets `source` and `days`; Applies to order; "What starts this"; ledger lines from every onboarding draft; numbers commit only when valid; `Details` never closes itself; scroll room past the drawer; accessible names with no visible label; placing on a step that takes nothing opens it; `laneSteps` in path order.

**M6:** everything on these screens computed on the client, the server authoritative at send; `liveCtx`; one drawer slot; `queryOf`; options reset per workflow and record; dialog portaled at `z-40`; `heldBack`; `DRAWER_ROOM`; `supersedes`, keepalive and the journal so the last edit is not lost silently; Publish while waiting shows the sent state; Send saves first; scrim click with a dropdown closes only the dropdown; Hide and top-bar focus; LP-16's record.

**M7:** one transaction per command with `rev`, retried up to 25 times; a run's taken path is its own; `advance` returns at once while paused; plans recomputed, not patched; `RunClaim` for duplicates; `dataRev`; run-level events queued first; `views.ts`; `at` is company time; `isMock` and `step.simulated` so no mock leaks silently; Inbox and Running workflows in the app sidebar; a check or If that rejects goes back first; a failed-check rejection stops the run; what a Chaser copy answers for; "previous" with nobody before it; synthetic rule steps; record edits move a decided If; `POST /runs/:id/choose`; the switch-off confirmation; refusal codes; extra log lines; ledger close.

**M8:** `grow basis-0` on run screens rather than a portal or counter-sheet; `fmt` for money in the Record panel, and which fields it hides; a cancelled step shows only what was answered; `ZOOM_OPEN_COLUMN` 0.7 for the column and the run page; a pressed box moves clear of the drawer, embedded only; zoom controls on the run canvas; `shellFit` with `narrow` from 500 to 719; the admin aside stays; the Tab bridge also for Test and Nova; delete sends focus to Undo, then to the step before; removed buttons hand focus on; Pause and Resume are one element; 200 ms as "edits smoothly"; "Loading…"; failed writes read 04 §14.1's sentence; the new NOT_SEEDED and lost-edit wording; 10 s on the load-time notice.

### Every spec contradiction and its resolution

Precedence is 00 → 03 → 02 → 04 → 06. Both quotes for each are in the notes, under the milestone named. 06 §7.3 says none are known; these are all of them.

| Where | Contradiction | Resolution |
| --- | --- | --- |
| M0 | Empty Approve title: 06 §1.5 "Approve", 04 §4.3 "Approval" | 04 |
| M0 | Sample note: 02 §11 "not shown", 04 §8.2 and 06 §1.5 show it | Shown: 02 is a field comment |
| M0 | Scope text order: 03 §1.4 key order, 04 §7.1 fixed order | 03, with new picks written in 04's order |
| M0, M5 | Helper fallback: 02 §5.14 `proc`, 04 §7.7 per worker | 02 |
| M0 | Auto-approve wording: 04 §7.4, 02 §5.5 | 04's string, 03 §9's logic |
| M0 | Reference key: 01 §5.1 `digitalWorkers`, 02 §0.1 `dws` | `dws` inside, 01's name on the API |
| M0 | Plurals: 04 §11, 03 D29 "SOWs" | 03 |
| M0 | Summary null: 06 §1.4, 02 §12 | 02 and 03 |
| M0 | GPT prompt: 01 §7, 03 §17.2 | 03 |
| M0 | 04 §14.1 "Toasts (all)" omits 01 §3.2's conflict toast | Toast shown |
| M0 | DW icons: 02 §8 path data, 04 §1.4 lucide | lucide |
| M1 | "Done" label: 04 Appendix A cites 02 §15 step 7, which does not say it | Stored, as 03 §16.11 does for System |
| M1 | Generated step fields: 02 §15, 03 §16.12, 02 §5.4 | All set; `toMatchObject` in EN-117 |
| M1 | `BusinessRecord` shape, 02 §14, against its flat fixture | Mapped at intake |
| M1 | `LIMIT`: 02 §7 `number \| null`, 02 §15 `Infinity` | Stored form and loaded form typed apart |
| M2 | `needsPlan`: 03 §6 literally against 03 §19 E22–E29, EN-001 and 06 §1.2 | A generated step counts only once walked |
| M2 | EN-104, EN-106, LP-07 | Table above |
| M2 | EN-117 "adds" on a normalised graph; EN-121 "no `remind`" | End state asserted |
| M2 | EN-123 signature against 03 §17.2 | `async (text, catalog, deps?)` returning `{join, rows}` |
| M2 | LP-10 one precedence object, 02 §4 array | Array |
| M2 | LP-13 `admin` against 03 §13.4's formula | `admin` counts (03 §13.1, 01 §5.1) |
| M3 | 03 §13.5, 04 §10, 01 §4.1: what approval publishes | The snapshot sent. **Open question 6** |
| M3 | 06 §1.2 and 01 §5.3 on the id generator | It restarts at 101 and reserves what exists |
| M4 | Picker and Start box share a name, both per 06 §1.5 | Both kept; helpers tell them apart |
| M4 | Exit order: 06 UI-W12, 04 §4.1, 04 §4.2 | DOM in stored order, ports in drawing order |
| M4 | "+1": 04 Appendix A, 04 §4.4, 03 §16.3 | 03. **Open question 5** |
| M4 | Start title: 04 §4.3, 03 §1.6 | 03 |
| M4 | Unnamed step: 04 §4.3 kind name, 03 §1.2 `DEFAULT_TITLE` | 03 |
| M4 | 06 §1.5 no `data-*`, but a line has no role | `path[data-from]` for that check only |
| M4 | 04 §1.3 Button (primary) as written is invisible | Classes written out |
| M4 | UI-N1 `text=Settings` against the "Admin settings" heading | Applies to `/flow-studio`; the heading is decision 1's exception |
| M5 | UI-ESC-01; UI-RULE-01 | Table above. **Open question 1** |
| M5 | Delete: 04 §6.6, 03 §16.7 | 03 |
| M5 | Who to tell: 04 §7.6, 03 §16.6 | 03 |
| M5 | Owner order: 04 §6.7 "sorted", 06 UI-D4 | Code-unit sort |
| M5 | UI-I11's `rowsText`, not in 03 | One-line alias |
| M6 | Nova at 0: 03 §12.1, 04 §9 | 03. **Open question 4** |
| M6 | SelectMenu height: 04 §13.4 runs off the screen | Capped by the side used |
| M6 | UI-P6 "single Close", 04 §10.1's × | No × once sent |
| M6 | Dashes: 04 §4.8 against 02 §16's legacy `req` | 03 §15 item 4's definition |
| M6 | Rings for Start, If, End: 04 §4.8, 03 §11 | As the prototype |
| M6 | Round lines: 06 §1.5, 04 §8.2 and UI-RULE-01 | 04 |
| M7 | Rejecting an escalation: 03 §15 item 6, 05 §3.4.3 | 03: it stops |
| M7 | Not asked again: 03 §15 item 5 `done`, 05 `skipped` | 03 |
| M7 | Which version runs: 03 §15 item 1, 05 §3.1 | 03 |
| M7 | `ob_start` prerequisite: 03 §15 item 2, 05 §3.1 | 03 |
| M7 | Failed-check escalation: 03 §10.4 and §6.10, 03 §15 item 6, 05 §5.2 | **The one place safety beat precedence.** The run asks. **Open question 2** |
| M7 | `held` items: 01 §4.1, 05 §3.5 and RT-10 | 05 and RT-10 |
| M7 | Stop's pending steps: 02 §14, RT-04 | RT-04 |
| M7 | Group fallback and the requester: 03 §6.8, AGENTS rule 4 | AGENTS: never ask the requester |
| M7 | Failing `person` verification: 05 §3.4.6, 03 §10.3 | 03; revisit with real adapters |
| M7 | Duplicate of an ended run: 05 §3.1, against a retrying sender | As written. **Open question 3** |
| M7 | `tests/engine` importing `data/memory`: 01 §9, 06 §1.1 | Kept: the same store logic as Django, still pure TypeScript |
| M8 | Input focus: 04 §1.3 `focus:outline-none`, 04 §14.3 "All" | §14.3 |
| M8 | 04 §2.5's breakpoints are windows; the embedded column is narrower | Keyed on the shell, with `narrow` |
| M8 | 04 §4.9's opening zoom in the 856 column | 0.7 embedded only; 0.5 on `/flow-studio` |

---

# How each milestone went

## M0 result

**Built:** no feature code. `IMPLEMENTATION_NOTES.md`, this report, tooling and fixtures only:

- Dependencies: zod, vitest, @playwright/test, eslint, eslint-config-next, @types/react-dom, all pinned.
- Config: `tsconfig.flow-studio.json`, `vitest.config.ts`, `playwright.config.ts`, `.eslintrc.json`, and additive changes to `tsconfig.json`, `tailwind.config.js`, `next.config.js`, `.gitignore`.
- Scripts: `lint`, `typecheck`, `test:engine`, `test:e2e`, `seed:flow-studio`.
- `tests/fixtures/seed/`: 11 files, byte-identical to `docs/flow-studio/seed/`.

**Checks:** `next build` passes (93 pages, same as baseline), `lint` and `typecheck` pass, `test:engine` passes with no tests. `test:e2e` exits with "No tests found" until M4, and `seed:flow-studio` exits 1 until M3, as the prompt allows.

**Backend:** no changes in M0. Existing suite: 48 tests pass on local Postgres.

**Corrections to the binding decisions** (details in `IMPLEMENTATION_NOTES.md`):

1. The app shell lives in `app/layout.tsx`, and `ClientShell.tsx` is dead code. `/flow-studio` goes in the `isStandalone` list there.
2. A plain Django `JSONField` reorders keys and would change results. Use the `json` column type.
3. Forwarded sessions alone would let any member write to the store directly. Added a shared store token.

**Known gaps:**

- Production needs load balancer rules before any of this is reachable there (`/api/*` and `/admin/*` go to Django today). Listed in "Deployment prerequisites". The live URL map was not inspected.
- M0's reading of 02, 03 and 04 was done by a delegated reading pass plus targeted reads, not line by line by the author of these notes. Spec disagreements marked `[R]` need rechecking when their milestone reaches them.
- The prototype was driven headlessly through the listed screens only, not every panel.

**Decisions made:** see "Binding decisions" and "Decisions made during the build" in `IMPLEMENTATION_NOTES.md`.

## M1 result

**Built:**

- `src/flow-studio/model/`: every type in 02 with its field comments (`catalog`, `condition`, `workflow`, `rules`, `people`, `helpers`, `records`, `results`, `runtime`, `context`), plus `schemas.ts` (Zod, all 11 seed files) and `load.ts` (02 §15 in order).
- `src/flow-studio/data/seed-files.ts`: `loadSeed()`, which reads the nine data files.
- `src/flow-studio/engine/`: only what loading needs. `ids.ts` (`createIdGen`), `text.ts` (`title`, `ensureWait`, `ensureSys`), `edit.ts` (`computeMergeAt`, `ensureCollectEscalation`). M2 extends these.
- `tests/support/context.ts`: the 06 §1.2 context factory (load once, clone per test, asOf 2026-10-20, clock 2026-10-20T09:00:00Z, id generator at 101).
- `tests/engine/seed-load.test.ts`, and `tests/engine/schema-conformance.ts` (compile-time check that schemas match the 02 types).
- Removed `--passWithNoTests` from `test:engine`.

**Checks:** `test:engine` 165 pass, 0 fail. `lint` and `typecheck` pass. `next build` passes with 93 pages, same as baseline. `test:e2e` still has no tests (M4). `seed:flow-studio` still exits 1 (M3).

**Test counts by part:** EN-126 is the only Part A test that M1 owns, implemented as 6 Vitest cases. The other 159 are additional checks of the schemas, each §15 step, the helpers and the factory, and do not count toward the 239. So 1 of the 239 is done.

**00 §8 numbers, all asserted from the loaded seed:**

| Number | Expected | Actual |
| --- | --- | --- |
| Workflows | 15 | 15 |
| Live / draft | 14 / 1 ("Data and AI hires") | 14 / 1 |
| Approval rules | 3 | 3 |
| Samples | 29 | 29 |
| History records | 440 | 440 |
| Work order submitted in history | 140 | 140 |
| Boxes after load | 159 | 159 |
| Approve steps after load | 50 | 50 |
| Generated "failed: escalation" steps | 10 | 10 |
| Steps excluding Start and End, raw / after load (EN-126) | 119 / 129 | 119 / 129 |

Generated escalation roles and rejoin targets match 04 Appendix A for all 10. `mergeAt` on all 21 seeded Ifs matches the merge points the Appendix A canvases show.

**Known gaps:**

- The "140 records" figure is a plain count of history here. The sentence itself comes from lint in M2.
- Canvases are checked against Appendix A only for generated steps and merge points. The full comparison is M4.
- The 21 `mergeAt` expectations were produced by running `computeMergeAt`, then checked by reading them against Appendix A. Only `wf-wo-sub` `RA_C1` also appears as a literal value in 06.

**Decisions and spec disagreements:** see "M1: data model and seed loader" in `IMPLEMENTATION_NOTES.md`. Several carry instructions for M2 and M7.

## M2 result

**Built:**

- `src/flow-studio/engine/`, all of 03: `copy.ts` (every engine string), `text.ts`, `conditions.ts`, `selection.ts`, `walk.ts`, `checks.ts`, `resolve.ts`, `plan.ts` (`planApprovals`, `briefFor`, `planFailedCheck`), `rules.ts`, `changes.ts`, `auto.ts`, `simulate.ts`, `compose.ts` (`composeTest`, `runTest`), `lint.ts`, `publish.ts`, `active.ts`, `edit.ts` (`createEditor`, 03 §16), `nova-parse.ts`, `index.ts`. Additive fields on the `TestRun`, `StepResult` and `StageItem` types.
- `tests/support/acceptance-doc.ts`: reads expected values straight from `06-acceptance-tests.md`.
- `tests/engine/part-a-test-panel.test.ts` (A.1–A.3), `part-a-editor.test.ts` (A.4), `part-c-lint-publish.test.ts`, `worked-examples.test.ts` (03 §19), `engine-spec.test.ts`.

**Checks:** `test:engine` 656 pass, 0 fail. `lint` and `typecheck` pass. `next build` passes with 93 pages. A mutation check (two strings changed in `copy.ts`) failed 50 of the Part A panel tests, so the comparisons do bite.

**Test counts by part:**

| Part | Ids | Pass | Fail | Notes |
| --- | --- | --- | --- | --- |
| A (engine) | 126 | 126 | 0 | EN-104 and EN-106 asserted with a higher-precedence correction, below |
| C (engine halves) | 16 | 16 | 0 | LP-07 asserted with a higher-precedence correction, below. The UI halves are M6 |
| B, D | 0 | not started | | M4–M7 |

A Part A or C id counts as passed only if every Vitest case carrying it passes. The rest of the 656 are additional: M1's load checks, the 31 tables of 03 §19, and direct tests of 03's helpers, each `D` deviation that has no 06 test (D12, D21, D29 among them) and the editor operations 06 does not cover.

**Disputed, all resolved by a higher-precedence document, none left failing:**

- EN-104: 02 §5.14 and 03 §16.1 give a new Approve step `who:'roles'`, `remind:24`; 06 omits them.
- LP-07: 03 §12.2 L13 also fires on that setup; 06 lists only L4.
- EN-106: 03 §16.5 and 06's I6 graph rename the generated step; A.4's general rule says other nodes are untouched.

**§20 deviations:** D1, D4–D9, D11, D12, D14–D26, D28, D29, D31, D32 built and tested. D3 and D30 kept as specified. D2 is a data note, asserted by EN-037. D10 is one resolver. D13: Test behaviour built; the production half belongs with record edits in M7. D27 needs only `basis`, which the engine honours, and its control is M5.

**Prototype comparison:** the differences on WO-2214, ASN-881 and AR-305 are exactly D5 and D7; table in `IMPLEMENTATION_NOTES.md`.

**Known gaps:**

- The model-first path of `parseWhen` is tested with a stub only. The real `callGPT` is wired in M6.
- The Part C UI halves and every string's appearance on screen are M6. Copy from 04 §15 that the engine does not produce is not here.
- §18's panel helpers are tested on the examples 03 gives; M5 will use the rest.
- `subtitle` is not yet compared with every line of 04 Appendix A (M4).

**Decisions and spec disagreements:** see "M2: engine" in `IMPLEMENTATION_NOTES.md`, including the two 03-against-itself and 03-against-06 readings (`needsPlan` and generated steps; `canApprove` and `admin`).

## M3 result

**Built, website (`flow-studio`):**

- `src/flow-studio/data/`: the 01 §4.3 repositories (`repos.ts`) over a `StoreDriver` with two implementations, `memory/` and `django/`. `codec.ts` for run data, `seed-writes.ts`, `seed-guard.ts`, `select-store.ts` (`FLOW_STUDIO_STORE`), `summaries.ts` (picker order).
- `src/flow-studio/server/`: session and permissions, clock, tenant host, the request shape to Django, route wrappers, the E2E signed cookie.
- All 16 routes of 01 §5.1 plus `engine-context`, with Zod, exact messages and optimistic concurrency. No DELETE route exists; a test walks the folders.
- All 15 routes of 01 §5.2, with auth and validation real, then 501.
- `POST /api/test/{reset,sign-in,clock}` and `GET /api/test/session`, 404 unless `LEVV_E2E=1`. `middleware.ts` rewrites `/api/session` to the last one under that flag, and protects `/flow-studio`, `/runs`, `/inbox`.
- `npm run seed:flow-studio`. `POST /api/flow-studio/nova/condition` with `callGPT` wired and the parser as fallback. `callGPT` gained its optional second argument.
- `npm run test:api` and `npm run test:django`, new.

**Built, backend (`flow-studio`):** tenant app `apps.flowstudio` with all 13 entities of 01 §4.1, `OrderedJSONField`, `X-Levv-Store-Token`, the `tx/` endpoint, migration `0001_initial`, `flowstudio-store/` in `levvai/urls.py`, `FLOW_STUDIO_STORE_TOKEN` in settings.

**Checks:**

| Suite | Pass | Fail |
| --- | --- | --- |
| `lint` | clean | |
| `typecheck` | clean | |
| `tsc -p tsconfig.json --incremental false` | clean | |
| `test:engine` | 656 | 0 |
| `test:api` | 198 | 0 |
| `tests/django` store contract, on local Postgres | 15 | 0 |
| `next build` | passes | |
| Backend `manage.py test` (48 existing, 42 new) | 90 | 0 |
| Backend `makemigrations --check` | no changes | |

Of the 239, no new ids complete here: EN-* and LP-* already passed in M2 and the UI ones are M4+. `test:api` re-runs all 41 of Part A.1 through the route, and exercises the API halves of LP-10, LP-11 and LP-13 and UI-PERM-01's review.

**The Django path, proved end to end** by `scripts/flow-studio-django-proof.sh` (`npm run test:django`), against the local Docker Postgres only. `next start` with `FLOW_STUDIO_STORE=django`, a local `runserver`, real logins:

- The seed refuses a remote backend, runs, and runs again without changing anything.
- 15 workflows list in picker order. All 15 `draft` objects come back byte-identical, `draft.nodes` in stored key order. Simulate equals 06 EN-022 with everything read from Postgres.
- A draft save moves `draftRev` to 2. A stale `draftRev` gets 409 with the exact toast and writes nothing. A deliberately reversed key order survives. **Ten concurrent saves at one `draftRev`: exactly one 200, nine 409.**
- A write without the CSRF header, or from another origin, gets 403 from Django. A member calling the store without the token, and a wrong token, get 403. A session cannot read another tenant even with the token.
- "Data and AI hires": past date 422, author 403, the second admin approves, v1, live, priority 1, the other workflow priority 2, the notice once (written through the service context).
- `next start` with `LEVV_E2E=1`: reset, sign-in and the `/api/session` rewrite work with no Django. Without it: all four test routes answer 404.

**Database safety:** every command passed `DATABASE_URL` for 127.0.0.1:5433 explicitly. No `.env` was read. `FLOW_STUDIO_SEED_ALLOW_REMOTE` was never set. The only refusal test against a remote URL exits before any network call.

**Known gaps:**

- **Stubs:** the 15 runtime routes (501, allowed by M3) and `processed: 0` from `POST /api/test/clock` until the tick exists in M7. Nothing else.
- `tests/django` and the proof need Django and Docker up, so they are a separate command, not part of `test:api`. CI would have to start them.
- The real model path of ✦ Set is tested with a stubbed `callGPT`: this worktree has no key. `temperature: 0` against the live API has not been run.
- Production: load balancer rules, env and the seed are in "Deployment prerequisites". The live URL map is still not inspected, so the Next host question in decision 2 remains open until deployment.
- A tenant with one admin can never publish (F12 as designed), which real tenants may hit first.

**Decisions and spec points:** "M3: persistence and API" in `IMPLEMENTATION_NOTES.md`. The one to read: approval publishes what was sent, not edits made since (03 §13.5 against 04 §10).

## M4 result

**Built:**

- **The tab the user asked for:** Admin settings → Workflows, after Approval Chains. `/admin/workflows` and `/admin/workflows/[workflowId]` render the shared shell in the 856×756 admin column at 1440×900; the tab reads as active on both. `/flow-studio` and `/flow-studio/[workflowId]` render the same shell full page, with no app shell. The picker stays under whichever base it opened from.
- **SelectMenu** (04 §13): single and multi, search, groups, addable lists, keyboard, a portal that stays attached on scroll and closes off screen.
- **Top bar** (04 §2.3) with a real Nova count, the **flow picker** (04 §3) in lifecycle order with indented variations, **the canvas** (04 §4) using the exact layout, with If cards, exit labels, helper badges, warning flags, "+" points, lanes above the obstruction, zoom and Fit, **the rail** (04 §4.10) with hover cards and placing mode, and the skeleton and not-found states.
- **A read-only Approve panel** (UI-N4), every other kind showing its name and summary, in the real drawer.
- A test-only page for UI-DD (404 unless `LEVV_E2E=1`).

**How the embed works:** the portal plan held. A placeholder in the admin `main` is tracked by a `position: fixed` host portaled to `<body>`, so `body.flex main.flex-1 …` cannot reach the shell. `app/admin/layout.tsx` changed on this route only, because the aside's own height made the page scroll by 64. Computed styles are asserted, with a negative control. Full account in `IMPLEMENTATION_NOTES.md`, "M4: UI foundation".

**Tests (pass / fail):**

| Suite | Pass | Fail |
| --- | --- | --- |
| `lint` | clean | 0 |
| `typecheck` and root `tsc --incremental false` | clean | 0 |
| `test:engine` | 670 (656 + 14 canvas layout) | 0 |
| `test:api` | 200 (198 + 2 test-page gate) | 0 |
| `test:e2e` | 50 | 0 |
| `next build` | passes, 96 static pages | |

**06 ids passing:** UI-N1, UI-N2, UI-N3, UI-N4, UI-DD-01 to UI-DD-10 (UI-DD-09 includes UI-D2's Then). UI-N5 and UI-N6 are M5's per CODEX_PROMPT M4 item 6. Backend untouched, so `test:django` and its tests were not rerun.

**Appendix A:** 15 of 15 workflows pass on both routes, 159 boxes in all. Against the prototype: node positions identical on the 11 workflows with no generated step, box titles and subtitles identical on all 15.

**One failure not reproduced.** The first full run reported one `test:api` failure and an error after 335 s, and the Playwright web server timed out at 300 s. The log was cut by `tail`, so I do not know which test failed. The tool clock jumped over 30 minutes around it, which suggests the machine was suspended. `test:api` then passed 5 of 5 at about 4 s each and `test:e2e` passed 2 of 2 at about 1 minute. If it returns, read it as a possible flaky test before anything else.

**Known gaps:**

- **Deliberately inert until M5 and M6:** Test, Nova and Publish are disabled, "+ New workflow" is disabled, "+" does nothing, panels do not save, and placing mode cannot insert. List in the notes.
- **UI-DD runs on the test page, not the real panels.** It proves the component. M5 and M6 must move it and delete the page.
- At 0.5 zoom, which 04 §4.9 sets as the minimum on opening, box text is about 6.5 px on both routes, and in the column only part of a long workflow shows until the user zooms or scrolls. The prototype opens the same way. Worth a product look.
- Below 720 wide (a window under about 1050) the embedded shell uses the phone layout. It works but is cramped.
- The real-session run on local Django was by hand, once. No test in the repo covers `/admin/workflows` with `FLOW_STUDIO_STORE=django`.
- Production still needs the load balancer rules for `/admin/workflows*` (Deployment prerequisites).

**Decisions and spec points:** "M4: UI foundation" in `IMPLEMENTATION_NOTES.md`. No test was weakened or skipped.

## M5 result

**Built:**

- **Step menu** (04 §5): every group, ready-made onboarding and offboarding steps, Digital Workers, search with its empty state, Up, Down and Enter.
- **Every panel, field by field** (04 §6, §7): Workflow settings with its explainers and the Active switch, If, Approve with Only needed when and ✦ Set, Auto-approve, Fits plan?, Digital Worker checks and helpers, Collect & verify, all 16 ready-made steps, Task, System, Notify, Wait, Parallel, Run workflow, End. The Chaser and Gives blocks are shared. Everything goes through `engine/edit.ts`.
- **Delete this step** with Undo (10 s, or until the next edit).
- **Autosave** with `draftRev`, the conflict toast and the save-failed toast. Saves on leaving a workflow and on reload.
- **The rail:** click to place, drag onto a "+", attach to eligible steps, and the refusal on Approve.
- **New workflow** (04 §12).

**Tests (pass / fail):**

| Suite | Pass | Fail |
| --- | --- | --- |
| `lint` | clean | 0 |
| `typecheck` and root `tsc --incremental false` | clean | 0 |
| `test:engine` | 676 (670 + 6 editor additions) | 0 |
| `test:api` | 200 | 0 |
| `test:e2e` | 145 (50 + 95 new), three full runs, no intermittent failure | 0 |
| `test:django` | 15 contract, 37 proof checks, 3 browser | 0 |
| `next build` | passes, 96 static pages | |

**06 ids, read this carefully.** "Full" means every Then is asserted on screen. "Panels" means everything M5 can show is on screen, and the Test or Nova Then is asserted on the same data through `POST /simulate`, `GET /lint` or `GET /publish-review`, because those screens are M6. **M6 must add the on-screen half to the same tests.**

| Ids | State |
| --- | --- |
| UI-I1, I3, I4, I6, I9, I10, I11 | Full |
| UI-I2, I5, I7, I8, I12 | Panels. Test and I12's Nova list are through routes |
| UI-W11, W12, W14, W15 | Full |
| UI-W10, W13 | Panels. Test is through the route |
| UI-D1, D2, D3, D4 | Full (D2 runs with UI-DD-09) |
| UI-D5 | Panels. "Test shows Choose who approves" is through the route |
| UI-NP-01 | Full except the Publish dialog of "Data and AI hires" (M6). 159 boxes visited |
| UI-N5 | Panels. Test is through the route |
| UI-N6 | Full |
| UI-ESC-04, UI-BASIS-01 | Full |
| UI-ESC-01 | Panels, and its last Then is disputed: see below |
| UI-ESC-02, UI-STOP-01 | Panels. Test is through the route |
| UI-ESC-03 | Panels. Nova and Publish are through routes |
| UI-RULE-01 | Step 2 through the route, comparing everything but the step id. Step 1 and the "From approval rules" block on screen are M6 |
| UI-DD-01 to UI-DD-09 | Full, now on the real panels |
| UI-DD-10 | Still on the test page: the Publish dialog is M6 |
| UI-PERM-01, B.2, UI-W1 to W9, B.6, Part C UI halves | Not started: M6 |

**Embedded (`/admin/workflows`):** 9 new checks: opening a panel, reaching a box under the drawer, editing and persisting after reload, a SelectMenu attached to its field inside the fixed host and following a scroll, inserting a step and persisting, toasts in the column with Undo and the guard, New workflow staying on the route plus the conflict toast, dragging from the rail, and Escape order.

**Real mode:** `npm run test:django` now also drives `/admin/workflows` in a browser with `FLOW_STUDIO_STORE=django`, a real session and local Postgres, with no `LEVV_E2E`: an edit persists after reload, an inserted step persists and moves `draftRev` once, and a stale `draftRev` shows the conflict toast and writes nothing.

**Screenshots against the prototype** (Approve, If, Collect & verify, System, step menu; both routes): layout, order, copy and spacing match. The differences are the ones 04 asks for, or M6's:

- Test, Nova and Publish look faded because they are disabled until M6.
- The stage is `slate-950`, darker than the prototype (04 §1.2).
- The Chaser bell is violet (04 §6.3) and dropdown chevrons are lucide.
- A percent value has its "%" (04 §6.8).
- Identity & eligibility has one "Checked by" (04 §16 item 6).
- Collect & verify's generated escalation boxes are on the canvas (04 §16 item 34).

In the 856 column the drawer leaves about 350 px of canvas. It works, and boxes can be scrolled out from under it, but it is tight. Worth a product look.

**Disputed, with both quotes in the notes ("M5: editing"):**

1. **UI-ESC-01:** 06 expects a Chaser line on "Otherwise: escalation" for WO-2231. 03 §6.10 and §10.4 make that step Covered, because the default Escalate to is already an approver on the path. 03 wins, and the test also proves 06's ending with a different escalation target. **Needs a product decision.**
2. **Delete:** 04 §6.6 says generated steps go; 03 §16.7 keeps the last exit's target, which can be a generated step.
3. **UI-RULE-01:** EN-071's step id cannot be produced on screen.
4. **UI-I11:** 06 names a `rowsText` that 03 does not have. Added as an alias.
5. **Helper fallback:** 04 §7.7 against 02 §5.14; 02 wins, so a new Invoice match reads Procurement.
6. **Who to tell:** 04 §7.6 against 03 §16.6, after an escalation has set `flagWho`.

**Still inert:** the Test, Nova and Publish buttons, `?panel=`, the `publishedNotice` toast, Test highlighting (all M6). Ctrl/⌘ + wheel zoom is optional and not built.

**Known gaps:**

- A reload during an in-flight save can lose that last edit (a 409 on a page that is unloading).
- Editing a generated step's Who rebuilds the step, as 03 §16.4 says, so a changed Remind on it goes back to 24. `sla` is kept.
- Production still needs the load balancer rules (Deployment prerequisites).
- Backend untouched, so its own tests were not rerun. Its store was exercised by `test:django`.

## M6 result

**Built:**

- **Test drawer** (04 §8): inactive note first, summary, the Σ line, conflict box with its choices and Undo, Marked, the "For real requests" notice, Try an edit, the radio list of records with Up and Down, path chips, "From approval rules", step cards with badges, Worker sees, round and task lines, "Removed by the edit". It follows every edit.
- **Canvas while testing** (04 §4.8): taken lines, status rings, status text in place of subtitles, dimming, dashes on branches that hold nothing up, and the "Showing WO-2214" chip with Hide.
- **Nova drawer** (04 §9): dark, with its intro, cards, "Looks good", the two one-click fixes, Show me (scrolling the box clear of the drawer) and Choose which wins. The count is live.
- **Publish dialog** (04 §10): impact, must-fix rows, overlap questions, the Ready line, Goes live on, the sent state. Focus trap, Escape order, scrim. Portaled to `<body>`, so it covers the whole window on `/admin/workflows` too.
- **`?panel=` and `?record=`, the `publishedNotice` toast.** Active / Inactive already worked from M5; its 06 tests are here.
- **No silent loss of the last edit:** a save can name the one it replaces (still a compare-and-swap), every autosave is keepalive, and a journal lets the next load settle what never arrived.
- The dropdown test page and its gate and tests are gone. UI-DD-10 runs on the real dialog.

**Tests (pass / fail):**

| Suite | Pass | Fail |
| --- | --- | --- |
| `lint` | clean | 0 |
| `typecheck` and root `tsc --incremental false` | clean | 0 |
| `test:engine` | 676 | 0 |
| `test:api` | 202 (200 − 2 for the deleted page + 4 for `supersedes`) | 0 |
| `test:e2e` | 223 (145 + 78 new), three full runs, no intermittent failure | 0 |
| `test:django` | 15 contract, 37 proof checks, 6 browser | 0 |
| `next build` | passes, 95 static pages (the test page is gone) | |

**06 ids.**

| Part | Ids | Asserted on screen | Not fully |
| --- | --- | --- | --- |
| B | 82 | 82, every Then | UI-ESC-01's last Then is disputed: both outcomes are asserted on screen, below |
| C | 16 | 15 | LP-15 is engine only, as 06 says ("UI: Engine only") |

Part C's approvals go through `POST /publish-requests/:id/approve`, which 06 LP-10 allows. LP-13's "no way to approve" is checked in Flow Studio and on the route; `/inbox` is M7. Part A (126) and the engine halves of Part C still pass. Of the 239, Part D's 15 remain, in M7.

**Embedded (`/admin/workflows`):** 7 new checks: the Test drawer on WO-2214 with path highlighting measured on the elements, Nova, Show me from under the drawer, the dialog covering the app chrome (`elementFromPoint`) with its dropdown above it and focus trapped, send through to the status and notice, drawers staying open across the picker with Escape order, and the reload during a running save.

**Real mode:** `npm run test:django` drives `/admin/workflows` on local Postgres with a real session and no `LEVV_E2E`. New: Test and Nova read what Postgres holds; a reload during a running save keeps the edit, so the fingerprint survives the Django round trip; the author sends for approval and is refused their own approval (403); the second local admin, in a separate session, approves through the API; the first admin then sees "Live v2" and "Published as v2, live on 20 Oct 2026", once.

**Screenshots against the prototype** (Test on WO-2214 and UK Technology work orders, Nova, Publish; both routes). Layout, order, copy and spacing match, including every highlighted line and ring. Differences are the ones the spec asks for: the record list instead of pills (04 §16 item 2), dark Nova (04 §9), Nova's overlap item on "Data and AI hires" (D24), and today rather than a past date in Goes live on (04 §16 item 25). Two things the screenshots caught: "90" had its 0 in bold on Site access request, and my first If cards and Start box had a cyan ring where the prototype has none and emerald. Both fixed. In the 856 column, 350 px of canvas beside a drawer is enough to follow the path at 0.5 zoom but the text is tiny. Worth a product look, as M5 said.

**Needs a product decision (both quotes in the notes, "M6"):**

1. **Nova count at 0:** 03 §12.1 says grey, 04 §9 says emerald, and the prototype is green. 03 outranks 04, so it is grey. One class to change.
2. **UI-ESC-01:** from M5, still open.

**Other spec points:** 04 §13.4's height runs a list off the screen (capped by the side used); "a single Close button" against the header × (no × once sent); 04 §4.8's dashed lines against 02 §16 (Parallel branches that end on their own); rings for Start, End and If (as the prototype).

**Live model path not exercised.** No API key is available, so ✦ Set has only run through the parser on screen and a stubbed `callGPT` in `tests/api/nova-model.test.ts`. `temperature: 0` and the 8 s limit against the real API have never run.

**Still inert:** `/runs`, `/inbox`, the 15 runtime routes (501) and `processed: 0` from `POST /api/test/clock`, all M7. So a rejection reaches the author in no way yet, and the only way to approve is the API. Not built, optional per 04 §16 item 29: Ctrl/⌘ + wheel zoom, and the confirmation before switching off a workflow with running requests, which needs M7's runs.

**Known gaps:**

- A browser crash with no `pagehide` can still lose the debounced edit. The journal is per browser, not per person.
- In `next dev`, Strict Mode's double load can use up the published notice. Not in production.
- An open page does not hear about an approval until it reloads, as 04 §10.2 says; its next save then gets the conflict toast, because an approval moves `draftRev`.
- Production still needs the load balancer rules (Deployment prerequisites). Backend untouched; its store was exercised by `test:django`, and its own tests were not rerun.

## M7 result

**Built:**

- **Runtime** (05): event intake with de-duplication, built-in prerequisites and the 7-day alert; the step loop and an executor per kind; Approve with rounds, modes, groups, rule approvers and tasks, paused items; approve, reject (requester with its window, previous, end) and send back; Chaser; Collect & verify; System with retries, confirmation, Give up after, bring-back and onFail; Wait following record dates; Run workflow; End outcomes and their notifications; ledger; Needs information; record edits re-planning open runs (03 §8.4); reference imports re-planning paused steps; the D13 proposal choice.
- **Pause, Resume, Stop** with exact errors, frozen timers shifted on resume, Stop final.
- **Scheduler**, `POST /api/runtime/tick`, cron secret; one job per tenant, documented with a dev loop.
- **Adapters** (05 §5): interfaces and deterministic mocks, each of whose results says so on the run. `LEVV_MOCK_AUTOCOMPLETE` cannot be on in production.
- **Concurrency:** every command is one transaction with the run's `rev`; a new `claims` table makes duplicate events start one run. Backend: `RunClaim`, migration `0002_run_claim`, a broken deadlock answers as a conflict.
- **Screens:** `/runs`, `/runs/[runId]` with the read-only canvas and dialogs, `/inbox`, `/inbox/[itemId]`, flow changes approved from the inbox. Inbox and Running workflows in the app sidebar. Switch-off confirmation (04 §11 recommended).

**Tests (pass / fail):**

| Suite | Pass | Fail |
| --- | --- | --- |
| `lint` | clean | 0 |
| `typecheck` and root `tsc --incremental false` | clean | 0 |
| `test:engine` | 750 (676 + 74) | 0 |
| `test:api` | 208 (202 + 6; `runtime-stubs` became `runtime-routes`, its 501s now real answers) | 0 |
| `test:e2e` | 273 (223 + 50), two full final runs and one before them, no intermittent failure | 0 |
| `test:django` | 15 contract, 37 proof checks, 11 browser (6 + 5 runtime), 13 races | 0 |
| backend `manage.py test` | 92 (90 + 2) | 0 |
| `next build` | passes, 97 static pages | |

**06 and 05 ids.**

| | Engine half | Browser half |
| --- | --- | --- |
| Part D RT-01…RT-15 | 15 / 15 | 15 / 15 |
| 05 §9 R-01…R-12 | 12 / 12 | 12 / 12 (05 asks for Vitest only; the browser half is my addition) |

All of 06's 239 now have tests that pass, with UI-ESC-01 still open as M5 and M6 report.

**Races** (`tests/support/runtime-races.ts`, 13 tests, 6 rounds where it is a loop; on memory in `test:engine`, on Django and Postgres in `test:django`): two approvals of one item; approve against reject; decision against Stop, short and long runs; two Stops, and Resume against Stop; simultaneous ticks over a Chaser and over a Wait and retry; four copies of an event; a decision against a tick that escalates it; an edit against a decision; two approvers on an "any one" item; two approvers of a flow change; two writers of a record. All pass on both. Removing `expectRev` from the commit made 6 of 13 fail on memory, so they can.

**Real mode:** `npm run test:django`, on local Postgres with real sessions and no `LEVV_E2E`. Details in the notes. Passed.

**Bug found while reviewing my own work, now tested:** a record edit that asked an approver again took the steps after them off the path, so a later approval was skipped and the run completed without it. Found by reading, not by a test: R-11 as first written stopped too early to see it. It now follows the run to the end.

**What a real tenant would see:** see the notes, "M7". In short: every System, verifier and check result is simulated and says so; no message is ever sent; nothing raises events; and work goes to seeded names, so an inbox is empty unless users share those names.

**Screenshots** (not in git). `/runs`, `/runs/[id]` with canvas and both dialogs, stopped and system-paused, `/inbox` with each kind, `/inbox/[id]` and its refusals, real mode too. Caught and fixed: the canvas was fitted down to unreadable and now opens at 0.5 with the open step in view; the Workflow filter was blank; a done step read "Waiting for…". Accepted: chips and card buttons read blue inside the app's `main` because of `globals.css` (decision 1), while dialogs, portaled out, are cyan. The canvas surface is repainted navy the same way. **M8:** the Record panel shows raw values (`95000`, `Worker tz`).

**Needs a product decision (quotes in the notes):**

1. **A failed check's escalation and "ask once":** Test shows Covered; the run asks anyway, because an approval given before the failure can't cover it. So here a run and Test disagree, against 05 §5.2.
2. **A duplicate of a run that has already ended** starts another, as 05 §3.1 step 4 says, so a retried event on an auto-approved workflow notifies twice.
3. Still open from before: UI-ESC-01, the Nova count at 0.

**Other spec points:** an escalation's reject (03 §15 item 6 over 05 §3.4.3), Not asked again (03 over 05), which version runs (03 over 05), `ob_start` (03 over 05), `held` items (05 and RT-10 over 01), what Stop leaves (RT-04 over 02), group fallback and the requester (AGENTS over 03 §6.8), `person` verification when a mock fails (03 §10.3), R-06's Hiring manager being the requester, and `tests/engine` importing the memory store through its harness.

**Still stubbed:** the adapters, by design. Nothing else.

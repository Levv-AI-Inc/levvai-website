# Levv Flow Studio — 05 Runtime (running workflows)

Flow Studio builds and tests workflows. This section covers **running** them for real records:

- starting a run from an event;
- moving along the line;
- asking people and recording their decisions;
- the Chaser and Wait timers;
- calling systems through adapters;
- the ledger;
- the run screens with **Pause, Resume and Stop**;
- the inbox where people act.

The runtime reuses the engine (03) for every decision: workflow selection, conditions, the approval plan, people resolution and wording. It never re-implements a rule.

Decisions that shape this section:

- **F9:** manual Pause / Resume / Stop only. There is no automatic reaction to cancellations or changes from other systems. Wait steps follow date changes on the record.
- **F10:** everything that comes in is an event; System steps bring values back to the record.
- **F4/F5:** the Chaser and the single escalation timer.

Tests: 06 Part D (RT-01…RT-15) is normative for Pause / Resume / Stop, including the exact copy. §9 below lists additional runtime checks to add as Vitest tests.

---

## 1. Concepts

| Concept | Meaning |
| --- | --- |
| Run (`WorkflowRun`, 02 §14) | One execution of **one pinned version** of a workflow for one record and event. Never changes version. Status: `running`, `paused`, `stopped`, `completed`, `rejected`. |
| Step run (`StepRun`) | The state of one node in that run: `pending`, `active`, `waiting`, `done`, `skipped`, `failed`, `cancelled`. |
| Work item (`WorkItem`) | Something a person must do, shown in their inbox. Kinds: `approve`, `escalation`, `task`, `collect` (hand over requested items), `collect_review`, `decide_failed_check`, `needs_information` (fill in a blank field), `resubmit` (fix and resubmit after a rejection or send-back), `publish_request` (approve a flow change; no run, `publishRequestId` set). |
| Ledger line | Something given to a worker (account, access, equipment, obligation) and how it is taken back. Onboarding writes them; offboarding closes them. |
| Run log (`RunEvent`) | Append-only, plain-words history of the run. |

---

## 2. Records

- Real records live in `BusinessRecord` (01 §4.1). Fields use the catalog field ids (`FIELDS`) plus system ids brought back by System steps (for example `workday_worker_id`), using the "Bring back to Levv" field names converted to snake case.
- Records that come from another system stay owned by that system. Levv stores the latest values it received and its own derived values.
- **Editing a record while a run is in progress** (`POST /api/runtime/records/:type/:id`):
  1. Save the new values.
  2. For every run of that record with status `running` or `paused`:
     - recompute the approval plan (03 §8.4, the same logic Test shows as "Try an edit");
     - re-ask only the people whose answers depend on what changed;
     - move Wait steps whose date field changed (§3.4 item 11).
  3. Log "Record changed: {field labels}. Levv re-checked who needs to approve."
  4. Nothing else happens automatically (F9).

---

## 3. The run lifecycle

### 3.1 Starting a run (event intake)

Input: `POST /api/runtime/events` with `{source, recordType, recordId, event, data}` (01 §5.2), or an internal Levv event (a record submitted in the app raises `{source:'levv', …}`).

1. **Store the event.** Save an `InboundEvent`.
2. **Upsert the record.** Merge `data` into the `BusinessRecord`. Remember the source system as the record's `source` if it is new.
3. **Choose the workflow.** Call `selectWorkflow(record + {record: recordType, event}, liveWorkflows)` (03 §3). It only considers workflows that are Active, whose `source` matches the event's source (or the record's source), and whose latest published version is effective (effective date ≤ today).
   - No workflow: mark the event `no_workflow`, log nothing, and return `outcome: 'no_workflow'`. It is never replayed later (03 §3.3).
4. **De-duplicate** (after selection, so the workflow and version are known). If a run with the same `workflowId + version + recordId + event` was started in the last 24 hours and is not ended, mark the event `duplicate` and stop.
5. **Check the built-in prerequisite** (03 §15 item 2): it is met when the prerequisite key is in the record's `states` (02 §14 `BusinessRecord.states`). If it is not met, mark the event `waiting_prerequisite`. Keep it in a queue that is re-checked whenever the record changes. If it still waits after 7 days, tell the workflow owner: "“{workflow}” is waiting to start for {record title} ({record id}): Levv only starts it once the {prerequisite}. It has waited 7 days." (Notify, In-app + Email.)
6. **Create the run:**
   - `status 'running'`;
   - pin the version;
   - `recordSnapshot` = the record now;
   - `plan` = `planApprovals(...)` (03 §6);
   - `steps` = every node `pending`.
   - Log "Started from {source label} event “{event label}”." (for example "Started from SAP Fieldglass event “Approved”.").
7. **Advance** (§3.2), then return `runIds` with `outcome: 'started'`.

### 3.2 Advancing (the step loop)

`advance(run)` is a pure-ish function: engine plus runtime state in, new run state plus side effects (work items, adapter calls, outbox messages) out. It runs after every change: start, decision, task done, system result, timer, resume, record edit.

1. If `run.status` is not `running`, return without doing anything. Paused runs still accept decisions on items that are already open (RT-10), but nothing new starts.
2. Find **ready** steps. A step is ready when:
   - it is `pending`;
   - it is on the taken path;
   - every visited predecessor on the taken path is `done` or `skipped`.

   A step where branches meet waits for every branch that was visited. A branch that ends by itself does not hold anything up. The taken path is decided as the run goes (03 §4): an If is evaluated when it is reached, with the record as it is then; a check's result picks its exit.
3. Start each ready step with its executor (§3.4). Executors that finish immediately (If, Parallel, a passing check, Auto-approve, Not needed / Not asked again / Covered approvals, Notify) set `done` or `skipped`, and the loop repeats.
4. When an End is reached on the taken path and nothing else is open:
   - `outcome 'completed'` (or 'approved') → `completed`;
   - `'rejected'` → `rejected`;
   - `'stopped'` → `stopped`.

   Set `endedAt`. Log "Completed.", "Rejected at “{step}”." or "Stopped at “{step}”." Send the end notifications the workflow defines: `onReject.recipients` on a final rejection (03 §15 item 5); the generated Notify of a "Stop the workflow and tell someone" path.
5. Save with optimistic concurrency (`rev`). On conflict, reload and re-run `advance`. It is idempotent: it never starts a step twice, because only `pending` steps start.

### 3.3 Scheduler (`POST /api/runtime/tick`, every minute)

For every run with status `running`:

- **Chaser reminders:** a waiting step whose `remindAt` ≤ now and whose reminder has not been sent. Send the reminder (§5.3), log "Reminder sent to {person}." and mark it sent.
- **Chaser escalations:** a waiting step whose `escalateAt` ≤ now and which has not escalated. Escalate (§3.4.3), log "No answer after {sla}h, so it went to {person} ({their manager / the hiring manager})." and set `escalatedTo`.
- **Waits:** a `waiting` Wait step whose `waitUntil` ≤ now. Mark it `done` and advance.
- **System retries:** a failed call with a retry due (§3.4.7).
- **Give up after:** a System step waiting for confirmation longer than `waitH` hours. Apply `onFail`.
- **Prerequisite queue:** re-check (§3.1 step 5).

Paused runs are skipped entirely. Their timers are frozen (§3.5).

### 3.4 Executors (one per step kind; behaviour per 03 §15 and the panels in 04 §7)

1. **Start (`trigger`), If (`cond`), Parallel (`parallel`):** no work. If picks its path with `evalCondition` (03 §2). When a value is missing, apply "Needs information" (03 §2.4):
   - the step waits;
   - a `needs_information` work item goes to the field's owner with the exact message from 03;
   - the owner answers with `POST /api/runtime/work-items/:id/provide-field {field, value}` (or the record is edited); when the record gets the value, the If re-evaluates.
2. **Digital Worker check (`dw`):** call the check (in production, the check's service; in this build the mock in §5.2, which returns what 03 §5 computes from the record). Passed → the `pass` exit. Flagged → apply `flagDo`:
   - `note`: the `flag` exit, and the flag goes in every later approver's brief;
   - `escalate`: the generated escalation step;
   - `reject`: the request is rejected and goes back to the requester (§3.4.3, rejection rules);
   - `stop`: the run stops with the generated Notify.
3. **Approve (`appr`, including generated escalations with `escalation: true`):** take this step's items from `run.plan` (03 §6):
   - **Not needed / Not asked again** → `skipped`, logged with the plan's message.
   - **Covered** → completes with the covering decision once that one is made.
   - **Paused** (nobody eligible) → `waiting`. No work item is created. Log "Paused: {message}". The step resumes when reference data changes and re-planning finds someone. **Never approve automatically.**
   - **Otherwise** create one `WorkItem` (kind `approve`, or `escalation`) per person in the round:
     - mode `all`: everyone, in parallel;
     - mode `order`: one at a time, in role order;
     - mode `any`: everyone, and the first decision completes the step;
     - groups follow their own any/all mode;
     - rule approvers (03 §7.2) join the first round on the path.

     Set `remindAt` / `escalateAt` from the Chaser (§3.4.10). Set `assignees`, then `waiting`.

   **Decisions** (`POST /api/runtime/work-items/:id/decide`):
   - **approve:** record it. When the round's rule is satisfied, the step is `done` and the run advances.
   - **reject:** a comment is required on escalations ("Add a comment to reject."). Then follow the step's `reject` setting:
     - `requester`: the request goes back to the requester. Open a `resubmit` work item "Fix and resubmit {record title}" for them, due in `onReject.resubmitDays` (default 5) days. The step stays `waiting`. On resubmit (`POST /api/runtime/work-items/:id/resubmit {data?, comment?}`, which applies any record changes as an edit, §2), the step asks again. If the deadline passes, the rejection is final.
     - `previous`: the previous person-step is asked again.
     - `end`: the rejection is final.

     A final rejection ends the run `rejected` (§3.2 step 4).
   - **send back** (escalations and approvals): the same as `requester`, without counting as a rejection. When it comes back, the check or If before it runs again.
   - A decision on a run that is `stopped` (or on a cancelled item) is refused: `{ok:false, code:"RUN_STOPPED"}`. The item's page shows "This request was stopped. No action is needed." (RT-08).
   - A decision on a `paused` run is recorded, but nothing new starts until Resume (RT-10).
   - Every decision is logged: "{person} approved." / "{person} rejected: {comment}" / "{person} sent it back: {comment}".
4. **Auto-approve (`policy`):** if nobody was asked earlier on the path (03 §9) → `done` with the receipt text. Otherwise → `skipped`, "Someone approves on this path, so it doesn’t auto-approve".
5. **Fits plan? (`plan`):** compare with the plan (03 §9). Inside → the `in` exit; outside → the `out` exit (an approver).
6. **Collect & verify (`collect`):**
   1. Ask the provider (`from`: worker, sponsor, supplier account manager, hiring manager or IT) for the items. In this build that is an outbox message plus a `collect` work item for the provider. For the worker the item's assignee is the worker and the request is recorded in the log as "Asked {worker name} for: {items}" (the worker portal that would answer it is out of scope).
   2. When items arrive (`POST /api/runtime/work-items/:id/submit-items {items}`, or mock auto-completion, §5.2), the checker verifies (`Verifier` adapter, §5.1):
      - `auto`: the checker's result;
      - `auto_person`: the checker, and if it is unsure, a `collect_review` work item for the reviewer;
      - `person`: always the reviewer.
   3. On a fail:
      - `failTo 'role'`: the generated "{Step} failed: escalation" step (Failed exit);
      - `failTo 'approval'`: a `decide_failed_check` work item for each of `failRoles` (mode `failMode`). Approve = carry on; reject = stop the run.

      The worker can't start (onboarding) until a failed check is decided.
   4. `gives` writes a ledger line (§3.6).
   5. The Chaser applies while waiting on the provider or the reviewer.
7. **System (`system`):** build the call from the step: system, action, object, field map, match key.
   1. Call the `SystemAdapter` (§5.1).
   2. On error: retry 3 times over an hour (at +5, +20 and +60 minutes). Log "Retry {n} of 3 for {system}: {error}".
   3. With `wait: 'confirm'`: `waiting` until the adapter confirms, up to `waitH` hours (Give up after).
   4. On success:
      - save **Bring back to Levv** fields on the record (for example the Workday worker ID), logged as "{system} sent back {field}: {value}";
      - every later System step for the same system uses the brought-back id as its match key when it is available;
      - write a ledger line if the step `gives` something;
      - mark it `done`.
   5. On final failure, `onFail`:
      - `task`: a Task to `failRole` "Fix {system}: {error}";
      - `path`: take the Failed exit;
      - `pause`: run status `paused`, `pauseReason 'system_failure'`, `pausedBy 'Levv'`, the step `failed`, and the owner is alerted (RT-15). Resume retries the step.
8. **Notify (`notify`):** resolve the recipients (03 §6.6, `personLabel`), enqueue one outbox message per person on the channel, then `done`. The message subject is "{workflow name}: {step name}". The body uses the step name, the record title and id, and the link to the record.
9. **Task (`task`):** a `task` work item for the resolved person, with the step's "What they do". Done → the step is `done`. The Chaser applies.
10. **Chaser (on Approve, Task, Collect & verify):** when the step starts waiting on a person:
    - `remindAt = start + remind` hours;
    - `escalateAt = start + sla` hours.

    Escalate to `chaseTo` (03 §1.12): their manager (`MGR[person]`), or the record's hiring manager when the worker or supplier account manager provides. Escalation creates a new work item for that person (kind `escalation`, "{original step}: no answer from {person}"). The original item stays open, and whoever acts first completes it. Reminders stop the moment someone acts. Paused time does not count (§4).
11. **Wait (`wait`):** resolve `waitUntil` from the step (03 §1.8): a set time, a date on the record ± offset at a time in a time zone, or a fixed date and time. Then `waiting`. When the record's date field changes, recompute `waitUntil` and log "The {date label} changed, so the wait now ends {date}".
12. **Run workflow (`runwf`):** raise an internal event that starts the target workflow for the same record (its own selection rules apply). Log "Started “{target}”". Then `done`. It does not wait for the target to finish.
13. **End:** see §3.2 step 4.

### 3.5 What "Pause" freezes

While a run is `paused`:

- no step starts;
- no timer advances: Chaser, Wait, Give up after and retries;
- existing work items stay open, and decisions are recorded (RT-10);
- Wait steps keep their remaining time.

On Resume, every frozen timer is pushed forward by the paused duration (RT-09: 10h before the pause + 14h after resuming = the 24h reminder at +54h).

### 3.6 Ledger

- **Write:** a step with `gives` writes a `LedgerLine` keyed by the worker's `personal_email` (`workerKey`) with `gives`, `disp`, `reverse`, `reverseWhen`, `reverseBy` and the system reference.
- **Close:** offboarding steps close ledger lines: "Remove access", "Close in HR system", "Return equipment", and the "Ledger clear check" that confirms none are left open.
- Stopping a run does **not** close ledger lines automatically. Anything already given is taken back by running offboarding, as decided (F9).

---

## 4. Pause, Resume, Stop (normative copy and rules; 06 Part D)

| Action | Allowed from | Who | Effect | Log entry (`RunEvent`) |
| --- | --- | --- | --- | --- |
| **Pause** (reason optional) | `running` | workflow owner team member or admin (`runs.control`) | `status 'paused'`, `pausedBy`, `pausedAt`, `pauseReason 'manual'`; freezes everything in §3.5 | `type 'paused'`, `m` = reason or "" |
| **Resume** | `paused` | same | `status 'running'`; clears `pausedBy/pausedAt/pauseReason`; shifts timers by the paused duration; retries a failed System step if the pause came from `system_failure`; then advances | `type 'resumed'`, `m` "" |
| **Stop** (reason required) | `running` or `paused` | same | `status 'stopped'`, `stoppedBy`, `stoppedAt`, `stopReason`, `endedAt`; open steps → `cancelled`; open work items → `cancelled`; nothing starts again; the outbox gets nothing new | `type 'stopped'`, `m` = reason |

Errors (exact):

| Code | Message |
| --- | --- |
| `REASON_REQUIRED` | "A reason is required to stop a workflow." |
| `RUN_STOPPED` | "This workflow is stopped. It can’t be resumed." |
| `NOT_PAUSED` | "This workflow isn’t paused." |
| `ALREADY_PAUSED` | "This workflow is already paused." |
| `FORBIDDEN` | "Only the workflow owner or an admin can pause, resume or stop it." (HTTP 403) |

Rules:

- **Stop is final.** A stopped run can't be resumed, paused or stopped again.
- Switching a workflow **Inactive** does not pause or stop its runs: "Anything already running finishes on it." (RT-14).
- A run that is `completed` or `rejected` shows no controls.

---

## 5. Adapters (interfaces; this build ships deterministic mocks)

### 5.1 Interfaces

```ts
export interface SystemAdapter {
  system: string;                                  // 'SAP Fieldglass' | 'Workday' | 'SAP S/4HANA' | 'ServiceNow' | 'Okta' | 'Microsoft Entra ID' | 'Coupa' | 'Badge system'
  status(): Promise<{ connected: boolean; lastChecked: string }>;
  execute(req: {
    action: 'create' | 'update' | 'read' | 'wait' | 'close' | 'check';
    object: string;                                // e.g. 'Contingent worker'
    fields: Record<string, unknown>;               // system field name -> value (from the step's field map)
    match: { key: string; value: unknown };        // "Find the existing record by"
    bringBack: string[];                           // "Bring back to Levv" field names
    idempotencyKey: string;                        // runId + nodeId + attempt-independent
  }): Promise<
    | { status: 'done'; ref: string; values: Record<string, unknown> }
    | { status: 'pending'; ref: string }           // confirm later
    | { status: 'failed'; error: string; retryable: boolean }
  >;
  confirm(ref: string): Promise<{ status: 'done'; values: Record<string, unknown> } | { status: 'pending' } | { status: 'failed'; error: string }>;
}

export interface Verifier {                        // Persona, Onfido, Yoti, Checkr, e-signature, Document collector
  provider: string;
  verify(req: { items: string[]; record: RecordData; pkg?: string }): Promise<{ result: 'verified' | 'unsure' | 'fail'; message: string }>;
}

export interface CheckService {                    // Digital Worker checks: budget, rate, dup, tenure
  run(check: 'budget' | 'rate' | 'dup' | 'tenure', record: RecordData, settings: object): Promise<{ ok: boolean; m: string }>;
}

export interface Notifier {                        // email / Teams / Slack / in-app
  send(msg: { to: string; channel: string; subject: string; body: string }): Promise<void>;
}

export interface EventSource {                     // inbound polling sources (Fieldglass pull every 15 minutes)
  system: string;
  poll(since: string): Promise<Array<{ recordType: string; recordId: string; event: string; data: object }>>;
}
```

### 5.2 Mocks (deterministic, used in development and tests)

- **Same results as Test.** Every mock returns exactly what Test simulates for the same record (03 §10.2, "where results come from"): the same check results, verification outcomes, system read-back values and connection status. A run and its Test therefore always agree.
- **System mock:**
  - returns `done` with a generated ref (`"{SYSTEM}-{recordId}-{nodeId}"`) and read-back values (`Workday worker ID` = `"WD-" + recordId`, `Hire status` = `"Hired"`, `Badge number` = `"B-" + recordId`, etc.);
  - returns `failed` when the record has `fail_system: "<system name>"` (used by RT-15);
  - systems listed as not connected in `systems.json` are `failed: "Not connected"`.
- **Auto-completion (`LEVV_MOCK_AUTOCOMPLETE=1`, on in e2e and development, off in production):**
  - Collect & verify requests to the worker or any other provider are fulfilled immediately with exactly the requested items (logged "{provider} provided: {items}"); no `collect` work item stays open.
  - Verifiers then return the Test-simulated result for that record and step (03 §10.2/§10.3: `verified`, or `unsure` / `fail` from the record's `outcomes`); `unsure` and `person` verification still create a `collect_review` item for the reviewer.
  - Tasks, approvals, escalations, reviews and failed-check decisions stay open for people to act on.
  - System calls resolve by the System mock rules above (with `wait: 'confirm'`, the confirmation arrives immediately).
  Without the flag, provider requests stay open until `POST /api/runtime/work-items/:id/submit-items` (01 §5.2).
- **Notifier mock:** writes to `OutboxMessage` and does not send.
- **EventSource mock for Fieldglass:** reads from a JSON file of queued events (`docs/flow-studio/seed/` can hold one for demos). Production polls every 15 minutes, compares with the last pull and raises events for what changed. It needs no configuration in Fieldglass.

### 5.3 Messages (exact copy)

| When | To | Subject | Body |
| --- | --- | --- | --- |
| Approval asked | approver | "Approval needed: {record title}" | "{brief}\n\nApprove, reject or send it back in Levv: {link}" ({brief} = 03 §6.13) |
| Chaser reminder | assignee | "Reminder: {step name} for {record title}" | "This has been waiting on you for {hours}h. It goes to {chaseTo name} after {sla}h." |
| Chaser escalation | manager / hiring manager | "{step name} for {record title} needs you" | "{person} hasn’t acted for {sla}h. You can act on it now: {link}" |
| Escalation (check / If / failed check) | decider | "Decision needed: {step name}" | "{reason}. Approve to carry on, reject with a comment to stop, or send it back to the requester: {link}" |
| Task | assignee | "To do: {what they do}" | "{record title} ({record id}). Mark it done in Levv when finished: {link}" |
| Final rejection | `onReject.recipients` | "Rejected: {record title}" | "{record title} was rejected at “{step}”. Reason: {comment}" |
| Run paused by a system | workflow owner | "Paused: {workflow name} for {record title}" | "{system} failed after 3 retries: {error}. Fix it, then resume the workflow: {link}" |
| Prerequisite waiting 7 days | workflow owner | "Waiting to start: {workflow name}" | see §3.1 step 5 |
| Flow change to approve | users with "Approve flow changes" except the author | "Flow change to approve: {workflow name}" | "{author} sent “{workflow name}” for approval to go live on {date}. Review it in Levv: {link}" |

---

## 6. Run screens

All selections use the SelectMenu dropdown (04 §13). No pills. All times on these screens and in the inbox are UTC with the suffix "UTC" (01 §8). Status chips are badges (`rounded-md text-[10px] font-black uppercase tracking-wider`): Running (cyan), Paused (amber), Stopped (slate), Completed (emerald), Rejected (rose).

### 6.1 Running workflows list (`/runs`)

- **Title:** "Running workflows".
- **Filters (dropdowns):**
  - "Status": All statuses, Running, Paused, Stopped, Completed, Rejected; default Running and Paused (multi);
  - "Workflow": all workflows (multi);
  - "Record": a search box.
- **Table columns:** Record (title + id), Workflow (name + "v{n}"), Status chip, Waiting on (current waiting steps: "{step}: {person}", or "—"), Started (date), Last change (relative time).
- Clicking a row opens the run detail.
- **Empty state:** "No workflows are running. They start when a record’s event happens, for example a work order being submitted."

### 6.2 Run detail (`/runs/[runId]`)

- **Header:**
  - "{record title} ({record id})";
  - sub-line "{workflow name} · v{version} · started {date time}";
  - the status chip;
  - the action buttons on the right.
- **Actions** (only for users allowed in §4):
  - **running:** "Pause", "Stop";
  - **paused:** "Resume", "Stop";
  - **stopped / completed / rejected:** none.
- **Pause dialog:** title "Pause this workflow?"; text "Nothing new starts and reminders stop until you resume it. People can still answer what they’ve already been asked."; optional text box "Reason (optional)"; buttons "Cancel" and "Pause workflow".
- **Stop dialog** (RT-04, exact): title "Stop this workflow?"; text "Steps that haven’t started will never start. This can’t be undone."; required text box "Reason"; "Cancel" and "Stop workflow". "Stop workflow" is disabled until the reason has a non-space character.
- **Paused banner** (amber): "Paused by {name} on {d MMM yyyy, HH:mm} UTC{: reason}. Nothing new starts and reminders are on hold." For `system_failure`: "Paused by Levv: {system} failed after 3 retries. Fix it, then resume."
- **Stopped banner** (slate): "Stopped by {name} on {date}: {reason}. Steps that hadn’t started will never start."
- **Steps:** a read-only canvas of the pinned version, using the Flow Studio canvas component in read-only mode. The taken path is highlighted and each box shows its run status. Next to it is a step list in run order:
  - step name;
  - status label: "Not started", "In progress", "Waiting on {people}", "Done", "Skipped", "Failed", "Cancelled";
  - the message (the same wording as Test, 03 §10–11);
  - for waiting person-steps: "Reminder {date time} · Escalates {date time}" (shifted while paused);
  - for System steps: the system ref and brought-back values.
- **History:** the run log, newest last. Each line "{action} by {name} on {d MMM yyyy, HH:mm} UTC{: reason}", for example "Paused by Owen Clarke on 20 Oct 2026, 10:00 UTC: Supplier dispute" (RT-01), "Resumed by Owen Clarke on 20 Oct 2026, 12:00 UTC" (RT-02), "Stopped by Owen Clarke on 20 Oct 2026, 09:00 UTC: Request withdrawn by the hiring manager" (RT-04). Other events use their log message with the time.
- **Record panel:** the record's current values and the system ids brought back.

### 6.3 From Flow Studio

Flow Studio does not link to runs in this release (04 §0.1). A record page elsewhere in Levv may link to `/runs?record={id}`.

---

## 7. Inbox (`/inbox`)

One page, three sections (headings, not tabs or pills), each a list of cards, newest first:

1. **"Approvals"**: work items of kind `approve`, `escalation` and `decide_failed_check`.
   - **Card:**
     - "{step name} · {record title} ({record id})";
     - the **brief** exactly as 03 §6.13 builds it (what's asked, why, the rule that added it, what changed, check results and flags, "On behalf of …");
     - "On behalf of {role or person}" when acting as a delegate or backup.
   - **Buttons:** "Approve", "Reject", "Send back".
   - **Reject** opens a dialog: "Reject {record title}?", a text box "Comment" (required for escalations and failed-check decisions, optional otherwise), "Cancel" and "Reject".
   - **Send back** opens a dialog: "Send it back to {requester}?", "Comment" required, "Send back".
2. **"Tasks"**: kinds `task`, `collect`, `collect_review`, `needs_information` and `resubmit`. The card shows "What they do" (for `collect`: the items asked for; for `needs_information`: the 03 §2.4 message; for `resubmit`: "Fix and resubmit {record title}"), the record, and "Due {date}" (the Chaser escalation time, or the resubmit deadline). Buttons: Task "Mark done" (`/done`); collect "Hand over" (`/submit-items`); review "Verified" and "Not verified" (`/decide` with `verified` / `not_verified`; a comment is required for Not verified); needs information "Save" with the field's value editor (`/provide-field`); resubmit "Resubmit" (`/resubmit`).
3. **"Flow changes to approve"**: `publish_request` work items (one per eligible approver, linked by `publishRequestId`; created when the author sends for approval) for users with `flow.approve_changes`. Approve / Reject call `POST /api/flow-studio/publish-requests/:id/approve|reject` (01 §5.1); the first decision closes every copy.
   - **Card:** "{workflow name} · goes live on {d MMM yyyy}", "Sent by {author}", the impact sentence and the overlap choice from the publish review (03 §13).
   - **Buttons:** "Approve" and "Reject" (comment required).
   - The author never sees their own request here. If they open it by link, it says "You can’t approve your own change."

- **Empty state per section:** "Nothing waiting for you."
- **Item page `/inbox/[itemId]`:** approval links and emails open one item there, with the same card and buttons (data from `GET /api/runtime/work-items/:id`).
- **Items of stopped runs:** they disappear from the inbox. Opening one by link (`/inbox/[itemId]`) shows "This request was stopped. No action is needed." and no buttons (RT-08).

---

## 8. Run log event types and messages (exact)

| type | m |
| --- | --- |
| started | "Started from {source label} event “{event label}”." |
| step_started | "{step}: started." (only for System, Collect & verify, Task and Approve) |
| asked | "Asked {people} to {approve / decide / do it / provide: items}." |
| reminder | "Reminder sent to {person}." |
| escalated | "No answer after {sla}h, so it went to {person} ({relation})." |
| decision | "{person} approved." · "{person} rejected: {comment}" · "{person} sent it back: {comment}" · "{person} marked it done." |
| system | "{system}: {action} {object} done (ref {ref})." · "Retry {n} of 3 for {system}: {error}" · "{system} sent back {field}: {value}" |
| record_changed | "Record changed: {field labels}. Levv re-checked who needs to approve." |
| wait_moved | "The {date label} changed, so the wait now ends {date}." |
| paused | reason text, or "" (manual); "{system} failed after 3 retries: {error}" (system_failure, by "Levv") |
| resumed | "" |
| stopped | reason text |
| completed / rejected | "Completed." · "Rejected at “{step}”." · "Stopped at “{step}”." (outcome `stopped` from a path) |

---

## 9. Additional runtime checks (add as Vitest tests next to 06 Part D)

Every check starts from the matching record in `seed/runtime-records.json`, with mock auto-completion on (§5.2) and the actors of `seed/test-actors.json`.

| # | Given / When | Then |
| --- | --- | --- |
| R-01 | Event `work_order/submitted` for WO-2231 from Levv | One run of `wf-wo-sub` v1; Budget check and Duplicate & ghost worker `done`; Business sign-off `waiting` on Raj Patel with remindAt +24h, escalateAt +48h; one approve work item for Raj Patel |
| R-02 | The same event again within 24h | `outcome 'duplicate'`; no second run |
| R-03 | Event for WO-2214 (UK · Technology) | The run uses "UK Technology work orders", not "Work order submitted" |
| R-04 | Event for a record with no matching workflow (OB-2251) | `outcome 'no_workflow'`; no run |
| R-05 | Raj Patel approves R-01 | Business sign-off `done`; the run continues to Value band → Otherwise → Tell the supplier (Notify: one outbox message to the supplier account manager) → `completed` |
| R-06 | Raj Patel rejects R-01 (step reject = requester) | A `resubmit` work item "Fix and resubmit Operations analyst" for Grace Kim due in 5 days; the step stays waiting; after 5 days with no resubmit the run is `rejected`; the Hiring manager (`onReject`) gets "Rejected: Operations analyst" |
| R-07 | WO-2214-A through onboarding, Workday step | The Workday mock returns `WD-WO-2214-A`; the record gets `workday_worker_id`; the ledger gets "Workday account" (remove access at exit); the log has "Workday sent back Workday worker ID: WD-WO-2214-A" |
| R-08 | Offboarding run for OFF-902 (runtime-records.json) where the record already has `workday_worker_id: "WD-OFF-902"`; set up as RT-15 but without `fail_system`: complete "Return equipment" (Sam Patel) and the "Final timesheet & expenses" review (Tom Reed, `verified`), then `POST /api/test/clock` (or advance the engine clock) to 2026-10-23T16:00:00Z; step "Close in HR system" | Workday is called with match key `Workday worker ID` = `WD-OFF-902` (a brought-back id beats work email); without that field it matches on Work email |
| R-09 | WO-2270 (nobody eligible for Privacy in Germany) | Business sign-off `waiting` with the paused item; no work item for Privacy; never auto-approved; when reference data adds a Privacy holder for Germany (import endpoint), re-planning creates the item |
| R-10 | Onboarding WO-2214-A: change the record's start date while "Wait for start date" waits | `waitUntil` moves to the new date at 09:00 in the worker's time zone; log "The Start date changed, so the wait now ends …" |
| R-11 | ASN-881 run: shorten the extension while approvals are open | Re-planning per 03 §8.4: people who already approved and whose answers still stand are not asked again; logged "Record changed…" |
| R-12 | A check set to Stop flags: UK Technology work orders with the setup of 06 EN-070, event for WO-2240 | The run ends `stopped` with "Stopped at “{check}”."; the generated Notify sends its message; no rule approvers are asked |

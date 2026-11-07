# Levv Flow Studio — 01 Architecture

How to build it: stack, folders, persistence, API, permissions, the shared engine, the clock, Nova, the test harness and the build order. Behaviour is specified in 02–06; this file says where each piece lives and how the pieces connect.

---

## 1. Stack and ground rules

| Area | Use |
| --- | --- |
| Framework | **Next.js App Router**, **TypeScript** (`strict: true`, no `any` in new code except at JSON boundaries, where values are immediately validated) |
| Styling | **Tailwind CSS**. Reuse the repo's design tokens and primitives from the **Workers Index** page (the design-system source of truth); add only what is missing (04-ui §1) |
| Icons | **lucide-react** (04-ui §1 maps every icon) |
| AI | The existing **`callGPT`** helper (OpenAI **GPT-4.1-mini**). Do **not** add another AI provider or SDK. Used only for the plain-words condition writer (§7) |
| Validation | **Zod** at every API boundary and when loading seed or import files. Add `zod` if the repo does not have it |
| Unit tests | **Vitest** (engine, runtime state machine, editor operations) |
| End-to-end tests | **Playwright** (Chromium, 1440×900) |
| Persistence | **Use the repo's existing database layer** if there is one. If there is none, add **Prisma + PostgreSQL** with the schema in §4 (`DATABASE_URL`). Keep all data access behind the repository interfaces in §4.3 so the storage can change without touching the engine or UI |
| Auth | Use the repo's existing auth/session. If there is none, add the dev user switcher in §6.3 |
| New UI libraries | **None** unless the repo already has them. The canvas, step nodes, the If card and the searchable dropdown (SelectMenu) are built in-house as specified. No react-flow, no Radix/shadcn unless already present |

Ground rules:

1. **Discover before you build.** Read the repo's structure, the Workers Index page and components, the auth/session code, the database layer and `callGPT` before writing code. Follow the existing conventions (folder layout, `src/` or not, route groups, naming, lint rules).
2. **One engine for Test and for real runs.** The Test drawer and the runtime call the same pure functions (03-engine). No duplicated logic in components.
3. **The engine is pure.** No React, no DOM, no fetch, no database, no `Date.now()`: the clock is passed in (§8).
4. **Seed JSON is the data contract.** Field names in `docs/flow-studio/seed/*.json` are used as-is (02-data-model). Normalise on load (02 §15); never rename fields.
5. **Exact copy.** Every user-visible string in 03/04/05 is exact. Put strings in one module per area (`copy.ts`) so tests and components share them.
6. **No pills, no native `<select>`** anywhere in Flow Studio or the run screens (04-ui §13). Switches stay switches.
7. **Nothing is deleted.** Workflows are never deleted; there is no delete endpoint. Runs are never deleted; Stop ends them.

---

## 2. Folder layout

Adapt the prefix to the repo (`src/` if the repo uses it; the route group name the app already uses for signed-in pages). Names inside are a strong suggestion; tests do not depend on them.

```
app/
  (app)/flow-studio/page.tsx                 redirect (04-ui §2)
  (app)/flow-studio/[workflowId]/page.tsx    Flow Studio page (server component loads data; client shell renders)
  (app)/runs/page.tsx                        Running workflows list (05 §6)
  (app)/runs/[runId]/page.tsx                Run detail with Pause / Resume / Stop (05 §6)
  (app)/inbox/page.tsx                       My approvals, my tasks, flow changes to approve (05 §7)
  (app)/inbox/[itemId]/page.tsx              One work item, opened from an approval link or email (05 §7)
  api/flow-studio/...                        route handlers (§5)
  api/runtime/...                            route handlers (§5)
  api/test/reset/route.ts                    test-only (LEVV_E2E=1) (§5.3, §9)
  api/test/sign-in/route.ts                  test-only sign-in (§5.3)
  api/test/clock/route.ts                    test-only clock (§5.3)

src/flow-studio/                              (or lib/flow-studio/ if the repo has no src/)
  model/        types + loadSeed/normalise (02-data-model; file split suggested in 02 §0)
  engine/
    text.ts         03 §1   formatting helpers (money, titles, condition text, people in sentences, wait text)
    conditions.ts   03 §2   evalRow, evalCondition, scopeMatch, needs-information
    selection.ts    03 §3   selectWorkflow
    walk.ts         03 §4   walkWorkflow
    checks.ts       03 §5   Digital Worker results
    plan.ts         03 §6   planApprovals, resolveRoleHolder, merging, groups
    rules.ts        03 §7   approval rules
    changes.ts      03 §8   not asked again, running totals, conflicts, edits during approval
    auto.ts         03 §9   Auto-approve, Fits plan?
    simulate.ts     03 §10  simulateTest
    compose.ts      03 §11  composeTest (Test drawer view model)
    lint.ts         03 §12  Nova checks
    publish.ts      03 §13  publishReview, overlaps, publish actions
    active.ts       03 §14  active / inactive
    edit.ts         03 §16  graph editing operations (insert, delete, paths, mergeAt, presets, Digital Workers)
    nova-parse.ts   03 (plain-words condition writer: deterministic parser = fallback + test oracle)
    copy.ts         every engine string
    index.ts        public API
  runtime/        05-runtime (run state machine, scheduler, executors) — imports engine, never UI
  adapters/       05 §5 SystemAdapter / Verifier / Notifier interfaces + deterministic mocks
  data/           repositories (§4.3) + seed import
components/flow-studio/   page shell, TopBar, FlowPicker, Canvas, StepNode, IfCard, StepMenu, StepPanel + one panel per kind,
                          DigitalWorkersRail, TestDrawer, NovaDrawer, PublishDialog, SelectMenu, Toasts (04-ui)
components/runs/          RunsTable, RunDetail, RunControls (Pause/Resume/Stop dialogs), Inbox lists (05)
docs/flow-studio/         this package (00–06, seed/, reference/)
tests/engine/             Vitest (06 Part A, C, D state machine)
tests/e2e/                Playwright (06 Part B, C UI halves, D UI halves) + helpers.ts (06 §1.5)
tests/fixtures/seed/      exact copies of docs/flow-studio/seed/*.json
```

---

## 3. How the pieces connect

```
          seed/*.json ──loadSeed+normalise──► Store (DB) ◄── import endpoint (reference data managed outside Flow Studio)
                                                │
      ┌─────────────────────────────────────────┼──────────────────────────────────────────┐
      ▼                                         ▼                                          ▼
 Flow Studio UI (client)            API route handlers (server)                  Runtime (server)
 - edits a local copy of the        - load/save drafts (optimistic version)      - event intake → selectWorkflow
   workflow (engine/edit.ts)        - simulate (engine.simulateTest+compose)     - WorkflowRun state machine
 - Test drawer calls the API         - lint, publish review, publish requests    - executors per step kind
   OR the engine in the browser      - Nova condition (callGPT + fallback)       - scheduler tick (Chaser, Wait, retries)
   (same pure code; see §3.1)        - active/inactive                           - adapters (mocks) for systems/verifiers/notify
```

### 3.1 Where the engine runs

The engine is isomorphic. Recommended: the Flow Studio client imports `src/flow-studio/engine` directly for instant Test and Nova results on the unsaved draft, with reference data loaded once per page (`GET /api/flow-studio/reference`). The server uses the same functions for publish review (authoritative), the API simulate endpoint (used by tests and other clients) and the runtime. Publishing always re-runs lint and the publish review on the server; the client result is advisory.

### 3.2 Editing and saving

- The page loads the workflow's **draft** (and its published versions).
- Every edit is a pure operation from `engine/edit.ts` applied to a local copy, then **autosaved** (debounced 800 ms) with `PUT /api/flow-studio/workflows/:id/draft` and the `draftRev` the client last saw. On a mismatch the server returns 409, and the UI shows the toast "This workflow changed since you opened it. Reload to see the latest." without overwriting.
- The top bar status follows 03-engine §13.6, for example "Live v1 · unpublished changes" when the draft differs from the latest published version.
- Undo is required for one action only: **Delete this step**. Its toast carries an "Undo" link that restores the exact previous graph; it works until the next edit or for 10 s (04-ui §6.6). There is no general undo; other changes are reversed with the panel's own controls (for example Delete path) or Reload.

---

## 4. Persistence

### 4.1 Prisma schema (use only if the repo has no database layer; otherwise map these entities onto it)

```prisma
model Workflow {
  id          String   @id                     // seed ids kept ("wf-wo-sub"); new ones: cuid()
  name        String
  recordType  String                           // records[0]
  event       String
  status      String                           // 'draft' | 'live' | 'inactive'
  version     Int      @default(0)             // latest published version number; 0 = never published
  owner       String?
  priority    Int?
  source      String   @default("levv")
  effective   String?                          // YYYY-MM-DD of the latest published version
  draft       Json                             // full Workflow object (02-data-model §4) including draft.nodes and scope
  draftRev    Int      @default(1)             // optimistic concurrency for autosave
  updatedAt   DateTime @updatedAt
  updatedBy   String?
  versions    WorkflowVersion[]
  requests    PublishRequest[]
  runs        WorkflowRun[]
  @@index([recordType, event, status])
}

model WorkflowVersion {
  id          String   @id @default(cuid())
  workflowId  String
  version     Int
  snapshot    Json                             // name, scope, nodes, onReject, source, owner, basis, days, priority at publish time
  effective   String                           // go-live date YYYY-MM-DD
  publishedBy String
  approvedBy  String
  approvedAt  DateTime
  workflow    Workflow @relation(fields: [workflowId], references: [id])
  @@unique([workflowId, version])
}

model PublishRequest {
  id          String   @id @default(cuid())
  workflowId  String
  snapshot    Json                             // the draft being published
  goLive      String                           // YYYY-MM-DD, today or later
  precedence  Json?                            // overlap choices (03-engine §13.3–13.5); applied only on approval
  review      Json                             // publishReview result at request time (impact, overlaps, must-fix = [])
  requestedBy String
  requestedAt DateTime @default(now())
  status      String                           // 'pending' | 'approved' | 'rejected' | 'withdrawn'
  decidedBy   String?
  decidedAt   DateTime?
  comment     String?
  authorNotifiedAt DateTime?                   // set when the author has seen the "Published as …" toast (03 §13.5)
  workflow    Workflow @relation(fields: [workflowId], references: [id])
}

model ReferenceData {                          // managed outside Flow Studio; read-only here
  key        String   @id                      // 'people-and-authority' | 'approval-rules' | 'catalog' | 'digital-workers' | 'onboarding-presets' | 'systems'
  data       Json
  updatedAt  DateTime @updatedAt
  updatedBy  String?
}

model SampleRecord  { id String @id  data Json }          // the 29 "Try a record" records
model HistoryRecord { id String @id  data Json }          // the 440 "last 90 days" records

model BusinessRecord {                         // real records the runtime acts on (05 §2)
  id          String   @id                      // e.g. "WO-2214"
  type        String                            // record type key
  data        Json                              // field values (FIELDS ids) + system ids brought back ("Workday worker ID")
  source      String   @default("levv")
  updatedAt   DateTime @updatedAt
  @@index([type])
}

model WorkflowRun {                            // 02-data-model §14
  id            String   @id @default(cuid())
  workflowId    String
  version       Int
  recordType    String
  recordId      String
  event         String
  status        String                         // 'running' | 'paused' | 'stopped' | 'completed' | 'rejected'
  startedAt     DateTime @default(now())
  endedAt       DateTime?
  pausedBy      String?
  pausedAt      DateTime?
  pauseReason   String?                        // 'manual' | 'system_failure' (+ free-text note in RunEvent)
  stoppedBy     String?
  stoppedAt     DateTime?
  stopReason    String?
  recordSnapshot Json
  plan          Json
  steps         Json                           // Record<nodeId, StepRun>
  rev           Int      @default(1)           // optimistic concurrency for state transitions
  workflow      Workflow @relation(fields: [workflowId], references: [id])
  events        RunEvent[]
  @@index([status])
  @@index([recordType, recordId])
}

model RunEvent {                               // append-only audit log
  id      String   @id @default(cuid())
  runId   String
  at      DateTime @default(now())
  by      String                               // person name or "Levv"
  type    String                               // see 05 §8
  nodeId  String?
  m       String                               // plain-words message, exact copy from 05
  run     WorkflowRun @relation(fields: [runId], references: [id])
  @@index([runId, at])
}

model WorkItem {                               // what people see in the inbox (05 §7)
  id         String   @id @default(cuid())
  runId      String?                           // null for publish_request items
  publishRequestId String?                     // set for publish_request items
  nodeId     String?                           // null for publish_request items
  kind       String                            // 'approve' | 'escalation' | 'task' | 'collect' | 'collect_review' | 'decide_failed_check' | 'needs_information' | 'resubmit' | 'publish_request' (05 §7)
  assignee   String                            // person name (resolved by the engine)
  onBehalfOf String?                           // the role or person they cover (delegate/backup)
  status     String                            // 'open' | 'done' | 'cancelled' | 'held'   (held = run paused)
  remindAt   DateTime?
  escalateAt DateTime?
  createdAt  DateTime @default(now())
  doneAt     DateTime?
  decision   String?                           // 'approved' | 'rejected' | 'sent_back' | 'verified' | 'not_verified' | 'done' | 'provided' | 'resubmitted'
  comment    String?
  @@index([assignee, status])
  @@index([runId])
}

model LedgerLine {                             // what a worker has been given (onboarding gives, offboarding closes)
  id          String   @id @default(cuid())
  workerKey   String                           // the record's personal_email (05 §3.6)
  runId       String
  nodeId      String
  gives       String                           // e.g. "Workday account", "Site badge"
  disp        String                           // 'remove' | 'return' | 'retain' (02 §5.8 Disposition)
  reverse     String?                          // e.g. "Deactivate the badge"
  reverseWhen String?                          // 'before' | 'after' (02 §5.8; 'after' = "On the last day")
  reverseBy   String?
  systemRef   String?
  status      String   @default("open")        // 'open' | 'closed'
  createdAt   DateTime @default(now())
  closedAt    DateTime?
  @@index([workerKey, status])
}

model OutboxMessage {                          // Notify steps and Chaser reminders (05 §5.3)
  id        String   @id @default(cuid())
  runId     String?
  to        String
  channel   String                             // 'Email' | 'Teams' | 'Slack' | 'In-app' (02 §5.11)
  subject   String
  body      String
  createdAt DateTime @default(now())
  sentAt    DateTime?
}

model InboundEvent {                           // every event received (05 §3.1)
  id         String   @id @default(cuid())
  source     String
  recordType String
  recordId   String
  event      String
  payload    Json
  receivedAt DateTime @default(now())
  processedAt DateTime?
  runIds     Json?                             // runs started from it
  outcome    String?                           // 'started' | 'no_workflow' | 'waiting_prerequisite' | 'duplicate'
}
```

### 4.2 Seeding

`npm run seed:flow-studio` (and the test reset endpoint) loads the nine data files in `docs/flow-studio/seed/` (not the test fixtures `runtime-records.json` and `test-actors.json`; reset and the dev switcher read `test-actors.json` themselves), validates each file with Zod, applies 02-data-model §15 normalisation and writes:

- one `Workflow` row per workflow, with `draft` = the normalised workflow;
- one `WorkflowVersion` row (approvedBy "Seed") if `published` is not null;
- one `ReferenceData` row per reference file;
- `SampleRecord` and `HistoryRecord` rows.

Re-running is idempotent: upsert by id, and never touch runs.

`POST /api/flow-studio/reference/import` (admin only) replaces one `ReferenceData` key with a validated JSON body. This is how people, limits, groups and approval rules managed outside Flow Studio arrive until an admin area exists.

### 4.3 Repository interfaces (all data access goes through these)

```ts
interface WorkflowRepo {
  list(): Promise<WorkflowSummary[]>;
  get(id: string): Promise<{ workflow: Workflow; draftRev: number; versions: WorkflowVersion[] } | null>;
  create(input: NewWorkflowInput, by: string): Promise<Workflow>;
  saveDraft(id: string, draft: Workflow, expectedRev: number, by: string): Promise<{ draftRev: number } | { conflict: true }>;
  setActive(id: string, active: boolean, by: string): Promise<Workflow>;
  publishVersion(id: string, req: PublishRequest, approvedBy: string): Promise<WorkflowVersion>;
}
interface PublishRequestRepo { create(...): Promise<PublishRequest>; listPending(): Promise<PublishRequest[]>; decide(id, decision, by, comment?): Promise<PublishRequest> }
interface ReferenceRepo { getAll(): Promise<ReferenceBundle>; replace(key: ReferenceKey, data: unknown, by: string): Promise<void> }
interface RecordRepo { samples(): Promise<SampleRecord[]>; history(): Promise<RecordData[]>; get(type, id): Promise<BusinessRecord | null>; upsert(rec: BusinessRecord): Promise<void> }
interface RunRepo { create(run): Promise<WorkflowRun>; get(id): Promise<WorkflowRun | null>; list(filter): Promise<RunSummary[]>; update(run, expectedRev): Promise<WorkflowRun | { conflict: true }>; appendEvent(e: RunEvent): Promise<void> }
interface WorkItemRepo { open(item): Promise<WorkItem>; listFor(person): Promise<WorkItem[]>; close(id, decision, comment?): Promise<void>; holdForRun(runId): Promise<void>; releaseForRun(runId): Promise<void>; cancelForRun(runId): Promise<void> }
interface LedgerRepo { add(line): Promise<void>; openFor(workerKey): Promise<LedgerLine[]>; close(id): Promise<void> }
interface OutboxRepo { enqueue(msg): Promise<void> }
```

Provide an in-memory implementation of every repository as well. Engine and runtime unit tests use the in-memory one; the app uses the database one.

---

## 5. API (App Router route handlers; JSON; Zod-validated; errors as `{ error: { code, message } }` with the exact user-facing message)

The "Who" column names the permission key of §6.1; `admin` implies every permission.

### 5.1 Flow Studio

| Method & path | Body → Response | Who (permission, §6.1) |
| --- | --- | --- |
| `GET /api/flow-studio/workflows` | → picker list: `{id, name, recordType, event, status, version, scopeSummary, isVariationOf?}` in picker order (04-ui §3) | `flow.edit` |
| `POST /api/flow-studio/workflows` | `{fromWorkflowId?}` → a new workflow (03 §16.13 `createWorkflow`; 04-ui §12; defaults per 02 §5.14 and F11). It takes the record and event of `fromWorkflowId`; without it, `work_order` / `submitted` | `flow.edit` |
| `GET /api/flow-studio/workflows/:id` | → `{workflow, draftRev, versions, publishedNotice?}`. When the caller is the author of a request that was approved and whose `authorNotifiedAt` is empty, `publishedNotice = {version, effective}` and the server sets `authorNotifiedAt` (03 §13.5) | `flow.edit` |
| `PUT /api/flow-studio/workflows/:id/draft` | `{draft, draftRev}` → `{draftRev}` · 409 on conflict | `flow.edit` |
| `POST /api/flow-studio/workflows/:id/active` | `{active: boolean}` → workflow (03 §14; returns the warning text if any) | `flow.edit` |
| `POST /api/flow-studio/workflows/:id/simulate` | `{recordId, options?}` → `TestRunResult` (02 §12.1; repeated in 06 §1.4) computed on the **current draft** | `flow.edit` |
| `GET /api/flow-studio/workflows/:id/lint` | → `LintResult` (03 §12) | `flow.edit` |
| `GET /api/flow-studio/workflows/:id/publish-review` | → `PublishReview` (03 §13.1–13.3) | `flow.edit` |
| `POST /api/flow-studio/workflows/:id/publish-requests` | `{goLive, precedence?}` → PublishRequest. 422 if must-fix items exist, or if goLive is in the past ("Pick today or a later date.") | `flow.edit` |
| `GET /api/flow-studio/publish-requests?status=pending` | → list | `flow.approve_changes` |
| `POST /api/flow-studio/publish-requests/:id/approve` | `{comment?}` → WorkflowVersion. 403 if the caller is the author ("You can’t approve your own change.") | `flow.approve_changes` |
| `POST /api/flow-studio/publish-requests/:id/reject` | `{comment}` → PublishRequest | `flow.approve_changes` |
| `GET /api/flow-studio/reference` | → `{catalog, people, rules, digitalWorkers, presets, systems}` (read-only) | `flow.edit` |
| `POST /api/flow-studio/reference/import` | `{key, data}` → 204 | `reference.import` |
| `GET /api/flow-studio/samples` | → the 29 sample records | `flow.edit` |
| `POST /api/flow-studio/nova/condition` | `{text, workflowId, nodeId}` → `{rows: Row[], join: 'all'|'any', source: 'gpt'|'parser'}` or `{error}` (§7) | `flow.edit` |

There is no DELETE route for workflows, versions or runs.

### 5.2 Runtime

| Method & path | Body → Response | Who (permission, §6.1) |
| --- | --- | --- |
| `POST /api/runtime/events` | `{source, recordType, recordId, event, data}` → `{inboundEventId, runIds, outcome}` (05 §3.1). Auth: header `x-levv-service-token` equal to env `LEVV_SERVICE_TOKEN`, or a signed-in `admin` | service token / `admin` |
| `GET /api/runtime/runs?status=&workflowId=&recordId=` | → run list (05 §6.1) | `runs.view` |
| `GET /api/runtime/runs/:id` | → run detail with steps, people, timers, log (05 §6.2) | `runs.view` |
| `POST /api/runtime/runs/:id/pause` | `{reason?}` → run | member of the workflow’s owner team, or `runs.control` |
| `POST /api/runtime/runs/:id/resume` | `{}` → run | member of the workflow’s owner team, or `runs.control` |
| `POST /api/runtime/runs/:id/stop` | `{reason}` (required) → run | member of the workflow’s owner team, or `runs.control` |
| `GET /api/runtime/inbox` | → the caller's open work items (05 §7) | signed-in user |
| `GET /api/runtime/work-items/:id` | → the item with its run status, record title and brief (for `/inbox/[itemId]`); a stopped run's item returns `runStatus: 'stopped'` | assignee |
| `POST /api/runtime/work-items/:id/decide` | `{decision: 'approved'|'rejected'|'sent_back'|'verified'|'not_verified', comment?}` → item. `approved`/`rejected`/`sent_back` for approve, escalation and decide_failed_check items; `verified`/`not_verified` for collect_review items. A comment is required to reject an escalation or a failed-check decision, to send back, and for `not_verified`. On a stopped run: `{error: {code: 'RUN_STOPPED'}}` | assignee |
| `POST /api/runtime/work-items/:id/done` | `{note?}` → item (task items) | assignee |
| `POST /api/runtime/work-items/:id/submit-items` | `{items: string[]}` → item (collect items: the provider hands over the requested items; the checker then verifies, 05 §3.4 item 6) | assignee |
| `POST /api/runtime/work-items/:id/provide-field` | `{field, value}` → item (needs_information items: saves the value on the record and re-evaluates the If, 05 §3.4 item 1) | assignee |
| `POST /api/runtime/work-items/:id/resubmit` | `{data?, comment?}` → item (resubmit items: the requester applies any changes to the record and resubmits; the step asks again, 05 §3.4 item 3) | assignee (the requester) |
| `POST /api/runtime/records/:type/:id` | `{data}` → record; edits during approval trigger 03 §8.4 re-planning | `admin` |
| `POST /api/runtime/tick` | `{}` → `{processed}`. Processes due Chaser reminders, escalations, waits and system retries (05 §3.3). Auth: header `x-levv-cron-secret` equal to env `LEVV_CRON_SECRET` | cron |

### 5.3 Test-only

These routes exist only when `LEVV_E2E=1`.

| Method & path | Body → Response |
| --- | --- |
| `POST /api/test/reset` | `{actors?: 'default' \| 'author-only-approver'}` (default `'default'`) → 204. Reloads all seed files; loads that actor set from `seed/test-actors.json` (users, permissions, owner teams; §6); clears runs, work items, ledger, outbox, inbound events and publish requests; resets the id generator to 101 (03 §16.0) and the clock to `LEVV_FIXED_NOW` |
| `POST /api/test/sign-in` | `{user}` ("Flow Admin" or any `PEOPLE` name) → 204. Issues a session for that user through the repo's auth, or sets the dev switcher's signed cookie (§6.3). Unknown name → 404 |
| `POST /api/test/clock` | `{now?: ISO date-time, advanceMs?: number}` → `{now, processed}`. Sets the server clock to `now`, or moves it forward by `advanceMs` (never backwards; only reset does that), then runs the scheduler tick once (§5.2) |

`LEVV_FIXED_NOW` (ISO date-time) is the server clock's starting value (§8). `LEVV_MOCK_AUTOCOMPLETE=1` turns on mock auto-completion (05 §5.2).

---

## 6. Permissions and users

### 6.1 Permissions

| Permission | Lets a user |
| --- | --- |
| `flow.edit` | open Flow Studio, edit drafts, Test, see Nova checks, switch Active / Inactive, create workflows, send for approval |
| `flow.approve_changes` ("Approve flow changes") | approve or reject publish requests **made by someone else** |
| `runs.view` | see the runs list and run detail |
| `runs.control` | Pause / Resume / Stop any run. Without it, a user may control only runs of workflows whose `owner` they are or belong to |
| `reference.import` | replace reference data via the import endpoint |
| `admin` | all of the above |

Map these onto the repo's existing roles if it has a permission system. Otherwise store them on the user record or in a config map.

### 6.2 Who is "the owner"

A workflow's `owner` is a team or person name (02 §4), for example "Procurement operations". The repo's user model needs a way to say which users belong to which owner team. Until it has one, use a config map `OWNER_TEAMS: Record<teamName, userIds[]>`. Tests and development load it, with each user's permissions, from `seed/test-actors.json` (`ownerTeams`, `users`).

### 6.3 Dev user switcher (only if the repo has no auth)

A small menu in the app header lists the seeded people (`PEOPLE`) plus "Flow Admin", with the permissions of the `default` actor set in `seed/test-actors.json` (everyone not listed there has none). Choosing one sets a signed cookie, so approvers can be tried end to end: for example sign in as Owen Clarke to approve as Procurement. Hide it when `NODE_ENV === 'production'`.

---

## 7. Nova: the plain-words condition writer (✦ Set) and Nova checks

- **Nova checks** are deterministic (03 §12). No AI call.
- **✦ Set** ("Only needed when", and anywhere else 04-ui shows it):
  1. `POST /api/flow-studio/nova/condition` with the text.
  2. The server calls `callGPT` (GPT-4.1-mini, temperature 0) with:
     - a system prompt listing the allowed fields (id, label, type, options) from `catalog.FIELDS`, the operators per type (`OPS`), the role words (`ALIAS`, `FLAT`) and money parsing rules ($250K = 250000, 1.5M = 1500000, "%" = percent);
     - a required JSON output shape `{"join":"all"|"any","rows":[{"f":fieldId,"op":operator,"v":value}]}` and nothing else.
  3. Validate the response with Zod against the catalog: a known field, an operator allowed for its type, a value of the right type, enum values from the field's options. If the response is invalid, or the call fails or takes longer than 8 seconds, use the deterministic parser `engine/nova-parse.ts` (the prototype's parser, specified in 03 and tested in 06). If neither yields a valid row, show the error copy from 04-ui.
  4. The rows are shown for the admin to check. Nothing is saved until the draft autosaves the panel change.
- Never send record data or people's names to `callGPT`: only the admin's sentence and the field catalog.

---

## 8. Time

- Engine functions take the `EngineContext` of 02 §0.1, with `ctx.asOf` (YYYY-MM-DD, used for absences and "today") and `ctx.now` (ISO date-time, used for timers) as strings. They never read the system clock.
- The server builds the clock from `LEVV_FIXED_NOW` if it is set, else the real time. Tests set it to `2026-10-20T09:00:00Z` (06 §1.2). With `LEVV_E2E=1` the server clock then moves only through `POST /api/test/clock` (§5.3), which also runs the scheduler tick.
- Flow Studio texts use the company time zone (default `Europe/London`, configurable) unless a step says "the worker’s time zone" (Wait).
- Run screens, the inbox and run-log lines (05 §6–§8) show times in **UTC** with the suffix "UTC", formatted `d MMM yyyy, HH:mm` (for example "20 Oct 2026, 10:00 UTC"), as 06 Part D expects. Dates without a time ("Due {date}", "goes live on {date}") use `d MMM yyyy`.

---

## 9. Test harness (06-acceptance-tests is the definition of done)

- `npm run test:engine` runs Vitest on `tests/engine/**`. Tests import only `src/flow-studio/model|engine|runtime` and the fixtures.
- `npm run test:e2e` builds and starts the app with `LEVV_E2E=1 LEVV_FIXED_NOW=2026-10-20T09:00:00Z LEVV_MOCK_AUTOCOMPLETE=1` and runs Playwright on `tests/e2e/**`. Each test calls `POST /api/test/reset` first, then `POST /api/test/sign-in` as Flow Admin unless the test says otherwise (06 §1.2).
- The UI must expose the roles and accessible names in 06 §1.5. Tests never use CSS classes, test ids or prototype ids.
- CI: lint, typecheck, `test:engine`, `test:e2e`. All must pass.

---

## 10. Build order (each milestone ends green before the next starts)

| # | Milestone | Done when |
| --- | --- | --- |
| M0 | **Discover and plan.** Read the repo and this package; write `docs/flow-studio/IMPLEMENTATION_NOTES.md` with the repo conventions found (folders, auth, DB, design tokens, `callGPT` signature) and any mismatches with this spec | Notes committed; no code yet |
| M1 | **Model + seed loader + fixtures** (02) | Seeds load and normalise; 06 A.4 seed-count tests pass (15 workflows, 159 boxes, 50 Approve steps…) |
| M2 | **Engine** (03): conditions, selection, walk, checks, planning, rules, changes, auto, simulate, compose, lint, publish, active, edit, nova-parse | Every 06 Part A and Part C engine test passes |
| M3 | **Persistence + API** (§4, §5.1) with in-memory and DB repositories; seed script; test reset endpoint | API smoke tests pass; simulate endpoint returns 06 A.1 results |
| M4 | **UI foundation**: SelectMenu (04 §13) + page shell, top bar, picker, read-only canvas with the exact layout (04 §2–4) | 06 B.1 (N1–N4), B.7 dropdown tests, and the canvas appendix (04 Appendix A) match |
| M5 | **Editing**: step menu, every step panel, Digital Workers rail drag, graph operations, autosave (04 §5–7, §12; 03 §16) | 06 B.3 (I-scripts), B.4 panel checks, B.5, B.8 pass |
| M6 | **Test, Nova, Publish, Active/Inactive** drawers and dialog (04 §8–11) | All remaining 06 Part B and Part C tests pass |
| M7 | **Runtime** (05): events, runs, executors, inbox, scheduler, adapters (mocks), ledger, run screens, Pause / Resume / Stop | 06 Part D passes, plus the 05 §9 runtime checks |
| M8 | **Hardening**: accessibility pass (keyboard-only walkthrough of every panel), empty and error states, copy review against 04 §15 and 05, performance (canvas with 40 steps stays smooth; Test completes in < 150 ms for the largest workflow), and a final full test run | `docs/flow-studio/BUILD_REPORT.md`: test counts, anything not done, deviations found |

# Levv Flow Studio — 03 Engine

The engine is a set of pure, deterministic TypeScript functions with no React and no I/O (except the optional GPT call in §17, which is injected). Every function takes its data explicitly. The same functions power ▶ Test, ✦ Nova, Publish and the production run engine.

Types are defined in `02-data-model.md`. Section numbers like "DM §5.4" refer to that file.

Behaviour reference: prototype v35. Where this spec deliberately differs from the prototype, the difference is listed in §20 ("Deviations") with the reason; build what this spec says.

---

## 0. Conventions

Every function receives the canonical `EngineContext` defined in DM §0.1: the seed data (`catalog`, `people`, `rules`, `dws`, `presets`, `systems`, `workflows`, `samples`, `history`), `asOf` (YYYY-MM-DD "today"; tests '2026-10-20'), `now` (ISO date-time; tests '2026-10-20T09:00:00Z'), `idGen` (§16.0) and `approverAvailability` (§13.1 item 7). `asOf` and `now` are strings; the engine never reads a clock.

- "Title of a step" = `title(node)` (§1.2).
- "Role name" = `ROLES[key].n`.
- Strings in "double quotes" in this document are exact user-visible text. `{x}` marks a placeholder. Curly quotes “ ” and apostrophes ’ are part of the text. Every user-visible string uses curly apostrophes, including those the prototype wrote straight and labels that come from the seed with a straight apostrophe (displayed with ’, e.g. "Hiring manager’s manager"). Some examples below still show a seed label as stored; the acceptance tests normalise quotes before comparing (06 §1.3).
- Lists are joined exactly as stated (", ", " · ", "; ", " or ", " and ").
- All loops over `outs` keep their stored order. All loops over nodes for display use walk order (§4), never object-key order.

---

## 1. Text helpers (pure)

### 1.1 `fmt(n: number | null | undefined): string` — money

1. `null`/`undefined` → `''`.
2. Sign: negative → prefix `'−'` (U+2212 minus), then work on `|n|`.
3. `|n| ≥ 1 000 000` → `'$' + trimZeros((|n|/1e6).toFixed(2)) + 'M'`.
4. else `|n| ≥ 1000` → `'$' + trimZeros((|n|/1e3).toFixed(1)) + 'K'`.
5. else `'$' + |n|`.

`trimZeros` = convert the fixed string back to a number and print it (`'1.50'` → `1.5`, `'2.00'` → `2`).
Examples: 0 → "$0"; 950 → "$950"; 1500 → "$1.5K"; 62500 → "$62.5K"; 120000 → "$120K"; 1000000 → "$1M"; 1060000 → "$1.06M"; 2400000 → "$2.4M"; −36000 → "−$36K"; 12345678 → "$12.35M".

### 1.2 `title(node): string`

`node.label` if non-empty, else `DEFAULT_TITLE[node.kind]` (DM §2). So an unnamed Approve step is "Approval".

### 1.3 `rowText(row): string` and `conditionText(cond): string`

`rowText(x)`:
1. `x` is a Group → `'(' + conditionText(x) + ')'`.
2. Field unknown → `'Unknown field'`.
3. Field type `bool` → `` `${f.l} ${OPL[x.op]}` `` e.g. "Client data access is yes".
4. Otherwise value text `vt`:
   - money → `fmt(x.v)` ("$250K")
   - pct → `x.v + '%'` ("15%")
   - array → `x.v.length ? x.v.join(' or ') : '(pick a value)'` ("UK or Canada")
   - list → the option with `_` replaced by a space ("bill rate")  *(prototype prints the raw key "bill_rate"; see §20 D14)*
   - else `x.v ?? ''`
   and return `` `${f.l} ${OPL[x.op]} ${vt}` `` e.g. "Rate vs rate card (%) > 15%", "Total value ≥ $1M", "Business unit is not Finance".

`conditionText(c)` = `c.rows.map(rowText).join(c.join === 'any' ? ' or ' : ' and ')`, or `'Always'` when there are no rows.
Example (I11): "Engagement type is Off-payroll and (Total value ≥ $250K or Regulated role is yes)".

### 1.4 `scopeText(scope): string`

For each key with a non-empty value list (in the object's key order) take `values.join(' / ')`; join the parts with `' · '`; empty → `'Everywhere'`. Examples: "UK · Technology", "Data", "Everywhere". Values are printed raw (not the short labels).

`scopeLabel(key, v)` (dropdown option labels only): legal_entity → `ORGX.LE_SHORT[v] ?? v` ("UK entity"); cost_center → `` `${v} ${ORGX.CC[v] ?? ''}`.trim() `` ("CC-100 Platform engineering"); else `v`.

### 1.5 `roleList(keys): string` (canvas subtitles)

≤2 keys → names joined `' + '` ("Hiring manager + Cost center owner"); more → `` `${name(keys[0])} + ${keys.length-1} more` ``.

### 1.6 Event names

- `evName(wf, e = wf.event)`: if `e === 'end_30'` → `` `End date in ${wf.days ?? 30} days` ``; if `e === 'doc_expiring'` → `` `Document expiring in ${wf.days ?? 30} days` ``; else `EVENTS[e]`.
  For offboarding the "Runs when" list shows `end_30` with the offboarding workflow's `days` (14) because the list is built with the open workflow — keep that.
- `fromText(wf)` = `wf.source && wf.source !== 'levv' ? ' in ' + SOURCES[wf.source] : ''`.
- Start box title = `` `${RECORDS[wf.records[0]]} ${evName(wf).toLowerCase()}${fromText(wf)}` `` e.g. "Work order submitted", "Access request submitted in Zip", "Worker document expiring in 30 days", "Onboarding starts".

### 1.7 People in sentences

`resolveRoleHolder(role, rec, cc?)` is defined in §6.6. Two display helpers:

- `personLabel(role, rec)`: `nm = resolveRoleHolder(role, rec).person`; if `nm` starts with `'the '` or equals the role name → `nm`; else `` `${roleName} (${nm}${role === 'sponsor' && rec.sponsor_delegate ? ', or their delegate ' + rec.sponsor_delegate : ''})` ``.
  Examples: "Hiring manager (Tom Reed)", "Supplier account manager", "the worker", "Worker (Jordan Ellis)", "Sponsor (Grace Kim, or their delegate Raj Patel)", "SOW owner (Grace Kim)".
- Used for: "Asked of …", Notify recipients, reviewers ("Waiting for …"), task owners, failure deciders, Needs-information owner.

### 1.8 Wait text — `waitText(w: WaitConfig, long: boolean): string`

1. `mode 'for'` → `` `Waits ${amount} ${WAIT_UNITS[unit]}` `` ("Waits 3 working days") — same for short and long.
2. `mode 'at'` → `at ? 'Until ' + at.replace('T', ' at ') : 'Pick a date and time'` ("Until 2026-12-01 at 09:30").
3. `mode 'date'`: `d = WAIT_DATES[field]`; `off = amount ? `${amount} ${WAIT_UNITS[unit]} ${dir} ` : ''`; text = `(long ? 'Waits until ' : 'Until ') + off + (off ? d.toLowerCase() : d) + (time ? ', ' + time : '') + (long ? (tz === 'worker' ? ' in the worker’s time zone' : ' company time') : '')`.
   Examples: long "Waits until Start date, 09:00 in the worker’s time zone"; short "Until Start date, 09:00"; "Waits until 5 working days before start date, 09:00 company time"; "Waits until 2 weeks after end date in the worker’s time zone".

`ensureWait(node)` (load only, when `w` is missing): from `until` lower-cased — contains "start date" → `{mode:'date', field:'start_date', amount: N from "(minus|plus) N day" or 0, unit:'days', dir: plus ? 'after' : 'before', time:'09:00', tz:'worker'}`; contains "end date" or "last day" → `{mode:'date', field:'end_date', amount:0, unit:'days', dir:'before', time:'17:00', tz:'worker'}`; else `{mode:'for', amount:2, unit:'days'}`.

### 1.9 Ledger helpers

- `dispOf(node)`: `node.disp` if set; else System → `'remove'`; else `gives` matches `/laptop|badge|phone|equipment/i` → `'return'`; matches `/nda|obligation|confidential/i` → `'retain'`; else `'remove'`.
- `DISP = {remove: 'Remove access', return: 'Return equipment', retain: 'Retain obligation'}`.

### 1.10 System helpers

`ensureSys(node)` (only when `sys` is missing or `sys.system !== node.system`):
1. `a = node.actions ?? ['push']`.
2. `action` = `a` has `'reconcile'` and not `'push'` → `'check'`; else has `'push'` → (`/remove|close|deactiv|end /i` matches the label ? `'close'` : `'create'`); else has `'pull'` → `'read'`; else `'create'`.
3. `S0 = SYS[node.system] ?? SYS.Workday`; `object` = previous `sys.object` if it is in `S0.obj`, else `S0.obj[0]`.
4. Return `{system: node.system, action, object, match: (SYS_KEY[node.system] ?? ['Work email'])[0], map: copy(SYS_MAP[object] ?? SYS_MAP._), read: a has 'pull' ? [S0.back[0]] : [], wait:'confirm', waitH:24, state:'Completed', onFail:'task', failRole:'people_ops', retries:3, check: a has 'reconcile'}`.
When the admin changes the System: rebuild with `ensureSys`, but keep the previous `action` if it was not `'create'`. When the admin changes "What": `map = copy(SYS_MAP[object] ?? SYS_MAP._)`.

`sysShort(node)`:
- `check` → `` `Check ${system} matches the ledger` ``
- `wait` → `` `Wait for ${object.toLowerCase()} in ${system}` ``
- else → `` `${SYS_ACT[action]} ${object.toLowerCase()} in ${system}` `` ("Create contingent worker in Workday", "Close or deactivate user in Okta", "Update supplier invoice in SAP S/4HANA")

`sysSentence(node)`:
1. If `SYS[system].st === 'off'` → `` `${system} isn’t connected yet, so this step pauses and ${roleName(sys.failRole) ?? 'the owner'} is asked to do it by hand` ``.
2. Else parts: first `sysShort(node)` plus, for create/update, `` `, matched on ${match}, ${map.length} fields sent` ``; then `'reads back ' + read.join(', ')` if `read` non-empty; then `` `waits up to ${waitH}h for ${system} to confirm` `` if `wait === 'confirm'` and action ≠ `'read'`; then `'then checks it matches the ledger'` if `check` or action `'check'`. Join with `'; '`.
   Example: "Create contingent worker in Workday, matched on Work email, 7 fields sent; reads back Workday worker ID; waits up to 24h for Workday to confirm; then checks it matches the ledger".

### 1.11 Digital Worker context

`dwContext(wf)`: `records[0]` is `'onboarding'` or `'offboarding'` → that; `'access_request'` → `'access'`; else `'workflows'`.
`dwsFor(wf)` = `DW_SET[dwContext(wf)].map(id => DW[id])`. The rail shows all of them (an `off` one is greyed and not draggable; clicking it says "{name} isn’t licensed for this org"); the step menu shows only `s !== 'off'`. `CHECK_DW` membership decides check vs helper.

### 1.12 Chaser helpers

- `chaseDefaults(node)` = `{remind: node.remind ?? (appr ? 24 : 48), sla: node.sla ?? (appr ? 48 : 96)}` for kinds appr, task, collect.
- `chaseTo(node)` = Collect & verify with `from` in {worker, supplier_am} (absent = worker) → `'the hiring manager'`; everything else → `'their manager'`.

---

## 2. Condition evaluation

### 2.1 `evalRow(row, rec): boolean`

If the row is a Group → `evalCondition(group, rec)`. Else with `v = rec[row.f]`:

| op | result |
| --- | --- |
| `is` | `String(v ?? '').toLowerCase() === String(row.v ?? '').toLowerCase()` |
| `contains` | `String(v ?? '').toLowerCase().includes(String(row.v ?? '').toLowerCase())` |
| `>=` `>` `<` `<=` | `v != null && v <op> row.v` (a `null` row value compares as 0 in JS; treat `row.v == null` as "never matches" in production — see §20 D15) |
| `in` | `(row.v ?? []).includes(v)` |
| `not_in` | `v != null && !(row.v ?? []).includes(v)` |
| `yes` | `!!v` |
| `no` | `!v` (so an absent field is "no") |
| `includes` | `(v ?? []).includes(row.v)` (list fields, e.g. "Fields changed includes bill rate") |

### 2.2 `evalCondition(cond, rec): boolean`

No rows → `true`. `join === 'any'` → some row true. Otherwise every row true. Groups nest to any depth.

### 2.3 Applies to — `scopeMatch(scope, rec): boolean`

Every key with a non-empty list must contain `rec[key]`. Empty scope → `true`.

### 2.4 Missing values → Needs information

Applies only at If steps (`cond`), when walking (§4):

1. `used` = every field id in every path's rows (recursing into groups). The Otherwise path has no rows.
2. `missing` = `used` where `rec[f] === null` (exactly `null`; absent fields are not missing).
3. If `missing` is empty → evaluate normally.
4. Else by `node.onMissing`:
   - `'otherwise'` → evaluate normally (blank values never match a comparison, so it usually takes Otherwise).
   - `'cautious'` and every missing field has `risk: true` → evaluate with those fields set to `true`.
   - otherwise (`'ask'`, default, or cautious with a non-risk blank) → **stop**: record decision `{nodeId, label: 'Needs information'}`, record `needInfo {nodeId, missing}`, and do not follow any of this If's exits (nothing after it is walked).
5. Who is asked: `owner(fieldId)` = if `FIELD[f].owner` → `personLabel(owner, rec)` ("Procurement (Owen Clarke)"); else `rec.hiring_manager ?? rec.requester`. Use the first missing field.
6. Message (Test summary bit, §11.1): `` `Needs information: ${labels.join(', ')} ${labels.length > 1 ? 'are' : 'is'} missing, so “${title(if)}” can’t decide. ${owner} has been asked to fill it in` `` where `labels` = field labels. Example: "Needs information: Rate vs rate card (%) is missing, so “Rate over card?” can’t decide. Procurement (Owen Clarke) has been asked to fill it in."
7. When any Needs information is hit, approval rules are not applied for this run (§7.2) and nothing after that If is simulated. At runtime the run waits at that If; when the field is filled in, the If is evaluated again.

---

## 3. Which workflow runs (record + event + Applies to)

### 3.1 Containment

- `inside(a, b)` ("a is the same as or narrower than b"): for every key `k` with a non-empty list in `b`: `a[k]` is non-empty and every value of `a[k]` is in `b[k]`. (`inside(anything, {})` is true.)
- `strictlyInside(a, b)` = `inside(a, b) && !inside(b, a)`.

### 3.2 `selectWorkflow(rec, workflows): Selection`

```ts
interface Selection { workflow: Workflow | null; tie: boolean; tied: Workflow[]; beaten: Workflow[] }
```
1. `cands` = workflows with `status === 'live'`, `records.includes(rec.record)`, `event === rec.event`, `scopeMatch(scope, rec)`. Drafts and inactive workflows never run.
   (Production: use each workflow's current published version's scope, not the draft scope.)
2. None → `{workflow: null, …}`.
3. `top` = candidates `x` for which no other candidate `y` is `strictlyInside(y.scope, x.scope)` (the most specific Applies to wins; "most specific" is containment, not number of fields).
4. Sort `top` by `priority ?? 99` ascending; keep the file/list order for equal priorities (stable sort).
5. Return `{workflow: top[0], tie: top.length > 1, tied: top.slice(1), beaten: cands not in top}`.
6. At runtime a `tie` with equal priorities cannot normally happen (Publish blocks it, §13.3). If it does, run `top[0]` and write a run log entry "Two workflows overlap; ran “{name}” by priority."

Results with the seed (all live): WO-2214 and WO-2240 and WO-2260 → "UK Technology work orders" (beats "Work order submitted"); WO-2231, WO-2270, WO-2275, WO-2280 → "Work order submitted". If "Data and AI hires" were live: WO-2240 ties with "UK Technology work orders"; WO-2270 → "Data and AI hires".

### 3.3 No workflow

If nothing is selected, nothing starts and nothing is approved automatically. The event is stored with outcome `no_workflow` (05 §3.1) and never starts a run later, even if a workflow covering it is published or switched back on afterwards.

### 3.4 Test is not selection

▶ Test always runs the workflow that is open, on any sample record with the same record type and event, whatever its Applies to. (Production addition: if `selectWorkflow` would pick a different workflow for that record, show under the summary: "For real requests, “{winner name}” runs for this record." — §20 D16.)

---

## 4. Graph walk — `walkWorkflow(nodes, rec, ctx): WalkResult`

Used by Test, approval planning and lint. It simulates which path a record takes. One walk per run (§20 D1).

Input `rec` is the record **after** the change-amount basis is applied (§6.2).

Algorithm (breadth-first, each node at most once):

1. `queue = ['T']`, `seen = []`, `path = new Set()`, `edges = []`, `steps = []`, `decisions = []`, `needInfo = []`, `reason = {}` (target id → why text).
2. While the queue is not empty (guard: stop after 800 iterations):
   1. `id = queue.shift()`. Skip if already seen or not in `nodes`. Push to `seen`, add to `path`. `n = nodes[id]`, `outs = n.outs`.
   2. By kind:
      - `cond` (If): apply §2.4. If it stopped → `continue` (no exits). Else `hit` = first non-`else` out whose `{join, rows}` condition is true, or the `else` out if none. `outs = hit ? [hit] : []`. Record decision `{nodeId: id, label: hit.label}`. If `hit` is not `else` → `reason[hit.to] = `${hit.label}: ${conditionText(hit)}``.
      - `plan` (Fits plan?): `inPlan = (rec.budget_left_after ?? 0) >= 0`; take out `'in'` or `'out'`; decision label "Inside plan" / "Outside plan"; `reason[to] = label`.
      - `dw` whose worker is a check: `res = checkResult(worker, rec)` (§5); take out `'pass'` if `res.ok` else `'flag'`; decision label "Passed" / "Flagged"; `reason[to] = `${DW[worker].n}: ${res.m}``.
      - `parallel`: take every out.
      - `collect` with a `fail` out (failTo 'role'): take `fail` when the step's outcome is `'fail'` (Test: §10.3 `o`; runtime: the verification result), else `next`.
      - every other kind: take only `outs[0]` (System 'failed' exits are never taken in simulation).
   3. If kind is not trigger, cond, plan, parallel or end → push `{nodeId: id, why: reason[id] ?? null}` to `steps`.
   4. For each taken out: add `` `${id}:${out.key}` `` to `path`, push `{from: id, key, to}` to `edges`, push `out.to` to the queue.
3. Return `{seen, path, edges, steps, decisions, needInfo}`.

Consequences to keep: steps are listed in breadth-first order (parallel branches interleave); a step reached from two paths appears once; an If with no matching path and no else stops that branch; Needs information stops at the If.

**Outcome of the walk** (used by Test and runtime):
- Rejected: a node with `kind 'end'` and `outcome 'rejected'` is in `path`. `by` = title of the visited node that has an out to it. If several, use the first in walk order.
- Stopped (production, §16.4): a visited End with outcome `'stopped'`.
- Otherwise completed.

---

## 5. Digital Worker results — `checkResult(dwId, rec): {ok, m}`

These are the prototype's simulated results, computed from the record. In production the same rules run inside the Digital Worker service against live data (rate cards, budgets, the worker registry); the record fields are what that service writes back.

| DW | Rule (in order) | ok | m |
| --- | --- | --- | --- |
| `rate` | `rate_vs_card_pct == null` | true | "No rate on this record" |
|  | else | `rate_vs_card_pct <= 10` | `` `${card}% over rate card, ${market >= 0 ? market + '% over' : abs(market) + '% under'} market median` `` |
| `budget` | `budget_left_after == null` | true | "No budget data on this record" |
|  | `>= 0` | true | `` `${fmt(left)} left in plan after this request` `` ("$120K left in plan after this request") |
|  | `< 0` | false | `` `${fmt(-left)} over the approved plan` `` ("$36K over the approved plan") |
| `dup` (record `access_request`) | `duplicate_found` | false | "This person already has an active badge from an earlier request" |
|  | else | true | "No active badge or open request for this person" |
| `dup` (other records) | `duplicate_found` | false | "Same person is active through another supplier (WO-1877)" |
|  | else | true | "No duplicate worker or leftover access found" |
| `tenure` | `months_engaged_after == null` | true | "No tenure data" |
|  | else | `months <= 18` | `` `${months} months engaged after this change (cap 18)` `` |
| any other | — | true | `` `${DW[id].n} completed` `` |

Constants: rate-card limit 10%, tenure cap 18 months (fixed in v35; in production read them from the rate-card and classification policy, defaulting to these values). The `WO-1877` reference is demo text; production shows the matching record id.

Helper Digital Workers (not checks) always succeed in Test: `{st:'ok', short:'Done', m: DWX[id].d ?? DWD[id]}` ("Matches each invoice line to approved time, expenses and milestones, and holds anything that doesn’t match.").
Digital Workers never approve or reject: a check only takes its Passed or Flagged exit.

---

## 6. Approval planning — `planApprovals(wf, rec, ctx): ApprovalPlan`

Plans every approval round on the path the record takes through the workflow graph, including company-wide approval rules. Run it whenever the workflow has an Approve or Auto-approve step **or** any approval rule matches the record (§7.2). Otherwise `plan = null`.

### 6.1 Inputs

- `nodes` = the graph being tested (draft) or run (pinned version).
- `rec0 = {...rec, record: wf.records[0], event: wf.event}`.

### 6.2 Change-amount basis — `applyBasis(wf, rec0): Basis | null`

1. If `!rec0.prev` or `rec0.prev.total_value == null` or `wf.basis` is absent/`'total'` → `null` (use the record as is).
2. `orig = rec0.original_total ?? rec0.prev.total_value`; `change = total_value − prev.total_value`; `running = total_value − orig`.
3. `v = basis === 'change' ? change : running`.
4. `m`:
   - change: `` `Comparing the change amount: ${fmt(change)} (was ${fmt(prev.total_value)}, now ${fmt(total_value)})` ``
   - running: `` `Comparing the running total of changes: ${fmt(running)} since the original ${fmt(orig)}. This change alone is ${fmt(change)}` ``
   SOW-77-CO3: "Comparing the running total of changes: $360K since the original $820K. This change alone is $60K".
5. `recAdj = {...rec0, total_value: v}`. `recAdj` is used for the walk (If conditions), "Only needed when" and signing limits. Approval rules (§7) and Digital Worker checks use `rec0`.

### 6.3 Walk

`walk = walkWorkflow(nodes, recAdj)`. The Test canvas, decisions and step list use this same walk (§20 D1).

### 6.4 Who approved the previous version (change events)

If `rec0.prev` exists:
1. `p = {...rec0, ...rec0.prev}` (previous values; no basis applied).
2. `prevRoles` = all roles of every Approve step on `walkWorkflow(nodes, p).steps`, plus the roles of every live approval rule with `act.approve` that matches `p` (same record, event and `when`).

### 6.5 Rounds from Approve steps

`stages = []`, `notNeeded = []`, `skipped = []`, `policies = []`. For each `s` in `walk.steps` in order, `n = nodes[s.nodeId]`:

1. `policy` → push id to `policies`; continue.
2. Not `appr` → continue.
3. **Only needed when**: if `n.when` has rows and `evalCondition(n.when, recAdj)` is false → push `{nodeId, roles: n.roles, label: title(n), m: 'only needed when ' + conditionText(n.when)}` to `notNeeded`; continue.
4. **Not asked again**: `owned = n.material` has any key in `rec0.changed_fields ?? []`. `roles` = `n.roles` minus those `r` where `prevRoles.has(r) && !owned` — each removed one pushes `{nodeId, role: r, m: 'approved the original; nothing they depend on changed'}` to `skipped`. If `roles` is empty → continue.
5. Make items (`mk(roles)` = `{roles, any: roles.length > 1, nodeId: n.id, why: s.why, notes: [] …}`):
   - `mode 'any'` and 2+ roles → one stage `{label: title(n), items: [mk(roles)], tasks: []}`.
   - `mode 'order'` → one stage per role `r` (index `i`), label `title(n) + (roles.length > 1 ? ` (${i+1} of ${roles.length})` : '')`, items `split([r])`.
   - else → one stage `{label: title(n), items: split(roles)}`.
   - `split(roles)` = each role becomes its own one-role item, except **split funding**: role `'cco'` with `rec0.cost_centers` of length ≥ 2 becomes one item per entry `cc` (`item.cc = cc`).

### 6.6 Resolving a role to a person — `resolveRoleHolder(role, rec, cc?)`

Returns `{person: string | null}` (`null` = nobody eligible).
1. `g:<key>` → the group text (§6.8, step 1). `p:<Name>` → `Name`.
2. `hm` and `rec.hiring_manager` → `rec.hiring_manager`.
3. `hm_mgr` and `rec.hiring_manager` → `MGR[rec.hiring_manager] ?? null`.
4. `cco` and `cc` → `ORG[cc]?.cco ?? null`.
5. `BY_COUNTRY[role]` has key `rec.country` → that value (may be `null`: nobody eligible in that country).
6. `worker` → `rec.worker_name ?? 'the worker'`. `sponsor` → `rec.sponsor ?? rec.hiring_manager ?? ORG[rec.business_unit]?.hm ?? 'the sponsor'`. `sow_owner` → `ORG[bu]?.hm ?? 'SOW owner'`.
7. Else `ORG[rec.business_unit]?.[role] ?? CENTRAL[role] ?? ROLES[role].n`. (`supplier_am` resolves to the placeholder "Supplier account manager"; production resolves the supplier contact on the record.)

The same resolver is used for approvers, reviewers, task owners, deciders and notification recipients (§20 D10).

### 6.7 People for each item (in stage order, item order)

For each stage index `si`, each item:

**A. "Any one" items** (`any`):
1. `people` = each role's person, dropping `null` and the requester. If empty → `paused = true`, `pausedWhy = 'no eligible ' + roleNames.join(' or ')`, `people = ['—']`.
2. `cls` = lowest class among the roles. (No delegation, limits or move-up for any-one items.)

**B. One-role items**: `role = roles[0]`, `cls = ROLES[role].c`, `p = resolveRoleHolder(role, rec0, item.cc).person`. Then, in this order:
1. Split funding note: `item.cc` → note ok "Charged to {cc}, so its cost center owner approves".
2. Raised on behalf: `role === 'hm'` and `rec0.hiring_manager` and `rec0.requester !== rec0.hiring_manager` → note ok "{hiring_manager} is the hiring manager on the record (raised by {requester})".
3. Group roles: `p` is the group text — for groups skip steps 4–8 and apply §6.8.
4. `p === null` → paused, `pausedWhy` = "no eligible {Role} reviewer for {country}".
5. **Self-approval** (`p === rec0.requester`):
   - class 2 (specialist): if `BACKUP[role]` → note warn "{p} raised this request, so another {Role} reviewer, {backup}, approves"; `p = backup`. Else paused, `pausedWhy` = "{p} raised this and no other {Role} reviewer is set".
   - other classes: while `p === requester` and `MGR[p]` (max 5 hops): note warn "{p} raised this request, so the step moves up to {up}{title}" where `{title}` = `` ` (${TITLES[up]})` `` if known; `p = up`.
   Example: "Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK)".
6. **Signing authority**: if not paused, `node.authority`, class ≠ 2 and `recAdj.total_value != null`: while `LIMIT(p) < total_value` and `MGR[p]` (max 6 hops): note info "{p}’s signing limit is {fmt(limit)}, so it moves up to {up}"; `p = up`. `LIMIT(p)` = `LIMIT[p]`, `null` = unlimited, missing = 0.
   Example (2.4M, Technology): "Priya Shah’s signing limit is $250K, so it moves up to Alan Brooks; Alan Brooks’s signing limit is $500K, so it moves up to Samira Khan; Samira Khan’s signing limit is $2M, so it moves up to Rebecca Stone".
7. **Absence** (`isAway(p, asOf)`: `OOO[p]` exists, `asOf <= until`, and `from` absent or `asOf >= from`): `d = OOO[p].to`; `eligible = cls !== 2 || DELEG_OK[d]?.includes(role)`.
   - eligible → note ok "{p} is out until {until}. Delegated to {d}"; `p = d`. ("Hannah Brooks is out until Oct 24. Delegated to Luis Romero")
   - else if `BACKUP[role]` and `BACKUP[role] !== p` → note warn "{p} is out until {until}. Their delegate {d} isn’t eligible for {Role} decisions, so {backup} (backup) approves"; `p = backup`. ("Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves")
   - else → paused, `pausedWhy` = "{p} is away and has no eligible delegate".
   - **Named person** (`p:` role), instead of the three cases above: if away → `node.backup` approves with note warn "{p} is out until {until}, so {backup} (backup) approves"; no backup → paused, `pausedWhy` = "{p} is away and no backup is set" (§20 D8).
8. If paused → note bad "Paused: {pausedWhy}. It waits until someone eligible is assigned (owner: Procurement operations). No one unqualified stands in". The owner text is the workflow's `owner` (prototype hard-codes "Procurement operations"; §20 D9).
9. `people = [paused ? '—' : p]`.

Never: approve automatically because nobody is eligible; let the worker approve; let a delegate take a specialist decision they are not eligible for.

### 6.8 Approval groups

1. Group text = `` `${g.n}: ${g.mode === 'all' ? 'all of ' : 'any one of '}${members.join(', ')}` `` where `members` = group members minus the requester minus anyone away; if that leaves nobody, use all members. Display (§11.5) drops the repeated group name: "Finance controllers (any one of Chloe Martin, Lena Fischer, David Okafor)" (§20 D11).
2. Group items have class 3 and no self-approval, limit or delegate checks. They merge (§6.10) only with an item for the same group (same text).
3. Runtime: `any` → the first member to act decides; `all` → every listed member must approve.

### 6.9 Approval rules

Order of work: build rounds (§6.5) → add approval-rule items and tasks into the rounds (§7.2) → resolve people for every item, rule items included (§6.7–§6.8) → merge (§6.10). Resolution and merging go round by round, in round order.

### 6.10 One person, asked once (merging)

Go through stages in order and items in order, keeping `seen: Map<person|class, item>`:
1. Skip "any one" items and paused items (they stay as they are).
2. `key = person + '|' + cls`.
3. If `seen` has `key` (`k` = the earlier item): if `k.roles` and `k.also` do not include this item's role → `k.also.push(role)` and add note ok to `k`: "{p} also covers {Role}{laterStep}. Same kind of decision, so one approval" where `{laterStep}` = " (a later step)" when the earlier item is in an earlier stage. Remove this item. (If the role is already covered, remove it silently.)
   Example: "Alan Brooks also covers Cost center owner. Same kind of decision, so one approval".
4. Else, if another seen item has the same person with a different class → note info on this item: "{p} also gives the {CLASS_N[other]}. This is {a/an} {CLASS_N[this]}, a different decision, so they’re asked separately" ("an" before "executive sign-off"; §20 D12). Keep it; `seen.set(key, item)`.
5. After merging, rule tasks get `person = resolveRoleHolder(task.role, rec0).person`.
6. Drop stages with no items and no tasks. `stages.length` is the number of approval rounds.

### 6.11 Rejection, stop, auto

1. `rejected` per §4. When rejected, remove every stage whose items are all rule items (rule approvers are not asked when the request is rejected before anyone is asked), and do not show the "Approval rules add approvers" bit.
2. `stopped` (production, §16.4): same handling as rejected.
3. `auto = stages.length === 0 && policies.length > 0 && needInfo.length === 0 && !rejected && no Approve step on the path has empty roles` (§20 D6).
4. `paused` = any item paused.
5. `needInfo` = for each walk Needs-information hit: `{nodeId, fields: labels, owner}` (§2.4).

### 6.12 Checks and brief

Every item gets `checks` = `checkResult` of every check step on the walk (`{d, ok, m}`) and the walk reason `why`. These feed the approver brief (§6.13). They are not printed in Test.

### 6.13 Approver brief — `briefFor(item, plan, rec0, wf, ctx): string`

The brief is the text every approver, escalation decider and failed-check decider receives (inbox card, item page, "Approval needed" email; 05 §5.3, §7). It is plain text: the lines below, in this order, joined with "\n"; a line whose condition is false is left out. `{step}` = `title(nodes[item.nodeId])`, or the rule name for a rule-only round.

1. **Header** (always): "{step}: {record title} ({record id})".
2. **What's asked** (always), one of:
   - one-role item: "What’s asked: approve as {Role name}{with}." where `{with}` = ", together with {the other people in this round, joined ', '}" when the step's mode is `all` and the round has other people; " (step {i} of {n})" for an in-order step; else "".
   - "any one" item: "What’s asked: approve as one of {Role names joined ' or '}. The first answer counts."
   - group item: "What’s asked: approve for {group name}. {Everyone in the group approves. | Any one of the group is enough.}"
   - escalation step (`escalation: true`): "What’s asked: decide. Approve to carry on, reject with a comment to stop, or send it back to the requester."
   - failed-check decision (Collect & verify "Ask people to decide"): "What’s asked: decide whether to carry on after “{collect step title}” failed. Approve to carry on, reject to stop."
3. **Why it's on the path**: "Why it’s here: {item.why}." when `item.why` is set and the item is not from a rule.
4. **Rule**: "Added by the company-wide rule “{rule name}”: {conditionText(rule.when)}." when `item.ruleId` is set.
5. **What changed** (change events only, i.e. `rec0.prev` exists): "What changed: {changes}." where `{changes}` lists every field of `rec0.prev` whose value differs from `rec0`, in `FIELDS` order, as "{Field label} {old} → {new}" joined "; " (money with `fmt`, pct as "{v}%", bool as "yes"/"no", list values with "_" replaced by a space and joined ", ", other values as stored). When nothing differs: "What changed: nothing in the fields Levv compares." When the workflow compares a change amount or running total (§6.2), add the line "{Basis.m}." after it.
6. **Checks**: "Checks: {results}." when the walk has check steps, `{results}` = for each in walk order "{DW name} {passed | flagged}: {m}" joined "; ".
7. **Flags**: "Marked: {field labels joined ', '}." when `plan.flags` is not empty.
8. **On behalf of**: when the person stands in for someone else, "On behalf of {Role name} ({person they cover})." (delegate or role backup, §6.7 B7), or "On behalf of {named person}." (named person's backup, §20 D8). This also fills `WorkItem.onBehalfOf`.

Example (Work order submitted × WO-2214, Hiring manager item):
"Business sign-off: Senior cloud engineer (WO-2214)\nWhat’s asked: approve as Hiring manager, together with Alan Brooks, Ravi Kumar, Fatima Zahra.\nWhy it’s here: Duplicate & ghost worker: No duplicate worker or leftover access found.\nChecks: Budget check passed: $120K left in plan after this request; Duplicate & ghost worker passed: No duplicate worker or leftover access found."
The Information Security item of the same round (added by the rule) has, instead of the "Why" line, "Added by the company-wide rule “Client data access”: Client data access is yes or Vendor’s digital worker has system access is yes." and ends with "On behalf of Information Security (Kenji Watanabe)."

---

## 7. Approval rules (company-wide, read-only here)

### 7.1 Matching

A rule applies to a run when: `status === 'live'`, `rule.records.includes(rec0.record)`, `rule.event === rec0.event`, and `evalCondition(rule.when, rec0)`.

Seed caveat: all three rules use event `submitted`. SOWs now start on `created`, so "Client data access" never matches a new SOW (SOW-77 has `digital_worker_access: true` but gets no Security/Privacy approvers). This is a data issue in the rules, not an engine rule; the admin area must offer `created` for SOW and job postings (§20 D2). Do not special-case it in the engine.

### 7.2 What a matching rule adds

Skip all rules when the walk hit Needs information. For each matching rule, in rule order:
1. Approvers (`act.approve`): one item per role in `act.roles` that is not in `prevRoles` (§6.4); if `act.mode === 'any'` and 2+ remain → a single "any one" item with all of them. Items carry `ruleId`, `nodeId: null`, `why: 'Company-wide rule: ' + conditionText(rule.when)`.
2. Task (`act.task`): `{ruleId, title: act.taskTitle || 'Task', role: act.taskRole}` — must be done before the request is approved.
3. Flag (`act.flag`): push `{field: act.flagField, ruleId}`; the field is set to yes on the record ("Marked: Registration required (later steps can react to this)").
4. If the rule added no items and no task → nothing more (a flag-only rule is still listed in `rules`).
5. Placement by `act.position`:
   - `'first'` → new stage at the start, label = rule name.
   - `'last'`, or there are no stages yet → new stage at the end, label = rule name.
   - `'with'` (all seeds) → the first stage that is not made only of escalation items; append items and tasks; label += `' + ' + rule.name`. So rule approvers join "Business sign-off", not the duplicate escalation before it.
6. All matching rules go into `plan.rules` (the summary names them even if a rule only adds a task, e.g. IR35).

### 7.3 Display

- Summary bit: "Approval rules add approvers: {names joined ', '}" (hidden when rejected).
- Rule approvers appear inside the round of the step they joined (Business sign-off).
- Rule tasks appear under that step as extra lines "Task: {title} · {Role} ({person}). Must be done before the request is approved" (§20 D5; the prototype does not show them in workflow Test).
- A rule-only round (no Approve step on the path) is shown in a block titled "From approval rules" above the step list, one line per round in the round-line format (§11.5) (§20 D5).

---

## 8. Change requests

### 8.1 Only what changed is re-asked

See §6.4–§6.5. An Approve step's role is skipped when it approved the previous version and none of the step's `material` fields is in `changed_fields`. Test shows NOT ASKED AGAIN with "{Role}: approved the original; nothing they depend on changed".

`material` keys map to record changes: `total_value`, `end_date`, `bill_rate`, `cost_center`, `scope` are matched against `changed_fields` directly; `data_access` and `supplier` match when the change diff includes those fields (production computes `changed_fields` from the previous approved version).

### 8.2 Running totals

See §6.2. The Σ line is shown under the summary.

### 8.3 Conflicting proposals

When a record has two pending proposals for the same field (`conflict`):
1. Approvals wait; nothing is overwritten.
2. Summary is replaced by: "Nothing is approved yet: approvals wait until one of the two proposed changes is chosen."
3. Conflict box: "Conflict" tag, then "Two proposed changes to the {field lower-case}: {a.v} from {a.by} and {b.v} from {b.by}. Nothing is overwritten; approvals wait until one version is chosen." Buttons "Use {a.v}" and "Use {b.v}".
4. After choosing: line "✓ Using {v} from {by}. {other.by} has been told, and approval links for the other version no longer work." with an "Undo" button; the record is simulated with the chosen proposal (`total_value = proposal.total`; production also applies the proposed field value and recomputes derived fields, §20 D13); the summary is computed normally.
ASN-920: "Two proposed changes to the bill rate: $96/h from Grace Kim and $102/h from Raj Patel. …"

### 8.4 Edits during approval (`reaskOnDecrease`) — runtime and "Try an edit"

When the record is edited while approvals are running:
1. Re-plan with the edited record (`p1`); keep the plan before the edit (`p0`) and the set of roles that already approved (`decided`).
2. For each item in `p1` with role `k`:
   - `k` approved already: let `changedMat` = the step's `material` ∩ fields changed by the edit. Empty → status "Approved" (stands). Every changed one went down and the step has `reaskOnDecrease === false` → "Stands". Otherwise → "Asked again".
   - not approved yet: in `p0` → "Waiting"; not in `p0` → "New".
3. Items in `p0` whose role is no longer in `p1` → "Removed by the edit": "{Role}: approved, no longer needed" if approved, else "{Role}: withdrawn, approver told".
4. Test: samples with `edit` show a button "Try an edit: {edit.label}" (toggles to "Undo the edit"). With `decided`, each round item shows its status after the person ("Cost center owner (Lena Fischer): Stands"), and the "Removed by the edit" lines follow the step list. For the demo, the changed fields are `edit.decreased` and all of them went down. (§20 D7: v35 recomputes the plan on edit but does not show these statuses.)
   ASN-881 edited: Tenure review leaves the path (months 17); removed: "HR business partner: approved, no longer needed", "Legal: withdrawn, approver told"; Budget owner "Stands"; Finance sign-off "Waiting"; Rate review "Waiting"; summary "3 approval rounds on this path."

---

## 9. Auto-approve and Fits plan?

- **Fits plan?**: inside when `(budget_left_after ?? 0) >= 0` (production: the plan service answers). Test: ok "Inside the plan" · "Fits the budget Finance approved", or ok "Outside the plan" · "Outside the approved budget, so it goes to an approver". The Outside exit leads to an Approve step ("If outside the plan, send it to" picks its role: cco, dh, hm_mgr, fbp or vpf).
- **Auto-approve**: approves when nobody is asked anywhere on the path (`plan.auto`, §6.11). Test: ok "Approved automatically" · `{receipt}` (or "Approved automatically" if blank); otherwise ok "Not used" · "Someone approves on this path, so it doesn’t auto-approve". The receipt is stored on the run for audit; `fyi` is notified.
  JP-5120: "Approved automatically: fits the approved plan". TS-9934: "Approved automatically: hours match the schedule and work order".

---

## 10. Test simulation — `simulateTest(wf, sample, ctx, opts): TestRun`

`opts` is `TestRunOptions` (DM §12.1): `{applyEdit?: boolean, conflictChoice?: 'a' | 'b', asOf?: string}`.

### 10.1 Record

1. `rec = {...sample}`; if `opts.applyEdit && sample.edit` → `{...rec, ...sample.edit.set}`; if `sample.conflict && opts.conflictChoice` → `rec.total_value = sample.conflict[opts.conflictChoice].total`. `opts.asOf` replaces `ctx.asOf` for this run.
2. `plan = planApprovals(wf, rec)` when §6 applies, else `null`. The walk is `plan.walk` (or `walkWorkflow(nodes, applyBasis-adjusted rec)` when there is no plan).

### 10.2 Simulated outcomes (where results come from)

| What | Test (prototype) source | Production source |
| --- | --- | --- |
| If paths | record fields | record fields (Levv-calculated fields from Digital Workers) |
| Check results | `checkResult` (§5) on `rate_vs_card_pct`, `rate_vs_market_pct`, `budget_left_after`, `duplicate_found`, `months_engaged_after` | Digital Worker services |
| Fits plan? | `budget_left_after` | plan / budget service |
| Collect & verify | `sample.outcomes[nodeId]` or `sample.outcomesL[label]`: `'fail'`, `'unsure'`; else verified | verification provider callbacks (Persona, Checkr, e-signature…) and reviewers |
| Task | same keys, `'done'`; else to do | the assignee marks it done |
| System | always succeeds | connector response; failures follow `onFail` |
| Approvals | never decided (all waiting) | approvers' decisions |
| Conflict | `sample.conflict` | concurrent change proposals on the record |
| Edit | `sample.edit`, `sample.decided` | record update events during a run |
| Previous version | `sample.prev`, `changed_fields`, `original_total` | the last approved version of the record and its diff |
| People, limits, absences, groups | people-and-authority.json, with `asOf` | the people admin area |

### 10.3 Per-step results (every visited step except trigger, cond, parallel, end)

`o = sample.outcomes?.[id] ?? sample.outcomesL?.[title(n)]`.

**Digital Worker**: check → ok "Passed" / review "Flagged", m = `checkResult.m`. Helper → ok "Done", m = `DWX[w].d ?? DWD[w]`.

**Approve**: from the plan (§10.4).

**Auto-approve / Fits plan?**: §9.

**Collect & verify** — `ask` = `` `Asked of ${personLabel(from ?? 'worker', rec)}: ${items.join(', ') || 'nothing listed yet'}` ``. Then:
1. `o === 'fail'`:
   - `failTo 'approval'` with `failRoles` → fail "Failed: decision needed", m = `` `${ask}. Failed. ${failRoles.map(roleName).join(' and ')} must decide whether to carry on` ``; rounds from a mini plan: one Approve step `{roles: failRoles, mode: failMode}` planned with §6.5–§6.10 (no rules). WO-2251-A: "Failed. HR business partner and Legal must decide whether to carry on" with round "HR business partner (Erin Walsh), Legal (Luis Romero) · Hannah Brooks is out until Oct 24. Delegated to Luis Romero". (Prototype drops the "Asked of" prefix in this one case; §20 D17.)
   - `failTo 'approval'` with no `failRoles` → fail "Failed: decision needed", m = `ask + '. Failed. Nobody is set to decide yet'` (lint blocks publishing this).
   - `failTo 'role'` → fail "Failed: escalated", m = `` `${ask}. Failed. Escalated to ${personLabel(failRole, rec)}: they approve to carry on, reject with a comment, or send it back` ``. The walk then visits the generated escalation (`failNode`), which is planned like any Approve step and shows ESCALATED with its round and Chaser line (§10.4); its single role may be an operational role (People Ops, IT, AP).
2. `verify 'person'` → review `` `Review: ${roleName(reviewer)}` ``, m = `` `${ask}. Waiting for ${personLabel(reviewer, rec)}` ``.
3. `verify 'auto_person'` and `o === 'unsure'` → review `` `Unsure: ${roleName(reviewer)}` ``, m = `` `${ask}. ${CHECKERS[checker]} wasn’t sure, so ${personLabel(reviewer, rec)} reviews` ``.
4. else → ok "Verified automatically", m = `` `${ask}. Verified by ${CHECKERS[checker]}` ``.

`sees` ("Worker sees: …"): ok → "Done"; fail → "In progress"; wait → "Not started yet"; else `verify === 'auto'` ? "In progress" : "Waiting for review".

**Task**: `o === 'done'` → ok "Done", m `` `${title}: done by ${personLabel(role, rec)}` ``; else review `` `To do: ${roleName(role)}` ``, m `` `${title}: ${personLabel(role, rec)}` ``. ("Confirm handover is done: Hiring manager (Tom Reed)")

**System**: ok `` `Done in ${system}` ``, m = `sysSentence(n)` + (`via` ? `` `. Done by the ${DW[via].n} Digital Worker` `` : '') + (`gives` ? `` `. Ledger: ${gives} (${DISP[dispOf(n)].toLowerCase()} at exit)` `` : ''). Not connected (`st 'off'`): review "Paused: not connected", m = the not-connected sentence (§20 D18; prototype shows "Done in Coupa").
Example: "Create access request in ServiceNow, matched on Work email, 4 fields sent; waits up to 24h for ServiceNow to confirm; then checks it matches the ledger. Done by the Access provisioner Digital Worker. Ledger: System access (remove access at exit)".

**Notify**: recipients non-empty → ok "Sent", m `` `${channel || 'Email'} to ${recipients.map(r => personLabel(r, rec)).join(', ')}` `` ("Email to Worker (Jordan Ellis), Sponsor (Grace Kim, or their delegate Raj Patel)"); none → ok "No one to tell", m "Pick who to tell". (Not overwritten when the step is Waiting.)

**Wait**: ok "Waits", m = `waitText(w, true)`.

**Run workflow**: ok "Started", m `` `Starts “${target name}”` `` (§20 D19).

**Generated "tell them it stopped" Notify**: as Notify.

### 10.4 Approve steps from the plan

For an Approve step `n` on the walk:
1. `sts` = stages that contain an item with `nodeId === n.id`.
2. If `roles` is empty → fail "Choose who approves", m "Pick who approves this step. Nothing is approved automatically" (§20 D6).
3. Else if `sts` non-empty:
   - any item in those stages paused → fail "Paused", m "Nobody eligible right now, so it waits until someone is assigned. Nothing is approved automatically".
   - `n.escalation` → review "Escalated", m "They must approve (it carries on), reject with a comment (it stops), or send it back to the requester".
   - else review "Approval", m = (`n.roles.length > 1` ? `{all:'Together', any:'Any one', order:'In order'}[mode] + '. '` : '') + "If rejected: " + `{requester:'back to the requester to fix', previous:'back one step', end:'the request is rejected'}[reject]`.
   - `rounds` = one line per stage in `sts` (§11.5).
4. Else if `notNeeded` has this node → ok "Not needed", m = capitalised `m` ("Only needed when Bill rate change (%) > 5%").
5. Else if `skipped` has entries for this node → ok "Not asked again", m = entries `` `${roleName(role)}: ${m}` `` joined "; " ("Procurement: approved the original; nothing they depend on changed").
6. Else → ok "Covered", m "The same person already approves this kind of decision on this path".
7. **Chaser line**: when `st === 'review'` (Approval or Escalated, never Paused) append `` `. Chaser reminds after ${remind}h and escalates to ${chaseTo(n)} after ${sla}h` `` ("… If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h").

### 10.5 Holding the line (Waiting)

Every step on the line must be done before the line moves on. Compute after §10.3–§10.4:
1. `preds[id]` = nodes with an out to `id`.
2. A node **blocks** when its result is `wait`, or its kind is collect, task or system and its result is `review` or `fail`.
   Approve, Auto-approve, Fits plan? and checks never block in Test: Test shows the rest of the path as if every approval were given (§20 D3).
   Approve, Auto-approve and Fits plan? also keep their own result (they are never shown as Waiting), as in the prototype.
3. Process visited nodes in topological order of the visited sub-graph until nothing changes:
   - structural nodes (cond, parallel, end): if any visited predecessor blocks → mark this node `wait` (no text).
   - other nodes: if any visited predecessor blocks and this node's result is not `fail` → result = wait "Waiting", m = "Waiting on " + `blockers(node).join(', ')`.
   - `blockers(node)`: for each visited predecessor `p` (in `outs`/walk order) that blocks: if `p` is structural (cond, parallel, end) → `blockers(p)` (recursively); else `title(p)`. Remove duplicates, keep order. (Prototype names the structural step itself, e.g. "Waiting on Registration required?"; build "Waiting on Background check" — §20 D4.)
   - Collect & verify keeps its `ask` prefix: "Asked of the worker: Bank details, Tax forms. Waiting on Wait for start date".
4. A branch that goes straight to End blocks nothing (onboarding "Vendor insurance" and "Laptop and badge" → END).

---

## 11. Test panel composition — `composeTest(run, ctx): TestRunResult` (DM §12.1; `TestView` = `TestRunResult`)

Order inside the panel:

1. **Inactive note** when `wf.status === 'inactive'`, always first: "This workflow is inactive. Real requests don’t use it. Below is what it would do if you turned it back on."
2. **Summary line** (only when `plan` exists) — §11.1.
3. **Extra lines** (only when `plan` exists): Σ basis line; conflict box or chosen line (§8.3); flags line "⚑ Marked: {field labels joined ', '} (later steps can react to this)" (hidden when rejected, §20 D20); the "For real requests, “{winner}” runs for this record." notice (§3.4); then the "Try an edit: …" / "Undo the edit" button.
4. **Try a record**: a single-select list of radio rows (04-ui §8.2, `role="radio"`), one for every sample with `record === wf.records[0]` and `event === wf.event`, in file order, titled `title.replace(' (approved)', '')`. If the selected sample does not fit, select the first that does. None → "No sample records for this trigger yet."
5. **Decision chips**: one per walk decision, "{If/plan/check title} → {label}" ("Rate over card? → Over 10%", "Within plan? → Outside plan", "Duplicate & ghost worker → Flagged", "Rate over card? → Needs information").
6. **"From approval rules"** block (rule-only rounds, §7.3).
7. **Steps**: each visited step except trigger, cond, parallel, end, in walk order: title, status label, then "· {m}" if `m`, then "👁 Worker sees: {sees}" (Collect & verify only), then round lines numbered 1, 2, …, then rule-task lines (§7.3).
8. **Removed by the edit** block (§8.4).

The canvas highlights `walk.path` (visited nodes and taken edges); each box shows its status label instead of its subtitle.

### 11.1 Summary line

`bits` in this order:
1. `n = plan.stages.length`: n > 0 → `` `${n} approval round${n > 1 ? 's' : ''} on this path` ``; else "No one needs to approve on this path".
2. `plan.rules.length && !rejected && !stopped` → "Approval rules add approvers: " + rule names joined ", ".
3. Each Needs information → the §2.4 message.
4. `plan.auto` → "Approved automatically. No one had to act".
5. `rejected` → `` `Rejected at “${by}”. It goes back to the requester with the reason` `` + (recipients ? `` `; Levv tells ${recipients.map(roleName).join(', ')}` `` : ''), recipients = `wf.onReject.recipients`.
6. `stopped` → `` `Stopped at “${by}”. Levv tells ${told.join(', ')}` `` (§16.4).
7. `plan.paused` → "Part of the approval is paused: nobody eligible, so it waits until someone eligible is assigned".
8. Unresolved conflict → replace all bits with "Nothing is approved yet: approvals wait until one of the two proposed changes is chosen".

Summary = `bits.join('. ') + '.'`. Bold (display only): rule names, "Needs information", "Approved automatically", "Rejected at “…”", "Part of the approval is paused".

Examples: "3 approval rounds on this path. Approval rules add approvers: Client data access, UK off-payroll (IR35)." · "No one needs to approve on this path. Rejected at “Duplicate & ghost worker”. It goes back to the requester with the reason; Levv tells Hiring manager." · "1 approval round on this path. Rejected at “Rate over card?”. It goes back to the requester with the reason; Levv tells Hiring manager." · "No one needs to approve on this path. Approved automatically. No one had to act."

### 11.2 Status colours

`ok` green, `fail` red, `review` and `wait` amber.

### 11.3 Workflows without a plan

When `plan` is null (no Approve or Auto-approve step and no matching approval rule): no summary, no extra lines; the panel starts with the inactive note (if any) and "Try a record".

### 11.4 Inactive workflows

Test works the same, with the inactive note.

### 11.5 Round lines

For a stage: items joined ", ", each item `rn === pp ? rn : `${rn} (${pp})`` (followed by `: {status}` when the record has `decided`, §8.4 — e.g. "HR business partner (Erin Walsh): Approved, Legal (Luis Romero): Waiting") with `rn = roles.map(roleName).join(' or ')` and `pp = people.join(', ')`; then, if any item has notes, `' · '` + all notes' `m` (item order, note order) joined "; ".
Examples: "Hiring manager's manager (Alan Brooks), Information Security (Ravi Kumar), Privacy (Fatima Zahra) · Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK); Alan Brooks also covers Cost center owner. Same kind of decision, so one approval; Kenji Watanabe is out until Oct 30. …" · "Chloe Martin" (named person: role name equals the person) · "Hiring manager or Cost center owner or Department head (Raj Patel, Nadia Rahman)" (any one) · "Privacy (—) · Paused: no eligible Privacy reviewer for Germany. It waits until someone eligible is assigned (owner: Procurement operations). No one unqualified stands in".

---

## 12. Nova checks (lint) — `lintWorkflow(wf, ctx): LintResult`

### 12.1 Record count

`recs` = number of history records with `records.includes(h.record)`, `h.event === wf.event` and `scopeMatch(wf.scope, h)`. (It does not subtract records a narrower workflow would take; "Work order submitted" counts 140, "UK Technology work orders" 16, "Data and AI hires" 26.)

Nova panel header: `recs > 0` → "Nova checked this flow against {recs} real records from the last 90 days."; else "No past records would have reached this flow. Nova checked the design only."
No issues → a box "Looks good" / "Nothing to fix."
Each issue shows its label ("Fix before publishing" for bad, "Check" for warn, "Suggestion" for tip, none for info), the message, and buttons: "✦ {fl}" when it has a fix, "Show me" when it names a step (selects it and scrolls to it), "Choose which wins" when it is an overlap (opens Publish).
The ✦ Nova button shows the count of bad + warn issues (grey when 0).

### 12.2 Rules (exact messages), in output order

Per-node rules iterate `draft.nodes` in stored key order. `{t}` = `title(node)`.

| # | When | Sev | Message | Fix |
| --- | --- | --- | --- | --- |
| L1 | Collect & verify with no items | warn | "“{t}” doesn’t ask for anything yet." | — |
| L2 | any step with `gives` but no `reverse` | bad | "“{t}” gives {gives} but has no reverse step, so offboarding would leave it behind." | `rev:` "Add a reverse step" → `reverse = 'Remove ' + gives`; toast "Added reverse step “{reverse}”" |
| L3 | System, no `gives`, system is Workday, ServiceNow, Okta or Microsoft Entra ID, action `create`, label not matching `/payroll\|sync\|run/i` | tip | "“{t}” creates something in {system} that isn’t in the ledger, so offboarding won’t know to remove it." | `gr:` "Record it in the ledger" → `gives = system + ' account'`, `reverse = 'Close ' + system + ' account'`; toast "Recorded in the ledger, with a reverse step" |
| L4 | If or Fits plan? with 2+ outs that all go to the same step | warn | "“{t}” sends every path to the same place, so it does nothing yet." | — |
| L5 | Run workflow whose target workflow has a Run workflow step that starts this one | bad | "“{t}” starts “{target name}”, which starts this workflow again. They would start each other forever." | — |
| L6 | (once) any step gives something and no workflow has record `offboarding` | warn | "Things are given to workers, but there is no Offboarding workflow to take them back." | — |
| L7 | Approve with `who === 'person'`, a person chosen, and no backup | warn | "“{t}” names {person} with no backup. If they’re away, it pauses." | — |
| L8 | System whose system has `st 'off'` | warn | "“{t}” uses {system}, which isn’t connected yet. It will give the work to a person until it is." | — |
| L9 | Notify with no recipients | warn | "“{t}” doesn’t tell anyone yet." | — |
| L10 | If path (not Otherwise) with no rows | warn | "Path “{path label}” in “{t}” has no conditions, so it matches everything." — when it is not the last path, insert before the full stop: " and the paths below it never run" | — |
| L11 | Approve with no roles | bad | "“{t}” doesn’t say who approves yet." | — |
| L12 | Collect & verify with `failTo 'approval'` and no `failRoles` | bad | "“{t}” doesn’t say who decides when it fails." | — |
| L13 | (production) a node not reachable from `T` (other than `END`) | warn | "“{t}” can’t be reached from Start, so it never runs." | — |
| L14 | (production) overlap with another live workflow (§13.3) | bad if both priorities are null, else info | bad: "Overlaps with “{name}” on {count} past records ({scopeText(this)} and {scopeText(other)}). Set which one wins before publishing." · info: "Overlaps with “{name}” on {count} past records ({scopeText(this)} and {scopeText(other)}). Priority decides which runs." | `overlap` → "Choose which wins" |
| L15 | (production) `worker` used as an approver (roles, path/flag/else `who` for approve or escalate), decider (`failRoles`, `failRole`) or reviewer | bad | "“{t}” asks the worker to approve or decide. The worker can’t approve, review or be escalated to." | — |
| L16 | (production) Run workflow with no or unknown target | bad | "“{t}” doesn’t say which workflow to start." | — |
| L17 | (production) Wait with `mode 'at'` and no `at` | warn | "“{t}” doesn’t have a date and time yet." | — |
| L18 | Approve (including generated escalations), Task or Collect & verify where `chaseDefaults(n).sla <= chaseDefaults(n).remind` | bad | "“{t}”: escalation has to come after the reminder." | — |

Examples: A19 "“Rate review” names Chloe Martin with no backup. If they’re away, it pauses." · I12 "Path “Off-payroll” in “Over $500K?” has no conditions, so it matches everything." · P4 "“Approval” doesn’t say who approves yet."

With the seed every workflow has no issues (Nova count 0), except "Data and AI hires" which gets L14 (bad) in production.

---

## 13. Publish — `publishReview(wf, ctx, precedence?): PublishReview` and actions

### 13.1 Panel

Title: "Publish “{name}”".
1. Impact: "Applies to new runs. **{recs}** records in the last 90 days would have started this workflow. Anything already running keeps its current version." (`recs` from §12.1; use "record" when it is 1.)
2. Must fix: each bad issue (except L14, which is handled by step 3) as "× {message}".
3. Overlaps: for each overlap (§13.3): "This overlaps “{other name}” on {count} records. Which one should run?" and a dropdown (placeholder "Choose…") with two options: this workflow's name and the other's name.
4. When there is nothing to fix and no undecided overlap: "✓ Ready to send for approval."
5. "Goes live on": a date. Default: `wf.effective` if it is today or later, otherwise today (`ctx.asOf`). A date before today shows the inline error "Pick today or a later date." and disables Send for approval.
6. Buttons: "Cancel" and "Send for approval" (disabled while there is anything to fix, an undecided overlap, or an invalid "Goes live on" date).
7. If `ctx.approverAvailability.othersCanApprove` is false (the server computes it for the author: no other user holds `flow.approve_changes` or `admin`; DM §0.1), add the must-fix issue `{sev: 'bad', m: "Nobody else can approve flow changes yet. Ask an admin to give someone the “Approve flow changes” permission."}` (no `node`; Send for approval disabled).

P5 (Data and AI hires): "Applies to new runs. 26 records in the last 90 days would have started this workflow. Anything already running keeps its current version." · "This overlaps “UK Technology work orders” on 2 records. Which one should run?".
P6 (Site access request): "Applies to new runs. 0 records in the last 90 days would have started this workflow. Anything already running keeps its current version." · "✓ Ready to send for approval." · "Goes live on" 2026-10-20 (its effective date 2026-10-01 is in the past).
P4 (new workflow with an empty Approve step): impact 140 · "× “Approval” doesn’t say who approves yet." · Send for approval disabled.

### 13.2 Must-fix

`mustFix` = lint issues with `sev === 'bad'` excluding overlaps, followed by the §13.1 item 7 issue when it applies. Warnings never block (a named person without a backup is a warning).

### 13.3 Overlaps — `findOverlaps(wf, ctx): Overlap[]`

For every other workflow `g` with `g.status === 'live'`, `g.event === wf.event`, a record type in common, and neither scope strictly inside the other (`!strictlyInside(wf.scope, g.scope) && !strictlyInside(g.scope, wf.scope)`; identical scopes count — §20 D24):
`count` = history records matching `wf.records`/`wf.event` and both `scopeMatch(wf.scope, h)` and `scopeMatch(g.scope, h)`. Keep `count > 0`.
Data and AI hires vs UK Technology work orders: count 2. No other seed pair overlaps (every variation sits inside "Work order submitted").

Identical Applies to (e.g. two "Everywhere" workflows on the same record and event) counts as an overlap, and Publish asks which one runs.

Choosing: the choice is stored in the publish panel and then on `pending.precedence` (`{otherId, winner: 'self' | 'other'}`). Nothing changes on either workflow until the second person approves (§13.5). The option shown as chosen: the stored choice if any; else this one when `wf.priority != null && (g.priority == null || wf.priority < g.priority)`, the other symmetrically. An overlap is **undecided** while both priorities are `null` and no choice has been made in this panel (`precedence` argument); undecided overlaps are returned in `openOverlaps` and disable "Send for approval".

### 13.4 Send for approval

1. `wf.pending = {submittedBy: author, submittedAt: now, effective: chosen date, precedence: overlap choices}`. (`wf.effective` is set from it on approval.)
2. Panel: "Sent for approval. Anyone with the “Approve flow changes” permission can approve it. You can’t approve your own change." One button "Close". The request goes to every such user; the first to act decides.
3. Top bar status: "Waiting for approval".
4. Approver: any user with the "Approve flow changes" permission who is not `pending.submittedBy`; `canApprove(user, pending) = user.permissions.includes('flow.approve_changes') && user.id !== pending.submittedBy` (permission key from 01 §6.1; its label is "Approve flow changes"). The author never sees an approve action on their own change. (Ignore the prototype's hard-coded "Samira Khan" and its demo button.)

### 13.5 Approved by the second person

1. `version = version + 1`. A never-published draft has version 0, so its first publish is version 1 (top bar "Live v1"); each later publish adds 1.
   Apply `pending.precedence` now: winner 'self' → `wf.priority = 1`, other `g.priority = 2`; winner 'other' → `g.priority = 1`, `wf.priority = 2`. `wf.effective = pending.effective`.
2. `status` stays `'inactive'` if it was inactive, otherwise becomes `'live'`.
3. `published = {nodes: deepCopy(draft.nodes), scope, name}`; append a `WorkflowVersion` with `effective`, `publishedAt`, `submittedBy`, `approvedBy` (the approving user, never the author).
4. `pending = null`. Toast: "Published as v{version}, live on {date}" with the date formatted `d MMM yyyy` ("Published as v1, live on 20 Oct 2026"). The approver usually acts elsewhere (the inbox), so the toast is shown to the **author**: the first time the author loads that workflow after the approval, show it once and set the request's `authorNotifiedAt` (DM §14 `PublishRequest`; 01 §5.1). A user who approves inside the same page sees it at once.
5. New runs started on or after `effective` use the new version; runs already going keep the version they pinned. Until `effective`, the previous version (if any) keeps starting new runs.

### 13.6 Status texts (top bar, after the name)

- `pending` → "Waiting for approval"
- inactive → "Inactive · v{version}"
- draft → "Draft"
- live with unpublished changes → "Live v{version} · unpublished changes"
- live → "Live v{version}"
Picker rows show "Inactive · " before the Applies-to text when inactive. Status dot: off (inactive), draft (draft or pending), dirty (unpublished changes), live.

---

## 14. Active / inactive

1. Workflows are never deleted; there is no delete anywhere for workflows or rules. Steps can be deleted from the draft.
2. First box (workflow settings) shows:
   - draft: "Draft" — "Publish it to make it active." (no switch)
   - live: switch on, "Active" — "New events start this workflow."
   - inactive: switch off, "Inactive" — "Nothing new uses this workflow. Anything already running finishes on it. Turn it back on any time."
3. Extra warning when inactive and the workflow has an Approve or Auto-approve step and no other live workflow with the same event and a common record type has an empty Applies to: "No other active workflow covers every {record}, so new {records} that only this one covers won’t start or be approved until one is active. Nothing is approved automatically." `{record}` = record label lower-case ("job posting"), `{records}` = its plural ("job postings", "SOWs", "access requests"; §20 D29).
   P1: "No other active workflow covers every job posting, so new job postings that only this one covers won’t start or be approved until one is active. Nothing is approved automatically."
4. Switching: on → status `'live'`, toast "“{name}” is active again"; off → `'inactive'`, toast "“{name}” is inactive. It can’t be deleted, only turned back on". It takes effect immediately (no second-person approval) and does not change the version.
5. Inactive workflows are excluded from selection (§3) and from overlaps; Test still works with the inactive note (§11).

---

## 15. Runtime behaviour (production engine)

This section maps the simulated behaviour onto real runs. Screens for running workflows are specified in 05-runtime.md; the data is DM §14.

1. **Start.** On an event (from Levv or from the workflow's `source` system): `selectWorkflow` (§3). Pick the newest version whose `effective` ≤ today. Create a `WorkflowRun` with that version pinned, `status 'running'`, `recordSnapshot`.
2. **Built-in start condition.** `prereqFor(record, event)` (table below). If not `'none'` (and not onboarding `ob_start`), the prerequisite is met when its key is in the record's `states` array (DM §14 `BusinessRecord.states`; e.g. `'wo_approved'`); until then the run waits, and it is re-checked whenever the record changes. `states` arrives with the record's data (inbound events, record edits); Levv also adds `wo_approved` / `sow_approved` / `jp_approved` / `ts_approved` to a record when a run of its `submitted`, `changed`, `created` or `change_order` event ends `completed` with every Approve step approved; if it waits more than 7 days, the workflow owner is told. Workflow settings show: "🔒 Built in: Levv only starts this once the {PRE_SHORT}. Anything that arrives earlier waits, and the owner is told if it waits more than 7 days."
   | record\|event | prerequisite |
   | --- | --- |
   | work_order changed / approved / accepted | wo_approved ("work order is approved") |
   | onboarding (any event) | wo_approved |
   | offboarding off_start | active ("assignment has started") |
   | sow change_order / milestone / closed | sow_approved ("SOW is approved") |
   | invoice received | ts_approved ("timesheet or milestone is approved") |
   | assignment (any event) | cleared ("worker is cleared to start") |
   | timesheet, expense (any event) | active |
   | everything else | none |
3. **Plan.** Compute `planApprovals` at start; recompute when the record changes (§8.4) or a proposal is chosen (§8.3).
4. **Moving along the line.** A step starts when every visited predecessor on the taken path is done; a step where branches meet waits for every visited branch. A branch that ends on its own does not hold anything up. If steps evaluate when reached (with the record as it is then).
5. **Approve steps.** When reached: Not needed → skipped; Not asked again → done; Covered → completes with the decision of the item that covers it; otherwise ask the round's people (rule approvers join the first round on the path, §7.2). In-order steps ask one role after another. Any-one items complete with the first decision. Paused items wait until someone eligible is assigned; nothing is approved automatically.
   Decisions: approve; reject (a comment is required on escalations); send back to the requester. Reject behaviour per step: `requester` → back to the requester to fix and resubmit within `onReject.resubmitDays` (5) days, then the step asks again; if they don't resubmit in time, the rejection is final; `previous` → the previous person-step is asked again; `end` → the request is rejected. A final rejection ends the run `rejected` and tells `onReject.recipients` (new workflows default to Hiring manager; a seeded workflow without `onReject` tells nobody).
6. **Escalations** (Approve steps with `escalation: true`, generated from an If path, a check's Escalate, or a Collect & verify failure): they have ONE timer, their Chaser (`remind` default 24, `sla` default 48 — the "Escalate after (hours)" box in the If path card / check panel / Collect & verify "If it fails" edits this `sla`). At `sla` hours it goes to their manager. They must act — approve (it carries on), reject with a comment (it stops), or send it back to the requester (when it comes back the check or If runs again).
7. **Chaser** (Approve, Task, Collect & verify): when the step starts waiting on a person: `remindAt = start + remind h`, `escalateAt = start + sla h`. Remind the assignee at `remindAt`; at `escalateAt` escalate to `chaseTo` (their manager = `MGR[assignee]`; "the hiring manager" = the record's hiring manager). Reminders stop the moment someone acts. It is not a step and not a Digital Worker.
8. **Collect & verify.** Ask the provider for the items; the checker verifies; `auto_person` + unsure → the reviewer; `person` → the reviewer. Fail: `failTo 'role'` → escalate to `failRole`; `failTo 'approval'` → `failRoles` decide (approve = carry on, reject = stop). The worker can't start (onboarding) until a failed check is decided.
9. **System.** Call the connector; retry 3 times over an hour; with `wait 'confirm'` wait up to `waitH` hours for confirmation; then `onFail`: task to `failRole`, take the Failed exit, or pause the run (status `paused`, reason `system_failure`) and alert the owner. Read-back fields are saved on the record. `gives` writes a ledger line (with `disp`, `reverse`, `reverseWhen`, `reverseBy`) that offboarding closes.
10. **Wait.** Resolve the date (record date ± offset, at the time, in the time zone). If the record date changes, the wait moves with it.
11. **Notify / Task / Run workflow.** Send on the channel; create the task; start the target workflow (its own selection rules apply).
12. **Manual Pause / Resume / Stop** (any running workflow): Pause freezes timers and stops new steps from starting; Resume restarts them with remaining time; Stop cancels open steps and ends the run `stopped`. Covered in 05-runtime §4 and §6.
13. **Never**: approve automatically because nobody is eligible; let the worker approve, review or be escalated to; let a Digital Worker approve or reject; ask the same person twice for the same kind of decision on one path.

---

## 16. Graph editing operations (pure; used by the canvas and the step panel)

All operations take and return a new `nodes` map (or mutate a copy). After every operation that removes an out, run `gc` (16.8). They take node ids (not node objects). Operations that create ids or pseudo roles need the `EngineContext`; get them bound with `const ed = createEditor(ctx)` (`ed.insertStep(nodes, fromId, outKey, spec)` …). The canonical names and signatures are the ones in the headings and bullets below; 06 Part A.4 calls exactly these (bound to the test's context).

### 16.0 Deterministic ids — `ctx.idGen`

Every new id comes from one injectable, deterministic generator in the engine context (`EngineContext.idGen`, DM §0). It has **one counter shared by new workflow ids, node ids and added path and branch keys**:

```ts
export interface IdGen {
  next(kind: 'workflow' | 'node' | 'path' | 'branch'): string; // 'nf{n}' | 'n{n}' | 'p{n}' | 'b{n}', then n += 1
  reserve(ids: Iterable<string>): void;  // raises the counter above the number in any id matching /^(nf|n|p|b)(\d+)$/
}
export function createIdGen(start = 101): IdGen;
```

- **Start.** The counter starts at **101** for every fresh store or test context. So the first new workflow is `nf101`, and its first new steps are `n102`, `n103`, … (an added If path then gets `p104`, and so on).
- **Reserve before generating.** Every operation that creates ids first calls `ctx.idGen.reserve(...)` with all node ids and out keys of the `nodes` it is given; the editor (and the A.4 test harness) also reserves the open workflow's id; the store reserves every stored workflow id on load. Seed ids (`RA_A1`, `p1`, `b3` …) are below 101 or do not match, so they never move the counter. Example: `addPath` on the I5 graph (which contains `n102` and `n103`) returns key `p104` in a fresh context.
- **What uses the counter:** a new workflow (`nf{n}`); every node created by `insertStep`, `insertAfterMerge` or a preset (`n{n}`); a path added with "+ Add a path" (`p{n}`); a branch added with "+ Add a branch" (`b{n}`). A new If's first path is always `p1` and a new Parallel's branches are always `b1`, `b2` (DM §5.14).
- **Derived ids (no counter):** a path's generated step `{condId}_{outKey}` and its Stop End `{condId}_{outKey}_end` (16.4); a check's generated flag step `{dwId}f` and its Stop End **`{flag node id}_end`** (16.6); a Collect & verify escalation `{collectId}_fail` (16.12); a Fits plan? "Outside plan" step `{planId}x`; a System Failed-path task `{systemId}f` (16.11).
- Production persists the counter with the store (or reserves all existing ids on start-up), so ids stay unique across sessions. Tests never depend on anything but the rules above.

### 16.1 Insert a step on a line — `insertStep(nodes, fromId, outKey, spec)`

1. `out = nodes[fromId].outs.find(key === outKey)`; `next = out.to`.
2. Create the node (DM §5.14) with every out pointing to `next`; for an If set `mergeAt = next`; for Fits plan? also create its "Outside plan" Approve step.
3. `out.to = newId`. Select the new step.
4. If `fromId` is a Collect & verify with a `failNode` and `outKey === 'next'`, also set the `failNode`'s `next` to `newId` (the failure escalation always rejoins where the collect's line goes).

### 16.2 Where an If's paths meet — `computeMergeAt(nodes, condId)`

Used on load (and when `mergeAt` is missing):
1. Carrying-on outs = outs whose target is not an End with outcome `rejected`/`stopped` and whose stored `do` (`elseDo` for else) is not `reject`/`stop`.
2. For each, its start = if its target is its generated step (`node`/`elseNode`), that step's next (`approved` out or first out); else its target.
3. None → `'END'`. One → that start. Several → the nodes reachable from every start; pick the one with the smallest breadth-first distance from the If; none in common → the last start.
Keep the result in `cond.mergeAt`. Update it when: the merge step is deleted (→ the step it reconnected to, 16.7), a step is added "after the paths meet" (→ the new step, 16.10). Never recompute it from the current outs while editing paths (§20 D22).

### 16.3 What a path does — `pathMode(nodes, condId, outKey): PathThen`

1. `d` = `out.do` (or `cond.elseDo` for else); `g` = `out.node` (or `cond.elseNode`).
2. If `d` is set and not `'continue'`, `g` exists and `out.to === g` → `d`.
3. If `out.to` is an End with outcome `'rejected'` → `'reject'`.
4. If `out.to === cond.mergeAt` → `'continue'`.
5. Else → `'custom'` (the path has its own steps on the canvas). `laneSteps` = titles of nodes reachable from `out.to` that are not reachable from `mergeAt` and are not Ends.

### 16.4 Set a path's Then — `setPathThen(nodes, condId, outKey, mode, who?)`

1. Guard: if `mode` is `reject` or `stop` and no OTHER out has `pathMode` other than reject/stop → refuse with toast "At least one path has to carry on".
2. Delete the path's previous generated step (if any).
3. `who` = given, else the stored one (`out.who` / `cond.elseWho`), else default: approve `'proc'`, escalate `'cco'`, stop `'hm'`. Create pseudo roles for `g:`/`p:` keys.
4. `id = cond.id + '_' + out.key`, `lab = out.label || 'Otherwise'`, `sla` = the `sla` of the escalation node being replaced if there was one, else 48. (There is no separate escalation-hours field; the path card's "Escalate after (hours)" box edits `nodes[id].sla` directly.)
5. By mode:
   - `continue` → `out.to = cond.mergeAt`; no generated step.
   - `approve` / `escalate` → Approve step `{id, label: `${lab}: approval` | `${lab}: escalation`, roles: [who], who: group|person|roles by prefix, reject: 'requester', remind: 24, sla, escalation: mode === 'escalate'}` with out `next → mergeAt`; `out.to = id`.
   - `reject` → End `{id, label: 'Rejected', outcome: 'rejected'}`; `out.to = id`.
   - `stop` → Notify `{id, label: `${lab}: tell them it stopped`, recipients: [who], channel: 'Email'}` → End `{id: id + '_end', label: 'Stopped', outcome: 'stopped'}` (§20 D23; prototype points it to the normal END); `out.to = id`.
6. Store `do = mode`, `node = id | null`, `who` on the path (or `elseDo`, `elseNode`, `elseWho` on the If).
7. `gc`.

Canvas card rows ("Over 10% · carries on", "Otherwise · escalate · Finance controllers"): continue "carries on"; approve "approval · {who name}"; escalate "escalate · {who name}"; reject "rejected"; stop "stop"; custom → "→ {first lane step}" plus " +{n}" for more, or "its own steps".
Renaming a path renames its generated step: "{new name}: approval" / "{new name}: escalation" / "{new name}: tell them it stopped".

### 16.5 Add / delete a path — `addPath(nodes, condId)`, `deletePath(nodes, condId, outKey)`, `addCondition(nodes, condId, outKey)`, `addEitherOr(nodes, condId, outKey)`

- Add ("+ Add a path"): insert before Otherwise `{key: ctx.idGen.next('path'), to: mergeAt, label: 'Path ' + k, join: 'all', do: 'continue', rows: [{f:'total_value', op:'>=', v:100000}]}` where `k` = 1-based index among non-else paths. If Otherwise is labelled "No", rename it "Otherwise". Sync generated labels.
- Delete ("Delete path", shown when there are 2+ paths): delete its generated step, remove the out; if one path remains and Otherwise is "Otherwise" and the remaining path is "Yes", rename Otherwise back to "No". `gc`. Toast "Path deleted".
- Condition rows: "+ Add a condition" appends `{f:'total_value', op:'>=', v:250000}`; "+ Add an either/or condition" appends `{join:'any', rows:[{f:'total_value', op:'>=', v:250000}, {f:'role_regulated', op:'yes'}]}`; in a group "+ Add another option" appends `{f:'total_value', op:'>=', v:250000}`; × removes a row or group. Changing a row's field resets it to `{f, op: OPS[t][0], v: enum → [], list → first option, bool → undefined, text → '', number → 0}`.

### 16.6 What a flagged check does — `setFlag(nodes, dwId, mode, who?)`

1. Delete the old generated flag step (`flagNode`). `cont` = the `pass` out's target. Store `flagDo = mode`, `flagWho = who ?? flagWho`.
2. `note` → flag out `to = cont`; `flagNode = null`.
3. Otherwise `id = dw.id + 'f'`, `w = flagWho ?? (stop ? 'hm' : 'proc')`, `lab = DW[worker].n.replace(' check', '') + ' flagged: escalation'` ("Duplicate & ghost worker flagged: escalation", "Budget flagged: escalation"):
   - escalate → Approve `{id, label: lab, roles: [w], reject: 'requester', remind: 24, sla: (sla of the escalation being replaced) ?? 48, escalation: true}` → `cont`
   - reject → End `{id, label: 'Rejected', outcome: 'rejected'}`
   - stop → Notify `{id, label: 'Tell them it stopped', recipients: [w], channel: 'Email'}` → End `{id: id + '_end', label: 'Stopped', outcome: 'stopped'}` (§20 D23)
4. Flag out `to = id`; `flagNode = id`.
Panel helper text: escalate "They must act. Approve (it carries on), reject with a comment (it stops), or send it back to the requester." plus a number box "Escalate after (hours)" that edits `nodes[flagNode].sla` (default 48; validated as in §16.13); always "If it passes, it carries on. Either way, the result goes into every approver’s brief."

### 16.7 Delete a step — `deleteStep(nodes, id)`

Not allowed for Start or End. `keep` = for If, Fits plan? and checks: the LAST out (Otherwise / Outside plan / Passed); for others the first out. Every out pointing to `id` now points to `keep.to`; any `cond.mergeAt === id` becomes `keep.to`; any generated failure escalation whose `next` was `id` now points to `keep.to`; delete the node; `gc` (deleting a Collect & verify also removes its `failNode`). Toast "Step deleted. Lines reconnected" with an "Undo" link; Undo puts back the `nodes` map exactly as it was before `deleteStep` (04-ui §6.6). (W13: deleting "Budget check" connects Start to "Duplicate & ghost worker".)

### 16.8 Garbage collect — `gc(nodes)`

Delete every node not reachable from `T`, except `END`.

### 16.9 Parallel branches — `addBranch(nodes, parallelId)`, `removeBranch(nodes, parallelId, outKey)`

"+ Add a branch": add `{key: ctx.idGen.next('branch'), to: outs[0].to, label: 'Branch ' + (count + 1)}`. Remove (×, only when 3+ branches): remove the out, `gc`.

### 16.10 Add a step after the paths meet / after all branches finish — `insertAfterMerge(nodes, id, spec)`

1. `t` = the node reachable from every out of `id` with the smallest breadth-first distance from `id`. None → toast "These paths never meet".
2. Create the new node pointing to `t`. For every node reachable from `id`'s outs (and `id` itself) that is not reachable from `t`, redirect outs pointing to `t` to the new node.
3. For an If, set `mergeAt` = the new node. Toast "Added after all paths meet".

### 16.11 Other step edits

- `setSystemOnFail(nodes, systemId, mode: 'task' | 'path' | 'pause')` — System "If it fails" → "Then take a Failed path (add your own steps)": add Task `{id: sys.id + 'f', label: `Fix the ${system} error`, role: 'people_ops', title: `Fix what failed in ${system}, then retry`}` → the normal next; add out `{key:'failed', to: that task, label:'Failed'}`; label the normal out "Done". Switching back removes the Failed out and its steps (`gc`) and the "Done" label.
- `setPlanOutside(nodes, planId, role)` — Fits plan? "If outside the plan, send it to {role}": set the Outside Approve step's roles to `[role]` (create one labelled "Outside plan" if the exit does not lead to an Approve step).
- `setApprovers(nodes, apprId, choice)` with `choice` = `{who: 'roles', roles?}` | `{who: 'group', group?}` | `{who: 'person', person?, backup?}` — Approve "Who approves": switching to "An approval group" sets `who = 'group'`, `roles = []` (dropdown placeholder "Choose a group"); to "A named person" sets `who = 'person'`, `roles = []`, `backup = ''` (placeholder "Choose a person"); back to "Roles" restores the last role list, or `[]` (placeholder "Choose roles"). Nothing is auto-picked. Picking a group sets `roles = ['g:' + key]`; picking a person sets `roles = ['p:' + name]`. Group/person force `mode = 'all'`. Picking the backup's name as the person clears the backup. Until a choice is made the box reads "Approval" / "Choose who approves", Test shows "Choose who approves" and publish is blocked (L11).
- `setField(nodes, id, field, value)` — any other single-field edit (name, remind, sla, from, items, …) stores the value as given; no other node changes. Collect "What’s required": pick from the list or type a new item and choose "+ Add “{typed}”". Laptop & badge "Equipment" sets `gives = kit.join(' and ')`.
- Collect "If it fails" deciders ("Escalate: someone must decide" → one role; "Ask people to decide" → roles): every role except the worker is offered, including People Ops, IT service desk and Accounts payable.

### 16.12 Collect & verify failure escalation — `setCollectFail(nodes, collectId, failTo, role?)`

1. `failTo 'role'`: `id = collect.id + '_fail'`. Create or update Approve `{id, label: `${title(collect)} failed: escalation`, roles: [role ?? collect.failRole], who: 'roles', escalation: true, failOf: collect.id, reject: 'requester', remind: 24, sla: (existing node's sla) ?? 48, outs:[{key:'next', to: <collect's next target>}]}`; set `collect.failRole`, `collect.failNode = id`; ensure the collect has out `{key:'fail', to: id, label:'Failed'}` after `next`. Changing the role updates `roles`. The panel shows "Escalate after (hours)" bound to `nodes[id].sla`.
2. `failTo 'approval'`: remove the `fail` out and the `failNode` (`gc`); deciders are `failRoles` (planned as a one-off Approve when it fails, §10.3).
3. Canvas: the Collect & verify box shows a "Failed" exit to the generated "{step} failed: escalation" box (like a check's flagged escalation).

### 16.13 Chaser validation

`getEscalateAfter(nodes, ownerId, outKey?)` / `setEscalateAfter(nodes, ownerId, outKey | null, hours)`: read or write the "Escalate after (hours)" box of an If path (`ownerId` = the If, `outKey` = the path or 'else'), a check (`outKey` null) or a Collect & verify (`outKey` null). Both act on the generated escalation step's `sla` (`{condId}_{outKey}`, `flagNode`, `failNode`); nothing else stores hours.

For Approve (including every generated escalation), Task and Collect & verify: `sla` must be greater than `remind` (using `chaseDefaults`). When an hours box makes `sla <= remind`, keep the typed value, show under the box "Escalation has to come after the reminder.", and lint reports L18 (blocks publish) until fixed.
- Dropping a Digital Worker: on a line `+` → insert (16.1); on a Collect & verify step → `checker = 'dw:' + id` (and `verify 'person'` → `'auto_person'`), toast "{DW name} now verifies “{step}”"; on a System step → `via = id`, toast "{DW name} now does “{step}”"; on an Approve step → refuse, toast "Checks go on the line before an approver: drop it on a +".
- New workflow (picker "+ New workflow") — `createWorkflow(from: Workflow | null, ctx): Workflow`: `{id: ctx.idGen.next('workflow'), name:'New workflow', records:[from's record, else 'work_order'], event: from's event, else 'submitted', scope:{}, status:'draft', version:0, effective: the first day of the month after (`ctx.asOf` + 30 days); with the test date 2026-10-20 that is 2026-12-01, owner:'Procurement operations', priority:null, source:'levv', onReject:{recipients:['hm'], resubmitDays:5}, draft:{nodes:{T→END, END completed}}, published:null}` ("When a request is finally rejected, tell" shows Hiring manager); open its first box; toast "New draft. Set when it runs, then press + to add steps".

---

## 17. "Only needed when" in plain words (✦ Set)

### 17.1 Behaviour

1. Input: the text in the "Only needed when" box (placeholder "e.g. the bill rate goes up more than 5%, or the work country is UK"). Empty → toast "Say when this approver is needed".
2. `rows = await parseWhen(text)`; `whenPrompt = text.trim()`.
3. Rows found → `when = {join: /\bor\b|any of/i.test(text) ? 'any' : 'all', rows}`; message (✦, ok): "Read as: asked only if {conditionText(when)}. Check it below, then Test."
4. None → message (✦, warn): "I couldn’t match that to a field. Try naming the field and value, e.g. “work country is Canada” or “total value over $250K”." (`when` unchanged).
5. "Always ask this approver" removes `when` and clears `whenPrompt`.
A18: "rate is more than 15% over the rate card" → `[{f:'rate_vs_card_pct', op:'>', v:15}]`; the row editor shows Rate vs rate card (%) · > · 15 and the message reads "Read as: asked only if Rate vs rate card (%) > 15%. Check it below, then Test."

### 17.2 Production: GPT first, parser as fallback

```ts
async function parseWhen(text: string, deps: { callGPT?: CallGPT }): Promise<(Row | Group)[]> {
  // 1. Try the model (existing callGPT helper, OpenAI GPT-4.1-mini), 8 s timeout.
  // 2. Validate every row (below). Any invalid row → discard the whole GPT answer.
  // 3. Valid and non-empty → return it. Otherwise → return parseWhenRules(text) (17.3).
}
```
Call: `callGPT({model: 'gpt-4.1-mini', temperature: 0, messages: [{role:'system', content: SYSTEM}, {role:'user', content: text}], response_format: {type:'json_schema', json_schema: {name:'when_rows', strict: true, schema: SCHEMA}}})` (adapt to the helper's actual signature).

SYSTEM prompt:
"You turn a sentence about when an approver is needed into condition rows. Use only these fields (id, label, type, options): {FIELDS as one line each}. Operators by type: money/num/pct: >=, >, <, <=; enum: in, not_in (v is a list of options, spelled exactly); bool: yes, no (no v); list: includes (v is one option); text: is, contains. Percent values are plain numbers (15 means 15%). Money is in dollars (250K = 250000). Return {join, rows}. join is 'any' only if the sentence says 'or' or 'any of'. If nothing matches, return rows: []."

SCHEMA (strict):
```json
{ "type":"object", "additionalProperties":false, "required":["join","rows"],
  "properties":{
    "join":{"type":"string","enum":["all","any"]},
    "rows":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["f","op","v"],
      "properties":{
        "f":{"type":"string","enum":["<every FieldDef.id>"]},
        "op":{"type":"string","enum":[">=",">","<","<=","in","not_in","yes","no","includes","is","contains"]},
        "v":{"anyOf":[{"type":"number"},{"type":"string"},{"type":"array","items":{"type":"string"}},{"type":"null"}]}}}}}}
```
Validation: field exists; `op` is in `OPS[field.t]`; money/num/pct → `v` is a number; enum → `v` is a non-empty array of field options; list → `v` is one option; text → string; bool → set `v` undefined. Use the returned `join` only if the regex in 17.1 step 3 agrees; otherwise use the regex result.

### 17.3 Deterministic parser — `parseWhenRules(text): Row[]` (fallback and unit-test oracle)

`t = ' ' + text.toLowerCase().replace(/[’']/g, "'") + ' '`; `t2 = t`; `rows = []`.
`money(s, u)` = `parseFloat(s.replace(/,/g, ''))` × 1000 when `u === 'k'`, × 1 000 000 when `u` is `'m'` or `'million'`.
1. `up` = `/(goes up|go up|increase|rais|rise|rises|higher|more than|over|above|exceed|past|beyond|greater)/`; `down` = `/(goes down|decrease|lower|less than|under|below)/`; `op = down && !up ? '<' : '>'`.
2. Numbers (first match only, in this order):
   - `/\brate\b/` and `(\d+(\.\d+)?)\s*%` and `/card/` → `rate_vs_card_pct op N`
   - `/\brate\b/` and `%` and `/market/` → `rate_vs_market_pct op N`
   - `/\brate\b/` and `%` → `rate_change_pct op N`
   - `/\brate\b/` and `/\$\s*(\d[\d,.]*)\s*(k|m)?/` → `bill_rate op money`
   - `/\$\s*(\d[\d,.]*)\s*(k|m|million)?/` → (`/budget left|remaining budget/` ? `budget_left_after` : `total_value`) `op money`
3. `/(\d+)\s*months?/` → `months_engaged_after op N`.
4. `/(\d+)\s*weeks?/` → `months_engaged_after op round(N / 4.345, 1 decimal)`.
5. `/(\d+)\s*days?\s*(?:until|before|to)\s*(?:the\s*)?start/` → `days_to_start < N`.
6. If `/\b(changes|changed|is changed|moves)\b/`: for `[end_date, /end date|extension|extended/]`, `[bill_rate, /\brate\b/]`, `[cost_center, /cost cent/]`, `[scope, /scope/]`: if it matches and no row already uses that field (for bill_rate: and no `rate_change_pct` row) → `changed_fields includes key`.
7. Yes/no fields, each tested on `t`: `data_access /client data|customer data|data access/`, `role_regulated /regulated/`, `worker_former_employee /former (employee|public servant)/`, `duplicate_found /duplicate/`, `urgent /urgent/`, `terms_nonstandard /non-?standard terms/`, `registration_required /registration/`, `digital_worker_access /digital worker/` → row `op = /\b(no|not|without)\b/.test(t) ? 'no' : 'yes'`; remove the matched words from `t2`.
8. Pick-list fields (every `enum` field in FIELDS order): `vals` = options `o` where `s = o.toLowerCase()` and `t2` contains `' ' + s + ' '`, `' ' + s + ','` or `' ' + s + '.'`, or (the first word of `s` is longer than 3 characters, looks like a code `/^[a-z]{2,4}-\d/i`, and `t2` contains it). If any: `neg = new RegExp('(not|isn.t|other than)\\s+(in\\s+|the\\s+)?' + firstWord(vals[0])).test(t)` → row `{f, op: neg ? 'not_in' : 'in', v: vals}`.
9. Return `rows`.

Oracle cases (input → rows; join):
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
| legal entity Levv Bank UK Ltd | country in [UK]; legal_entity in [Levv Bank UK Ltd] | all (known parser quirk: "uk" also matches Work country) |
| hello world | (none) → failure message | — |

---

## 18. Canvas and panel texts (pure)

### 18.1 Box subtitle — `subtitle(wf, node)`

| Kind | Text |
| --- | --- |
| Start | `scopeText(wf.scope)` ("Everywhere", "UK · Technology") |
| If | On the canvas the If is a card with one row per path (04-ui §4.4) using the card-row texts of §16.4 ("carries on", "approval · {who}", "escalate · {who}", "rejected", "stop", "→ {first lane step}"). Where one line is needed (screen-reader label, picker search): non-else paths `label` + (`: ` + `{approve:'approval by {who}', escalate:'escalated to {who}', reject:'rejected', stop:'stop'}[mode]` when set), then Otherwise only when it has one of those modes; joined " · " ("Over $1M · Over $250K", "Over 10% · Otherwise: escalated to Finance controllers") |
| Approve | no roles (any mode, including an empty group or person) → "Choose who approves"; person chosen: `roleList(roles) + (backup ? ' · backup ' + backup : ' · no backup')`; group chosen: the group name; roles: else (2+ roles ? `{all:'Together: ', any:'Any one: ', order:'In order: '}[mode]` : '') + `roleList(roles)`; then " · only if " + `conditionText(when)` when it has rows ("Procurement · only if Bill rate change (%) > 5%") |
| Auto-approve | "Receipt kept" |
| Fits plan? | Outside exit leads to an Approve with roles → "Outside plan: " + `roleList`; else the plan name |
| Check | `{note:'If flagged: approvers see it', escalate:'If flagged: escalate to {who}', reject:'If flagged: rejected', stop:'If flagged: stop'}[flagDo]` |
| Helper DW | the DW name |
| Collect & verify | `[ `${roleName(from ?? 'worker')} provides`, verifyShort ].join(' · ')`; verifyShort: person → reviewer name; auto_person → `${CHECKERS[checker]}, then ${reviewer name}`; auto → `CHECKERS[checker]` ("Supplier account manager provides · Procurement", "Worker provides · Persona, then People Ops") |
| Task | role name (or "Unassigned") |
| System | `sysShort` + (gives ? ' · gives ' + gives : '') ("Create contingent worker in Workday · gives Workday account") |
| Notify | `roleList(recipients)` |
| Wait | `waitText(w, false)` |
| Parallel | branch labels joined " · " |
| Run workflow | target name, or "Pick a workflow" |
| End | outcome capitalised ("Completed", "Rejected", "Stopped") |

During Test each visited box shows its status label instead.

### 18.2 If panel

- Top line: "Levv checks the paths from the top and takes the first one that matches. If none match, it goes to “{else label}”. All paths meet again at “{title(mergeAt) or 'End'}”."
- Per path: "Take this path when {all|any} of these are true:", the rows, "Then" (DM §5.3 labels; "Carry on to “{merge title}”"). Approve → "Who approves" + "Then it carries on to “{merge title}”."; Escalate → "Escalate to" + "They must act: approve (it carries on), reject with a comment, or send it back to the requester." + "Escalate after (hours)" (number box bound to the generated node's `sla`, default 48; validated as in §16.13); Stop → "Who to tell"; Custom → "On this path: {lane steps joined ' → ' or 'nothing'}. Click a box on the canvas to change it, or pick another option to replace it."
- Otherwise card: "{label}" — "when none of the paths above match".
- Advanced: "When information is missing" (DM §5.3).

### 18.3 Approve panel sentence

roles: "{role names joined ', '} approve{, together | , any one of them is enough | , one after another when 2+}. Levv finds the right person for each request." No roles: "Pick roles. Levv finds the right person for each request." Group not chosen: dropdown placeholder "Choose a group" (no sentence). Group: "{group}: {members joined ', '}. {Everyone in the group approves. | Any one of them can approve.}" Person not chosen: placeholder "Choose a person". Person: "A named person doesn’t follow reorgs. If they leave or change role, Nova flags every step that names them."
Always: "✦ Approvers get a brief: what’s asked, what changed, and the result of any checks earlier on the line."

### 18.4 Chaser box (Approve, Task, Collect & verify)

"Chaser" · "built in" · "Remind after (hours)" {remind} · "Then escalate to {chaseTo} after (hours)" {sla} · "Runs by itself while this step waits. Reminders stop the moment someone acts."

---

## 19. Worked examples (acceptance oracle)

Context for all rows: seed data as shipped, `asOf = '2026-10-20'`, `now = '2026-10-20T09:00:00Z'` (Hannah Brooks and Kenji Watanabe are away), no edits, no proposal chosen, every workflow in its seed state. "Workflow" is the one open in Test (Test runs the open workflow even if another would be selected for real requests, §3.4).

Status labels are shown in capitals as on screen. "Rounds" lists each round line (§11.5) under the step. The tables below show the parts of the panel that illustrate each example; they are not the complete output. In particular the "For real requests, “{winner}” runs for this record." notice (§3.4) appears in every case where another workflow would be selected (shown only in E3), and records with `decided` (ASN-881) carry ": {status}" after each round item (§8.4). The complete expected outputs are the 06 Part A tests. Rows marked **Build** show where this spec deliberately differs from the prototype output quoted in the table (§20).

| # | Record | Workflow (open in Test) | Summary line | Decisions |
| --- | --- | --- | --- | --- |
| E1 | WO-2214 Senior cloud engineer | UK Technology work orders | 3 approval rounds on this path. Approval rules add approvers: Client data access, UK off-payroll (IR35). | Budget check → Passed; Duplicate & ghost worker → Passed; Rate over card? → Over 10%; Value band → Over $250K |
| E2 | WO-2240 Data engineer, trading data | UK Technology work orders | 2 approval rounds on this path. Approval rules add approvers: Client data access, Regulated roles. | Budget check → Passed; Duplicate & ghost worker → Flagged; Rate over card? → Otherwise; Value band → Otherwise |
| E3 | WO-2214 Senior cloud engineer | Work order submitted | 3 approval rounds on this path. Approval rules add approvers: Client data access, UK off-payroll (IR35). | Budget check → Passed; Duplicate & ghost worker → Passed; Rate over card? → Over 10%; Value band → Over $250K |
| E4 | WO-2231 Operations analyst | Work order submitted | 1 approval round on this path. | Budget check → Passed; Duplicate & ghost worker → Passed; Rate over card? → Otherwise; Value band → Otherwise |
| E5 | WO-2260 Cleared engineer, project Atlas | Work order submitted | 1 approval round on this path. | Budget check → Passed; Duplicate & ghost worker → Passed; Rate over card? → Otherwise; Value band → Otherwise |
| E6 | WO-2270 Data platform engineer, Germany | Work order submitted | 2 approval rounds on this path. Approval rules add approvers: Client data access. Part of the approval is paused: nobody eligible, so it waits until someone eligible is assigned. | Budget check → Passed; Duplicate & ghost worker → Passed; Rate over card? → Otherwise; Value band → Over $250K |
| E7 | WO-2275 Analytics lead, split funding | Work order submitted | 3 approval rounds on this path. | Budget check → Passed; Duplicate & ghost worker → Passed; Rate over card? → Over 10%; Value band → Over $250K |
| E8 | WO-2280 Ops contractor, no rate card yet | Work order submitted | 1 approval round on this path. Needs information: Rate vs rate card (%) is missing, so “Rate over card?” can’t decide. Procurement (Owen Clarke) has been asked to fill it in. | Budget check → Passed; Duplicate & ghost worker → Passed; Rate over card? → Needs information |
| E9 | WO-2214 Senior cloud engineer | Data and AI hires | 1 approval round on this path. Approval rules add approvers: Client data access, UK off-payroll (IR35). | Budget check → Passed; Duplicate & ghost worker → Passed |
| E10 | WO-2231 Operations analyst | Data and AI hires | 2 approval rounds on this path. | Budget check → Passed; Duplicate & ghost worker → Passed |
| E11 | WO-2270 Data platform engineer, Germany | Data and AI hires | 2 approval rounds on this path. Approval rules add approvers: Client data access. Part of the approval is paused: nobody eligible, so it waits until someone eligible is assigned. | Budget check → Passed; Duplicate & ghost worker → Passed |
| E12 | WO-2214-C Senior cloud engineer — rate change | Work order changed | 1 approval round on this path. | Budget check → Passed; Duplicate & ghost worker → Passed; Rate over card? → Otherwise; Value band → Otherwise |
| E13 | ASN-881 Data analyst extension and rate rise | Assignment changed | 4 approval rounds on this path. | Tenure & classification → Flagged; Tenure over 18 months? → Yes; Within plan? → Outside plan; New total over $250K? → Yes; Rate changed? → Yes |
| E14 | ASN-920 Analyst rate change, two proposals | Assignment changed | Nothing is approved yet: approvals wait until one of the two proposed changes is chosen. | Tenure & classification → Passed; Tenure over 18 months? → No; Within plan? → Inside plan; New total over $250K? → No; Rate changed? → Yes |
| E15 | ASN-902 Cloud engineer, ending Nov 16 | Assignment ending | No one needs to approve on this path. | Extending? → No |
| E16 | ASN-907 Designer, manager extends | Assignment ending | No one needs to approve on this path. Approved automatically. No one had to act. | Extending? → Yes; Tenure & classification → Passed; Tenure over 18 months? → No; Within plan? → Inside plan; New total over $250K? → No; Rate changed? → No |
| E17 | SOW-77 Document review program | SOW created | 3 approval rounds on this path. | Legal needed? → Yes; Value band → Over $250K |
| E18 | SOW-77-CO1 Document review: new module | SOW change order submitted | 1 approval round on this path. | Scope changed? → Yes; Value band → Over $1M |
| E19 | SOW-77-CO3 Document review: third top-up | SOW change order submitted | 1 approval round on this path. | Scope changed? → No; Value band → Over $1M |
| E20 | JP-5120 Junior data analyst, 6 months (job posting) | Job posting created | No one needs to approve on this path. Approved automatically. No one had to act. | Within plan? → Inside plan |
| E21 | TS-9934 Timesheet, week of Oct 12 | Timesheet submitted | No one needs to approve on this path. Approved automatically. No one had to act. | Over schedule? → No |
| E22 | WO-2214-A Senior cloud engineer | Contractor onboarding | (none: no Approve or Auto-approve step) | Registration required? → No |
| E23 | WO-2240-A Data engineer, trading data | Contractor onboarding | (none: no Approve or Auto-approve step) | Registration required? → Yes |
| E24 | WO-2251-A Analyst, checks need attention | Contractor onboarding | (none: no Approve or Auto-approve step) | Registration required? → No |
| E25 | OFF-902 Cloud engineer, not extended | Contractor offboarding | (none: no Approve or Auto-approve step) | — |
| E26 | OFF-915 Data analyst, ended early (ended early) | Contractor offboarding | (none: no Approve or Auto-approve step) | — |
| E27 | WK-330 Forklift certificate expiring | Document renewal | (none: no Approve or Auto-approve step) | — |
| E28 | INV-8812 Invoice doesn’t match timesheets | Invoice received | (none: no Approve or Auto-approve step) | Matches? → No |
| E29 | INV-8813 Invoice matches | Invoice received | (none: no Approve or Auto-approve step) | Matches? → Yes |
| E30 | AR-301 Visiting engineer, 2 weeks on site | Site access request | 1 approval round on this path. | Duplicate & ghost worker → Passed |
| E31 | AR-305 Returning vendor technician | Site access request | 1 approval round on this path. | Duplicate & ghost worker → Flagged |

#### E1 · WO-2214 on “UK Technology work orders”


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Budget check | PASSED | $120K left in plan after this request |  |
| Duplicate & ghost worker | PASSED | No duplicate worker or leftover access found |  |
| Business sign-off | APPROVAL | Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Hiring manager's manager (Alan Brooks), Information Security (Ravi Kumar), Privacy (Fatima Zahra) · Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK); Alan Brooks also covers Cost center owner. Same kind of decision, so one approval; Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves |
| Rate review | APPROVAL | If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Procurement (Owen Clarke) |
| Finance sign-off | APPROVAL | If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. VP Finance (David Okafor) |
| Tell the supplier | SENT | Email to Supplier account manager |  |

Rule task (§7.3, §20 D5) shown under Business sign-off: “Task: Record IR35 status · Tax (Mei Lin). Must be done before the request is approved”.

#### E2 · WO-2240 on “UK Technology work orders”

Extra lines under the summary: ⚑ Marked: Registration required (later steps can react to this)

| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Budget check | PASSED | $40K left in plan after this request |  |
| Duplicate & ghost worker | FLAGGED | Same person is active through another supplier (WO-1877) |  |
| Duplicate found: escalation | ESCALATED | They must approve (it carries on), reject with a comment (it stops), or send it back to the requester. Chaser reminds after 24h and escalates to their manager after 48h | 1. Procurement (Owen Clarke) |
| Business sign-off | APPROVAL | Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Hiring manager's manager (Priya Shah), Information Security (Ravi Kumar), Privacy (Fatima Zahra), Compliance (Daniel Osei) · Priya Shah also covers Cost center owner. Same kind of decision, so one approval; Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves |
| Tell the supplier | SENT | Email to Supplier account manager |  |

Flags line stays (not rejected).

#### E3 · WO-2214 on “Work order submitted”

Notice line (§3.4, D16), after any Σ / ✓ / ⚑ lines: "For real requests, “UK Technology work orders” runs for this record."


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Budget check | PASSED | $120K left in plan after this request |  |
| Duplicate & ghost worker | PASSED | No duplicate worker or leftover access found |  |
| Business sign-off | APPROVAL | Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Hiring manager (Tom Reed), Cost center owner (Alan Brooks), Information Security (Ravi Kumar), Privacy (Fatima Zahra) · Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK); Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves |
| Rate review | APPROVAL | If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Procurement (Owen Clarke) |
| Finance sign-off | APPROVAL | If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Finance business partner (Chloe Martin) |
| Tell the supplier | SENT | Email to Supplier account manager |  |

Rule task shown under Business sign-off as in E1.

#### E4 · WO-2231 on “Work order submitted”


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Budget check | PASSED | $30K left in plan after this request |  |
| Duplicate & ghost worker | PASSED | No duplicate worker or leftover access found |  |
| Business sign-off | APPROVAL | Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Hiring manager (Raj Patel) · Grace Kim raised this request, so the step moves up to Raj Patel (Operations Director); Raj Patel also covers Cost center owner. Same kind of decision, so one approval |
| Tell the supplier | SENT | Email to Supplier account manager |  |

#### E5 · WO-2260 on “Work order submitted”

Notice line (§3.4, D16), after any Σ / ✓ / ⚑ lines: "For real requests, “UK Technology work orders” runs for this record."


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Budget check | PASSED | $90K left in plan after this request |  |
| Duplicate & ghost worker | PASSED | No duplicate worker or leftover access found |  |
| Business sign-off | APPROVAL | Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Hiring manager (Tom Reed), Cost center owner (Priya Shah) |
| Tell the supplier | SENT | Email to Supplier account manager |  |

#### E6 · WO-2270 on “Work order submitted”


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Budget check | PASSED | $80K left in plan after this request |  |
| Duplicate & ghost worker | PASSED | No duplicate worker or leftover access found |  |
| Business sign-off | PAUSED | Nobody eligible right now, so it waits until someone is assigned. Nothing is approved automatically | 1. Hiring manager (Tom Reed), Cost center owner (Priya Shah), Information Security (Ravi Kumar), Privacy (—) · Tom Reed is the hiring manager on the record (raised by Coordinator); Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves; Paused: no eligible Privacy reviewer for Germany. It waits until someone eligible is assigned (owner: Procurement operations). No one unqualified stands in |
| Finance sign-off | APPROVAL | If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Finance business partner (Chloe Martin) |
| Tell the supplier | SENT | Email to Supplier account manager |  |

Business sign-off is PAUSED because the Privacy item that the Client data access rule added to its round has nobody eligible in Germany.

#### E7 · WO-2275 on “Work order submitted”


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Budget check | PASSED | $60K left in plan after this request |  |
| Duplicate & ghost worker | PASSED | No duplicate worker or leftover access found |  |
| Business sign-off | APPROVAL | Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Hiring manager (Omar Haddad), Cost center owner (Lena Fischer), Cost center owner (Alicia Ng) · Omar Haddad is the hiring manager on the record (raised by Coordinator); Charged to Finance, so its cost center owner approves; Charged to Marketing, so its cost center owner approves |
| Rate review | APPROVAL | If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Procurement (Owen Clarke) |
| Finance sign-off | APPROVAL | If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Finance business partner (Chloe Martin) |
| Tell the supplier | SENT | Email to Supplier account manager |  |

#### E8 · WO-2280 on “Work order submitted”


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Budget check | PASSED | $50K left in plan after this request |  |
| Duplicate & ghost worker | PASSED | No duplicate worker or leftover access found |  |
| Business sign-off | APPROVAL | Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Hiring manager (Grace Kim), Cost center owner (Raj Patel) · Grace Kim is the hiring manager on the record (raised by Coordinator) |

#### E9 · WO-2214 on “Data and AI hires”

Notice line (§3.4, D16), after any Σ / ✓ / ⚑ lines: "For real requests, “UK Technology work orders” runs for this record."


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Budget check | PASSED | $120K left in plan after this request |  |
| Duplicate & ghost worker | PASSED | No duplicate worker or leftover access found |  |
| Business sign-off | APPROVAL | Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Hiring manager (Tom Reed), Cost center owner (Alan Brooks), Information Security (Ravi Kumar), Privacy (Fatima Zahra) · Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK); Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves |
| Data governance review | COVERED | The same person already approves this kind of decision on this path |  |
| Tell the supplier | SENT | Email to Supplier account manager |  |

Rule task shown under Business sign-off as in E1.

#### E10 · WO-2231 on “Data and AI hires”

Notice line (§3.4, D16), after any Σ / ✓ / ⚑ lines: "For real requests, “Work order submitted” runs for this record."


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Budget check | PASSED | $30K left in plan after this request |  |
| Duplicate & ghost worker | PASSED | No duplicate worker or leftover access found |  |
| Business sign-off | APPROVAL | Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Hiring manager (Raj Patel) · Grace Kim raised this request, so the step moves up to Raj Patel (Operations Director); Raj Patel also covers Cost center owner. Same kind of decision, so one approval |
| Data governance review | APPROVAL | If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Privacy (Fatima Zahra) |
| Tell the supplier | SENT | Email to Supplier account manager |  |

#### E11 · WO-2270 on “Data and AI hires”

Notice line (§3.4, D16), after any Σ / ✓ / ⚑ lines: "For real requests, “Work order submitted” runs for this record."


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Budget check | PASSED | $80K left in plan after this request |  |
| Duplicate & ghost worker | PASSED | No duplicate worker or leftover access found |  |
| Business sign-off | PAUSED | Nobody eligible right now, so it waits until someone is assigned. Nothing is approved automatically | 1. Hiring manager (Tom Reed), Cost center owner (Priya Shah), Information Security (Ravi Kumar), Privacy (—) · Tom Reed is the hiring manager on the record (raised by Coordinator); Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves; Paused: no eligible Privacy reviewer for Germany. It waits until someone eligible is assigned (owner: Procurement operations). No one unqualified stands in |
| Data governance review | PAUSED | Nobody eligible right now, so it waits until someone is assigned. Nothing is approved automatically | 1. Privacy (—) · Paused: no eligible Privacy reviewer for Germany. It waits until someone eligible is assigned (owner: Procurement operations). No one unqualified stands in |
| Tell the supplier | SENT | Email to Supplier account manager |  |

Both Privacy items are paused, so they are not merged.

#### E12 · WO-2214-C on “Work order changed”


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Budget check | PASSED | No budget data on this record |  |
| Duplicate & ghost worker | PASSED | No duplicate worker or leftover access found |  |
| Business sign-off | APPROVAL | Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Hiring manager (Tom Reed), Cost center owner (Alan Brooks) · Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK) |
| Tell the supplier | SENT | Email to Supplier account manager |  |

#### E13 · ASN-881 on “Assignment changed”

Extra lines under the summary: Try an edit: Manager shortens the extension to Mar 31

| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Tenure & classification | FLAGGED | 20 months engaged after this change (cap 18) |  |
| Tenure review | APPROVAL | Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. HR business partner (Erin Walsh): Approved, Legal (Luis Romero): Waiting · Hannah Brooks is out until Oct 24. Delegated to Luis Romero |
| Within plan? | OUTSIDE THE PLAN | Outside the approved budget, so it goes to an approver |  |
| Budget owner | APPROVAL | If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Cost center owner (Lena Fischer): Approved |
| Finance sign-off | APPROVAL | If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. VP Finance (David Okafor): Waiting |
| Rate review | APPROVAL | If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Procurement (Owen Clarke): Waiting |
| Auto-approve if no one else needed | NOT USED | Someone approves on this path, so it doesn’t auto-approve |  |
| Tell the supplier | SENT | Email to Supplier account manager |  |

**Build (§20 D7):** ASN-881 carries `decided: ["cco","hrbp"]`, so each round item ends with its status (§8.4): rounds as shown in this table (the prototype prints them without “: Approved” / “: Waiting”). Edit button “Try an edit: Manager shortens the extension to Mar 31”. With the edit applied, see the table E13-edit below.

#### E13-edit · ASN-881 on “Assignment changed”, “Try an edit” applied

Summary "3 approval rounds on this path." Edit button "Undo the edit". Decisions: Tenure & classification → Passed; Tenure over 18 months? → No; Within plan? → Outside plan; New total over $250K? → Yes; Rate changed? → Yes.

| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Tenure & classification | PASSED | 17 months engaged after this change (cap 18) |  |
| Within plan? | OUTSIDE THE PLAN | Outside the approved budget, so it goes to an approver |  |
| Budget owner | APPROVAL | If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Cost center owner (Lena Fischer): Stands |
| Finance sign-off | APPROVAL | If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. VP Finance (David Okafor): Waiting |
| Rate review | APPROVAL | If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Procurement (Owen Clarke): Waiting |
| Auto-approve if no one else needed | NOT USED | Someone approves on this path, so it doesn’t auto-approve |  |
| Tell the supplier | SENT | Email to Supplier account manager |  |

Removed by the edit: "HR business partner: approved, no longer needed"; "Legal: withdrawn, approver told".
Status rules used (§8.4): Budget owner — approved before, its material fields (End date, Total value) both went down and `reaskOnDecrease` is false → "Stands". Finance sign-off and Rate review — not approved yet and in the plan before the edit → "Waiting". A role approved before whose material field changed upward (or with `reaskOnDecrease` true) would read "Asked again"; a role not in the plan before the edit would read "New". Tenure review left the path → "Removed by the edit".

#### E14 · ASN-920 on “Assignment changed”

Extra lines under the summary: Conflict box: Two proposed changes to the bill rate: $96/h from Grace Kim and $102/h from Raj Patel. Nothing is overwritten; approvals wait until one version is chosen. / Use $96/h / Use $102/h

| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Tenure & classification | PASSED | 10 months engaged after this change (cap 18) |  |
| Within plan? | INSIDE THE PLAN | Fits the budget Finance approved |  |
| Rate review | NOT NEEDED | Only needed when Bill rate change (%) > 5% |  |
| Auto-approve if no one else needed | APPROVED AUTOMATICALLY | Approved automatically: inside plan, no threshold crossed |  |
| Tell the supplier | SENT | Email to Supplier account manager |  |

Choosing a proposal → see variant V10.

#### E15 · ASN-902 on “Assignment ending”


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Extend or end? | DONE | Decide whether to extend: done by Hiring manager (Tom Reed) |  |
| Confirm the end date | SENT | Email to Hiring manager (Tom Reed), Supplier account manager |  |

#### E16 · ASN-907 on “Assignment ending”


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Extend or end? | DONE | Decide whether to extend: done by Hiring manager (Sofia Reyes) |  |
| Tenure & classification | PASSED | 12 months engaged after this change (cap 18) |  |
| Within plan? | INSIDE THE PLAN | Fits the budget Finance approved |  |
| Auto-approve if no one else needed | APPROVED AUTOMATICALLY | Approved automatically: inside plan, no threshold crossed |  |

#### E17 · SOW-77 on “SOW created”


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Procurement review | APPROVAL | If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Procurement (Owen Clarke) |
| Legal review | APPROVAL | If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Legal (Luis Romero) · Hannah Brooks is out until Oct 24. Delegated to Luis Romero |
| Finance review | APPROVAL | If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Finance business partner (Chloe Martin) |
| Tell the SOW owner it’s approved | SENT | Email to SOW owner (Grace Kim) |  |

Client data access does not apply to SOW-77 although `digital_worker_access` is true, because the rule’s event is `submitted` and SOWs start on `created` (§7.1, §20 D2). Expected as shown until the rule data is fixed outside Flow Studio.

#### E18 · SOW-77-CO1 on “SOW change order submitted”

Extra lines under the summary: Σ Comparing the running total of changes: $240K since the original $820K. This change alone is $240K

| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Procurement review | NOT ASKED AGAIN | Procurement: approved the original; nothing they depend on changed |  |
| Legal review | APPROVAL | If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Legal (Luis Romero) · Hannah Brooks is out until Oct 24. Delegated to Luis Romero |
| Finance and VP review | COVERED | The same person already approves this kind of decision on this path |  |
| Tell the SOW owner it’s approved | SENT | Email to SOW owner (Grace Kim) |  |

**Build (§20 D1):** the canvas walk uses the running total ($240K), so decisions read “Scope changed? → Yes; Value band → Otherwise” and the step list is: Procurement review · NOT ASKED AGAIN · “Procurement: approved the original; nothing they depend on changed”; Legal review · APPROVAL · “If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h” · round 1 “Legal (Luis Romero) · Hannah Brooks is out until Oct 24. Delegated to Luis Romero”; Tell the SOW owner it’s approved · SENT · “Email to SOW owner (Grace Kim)”. Summary unchanged.

#### E19 · SOW-77-CO3 on “SOW change order submitted”

Extra lines under the summary: Σ Comparing the running total of changes: $360K since the original $820K. This change alone is $60K

| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Procurement review | NOT ASKED AGAIN | Procurement: approved the original; nothing they depend on changed |  |
| Finance and VP review | COVERED | The same person already approves this kind of decision on this path |  |
| Tell the SOW owner it’s approved | SENT | Email to SOW owner (Grace Kim) |  |

**Build (§20 D1):** decisions “Scope changed? → No; Value band → Over $250K”; steps: Procurement review · NOT ASKED AGAIN · “Procurement: approved the original; nothing they depend on changed”; Finance review · APPROVAL · “If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h” · round 1 “Finance business partner (Chloe Martin)”; Tell the SOW owner it’s approved · SENT. Summary and Σ line unchanged. (Acceptance A14 must change “Finance and VP review: Covered” to “Finance review: Approval, Chloe Martin”.)

#### E20 · JP-5120 on “Job posting created”


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Within plan? | INSIDE THE PLAN | Fits the budget Finance approved |  |
| Approve within plan | APPROVED AUTOMATICALLY | Approved automatically: fits the approved plan |  |
| Send to suppliers | SENT | Email to Procurement (Owen Clarke) |  |

#### E21 · TS-9934 on “Timesheet submitted”


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Approve scheduled hours | APPROVED AUTOMATICALLY | Approved automatically: hours match the schedule and work order |  |
| Tell the supplier it can invoice | SENT | Email to Supplier account manager |  |

#### E22 · WO-2214-A on “Contractor onboarding”


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Vendor insurance | REVIEW: PROCUREMENT | Asked of Supplier account manager: Certificate of insurance. Waiting for Procurement (Owen Clarke) · Worker sees: Waiting for review |  |
| Laptop and badge | REVIEW: IT SERVICE DESK | Asked of IT service desk (Sam Patel): Laptop, Building badge. Waiting for IT service desk (Sam Patel) · Worker sees: Waiting for review |  |
| Legal & compliance | VERIFIED AUTOMATICALLY | Asked of the worker: Contractor agreement, Non-disclosure agreement, Code of conduct. Verified by E-signature · Worker sees: Done |  |
| Workday provisioning | DONE IN WORKDAY | Create contingent worker in Workday, matched on Work email, 7 fields sent; reads back Workday worker ID; waits up to 24h for Workday to confirm; then checks it matches the ledger. Ledger: Workday account (remove access at exit) |  |
| Identity & eligibility | VERIFIED AUTOMATICALLY | Asked of the worker: Photo ID, Right to work. Verified by Persona · Worker sees: Done |  |
| Background check | VERIFIED AUTOMATICALLY | Asked of the worker: Criminal record, Employment history. Verified by Checkr · Worker sees: Done |  |
| System access | DONE IN SERVICENOW | Create access request in ServiceNow, matched on Work email, 4 fields sent; waits up to 24h for ServiceNow to confirm; then checks it matches the ledger. Done by the Access provisioner Digital Worker. Ledger: System access (remove access at exit) |  |
| Wait for start date | WAITS | Waits until Start date, 09:00 in the worker’s time zone |  |
| Payroll & banking | VERIFIED AUTOMATICALLY | Asked of the worker: Bank details, Tax forms. Verified by Workday · Worker sees: Done |  |

#### E23 · WO-2240-A on “Contractor onboarding”


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Vendor insurance | REVIEW: PROCUREMENT | Asked of Supplier account manager: Certificate of insurance. Waiting for Procurement (Owen Clarke) · Worker sees: Waiting for review |  |
| Laptop and badge | REVIEW: IT SERVICE DESK | Asked of IT service desk (Sam Patel): Laptop, Building badge. Waiting for IT service desk (Sam Patel) · Worker sees: Waiting for review |  |
| Legal & compliance | VERIFIED AUTOMATICALLY | Asked of the worker: Contractor agreement, Non-disclosure agreement, Code of conduct. Verified by E-signature · Worker sees: Done |  |
| Workday provisioning | DONE IN WORKDAY | Create contingent worker in Workday, matched on Work email, 7 fields sent; reads back Workday worker ID; waits up to 24h for Workday to confirm; then checks it matches the ledger. Ledger: Workday account (remove access at exit) |  |
| Identity & eligibility | VERIFIED AUTOMATICALLY | Asked of the worker: Photo ID, Right to work. Verified by Persona · Worker sees: Done |  |
| Background check | VERIFIED AUTOMATICALLY | Asked of the worker: Criminal record, Employment history. Verified by Checkr · Worker sees: Done |  |
| Registration verified | REVIEW: COMPLIANCE | Asked of the worker: Regulatory registration. Waiting for Compliance (Daniel Osei) · Worker sees: Waiting for review |  |
| System access | WAITING | Waiting on Registration verified |  |
| Wait for start date | WAITING | Waiting on System access |  |
| Payroll & banking | WAITING | Asked of the worker: Bank details, Tax forms. Waiting on Wait for start date · Worker sees: Not started yet |  |

#### E24 · WO-2251-A on “Contractor onboarding”


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Vendor insurance | REVIEW: PROCUREMENT | Asked of Supplier account manager: Certificate of insurance. Waiting for Procurement (Owen Clarke) · Worker sees: Waiting for review |  |
| Laptop and badge | REVIEW: IT SERVICE DESK | Asked of IT service desk (Sam Patel): Laptop, Building badge. Waiting for IT service desk (Sam Patel) · Worker sees: Waiting for review |  |
| Legal & compliance | VERIFIED AUTOMATICALLY | Asked of the worker: Contractor agreement, Non-disclosure agreement, Code of conduct. Verified by E-signature · Worker sees: Done |  |
| Workday provisioning | DONE IN WORKDAY | Create contingent worker in Workday, matched on Work email, 7 fields sent; reads back Workday worker ID; waits up to 24h for Workday to confirm; then checks it matches the ledger. Ledger: Workday account (remove access at exit) |  |
| Identity & eligibility | UNSURE: PEOPLE OPS | Asked of the worker: Photo ID, Right to work. Persona wasn’t sure, so People Ops (Jordan Lee) reviews · Worker sees: Waiting for review |  |
| Background check | FAILED: DECISION NEEDED | Failed. HR business partner and Legal must decide whether to carry on · Worker sees: In progress | 1. HR business partner (Erin Walsh), Legal (Luis Romero) · Hannah Brooks is out until Oct 24. Delegated to Luis Romero |
| System access | WAITING | Waiting on Registration required? |  |
| Wait for start date | WAITING | Waiting on System access |  |
| Payroll & banking | WAITING | Asked of the worker: Bank details, Tax forms. Waiting on Wait for start date · Worker sees: Not started yet |  |

**Build:** Background check message is “Asked of the worker: Criminal record, Employment history. Failed. HR business partner and Legal must decide whether to carry on” (§20 D17); System access reads “Waiting on Background check” (§20 D4).

#### E25 · OFF-902 on “Contractor offboarding”


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Knowledge handover | TO DO: HIRING MANAGER | Confirm handover is done: Hiring manager (Tom Reed) |  |
| Final timesheet & expenses | REVIEW: HIRING MANAGER | Asked of the worker: Final timesheet, Final expenses. Waiting for Hiring manager (Tom Reed) · Worker sees: Waiting for review |  |
| Return equipment | TO DO: IT SERVICE DESK | Collect laptop and badge: IT service desk (Sam Patel) |  |
| Exit confirmations | VERIFIED AUTOMATICALLY | Asked of the worker: Confidentiality reminder acknowledged, Company data returned or deleted. Verified by E-signature · Worker sees: Done |  |
| Wait for the last day | WAITING | Waiting on Final timesheet & expenses, Return equipment |  |
| Remove access | WAITING | Waiting on Wait for the last day |  |
| Close in HR system | WAITING | Waiting on Remove access |  |
| Ledger clear check | WAITING | Waiting on Close in HR system |  |
| Close the work order | WAITING | Waiting on Ledger clear check |  |

#### E26 · OFF-915 on “Contractor offboarding”


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Knowledge handover | TO DO: HIRING MANAGER | Confirm handover is done: Hiring manager (Omar Haddad) |  |
| Final timesheet & expenses | REVIEW: HIRING MANAGER | Asked of the worker: Final timesheet, Final expenses. Waiting for Hiring manager (Omar Haddad) · Worker sees: Waiting for review |  |
| Return equipment | TO DO: IT SERVICE DESK | Collect laptop and badge: IT service desk (Sam Patel) |  |
| Exit confirmations | VERIFIED AUTOMATICALLY | Asked of the worker: Confidentiality reminder acknowledged, Company data returned or deleted. Verified by E-signature · Worker sees: Done |  |
| Wait for the last day | WAITING | Waiting on Final timesheet & expenses, Return equipment |  |
| Remove access | WAITING | Waiting on Wait for the last day |  |
| Close in HR system | WAITING | Waiting on Remove access |  |
| Ledger clear check | WAITING | Waiting on Close in HR system |  |
| Close the work order | WAITING | Waiting on Ledger clear check |  |

#### E27 · WK-330 on “Document renewal”


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Renewed document | VERIFIED AUTOMATICALLY | Asked of the worker: Updated certificate. Verified by Document collector · Worker sees: Done |  |

#### E28 · INV-8812 on “Invoice received”


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Match the invoice | DONE | Matches each invoice line to approved time, expenses and milestones, and holds anything that doesn’t match. |  |
| Resolve exception | TO DO: ACCOUNTS PAYABLE | Resolve the invoice exception with the supplier: Accounts payable (Nina Shah) |  |

#### E29 · INV-8813 on “Invoice received”


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Match the invoice | DONE | Matches each invoice line to approved time, expenses and milestones, and holds anything that doesn’t match. |  |
| Release for payment | DONE IN SAP S/4HANA | Update supplier invoice in SAP S/4HANA, matched on Work order ID, 2 fields sent; reads back Posting status; waits up to 24h for SAP S/4HANA to confirm |  |

#### E30 · AR-301 on “Site access request”


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Duplicate & ghost worker | PASSED | No active badge or open request for this person |  |
| Security approves access | APPROVAL | If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h | 1. Information Security (Ravi Kumar) · Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves |
| Identity & site details | VERIFIED AUTOMATICALLY | Asked of Worker (Jordan Ellis): Photo ID, Date of birth, Signed site safety rules. Verified by Persona · Worker sees: Done |  |
| Background check | VERIFIED AUTOMATICALLY | Asked of Worker (Jordan Ellis): Criminal record. Verified by Checkr · Worker sees: Done |  |
| Issue the badge | DONE IN BADGE SYSTEM | Create badge in Badge system, matched on Personal email, 7 fields sent; waits up to 24h for Badge system to confirm. Ledger: Site badge (remove access at exit) |  |
| Badge ready | SENT | Email to Worker (Jordan Ellis), Sponsor (Grace Kim, or their delegate Raj Patel) |  |

#### E31 · AR-305 on “Site access request”


| Step | Status | Message | Rounds |
| --- | --- | --- | --- |
| Duplicate & ghost worker | FLAGGED | This person already has an active badge from an earlier request |  |
| Duplicate & ghost worker flagged: escalation | ESCALATED | They must approve (it carries on), reject with a comment (it stops), or send it back to the requester. Chaser reminds after 24h and escalates to their manager after 48h | 1. Information Security (Ravi Kumar) · Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn’t eligible for Information Security decisions, so Ravi Kumar (backup) approves |
| Security approves access | COVERED | The same person already approves this kind of decision on this path |  |
| Identity & site details | VERIFIED AUTOMATICALLY | Asked of Worker (Sam Rivera): Photo ID, Date of birth, Signed site safety rules. Verified by Persona · Worker sees: Done |  |
| Background check | VERIFIED AUTOMATICALLY | Asked of Worker (Sam Rivera): Criminal record. Verified by Checkr · Worker sees: Done |  |
| Issue the badge | DONE IN BADGE SYSTEM | Create badge in Badge system, matched on Personal email, 7 fields sent; waits up to 24h for Badge system to confirm. Ledger: Site badge (remove access at exit) |  |
| Badge ready | SENT | Email to Worker (Sam Rivera), Sponsor (Tom Reed) |  |

### 19.1 Variants (configuration changes from the acceptance scripts)

| # | Script | Change, then Test | Expected (build) | Prototype difference |
| --- | --- | --- | --- | --- |
| V1 | A5 | UK Technology work orders → Duplicate & ghost worker → If it flags something: “Reject it and send it back to the requester” → WO-2240 | Summary "No one needs to approve on this path. Rejected at “Duplicate & ghost worker”. It goes back to the requester with the reason; Levv tells Hiring manager." Steps: Budget check · PASSED · "$40K left in plan after this request"; Duplicate & ghost worker · FLAGGED · "Same person is active through another supplier (WO-1877)". No rule approvers, no flags line. | Prototype still shows "⚑ Marked: Registration required (later steps can react to this)" (§20 D20). |
| V2 | A6 | Work order submitted → Rate over card? → Otherwise → Then “Reject it and send it back to the requester” → WO-2231 | "1 approval round on this path. Rejected at “Rate over card?”. It goes back to the requester with the reason; Levv tells Hiring manager." Steps: Budget check PASSED "$30K left in plan after this request"; Duplicate & ghost worker PASSED; Business sign-off APPROVAL "Together. If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h", round "Hiring manager (Raj Patel) · Grace Kim raised this request, so the step moves up to Raj Patel (Operations Director); Raj Patel also covers Cost center owner. Same kind of decision, so one approval". Canvas: a red ✕ "Rejected" End on the Otherwise line. | none |
| V3 | A7 | Same If → Otherwise → “Escalate: someone must decide” → Escalate to: Finance controllers → WO-2231 (on a fresh workflow, or after V2 and “Carry on”) | Card rows "Over 10% · → Rate review", "Otherwise · escalate · Finance controllers". "2 approval rounds on this path." Steps: Budget check, Duplicate & ghost worker (PASSED), Business sign-off (as V2), "Otherwise: escalation" · ESCALATED · "They must approve (it carries on), reject with a comment (it stops), or send it back to the requester. Chaser reminds after 24h and escalates to their manager after 48h", round "Finance controllers (any one of Chloe Martin, Lena Fischer, David Okafor)"; Tell the supplier · SENT · "Email to Supplier account manager". Decisions end "Rate over card? → Otherwise; Value band → Otherwise". | After V2 → Carry on, the prototype routes Otherwise into Rate review (merge-point bug, §20 D22): "3 approval rounds", Rate review (Owen Clarke) after the escalation, card "Over 10% · carries on". Group text repeats the name: "Finance controllers (Finance controllers: any one of …)" (§20 D11). |
| V4 | A8 | Same If → Otherwise → “Ask someone to approve” → Who approves: Chloe Martin → WO-2231 | Card "Otherwise · approval · Chloe Martin". "2 approval rounds on this path." Business sign-off (as V2); "Otherwise: approval" · APPROVAL · "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h", round "Chloe Martin"; Tell the supplier SENT. | Prototype (after V2/V3) also lists Rate review after Chloe Martin (§20 D22). |
| V5 | I1–I2 | + New workflow (Work order submitted) → + after Start → Approve → Who approves: Cost center owner → WO-2231 | "1 approval round on this path." Notice "For real requests, “Work order submitted” runs for this record." "Approval" · APPROVAL · "If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h", round "Cost center owner (Raj Patel)". | none |
| V6 | N5 | Work order submitted → Business sign-off → Remind after 12 → WO-2231 | Business sign-off message ends "Chaser reminds after 12h and escalates to their manager after 48h". | none |
| V7 | W10 | Site access request → Identity & site details → Who provides it: Sponsor → AR-301 | Card subtitle "Sponsor provides · Persona, then Information Security". Step: VERIFIED AUTOMATICALLY · "Asked of Sponsor (Grace Kim, or their delegate Raj Patel): Photo ID, Date of birth, Signed site safety rules. Verified by Persona" · Worker sees: Done. Chaser box: "Then escalate to their manager after (hours)". | none |
| V8 | P1–P2 | Job posting created → switch Active off → JP-5120 | Top bar "Inactive · v1". Test: first "This workflow is inactive. Real requests don’t use it. Below is what it would do if you turned it back on.", then the summary "No one needs to approve on this path. Approved automatically. No one had to act." Steps as E20. | none |
| V9 | A9 + edit | Assignment changed → ASN-881 → “Try an edit: Manager shortens the extension to Mar 31” | "3 approval rounds on this path." Decisions "Tenure & classification → Passed; Tenure over 18 months? → No; Within plan? → Outside plan; New total over $250K? → Yes; Rate changed? → Yes". Steps: Tenure & classification PASSED "17 months engaged after this change (cap 18)"; Within plan? OUTSIDE THE PLAN; Budget owner APPROVAL round "Cost center owner (Lena Fischer): Stands"; Finance sign-off APPROVAL round "VP Finance (David Okafor): Waiting"; Rate review APPROVAL round "Procurement (Owen Clarke): Waiting"; Auto-approve if no one else needed NOT USED; Tell the supplier SENT. "Removed by the edit": "HR business partner: approved, no longer needed", "Legal: withdrawn, approver told". Button now reads "Undo the edit". Unedited, round items carry ": Approved" (Erin Walsh, Lena Fischer) or ": Waiting". | Prototype shows the re-planned steps without the status suffixes or the removed block (§20 D7). |
| V10 | A17 | Assignment changed → ASN-920 → “Use $96/h” (or “Use $102/h”) | Line "✓ Using $96/h from Grace Kim. Raj Patel has been told, and approval links for the other version no longer work." with Undo; summary "No one needs to approve on this path. Approved automatically. No one had to act."; steps as E14. ($102/h: "Using $102/h from Raj Patel. Grace Kim has been told, …", same steps.) | none in Test (Test applies only `total`); production also applies the proposed rate (§20 D13). |
| V11 | — | Work order submitted → Rate over card? → Otherwise → “Stop the workflow and tell someone” → Who to tell: Hiring manager → WO-2231 | "1 approval round on this path. Stopped at “Rate over card?”. Levv tells Hiring manager." Steps: Budget check, Duplicate & ghost worker, Business sign-off (as V2), "Otherwise: tell them it stopped" · SENT · "Email to Hiring manager (Grace Kim)". The run ends `stopped`. | Prototype ends Completed and prints no Stopped sentence; on a flagged check set to Stop (WO-2240) it even keeps the rule approvers as a round (§20 D23). |
| V12 | — | New workflow → Approve (no approvers) → Auto-approve before it → WO-2231 | "No one needs to approve on this path." Notice "For real requests, “Work order submitted” runs for this record." Auto-approve · NOT USED; Approval · CHOOSE WHO APPROVES · "Pick who approves this step. Nothing is approved automatically". Nova: "“Approval” doesn’t say who approves yet." | Prototype shows Approval COVERED and Auto-approve APPROVED AUTOMATICALLY (§20 D6). |

### 19.2 Other acceptance checks (non-Test)

| Script | Expected |
| --- | --- |
| A18 | §17.1 example. |
| A19 | Nova: "“Rate review” names Chloe Martin with no backup. If they’re away, it pauses." header "Nova checked this flow against 140 real records from the last 90 days." |
| I3 | If panel: "Levv checks the paths from the top and takes the first one that matches. If none match, it goes to “No”. All paths meet again at “Approval”." Then options: “Carry on to “Approval””, "Ask someone to approve", "Escalate: someone must decide", "Reject it and send it back to the requester", "Stop the workflow and tell someone". |
| I6 | "+ Add a path" → "Path 2" goes to the merge step ("Approval"), "No" becomes "Otherwise". |
| I9 | Setting the last carrying-on path to Reject is refused: toast "At least one path has to carry on". |
| I10 | "Delete path" removes the path and its generated step. |
| I11 | Rule text "Engagement type is Off-payroll and (Total value ≥ $250K or Regulated role is yes)". |
| I12 | "Path “Off-payroll” in “Over $500K?” has no conditions, so it matches everything." |
| W12 | System "If it fails" → Failed path adds out `failed` → task; switching back removes it. |
| W13 | Delete Budget check → Start goes to Duplicate & ghost worker. |
| W14 | Wait panel sentence: "Waits until Start date, 09:00 in the worker’s time zone. If the date on the record changes, the wait moves with it." |
| W15 | Background check → If it fails: "Ask people to decide", HR business partner + Legal; "They approve to carry on, or reject to stop." |
| P1, P3–P6 | §13–§14 texts. |
| Counts | History counts: Work order submitted 140, UK Technology work orders 16, Data and AI hires 26 (overlap with UK Technology work orders: 2), Contractor onboarding 40, Assignment ending 30, Assignment changed 60, Job posting created 50, SOW created 36, SOW change order submitted 24, Timesheet submitted 60, all others 0. |

---

## 20. Deviations from prototype v35 (build these)

**Final decisions R1–R12 (final decisions (00 §3)) are applied throughout this spec and `02-data-model.md`.** R1: every item D1–D29, D31 and D32 below is required production behaviour; D30 stays kept. R2: new workflows default "When a request is finally rejected, tell" to Hiring manager. R3: first publish = v1. R4: Approve naming and empty group/person modes. R5: one escalation timer (the generated Approve node's `sla`). R6: Chaser `sla > remind` validation (L18). R7: impact count as in the prototype. R8: identical scopes overlap. R9: overlap choice applies on approval; approver = any user with "Approve flow changes" who is not the author. R10: failed-check deciders may be operational roles; only the worker is excluded. R11: absences compare `until` with `asOf` (tests 2026-10-20). R12: D2 stays a data note; engine and seed rule events unchanged.

Each item: what the prototype does → what to build → why. Items marked "kept" document prototype behaviour that is intentionally preserved.

| # | Prototype v35 | Build | Why |
| --- | --- | --- | --- |
| D1 | Test walks the graph twice: the canvas/decisions use the raw record, the approval plan uses the change-amount basis. SOW-77-CO3 shows "Value band → Over $1M" and "Finance and VP review: Covered" while the real approver (Finance review, Chloe Martin) is never shown. | One walk with the basis-adjusted record (§6.2–§6.3) for If conditions, "Only needed when" and signing limits; approval rules and checks use the actual record. | The two walks disagreed; the shown path and the asked people must match. Changes acceptance A14 (see E18/E19). |
| D2 | Approval rules match on `event === 'submitted'`; SOWs and job postings now start on `created`, so "Client data access" never applies to new SOWs. | Engine and seed rule events unchanged (R12). Data note for the admin area: rules need the right event per record (SOW `created`). | Data issue outside Flow Studio. |
| D3 (kept) | Approve, Auto-approve, Fits plan? and checks never put later steps into Waiting in Test. | Keep, and say so in the Test help: Test shows the rest of the path as if every approval is given. | Lets the admin see the whole path. Runtime still waits (§15, items 4–5). |
| D4 | "Waiting on Registration required?" (names an If). | Name the nearest real blocking step ("Waiting on Background check"). | Plain words. |
| D5 | Rule tasks (IR35 "Record IR35 status") are invisible in workflow Test; rules are ignored on workflows with no Approve/Auto-approve step; a rule-only round is not shown under any step. | Show rule tasks under the step whose round they joined; apply rules to every matching workflow; show rule-only rounds in "From approval rules". | Compliance must be visible and must apply everywhere. |
| D6 | An Approve step with no approvers shows "Covered" and lets Auto-approve approve; switching to group/person auto-picks the first group / person. | Show "Choose who approves" (fail) and block auto-approval; group/person modes start empty ("Choose a group" / "Choose a person"), canvas "Approval" / "Choose who approves" (R4). Publish is blocked (L11). | Never approve automatically when an approver is missing. |
| D7 | "Try an edit" re-plans but shows no Approved / Stands / Asked again / Waiting / New, and no "Removed by the edit". | Show them (§8.4). | `reaskOnDecrease` is otherwise invisible. |
| D8 | A named person who is away is replaced by their personal delegate (backup ignored). Lint says "If they’re away, it pauses." | Away → the step's `backup` ("{p} is out until {until}, so {backup} (backup) approves"); no backup → paused ("{p} is away and no backup is set"). | Matches the warning and the purpose of naming a person. |
| D9 | Paused note always says "(owner: Procurement operations)". | Use the workflow's `owner`. | Correct owner. Same text for every seed example. |
| D10 | Tasks, reviewers and notifications use a simpler resolver that ignores `hiring_manager` and `BY_COUNTRY`; reviewer/task labels are always "Role (name)" (e.g. "Worker (the worker)"). | One resolver (§6.6) and `personLabel` everywhere. | Consistency. No seed example changes. |
| D11 | Group items print "Finance controllers (Finance controllers: any one of …)". | "Finance controllers (any one of …)". | Repeated name. |
| D12 | "This is a executive sign-off". | "This is an executive sign-off". | Grammar. |
| D13 | Choosing a conflicting proposal only changes `total_value`. | Test: same (samples carry only `total`). Production: apply the proposed field value and recompute derived fields (e.g. `rate_change_pct`). | Correct re-planning. |
| D14 | List values print raw keys ("Fields changed includes bill_rate"). | Replace `_` with a space ("includes bill rate"). | Plain words. |
| D15 | A number row with an empty value compares against 0. | An empty number never matches; lint could flag it later. | Avoid accidental matches. |
| D16 | Test silently runs the open workflow even when another would run for that record. | Add "For real requests, “{winner}” runs for this record." | Avoid confusion between variations. |
| D17 | A failed check with "Ask people to decide" drops the "Asked of …" prefix. | Keep the prefix. | Consistency. |
| D18 | A System step on a disconnected system shows "Done in Coupa". | Show "Paused: not connected" (review) with the not-connected sentence. | It does not run. |
| D19 | Run workflow shows the kind name and no message. | "Started" · "Starts “{target}”". | Plain words. |
| D20 | Flags line shows even when the request was rejected before anyone was asked. | Hide it then, like rule approvers. | Consistency. |
| D21 | Needs information keeps only the last If and always says "is missing". | Keep every hit; "are missing" for 2+ fields. | Completeness. |
| D22 | Where paths meet is recomputed from the current outs; after Reject → Carry on, Otherwise is sent into the other path's step (Rate review). Acceptance A7/A8 expectations include that Rate review. | Store `mergeAt` on the If and use it (§16.2, §16.4). Update A7/A8 expectations (V3/V4). | Bug: Otherwise must rejoin where the paths meet. |
| D23 | "Stop the workflow and tell someone" goes to the normal End (Completed); a check set to Stop still asks rule approvers; no Stopped sentence. | Generated Notify → End outcome `stopped`; treat like rejected for rule rounds; summary "Stopped at “{by}”. Levv tells {role names}."; run status `stopped`. | A stop is not a completion. |
| D24 | Workflow Nova has no overlap or unreachable-step checks; identical Applies to (e.g. two Everywhere) is not an overlap. | Add L13–L17; overlaps include identical scopes. | Doc promises these checks; identical scopes do overlap. |
| D25 | A new Background check preset has no `failRoles` and is immediately blocked from publishing; its menu line still says "adverse results go to an approval". | Default `failRoles: ['hrbp','legal']`, `failMode: 'all'`; description "Criminal, credit and sanctions checks; adverse results go to the people set under “If it fails”". | Matches the seeded steps and v34 wording. |
| D26 | Publish says "1 records". | "1 record". | Grammar. |
| D27 | "Amount to compare for changes" (`basis`) exists in data but has no control in workflow settings. | Show it in workflow settings when the event is `changed` or `change_order`: label "Amount to compare for changes", options "The new total" / "The change amount" / "The running total of all changes", help "Value conditions in this flow use this amount. Running total stops many small changes adding up past a limit unseen." | Otherwise un-editable. |
| D28 | Absence is a fixed flag ("out until Oct 24" always applies). | Compare `until` with `asOf` (tests use 2026-10-20). | Real dates. |
| D29 | Inactive warning pluralises by adding "s" to the lower-case label ("sows"). | Proper plurals ("SOWs", "job postings", "access requests"). | Grammar. |
| D31 | Escalation hours stored separately (`elseSla`, path `sla`, `flagSla`) and collect failures escalate without a step. | One timer: every escalation is an Approve node with `escalation:true` whose Chaser `sla` is edited by the hours box; Collect & verify failures get a generated escalation (§16.12) (R5). | One rule for all escalations. |
| D32 | No check that escalation comes after the reminder. | L18 and inline error (§16.13) (R6). | Avoid escalating before reminding. |
| D30 (kept) | "Any one" items only drop the requester (no delegation, limits or move-up). | Keep for v1. | Open question for product; see 00-overview §7 item 1. |

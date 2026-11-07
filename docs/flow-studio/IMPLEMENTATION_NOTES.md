# Flow Studio implementation notes

Written in M0. Later milestones read this first and keep it current. "Verified" below means it was run or read in the repo on 2026-11-01, not assumed.

Worktrees: website `/Users/abdullahmohamed/LevvAI/flow-studio-website`, backend `/Users/abdullahmohamed/LevvAI/flow-studio-backend`, both on branch `flow-studio`.

---

## Binding decisions

Made by the project owner before M0. Every milestone follows them. Each one lists what M0 found when checking it against the code. **Three corrections** came out of that check: 1a, 2a and 2b. They are marked and resolved here, so follow the corrected form.

### 1. Routes

A shared Flow Studio shell component takes a base path. `/admin/workflows` and `/admin/workflows/[workflowId]` render it inside the admin layout, which is what the user asked for. `/flow-studio` and `/flow-studio/[workflowId]` render the same shell full-page, per 04 §2, and are what the acceptance tests drive.

UI-N1 requires `text=Settings` count 0 in the DOM, and the admin sidebar heading says "Admin settings", so `/flow-studio` routes render without the admin layout and without any app-shell text containing "Settings". The "Admin settings" heading on `/admin/workflows` is a **deliberate exception**. Add `/flow-studio`, `/runs` and `/inbox` to the `middleware.ts` internal prefixes and matcher. `/admin/workflows` must fit the canvas in the admin content column at 1440 wide. Existing Approval Chains and Workers workflow features stay untouched; this is additive.

Checked:

- **1a. Correction: the app shell is not in `ClientShell`.** `app/ClientShell.tsx` is dead code: nothing imports it, and `grep -rn ClientShell app lib src` finds only the file itself. The sidebar, header, session fetch and "Settings" nav link are all inline in `app/layout.tsx`, which is a `'use client'` root layout. `/external` skips the shell through the `isStandalone` list in `app/layout.tsx:172`. **Implementation: add `pathname.startsWith('/flow-studio')` to `isStandalone`.** Leave `ClientShell.tsx` alone.
- Standalone pages get no `/api/session` fetch, no `SessionProvider` (default is `{user:null, checking:true}`) and no `CWRequestProvider`. The Flow Studio shell must not call `useSession()`; it gets identity from `/api/flow-studio/*`.
- The "Settings" sidebar link only renders for admins (`layout.tsx:446`). `PAGE_SEARCH_ITEMS` entries only reach the DOM as search results. Standalone removes both.
- `text=` in Playwright is a case-insensitive substring. An open "Workflow settings" panel or the Test drawer's "Approval rules add approvers" text would match UI-N1's locators. **Closed panels and drawers must not be in the DOM** (not hidden with CSS).
- `/admin/*` in `next.config.js` is a *fallback* rewrite, so a real Next page wins locally. Production differs: see "Deployment prerequisites".
- **Admin column at 1440×900, measured from the classes:** 1440 − 280 (sidebar) − 64 (outer `main` `lg:p-8`) − 240 (admin aside) = 856 wide for the admin `main`, 792 inside its padding. Height 900 − 80 (header) − 64 = 756. 04 §2.2's `h-[calc(100vh-78px)]` overflows here by about 144, so the shell takes `variant: 'page' | 'embedded'`. In embedded mode it fills its container and never uses `100vh`.
- **Embedding must escape `app/globals.css`.** It has 93 `body.flex main.flex-1 …` rules, many `!important`, that restyle anything inside the shell's `<main>`: `.bg-slate-950` becomes `#101b3c`, `.bg-cyan-600` becomes `#2563eb`, plus rules on bare `button`, `a` and `.rounded-*`. That contradicts 04 §1.2. Standalone escapes because its body has no `flex` class. **M4 decision:** `/admin/workflows` renders a placeholder filling the admin `main` (856 wide) and portals the shell to `document.body` with `position: fixed`, tracking the placeholder's rect with a `ResizeObserver` (the sidebar collapse changes the column without a window resize). z-index stays below the header (z-20) and sidebar (z-30) so the account menu still opens over it. Do not edit the 93 rules; other pages depend on them. If the portal causes trouble, the fallback is a counter-sheet scoped to `.fs-root`.
- **1b. Correction (M4): the column is only 756 tall because M4 makes it so.** The arithmetic above left out the admin aside's own `h-[calc(100vh-5rem)]` (820 at 900 tall). It stretches the admin row, so on every other admin page the document is 964 tall and scrolls by 64. Pinned over that, the shell would move under the header on a stray wheel. So `app/admin/layout.tsx` gives the aside `h-[calc(100vh-9rem)]` at `lg` (and the `p-5`, `p-6` equivalents below it) and drops `main`'s padding, on `/admin/workflows*` only. Result, asserted by test: host at 552,112, 856×756, document exactly 900 tall. The portal plan itself held; details in "M4: UI foundation".
- Canvas at 856: 778 after the 78 rail; a 390 drawer leaves 388. Nothing is geometrically impossible, but Fit will clamp (04 §4.9), so wide workflows scroll. The top bar can reach about 1020 in the worst case, so embedded mode truncates the picker button rather than wrapping. Add our own Playwright test for this in M4; it is not one of the 239.
- `/runs` and `/inbox` render inside the normal app shell (01 §2's "signed-in pages"; there is no `(app)` route group in this repo, so they are plain `app/runs`, `app/inbox`). M4 to M7 accepted that the globals overrides turned their chips blue and the run canvas navy. **M8 fixed it:** on these routes `app/layout.tsx` gives `main` `grow basis-0` in place of `flex-1`, the same flex but not the rules' hook, so the 93 rules stay as they are and no other page changes. Asserted by computed colours, with a negative control.
- Fixed `/flow-studio/...` paths in 04 §3, §12 and the not-found button all use the base path prop. The `/flow-studio` redirect needs `localStorage`, so it is a client page.

### 2. Storage

The spec's repository interfaces (01 §4.3) get two implementations: in-memory (Vitest, and the e2e app when `LEVV_E2E=1`, so Playwright needs no Django) and Django-backed. A new tenant-scoped Django app `apps.flowstudio` in `TENANT_APPS` stores the 01 §4.1 entities, with `draftRev` / `rev` optimistic concurrency enforced atomically in Django. All business logic stays in TypeScript: Next route handlers run the engine and call Django for storage only, forwarding the session cookie and the tenant host. Do not add Prisma. Selection is by env: `FLOW_STUDIO_STORE=memory|django`.

Checked:

- **2a. Correction: do not use a plain Django `JSONField`.** On Postgres it is `jsonb`, which reorders object keys by length then bytes. Verified by round trip on local Postgres: `{"T","region","bu","n10","n2"}` came back as `{"T","bu","n2","n10","region"}`. On the seed, this changes `draft.nodes` key order in **13 of 15 workflows**. 03 §12 (line 626) iterates "`draft.nodes` in stored key order", so Nova's lint order would differ from the expected results. 03 §1.4 prints scope "in the object's key order", and the dirty check compares JSON.
  **Resolution:** `apps/flowstudio/fields.py` defines `OrderedJSONField(models.JSONField)` with `db_type() -> 'json'` (Postgres `json`, not `jsonb`) and a `from_db_value` that returns already-decoded values, because psycopg2 decodes `json` columns itself. Round trip verified through the Django ORM on local Postgres: order, nested order, `null`, floats and booleans all preserved. Nothing queries inside these columns, because logic stays in TS.
- **2b. Correction: forwarding the session is not enough protection on its own.** Store endpoints are generic reads and writes, and permissions live in Next. Any tenant member could use their own cookie to call the store directly on the backend's Cloud Run URL and rewrite a workflow, skipping Next's checks. `TenantMembershipMiddleware` also lets active-worker sessions through without a membership.
  **Resolution:** every store route also requires a shared secret header, `X-Levv-Store-Token` = env `FLOW_STUDIO_STORE_TOKEN` on both services, compared in constant time. If the env is unset, the store returns 503 (fails closed). When a session cookie is forwarded, Django also enforces session, CSRF and active membership (`IsTenantMember`, never bare `IsAuthenticated`). With no cookie and a valid token, the call runs in a service context. The session cookie and tenant host are still forwarded as decided.
- **How the website reaches Django server-side today: it doesn't.** Verified: no server-side code in the repo calls Django. All `lib/api/*` modules are `'use client'` and same-origin. `LOCAL_BACKEND_URL` is read only in `next.config.js` for fallback rewrites, and no production backend URL exists in the website. New env `FLOW_STUDIO_BACKEND_URL`, falling back to `LOCAL_BACKEND_URL` for local dev. Production value per `flow-studio-backend/docs/tenants.md`: `https://levvai-backend-245852154678.us-east1.run.app` (confirm in `cloudrun.env`, which is gitignored). Rewrites are read at build time, so they do not help server-side calls anyway.
- **Store path:** Django mounts `path("flowstudio-store/", include("apps.flowstudio.urls"))`. It is deliberately outside `/api/`, `/admin/` and the rewrite list, so browsers cannot reach it through the load balancer or the local proxy.
- **Request shape, Next to Django. Verified with Node `fetch` against local Django:**

  | Header | Value |
  | --- | --- |
  | `cookie` | only `sessionid` and `csrftoken`, when user-initiated |
  | `x-csrftoken` | the browser's header **as received; never synthesised from the cookie**, or the check becomes meaningless |
  | `origin`, `referer` | forwarded from the browser |
  | `x-forwarded-host` | the resolved tenant host, including port |
  | `x-forwarded-proto` | the incoming protocol |
  | `x-levv-store-token` | the shared secret (2b) |

  Results: no CSRF token gives 403 "CSRF token missing". Token over http passes. Token with `x-forwarded-proto: https` and no Origin/Referer gives 403 "no Referer". Token plus matching Origin passes, even on a port not in `CSRF_TRUSTED_ORIGINS`, because Django compares Origin with `scheme://get_host()` and `USE_X_FORWARDED_HOST=True`. Wrong Origin gives 403. Unknown tenant host gives 404 from `TenantMainMiddleware`.
- **CSRF cookie:** `login()` sets a JS-readable `csrftoken` cookie (verified on the login response). The Flow Studio client helper sends `X-CSRFToken` the same way `lib/api/*` does.
- **Mutating reads.** `GET /api/flow-studio/workflows/:id` sets `authorNotifiedAt`. A GET has no CSRF token, so that one write goes through the service context, not the forwarded session.
- **Tenant host resolution**, one function, first match wins:
  1. `x-forwarded-host`, then `host`, if `isTenantHost()` or `localhost` / `127.0.0.1`.
  2. Header `x-levv-tenant-host`.
  3. The host of `Origin`, then `Referer`.
  4. Otherwise 400.

  Why more than the Host header: the load balancer docs mention a frontend host rewrite, and `lib/tenant.ts` special-cases `.run.app`, so in production Next **may not see the tenant host** on the Host header. I could not check the live URL map. The client helper always sends `x-levv-tenant-host: location.host`. Spoofing it is harmless on user calls because Django checks the session is bound to that tenant (`is_session_bound_to_tenant`), and on service calls because the caller already holds a secret. Page server components therefore do not fetch data; client code fetches through `/api/*`.
- **Cron tick and service-token routes have no session.** One call acts on one tenant, resolved with the function above. Cloud Scheduler runs one job per tenant, calling `POST https://{tenant}.levvai.com/api/runtime/tick` with `x-levv-cron-secret`; the same applies to `/api/runtime/events` with `x-levv-service-token`. Next then calls the store in service context. This is the simplest option and adds no public-schema endpoint. Cost: provisioning a tenant must also create its job. If that gets painful, add a fan-out later.
- **In-memory store and module state.** Verified with `next start`: `globalThis` state is shared between route handlers and server components in one process. Keep the memory store and the test clock on `globalThis`. Middleware runs in a separate sandbox and cannot read it.
- `FLOW_STUDIO_STORE` defaults to `django`. `memory` is refused unless `LEVV_E2E=1` or under Vitest, so production can never silently hold workflows in memory.
- **Next 13 caching.** A `GET` route handler that doesn't read the request is statically cached at build, and server `fetch` caches by default. Every Flow Studio route exports `dynamic = 'force-dynamic'` and `runtime = 'nodejs'`, and every store call uses `cache: 'no-store'`.
- **Serialization hazards (both repos).** `plan.walk.path` is a `Set` (`JSON.stringify` gives `{}`), and `LIMIT` `Infinity` round-trips to `null` (02 §15). 02 §0 says null versus absent affects results. Use one codec module for runs. Store reference data as seeded and normalise on read. **The in-memory repo also JSON round-trips on write**, so these bugs show up in Vitest rather than only against Django.
- **Atomic multi-writes.** `advance()` writes the run, events, work items and outbox together, and publish writes the version, workflow, request and inbox copies. Separate HTTP calls could half-apply, so the store exposes one `POST flowstudio-store/tx/` endpoint that runs a list of writes in `transaction.atomic()` with their `rev` checks. Repo methods stay as 01 §4.3 describes. `UPDATE … WHERE rev = expected` gives the conflict result.
- **Payload sizes (minified, measured from the seed):** largest workflow `wf-onboard` 10.6 KB, all 15 workflows 74.7 KB, history 158 KB, samples 13 KB, reference 37 KB. Well under Django's 2.5 MB `DATA_UPLOAD_MAX_MEMORY_SIZE`.

### 3. Database safety

The user's real backend `.env` points to a hosted Supabase Postgres. NEVER connect to it, run migrations on it, or seed it. Never read or copy `levvai-backend/.env` or `levvai-website-main/.env.local`. Backend work uses the local Docker Postgres from `docker-compose.local.yml` (127.0.0.1:5433) with `scripts/local-env.sh` values, using the Python at `/Users/abdullahmohamed/LevvAI/levvai-backend/.venv`. Always pass `DATABASE_URL` explicitly for localhost.

Checked, holds:

- The backend worktree has no `.env`, and `settings.py` loads only `BASE_DIR/.env` by explicit path, so the sibling's file cannot be picked up. The website worktree has no `.env.local`.
- `scripts/local-compose.env` is empty on purpose. Compose project `flow-studio-backend` gets its own volume and container `flow-studio-backend-postgres-1`.
- **If `levvai-backend`'s own compose stack is up, it holds port 5433 and our `up` fails.** Check `docker ps` first. Don't work around it by pointing at the other database.
- Do not use `scripts/run-local.sh`: it makes a venv in the worktree and prompts for a password.

Exact commands:

```sh
cd /Users/abdullahmohamed/LevvAI/flow-studio-backend
docker compose --env-file scripts/local-compose.env -f docker-compose.local.yml up -d --wait
export DATABASE_URL=postgresql://levvai:levvai@127.0.0.1:5433/levvai_local \
  DJANGO_SECRET_KEY=local-development-only-secret-key DJANGO_DEBUG=true \
  DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1 DATABASE_CONN_MAX_AGE=0
PY=/Users/abdullahmohamed/LevvAI/levvai-backend/.venv/bin/python
$PY manage.py migrate_schemas --shared && $PY manage.py migrate_schemas --tenant
$PY manage.py test --noinput
```

M0 left this running: the local container is up, migrated, with tenant `local` on `localhost` and `127.0.0.1`, and admin `admin@local.levvai.test` (`LOCAL_ADMIN_PASSWORD=… manage.py bootstrap_local_dev` resets the password).

`npm run seed:flow-studio` (M3) talks to a URL rather than a database. It must **refuse any backend host other than localhost / 127.0.0.1** unless `FLOW_STUDIO_SEED_ALLOW_REMOTE=1` is set, and M3 must not set it.

### 4. Tooling

Node 20: run commands with `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && ...` (shell default is Node 16; `.nvmrc` is committed). `zod` is a dependency; `vitest`, `@playwright/test` and what `npm run lint` needs are dev dependencies. Root tsconfig keeps `strict:false`, `target:es5`, and alias `@/*`→`app/*`. A strict tsconfig covers Flow Studio code and backs `npm run typecheck`. Root `next build` type-checking must still pass, so tests are excluded from the root tsconfig. `./src/**/*.{ts,tsx}` is in tailwind content.

Done in M0. Pinned: zod 3.25.76 (satisfies openai's peer range), vitest 3.2.7, @playwright/test 1.64.1, eslint 8.57.1, eslint-config-next 13.5.6, @types/react-dom 19.2.3 (was missing; strict code that uses `createPortal` needs it; matches the repo's @types/react 19). TypeScript resolves to 5.9.3.

Things this decision had to account for:

- **Root `target: es5` also type-checks Flow Studio code during `next build`,** because `.next/types` imports every page, so excluding those folders from root doesn't help. Probed:
  - `for…of` and spread over `Set`/`Map` fail with TS2802 (the spec uses `WalkResult.path: Set`). **Fix applied:** root `downlevelIteration: true`. It is type-only with `noEmit`, and the root build still passes.
  - Regex named groups, and the `s` and `u` flags, fail with TS1501/TS1503. **Rule: do not use them in app-reachable code.** Same for `#private` fields and BigInt literals.
  - `tsconfig.flow-studio.json` deliberately inherits `target: es5`, so `npm run typecheck` catches all of this before `next build` does.
- **Installing ESLint would have broken `next build`.** It starts linting, and existing code has 28 `react/no-unescaped-entities` errors in 15 of 272 files. So `next.config.js` sets `eslint.ignoreDuringBuilds: true` and `npm run lint` covers Flow Studio paths only. Existing code stays as it is.
- Importing into strict-checked code pulls the imported file into the strict program. Probed clean: `@/lib/intelligence/gpt/callGPT`, `@/lib/tenant`, `@/lib/utils`, `@/components/ui/button`, `@/components/ui/levv-app`. Anything else may surface errors in old code; check before importing.
- New aliases, added to root so Next honours them and mirrored in `vitest.config.ts`: `@flow-studio/*` → `src/flow-studio/*`, `@flow-studio-ui/*` → `src/components/flow-studio/*`.
- `test:engine` had `--passWithNoTests` so M0 was green; M1 removed it, so no tests now means failure. `test:e2e` exits with "No tests found" until M4. `seed:flow-studio` runs TS with `vite-node`, which vitest already brings, so no new dependency.
- Playwright uses port 3310, because 3000, 3100 and 3200 are taken by other projects on this machine, and `LOCAL_BACKEND_URL=''` so nothing proxies to Django.

### 5. Identity and permissions

**Replaced after the post-build review.** The owner's original decision mapped a session user to a person by "first_name last_name". `dj_rest_auth`'s `PATCH /auth/user/` lets anyone set those, so on local Django a viewer who renamed themselves "Raj Patel" read Raj's inbox and approved for him, a user renamed "Procurement operations" paused that team's runs, and an author who renamed themselves approved their own change. The project owner overruled it. This is what holds now:

- **Authority comes from the Django user id.** `first_name` and `last_name` are never read. The email is read only as what an unlinked account shows as, because that route can't change it (`read_only_fields = ('email',)`; it can change `username`, so that isn't used either).
- **A person or team in reference data links to an account in `AccountLink`** (`apps.flowstudio`, migration `0003_account_link`): `id` = the Django user id, `doc` = `{accountId, email, person, teams, linkedBy, linkedAt}`. It lives in the tenant schema, so a link holds only in the tenant it was made in, and `fs_link_one_account_per_person` keeps one account per person. Seed field names are unchanged (AGENTS rule 7); this is beside them.
- **Only `reference.import` sets it**, through `GET/POST /api/flow-studio/account-links` (additive; no screen). The route refuses an account that isn't an active member (`NOT_A_MEMBER`), a person not in `PEOPLE` (`NOT_A_PERSON`), a team no workflow is owned by (`NOT_A_TEAM`), and a person already linked (`PERSON_ALREADY_LINKED`). `person: null` unlinks.
- **`Actor` is `{id, name, person, email, permissions, ownerTeams}`.** `id` is the account. `person` is the link, or null. `name` is what the screen and audit lines show: the person, or the email. `server/session.ts` `actorFromSession` is the one place that makes one from a real session, and it always sets `person`.
- **An unlinked user holds no person identity:** an empty inbox, no item they can open or answer, and nobody's approver, including of a flow change (`copy.notLinked`). `store.actingUsers()` returns only linked admins, so "is there someone else who can approve" and the inbox copies follow, and a tenant with nobody linked shows "nobody else can approve" as a must-fix. They can still do what their role allows without being anybody: an unlinked admin edits, sends and links.
- **What is checked by id:** publish authorship (`isAuthorOf`, `PendingPublish.submittedById`, `PublishRequest.requestedById`, version `submittedById` and `approvedById`), the "own change" refusal, `othersCanApprove`, the published notice, and owner teams (`ownerTeams` maps a team to account ids, from the link). **What is checked by the linked person:** `item.assignee`, the requester and worker guards, `workflow.owner` when it names a person. Assignments stay person names, as the seed and the engine have them, so work assigned before a link appears the moment it is made. **Audit:** a log line and a decision carry `byId` beside `by`.
- **E2E actors are unchanged:** `/api/test/sign-in`, `test-actors.json` and all 06 tests as written. A test actor is its own account and its own person. Where `id === name` the `byId`, `submittedById` and `requestedById` keys are left off, so RT-01, RT-02, RT-04, RT-12 and LP-10 read what they always read. Two of 06's tests call the service with a bare `{name, permissions, ownerTeams}`, so `id` and `person` are optional in the type and `personOf` reads an absent `person` as the name. That can't be reached from a route: `currentActor` always sets it, and `tests/api/identity.test.ts` asserts so.

Checked, holds:

- `GET /api/session` returns `{authenticated, user:{id,email,first_name,last_name}, profile, membership:{role,…}}` (verified live). Roles: `admin`, `manager`, `business`, `supplier`, `finance`, `viewer`. Next calls it per request, uncached, through the store client's header rules, then reads the link row, so unlinking or ending a membership takes effect on the next request. A session with no membership (a worker) holds no link, and the store isn't asked.
- **Tenant role `admin` maps to spec permission `admin`; other users have no Flow Studio permissions beyond their own inbox items.** That part of the original decision stands.
- **Middleware rewrite verified with a probe:** built with no `LEVV_E2E`, then `LEVV_E2E=1 next start` rewrites `/api/session` to a Node route and returns 200; without the env it is 404. So env is read at runtime and no separate build is needed. Add `/api/session` to the matcher. Target route: `/api/test/session`.
- A permanent `app/api/session/route.ts` would shadow Django, because fallback rewrites run after the filesystem. Don't add one.
- E2E sign-in sets a signed cookie named `sessionid`, so the middleware's presence check passes.
- E2E `/api/session` returns `membership.role = 'admin'` when the actor has `admin` or `flow.edit`, so the admin layout admits them. Actual permissions always come from `test-actors.json`. Flow Admin deliberately has no `admin` permission (UI-PERM-01).
- **Derived requirement:** `approverAvailability.othersCanApprove` needs "is there another active admin in this tenant", so the store has a read endpoint for active admin memberships (`actors/`), now keyed by id and exposing no names. `members/` lists every active member by id. A tenant with one linked admin can never publish; that is F12 working as designed, shown by the "nobody else can approve" must-fix row.
- Owner teams (01 §6.2): the repo has no team model; the link's `teams` is the map. Non-admins opening `/flow-studio` get sent to `/home`, matching the admin layout.

**Left open on purpose.** An admin can link their own account to any person, including an approver on a request they raised. `linkedBy` and `linkedAt` say who did it last, and the row keeps no history. Admins can already edit a record's requester and stop runs, so this adds no new class of power, but it is worth a product decision. Nothing tells an unlinked user why their inbox is empty.

**Pre-existing, not touched:** A pre-existing security issue in an existing account endpoint, outside Flow Studio, was reported to the team privately. Not changed here.

### 6. Canvas

Built in-house per spec, using 04 §4.1's exact layout algorithm. Do not use `@xyflow/react`. Holds: it is only imported by `src/components/onboarding-flow/`, which stays untouched.

### 7. Commits

Commit on `flow-studio` when a milestone is done, staging only your paths, with the message ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push, merge or touch main.

---

## Deployment prerequisites (not done; the user must do these)

**The load balancer sends `/api/*` and `/admin/*` to Django** (`flow-studio-backend/docs/load-balancer.md`), with explicit exceptions such as `/admin/users*` going to the frontend. Without changes, in production the Next routes below would be answered by Django and 404. I did not inspect or touch the live URL map. Add frontend rules to `levvai-lb-urlmap` for:

- `/admin/workflows`, `/admin/workflows/*`
- `/api/flow-studio/*`
- `/api/runtime/*`

Do **not** add `/api/test/*`; going to Django there is a useful second layer on top of the 404. Also check whether the frontend route rewrites the Host header (see tenant host resolution).

The page routes `/flow-studio`, `/flow-studio/*`, `/runs`, `/runs/*`, `/inbox` and `/inbox/*` must reach the frontend. The docs say they take the default frontend route, but **I did not inspect the live URL map**, so confirm these six when adding the rules above. They are in the `middleware.ts` internal prefixes and redirect to sign-in without a session (asserted by test).

Env for `levvai-website`: `FLOW_STUDIO_STORE=django`, `FLOW_STUDIO_BACKEND_URL`, `FLOW_STUDIO_STORE_TOKEN`, `LEVV_SERVICE_TOKEN`, `LEVV_CRON_SECRET`. Do **not** set `LEVV_MOCK_AUTOCOMPLETE` (a production process ignores it; `tests/django-e2e/runtime.spec.ts` starts one with it set and checks). Env for `levvai-backend`: `FLOW_STUDIO_STORE_TOKEN`, the same value. Then `python scripts/run_migrations.py` for `apps.flowstudio` (now three migrations: `0002_run_claim` from M7, `0003_account_link` from the post-build review), one Cloud Scheduler job per tenant, the seed, and **linking accounts to people in every tenant (decision 5): until that is done nobody has an inbox and nothing can be approved.**

**The tick (05 §3.3).** One Cloud Scheduler job per tenant, every minute, with its own retries off because the next minute is the retry:

```sh
gcloud scheduler jobs create http flow-studio-tick-<tenant> \
  --schedule="* * * * *" --http-method=POST \
  --uri="https://<tenant>.levvai.com/api/runtime/tick" \
  --headers="x-levv-cron-secret=$LEVV_CRON_SECRET,content-type=application/json" --message-body='{}' --max-retry-attempts=0
```

Two ticks at once are safe (races below), so overlap or a doubled-up job costs reads, not double sends. Provisioning a tenant has to create its job. **For development**, where nothing calls it:

```sh
while true; do curl -s -X POST -H "x-levv-cron-secret: $LEVV_CRON_SECRET" -H 'content-type: application/json' -d '{}' http://localhost:3000/api/runtime/tick; echo; sleep 60; done
```

**Inbound events** are `POST https://<tenant>.levvai.com/api/runtime/events` with `x-levv-service-token`. `LEVV_FIELDGLASS_EVENTS_FILE` points the tick at a JSON file of queued events (05 §5.2's mock); leave it unset in production, and note nothing polls a real Fieldglass.

**Seeding a real tenant** is `npm run seed:flow-studio` with `FLOW_STUDIO_BACKEND_URL`, `FLOW_STUDIO_STORE_TOKEN`, `FLOW_STUDIO_SEED_TENANT_HOST=<tenant>.levvai.com` and `FLOW_STUDIO_SEED_ALLOW_REMOTE=1`, because it refuses both a remote backend and a backend on a remote database without that flag. It needs a tenant host to act on one tenant, so run it once per tenant. Neither the flag nor a real tenant has ever been used.

The app reads `docs/flow-studio/seed` only for the seed script and `POST /api/test/reset`, so production serving does not depend on that folder. The website has no `.gcloudignore` today; if one is added, run the seed from a checkout.

**Until seeded, a tenant answers 503 `NOT_SEEDED`** on the routes that need reference data.

---

## Repo survey

### Framework layout

- Next.js 13.5.6 App Router with root `app/` (no `src/app`, no route groups). React 18.2. npm with `package-lock.json`. Node 20 via `.nvmrc`.
- `app/layout.tsx` is `'use client'` and is both the root layout and the app shell. So pages may export `metadata`, but the layout cannot.
- Shared components: `app/components/` (`ui/`, `motion/`, `onboarding/`). `lib/` for helpers and `lib/api/*` client modules. Existing root `src/components/onboarding-flow` is the Workers workflow editor, and `src/flow-studio` sits next to it.
- `components/` at root does not exist despite the tailwind glob. The website has no Dockerfile; it deploys with `gcloud run deploy --source .`.
- Scripts before M0: `dev`, `build`, `start`, `lint`. Added: `typecheck`, `test:engine`, `test:e2e`, `seed:flow-studio`.

### Auth and session

Django session cookie `sessionid`, tenant-bound (`apps/accounts/session_scope.py`). Client: `useSession()` from `app/session-context.tsx`, fed by the layout's `/api/session` fetch. Server: nothing yet; see decisions 2 and 5.

| Spec permission (01 §6.1) | Real session | `LEVV_E2E=1` |
| --- | --- | --- |
| `flow.edit`, `flow.approve_changes`, `runs.view`, `runs.control`, `reference.import` | implied by `membership.role === 'admin'`; nobody else | from `test-actors.json` |
| `admin` | `membership.role === 'admin'` | from `test-actors.json` |
| inbox | a member whose account is linked to a person; unlinked members see nothing (decision 5) | same, every actor is its own person |
| owner team | the account's link: `teams`, or `person` when `workflow.owner` names a person | `ownerTeams` in `test-actors.json` |

### Database layer

Django 4.2 + DRF 3.17 + django-tenants on Postgres, one schema per tenant. No ORM on the website. New tenant app `apps.flowstudio`, migrated by `scripts/run_migrations.py`. Models mirror 01 §4.1 with snake-case columns, using `OrderedJSONField` (2a). Backend tests are `manage.py test` in `apps/*/tests.py`.

### Design system

- Workers Index page: `app/workers/workers/page.tsx`. It is one large page of raw Tailwind, not components. Take its tokens (cyan accents, `bg-slate-950` Nova surfaces, `text-[10px] font-black uppercase tracking-wider` labels). It uses a native `<select>` itself, so do not copy that.
- Inter font from `globals.css`. Token variables `--levv-*`, `--cws-*`. Base 14px/1.5 on the Flow Studio wrapper (04 §2).
- **`app/components/ui/button.tsx` cannot be reused.** It relies on shadcn tokens (`bg-primary`, `ring-ring`, …) that are not defined in `tailwind.config.js`, and it is `rounded-full`.
- `app/components/ui/searchable-select.tsx` is a different API from 04 §13 and stays where it is.
- `levv-app.tsx` (`LevvBrand`, `LevvPanel`, `LevvStatusBadge`…) is image-based and blue-branded; not used. The top bar logo is the text "levv." per 04 §2.3 and UI-N1. It links to `/home`, per "use the app shell's logo link if one exists".
- No Switch, Dialog, Drawer, Toast, Tooltip, Badge, Card or Input exists in the repo. **Build new** in `src/components/flow-studio/ui/` per 04 §1.3, using plain Tailwind from `src/`.
- All 44 icons in 04 §1.4 exist in the installed lucide-react (0.562). Import `Infinity` with an alias, because 02 §15 uses the global. `z-60` is not a Tailwind 3 class; use `z-[60]`.

### callGPT

`lib/intelligence/gpt/callGPT.ts`:

```ts
export type GPTMessage = { role: 'system' | 'user'; content: string }
export async function callGPT(messages: GPTMessage[]): Promise<string>
```

- Model `gpt-4.1-mini` via `openai.responses.create`. Returns trimmed `output_text`. Throws if `OPENAI_API_KEY` is unset. Logs raw output with `console.log`.
- **No JSON mode, no temperature, no timeout.** 01 §7 needs temperature 0 and an 8 s limit. **M6 decision:** add an optional second parameter `{ temperature?, signal? }`, leaving existing callers unchanged. JSON output is requested in the prompt, then parsed and validated with Zod.
- Import it only from the route handler; the engine stays pure.
- This worktree has no key, and Playwright sets it empty, so ✦ Set always uses the deterministic parser in tests.

### Test tooling

None before M0. Vitest for `tests/engine` and `tests/api`; Playwright for `tests/e2e` at 1440×900; `page.clock` is available. Chromium headless shell installed. Fixtures are byte-identical copies in `tests/fixtures/seed/` (11 files).

### Prototype

No browser tool was needed: driven headlessly with Playwright (picker, UK Technology work orders canvas, Approve panel, Test on "Senior cloud engineer", Nova, Publish). Canvas boxes are hit by mouse position rather than element clicks, which is prototype-only. The prototype's "Try a record" pills differ from the required radio list (04 §8), as documented. I checked the look of the screens, not every panel.

---

## Spec versus repo conflicts

| # | Conflict | Resolution |
| --- | --- | --- |
| 1 | 01 §4.1 Prisma, repo has Django | Decision 2. Prisma not added |
| 2 | `Json` columns assumed to preserve order | 2a, `json` column type |
| 3 | 01 §1 `strict: true`, root is false | Separate strict config, decision 4 |
| 4 | 01 §2 `(app)` route group | None exists; plain folders |
| 5 | 01 §2 root `components/flow-studio` | `src/components/flow-studio`, decision 4 |
| 6 | 01 §2 "server component loads data" | Thin pages; client fetches. Tenant host and auth are only reliable through the client helper (decision 2) |
| 7 | 01 §3.1 says the client loads "reference data" only, but `EngineContext` needs full workflows and history for lint and overlaps | Additive route `GET /api/flow-studio/engine-context` (`flow.edit`), about 283 KB uncompressed. Server stays authoritative at publish |
| 8 | 01 §4.1 "new ones: cuid()" and 03 §16.0 `nf{n}`; the id generator only reserves ids in the graph being edited | 03 wins. In real mode, `POST /workflows` also reserves every existing workflow id, or a second new workflow would collide on `nf101` |
| 9 | 01 §5.3 reset assumes one store | Reset exists only with the memory store |
| 10 | 01 §6.2 owner team config | Empty map in production; decision 5 |
| 11 | Company time zone "configurable" (01 §8), no tenant setting exists | Constant `Europe/London` |
| 12 | 02 §15 OOO dates fixed to 2026 | On a real clock after 30 Oct 2026 nobody is away. Seed-data behaviour, left as specified |

---

## Decisions made during the build

Spec disagreements found in M0 (06 §7.3 says none are known). `[V]` means I confirmed both quotes in the files; `[R]` comes from the M0 reading pass and should be rechecked when the milestone reaches it. Precedence: 00 → 03 → 02 → 04 → 06.

- `[V]` Empty Approve title: 06 §1.5 "Boxes with no title use the step kind (“Approve”)", 04 §4.3 'shows "Approval" whenever an Approve step's name is empty'. Follow 04.
- `[V]` Sample note: 02 §11 "author's note (not shown)", 04 §8.2 shows `samples[].note` and 06 §1.5 expects line 2 "{id} · {note}". 02 is a field comment; the UI docs define behaviour, so show it.
- `[V]` Scope order: 03 §1.4 "in the object's key order", 04 §7.1 fixed field order. 03 wins for text. New picks are written in 04's field order, so both agree for new scopes and the seed's "UK · Technology" stays.
- `[V]` Helper fallback: 02 §5.14 `fallback:'proc'`, 04 §7.7 per-worker defaults. 06 A.4 asserts nothing about it, so M2 follows 02: a new helper gets `proc`.
- `[V]` Auto-approve wording: 04 §7.4 "earlier on this path", 02 §5.5 "anywhere on the path". 04's is the exact UI string; the engine follows 03 §9.
- `[V]` Reference key: 01 §5.1 `digitalWorkers`, 02 §0.1 `dws`. Internal type uses `dws`; the API response keeps 01's name.
- `[V]` 06 §1.2 names "UI-DD-09" for 1440×600 while the setup lives in UI-D2; UI-DD-09 says "see UI-D2". Not a conflict.
- `[V]` Plurals: 04 §11 "{record lower}s" versus 03 D29 "SOWs". 03 wins; built and tested in M2 (`inactiveWarning`). The singular keeps "SOW" too.
- `[V]` Summary null: 06 §1.4 "no Approve, Auto-approve or Fits plan? step", 02 §12 "no Approve or Auto-approve step and no approval rule matches". 03 §6 and §11.3 agree with 02, so that is built. A Fits plan? step always brings an Approve step, so 06's wording only differs on a hand-made graph. See also the generated-step entry in the M2 section.
- `[V]` GPT prompt: 01 §7 line 418 includes "the role words (`ALIAS`, `FLAT`)", 03 §17.2 SYSTEM doesn't. 03 wins; `copy.gptSystem` is 03's text.
- `[V]` 04 §14.1 "Toasts (all)" omits 01 §3.2's conflict toast ("This workflow changed since you opened it. Reload to see the latest."). Rechecked in M4; `copy.draftConflict` holds it. **M5** shows it with autosave.
- `[V]` DW icons: 02 §8 "`p: string; // SVG path data for the 24x24 icon`", 04 §1.4 "Map each prototype glyph to the lucide icon below and use that icon everywhere". Built in M4 with lucide (`kinds.ts`); `p` is ignored.
- `[V]` Date-time formats, rechecked in M5: 02 §0 "Date-times are `YYYY-MM-DDTHH:MM`", 02 §5.12 "`at`: "Date and time" YYYY-MM-DDTHH:MM", 02 §0.1 `now` "Tests: '2026-10-20T09:00:00Z'". 04 §7.13's `datetime-local` input produces exactly the first form, and the panel shows it as written ("Waits until 2026-11-02 at 14:30."), so M5 stores no zone and needs none. **M7** still has to read `at` as company zone when it resolves a timer; nothing reads it as a time until then.
- SelectMenu inside the Publish dialog is portaled outside its focus trap (04 §13.6, §10, §14.3), so the trap must exempt it. The SelectMenu "scrolled out of view" rule (§13.5) is viewport-based, so under the embedded sticky header it may float over the header; accepted.
- Top bar: 06 §1.5 needs a `banner`, and a `<header>` inside `<main>` loses that role, so set `role="banner"` explicitly.

### M1: data model and seed loader

**Spec disagreements.** All confirmed by reading both places; 06 §7.3 lists none of them. No test was weakened.

- **"Done" label on Collect & verify.** 04 Appendix A says loading labels the normal exit "Done" and cites "02 §15 step 7", but 02 §15 step 7 and 03 §16.12 mention only the Failed exit. Nothing in 03 or 02 contradicts it, and 04 §4.2 and §4.5 name "Done" as the exit name, so it is stored on `next`, the same way 03 §16.11 stores it for System. **M2:** `setCollectFail(…, 'approval')` must remove "Done" with the Failed exit, or the round trip will not deep-equal the seed.
- **EN-117 wording against 02 §15.** EN-117 says `setCollectFail(wf('wf-onboard'), 'ID', 'role', 'people_ops')` "adds" `ID_fail`, but `wf()` is normalised, so `ID_fail` and the Failed exit already exist. 03 §16.12 says "create or update". **M2:** assert the end state; "adds" cannot be literal on a normalised graph.
- **Generated step fields.** 02 §15 lists `{id, label, roles, escalation, failOf, remind, sla, reject}`, 03 §16.12 adds `who`, and 02 §5.4 requires `mode`, `authority`, `material`, `reaskOnDecrease`. The step is an `appr`, so step 7's Approve defaults apply and all of them are set. EN-117's object is a subset, so **M2 should compare it with `toMatchObject`.** `prechecks` is left out as legacy (02 §16). **M2 watch:** EN-099 and EN-101 expect steps generated by `setFlag` and `setPathThen` to carry `prechecks: ["brief"]`, so those operations must write it even though nothing reads it.
- **EN-121 "it had no `remind`".** True of the raw file. After 02 §15 step 7 `RA_A1.remind` is 24. The assertion (12 after `setField`) holds either way.
- **`BusinessRecord` against its fixture.** 02 §14 names `runtime-records.json` as the test fixture of `{id, type, source, updatedAt, data}`, but the file is flat (`record`, no `type`, `updatedAt` or `data`). Its `_about` says tests post it as `{source, recordType: record, recordId: id, event, data: the record}`. The schema validates the flat file as stored. **M7:** map it at intake.
- **`LIMIT` type.** 02 §7 types it `number | null`, 02 §15 step 3 turns null into `Infinity`. `PeopleAuthority.LIMIT` is `Record<string, number>` after load and `SeedPeople` holds the stored form.

**Decisions where the spec is silent.**

- **`published.nodes` is normalised too, not only `draft.nodes`.** 02 §15 step 7 does not say which. Otherwise every live workflow with a Collect & verify would read "unpublished changes" on load. A test asserts that no seeded live workflow is dirty.
- **`versions` is built after step 7, as a separate copy,** although 02 lists it as step 6. A pinned version needs the Failed exit, and sharing the object would let a draft edit reach a pinned run.
- **Validation returns the input, never Zod's output.** Zod rebuilds objects in schema order and strips nothing only because of `passthrough`; returning its output would reorder fields. `parseSeedFile` validates, then returns a `structuredClone` of the input, so stored key order survives (03 §1.4, §12).
- **Schema strictness.** Every object passes unknown keys through, because legacy fields are "load but ignore". Fields 02 §15 fills are optional in the schemas (`SeedNode`, `SeedWorkflow`), required in the 02 types. Graph integrity (ids match keys, exits resolve, `T` and `END` exist) and draft-exactly-when-unpublished are enforced in the workflow schema. Checks across files (fields, roles, workers) live in tests only.
- **`tests/engine/schema-conformance.ts` ties the schemas to the 02 types at compile time.** It sits under `tests/` because Zod's inference needs `strict`: with root `strict: false`, every Zod key infers as optional, so a `z.ZodType<T>` annotation in `src/` fails `next build`. For the same reason `model/schemas.ts` casts its two recursive schemas.
- **`loadSeed` is in `data/seed-files.ts`, not `model/load.ts`** (02 §0's layout is "suggested"). `model/load.ts` must stay free of `fs` so client code can import from `model/`. Its pure entry point is `buildSeed(raw)`; `normaliseCatalog`, `normalisePeople` and `normaliseWorkflow` are exported for M3's "normalise reference data on read".
- **Normalising twice changes nothing,** and a test asserts it, so M3 can normalise on read without tracking what is already normalised.
- **`flagCont` is written on every check,** including note checks that had none (02 §15 says "recompute"). No acceptance test compares a whole check node.
- **"Keep the display string" (02 §15 step 4)** is `oooUntilText(iso)` rather than a stored second field. It also works for a test that sets `OOO` to an ISO date directly. **M2:** use it for "is out until Oct 24".
- **`LIMIT` is filled with 0 for everyone in `PEOPLE`.** `limitOf()` covers anyone else, for example the requester "Coordinator". **M2:** read limits with `limitOf`.
- **Load helpers live in the engine files 01 §2 assigns them to:** `title`, `ensureWait`, `ensureSys` in `engine/text.ts`; `computeMergeAt`, `ensureCollectEscalation` in `engine/edit.ts`; `createIdGen` in `engine/ids.ts`. **M2 extends these files.** `setCollectFail` should call `ensureCollectEscalation` for `failTo 'role'`. On an existing step it changes only `roles`, per "Changing the role updates `roles`", so an edited `sla` or `remind` survives.
- **Test context:** `tests/support/context.ts` rather than under `tests/engine`, so M3's `tests/api` can share it. `makeContext()` is the 06 §1.2 factory.

### M2: engine

**Disputed tests.** Every expected value in Part A comes from 06 at test time, not from a copy: `tests/support/acceptance-doc.ts` parses `06-acceptance-tests.md`, so a test can only change by changing that file. Part C values are transcribed by hand from its prose. Three tests are asserted differently from 06's letter because a higher-precedence document settles them; each is marked in the test. No test is skipped or left failing.

1. **EN-104: new Approve step, `who` and `remind`.** 06 lists the node with neither field. 02 §5.14: "`{kind:'appr', label:'Approval', roles:[], who:'roles', mode:'all', authority:false, material:[], reaskOnDecrease:true, remind:24, sla:48, reject:'requester'}`", and 03 §16.1: "Create the node (DM §5.14)". 02 and 03 outrank 06, so the node has `who:'roles'` and `remind:24`, and the test adds exactly those two fields to 06's object. Nothing behaves differently: both are the defaults when absent. The A.3 graphs still lack them because they are the prototype's output; they are inputs to Test, where it makes no difference. 06 also expects `prechecks:["brief"]`, which 02 §5.14 does not list and 02 §5.4 calls legacy; writing it contradicts nothing, so it is written (as for EN-099 and EN-101).
2. **LP-07, live case: the list is two items, not one.** 06: "`RA_C1.outs[0].to = \"RA_C2\"`" gives "`[{ \"sev\": \"warn\", \"node\": \"RA_C1\", \"m\": \"“Rate over card?” sends every path to the same place, so it does nothing yet.\" }]`". That setup leaves Rate review with no way in, and 03 §12.2 L13 (required by D24): "a node not reachable from `T` (other than `END`) | warn | “{t}” can’t be reached from Start, so it never runs." 03 outranks 06, so the test expects the L4 item as written plus the L13 item for `RA_A2`. 06's list predates L13: it came from the prototype, which has no L13.
3. **EN-106: "other nodes must be untouched".** A.4's general rule against 03 §16.5 "Sync generated labels" and 06's own I6 graph, where `n103_else` is "Otherwise: escalation" (I5 has "No: escalation"). 03 settles it. The test asserts the If as listed and the whole graph equal to I6, which is stricter than the general rule.

**Other readings of 06, no assertion weakened.**

- EN-117 "adds `ID_fail`": the graph is normalised, so the node exists already (M1 note). The test asserts the end state, and separately that `approval` then `role` really adds it. Field comparison is `toMatchObject` because 06's object is a subset of what 02 §5.4 requires.
- EN-123 `parseWhen(text, catalog)` returning `{join, rows}`, against 03 §17.2's `async parseWhen(text, deps)` returning rows. It is async with `(text, catalog, deps?)` and returns `{join, rows}`; the join is computed there anyway (§17.1 step 3, §17.2). 03's `parseWhenRules(text)` also takes the catalog, because step 8 needs the options.
- LP-10 "`pending.precedence = { otherId: …, winner: \"self\" }`" (also 03 §13.3), against 02 §4 and §14 `precedence?: {…}[]`. 02 is explicit and a workflow can overlap several, so it is an array. The test asserts the one-entry array.
- LP-13 "`canApprove(user, pending)` is true for Samira Khan", whose only permission is `admin`, against the literal formula in 03 §13.4 "`user.permissions.includes('flow.approve_changes') && user.id !== pending.submittedBy`". 03 §13.1 item 7 itself says "`flow.approve_changes` or `admin`" and 01 §5.1 says "`admin` implies every permission". So `admin` counts. Ids where there are accounts, which is 03's own formula again since the post-build review; names only for test actors, who are their names (decision 5).
- LP-15's Wait node has no `outs` in 06; the test puts it on the Start line so that the Wait item is the only finding beside the overlap.
- `tests/engine/worked-examples.test.ts` also runs all 31 tables of 03 §19 against the engine, using the Build paragraphs where they apply (E18, E19, E24). None disagrees with 06.

**Spec contradiction settled by 03's own oracle.** 03 §6: "Run it whenever the workflow has an Approve or Auto-approve step **or** any approval rule matches the record". After loading, ten Collect & verify steps have a generated Approve step, so read literally `wf-onboard` always has a plan and a summary. 03 §19 E22–E29: "(none: no Approve or Auto-approve step)"; EN-001 `summary: null`; 06 §1.2: "the generated steps never appear in Test unless a step fails." So `needsPlan` counts a step with `failOf` only once the walk reaches it.

**Decisions where the spec is silent.**

- `engine/resolve.ts` holds `resolveRoleHolder`, `personLabel`, `roleName`, because `text.ts` and `plan.ts` both need them and 01 §2 would otherwise make a cycle. `plan.ts` re-exports `resolveRoleHolder`. `roleDef` answers `p:<Name>` on demand, so a graph being edited needs no store write.
- **Nobody approves their own request, after limits and delegates too.** 03 §6.7 checks self-approval (step 5) before signing limits (6) and absence (7), so a delegate or a limit could land on the requester. AGENTS rule 4 says never, so the check runs again after step 7. A specialist whose backup is the requester pauses. No seed case reaches this.
- Rule-only rounds are taken out before merging as well as after (03 §6.11 says after). Otherwise an Approve step could read "Covered" by an item that is then removed. `auto` is also false when stopped (03 §6.11 says "`!rejected`"; 03 §6.11 item 2 says "same handling").
- `walkOutcome` finds who sent the record to an End from the taken edges, not any visited node with an out to it (03 §4). `stopped.by` is the step before the generated Notify: 03 §4 does not define it, and EN-069 and V11 read "Stopped at “Rate over card?”".
- Reject default for `who` is `cco`. 03 §16.4 lists approve, escalate and stop only; EN-100 and EN-108 expect `cco`.
- EN-116 "still 72" needs the `sla` kept when an escalation becomes an approval and back; 03 §16.4 says "the escalation node being replaced". So any generated Approve step passes its `sla` on.
- `setPathThen` returns the new nodes or `{ok:false, message}` (EN-109). `insertAfterMerge` refuses the same way. Toasts that follow success are `copy.*` values the UI shows; the operations do not return them, except `dropWorker` and `applyLintFix`, whose toast depends on the case.
- A new Collect & verify with `failTo:'role'` (the 02 §5.14 default) gets its generated escalation at insert, the same rule as 02 §15 step 7. No test covers a new one. **M5:** check it against the panels.
- `setApprovers` keeps "the last role list" in the editor's closure, not on the node (02 §17: never persisted). **M5:** keep one editor per open page; a reload forgets it, which leaves `[]` and "Choose roles".
- `personLabel` when nobody is eligible (`null`) returns the role name.
- `TestRun` gained `workflow`, `sample`, `options`, `ruleRounds`, `removedByEdit` and `StepResult` gained `roundLines`, `tasks`, because `composeTest(run, ctx)` takes only those two arguments and must not parse joined text. `StageItem` gained `onBehalfOf`, `failedCheckOf`.
- `selectWorkflow` reads each workflow's published scope (03 §3.2 production note), so editing Applies to does not move real requests until publish.
- `prereqFor` (03 §15 item 2) lives in `selection.ts`; M5's settings line and M7's intake both need it.

**For later milestones.**

- **M7:** `planApprovals(wf, rec, ctx, {nodes})` takes the pinned version. `planFailedCheck(…, checks)` takes the plan's checks so the brief lists them. `briefFor` is ready. D13 (apply the chosen proposal's field value and recompute derived fields) is not in the engine: Test applies only `total`, and samples carry nothing more, so it belongs with record edits in M7. Rule flags are not written to the record by the engine (03 §7.2 item 3); M7 must set them for later steps.

**Prototype comparison (M2 review).** Driven headlessly with Playwright, values read from the Test panel, compared after quote normalisation (03 §0 makes the curly apostrophes a required difference). Differences are exactly the listed deviations:

| Case | Summary, path | Steps identical | Differences |
| --- | --- | --- | --- |
| WO-2214 on UK Technology work orders | same | 5 of 6 | Business sign-off adds the IR35 task line (D5) |
| ASN-881 on Assignment changed | same | 4 of 8 | The 4 Approve rounds add ": Approved" / ": Waiting" (D7) |
| ASN-881 with "Try an edit" | same | 4 of 7 | The 3 Approve rounds add ": Stands" / ": Waiting", plus the two "Removed by the edit" lines (D7) |
| AR-305 on Site access request | same | 7 of 7 | none |

### M3: persistence and API

**How the store is built.**

- **One repository layer over two drivers.** 01 §4.3's interfaces are `createRepos(driver, clock)` in `data/repos.ts`. `StoreDriver` (`data/driver.ts`) has `list`, `get`, `tx` and `actingUsers`; `data/memory/driver.ts` and `data/django/driver.ts` implement it. 01 §4.3 says "implement twice" and decision 2 says "two implementations". Implementing the driver twice keeps the meaning of every write in one place: a rule written twice is a rule that can differ, and memory is what the tests see. `tests/support/store-contract.ts` runs against both (15 cases each), so a difference fails a test.
- **Rows hold the entity verbatim.** Every model in `apps.flowstudio` has `doc` (`OrderedJSONField`) holding what TypeScript wrote, plus columns copied out of it on each write for indexes and SQL reading. 01 §4.1's `draft`, `snapshot` and `data` are all `doc`. I did not split entities across columns: that would make null versus absent (02 §0), timestamp strings and any field a model forgot differ between memory and Django, silently and only in production. `WorkflowRun.log` and `Workflow.versions` are the exceptions: they are rows (`RunEvent`, `WorkflowVersion`), joined on read.
- **Writes are `insert`, `upsert`, `patch`, `updateWhere`,** in one `POST flowstudio-store/tx/`, all or nothing. There is no delete op. Each model lists the ops it allows: `RunEvent` is insert only, `WorkflowVersion` cannot be patched. `patch` changes top-level doc keys under a row lock, with optional `expectRev`, `expect` and `bumpRev`. **`patch` is what makes "no lost updates" true:** a draft save sends only editable keys, so a concurrent Active switch cannot be overwritten by a whole-document write from Next.
- **Which writes move `draftRev`:** a draft save and an approval. Active / Inactive and `pending` do not, because an open editor's next autosave must still go through (03 §14.4 "takes effect immediately"; 04 §10 "The canvas stays editable"). An approval does, because it can change `effective`, which the editor also holds.
- **A draft save takes only `name, records, event, scope, effective, owner, source, days, basis, onReject, draft, desc`.** A flow.edit user cannot PUT their way to `status`, `version`, `published`, `pending` or `priority`. The merged result must pass `WorkflowSchema` (422 otherwise). `draft` is validated, never replaced by Zod's output, because Zod reorders keys.
- **Service-context writes:** `authorNotifiedAt` only, as decision 2 says.
- **A session cookie that does not resolve to a user is refused,** not treated as a service call. Otherwise an expired cookie plus the token would become the service.
- **LEVV_E2E=1 refuses the Django store,** in addition to memory refusing to run outside LEVV_E2E or Vitest (decision 2). A stray flag in production therefore makes the routes answer 500, rather than opening a sign-in with a known secret onto real data.
- **Two fixes M4 must not undo:** root `strict: false` breaks `if (!result.ok)` narrowing, so these unions are checked with `=== false`; and Zod infers every key optional there, so route code casts where a required shape is needed (`Precedence`). `npm run typecheck` does not catch either; `tsc --noEmit -p tsconfig.json --incremental false` does.

**Decisions where the spec is silent.**

- **Picker order lives in `data/summaries.ts`,** following 04 §3.1. `isVariationOf` is the catch-all of the same record and event, if there is one.
- **Ids.** Publish requests and work items are `pr-`/`wi-` plus a UUID (01 says `cuid()`, which would be a new dependency; tests never read them). Version rows are `{workflowId}:v{n}`. A new workflow reserves every id in the tenant (conflict 8) and retries on a collision.
- **Status codes the spec leaves open:** 201 for create and send; 409 `ALREADY_WAITING` for a second send; 409 `NOT_PENDING` with `copy.nothingWaiting` for a second decision; 422 `NOT_AN_OVERLAP` for a precedence choice about a workflow that does not overlap (it would otherwise rewrite that workflow's priority on approval); 422 for `REASON_REQUIRED`, a draft on the Active route and a bad import; 400 for a body that fails Zod; 422 `CLOCK_BACKWARDS`.
- **Reject** needs a non-empty comment (05 §7 "comment required"); 01 §5.1's `{comment}` agrees. The author cannot reject their own change either, from 01 §6.1 "made by someone else", with the same message as approve.
- **`publishedNotice.version`** needs a field: `PublishRequest.publishedVersion`, set on approval.
- **The inbox copies exist from M3** (05 §7), one per approver, written with the request. The first decision marks all of them `done` with that decision. The routes that show them are M7.
- **`POST /active` answers `{workflow, toast, warning}`.** 01 §5.1 says "workflow… returns the warning text if any"; the toast has the workflow's name in it, so the server is the simple place for it. `warning` is `inactiveWarning`, null otherwise.
- **`RunSummary` (M7 to refine):** `waitingOn` is `"{title}: {person}"` for `waiting` steps, read from the pinned version; `recordTitle` is the snapshot's `title` or the record id; `updatedAt` is the last log line.
- **`WorkflowVersion` rows are a superset.** 02 §4 lists `{version, nodes, scope, name, effective, publishedAt, submittedBy, approvedBy}`, 01 §4.1 adds `onReject, source, owner, basis, days, priority` "at publish time". Stored with both, so a pinned run has its reject settings whatever happens to the workflow. Seeded versions: `submittedBy`, `approvedBy` "Seed", `publishedAt` midnight on `effective`, which keeps the seed idempotent.
- **`callGPT` gained its optional second argument now, not in M6,** so ✦ Set is real in M3 rather than a stub. Existing callers are unchanged. `parseWhenWithSource` is new because 01 §5.1 returns `source`; `parseWhen` is unchanged for EN-123.
- **Added strings** in `engine/copy.ts`, used by M5 and M7 too: `draftConflict` (01 §3.2), `runControlForbidden` and `stopReasonRequired` (05 §4), all exact from the spec. `alreadyWaiting` and `noSuchOverlap` are mine; no screen reaches them unless two people race.
- **Worker sessions** pass Django's `TenantMembershipMiddleware` and are then refused by `IsTenantMember` on the store (2b); a test covers it.

**Seed behaviour.**

- `npm run seed:flow-studio` runs through the store API, so it needs Django up. `POST /api/test/reset` goes through the same `applySeed`, so the memory store and Postgres are seeded by one code path.
- **It refuses two ways:** a backend URL that is not this machine, and a backend whose `DATABASES` host is not this machine (`GET flowstudio-store/seed-target/`, which reports only a boolean). A local Django pointed at a hosted database is exactly the mistake decision 3 fears. Override: `FLOW_STUDIO_SEED_ALLOW_REMOTE=1`. **I never set it.**
- **Idempotent:** an identical doc is not written, so a re-run changes no rev. A draft edited since seeding goes back to the seed, with its rev moved so an open editor gets a conflict. That is 01 §4.2's "upsert by id".
- **One narrowing of "upsert by id", my decision:** a workflow published past its seed version, or waiting for approval, is skipped and named in the output. Overwriting it would leave version rows above its `version`, so the next publish would collide, and would orphan its request.

**Spec points, with both quotes. No test was weakened.**

- **What gets published when the draft was edited after sending.** 03 §13.5: "`published = {nodes: deepCopy(draft.nodes), scope, name}`". 04 §10: "The canvas stays editable; further edits go into the next draft." 01 §4.1 `PublishRequest`: "`snapshot` … the draft being published". Read literally, 03 publishes edits nobody reviewed. 03 says nothing about edits after sending, so it does not contradict 04; I read "draft" in 03 as the one that was sent. `publishVersion` gives the engine the request's snapshot, and the workflow's own draft stays as edited, so it then reads "Live v1 · unpublished changes". `approvePublish` itself is unchanged. Tested.
- **`hasUnpublishedChanges` after that** compares current and published, as 02 §4 says, so it is right without a change.
- **06 §1.2 "reloads all nine files"; 01 §5.3 "resets the id generator to 101".** The generator is not stored state on the server: it restarts at 101 and reserves what exists, so after reset the first new workflow is `nf101` as 06 expects.
- **`tests/support/acceptance-doc.ts` `setupOf`** returns the expected JSON for "- Setup: none" entries, because the block follows that line. Harmless for M2 (`applySetup` finds nothing in it), and A.1 has no real setups. Left alone; the API test does not use it.

**Stubs left.** The 15 runtime handlers of 01 §5.2 answer 501 after auth and validation, as M3 item 4 allows. `POST /api/test/clock` returns `processed: 0` because the tick (05 §3.3) is M7. Nothing else is stubbed.

**Local data.** `scripts/flow-studio-django-proof.sh` empties Flow Studio's tables in the `local` and `fsproof` tenants of the local database each time, leaves `local` freshly seeded, keeps a tenant `fsproof` (`fsproof.localhost`) and an admin `second-admin@local.levvai.test`, and resets both admins' passwords to `Local-Proof-Password-1!`. All of that is the local Docker Postgres only. To use the store from `npm run dev` locally: start Django with `FLOW_STUDIO_STORE_TOKEN=<anything>`, and Next with the same token and `LOCAL_BACKEND_URL` or `FLOW_STUDIO_BACKEND_URL`.

### M4: UI foundation

**How the embed was finally done.** The portal plan was tried first and held, so no counter-sheet exists.

- `app/admin/workflows/layout.tsx` renders `EmbeddedFrame` around the shell. The frame puts a placeholder (`absolute inset-0`) in the admin `main` and portals a `position: fixed` host to `document.body`, at `z-index: 10`, tracking the placeholder with a `ResizeObserver` plus `resize` and capture-phase `scroll` listeners. With no `main` ancestor, `body.flex main.flex-1 …` cannot match.
- Proved by computed styles, with a negative control: stage `rgb(2, 6, 23)`, Publish `rgb(8, 145, 178)`, node `rgb(15, 23, 42)`, rail `rgb(12, 18, 32)`; and a probe `div.bg-slate-950` appended to the admin `main` does get repainted, so the assertion can fail.
- The app's account menu (header z-20) opens over the host. Tab order works without help: the portal is last in `body`, as `main` is last in the page. Leaving the route unmounts the host. The app sidebar's 300 ms collapse is followed frame by frame.
- **Rejected:** dropping `flex-1` from the outer `main` on this route (the admin sidebar sits inside it and would lose the overrides, so it would change look between tabs); editing the 93 rules (other pages depend on them; decision 1); a counter-sheet (93 rules with `!important`, and every class the shell uses, forever); Shadow DOM or an iframe (Tailwind and the shell's routing would need a second home).
- **The shell lives in each route's `layout.tsx`, and the pages return `null`.** Next remounts a `page` when its `[workflowId]` changes, which would close Test and Nova; 04 §3.1 needs them to stay open and recompute. `workflowId` comes from the pathname. So the host also survives picker navigation without a flash.
- `variant` changes four things: `h-full` and a stage that flexes, not `100vh`; the top bar stays on one row, the picker button giving way; `<div>`, not `role="banner"`, since the app already has a banner, with the shell as `role="region"` named "Flow Studio"; toasts are absolute, so they centre in the column rather than straddling the admin sidebar. The phone layout of 04 §2.5 keys on the shell's own width below 720, not the window's, because embedded they differ.

**Bug the screenshots caught, now tested:** 04 §1.3 writes Button (primary) as "the secondary classes plus `bg-cyan-600 border-cyan-600 text-white`". Concatenated literally, Tailwind's stylesheet order makes `bg-white` win over `bg-cyan-600`: white text on white, an invisible Publish button. `primaryButtonClass` is written out instead. The class list in 04 is a description, not a recipe.

**Spec points, with both quotes. No test was weakened.**

- **The picker and the Start box can share a name.** 06 §1.5: "`button` (`aria-haspopup="listbox"`) whose name is the open workflow’s name". 06 §1.5: "Canvas box | `button` named by the box title", and UI-N3's "Work order submitted | Everywhere". On `wf-wo-sub` both are named "Work order submitted", so 06's `openStep` and the picker click are ambiguous as written. Both documents are satisfied; the test helpers tell them apart by `aria-haspopup` and by the canvas group (`pickerButton`, `openStep`).
- **Exit order against position.** 06 UI-W12: "“Done | Failed | Remove access | Close or deactivate user in Okta”", so the text is in stored order. 04 §4.1 rule 6: "keep the **normal** exit (Done) on the main row and put the new exit (Failed) above". 04 §4.2: "For exit `i` of `k` the port centre is at `y = 88 × (i + 1)/(k + 1)`". With `outs` stored `[next, fail]`, the formula read on stored order puts Done's port above Failed's and the two lines cross. Both can hold: the DOM keeps stored order, and ports and labels are positioned in drawing order (`visualOuts`). Asserted by test.
- **"+1" on the If card.** 04 Appendix A: "Yes → Registration verified (Worker provides · Compliance) [Done; Failed → …]". 04 §4.4: "“→ {first step on that path}” plus “ +{n}” when the path has more steps". 03 §16.3 `laneSteps` counts the generated escalation, so the card reads "→ Registration verified +1". The Appendix describes the path, not the row, so the test checks the row starts with "→ Registration verified". Product may prefer not to count generated steps.
- **Start title with several records.** 04 §4.3: "{Record name}{ / other records} {event name in lower case}…". 03 §1.6: "`${RECORDS[wf.records[0]]} …`". 03 wins. No seeded workflow has two records.
- **A step with no name.** 04 §4.3: "If Name is empty, use the kind name". 03 §1.2: "`node.label` if non-empty, else `DEFAULT_TITLE[node.kind]`", which gives "Condition" for an If rather than "If". 03 wins. Every seeded step has a name; only End's is empty and both agree on "End".
- **`data-*` in tests.** 06 §1.5: UI tests "never use prototype DOM ids, `data-*` attributes or CSS classes". A line on the canvas has no role or name, so UI-N3's "goes to" check reads `path[data-from]`, as do the Appendix A and prototype tests, which are ours and not in 06. UI-N3 also asserts position with boxes. The dropdown test page exposes `verify` and `items` with `data-testid` because 06 UI-DD-03 and UI-DD-05 assert those fields; on the real panels M5 reads them through the API.
- UI-N1's `text=Settings` count 0 applies to `/flow-studio` only, as decision 1 records. On `/admin/workflows` a test holds the shell itself to the same rule, and the heading outside it is the exception.

**Scope of the tests.** UI-N5 and UI-N6 need the Chaser's real panels and are M5's; CODEX_PROMPT M4 item 6 lists N1 to N4.

**UI-DD-01 to UI-DD-10 run on a test page**, as M4 item 1 allows ("a small test page or the real panels"): `/flow-studio-e2e/select-menu`, 404 unless `LEVV_E2E=1` (Vitest covers that). It mounts the real `SelectMenu` with the seed's options, the real `Drawer` and, for UI-DD-06, the real `ApprovePanel`. Only the Given differs from 06; every Then is as written. **M5 and M6 must point `given` in `ui-dropdown.spec.ts` at the real panels and delete the page, `SelectMenuHarness.tsx` and the `flow-studio-e2e` entries in `package.json` and `tsconfig.flow-studio.json`.** Until then, these tests prove the component, not the panels.

**Comparing canvases.** `tests/e2e/appendix-a.ts` is a hand transcription of Appendix A. What it says about a canvas is asserted (titles, subtitles, exits, If rows, connections, left-to-right order, helper badge), and box counts come from the seed file, summing to 159, on both routes. Where the Appendix is loose ("the same shape", "… the same approval chain as above …") the two prototype tests add what it leaves out: node positions equal v35's exactly on the 11 workflows with no generated step, and box titles and subtitles equal v35's on all 15. The other 4 workflows differ in position by design: 04 §16 items 23 and 34.

**Decisions where the spec is silent.**

- **Margin of a lane:** 18 px above the highest obstruction (the top of an If card, not its node position), staggered 8 px per exit as 04 gives for Ifs. 04 §4.1 says only "just above"; 34, its number for the old lanes, runs through a two-line subtitle on the row above.
- **A step with no way in is drawn,** in a row below the rest. The prototype drops it from the canvas, but lint L13 reports it and "Show me" must have something to show. No seeded workflow has one.
- **Loading failures:** an API 401 goes to sign-in and 403 to `/home` (decision 5). Other failures show "Flow Studio couldn’t load. Reload the page to try again.", and `NOT_SEEDED` shows "Flow Studio has no workflows for this organisation yet." Both are mine; M8 reviews them with the other error states.
- **A deep-linked `?step=`** also scrolls its box into view, using 04 §4.7's numbers for "selected from outside the canvas". Otherwise the panel opens over a box the user cannot see.
- **Page search** gained a "Workflows" entry, because every other admin tab has one.
- The remembered workflow is one key per browser (`levv.flowStudio.lastWorkflow`), since a page-load redirect has no reason to wait for an identity. It is checked against the list, so a stale id falls back to the first live workflow.

**Deliberately not working until later milestones.** Nothing here pretends otherwise on screen:

- **M5:** Test, Nova and Publish are disabled (the Nova count is real). "+ New workflow" is disabled, because a new draft could not be edited and nothing can be deleted. A "+" does nothing. Panels are read-only: Approve is complete with disabled fields, every other kind shows only its name and summary. The rail's click starts placing mode (hint chip, styles, Escape), but a "+" does not insert yet; dragging is not wired.
- **M6:** `?panel=`, the `publishedNotice` toast, Test highlighting.
- Ctrl/⌘ + wheel zoom is optional (04 §16 item 29) and not built.

**The app was also driven in real mode once, by hand** (not a test in the repo): `next dev` with `FLOW_STUDIO_STORE=django`, a real login as `admin@local.levvai.test` against local Django and the local Docker Postgres. `/admin/workflows` redirected to `wf-jp` with the host at 856×756 and the same computed colours, and `/flow-studio/wf-onboard` drew 20 boxes with `text=Settings` at 0.

### M5: editing

**How editing is built.**

- `use-editing.ts` is the one way to change a workflow: `apply(change)` runs an `engine/edit.ts` operation on the latest local copy, `patch(fields)` changes workflow-level fields, `deleteStep` keeps the graph for Undo. Each open workflow has a `Session` object holding its `draftRev`, debounce timer and in-flight save, so a save still running when the user moves to another workflow finishes against the right one. Refusals (`isRefusal`) show their toast and leave state alone, which is how a dropdown "snaps back" (04 §7.2).
- **Autosave** is 800 ms, one request at a time; an edit during a save sends once more afterwards. It also fires on `pagehide` and on leaving a workflow, with `keepalive`, so reloading straight after an edit keeps it. A 409 stops saving for that session and every later edit shows the toast again: nothing overwrites, and Reload is the way out (01 §3.2). Any other failure shows 04 §14.1's save-failed toast and stays dirty, so the next edit saves everything.
- **`ctx` keeps its identity for the page**, and `ctx.workflows` follows the open workflow. The editor bound to `ctx` holds "the last role list" (02 §17), so a new `ctx` would forget it. The picker is now derived with `workflowSummaries` from `ctx.workflows`, so renames and Runs when move it live; `GET /workflows` is no longer called by the shell (the route stays).
- `layout` is memoised on `draft.nodes`, so Applies to and other workflow fields cannot re-lay out or move the canvas (UI-D1).
- **Conditions:** `ConditionEditor` holds no state. Rows come from `defaultConditionRow`, `defaultEitherOr` and `rowForField`, exported from `edit.ts` and shared with the existing operations, so If paths and Only needed when cannot differ.
- **New engine operations:** `setPathCondition`, `setWhenCondition`, `setFields`, `setSysFields`, `setWorker`, `renameBranch`, all pure and tested in `tests/engine/m5-editor.test.ts`. `rowsText` is 06 UI-I11's name for `conditionText` on a path.
- **The Active switch was built here**, not in M6, because 04 §7.1 item 1 and CODEX_PROMPT M5 item 3 both list it in the panel. M6 keeps it and adds UI-P1's Test half.
- UI-DD-01 to UI-DD-09 now run on the real panels, with `verify` and `items` read through the API. **The test page stays for UI-DD-10 only**, because the Publish dialog is M6. `SelectMenuHarness.tsx` is down to that one field. M6 must point UI-DD-10 at the dialog and delete the page, the harness, `tests/api/e2e-harness-page.test.ts` and the `flow-studio-e2e` entries in `package.json` and `tsconfig.flow-studio.json`.

**Spec points, with both quotes. No test was weakened.**

1. **UI-ESC-01's last Then against the merge rules.** 06 UI-ESC-01: "Test card “Otherwise: escalation” ends “Chaser reminds after 24h and escalates to their manager after 36h”". 03 §10.4 item 6: "Else → ok "Covered", m "The same person already approves this kind of decision on this path"", reached through 03 §6.10 "If `seen` has `key` … Remove this item". On WO-2231 the default Escalate to (03 §16.4 "escalate `'cco'`") is Cost center owner, who already approves Business sign-off, so the card reads Covered and has no Chaser line. 03 outranks 06. The test asserts Covered as 03 says, then changes Escalate to to Procurement and asserts 06's ending, so the one-timer point is still proved through Test. **Needs a product decision:** should a "someone must decide" escalation merge with an earlier approval by the same person at all? 03 §15 item 13 says never to ask twice, so I left it.
2. **Deleting a step that has generated steps on its kept exit.** 04 §6.6: "Steps generated by the deleted step are removed too." 03 §16.7: "`keep` = for If, Fits plan? and checks: the LAST out (Otherwise / Outside plan / Passed) … Every out pointing to `id` now points to `keep.to`". For a Fits plan?, or an If whose Otherwise escalates, the last out's target *is* the generated step, so it stays on the line. 03 wins and M2 built that; only generated steps on the other exits go.
3. **UI-RULE-01 step 2 against EN-071's id.** 06: "equals EN-071", whose step has `"id": "RW"`. 03 §16.0: a step made on screen gets `n102`. 06 §1.5 compares "its title, status badge, message, …", not ids, so this one comparison drops `id` on both sides. Everything else in EN-071 is compared.
4. **06 UI-I11's `rowsText`.** 06: "the engine function `rowsText` must return exactly this". No such function in 03; `conditionText` (§1.3) does it. Added as a one-line alias, with 06's sentence asserted in Vitest.
5. **Helper fallback, again.** 04 §7.7 "Default: Accounts payable for Invoice match, Procurement for Job posting writer, People Ops for the others" against 02 §5.14 `fallback:'proc'`. 02 outranks 04 and M2 follows it, so a new Invoice match reads Procurement. Seeded steps keep their stored value.
6. **Who to tell after an escalation.** 04 §7.6 "Stop → "Who to tell" (D, `WHO_TARGETS`, default Hiring manager)" against 03 §16.6 "`w = flagWho ?? (stop ? 'hm' : 'proc')`". A check that was escalating to Procurement keeps Procurement when switched to Stop. 03 wins. It reads Hiring manager when nothing was chosen before.
7. **Owner order.** 04 §6.7 "sorted" and 06 UI-D4's list "HR operations, IT operations, Information Security". That order is code-unit sort, not `localeCompare`, so the list uses plain `.sort()`.

**Decisions where the spec is silent.**

- **Deleting a generated step leaves its owner coherent.** 03 §16.7 only moves the lines. Left at that, a check would read Escalate with an hours box for a step that is gone. So the If path goes to Carry on, the check to Carry on, the System to "give someone a task", and a Collect & verify to Ask people to decide with nobody chosen, which lint L12 then flags. Undo restores all of it exactly.
- **Runs when:** moving to Onboarding or Offboarding starts sets `source` to Levv, because the field is hidden there and would otherwise keep adding " in {System}" to the title. It sets `days` to the event's default (30, or 14) whenever the event changes, and removes `days` and `basis` where they do not apply. Steps are kept (04 §7.1).
- **Applies to order:** keys already present keep their place, and a new key goes in 04's field order, so "UK · Technology" stays while new scopes read in 04's order. An emptied field is removed, so clearing returns to `{}` and to not dirty.
- **"What starts this" and the onboarding explainer** use the prototype's definition with Approve in place of its legacy step: live, on `submitted`, source Levv, with an Approve step.
- **Ledger lines** on Remove access and Return equipment read every onboarding workflow's draft, using `dispOf`. The prototype uses a fixed sample record; this has no record to use.
- **Numbers:** a box shows what is typed and commits only a value the field accepts (whole, within its range); leaving the box shows the stored value. Empty stores null only in condition values (04 §6.8).
- **`Details`** opens when `open` turns true and never closes by itself. React's `open` attribute would otherwise close Advanced as soon as "Always ask this approver" clears the rows.
- **Scrolling past the drawer:** with a drawer open the canvas gets 400 px more scroll width. Otherwise, boxes under it could not be reached without closing it, which matters most in the 856 column.
- **Accessible names with no visible label:** "Field", "Comparison", "Value" (04 gives this one), "Who decides", "Approval group", "Equipment", "Documents to sign", "Courses". 06 addresses these by role and label, and 04 §6.8 and §7.9 give them no visible text.
- **Placing on a step that takes nothing** opens that step and stays in placing mode. 04 §4.10 only defines the attach cases and the check-on-Approve refusal.
- **Focus:** closing a panel whose opener has gone (a new step, after "+") focuses that step's box.
- **`laneSteps`** is now in path order (reverse postorder), for 04 §7.2 "in topological order". Its first entry is unchanged, so the card rows are too.
- Plain fine lines carry a "·", as the prototype does.
- Real-mode proof: `next build` in `flow-studio-django-proof.sh` now sets `LOCAL_BACKEND_URL`, because the browser's `/api/session` and login need the rewrites. `playwright.django.config.ts` and `tests/django-e2e/` are new and run only from there.

**How M5's tests stand in for M6's screens.** Test, Nova and Publish are still disabled. Where a Then needs them, the test asserts the same data through a route: "Test equals EN-xxx" through `POST /simulate` (the whole result, on what was autosaved), Nova's list through `GET /lint`, Publish through `GET /publish-review`. **That is not the on-screen half. M6 must add it to these same tests:** UI-I2, I5, I7, I8, I12, UI-N5, UI-W10, UI-W13, UI-ESC-01, ESC-02, ESC-03, UI-STOP-01, UI-RULE-01.

**Known gap, closed in M6:** a `pagehide` save that started while another save was in flight went out with the old `draftRev` and got a 409, so that last edit was lost. See "M6: no silent loss of the last edit".

**Deliberately not working until later milestones:** Test, Nova and Publish buttons (M6), `?panel=`, the `publishedNotice` toast, Test highlighting, UI-DD-10 on the real dialog (M6). Ctrl/⌘ + wheel zoom is optional (04 §16 item 29) and not built.

### M6: Test, Nova, Publish, Active / Inactive

**How it is built.**

- **Everything on these screens is computed on the client from the current draft,** through the same pure engine: `simulateTest` and `composeTest` for Test (the shell runs them because the canvas reads the same run), `lintWorkflow` for Nova, `publishReview` for the dialog. So they follow every edit without a request. The server stays authoritative: `POST publish-requests` runs its own review on what is stored. `GET /publish-review` and `GET /lint` remain as routes; the shell does not call them.
- **`liveCtx`.** `ctx.workflows` catches up with the open workflow in an effect, after the render. Anything computed during a render reads `liveCtx`, a copy with the open workflow in place. Without it, the first render after the Active switch read the old status.
- **One drawer slot.** `panel` (`test` or `nova`), `selectedId` and `menu` are exclusive. `queryOf` is the one place that turns them into `?step=`, `?panel=` and `?record=`; `writtenQuery` tells a URL this shell wrote from back, forward and deep links. Moving workflow keeps `panel` and `record` (04 §3.1) and clears a step panel or menu. `?record=` that does not fit falls back to the first that does, as 03 §11 item 4 says, and is kept: going back to a workflow it fits selects it again.
- **Test options** (`conflictChoice`, `applyEdit`) belong to one workflow and one record, so they reset when either changes.
- **The Publish dialog is portaled to `<body>` on both routes, at 04 §10's `z-40`.** Inside the embedded host (`position: fixed; z-index: 10`) it would be `fixed` to the window but painted in the host's stacking context, under the app header (z-20) and sidebar (z-30). From `<body>` it covers all of them, and SelectMenu's `z-index: 9999` stays above it. Asserted by `elementFromPoint` at points over the app header, app sidebar, admin sidebar and shell.
- **`TestRun.heldBack`** is additive: the Start, If, Parallel and End boxes holdTheLine was already tracking, so the canvas can draw them waiting.
- **`DRAWER_ROOM` grew** to `max(400, shell − rail and gutters − 200)` of scroll room while a drawer is open. In the 856 column 400 was not enough to bring the far end of a line to 04 §2.5's 200 px from the left: "Show me" left it under the drawer.
- UI-DD-10 now runs on the real dialog. The test page, its gate (`notFound` in the page itself), `SelectMenuHarness.tsx`, `tests/api/e2e-harness-page.test.ts` and the `flow-studio-e2e` entries are gone.
- `tests/e2e/test-panel.ts` is 06 §1.5's "equals EN-xxx": it reads the panel from the screen by role, name and tag, never by class or `data-*`, and compares it whole with the screen form of `expectedOf('EN-xxx')`. M5's route checks stay where they were, so those tests now assert both.

**M6: no silent loss of the last edit.** The gap: save A is running at rev N, the person edits, the page unloads, and B goes out also at rev N. A lands, B gets 409 on a page that is gone. A test that holds A's answer back failed before the fix ("Received: First edit") and passes after it, on memory and on Django.

1. **`supersedes`.** B now says which save it replaces: `PUT /draft {draft, draftRev, supersedes: <fingerprint of A>}`. If the rev is stale and what is stored is exactly A's content, the server expects the current rev instead. It stays a compare-and-swap: anyone else's save changes the content, so B still gets 409. No state is stored and the backend did not change. The fingerprint (`data/draft-fields.ts`) is over the editable fields in a fixed order, and survives Postgres because `doc` keeps key order (2a). If B overtakes A, B lands as an ordinary save and A's 409 is ignored by the page, because a newer save carries everything A did.
2. **Every autosave is `keepalive`,** not only the one at `pagehide`: a normal `fetch` running at unload can be cancelled, taking A's edit with it. A body over 60,000 bytes goes without it, because browsers refuse keepalive above 64 KiB; the journal covers that.
3. **A journal.** On the way out, what the page holds goes to `localStorage` (`levv.flowStudio.unsaved.{id}`). The next load of that workflow holds the workflow back from the screen until it is settled: the server has it (clear it); only this page's saves happened (save it, with the same compare-and-swap); someone else saved first (show "Your last change to this workflow wasn’t saved, because someone else changed it first."). It waits 1.2 s once for requests still in transit. That covers offline, a refused keepalive and a real conflict during unload, none of which the page could report at the time.

The toast text is mine; 04 §14.1 has no case for this. Not covered: a browser crash with no `pagehide`. A session already told about a conflict writes no journal: it was told, and Reload is the way out (01 §3.2). The journal is per workflow and browser, not per person, so someone signing in on the same browser could replay another's unsaved edit under their own name; the compare-and-swap still protects other people's saves.

**Spec points, with both quotes. No test was weakened.**

1. **Nova count at 0.** 03 §12.1: "The ✦ Nova button shows the count of bad + warn issues (grey when 0)." 04 §9: "It turns amber when above 0 and emerald at 0." 03 outranks 04, so it is grey (`bg-slate-500`; 03 names no shade). The prototype and 04 §1.3 are green. **Needs a product decision;** it is one class in `TopBar.tsx`.
2. **SelectMenu height runs off the screen.** 04 §13.4: "**Height**: `min(320px, max(spaceBelow, spaceAbove))`" with "**Placement**: below the button (4px gap) when `spaceBelow ≥ min(220, spaceAbove)`". A field with 230 below and 600 above opens below at 320, so the bottom of the list, and the footer with Clear, is off the window. LP-04 could not be done on screen. Placement stays as written; the height is capped by the side used. UI-DD-09 still passes as written.
3. **"A single Close button".** 06 UI-P6: "with a single “Close” button". 04 §10.1's header has "×", and 06 §1.5 names that "`button` named “Close” (shown as “×”)". 04 §10.2 lists only the body and footer for the sent state. So the sent state has no ×.
4. **Steps that hold nothing up.** 04 §4.8: "Edges leaving a step that “doesn’t hold anything up” are dashed". 02 §16: "`task.blocking`, `task.req`, any `req` | … | Every step holds the line." The prototype keyed on `req`, which is legacy. 03 §15 item 4 defines it: "A branch that ends on its own does not hold anything up." So the dashes are on Parallel branches that share no step with another branch: Insurance and Equipment in onboarding, Handover in offboarding. 04 §4.8 sits under "while the Test drawer is open", so only then.
5. **Rings for boxes with no status.** 04 §4.8: "Each step on the path gets a status ring", with four statuses; 03 §11 lists no status for Start, If, Parallel or End. Following the prototype: Start, Parallel and End are emerald, or dashed when held back, and an If has no ring and is not dimmed. Its taken line is cyan.
6. **UI-ESC-01**, carried from M5, still open. On screen, the default Escalate to reads Covered as 03 §6.10 and §10.4 say, and with Procurement as Escalate to it ends 06's way. Both are asserted. **Needs a product decision.**
7. **Round lines.** 06 §1.5: "each round line `n · people · notes joined with “; ”`". 04 §8.2: "with its round number as the icon", and UI-RULE-01 quotes "1 Information Security (Ravi Kumar), Privacy (Fatima Zahra) · Kenji…". The screen follows 04 and UI-RULE-01, and the test compares that.
8. **LP-07, on screen.** Setting Over 10% to "Carry on" removes Rate review (03 §16), so Nova lists exactly 06's one item. The extra L13 item recorded in M2 arises only from the raw setup, which the UI cannot make.

**Decisions where the spec is silent.**

- **Publish opened while waiting** shows the sent state with Close. A second send would only get 409 `ALREADY_WAITING`.
- **Send saves first** (`editing.flush()`), since the server reviews what is stored. If that fails, or the server refuses, the reason shows in the dialog (`role="alert"`) and nothing is sent.
- **A click on the scrim with a dropdown open** closes only the dropdown, matching 04 §14.2's Escape order.
- **The Hide link and the top-bar button** return focus to the top-bar button (04 §14.3). "Choose which wins" opens the dialog over Nova, which stays open beneath it.
- **The switch-off confirmation** (04 §11 "Recommended", 04 §16 item 29 "optional") is not built: it needs a count of running requests, which M7 brings.
- **LP-16's one record:** a new workflow scoped to US, Technology, Cloud matches exactly one history record. The seed has no workflow that does.
- **The notice can be lost in `next dev`:** React Strict Mode fires the load twice and aborts the first, after the server may have marked it notified. Production has no double effect, and every test runs on `next start`.

**✦ Set.** The live model path has **not** been exercised: no API key is available here, and Playwright runs with `OPENAI_API_KEY=''`, so on screen ✦ Set uses the deterministic parser. `tests/api/nova-model.test.ts` stubs `callGPT` and covers the valid answer, the temperature and cancel options, the prompt's contents and each fallback. A browser test stubs the route with a `source: "gpt"` answer and follows it through the panel, canvas and Test.

**Part C and M7.** LP-10, LP-11 and LP-13 approve through `POST /publish-requests/:id/approve`, which 06 LP-10 allows. M7's inbox should repeat LP-13's "no way to approve" on `/inbox`.

### M7: runtime

**How it is built.**

- **`src/flow-studio/runtime/`.** `machine.ts` is the step loop and one executor per kind, working on a `RunSession` (the run, its items, the record, open ledger lines) that records what must be written. `service.ts` is load, change, commit: **every command is one transaction with the run's `rev`**. A lost compare-and-swap loads again and re-decides from what is now stored, up to 25 times with jitter, so nothing a loser computed reaches the store: no stray outbox row, no half-open item. `commit.ts` turns a session into writes; the run row comes first, because it takes the lock and the check, and runs before records so two transactions can't lock in opposite orders. A deadlock Postgres breaks anyway comes back as a conflict, not a 500.
- **The run's taken path is its own**: `step.taken` holds the exits a finished step took. "Reached" follows those from Start. A step is ready when it is pending, reached, and nothing else reached and unfinished can still lead to it, so a join waits for a branch whose If has not decided yet (05 §3.2 step 2 says "visited", which misses that).
- **Nothing new starts on a paused run because `advance` returns at once**, and everything a command defers is picked up by `settleOpen` on Resume: a next round, a verification, a rejection decided while paused.
- **A plan is recomputed, not patched.** `replan` runs the engine again; `settleApprove` then brings the step in line, asking who isn't asked and letting go of who no longer is. It is idempotent, so a re-plan from a record edit and one from a reference import use the same code. R-09's paused item becomes real that way.
- **Duplicate events.** 05 §3.1 step 4 is a read then a write, so two copies at once would both pass. New collection `claims`, model `RunClaim`, migration `0002_run_claim`: one row per workflow, version, record and event, inserted in the same transaction as the run, or moved from the run it was read with when the old one has ended or passed 24 hours. Exactly one insert can win. That is the only backend change besides the deadlock handling.
- **`BusinessRecord.dataRev`** is `data`'s compare-and-swap, because the row has no rev and `data` is one key of the doc. Bring-backs go in the run's transaction; `editRecord` moves every open run and the record in one.
- **Run-level events are queued first.** `InboundEvent.outcome` starts as `queued` (additive; 02 has it null). A Run workflow step inserts its event in the run's transaction and processes it after commit, and a tick picks up any left behind by a crash. The `expect` on `outcome` makes two processors of one event safe.
- **Reads.** `views.ts` builds the run page's strings so they can be tested without a browser. Step messages come from the engine's `stepResult` (now exported), so a run reads as Test does, except a finished Approve shows who answered and a finished person-verified Collect drops "Waiting for…". A step "waiting" saying "Waiting for" under "Done" read as a bug.
- **`at` is company time** (`time.ts`, `resolveWaitUntil`), as M5 flagged. `zonedToUtc` is pure, via `Intl`, tested across a clock change.
- **The canvas** takes `readOnly` and reuses the Test look (04 §4.8): the same rings and line colours, with run status as the short label. Clicking a box points at its row in the step list and opens no panel.

**How /runs and /inbox are reached.** Two items in the app sidebar's Main section, in `app/layout.tsx`: **Inbox** for everyone signed in, and **Running workflows** for admins, which is exactly who has `runs.view` on a real session (decision 5). Page search has both. They are not Admin settings tabs: a non-admin assignee has to reach the inbox, and Admin settings is closed to them. Flow Studio still does not link to either (04 §0.1); 05 §6.3's `/runs?record={id}` works. Under `LEVV_E2E`, someone with `runs.view` only (Grace Kim) has no link but can open the page, because the sidebar only knows the role; no real session is in that position.

**No mock leaks silently (00 §4.2).** `Adapters.isMock` is part of the interface, and whatever is plugged in must answer it. Every result from a mock adapter puts `step.simulated` on the step, a `simulated` log line in the history and the banner on the run page. `LEVV_MOCK_AUTOCOMPLETE` never defaults on, and a process with `NODE_ENV=production` ignores it unless it is the `LEVV_E2E` app, which refuses the Django store. The real-mode proof starts `next start` with it set, on purpose, and asserts the Collect item stayed open.

**What a real tenant would see today.** It is a working runtime with no connections.

- **System steps**: "done" with a made-up ref (`WORKDAY-WO-2214-A-WD`) and made-up values (`WD-WO-2214-A`) saved on the record as if real. Nothing is sent anywhere. Every such step says "Simulated: nothing was sent to Workday. This build has no live connection to it." Unconnected Coupa fails with "Not connected".
- **Verifiers**: no document is checked. Automatic verification reads as "verified" unless the record says otherwise, and the step says "Simulated: Persona checked nothing." **A real background check would read as passed, with that line beside it.** Someone must not act on these before real adapters exist.
- **Digital Worker checks**: computed from fields on the record (03 §5), and marked. There is no rate card, budget or worker registry behind them; a record without those fields passes.
- **Email, Teams, Slack, In-app**: rows in `OutboxMessage`, `sentAt` never set. **Nobody is told anything.** Approvers see work only by opening `/inbox`. Links in the messages are right, but nothing delivers them.
- **Inbox identity**: work goes to people from the reference data, and an account sees a person's work only once someone with `reference.import` has linked it to that person (decision 5). On a tenant with no links, or whose people aren't those in the seed, **nobody has anything in their inbox and every approval waits forever**; the Chaser then writes escalations to more names. Real people data arrives through `POST /api/flow-studio/reference/import`, and links through `POST /api/flow-studio/account-links`; someone has to do both.
- **The worker and the supplier**: "the worker" and "Supplier account manager" are not users (no portal, out of scope), so a Collect from them stays open until the Chaser hands it to the hiring manager, who can carry it on.
- **Owner teams** come from the links: until an account is linked with `teams`, only admins and a person linked to the person named as owner can pause, resume or stop.
- **Events**: nothing raises them. `POST /api/runtime/events` works with the token, but no Levv screen calls it when a record is submitted, and nothing polls Fieldglass. A real tenant has no runs until something does.
- **Records** come only from those events, and nothing writes the fields the checks read.

**Decisions where the spec is silent.**

- **A check or If that rejects** (`flagDo: reject`) goes back to the requester for `resubmitDays` first, then is final; the check runs again on resubmit. 05 §3.4.2 says so for checks; an If path with the same wording gets the same rule, because the generated step is the same and the label promises it.
- **A failed-check decision, rejected**, ends the run `stopped`, by the decider, with their comment as the reason (05 §3.4.6 "reject = stop the run").
- **A Chaser copy** answers for its original: on an approval it is that approval; on a task it marks it done; on a Collect it hands the items over; on a review it verifies. Reject and send back on those follow the rejection rules. Its comment is required because its kind is `escalation`. It never lands on the requester or the worker: it climbs past them. If nobody is left, `escalatedTo` is "—" and the original stays open.
- **"Previous" with nobody before it** falls back to the requester.
- **Rule-only rounds** (03 §7.2) have no node, so they run as a synthetic step `rule:{label}`. Those before any step's round go first and hold everything; later ones hold the End. No seed reaches the second; `position: 'with'` is all that ships.
- **A record edit moves a decided If** when the new walk disagrees and what was on the old path has not finished: E13-edit needs it ("Tenure review leaves the path"), though 05 §3.2 says an If is evaluated when reached. Done steps stay done. Open steps off the new path are withdrawn, marked skipped, and their people told. "No longer needed" has no row in 05 §5.3; the wording is mine.
- **A conflict on a run** (03 §8.3, the production half of D13). 01 §5.2 has no route for it, so `POST /api/runtime/runs/:id/choose` (owner or admin) is additive, with the box and "Use {v}" on the run page. Approve steps wait with no items. Choosing sets `total_value`, parses the proposal's value onto its field, recomputes `rate_change_pct` from `prev.bill_rate`, clears the conflict, tells the other proposer, and re-plans. Other derived fields are not recomputed: no spec says how.
- **Switch-off confirmation** built (04 §11 "Recommended"), inline in the Active row, from additive `GET /workflows/:id/running`. If the count can't be read it switches off anyway: RT-14 means nothing is lost. For one request it reads "1 request is running on this workflow. It’ll finish on it. Switch it off?", the spec's plural being wrong there.
- **Refusals the spec has no code for:** `ALREADY_DONE` (409) for a second answer, `OWN_REQUEST` (403), `WRONG_KIND` and `ITEMS_MISSING` (422), `COMMENT_REQUIRED` (422), `RUN_ENDED` (409) for controls on a finished run, `NO_CONFLICT` (409). A cancelled item answers `RUN_STOPPED` as 05 §3.4.3 says, with "This no longer needs you." when its run is in fact going on, and its page says the same. "This request was stopped." is kept for runs that stopped.
- **Log lines beyond 05 §8:** `simulated`, `check`, `worker`, `auto`, `covered`, `skipped`, `not_asked_again`, `paused_step`, `overlap`, `wait`, `provided`, `runwf`. RT-12's "exactly three" counts the manual types, which is what it says.
- **Ledger close:** Remove access and Close in HR system close `remove` lines, Return equipment closes `return` lines, Ledger clear check logs what is left. Retained obligations stay open.

**Spec points, with both quotes. No test was weakened.**

1. **Rejecting an escalation.** 03 §15 item 6: "They must act — approve (it carries on), reject with a comment (it stops), or send it back to the requester". 05 §3.4.3: "a comment is required on escalations … Then follow the step's `reject` setting". Generated escalations have `reject: 'requester'`, so 05 would reopen what 03 stops. 03 outranks: final rejection, whatever `reject` says. 05 §5.3's mail also says "reject with a comment to stop".
2. **Not asked again.** 03 §15 item 5: "Not asked again → done". 05 §3.4.3: "**Not needed / Not asked again** → `skipped`". 03 outranks: `done`.
3. **Which version runs.** 03 §15 item 1: "Pick the newest version whose `effective` ≤ today." 05 §3.1 step 3: "whose latest published version is effective". With v2 scheduled for later, 05 would stop starting v1. 03 outranks: v1 keeps starting until v2's date.
4. **Prerequisite on `ob_start`.** 03 §15 item 2: "If not `'none'` (and not onboarding `ob_start`)". 05 §3.1 step 5 checks it without that exception. 03 outranks. All the runtime fixtures meet it anyway.
5. **A failed check's escalation "Covered".** 03 §10.4 item 6 and §6.10 merge it with an earlier approval by the same person, which Test shows as Covered, and 05 §5.2 says "A run and its Test therefore always agree". 03 §15 item 6: "They must act". At runtime the failure happens *after* that approval, so treating it as covered would carry a failed check past someone who never saw it. **Safety wins: the run asks them**, so here a run and Test disagree. This is UI-ESC-01's product question in a sharper form, and **needs a product decision**. Escalations from an If or a check, which are known when the person answers, still merge as Test shows.
6. **Held items.** 01 §4.1 `WorkItem.status`: "'held' (held = run paused)" and `holdForRun` in 01 §4.3. 05 §3.5: "existing work items stay open, and decisions are recorded (RT-10)". 05 is the runtime's document and RT-10 needs it. `held` is never written; the repo methods remain.
7. **What Stop leaves.** 02 §14: "skipped = not on the taken path". RT-04: "“Tell the supplier” stays `pending`". On Stop they stay pending, as RT-04 says; on a normal completion they become skipped.
8. **Group fallback and the requester.** 03 §6.8: "members minus the requester minus anyone away; if that leaves nobody, use all members". AGENTS rule 4: "A request is never approved by the person who raised it." So the runtime never asks the requester, and a group of only the requester waits. Test's text can still name them. No seed reaches it.
9. **Test order on a failing person-verified Collect.** 05 §3.4.6: "`person`: always the reviewer". 03 §10.3 checks `o === 'fail'` first and 05 §5.2 says mocks match Test, so a mock `fail` skips the reviewer. A real verifier with `person` would not have an outcome of its own; revisit with real adapters.
10. **R-06's Hiring manager is Grace Kim.** 05 §9: "the Hiring manager (`onReject`) gets “Rejected: Operations analyst”". WO-2231 names no hiring manager, so `hm` resolves through `ORG.Operations.hm`, who is the requester. The test asserts her by name. Fine by the rules; odd to read.
11. **A duplicate of a run that has already ended starts another.** 05 §3.1 step 4: "started in the last 24 hours and is not ended". The rule is built as written, so two copies of an event whose run finishes at once (TS-9934, auto-approved) start two runs, and its Notify goes twice, whether they arrive together or a second apart. A retrying sender would see this. **Needs a product decision:** de-duplicating ended runs too would also block a legitimate resubmission within 24 hours, which is presumably why it says "not ended".
12. **Where the engine half runs.** 06 §1.1: "Pure TypeScript functions only." 01 §9: "Tests import only `src/flow-studio/model|engine|runtime` and the fixtures." `tests/support/runtime-world.ts` also imports `data/memory`, which is pure TypeScript with no database, so that the same service, compare-and-swap and JSON round trip run here as on Django. I judged that worth more than the letter; say if not.

**Tests.** Part D's 15 are in `tests/engine/part-d-runtime.test.ts` and `tests/e2e/part-d-runtime.spec.ts`. 05 §9 asks for Vitest only, so R-01 to R-12's browser half in `tests/e2e/runtime-screens.spec.ts` is my addition; it drives the same record through events, inbox and run page. **Races** (`tests/support/runtime-races.ts`, 13 cases) run on memory in `test:engine` and on Django in `test:django`, with real connections, repeated 6 rounds each. They assert what must hold whoever wins, because the store picks. **As a negative control I removed `expectRev` from the commit and 6 of the 13 failed on memory**, so they can fail. `tests/api/runtime-stubs.test.ts` became `runtime-routes.test.ts`: every auth and validation assertion stayed, and the 501s became real answers.

**Real-mode proof** (`tests/django-e2e/runtime.spec.ts`, from `npm run test:django`, on local Postgres): token event starts a run, the duplicate is turned away by the claim, an admin finds it from the sidebar, Pauses; Raj Patel, a real non-admin session, finds Inbox, cannot open the run, approves; nothing starts until Resume; the run completes. Stop with a reason, final, on an onboarding run where `LEVV_MOCK_AUTOCOMPLETE=1` was ignored. Wrong cron secret, service token and store token refused, right ones work. A second admin approves a flow change from the inbox, and the author is told they can't. A second `next start` a day later ticks with the cron secret: one reminder, and the next tick does nothing.

**Caught by reading, then tested:** a record edit that re-asked an approver computed the path after putting them back to waiting, so every open step after them looked off the path and was skipped, and the run could complete without those approvals. Now the path is worked out first; asking again holds what follows without removing it. R-11 follows the run to the end.

**Stubs left.** Adapters, on purpose (00 §4.2). Nothing else. M8 fixed the Record panel's raw values and the missing loading state on `/inbox`.

### M8: hardening

**The five items left by earlier milestones.**

1. **Colours on `/runs` and `/inbox`.** `globals.css` matches `body.flex main.flex-1`, and the shell's `main` is the only `flex-1` main on these routes (unlike `/admin/*`, where the admin sidebar sits inside it and needs the theme). So `app/layout.tsx` swaps the class for `grow basis-0` on those routes only: same flex, same box (asserted), and the rules stop matching. The portal used for `/admin/workflows` was not needed. `hardening-screens.spec.ts` asserts the chip, Approve button and slate-950 canvas by computed style. Its negative control adds `flex-1` back at runtime and the chip goes blue. A second control probes `/admin/users` and finds the old theme still there.
2. **Record panel and cancelled steps.** Labels come from, in order: the system's "Bring back" name, the catalog's `FIELD`, `LEVV_F`, `WAIT_DATES`, then three of mine (`worker_tz` is 02 §14's "the worker’s time zone", `requester`, `sponsor_delegate`). Values: money through 03 §1.1's `fmt` (so `$95K`, and a value like 159,550 rounds to `$159.6K`), `%` for percentages, 05 §6's date format, Yes and No. `id`, `record`, `event`, `source` and `title` are hidden: bookkeeping, and the page title already says it. A `cancelled` step's message is now only what was answered before the stop, and it no longer shows Test's future tense. `runtime-screens.spec.ts` asserted the raw `159000`; it now asserts `$159K`, which is the point of the change and not a weaker check.
3. **Wording I wrote, reviewed.**
   - `loadFailed` stays: it says what to do.
   - `notSeeded` was "Flow Studio has no workflows for this organisation yet.", which leaves an admin stuck and reads as if they could add one. Now "Flow Studio isn’t set up for this organisation yet. Contact Levv support to load its workflows." It assumes a support route exists, so product should confirm that.
   - `lastEditLost` now ends "Check it and make your change again.", and stays 10 s rather than 2.8 s, because it is the only notice of lost work. The published notice shares that path, so it also stays 10 s. 04 §14.1 gives no duration for it, and it happens once.
   - `rc.conflict` was doing double duty as the network failure text on run screens ("Someone else changed this at the same moment"), which was false. A failed write now reads 04 §14.1's sentence, and a failed read "This page couldn’t load. Reload the page to try again."
   - `api.ts` no longer falls back to `response.statusText`, and a `NOT_SEEDED` answer on a run screen reads the same as Flow Studio's rather than the server's "Run npm run seed:flow-studio".
4. **The 856 column at 0.5 zoom. Decision: open the column at 0.7, leave everything else alone.** 04 §4.9: "Opening a workflow fits automatically with a minimum zoom of 0.5". 04 is written for `/flow-studio`, and the embedded route exists by binding decision 1, so a different opening minimum there contradicts nothing a 06 test reads. `/flow-studio` stays at 0.5 (asserted), and Fit, −, + stay 04's on both routes.
   - Why 0.7: the smallest zoom with a 9 px title (13 × 0.7 = 9.1; the subtitle is 8 px). At 0.5 they are 6.5 and 5.75.
   - What it costs: less shows at once. In the 752 px scroller, 3 of 15 workflows fit at 0.5 and 1 of 15 at 0.7, so 12 scroll either way. Beside a drawer, 354 px of canvas holds 2.3 levels instead of 3.2. Fit is one press away for the whole picture, down to 0.35, though at 0.35 only the shortest workflows fit; on `wf-ending` Fit would need 0.2.
   - A box pressed under the drawer now moves just clear of it (embedded only). `ZOOM_OPEN_COLUMN` in `layout.ts` is one number to change.
   - The run page's canvas uses the same number and gained the same zoom controls, as `ZoomControls.tsx`: it had neither, in a 720 px column.
5. **Widths.** `shellFit(width, embedded)` replaces the single `compact` flag.
   - `full`: 720 and up, as 04 §2.5.
   - `narrow`: embedded only, 500 to 719, roughly a 1084 to 1303 wide window. No rail (as 04 §2.5 does below 720; Digital Workers stay in the step menu), the canvas takes the width, the drawer stays 390 wide beside it with its box in view, and the top bar keeps its two halves whole, on one row or two as they fit.
   - `phone`: below that, or `/flow-studio` below 720, exactly 04 §2.5. At 1000 the shell is 432 wide and a drawer beside the canvas would cover all of it.
   - The admin aside (240) stays: hiding it would take the admin nav away with nothing to bring it back. Collapsing the app sidebar gives more room.
   - A test found that a long name overlapped the status text, because the picker `button` was not shrinking (`w-full`). That bug was there at any embedded width. In `narrow` the hint chip's offset is measured from the 400 the drawer covers, not the 480 of the full layout.

**Keyboard (M8 item 1).** `tests/e2e/hardening-keyboard.spec.ts` presses Tab for real and, at every stop, requires focus not lost to the page, a 2 px cyan ring and the element on screen. It walks `/flow-studio`, one panel for every kind, ready-made step and Digital Worker in the seed, Start and End, Test, Nova, `/runs`, `/runs/[id]`, `/inbox`, `/inbox/[id]` and `/admin/workflows`, then the flows: picker, "+", step menu, delete and Undo, rail placement, radios, Show me, Publish's trap, SelectMenu, Pause, Resume, Stop, Approve. What it found, all fixed:

- **04 §14.3 "The first Tab enters the panel header" was not built.** It went through every box first. The shell now bridges Tab from the opener to the drawer, Shift+Tab back. It also applies to Test and Nova, which were just as far away.
- **Focus lost to the page** after: inserting a step (menu gone), Show me, picking a workflow (button gone while loading), deleting a step, a button that removes itself (Delete path, a conflict choice), Pause (button replaced), Stop, answering an inbox card. Now: a new or shown step's box takes it and becomes the opener; the picker button gets it back after loading; delete goes to the toast's Undo and, when that ends, to the step before; the drawer gives a removed button's focus to what took its place; Pause and Resume are one element; Stop and an answered card land on the page title.
- **No ring** on: "+", Remove branch, Remove, Delete path, logo, Hide, Details summaries, SelectMenu's Clear, Back to inbox, every input, the run page's scrolling step list. 04 §1.3 gives inputs `focus:outline-none` and 04 §14.3 says "All interactive elements show focus-visible rings"; §14.3 is the specific rule about focus, so it wins. Inputs use `focus-within:` because Chromium does not match `:focus-visible` on the host of a date or time input.
- **The rail's hover card** was mouse-only; it now shows on focus. The picker's active row was almost invisible by keyboard, so it gets an outline once arrows are in use (a pointer keeps 04's highlight).
- `prefers-reduced-motion` (04 §2.5) only covered the toast; now everything.

**Known keyboard gap:** SelectMenu's Clear cannot be reached, because 04 §13.5 has Tab close the list. Each selected row can be taken off with Enter, so nothing is out of reach, only slower. Not checked at all: a screen reader, or any browser but Chromium.

**States (M8 item 2).** `/runs`, `/inbox` and both detail pages now say "Loading…" (mine), and an expired session goes to sign-in as Flow Studio does. A seeded tenant with no workflows no longer sits on the skeleton forever. No status or code reaches the screen: a test fails a route with 500 and 503 and looks for them.

**Performance (M8 item 3).** `tests/engine/performance.test.ts`, `tests/e2e/performance.spec.ts`, `tests/support/forty-steps.ts`; numbers in BUILD_REPORT. Latency is the browser's Event Timing, input to next paint, without Playwright's own overhead. "Edits smoothly" has no number in the spec, so I used 200 ms, Core Web Vitals' "good". No code needed changing for performance. **All of it ran on the memory store,** so what Django adds to the 500-item reads is not measured.

**Copy (M8 item 4).** No straight quote in any copy module or JSX text, and a new test finds none on screen across every panel, Test, Nova and Publish of all 15 workflows. 05 §5.3: all 18 strings verbatim. 05 §6–§8 and 04 §15: every string found, or built from parts I checked by hand (46 in 04 §15, plurals and bold splits mostly; the rest are headings written in capitals by CSS, or text that describes a string rather than being one).

**Spec points, with both quotes. No test was weakened.**

1. **Input focus.** Above: 04 §1.3 against 04 §14.3.
2. **"Phone" by what?** 04 §2.5: "**< 720px (phone)**" and "**900–1279px**: the same layout. The drawer keeps its 390px width and covers part of the canvas." These are windows, and the embedded column is narrower than its window, which 04 does not consider. M4 keyed on the shell. A 1100 window is "the same layout" by 04's letter, but rail plus drawer would leave 14 px of canvas, so `narrow` drops the rail and keeps the drawer.

**Two runs were not what they looked like.** The first keyboard run reported 1.1 hours and two tests of about 17 minutes each, one of them timing out in `beforeEach`. Nothing was wrong with those tests: the machine slept, as M4 saw once. The same tests then passed in a 2.5-minute run of 75 tests. They are named in BUILD_REPORT.

### Post-build review

An independent review after M8 found defects that all 239 acceptance tests missed, and reproduced them with probes. Each was treated as a claim: a regression test first, seen failing on M8's code (run again on a checkout of `6dc1bbf`), then the fix. Every finding reproduced. `BUILD_REPORT.md` has the outcome table. Tests: `tests/engine/post-build-review.test.ts`, `tests/api/identity.test.ts`, `tests/django-e2e/identity.spec.ts`, and new cases in `tests/support/store-contract.ts` and `runtime-races.ts`, so those also run on Django.

**What the runtime now holds to.**

- **A requester edits business fields, nothing else** (finding 1). `runtime/records.ts`: `requesterMayEdit` is an allow list, the catalog's `FIELDS` and the dates Waits follow, minus what the runtime keeps (`prev`, `original_total`, `changed_fields`, `states`, `conflict`, `outcomes`, `outcomesL`, `decided`, `edit`), minus what picks who approves (`requester`, `hiring_manager`, `sponsor`, `sponsor_delegate`, `worker_name`, `business_unit`, `country`, `cost_center`, `cost_centers`), minus what checks read as fact (`rate_vs_card_pct`, `rate_vs_market_pct`, `budget_left_after`, `months_engaged_after`, `duplicate_found`, `invoice_matches`, `hours_over_schedule`, `rate_change_pct`), minus risk questions and a rule's flag field. Anything else is refused with 422 `FIELD_NOT_EDITABLE`, never quietly dropped, and nothing is written.
- **May a requester's resubmit change who approves? Not by choosing them, and not by removing them.** Fields that name or select an approver are refused. Value fields stay, because the amount is usually what was wrong. Removing: see "Round 2", item A, which replaced the `RESUBMIT_DROPS_APPROVAL` refusal this first shipped with.
- **provide-field** is for a blank value: it takes only that item's field, of that field's type (422 `INVALID_VALUE`), and a requester can't fill in what would pick their approver. **`POST /runtime/records/:type/:id`** (`editRecordAs`) is a deny list for an admin: not what the runtime keeps, values of the right type. `editRecord` underneath stays open to the runtime's own callers. Inbound events are trusted: the service token or an admin, and `states` and `prev` legitimately arrive that way.
- **An Approve step never finishes without a real decision** (finding 3). `settleApprove` needs one of: every round answered; the plan's `notNeeded`; every role in the plan's `skipped`; or every remaining role asked by a named other step (`coveringSteps`), which must be `done`. Otherwise it re-plans from the run's path and record (`replan(s, 'run')`), and if nothing results it waits with `step.held` and a `paused_step` line. `referenceChanged` looks at held steps too. A step also re-plans whenever it is reached, and so does Auto-approve.
- **`replan` has two modes.** `run` holds every exit the run has taken, for a plan of the run as it stands. `record`, for an edit, holds only a System step's exit: an edit may still move a decided If (M7's E13-edit), but no record can predict a Failed exit. `walkWorkflow` and `planApprovals` take the exits as an optional argument, and Test passes none, so Test's walk is unchanged (AGENTS rule 6).
- **F9 and approvals** (finding 3). An inbound event changes a run only if it moves a Wait or changes the plan's signature (who is asked, what's on the path). If it does, it goes through what an edit does. If it doesn't, nothing is written: `status_elsewhere: 'cancelled'` still touches nothing. A value brought back by a System step goes through the same check.
- **Re-planning reopens** (findings 4 to 7). `applyPlanToSteps` is the one place. A step leaves the line only if the new walk doesn't reach it, not if something before it is open, which fixes a second edit taking steps off the line. Approvals a material change undoes are cleared from round 0 (a rule's approver's stand, 05 §2 "only the people whose answers depend on what changed"). Then any finished step whose stages aren't answered reopens: "New", "Asked again", or a covered step whose coverer reopened. `settleApprove` asks the earliest unanswered round rather than the stored one. What follows a reopened step is held: pending steps can't start, and an open one stays open, as R-11 has always asserted. Done work isn't undone. `endCheck` settles every rule-only round, so one can't be skipped.
- **The first answer wins while paused** (finding 9). A rejection recorded while paused closes the step's other items as a running run does, so a later approval gets the same "This no longer needs you". `settleApprove` won't touch a deferred step.
- **A Chaser copy goes with its original** (finding 10), told and cancelled.
- **The worker** (finding 11). In the engine: `moveOffWorker` beside `moveOffRequester`, the same way, except it pauses rather than leaving them named when there's nobody above. `groupMembers` and `resolveAnyItem` drop them. An Approve step on the `worker` role pauses. In the runtime: `peopleOf`, `keySatisfied`, `chaseTarget` and `openReview`. At decision: 403 `WORKER_CANNOT_DECIDE`. No seeded worker is in `PEOPLE`, so no 06 output changed; a test asserts that for every sample and history record, and all 06 tests pass as they were.
- **Storing an event** (finding 12). `storeEvent` writes the event, the record and every open run's change in one transaction, in the order the deadlock rule needs. A failure leaves nothing, so a sender's retry starts clean, and a queued event is picked up by the tick. `pollSource` shares it; an `exists` on the event's own row is how a poll that sees it twice adds it once. There is no separate `followDates` any more.
- **Draft saves** (finding 8). 01 §4.1's snapshot list is "name, scope, nodes, onReject, source, owner, basis, days, priority". **It omits `records` and `event`, which is how this got through,** so `versionDoc` now adds them. `selectWorkflow`, `findOverlaps`, `inactiveWarning`, Run workflow's target, the 7-day alert, the runs list and the run filter read `publishedFacts` or the version; `pinnedWorkflow` reads only its version, and throws rather than fall back to the draft. Test still runs the draft. `hasUnpublishedChanges` now also compares those settings with the version, or changing the owner would read as nothing to publish, and it would never go out. Before a workflow has a version row (engine tests with no store, a draft), `publishedFacts` reads its own fields, because that is all there is.
- **Overlaps at approval** (finding 13). `approvePublish` rechecks when given `history`; `publishVersion` always gives it. Refusal is 409 `OVERLAP_OPEN` and leaves the request pending, for the approver to reject and the author to send again with a choice. The transaction carries an `expect` on every workflow that could overlap, so two approvals at once can't both pass on stale reads; a patch with only `expect` checks a row without changing it (contract test). On Postgres the loser gets a conflict, or Postgres breaks the deadlock and either may.
- **Publish and status** (finding 14). Publish writes `status` only from `draft`, with `expect: {status: 'draft'}`. A live or inactive workflow's status is left alone, so a switch in the gap stands.
- **Claim first** (finding 14). `tryToStart` commits claim, event and run with nothing advanced, then `withRun` advances it. Nothing reaches a system before the claim, and the run id in an idempotency key is the one that stays. If the process dies in the gap, `tickIsDue` sees a pending Start and the next tick carries on. A run can now be read for a moment with nothing started.

**Siblings found and fixed.** All have a test in `post-build-review.test.ts` or `runtime-checks.test.ts`.

1. An edit blanking a field a decided If read gave it no exit, so the run **completed with no End reached**. The If now asks again.
2. A second edit took what followed a re-asked step off the line, withdrawing its people, and the run could complete past it. This one's root is the same as 4 to 7.
3. An edit that withdrew a step in its resubmit window left the window running, so it **rejected the run when it ran out**.
4. A rule-only round going away withdrew its approvers without telling them (03 §8.4 "approver told").
5. A rule's flag was written only at the start, not when an edit made the rule match (03 §7.2 item 3).
6. A value brought back from a system never re-planned, so a rule it triggered was missed.
7. Auto-approve read the plan as of the last re-plan.
8. A role reached by an Approve step that an earlier step also has (same role, not `also`) read as "not covered" to the old code, which then approved by accident.
9. `chaseTarget`'s hiring-manager branch could land on the worker; `openReview` could ask the worker to review; an Approve step on the `worker` role would have named them.
10. `findOverlaps`, `inactiveWarning`, Run workflow's target, the 7-day alert, the runs list and its filter, and the overlap log line all read drafts (finding 8's class).
11. Record edits and proposal choices logged as `Levv`. They now say who.
12. `flowCard` showed the draft's name for a request; it now shows what was sent.

**Found, not fixed: decisions for the owner.**

1. **A role's holder changing after they approved.** 03 §8.4 tracks "the set of roles that already approved", so if an admin or a source system changes the hiring manager and `material` doesn't list it, the old approval stands for the role. Following the letter of 03. A requester can't do this now.
2. **Switching a workflow back on can create an unresolved overlap.** 03 §14.4 "takes effect immediately, no second person"; 03 §14.5 excludes inactive workflows from overlaps. Round 2 made it visible, not blocked; see item J, which keeps this open.
3. **Events trust the sender for `requester` on a new record.** Whatever eventually raises events has to put the linked person there, not a display name, or the own-request guard has nothing true to read. (Round 2 closed the same thing on a record with an open run.)

**New wording, all mine.** `copy.notLinked` "Your account isn’t linked to a person in Flow Studio yet, so you can’t approve this. Ask an admin to link it."; `copy.overlapOpenAtApproval` "This now overlaps “{other}”, which went live after it was sent. Reject it so the author can choose which one runs, then send it again."; `copy.linkNotAMember`, `linkNotAPerson`, `linkNotATeam`, `linkTaken`; `rc.workerCannotDecide` "You’re the worker on this request, so you can’t approve or review it."; `rc.fieldsNotEditable` "This can’t be changed here: {labels}. Ask the workflow owner."; `rc.valueDoesNotFit` "That isn’t a value {label} can have."; `rc.resubmitDropsApproval` "That change would remove the approval this was sent back from. Ask the workflow owner."; and the plan notes `workerMovesUp`, `workerSpecialistBackup`, `workerSpecialistPaused`, `workerNobodyAbove`, `workerNeverApproves`, modelled on the requester's. No existing copy fitted: `publishBlocked` is addressed to the author ("before sending").

**Tests of mine that changed, none from 06.**

- `runtime-checks.test.ts` "send back: when it comes back the check before it runs again" resubmitted `{duplicate_found: false}`, which is exactly what finding 1 refuses. It now asserts that refusal, then resubmits a business field and asserts the check runs again and flags. What it asserted about the run going on moved to a new test beside it, where the flag is cleared where it is kept.
- `server-helpers.test.ts` "names admins the way sessions are named" asserted the overruled decision. It is replaced by one asserting that only linked admins count and no name is read.
- `tests/django-e2e/runtime.spec.ts` and `flow-studio-django-proof.ts` expected "Local Admin" and "Second Admin". The admin stays unlinked and now reads as their email; the second is linked to Samira Khan, by the proof, through the real route.

No 06 test changed, and no fix contradicted one.

### Post-build review, round 2

The re-review confirmed the 14 fixes hold on their original inputs and found variants and new defects. Same method: every item reproduced with a regression test seen failing on the first round's code (`6b8b619`), then fixed. Tests: `tests/engine/post-build-review-2.test.ts`, additions to `tests/api/identity.test.ts`.

**A. A requester's resubmit can never shrink what's required (the owner's decision).** It may add people, tasks or steps. It can't remove any person, rule task or step required or asked before it, and whoever sent it back always sees it again.

- **Checked against the spec first; not a conflict.** 05 §3.4.3: "On resubmit (`POST /api/runtime/work-items/:id/resubmit {data?, comment?}`, which applies any record changes as an edit, §2), the step asks again." 03 §8.4: "Items in `p0` whose role is no longer in `p1` → "Removed by the edit"". 03 §15 item 5, its only sentence on resubmits: "`requester` → back to the requester to fix and resubmit within `onReject.resubmitDays` (5) days, then the step asks again". 03 §8.4 is about "When the record is edited while approvals are running" and never names a resubmit; only 05 joins the two, and 05 sits below 03 and below the owner's decision. So edits still shrink (test A11), and a resubmit doesn't.
- **How.** `WorkflowRun.floor` (`PlanFloor`), which `planApprovals` honours on every re-plan for the rest of the run. `raiseFloor` in `machine.ts` builds it by comparing the plan before the requester's values with the plan after. **The first version also kept old exits, and the last round took that out: see "Last round", which holds now.**
- **What isn't kept.** A person who already answered a step other than the one sent back, unless a material change makes that "Asked again": their answer stands on the usual terms.
- **"Sees it again" on an any-one item** means they are asked again with the others, and as ever the first answer wins.
- **An admin's later edit doesn't lower the floor;** the run keeps it to its end. Simple and conservative. Say if an admin should be able to.
- **Refused as well:** a requester blanking a field (`null`), and a negative amount. Neither is a fix. Only `budget_left_after` can legitimately be negative.
- **How it's explained.** Run log, type `kept`: "The resubmitted values no longer call for {Legal (Luis Romero), Record IR35 status}. A resubmit can’t take anyone off, so they stay on this request." The person's brief: "The requester’s change no longer calls for you, but a resubmit can’t take anyone off." Their plan note, shown on the run page's round line: "Stays on this: the requester’s change no longer calls for {person}, but a resubmit can’t take anyone off". **Test shows nothing about this, because Test has no resubmit.** Its plan takes no floor, so its output is unchanged.

**B. Withdrawal at re-plan, on any run status.** `letGo` came out of `askRound`, and `applyPlanToSteps` calls it through `withdrawOutdated` for every open step. Asking anyone new still waits for `running`. So a withdrawn approver's item is cancelled the moment the plan changes, by edit or event, paused or not, and a decision gets `RUN_STOPPED`. A rejection recorded by someone before they were withdrawn stands: they were entitled to it when they gave it. A rule's task now goes too, if its rule leaves the plan.

**C. Events.** `intake(input, actor?)`. A new record comes as sent, from either path, including `states` and `prev`, as 05 §3.1 and the fixtures need. On an existing record, only a change counts, because events usually resend the whole record. **An admin's session:** the deny list is a 422 and nothing is stored, and the event and log lines say who (`receivedBy`, `receivedById`, `by`, `byId`). **Both paths, while a run is open:** `requester`, `prev`, `original_total` and `changed_fields` can't change. The admin gets a 422 and can use the record route, which is audited, for `requester`. The token isn't a person to refuse: 05 §3.1 stores what it sends, and a 422 would just make a source system retry. So those keys are dropped from the merge, the event keeps its payload as it arrived, and the run logs `event_ignored`: "An event from {source} tried to change {fields}. That stays as it is while this request is running." `states` from the token still merges, because that's how a prerequisite gets met (C3). `states` from an admin's session is refused: it's on the deny list, and a prerequisite shouldn't be granted by hand.

**D. A failed check's deciders follow the plan.** `settleFailedDecision` and `withdrawOutdated` both `letGo`, copies included. `decidersMoved` lets an event through to them, because they aren't on the plan and so its signature doesn't show them.

**G. Nothing external fires while an earlier approval is outstanding again.** `heldByApproval`: any step `waiting` that is an Approve and leads to this one. A due System retry doesn't fire, and costs no write; once it's answered the next tick fires it, with the new values. A verifier given handed-over documents waits the same way, because it sends them somewhere. **Decisions, recorded:** an open Task stays open and can be finished, as R-11 has it. Finishing it doesn't pass the approval: what follows isn't reached until the approval is answered, which held already. **Its ledger line is written**, because a ledger line records what the worker was actually given, and the laptop has been handed over whatever the approval then says; offboarding has to get it back. A Wait that comes due still finishes, for the same reason, and what follows it holds. A System step already waiting on `confirm` carries on, since that only reads.

**E, F. Hangs in covering.** E: 03 §6.10 merges in round order, and the walk lists a join before its longer branch, so K was merged into J while J waited for K. `mergeStages` no longer merges a step into one it leads to, so **that person is asked at both**, once each; on that shape of graph Test shows the same, by the same engine. If such a cover ever reaches the runtime some other way, `coveringSteps` refuses it and the step is held. F: leading rule rounds are now asked whether or not a step is ready, so a rule a step was merged into can't sit unasked.

**H.** `needInfoPerson`: a blank field that picks the approver doesn't go to the requester who can't answer it. It goes to their manager, or with nobody above them the step waits with a `paused_step` line. `PICKS_THE_APPROVER` moved to `engine/resolve.ts` so Test's "has been asked" text and the run agree. With nobody it reads "Nobody has been asked to fill it in".

**I.** `referenceChanged` looks at running and paused runs, and wakes any with a paused item, a held step, or an item whose people are all filtered out. An import during a manual pause re-plans at once, so Resume needn't.

**J. Overlap through the switch. Open product question.** 03 §14.4 makes it immediate, so it isn't blocked. A live workflow with an unresolved overlap shows, in the panel's existing warning: "This overlaps “{other}” and nothing says which one runs. Until someone chooses, Levv runs the one listed first. Publish a change to choose." The route returns it too. 03 §3.2 item 6's log sentence, "Two workflows overlap; ran “{name}” by priority.", is kept for when a priority decided it. With none: "Two workflows overlap and nothing says which one runs; ran “{name}”, the one listed first." That departs from 03's exact string in a case 03 says "cannot normally happen", at the owner's instruction; no test reads it. **Decision needed: should switching on with an unresolved overlap ask for a choice?**

**K.** Allow lists use `hasOwnProperty`, so `constructor` and `toString` are refused rather than read as fields. `__proto__` is dropped before any `Object.assign`. `AccountLink`'s docstring now says `linkedBy` and `linkedAt` are who changed it last. Run workflow's log line names the published target.

**The safety net.** `pauseIfStuck`, from the tick: a running run with no open item, nothing scheduled and no choice between proposals waiting on its page pauses with `pauseReason: 'stuck'`, by Levv, and tells the owner by In-app and Email. Its banner and log say: "Nothing is open on this request and nothing is scheduled, so Levv paused it. Nothing was approved." It never approves anything; it only changes `status`. A tick reads no more than it did before unless the steps alone suggest it (`mightBeStuck`: nobody assigned, nothing timed). It wakes by itself when an edit, an event that moves the plan or a Wait, or an import might have changed things, and if that didn't help the next tick pauses it again. Resume by hand works the same way. A Wait with no date yet counts, because nothing is scheduled; a date starts it again.

**Siblings found and fixed in round 2.**

1. A step covered by a step that waits for it now fails closed in the runtime as well as the engine.
2. `prev`-based "not asked again" could also shrink on a resubmit: changing a field changes what "the original" walks through. **I wrote here that `raiseFloor`'s people comparison caught this "by construction". It didn't.** It skipped groups, and it counted anyone asked anywhere else. The re-check showed Legal, `g:fin_ctrl` and `g:exco` ending `done/not_asked_again` with nobody asked. Fixed in the last round, with tests.
3. A rule task's item stayed open when its rule left the plan.
4. `__proto__` in a payload reached `Object.assign`.
5. A verifier ran during a re-asked approval, the same as a System retry.

**Not fixed, for a decision.** The items under the first round's "Found, not fixed", as amended: a role's holder changing after they approved, and the switch.

**New wording, all mine:** the `kept`, `event_ignored` and stuck lines above; `rc.mail.stuckSubject` "Nothing is moving: {workflow} for {title}" and `stuckBody`; `copy.overlapAfterSwitch`; `rc.overlapRanNoPriority`; `copy.needInfoNobody`. Removed: `resubmitDropsApproval`.

**Tests of mine that changed, none from 06.** PBR 1f now asserts the decision, as instructed. PBR 1h: the item goes to the manager now, so the test makes that manager the requester to prove the refusal still holds. **No 06 test changed, and no fix contradicted one.**

### Post-build review, last round

A final re-check found three Medium defects and one Low. Each reproduced with a test in `tests/engine/post-build-review-3.test.ts`, seen failing on round 2's code (`bc7ecc2`).

**1. The floor missed group items and people asked elsewhere.** Two things were wrong. The comparison was "does this person appear anywhere", which is the wrong question: Luis being asked for a commercial decision on one step doesn't answer Legal's on another, and a group has no person to compare. And "who approved the original" was recomputed from the new values, so a resubmit could make a step read as already approved. **Now:** `seatAsked` compares per role and, for a one-person item, per person, on the item that holds it, including a role 03 §6.10 merged. `floor.original` freezes the roles that approved the original at the first resubmit, both ways: a role can't start reading as approved, and a role that truly approved doesn't lose that because the requester changed something.

**2. The floor followed old exits, so a branch the record no longer selected ran.** My round 2 design walked both exits so that steps on the old path stayed on the line, which also fired their System and Notify steps, and could carry a corrected value into a rejecting If. The floor's purpose is only that a resubmit can't remove people or rule tasks. **Now it keeps no exits.** An If, Fits plan? or check takes only what its current values select.

- **A kept Approve step is asked with no exit onward** (`floor.steps`, `keptOffPath`). It starts in its old place in the order: when nothing unfinished could still lead to it. Answering it leads nowhere, so what followed it on the old branch doesn't run. If an edit later brings it back onto the path, its exit counts again.
- **What goes out of Levv waits for it:** `SENDS_OUT` (System, Notify, Run workflow), even on the selected path, because that approver may yet say no; a retry and a verifier the same, through `heldByApproval`. A kept step isn't held up by what it holds up, so they can't wait for each other. The run can't complete past an unanswered kept step.
- **Decision, please confirm: Task steps on a branch no longer selected aren't kept.** Round 2's instruction said a resubmit can't remove any "person, rule task or step"; this round's says "keep required people and rule tasks". A workflow's Task *does* something ("Issue the extension letter"), like a System step done by hand, rather than decide, so running one on a branch the record doesn't select seemed the same mistake. Rule tasks are kept. Collect steps on the old branch go the same way as Tasks.

**3. `requester` on an open run.** `editRecordAs` now refuses `requester`, `prev`, `original_total` and `changed_fields` with the same 422 while a run is open, if the value changes. With no run open, an admin can correct it. `editRecord` underneath stays for the runtime's own callers. `/choose`: a stored `conflict` names its own field, so it could name `requester`. A proposal on anything the deny list or `PICKS_THE_APPROVER` holds is now a 422, and writes nothing. **The way out of such a conflict is Stop**, which is deliberately plain; it can only arrive by event. Neither 05 nor any RT test needs either door: 05 §2 says only "Save the new values", and the one test that used the record route, `runtime-screens.spec.ts` "nobody approves their own request" (mine, not 06), now asserts the 422 and withdraws Raj by moving the business unit. `tests/engine/runtime-checks.test.ts` "even if an edit makes them the requester" still proves the decision guard through `editRecord`.

**4. The stuck net.** A retry held behind an approval won't fire, so it no longer counts as scheduled, and a run waiting on an approval nobody can give pauses. `run.stuckTold`: the owner is told once per episode, however many times Resume, an edit or an import wake it. The log line still appears each time, because that is the record of what happened. The episode ends when someone is asked or a Wait gets a date.

**Left open, as instructed; both need decisions.**

1. **A mistaken raise keeps its approvals for the rest of the run, with no route to clear it.** A requester who resubmits an amount far too high brings in Executive sign-off, and correcting it can't take them off. The floor has no admin override.
2. **A token's `prev` with no open run starts a run that can complete with nobody asked.** `EVENT_KEEPS_WHILE_RUNNING` only protects a record with an open run. On a new event, `prev` makes the roles read as having approved the original. That is trust in change events, and **it must be handled before events are connected.**

**Wording:** none new this round. **Tests of mine that changed, none from 06:** PBR 1i and 1h, because the record route now refuses `requester`; `runtime-screens.spec.ts` as above. **No 06 test changed, and no fix contradicted one.**

**Account endpoint.** A pre-existing security issue in an existing account endpoint, outside Flow Studio, was reported to the team privately. Not changed here.

### After launch

- **"+ New workflow" is a button in the top bar, after the status, not the picker's footer row (04 §3, §12).** Asked for by the product owner: inside the picker it was easy to miss. Same string, same action and toast (§12 steps 1 to 3); the picker now lists workflows only. Its keyboard path is Tab from the picker button, then Enter. End-to-end tests that opened the picker to reach it now press the button, and the Tab order, the picker's contents and the 500-workflow option count expect it out of the list.
- **The app's redesign reaches Flow Studio through its chrome only (04 §1.2, §1.3).** Asked for by the product owner. The whole site now takes its palette from CSS variables: `slate`, `gray`, `blue` and `cyan` render as the Levv brand everywhere, and `.levv-spec` restores Tailwind's own values. The Flow Studio shell, its portals (SelectMenu, Publish dialog, Rail tooltip) and the run and inbox screens (`PageFrame` and its dialog) carry that class, so every colour in 04 and 05 computes exactly as before; the end-to-end colour assertions are unchanged. What changes around it: Inter is now loaded (04 §1.2 asks for the Workers Index font), buttons scale to 0.97 while pressed (`levv-press` on `buttonBase`), the app header is 64px (the admin column's heights follow), and the admin settings nav marks the current page with a blue fill and `aria-current` instead of an inset bar. Its tests, and the two that probed the old `!important` theme, now assert the new values.

---

## Folder plan

```
app/
  flow-studio/layout.tsx                    shell, basePath="/flow-studio", variant="page"; it also does the 04 §2.1 redirect
  flow-studio/page.tsx, [workflowId]/page.tsx   null: the layout's shell reads the path
  admin/workflows/layout.tsx                EmbeddedFrame + the same shell, variant="embedded" (decision 1)
  admin/workflows/page.tsx, [workflowId]/page.tsx   null
  runs/page.tsx, runs/[runId]/page.tsx
  inbox/page.tsx, inbox/[itemId]/page.tsx
  api/flow-studio/**                        01 §5.1, plus engine-context
  api/runtime/**                            01 §5.2
  api/test/{reset,sign-in,clock,session}    404 unless LEVV_E2E=1
src/flow-studio/
  model/  engine/  runtime/                 per 01 §2, each with copy.ts where it has strings. Adapters are runtime/adapters.ts
                                            model/ also has schemas.ts, load.ts, context.ts, index.ts (M1)
  data/   driver.ts, repos.ts, draft-fields.ts, memory/, django/, codec.ts, seed-files.ts, seed-writes.ts, seed-guard.ts, select-store.ts, summaries.ts
  server/ session.ts, permissions.ts, clock.ts, tenant-host.ts, backend-client.ts, errors.ts, e2e.ts,
          route.ts, context.ts, publish-decision.ts, runtime-stub.ts, test-route.ts
src/components/flow-studio/                 FlowStudioShell, EmbeddedFrame, TopBar, FlowPicker, Drawer, SelectMenu, StepMenu, TestDrawer, NovaDrawer, PublishDialog, options, kinds, copy, api, draft-journal, use-flow-data, use-editing
src/components/flow-studio/canvas/          layout (pure), test-look, Canvas, StepNode, IfCard, Rail, ZoomControls
src/components/flow-studio/panels/          StepPanel, fields, Chaser, GivesBlock, ConditionEditor, PresetBox, WorkflowSettingsPanel, IfPanel, ApprovePanel, DwPanel, CollectPanel, SystemPanel, SimplePanels
src/components/flow-studio/ui/              primitives per 04 §1.3, Toast
src/components/runs/                        05 §6, §7: shared, RunsPage, RunDetailPage, RunCanvas, InboxPage, InboxCards
scripts/seed-flow-studio.ts                 M3
scripts/flow-studio-django-proof.{sh,ts}    M3: the end-to-end proof on local Postgres (npm run test:django); M7 added the runtime to it
tests/engine/  tests/api/  tests/django/  tests/django-e2e/  tests/e2e/  tests/fixtures/seed/  tests/support/

flow-studio-backend/apps/flowstudio/
  apps.py  models.py  fields.py  auth.py  views.py  urls.py  tests.py  migrations/0001_initial.py, 0002_run_claim.py, 0003_account_link.py
```

New in M5 at the root: `playwright.django.config.ts`. Other files changed, in the milestone noted: `app/layout.tsx` (`isStandalone`, page search) and `app/admin/layout.tsx` (M4). `middleware.ts`, `lib/intelligence/gpt/callGPT.ts`, and `levvai/settings.py` and `levvai/urls.py` in the backend changed in M3. M8 changed `app/layout.tsx` again (`main`'s class on the run screens). No other existing files change.

---

## Baselines

So later milestones are not blamed for what was already there.

| Check | Result before any M0 change (commit `6aa2012`) |
| --- | --- |
| `next build` on Node 20.20.0, no env | **Passes**, about 35 s, 93 static pages. Warnings only: outdated browserslist data, and client-side-rendering deopts on `/auth/login` and `/external/act-as-worker/timesheet` |
| Full-repo ESLint (once installed) | 28 errors, all `react/no-unescaped-entities`, in 15 files; 9 warnings. Not fixed |
| `tsc --noEmit` root | Passes |
| `npm audit` | Reports existing advisories; not addressed |
| Backend `manage.py test` on local Postgres | **48 tests, all pass** |
| Backend `manage.py check` | No issues |

After M0's tooling: `next build` still passes with 93 pages, `npm run lint` and `npm run typecheck` pass. `npm run test:engine` passes with no tests.

After M1: `next build` passes with 93 pages, `lint` and `typecheck` pass, `test:engine` has 165 tests, all passing.

After M2: `next build` passes with 93 pages, `lint` and `typecheck` pass, `test:engine` has 656 tests, all passing. `next build` caught one type error that `tsc -p tsconfig.json` missed because of its stale incremental cache; to check root type errors without building, pass `--incremental false`.

After M3: `next build` passes, `lint` and `typecheck` pass, `test:engine` has 656 tests, `test:api` has 198, `test:django` (`scripts/flow-studio-django-proof.sh`) passes, backend `manage.py test` has 90 tests. All passing.

After M4: `next build` passes with 96 static pages, `lint`, `typecheck` and root `tsc --incremental false` pass, `test:engine` has 670 tests, `test:api` 200, `test:e2e` 50. All passing. Backend untouched.

After M5: `next build` passes with 96 static pages, `lint`, `typecheck` and root `tsc --incremental false` pass, `test:engine` has 676 tests, `test:api` 200, `test:e2e` 145, `test:django` passes with its 15 contract tests, 37 proof checks and 3 browser tests. All passing. Backend untouched.

After M6: `next build` passes with 95 static pages, `lint`, `typecheck` and root `tsc --incremental false` pass, `test:engine` has 676 tests, `test:api` 202, `test:e2e` 223 (three full runs), `test:django` passes with its 15 contract tests, 37 proof checks and 6 browser tests. All passing. Backend untouched.

After M7: `next build` passes with 97 static pages, `lint`, `typecheck` and root `tsc --incremental false` pass, `test:engine` has 750 tests, `test:api` 208, `test:e2e` 273 (three full runs), `test:django` passes with its 15 contract tests, 37 proof checks, 11 browser tests and 13 races, backend `manage.py test` has 92. All passing.

After M8: `next build` passes with 97 static pages, `lint`, `typecheck` and root `tsc --incremental false` pass, `test:engine` has 755 tests, `test:api` 208, `test:e2e` 349 (two full runs), `test:django` passes with its 15 contract tests, 37 proof checks, 11 browser tests and 13 races, backend `manage.py test` has 92, and `makemigrations --check` finds no changes. All passing.

After the post-build review: `next build` passes with 97 static pages, `lint`, `typecheck` and root `tsc --incremental false` pass, `test:engine` has 823 tests, `test:api` 236, `test:e2e` 349 (two full runs), `test:django` passes with its 17 contract tests, 40 proof checks, 17 browser tests and 14 races, backend `manage.py test` has 99, and `makemigrations --check` finds no changes. All passing, with no intermittent failure in the final run.

After round 2 of the review: `next build` passes with 97 static pages, `lint`, `typecheck` and root `tsc --incremental false` pass, `test:engine` has 868 tests, `test:api` 237, `test:e2e` 349 (two full runs), `test:django` passes with its 17 contract tests, 40 proof checks, 17 browser tests and 14 races, backend `manage.py test` has 99, and `makemigrations --check` finds no changes. All passing, with no intermittent failure in the final run.

After the last round of the review: `next build` passes with 97 static pages, `lint`, `typecheck` and root `tsc --incremental false` pass, `test:engine` has 894 tests, `test:api` 238, `test:e2e` 349 (two full runs), `test:django` passes with its 17 contract tests, 40 proof checks, 17 browser tests and 14 races, backend `manage.py test` has 99, and `makemigrations --check` finds no changes. All passing, with no intermittent failure in the final run.

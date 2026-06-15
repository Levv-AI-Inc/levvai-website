# Main/UI Reconciliation PR Playbook

This document breaks the reconciliation into smaller PRs that preserve the UI work from `ui-updates-2026-06-13-v2` while keeping the backend-connected behavior from `main`.

## Branch Strategy

The two branches do not have a shared merge base. Treat this as a tree reconciliation, not a normal merge.

Recommended branch shape:

```bash
git fetch origin main ui-updates-2026-06-13-v2
git switch -c codex/reconcile-main-ui-backend origin/main
```

Use `main` as the base because it contains the backend contracts, auth flow, tenant routing, and API-backed modules. Pull UI from the local `ui-updates-2026-06-13-v2` branch when possible, because the local branch may contain local cleanup that has not been pushed yet.

Do not run an unrelated-history merge as the default path. Prefer targeted restores and manual reconciliation:

```bash
git restore --source ui-updates-2026-06-13-v2 -- app/layout.tsx
git restore --source ui-updates-2026-06-13-v2 -- app/suppliers/page.tsx
```

Then edit those restored files to reapply `main` backend behavior.

If using stacked PRs, branch each PR from the previous phase branch. If using normal PRs, merge each phase into `codex/reconcile-main-ui-backend`, then open the final integration PR back to `main`.

## Global Context For Every PR

Use this context in every implementation prompt:

```text
We are reconciling two unrelated histories in levvai-website.

Source branches:
- main: backend-connected app, auth, tenant/session handling, lib/api wrappers, admin CRUD, intake drafts, suppliers, work orders.
- ui-updates-2026-06-13-v2: richer UI, polished shell, mock-backed dashboards, tables, drawers, Nova surfaces.

Goal:
Preserve the UI/UX from ui-updates-2026-06-13-v2 while keeping main as the source of truth for backend contracts and route behavior.

Rules:
- Start from main or the current reconciliation branch.
- Do not merge unrelated histories wholesale.
- Do not reintroduce .next files.
- Prefer lib/api wrappers from main over ad hoc fetches.
- Replace mock arrays with normalized backend records.
- Preserve auth redirects, CSRF headers, credentials: include, and tenant/session checks.
- Keep changes narrowly scoped to the current phase.
```

## PR 0: Reconciliation Branch And Repo Hygiene

Purpose: create a clean foundation branch and remove generated-file noise before functional reconciliation.

Prompt:

```text
Create the reconciliation foundation for preserving UI work from ui-updates-2026-06-13-v2 while keeping main as the backend source of truth.

Start from main on a new branch named codex/reconcile-main-ui-backend. Inspect the current status and compare config files between main and ui-updates-2026-06-13-v2.

Tasks:
- Ensure .next remains ignored and not tracked.
- Do not carry generated .next artifacts into the reconciliation branch.
- Keep main's Cloud Run deploy docs and env ignore behavior.
- Reconcile package.json conservatively:
  - Keep xlsx only if admin import/export screens remain in scope.
  - Keep docx only if tenant document export remains in scope.
  - Drop @anthropic-ai/sdk if unused.
  - Do not add resend unless keeping the branch's Resend SDK route.
- Keep one Tailwind/PostCSS config set. Prefer main's tailwind.config.js and postcss.config.js unless a UI feature needs extra theme tokens.
- Run npm install only if package-lock needs regeneration.

Acceptance:
- git status has no generated .next changes.
- npm run build reaches application errors only, not config/package errors.
- No UI or backend behavior is intentionally changed yet.
```

Likely files:

- `.gitignore`
- `package.json`
- `package-lock.json`
- `tailwind.config.js`
- `postcss.config.js`
- `README.md`

## PR 1: App Shell, Tenant Session, And Route Split

Purpose: preserve the polished UI shell while keeping `main` auth, tenant, and session behavior.

Prompt:

```text
Reconcile the app shell.

Use ui-updates-2026-06-13-v2 app/layout.tsx as the visual reference, but keep main's auth/session/tenant behavior.

Tasks:
- Keep the polished sidebar/header treatment from the UI branch.
- Add main's tenant validation via lib/tenant.ts.
- Add /api/session loading, account menu, admin role detection, and sign-out via /auth/logout.
- Keep CWRequestProvider around authenticated app content.
- Treat these as standalone routes without the internal shell:
  - /
  - /demo
  - /auth/*
  - /external/*
  - /tenant-not-found
- Change internal Home navigation to /home.
- Show Settings/Admin only for admin users.
- Preserve main's middleware.ts behavior protecting /home.

Acceptance:
- Public / renders without sidebar.
- /auth/login renders without sidebar.
- /home renders inside the app shell when authenticated.
- Account menu loads from /api/session and sign out posts to /auth/logout.
- Admin nav is hidden for non-admin roles.
```

Likely files:

- `app/layout.tsx`
- `middleware.ts`
- `lib/tenant.ts`
- `app/auth/login/page.tsx`
- `app/tenant-not-found/page.tsx`
- `app/requests/new/job/context/CWRequestContext.tsx`

Notes:

- Start from `main` versions of `lib/tenant.ts`, `middleware.ts`, and `app/auth/login/page.tsx`.
- Pull layout styling from the UI branch manually.

## PR 2: Public Landing, Demo, And Authenticated Home

Purpose: resolve the route conflict where the UI branch uses `/` as the product workspace while `main` uses `/` as the public site.

Prompt:

```text
Reconcile public landing, demo, and authenticated home.

Route ownership:
- / should remain main's public Levv landing page.
- /demo should remain main's demo page.
- /home should become the authenticated product workspace, preserving the polished Nova/dashboard UI from ui-updates-2026-06-13-v2 app/page.tsx where practical.

Tasks:
- Keep main's public app/page.tsx and app/demo/page.tsx.
- Move the UI branch's Nova workspace/dashboard design into app/home/page.tsx.
- Preserve main's /home session verification and redirect to /auth/login?next=/home.
- Replace hardcoded pending request counts with /api/intake?status=submitted&mine=true.
- Preserve or intentionally remove the Nova chat box:
  - If preserving it, also port /api/nova/chat and ensure it uses current OpenAI helper conventions.
  - If not preserving it, replace with main's existing hardcoded assistant behavior.
- Use /api/demo-email for demo submissions, not /api/request-demo.

Acceptance:
- / is public marketing/landing.
- /demo can submit to /api/demo-email.
- /home redirects unauthenticated users.
- /home displays backend-loaded pending requests.
- No UI calls a missing API route.
```

Likely files:

- `app/page.tsx`
- `app/demo/page.tsx`
- `app/home/page.tsx`
- `app/api/demo-email/route.ts`
- Optional: `app/api/nova/chat/route.ts`

Open decision:

- Keep Nova chat as a product surface now, or defer it to a later AI/Nova PR.

## PR 3: Contingent Workforce Request Wizard

Purpose: preserve the branch's richer request wizard UI while using `main` intake draft APIs and state model.

Implementation note: completed on the reconciliation branch as a backend-preservation phase. The current wizard keeps `main`'s expanded `CWRequestContext`, sessionStorage persistence, `lib/api/intake` draft writes, rate card loading, supplier loading, and submit behavior. No UI-branch mock wizard files were restored over these backend-connected pages.

Prompt:

```text
Reconcile the contingent workforce job request wizard.

Use main's CWRequestContext and lib/api/intake contract as the source of truth. Use ui-updates-2026-06-13-v2 screens as the visual reference.

Tasks:
- Replace the simple UI-branch CWRequestContext with main's expanded context:
  - intakeId
  - roleId
  - costCenterId
  - siteId
  - legalEntityId
  - supplierId
  - qualificationsEnabled
  - qualifications
  - selectedRateCardId
  - sessionStorage persistence
  - replace and clear helpers
- Reconcile define page:
  - Preserve polished UI layout.
  - Load roles, cost centers, sites, legal entities from lib/api.
  - Save via createIntakeDraft or patchIntake.
  - Redirect unauthorized users to /auth/login.
- Reconcile qualifications pages from main.
- Reconcile financials page:
  - Preserve branch's rich rate/spend UI.
  - Use main's getRateCards/getRateCard, rate structure components, market band calculation, and patchIntake behavior.
- Reconcile suppliers step:
  - Use getSuppliers.
  - Persist selected supplier to intake.
- Reconcile submitted page:
  - Use submitIntake.
  - Show backend approval chain/runtime state.
  - Clear CWRequestContext on success.

Acceptance:
- A user can start a job request, create an intake draft, progress through define, qualifications, financials, suppliers, and submit.
- Reloading mid-flow restores the draft from sessionStorage.
- Every write uses CSRF header behavior from lib/api wrappers.
- Mock template/rate/supplier arrays are gone from the production flow.
```

Likely files:

- `app/requests/new/job/context/CWRequestContext.tsx`
- `lib/cwRequestDraft.ts`
- `lib/api/intake.ts`
- `lib/api/roles.ts`
- `lib/api/rates.ts`
- `lib/api/suppliers.ts`
- `app/requests/new/job/create/define/page.tsx`
- `app/requests/new/job/create/qualifications/page.tsx`
- `app/requests/new/job/create/qualifications/setup/page.tsx`
- `app/requests/new/job/create/financials/page.tsx`
- `app/requests/new/job/create/suppliers/page.tsx`
- `app/requests/new/job/submitted/page.tsx`

## PR 4: Suppliers Directory

Purpose: keep the polished supplier directory UI while wiring it to backend supplier CRUD and invite flows.

Prompt:

```text
Reconcile the suppliers directory.

Use ui-updates-2026-06-13-v2 app/suppliers/page.tsx as the visual reference. Use main's lib/api/suppliers, role gating, modals, and invite behavior as the backend contract.

Tasks:
- Replace the mock suppliers array with getSuppliers.
- Preserve the branch's header, metrics, filters, table styling, and preview drawer.
- Keep main's session role check:
  - view roles: admin, manager, business, finance, viewer
  - manage roles: admin, manager
- Preserve create/edit/delete supplier behavior.
- Preserve supplier contact invite behavior and invite success modal.
- Use backend fields from SupplierRecord:
  - supplier_id/supplier_code
  - name
  - supplier_type
  - category
  - owner_name
  - status
  - risk_level
  - compliance_status
  - active_workers
  - active_sows
- Keep errors and forbidden states visible in the polished UI.

Acceptance:
- Suppliers load from /api/suppliers/.
- Search/status/type filters call getSuppliers with params.
- Admin/manager can create, edit, invite, and delete suppliers.
- Non-manager roles cannot mutate suppliers.
- The branch's visual direction is preserved.
```

Likely files:

- `app/suppliers/page.tsx`
- `app/suppliers/components/SupplierModal.tsx`
- `app/suppliers/components/SupplierInviteModal.tsx`
- `app/suppliers/components/SupplierRowActions.tsx`
- `app/suppliers/components/SuppliersList.tsx`
- `app/suppliers/types.ts`
- `app/suppliers/utils.ts`
- `lib/api/suppliers.ts`

## PR 5: Job Postings, Candidates, And Work Orders

Purpose: preserve the branch's dense operational UI while keeping `main`'s intake/work-order lifecycle.

Prompt:

```text
Reconcile contingent workforce operational pages.

Use ui-updates-2026-06-13-v2 pages as visual references for list density, metrics, filters, and drawers. Use main's lib/api/intake and lib/api/workOrders as the source of truth.

Tasks:
- Job postings list:
  - Replace mock jobPostings with getIntakes.
  - Preserve metrics, search, filters, and preview drawer.
  - Link rows to /cw/job-postings/[intakeId].
- Job posting detail:
  - Keep main's backend-backed detail page.
  - Preserve selected candidate capture and supplier submission flow.
  - Save selected candidates through lib/api/intake.
- My Items job pages:
  - Keep main's intake-backed requester views.
  - Apply UI-branch visual styling where it does not break backend behavior.
- Work orders list:
  - Replace mock workOrderData with getWorkOrders.
  - Preserve branch metrics/table/drawer styling.
  - Keep pagination from main.
- Work order detail:
  - Use main's /cw/work-orders/[workOrderId] route.
  - Remove or redirect old /cw/work-orders/[id].
  - Keep approve/reject/submit behavior through lib/api/workOrders.
- Preserve engagement status labels from lib/api/engagements.

Acceptance:
- Job postings load from intakes.
- Job posting detail can select/create candidate state as in main.
- Work orders load from /api/work-orders with pagination.
- Work order detail can approve/reject/submit when backend permits.
- No mock job posting or work order arrays remain in production pages.
```

Likely files:

- `app/cw/job-postings/page.tsx`
- `app/cw/job-postings/[intakeId]/page.tsx`
- `app/cw/job-postings/[intakeId]/JobPostingDetailClient.tsx`
- `app/my-items/jobs/page.tsx`
- `app/my-items/jobs/[intakeId]/page.tsx`
- `app/my-items/job-postings/[intakeId]/page.tsx`
- `app/cw/work-orders/page.tsx`
- `app/cw/work-orders/[workOrderId]/page.tsx`
- `lib/api/intake.ts`
- `lib/api/workOrders.ts`
- `lib/workOrders.ts`

## PR 6: Admin Master Data And Rate Configuration

Purpose: keep backend-backed admin modules from `main` while improving them toward the UI branch visual style.

Prompt:

```text
Reconcile admin modules.

Use main's admin modules as the behavior source of truth. Use ui-updates-2026-06-13-v2 as a styling reference only where the UI exists.

Tasks:
- Keep main's admin-only guard in app/admin/layout.tsx.
- Preserve or restyle the secondary admin navigation.
- Keep main's admin route structure:
  - /admin/users
  - /admin/company
  - /admin/roles
  - /admin/approval-chains
  - /admin/financial
  - /admin/rates
  - /admin/suppliers
  - /admin/integrations
  - /admin/configuration
- Company:
  - Use backend-backed business units, legal entities, cost centers, sites.
  - Keep add/edit modals from main.
- Users:
  - Use main's backend/session/master-data behavior.
  - Preserve the branch's denser UI treatment where practical.
- Rates:
  - Keep main's structures/cards/rules modules.
  - Do not reintroduce deleted mock rate units/categories pages unless needed.
- Roles and approval chains:
  - Keep main's CRUD editors and catalog/simulation behavior.
- Remove or explicitly defer UI-only admin routes that main deleted:
  - /admin/workers
  - /admin/tenant-docs
  - /admin/compliance/policies

Acceptance:
- Non-admin users are redirected to /home.
- Admin CRUD pages load backend data and can save.
- Rates pages use main's structures/cards/rules routes.
- No deleted mock admin routes are linked from nav unless deliberately restored.
```

Likely files:

- `app/admin/layout.tsx`
- `app/admin/company/**`
- `app/admin/users/**`
- `app/admin/roles/**`
- `app/admin/approval-chains/**`
- `app/admin/rates/**`
- `lib/api/businessUnits.ts`
- `lib/api/costCenters.ts`
- `lib/api/legalEntities.ts`
- `lib/api/sites.ts`
- `lib/api/roles.ts`
- `lib/api/approvalChains.ts`
- `lib/api/rates.ts`

## PR 7: SOW, Services, Workers, Payments, And Remaining UI Surfaces

Purpose: sweep remaining UI-only screens and decide what gets preserved, wired, or deferred.

Prompt:

```text
Reconcile remaining product surfaces after the core backend-connected areas are stable.

Tasks:
- Compare remaining changed pages between main and ui-updates-2026-06-13-v2.
- Preserve UI-branch styling for SOW, RFx, workers, payments, onboarding, timesheets, expenses where there is no backend conflict.
- Keep main behavior where a page already calls backend or internal APIs.
- For removed routes, choose one:
  - restore intentionally,
  - redirect to the replacement route,
  - or leave deleted and remove navigation links.
- Verify API route usage:
  - Keep /api/nova/assist and /api/nova/scan from main.
  - Preserve /api/nova/review-package only if the SOW review UI still calls it.
  - Preserve /api/nova/policy only if the admin/company policy UI still calls it.
  - Preserve /api/tenant-docs only if tenant docs UI is restored.
  - Remove /api/request-demo in favor of /api/demo-email.

Acceptance:
- No page references missing API routes.
- No nav link points to a deleted route.
- SOW/services/workers/payments pages compile and preserve UI improvements where safe.
- Any intentionally deferred route is listed in the PR description.
```

Likely files:

- `app/requests/sow/**`
- `app/services/sow/**`
- `app/services/rfx/page.tsx`
- `app/workers/**`
- `app/payments/**`
- `app/api/nova/**`
- `app/api/tenant-docs/route.ts`

## PR 8: Final Integration Hardening

Purpose: make the reconciliation safe to merge back to `main`.

Implementation note: completed on the reconciliation branch. Final checks found no tracked `.next` files and no stale references to the old UI-only routes/APIs listed below. `npm run build` passes. `npm run lint` currently opens Next's ESLint setup prompt because the repo does not have an ESLint config, so lint was not changed or configured as part of this reconciliation.

Prompt:

```text
Perform final integration hardening for the main/UI reconciliation branch.

Tasks:
- Search for mock arrays that still power production pages.
- Search for missing API route references.
- Search for stale route links:
  - /requests/new/job_posting
  - /sow/
  - /spend
  - /workers/digital-workers
  - /admin/workers
  - /admin/tenant-docs
- Verify all writes use CSRF-aware lib/api wrappers or equivalent headers.
- Run npm run build.
- Run npm run lint if available and still valid for this Next version.
- Start the dev server and browser-check:
  - /
  - /demo
  - /auth/login
  - /home
  - /requests/new/job/create/define
  - /suppliers
  - /cw/job-postings
  - /cw/work-orders
  - /admin/company
  - /admin/rates
- Fix layout regressions caused by backend data length, empty states, loading states, and error states.

Acceptance:
- Build passes.
- No tracked .next files.
- No missing route/API references in normal navigation.
- Core flows work against backend endpoints.
- Final PR description lists restored UI, preserved backend contracts, and intentionally deferred surfaces.
```

Suggested checks:

```bash
rg -n "/api/nova/chat|/api/nova/policy|/api/nova/review-package|/api/request-demo|/api/tenant-docs" app lib
rg -n "const .* = \\[|mock|Mock|sample|Sample|hard-coded|HARD-CODED" app lib
npm run build
```

## Suggested PR Order

1. PR 0: branch hygiene
2. PR 1: shell/auth/tenant route split
3. PR 2: public/demo/home
4. PR 3: job request wizard
5. PR 4: suppliers
6. PR 5: job postings and work orders
7. PR 6: admin modules
8. PR 7: remaining product surfaces
9. PR 8: final hardening

If time is tight, merge PRs 0-5 first. Those cover the highest-conflict areas and the most important backend-connected user flows.

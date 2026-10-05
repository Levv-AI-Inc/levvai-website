# Supplier and User Management MVP Implementation Plan

## Purpose

Implement the Supplier MVP and User Management MVP across the existing Next.js frontend and Django backend while preserving the current tenant, authentication, master-data, rates, approval, work-order, and invitation architecture.

The frontend repository is `levvai-website`. The adjacent backend repository is `levvai-backend`. Most business endpoints are owned by Django and reached through the frontend's existing same-origin proxy. New Next.js API routes should not duplicate Django business logic.

## Delivery principles

- Extend existing endpoints and services before introducing new resources.
- Keep tenant and supplier authorization enforced in Django, regardless of frontend state.
- Preserve current IDs and compatibility for existing supplier, user, intake, rate, and work-order records.
- Separate shared identity from tenant membership, roles, record scope, and approval authority.
- Keep published pricing immutable while draft changes, document extraction, and manual edits are reviewed.
- Treat uploaded documents and extracted content as untrusted data.
- Return explicit denied, no-match, and conflict results instead of choosing silently.
- Deliver through small migrations and independently testable pull requests.

## Existing endpoints to reuse

### Session and authentication

| Existing endpoint | Current use | Planned use |
| --- | --- | --- |
| `GET /api/session` | Returns the authenticated user and active tenant membership | Extend with membership ID, lifecycle state, authorization version, profile type, and effective capability summary |
| `POST /auth/password/login-user` | Internal user login | Keep as the internal password-login entry point |
| `POST /auth/password/register-user` | Generic internal registration | Restrict to approved flows; invitation acceptance must activate a pre-created membership without replacing its configured access |
| `POST /auth/password/register` | Supplier invitation registration | Keep for supplier contacts and strengthen token lifecycle validation |
| WorkOS login and callback endpoints | SSO authentication | Reuse without creating a second SSO path |

### Users and organization data

| Existing endpoint | Current use | Planned use |
| --- | --- | --- |
| `GET /api/admin/users` | Lists up to 200 internal memberships with search and basic filters | Add pagination, organization filter, stable summaries, and action capabilities |
| `POST /api/admin/users` | Creates an internal user and membership | Convert into invitation creation or retain as a compatibility wrapper over the invitation service |
| `PATCH /api/admin/users/{membershipId}` | Updates basic membership and identity fields | Keep for Profile changes; move access, approval, and lifecycle mutations to explicit subresources/actions |
| `GET /api/business-units/` | Business-unit lookup | Reuse for defaults, selected-scope configuration, and filters |
| `GET /api/legal-entities/` | Legal-entity lookup | Reuse for defaults and scope restrictions |
| `GET /api/cost-centers/` | Cost-center lookup | Reuse for profile defaults; cost centers do not grant access |
| `GET /api/sites/` | Site lookup | Reuse for user defaults and supplier coverage |
| `GET /api/roles/` | Canonical customer job-role catalogue | Reuse for supplier coverage and rate lines; do not confuse with user access-role presets |

### Suppliers, work, and invitations

| Existing endpoint | Current use | Planned use |
| --- | --- | --- |
| `GET /api/suppliers/` | Supplier list, search, status, and type filters | Reuse for the supplier directory and add server pagination |
| `POST /api/suppliers/` | Creates a supplier | Keep for authorized manual records; integrated identity fields remain source-owned |
| `GET /api/suppliers/{supplierId}/` | Supplier detail | Extend with source ownership metadata, Levv activation, contact-access summary, and allowed actions |
| `PATCH /api/suppliers/{supplierId}/` | Updates a supplier | Restrict updates to Levv-owned fields and reject writes to source-owned fields |
| `DELETE /api/suppliers/{supplierId}/` | Deletes a supplier | Deprecate for linked suppliers; prefer lifecycle deactivation and protected deletion rules |
| `POST /api/suppliers/{supplierId}/invite/` | Creates and emails a supplier invitation | Reuse for supplier contact access; add resend, revoke, and access-grant semantics |
| `GET /api/work-orders` and detail endpoints | Work-order and assignment data | Reuse to derive supplier workers and preserve assignment-level history |
| Intake endpoints | Requisition and supplier selection | Reuse when applying supplier eligibility and resolved published pricing |

### Rates and approvals

| Existing endpoint | Current use | Planned use |
| --- | --- | --- |
| `GET/POST /api/rate-structures/` | Configures rate calculations | Reuse for Bill Rate and Pay plus Markup calculation structures |
| `GET/PATCH/DELETE /api/rate-structures/{id}/` | Rate-structure lifecycle | Reuse with existing validation and audit service |
| `GET/POST /api/rate-cards/` | Role-centric cards with supplier lines | Evolve compatibly into supplier-scoped agreement cards and versioned drafts |
| `GET/PATCH/DELETE /api/rate-cards/{id}/` | Rate-card editing | Keep paths; change contracts through additive fields and a migration compatibility layer |
| `POST /api/rate-cards/{id}/recalculate/` | Recalculates rate values | Reuse for draft recalculation only |
| `POST /api/rate-cards/{id}/activate/` | Activates a card | Replace internally with validated publication while retaining the action as a compatibility alias |
| `GET /api/rates/lookups/` | Rate status, unit, and rule lookups | Extend with pricing models, location-scope types, extraction states, and conflict types |
| Approval-chain endpoints | Configure and simulate approval routes | Reuse for workflow routing; add membership responsibility checks at decision time |
| Work-order approval endpoints | Approve or reject work | Extend with responsibility, scope, self-approval, currency, limit, and temporary-coverage checks |

## Phase 0 Foundation and contract baseline

### Goals

- Freeze the current frontend-to-backend contracts with tests.
- Identify compatibility constraints before schema migrations.
- Remove ambiguity between prototypes and API-backed modules.

### Backend work

- Add request and response contract tests for session, users, suppliers, organization lookups, rate cards, approval chains, intake, and work orders.
- Document which apps live in the shared schema and which live in tenant schemas.
- Mark `masterdata.RateCard` as legacy and designate `rates.RateCard` as the supported pricing model.
- Add feature flags for the new user detail, supplier detail, and supplier-scoped rate-card flows.

### Frontend work

- Create typed API modules for users and effective access instead of adding more inline `fetch` calls to `app/admin/users/page.tsx`.
- Continue using `lib/api/suppliers.ts`, `lib/api/rates.ts`, `lib/api/roles.ts`, `lib/api/sites.ts`, and the organization API modules.
- Identify `app/admin/rates/page.tsx` as a prototype and make `/admin/rates/cards` the base for production rate-card work.
- Keep `/admin/supplier-network` out of this MVP because configurable distribution tiers are not in scope.

### Exit criteria

- Existing endpoint contracts are covered by tests.
- Legacy and production rate implementations are clearly identified.
- Feature flags allow incremental deployment without exposing unfinished flows.

## Phase 1 Authorization, membership lifecycle, and audit

### Goals

- Establish one reusable authorization decision service for both MVPs.
- Make membership changes safe across tenants.
- Produce audit data that the User Activity tab can display.

### Backend work

- Extend `Membership` with `suspended` and `deactivated` states while migrating the current `disabled` value safely.
- Do not toggle shared `User.is_active` when only one tenant membership changes state.
- Add an `authorization_version` to the membership and bind it into the authenticated tenant session.
- Increment the version on role, scope, restriction, suspension, deactivation, or reactivation changes.
- Extend `GET /api/session` with membership ID, lifecycle state, authorization version, and profile flags.
- Replace direct role-only decisions with an authorization service that evaluates:
  - active membership;
  - tenant boundary;
  - organization boundary;
  - role action;
  - record scope;
  - restricted field controls;
  - supplier or worker isolation;
  - transaction state.
- Keep `HasRole` as a compatibility adapter over the new service for existing views.
- Extend `AuditEvent` with structured metadata: affected membership, reason, before and after values, represented user, and safe display context. Keep the existing payload hash for integrity.
- Add protection against suspending or deactivating the final active customer administrator.

### Frontend work

- Extend the session parser and context with membership identity and capability information.
- Replace hard-coded `role === admin` navigation checks gradually with server-provided capabilities.
- Add reusable unauthorized and effective-access explanation components.

### Exit criteria

- Membership suspension blocks that tenant immediately without disabling unrelated memberships.
- Authorization decisions can return a deterministic explanation.
- Cross-tenant and supplier isolation tests pass through direct API calls.
- User access changes produce displayable audit events.

## Phase 2 User invitation and directory

### Goals

- Deliver a safe invitation lifecycle and a scalable user directory while retaining the current admin-user endpoints.

### Backend work

- Add a tenant user-invitation model with hashed, single-use, expiring tokens.
- Add resend and revoke operations; resending invalidates previous tokens.
- Refactor `POST /api/admin/users` into a compatibility wrapper that creates an invitation and invited membership.
- Extend `GET /api/admin/users` with cursor or page-number pagination, organization filter, role summary, scope summary, last login, and allowed row actions.
- Keep current search, status, role, business-unit, and cost-center filters compatible.
- Add invitation endpoints:
  - `POST /api/admin/user-invitations`
  - `POST /api/admin/user-invitations/{id}/resend`
  - `POST /api/admin/user-invitations/{id}/revoke`
  - `POST /api/admin/user-invitations/{token}/accept`
- Ensure acceptance activates the exact preconfigured membership and cannot claim a duplicate membership.
- For SSO invitations, treat the emailed token as a staging credential only; activate the membership in the existing WorkOS callback after WorkOS returns the same normalized email for the same tenant.
- Use the existing email infrastructure and a local development mail sink.

### Frontend work

- Refactor `/admin/users` into smaller directory, filters, table, and action components.
- Preserve filters and pagination when returning from a user record.
- Replace the current add-user modal with the Identity, Access, and Review invitation flow.
- Display invitation delivery failures and retry actions.
- Use membership ID, not name, for record routes.

### Exit criteria

- Duplicate, expired, revoked, and already-used invitations cannot activate access.
- Directory counts and results respect the same authorization filters.
- Existing user filtering remains functional.
- No real invitation is sent by automated tests.

## Phase 3 User profile and access management

### Goals

- Implement the Profile and Access tabs with explicit, composable access rules.

### Backend work

- Extend the existing membership rather than creating a separate customer-user identity.
- Add membership defaults for business unit, legal entity, cost center, location, and manager. Defaults do not grant access.
- Add personal preference fields through the existing user/profile architecture: supported language, time zone, phone, and title.
- Add user role grants for Customer Administrator, Program Manager, Hiring Manager, Finance, Reviewer, Supplier User, and Worker.
- Map current roles to the new presets during migration:
  - `admin` to Customer Administrator;
  - `manager` to Program Manager;
  - `business` to Hiring Manager;
  - `finance` to Finance;
  - `viewer` to Reviewer.
- Add explicit record-scope types:
  - own and assigned;
  - selected business units with optional legal-entity restrictions;
  - entire customer environment.
- Add restricted-data, confidential-commercial, export, and organization-user-management controls.
- Add endpoints:
  - `GET/PATCH /api/admin/users/{membershipId}` for Profile;
  - `GET/PATCH /api/admin/users/{membershipId}/access`;
  - `POST /api/admin/users/{membershipId}/effective-access/preview`.
- Validate the acting administrator's grant authority on every save.

### Frontend work

- Replace the redirect in `/admin/users/[name]` with `/admin/users/[membershipId]` and a tabbed record shell.
- Build Profile and Access tabs using existing business-unit, legal-entity, cost-center, and site lookups.
- Show combined role actions, record scope, restricted controls, and an administrator-only denial explanation before save.
- Add responsive, keyboard-accessible loading, empty, unauthorized, validation, and retry states.

### Exit criteria

- Multiple compatible roles add actions but do not widen the selected record scope.
- Business-unit selections use OR; legal-entity restrictions add AND.
- Supplier and worker isolation cannot be overridden by broad internal scope.
- Profile defaults never grant record access.

## Phase 4 Approval grants, temporary coverage, and lifecycle actions

### Goals

- Implement the Approvals and Coverage and Activity tabs.
- Connect access administration to actual approval execution.

### Backend work

- Add explicit approval responsibility grants for supported request, budget, timesheet, expense, milestone, and invoice modules.
- Store financial limit and customer approval currency on the grant.
- Add temporary approval coverage with responsibility types, start and end dates, and represented user.
- Prevent overlapping coverage for the same responsibility and recursive delegation.
- Extend current work-order and intake approval checks to require:
  - responsibility grant;
  - assignment to the decision;
  - record access;
  - no self-approval;
  - sufficient financial authority;
  - compatible approval currency.
- Keep the existing approval-chain endpoints for routing; responsibility grants determine whether the resolved person may act.
- Add endpoints:
  - `GET/PATCH /api/admin/users/{membershipId}/approvals`;
  - `GET/POST/PATCH/DELETE /api/admin/users/{membershipId}/coverage`;
  - `GET /api/admin/users/{membershipId}/activity`;
  - lifecycle preview and action endpoints for suspend, deactivate, and reactivate.
- If no eligible approver exists, hold the decision and create an operations exception.

### Frontend work

- Build Approvals and Coverage and Activity tabs.
- Show module availability and disable unsupported responsibility types.
- Preview open work before deactivation and allow immediate access revocation with unresolved work routed to operations.
- Require an explicit access review during reactivation.

### Exit criteria

- Self-approval, insufficient limits, missing responsibility, unsupported currency, and expired coverage block decisions with useful reasons.
- Audit records identify both the actual actor and represented user.
- Lifecycle changes do not disable unrelated tenant memberships.

## Phase 5 Supplier overview, contacts, workers, and coverage

### Goals

- Turn the existing supplier directory into one supplier relationship with connected frontend and Admin views.

### Backend work

- Extend `Supplier` additively with source-system identifiers, source status, last sync, registered address, HQ country, buying entities, business units, and service type.
- Separate `active_in_levv` from the read-only source status.
- Reject mutations to source-owned fields from normal supplier update endpoints.
- Add supplier contact-access records rather than treating an email address as authorization.
- Reuse `POST /api/suppliers/{supplierId}/invite/` and add resend, revoke, and access-update actions.
- Add `SupplierCoverage` linking one supplier, one canonical role from `/api/roles/`, and one site from `/api/sites/`.
- Enforce one supplier-role-site relationship; reactivating an inactive mapping must not create a duplicate.
- Add supplier-scoped endpoints:
  - `GET /api/suppliers/{supplierId}/workers` derived from work orders and assignments;
  - `GET /api/suppliers/{supplierId}/coverage` for the frontend read-only view;
  - `GET/POST/PATCH /api/suppliers/{supplierId}/coverage` for authorized Admin operations;
  - contact-access list and mutation endpoints.
- Preserve existing assignments and historical prices when a supplier or coverage mapping becomes inactive.

### Frontend work

- Keep `/suppliers` as the live supplier directory and link rows to supplier detail.
- Add:
  - `/suppliers/[supplierId]/overview`;
  - `/suppliers/[supplierId]/workers`;
  - `/suppliers/[supplierId]/roles-sites`;
  - `/admin/suppliers/[supplierId]/coverage`.
- Keep the selected supplier visible in breadcrumbs and headers.
- Make ERP-owned fields read-only and Levv activation/contact access explicit.
- Reuse the existing worker or work-order detail experience when opening a worker assignment.
- Do not expose negotiated rates in the frontend supplier tabs.

### Exit criteria

- Every supplier query and mutation is scoped by tenant and supplier on the server.
- A coverage edit appears in the frontend without duplicate configuration.
- Inactive coverage blocks future eligibility but preserves history.
- Supplier workers are retrieved from linked assignments, not display-name matching.

## Phase 6 Supplier-scoped rate cards and immutable publication

### Goals

- Evolve the current rate-card API into supplier-owned commercial agreements without discarding the existing rate structures and calculation service.

### Backend work

- Keep `/api/rate-cards/` paths and existing rate-structure endpoints.
- Add supplier ownership to the rate card and move role identity to individual rate lines.
- Introduce immutable published versions and an editable draft version.
- Add pricing model, optional markup, country, buying-entity scope, and lifecycle metadata.
- Replace free-text line location with an explicit site or country scope.
- Add standard/pay minimum and maximum values and optional OT/DT terms.
- Use decimal-safe calculations and the existing rate-structure calculation service.
- Add optimistic concurrency checks to prevent silent publication overwrites.
- Preserve `POST /api/rate-cards/{id}/activate/` as a compatibility alias for validated publication.
- Add actions for create draft, discard draft, validate, publish, and test resolution.
- Migrate current cards by grouping lines by supplier. Ambiguous or invalid records remain drafts for review.

### Frontend work

- Build supplier-scoped card routes:
  - `/admin/suppliers/[supplierId]/rate-cards`;
  - `/admin/suppliers/[supplierId]/rate-cards/[cardId]`.
- Adapt the existing API-backed rate-card components instead of the hard-coded `/admin/rates` prototype.
- Support manual line entry through the same draft validation and publication path used by extraction.
- Keep agreement documents at the top of the detail screen.

### Exit criteria

- Draft edits cannot change published pricing.
- Unmapped roles, unapproved site coverage, invalid amounts, overlaps, and unresolved conflicts block publication.
- Manual and extracted lines use the same validation service.

## Phase 7 Agreement documents and reviewed extraction

### Goals

- Add secure agreement storage and a reviewable extraction workflow without allowing documents to mutate live pricing.

### Backend work

- Add agreement-document metadata linked to supplier and rate card.
- Use the configured storage abstraction for authorized upload and download.
- Add an extraction-provider interface and extraction-draft records with original values, document/page provenance, confidence, mappings, and unresolved issues.
- Add endpoints for:
  - document upload and authorized download;
  - start extraction;
  - extraction status;
  - review and resolve mappings/conflicts;
  - apply selected results to the rate-card draft.
- Treat filenames, document text, and extracted instructions as untrusted input.
- Never create roles, approve coverage, apply lines, or publish automatically.
- If no production extraction provider exists, enable a clearly labelled development mock that cannot bypass validation or publication gates.

### Frontend work

- Add document list, upload, extraction progress, and extraction-review screens.
- Display original source title, values, page provenance, proposed canonical role/site mapping, coverage status, and conflicting live/draft lines.
- Keep Apply to draft and Publish as separate deliberate actions.

### Exit criteria

- Uploading a document leaves published rates unchanged.
- Ambiguous or missing values remain flagged rather than being invented.
- A document naming another supplier is blocked for explicit review.

## Phase 8 Deterministic rate resolution and operational integration

### Goals

- Replace fuzzy, preselected-card pricing with deterministic supplier agreement resolution.

### Backend work

- Replace the current resolver behavior that can fall back to the first line.
- Resolve using tenant, supplier, canonical role, site, date, currency, unit, and confirmed organizational scope.
- Use published versions only.
- Prefer exact-site pricing over country fallback.
- Return explicit no-match or ambiguity for equally specific overlapping records.
- Return the matched agreement, version, line, and a readable explanation.
- Evaluate supplier activation and approved coverage separately from price resolution.
- Reuse the resolver from intake and work-order services.
- Snapshot accepted commercial terms on downstream records so later agreement changes do not rewrite history.
- Expose a supplier-scoped rate tester endpoint for Admin.

### Frontend work

- Add the rate tester to the supplier rate-card area.
- Display price resolution, eligibility, coverage, and supplier status as separate results.
- Remove demo-only client-side resolution from production paths.

### Exit criteria

- Exact site beats country fallback deterministically.
- Draft changes never affect rate testing.
- No-match and conflict results do not invent a price.
- Intake and work-order tests confirm the same resolver behavior.

## Phase 9 Hardening, rollout, and cleanup

### Backend verification

- Cross-customer, cross-supplier, worker, and restricted-field isolation.
- Direct URL and API bypass attempts.
- Search, list counts, exports, attachments, background work, and Nova enforcement.
- All record-scope and legal-entity combinations.
- Invitation replay, expiry, revoke, resend, and duplicate membership.
- Membership-specific session invalidation and final-administrator protection.
- Coverage uniqueness and historical preservation.
- Draft/published rate immutability and concurrency conflicts.
- Exact-site fallback, effective-date boundaries, no-match, and ambiguity.
- Extraction review and publication gates.
- Approval responsibility, assignment, self-approval, limits, currency, and temporary coverage.
- Complete audit metadata without secrets or invitation tokens.

### Frontend verification

- Add component tests for forms, access summaries, validation, and lifecycle actions.
- Add browser tests for user invitation, access configuration, suspension, supplier coverage, document review, rate publication, and rate testing.
- Inspect primary screens at desktop and narrow widths.
- Verify labeled inputs, keyboard access, focus management, error recovery, and unauthorized states.

### Rollout

- Deploy additive migrations before enabling new frontend routes.
- Backfill membership states, role mappings, and authorization versions.
- Migrate rate cards supplier by supplier and produce a report for unresolved cards.
- Enable new flows for a test tenant first.
- Compare old and new authorization and rate-resolution decisions in logs before full cutover.
- Remove compatibility wrappers and prototype-only state after the migration window.

## Recommended pull request sequence

1. Contract tests, feature flags, and API client extraction.
2. Membership lifecycle, authorization service, and structured audit.
3. User invitation lifecycle and paginated directory.
4. User Profile and Access tabs.
5. Approval grants, coverage, Activity, and lifecycle actions.
6. Supplier source ownership, contact access, and coverage models.
7. Supplier frontend and Admin detail routes.
8. Supplier-scoped rate-card versions and data migration.
9. Agreement documents and extraction review.
10. Deterministic rate resolver and intake/work-order integration.
11. Security, accessibility, browser tests, rollout, and cleanup.

## Decisions required before production publication

- Exact ERP or procurement ownership and payload for supplier fields.
- Whether legal entity and business unit constrain agreement selection.
- How a negotiated amount is selected within a minimum and maximum range.
- OT and DT calculation bases, rounding, and currency precision.
- Customer approval currency and unsupported-currency behavior.
- Production document storage and extraction provider.
- Whether AI supplier distribution recommends recipients or sends automatically.

These decisions do not block the authorization, directory, supplier coverage, draft rate-card, or review workflow phases. They do block final pricing publication or approval behavior where choosing a default would change commercial or security outcomes.

## How to iterate on implementation

Implement the plan as small vertical slices. Each slice should deliver one observable outcome through the backend model or service, an existing endpoint extension, the corresponding frontend behavior, and focused tests. Do not attempt to implement an entire phase in one pass.

### Iteration loop

Use this sequence for every slice:

1. Define one observable outcome, such as an administrator viewing a paginated user directory while preserving filters.
2. Inspect both repositories and identify the current model, service, endpoint, serializer, permission check, frontend API client, and consuming screen.
3. Add or update contract tests that preserve existing behavior before changing the endpoint.
4. Make additive backend changes. Prefer optional fields, new actions, and compatibility wrappers over breaking response changes.
5. Update the typed frontend API layer instead of adding more inline `fetch` calls to page components.
6. Implement the smallest usable UI, including loading, empty, validation, retry, and unauthorized states.
7. Exercise authorization directly through the API as the wrong tenant, role, supplier, or user. Hidden UI controls are not sufficient protection.
8. Run backend tests, frontend lint and build checks, and responsive visual inspection.
9. Commit one coherent change. Keep its migration, endpoint changes, UI, and tests together when they form one usable feature.

### Recommended first iterations

#### Iteration 1 Contract baseline

Outcome: current integration contracts are protected before product behavior changes.

- Add backend tests for `GET /api/session`, `GET /api/admin/users`, `GET /api/suppliers/`, and `GET /api/rate-cards/`.
- Extract user API calls from `app/admin/users/page.tsx` into `lib/api/users.ts`.
- Mark the hard-coded rates page as prototype-only and keep `/admin/rates/cards` as the production implementation base.
- Add feature flags for unfinished user detail, supplier detail, coverage, and rate-card flows.
- Do not change visible product behavior in this iteration.

#### Iteration 2 Membership lifecycle safety

Outcome: an administrator can suspend one tenant membership without disabling the person's access to unrelated tenants.

- Add `suspended`, `deactivated`, and `authorization_version` to the membership lifecycle.
- Stop changing shared `User.is_active` for tenant-specific lifecycle operations.
- Extend `GET /api/session` with the active membership ID, state, and authorization version.
- Add final-active-administrator protection.
- Add direct tests for cross-tenant access and invalidating an affected tenant session.
- Do not build the full user-administration interface yet.

#### Iteration 3 Read-only user detail

Outcome: an administrator can open a stable user record and view Profile information.

- Extend the existing user detail endpoint with profile fields and allowed actions.
- Replace the redirecting user route with a detail shell keyed by membership ID.
- Implement the Profile tab first.
- Link directory rows to the membership-ID route.
- Preserve directory filters and pagination when returning from a record.
- Defer access mutations, approval grants, and lifecycle actions.

#### Iteration 4 User invitations

Outcome: an administrator can configure and send a safe invitation that activates exactly the reviewed membership.

- Add expiring, single-use invitation records with resend and revoke behavior.
- Keep `POST /api/admin/users` as a compatibility wrapper over the invitation service.
- Build the Identity, Access, and Review steps.
- Test token replay, expiry, resend, revoke, duplicate membership, and failed delivery.
- Use a local mail sink or test email backend during development.

#### Iteration 5 Supplier read-only detail

Outcome: an authorized internal user can view one supplier's Overview and Workers without exposing another supplier.

- Extend `GET /api/suppliers/{supplierId}/` additively.
- Add supplier Overview and Workers routes.
- Derive workers from work orders and assignments, never supplier display-name matching.
- Enforce tenant and supplier isolation on the backend.
- Keep source-owned supplier fields read-only.

#### Iteration 6 Supplier coverage

Outcome: an administrator can maintain explicit supplier-role-site coverage and the supplier frontend reflects the same records.

- Add the supplier-role-site coverage model.
- Reuse `/api/roles/` and `/api/sites/` for canonical lookups.
- Add the Admin coverage editor and frontend read-only view.
- Test duplicate prevention, inactive-record reactivation, and preservation of historical assignments.
- Do not add supplier distribution tiers.

Begin supplier-scoped rate-card restructuring, extraction, and deterministic rate resolution only after these foundation iterations are complete.

### Slice sizing rules

A normal implementation slice should contain:

- one migration or a closely related migration set;
- one existing endpoint extension or one small endpoint group;
- one primary screen or tab;
- focused backend tests;
- focused frontend tests where a frontend testing surface exists;
- no unrelated cleanup.

A slice is too large if it changes user authorization, supplier coverage, rate-card migration, document extraction, and approval execution together. Split work at service and endpoint boundaries while preserving a usable vertical outcome.

### Feature flags

Use feature flags to keep incomplete flows inaccessible until their server-side controls are ready. Initial flags should include:

```text
user_detail_v2
user_access_management
supplier_detail_v2
supplier_coverage
supplier_rate_cards_v2
agreement_extraction
deterministic_rate_resolution
```

Feature flags control rollout only. They must not replace Django authorization or record-scope enforcement.

### Implementation task prompt template

Use a bounded prompt for each iteration:

```text
Implement Iteration <number and name> from
docs/supplier-user-management-mvp-implementation-plan.md.

Outcome:
<One observable user or system outcome.>

Scope:
- <Existing model, service, or endpoint to extend.>
- <Frontend route or component to implement.>
- <Required authorization and tests.>
- Reuse the current tenant, authentication, organization, and API patterns.

Do not:
- Implement later plan phases.
- Replace existing authentication or authorization infrastructure wholesale.
- Add unrelated cleanup or generic configuration frameworks.
- Deploy, send real invitations, or modify production data.

Before editing, inspect the relevant backend and frontend code and summarize
the intended migration and compatibility behavior. After implementation,
report changed files, migration behavior, checks run, and remaining risks.
```

For security- or pricing-sensitive slices, add the exact denial and conflict cases that must be tested to the prompt. Do not allow an implementation task to infer commercial rules that are still listed as production decisions.

### Progress tracking

After each merged slice, update the relevant phase or iteration in this file with:

- status: `not started`, `in progress`, `blocked`, or `complete`;
- pull request or commit reference;
- migrations added;
- endpoint contracts added or changed;
- tests added and checks run;
- assumptions verified;
- new decisions or blockers discovered.

Finish each slice, including backend enforcement and tests, before beginning the next screen. This keeps the plan adaptable without accumulating frontend controls that are not connected to authoritative backend behavior.

## Implementation progress

### Iteration 1 Contract baseline

- Status: `complete` (2026-10-04).
- Commit references: backend `affd3cb`; frontend commit containing this progress record.
- Migrations added: none. `makemigrations --check --dry-run` reported no changes.
- Endpoint contracts protected: existing `GET /api/session`, `GET /api/admin/users`, `GET /api/suppliers/`, and `GET /api/rate-cards/` response shapes, current role gates, and the supported rate-card URL resolution.
- Frontend contract work: admin-user list/create/update calls and response normalization moved from `app/admin/users/page.tsx` to `lib/api/users.ts`; current loading, denied, tenant-error, retry, and fallback behavior remains unchanged.
- Baseline markers: `masterdata.RateCard` is documented as legacy; `rates.RateCard` remains the supported `/api/rate-cards/` model; `/admin/rates` is marked prototype-only and `/admin/rates/cards` remains the production base.
- Feature flags: all seven planned rollout flags are declared in Django and Next.js configuration and default to disabled. They do not replace Django authorization and are not wired to alter current routes in this iteration.
- Tests and checks run: 6 new backend contract tests; full backend suite 56/56 passing; Django system check passing; migration drift check found no changes; `npx tsc --noEmit` passing; `npm run build` passing; `git diff --check` passing in both repositories.
- Assumptions verified: `apps.rates.urls` precedes `apps.masterdata.urls`, so `/api/rate-cards/` resolves to the supported `rates.RateCard` view set; supplier and rate-card list contracts remain unpaginated arrays; admin users retain the `{ results: [...] }` wrapper; no visible product behavior changed.
- Decisions or blockers: standalone `npm run lint` is not non-interactive because this repository has no ESLint configuration and Next.js prompts to create one. The production build completed its built-in lint and type validation. No Iteration 2 work was started.

### Iteration 2 Membership lifecycle safety

- Status: `complete` (2026-10-04).
- Commit references: backend `c3157c0`; frontend commit containing this progress record and the additive session parser compatibility update.
- Migrations added: `accounts.0010_membership_lifecycle_safety` adds `Membership.authorization_version` with an initial value of 1, migrates stored `disabled` memberships to `suspended` with legacy access disabled, and adds the `suspended` and `deactivated` lifecycle states. The reverse migration maps both new inactive states back to `disabled`.
- Endpoint contracts changed: `GET /api/session` additively returns `membership_id`, lifecycle `state`, and `authorization_version` in membership/profile metadata. Existing password, supplier, and WorkOS login paths now bind the membership ID and authorization version into the tenant session. `GET`, `POST`, and `PATCH /api/admin/users` accept the legacy `disabled` query/write value as an alias for `suspended`; paths, IDs, filters, and response wrappers remain unchanged.
- Lifecycle enforcement: tenant membership lifecycle writes no longer mutate shared `User.is_active`; access-relevant role, lifecycle, business-unit-scope, and supplier-isolation changes advance the authorization version once. Stale membership-bound sessions are rejected, while valid tenant-only sessions created before this migration are upgraded on first use. Suspending, deactivating, or demoting the final active customer administrator is rejected, with active-administrator rows locked to serialize competing changes.
- Frontend compatibility: the shared session parser retains the new membership ID, state, and authorization version without changing visible navigation. The current user directory continues to present the legacy Disabled label for suspended memberships and does not expose new lifecycle actions.
- Tests and checks run: 9 focused lifecycle/security tests added; session and account contract assertions extended; focused backend suite 33/33 passing; full backend suite 65/65 passing against local PostgreSQL; Django system check passing; migration drift check found no changes; `npx tsc --noEmit` passing; `npm run build` passing; `git diff --check` passing in both repositories. No responsive visual inspection was required because this iteration adds no visible screen or interaction.
- Assumptions verified: membership records are shared-schema records keyed by tenant, all three tenant login paths can bind the exact active membership, the existing admin-user detail route is the only current internal role/lifecycle mutation path, and existing supplier/generic registration activation paths now use the same version-advancing helper. Cost-center defaults do not advance authorization versions because they do not grant record access.
- Decisions or blockers: no production data was modified and no invitation was sent. Existing pre-migration sessions intentionally receive their membership/version binding on first valid use; a membership changed before that first post-deployment request is evaluated from current database state rather than stale session claims. Later-iteration access controls, lifecycle preview/action endpoints, activity UI, and invitation behavior remain out of scope.

### Iteration 3 Read-only user detail

- Status: `complete` (2026-10-05).
- Commit references: backend `9513de0`; frontend commit containing this progress record.
- Migrations added: `accounts.0011_user_profile_membership_defaults` additively adds shared-user phone, title, supported-language, and time-zone fields plus nullable membership defaults for legal entity, site, and manager. Existing users and memberships retain blank or null defaults; no data migration or authorization backfill is required.
- Endpoint contracts changed: existing `GET /api/admin/users/{membershipId}` now returns the stable membership payload with profile preferences, working-default display values, manager summary, and `allowed_actions: ["view_profile"]`. The existing `PATCH` path and list response wrapper remain compatible. Detail lookup remains tenant-scoped, administrator-only, and excludes supplier and worker memberships; another tenant's identifier returns 404.
- Frontend behavior: `lib/api/users.ts` now owns the typed detail request and additive response normalization. The redirecting name route was replaced by `/admin/users/[membershipId]`, with a Profile-first record shell and loading, empty, unauthorized, not-found, validation-safe-ID, and retry states. Directory names link to the membership route when `user_detail_v2` is enabled. Active search, role, status, business-unit, cost-center, and any existing page query are retained in the directory URL and validated return link.
- Compatibility behavior: stored role and lifecycle values, the directory's legacy Disabled display alias, existing create/update behavior, and the `{ results: [...] }` list contract are unchanged. Profile defaults are labelled as prefills and are not consulted by authorization. The rollout flag still defaults to disabled and direct detail navigation returns to the directory while disabled.
- Tests and checks run: 3 focused detail contract/security tests added, including non-administrator denial and cross-tenant/supplier-safe lookup behavior; full backend suite 68/68 passing against isolated local PostgreSQL; Django system check passing; migration drift check found no changes; `npx tsc --noEmit` passing; `npm run build` passing; `git diff --check` passing in both repositories. Desktop and compact-width browser inspection covered the rendered Profile shell, horizontal tab overflow, and stacked cards.
- Assumptions verified: `accounts.User` and `accounts.Membership` remain shared-schema identity/membership records while business units, legal entities, cost centers, and sites remain tenant-schema display lookups; adding nullable/default-empty fields preserves existing records. The current directory has no server pagination yet, so this slice preserves a `page` query when present without implementing Iteration 2 pagination retroactively.
- Decisions or blockers: the existing global application and Admin navigation columns are fixed-width and consume most of the viewport at tablet/mobile widths. The new record content stacks and scrolls safely, but a broader responsive navigation-shell change remains outside this slice. No frontend unit-test runner is configured, so type/build checks and browser inspection provide frontend verification. Access mutations, role-grant presets, approvals, lifecycle actions, invitations, and later supplier work were not started. No production data was modified and no invitation was sent.

### Iteration 4 User invitations

- Status: `complete` (2026-10-05).
- Commit references: backend `31ebaed` plus SSO-confirmation hardening `6733a4d`; frontend commit containing this progress record.
- Migrations added: `accounts.0012_userinvitation` adds one shared-schema invitation per reviewed membership, with tenant/email binding, SHA-256 token digest and non-secret hint, expiry and single-use lifecycle states, delivery state, actor timestamps, and a tenant/email/status index. It does not backfill or modify existing users or memberships.
- Endpoint contracts added or changed: `POST /api/admin/users` remains the compatibility entry point but now always creates an inactive invited membership and invitation while preserving the reviewed role, organization defaults, and authentication mode. Canonical `POST /api/admin/user-invitations`, admin-only `POST /api/admin/user-invitations/{id}/resend` and `/revoke`, and tenant-scoped public `POST /api/admin/user-invitations/{token}/accept` were added. List/detail payloads add invitation summaries only when one exists, preserving existing wrappers and identifiers. Generic registration cannot claim an invited internal membership, and pending invitation access is locked against the legacy PATCH path.
- Invitation behavior: only token digests are stored; raw tokens exist only while composing the invitation link. Resend atomically rotates the digest and invalidates the previous link; revoke and expiry block acceptance; row locking makes acceptance single-use. Password acceptance either establishes a policy-compliant password or verifies the shared identity's existing password. SSO acceptance is two-stage: the emailed token stores only the pending invitation identifier and tenant in the session, while the existing WorkOS callback activates the exact reviewed membership and consumes the invitation only after WorkOS returns the same normalized email. A mismatched email or tenant leaves the membership invited and the invitation pending. Neither flow replaces role or organization defaults, changes unrelated tenant memberships, or mutates shared authentication mode for an existing identity.
- Frontend behavior: the Add User modal is replaced by keyboard-accessible Identity, Access, and Review steps backed by `lib/api/users.ts`. Review makes the inactive-until-accepted behavior explicit. Directory rows expose resend/retry and revoke operations, show delivery failures without exposing provider details, and suppress legacy access editing while an invitation is pending. The shared login screen recognizes internal invitation links while retaining supplier and worker invitation routing.
- Tests and checks run: 15 focused invitation tests cover token hashing, local/test email delivery, simulated delivery failure, exact-membership activation, replay, expiry, revoke, resend token rotation, wrong-tenant denial, duplicate membership, generic-registration bypass, legacy-PATCH conflict, non-administrator denial, SSO staging without activation, same-email WorkOS finalization, mismatched-email denial, and callback reuse of the reviewed membership. Focused invitation tests 15/15 passing; full backend suite 83/83 passing against local PostgreSQL; Django system check passing; migration drift check found no changes; `npx tsc --noEmit` passing; `npm run build` passing; `git diff --check` passing in both repositories. Desktop and 390-by-844 browser inspection covered Identity, Access, and Review without submitting an invitation.
- Assumptions verified: `accounts.User`, `Membership`, and invitation records belong in the shared schema; tenant business-unit and cost-center identifiers remain reviewed membership defaults and do not grant record access; WorkOS supplies the verified identity email after validating the configured organization or connection; the existing callback can finalize the exact reviewed membership instead of provisioning a default-role membership; and same-origin proxying keeps invitation staging and the WorkOS session on the tenant host. The compatibility wrapper intentionally normalizes any create request to `invited` rather than honoring an immediate-active status.
- Decisions or blockers: no production data was modified and no real invitation was sent. Production email-provider configuration and delivery observability still require rollout validation. The existing fixed-width application and Admin navigation shell continues to constrain narrow screens until collapsed; the new modal itself fits and scrolls at compact width. No frontend unit-test runner is configured, and standalone `npm run lint` remains interactive because the repository has no ESLint configuration. Approval grants, lifecycle actions, supplier work, and later iterations were not started.

### Iteration 5 Supplier read-only detail

- Status: `complete` (2026-10-05).
- Commit references: backend `7e985fb`; frontend commit containing this progress record.
- Migrations added: `masterdata.0010_supplier_active_in_levv_supplier_business_units_and_more` additively adds optional source system and identifier, source status and last-sync timestamp, registered address, HQ country, buying-entity and business-unit metadata, service type, and indexed `active_in_levv`. Existing inactive suppliers are backfilled as inactive in Levv, existing service type is initialized from `supplier_type`, and all other source fields remain empty until an integration supplies them. No supplier identifiers, relationships, or historical work orders are rewritten.
- Endpoint contracts added or changed: existing `GET /api/suppliers/{supplierId}/` now uses an additive detail serializer with source-ownership metadata, independent Levv activation, and read-only Overview/Workers actions. The established unpaginated `GET /api/suppliers/` array and its exact row shape remain unchanged. Normal supplier create and update requests explicitly reject source-owned fields while retaining the existing paths and Levv-owned field behavior. New paginated `GET /api/suppliers/{supplierId}/workers/` returns worker and assignment context from `WorkOrder.supplier_id`, canonical role/site relations, and tenant scope without bill or pay rates.
- Authorization and isolation: both detail routes keep the current authenticated active-tenant and internal-role gates. Supplier records are resolved inside the active tenant schema; the Workers query additionally binds the selected supplier foreign key and the request tenant ID, while allowing legacy null tenant IDs only inside that already-isolated tenant schema. Supplier memberships and requests without an active membership are denied before object lookup. No display-name matching is used.
- Frontend behavior: `lib/api/suppliers.ts` now owns typed detail and worker contracts and normalization. Feature-flagged supplier directory IDs and names open `/suppliers/{supplierId}/overview`; shared Overview and Workers routes keep the selected supplier visible in the header and tabs. The Overview labels source-owned values as read-only and keeps Levv activation separate from source status. Workers provide desktop table and compact card layouts, empty state, pagination, and links to the existing work-order detail route. Both routes include loading, invalid-ID/not-found, denied, retry, and unauthenticated redirect behavior. Roles and sites remains visibly unavailable for the later coverage iteration.
- Tests and checks run: 7 focused supplier detail/security tests added; supplier plus baseline contract tests 16/16 passing; full backend suite 90/90 passing against isolated local PostgreSQL; the migration applied successfully to shared and tenant schemas; Django system check passing; migration drift check found no changes; `npx tsc --noEmit` passing; `npm run build` passing; and `git diff --check` passing in both repositories. Desktop and 390-by-844 browser inspection covered directory links, read-only Overview, empty Workers, a temporary linked assignment, and compact card layout; the temporary local assignment was removed afterward.
- Assumptions verified: `Supplier`, `WorkOrder`, role, and site records are tenant-schema models; the current work order is the authoritative assignment record and has a direct supplier foreign key; existing work-order detail is the supported assignment destination; source integration payload details remain undecided, so additive JSON metadata accepts source references without inventing relational ownership; and the feature flag remains a rollout control rather than an authorization boundary.
- Decisions or blockers: exact procurement/ERP payload ownership and normalization still require the production decision already recorded above. The existing fixed-width global navigation continues to reduce usable width on small screens until collapsed; the new content itself stacks and switches from table to cards. No frontend unit-test runner is configured, standalone `npm run lint` remains interactive, and the build continues to report existing client-rendering and outdated Browserslist-data warnings. No production data was modified, no invitation was sent, and supplier coverage, contact-access mutation, rate cards, extraction, approval work, and later iterations were not started.

### Iteration 6 Supplier coverage (Phase 5 continuation)

- Status: `complete` (2026-10-05).
- Commit references: backend `a822eae`; frontend `69e1147`.
- Migrations added: `masterdata.0011_suppliercoverage_and_more` creates tenant-schema `SupplierCoverage` with direct supplier, canonical role, and site foreign keys, an active/inactive lifecycle, timestamps, a supplier/active index, and a database uniqueness constraint for each supplier-role-site tuple. It creates no coverage rows and does not rewrite suppliers, roles, sites, work orders, or assignments.
- Endpoint contracts added: internal active members may read `GET /api/suppliers/{supplierId}/coverage/`; customer administrators may create through `POST /api/suppliers/{supplierId}/coverage/` and activate or deactivate through `PATCH /api/suppliers/{supplierId}/coverage/{coverageId}/`. A new tuple returns 201, an inactive tuple is atomically reactivated in place with 200, and an already-active duplicate returns 409. Role and site IDs resolve in the active tenant schema, the URL supplier is authoritative, and only active roles and sites may be added or reactivated.
- Compatibility behavior: the existing supplier list, detail, update, source-ownership, workers, role, site, work-order, and assignment contracts are unchanged. Coverage deactivation updates the existing mapping rather than deleting it; historical assignments remain readable and are not rewritten. Coverage is not yet connected to supplier selection or pricing, so this slice does not change operational eligibility behavior outside the new coverage endpoints and screens.
- Frontend behavior: `lib/api/suppliers.ts` owns typed coverage reads and mutations. When `supplier_coverage` is enabled, `/suppliers/{supplierId}/roles-sites` shows the same mappings read-only with loading, empty, denied, not-found, retry, desktop-table, and compact-card states. `/admin/suppliers/{supplierId}/coverage` reuses the canonical role and site API clients and provides administrator create, deactivate, and reactivate controls while keeping the selected supplier visible.
- Tests and checks run: 8 focused coverage model/API tests plus the 7 Iteration 5 supplier tests pass; the full backend suite passes 98/98 against isolated local PostgreSQL; the migration applied successfully through both shared and tenant migration commands; Django system check and migration drift check pass; `npx tsc --noEmit`, `npm run build`, and `git diff --check` pass. Desktop and 390-by-844 inspection covered empty and populated read-only coverage plus the populated Admin editor; the temporary local coverage row was removed afterward.
- Assumptions verified: supplier, coverage, role, and site data belong in the tenant schema; direct foreign keys are the canonical identity boundary; customer administrator means the existing `admin` membership role for mutations, while all existing internal supplier-view roles retain read access; active duplicate creation is an explicit conflict rather than a silent success; and feature flags control rollout only, not server authorization.
- Decisions or blockers: the fixed-width global and Admin navigation shells still constrain the Admin editor at narrow widths, although the new content stacks and the read-only view switches to compact cards after the global sidebar is collapsed. No frontend unit-test runner is configured, standalone lint remains interactive, and the build retains the existing client-rendering and outdated Browserslist warnings. A local `seed_local_data --refresh` attempt encountered a pre-existing duplicate workflow-scope-field validation issue; existing isolated seed data was sufficient for inspection. No production data was modified, no invitation was sent, and contact access, Levv activation administration, deletion protection, rate cards, extraction, approval work, and later iterations were not started.

### Iteration 7 Supplier contact access (Phase 5 continuation)

- Status: `complete` (2026-10-05).
- Commit references: backend `627b0be`; frontend commit containing this progress record.
- Migrations added: `accounts.0013_supplierinvite_delivery_error_and_more` creates shared-schema `SupplierContactAccess`, binds it to tenant and numeric tenant-schema supplier ID without a cross-schema foreign key, optionally links the exact supplier membership, and adds pending/active/revoked/expired lifecycle and uniqueness for tenant/supplier/normalized-email. `SupplierInvite` additively gains contact-access linkage, SHA-256 token digest/hint, delivery status/error, and sent/revoked timestamps while retaining nullable legacy plaintext tokens only for one-time transition acceptance. The data migration coalesces existing invitations by normalized target, binds matching supplier memberships, and creates active access records for legitimate pre-invitation supplier memberships so existing supplier logins remain compatible. It sends no email and changes no supplier, coverage, work-order, or assignment records.
- Endpoint contracts added or changed: administrator-only `GET /api/suppliers/{supplierId}/contact-access/`, `POST /api/suppliers/{supplierId}/contact-access/{accessId}/resend/`, and `POST /api/suppliers/{supplierId}/contact-access/{accessId}/revoke/` were added. Existing `POST /api/suppliers/{supplierId}/invite/` remains the create compatibility entry point but now returns the server-owned contact-access lifecycle without raw token or registration link. Supplier registration still uses `/auth/password/register`, but supplier-ID/email-only self-registration is rejected; a valid supplier or worker invitation is required. Supplier login now requires both the exact active supplier membership and matching active contact-access record.
- Invitation and authorization behavior: new raw credentials exist only while composing email; resend revokes and clears every previous digest or legacy token before issuing one credential. Acceptance locks and activates the exact reviewed tenant, supplier, email, access row, and pre-created supplier membership; it cannot claim a worker/internal identity or move a supplier membership. A legacy pending plaintext invite is accepted once through the same service and then cleared. Revocation invalidates pending credentials immediately and deactivates only the exact supplier membership while advancing its authorization version; the shared user and unrelated tenant memberships remain unchanged. Delivery failure leaves a non-active retryable record with a safe error.
- Frontend behavior: `lib/api/suppliers.ts` owns typed contact-access lifecycle reads and mutations. `/admin/suppliers/{supplierId}/contact-access` keeps the supplier visible and implements invite, retry/resend, revoke confirmation, delivery/lifecycle badges, loading, empty, denied, not-found, validation, and retry states. The live supplier directory routes the administrator Contact access row action to this screen; managers retain supplier maintenance without invitation authority. Existing create-and-invite success UI no longer exposes or copies bearer links.
- Tests and checks run: focused contact-access service/API tests plus existing supplier detail/coverage tests pass; full backend suite 113/113 passes against isolated local PostgreSQL; Django system check and migration drift check pass; the migration applied successfully to shared and tenant schemas; `npx tsc --noEmit` and `npm run build` pass. Desktop and 390-by-844 browser inspection covered the empty Admin contact-access screen without submitting an invitation. `git diff --check` passes in both repositories.
- Assumptions verified: supplier contact access is shared-schema identity/authorization state while the supplier remains tenant-schema data; numeric supplier identity is always validated in `schema_context`; supplier membership plus contact-access state is the authorization boundary; existing supplier memberships require an explicit compatibility backfill; and no supplier sub-role settings exist today, so this slice exposes lifecycle actions rather than inventing unapproved supplier permissions.
- Decisions or blockers: no production data was modified and no real invitation was sent. Production email-provider delivery/observability remains a rollout validation item. The fixed-width global and Admin navigation shells leave very little content width at 390 pixels even after the global sidebar collapses; the new form and list stack correctly, but the shared Admin shell remains the limiting layout. No frontend unit-test runner is configured, standalone lint remains interactive, and the build retains existing client-rendering and outdated Browserslist warnings. Supplier activation/deletion, rate cards, extraction, approval work, and later iterations were not started.

## Next-agent handoff: continue Phase 5 supplier management

Updated 2026-10-05 after supplier contact access completed.

### Repository state

- Frontend repository: `/Users/markli/code/levvai-website`; supplier contact-access UI and this progress record are the latest slice.
- Backend repository: `/Users/markli/code/levvai-backend`; current completed-work commit `627b0be` (`Add supplier contact access lifecycle`).
- Iterations 1 through 7 are complete.
- Latest verified baseline: full backend suite 113/113, Django system check, migration drift check, `npx tsc --noEmit`, production frontend build, `git diff --check`, and desktop/compact browser inspection all passed.
- The local PostgreSQL test container was stopped after verification. Use the backend's `docker-compose.local.yml`, `scripts/local-compose.env`, and `scripts/local-env.sh` for isolated local verification; do not use production data.

### Phase context

Supplier Overview, Workers, coverage, and contact access are complete. The remaining Phase 5 slice is supplier activation and protected deletion. Do not begin supplier-scoped rate cards until it is complete.

### Next bounded slice: supplier activation and protected deletion

Observable outcome: a customer administrator can review a supplier's linked operational history and safely activate or deactivate Levv usage without editing source status or deleting historical relationships.

- Make `active_in_levv` administrator-managed while source-owned status remains read-only.
- Add a lifecycle preview that counts linked work orders/assignments, coverage, contact access/invitations, and any existing commercial history without exposing unrelated suppliers.
- Deactivation must block future operational eligibility but preserve supplier identity, work orders, assignments, coverage, contacts, invitations, and history.
- Hard deletion may remain on the existing endpoint only when no protected linkage exists; return an explicit conflict and deactivation guidance otherwise.
- Keep list/detail identifiers and source-owned-field rejection compatible. Extend existing supplier endpoints and `lib/api/suppliers.ts`; do not add a parallel business resource.
- Add direct wrong-tenant, non-administrator, linked-history, empty-supplier deletion, repeat-deactivation, and source-status mutation tests.
- Build the smallest Admin lifecycle section with preview, explicit confirmation, loading/denied/not-found/conflict/retry states, and desktop/compact inspection.
- Do not implement supplier distribution tiers, rate cards, extraction, pricing resolution, approvals, deployment, or production-data changes.

### Known context and risks

- The application and Admin navigation shells remain fixed-width at narrow viewports. Keep new contact-access content responsive without broad navigation-shell cleanup.
- No frontend unit-test runner is configured. Standalone `npm run lint` remains interactive because the repository has no ESLint configuration; the production build performs its built-in lint/type validation.
- `accounts.User`, `Membership`, `SupplierInvite`, `SupplierContactAccess`, and `UserInvitation` are shared-schema records. `Supplier` remains tenant-schema data, so shared records store `supplier_id` and validate it inside `schema_context(tenant.schema_name)`.
- Supplier invitation credentials are now hashed for new/resend flows. Do not restore raw tokens to models or Admin responses.
- The new supplier source fields intentionally use additive JSON metadata because the exact ERP payload remains a production decision; do not use those labels as coverage identities.
- Invitation email-provider rollout remains a production validation item; it does not authorize real invitation delivery during remaining work.
- A local `seed_local_data --refresh` run currently encounters a pre-existing duplicate workflow-scope-field validation error. This does not affect the test suite but should not be “fixed” as unrelated cleanup in the contact-access slice.

### Implementation starting points for activation/deletion

- Backend: extend `SupplierViewSet` and supplier serializers in `apps/masterdata`; use `WorkOrder`, `SupplierCoverage`, shared `SupplierContactAccess`/`SupplierInvite`, and supported rates models only for scoped preview counts and protection checks.
- Frontend: extend `lib/api/suppliers.ts` and the existing Admin supplier detail patterns. Keep `source_status` visibly separate and read-only.
- Use the isolated local PostgreSQL workflow, create only temporary local fixtures needed to test linked and unlinked suppliers, remove them afterward, and stop local services.
- Run focused lifecycle/deletion tests, the full backend suite, Django system and migration-drift checks, `npx tsc --noEmit`, `npm run build`, `git diff --check`, and desktop/390-by-844 inspection. Update this progress record and handoff when complete.

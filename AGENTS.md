# AGENTS.md — Levv (instructions for coding agents)

> Put this file at the repository root. If an AGENTS.md already exists, append this whole file as a section titled "Flow Studio". Codex reads it automatically on every task.

## What you are building

**Levv Flow Studio** is a visual workflow builder for contingent-workforce processes: work orders, onboarding, offboarding, assignment changes, SOWs, timesheets, invoices and access requests. Approvals are steps inside workflows. It also needs a **runtime** that runs published workflows for real records, with manual **Pause / Resume / Stop**.

The complete specification is in `docs/flow-studio/`. Read it before writing code:

| File | Read for |
| --- | --- |
| `00-overview.md` | Product, principles, final decisions, scope, precedence, open questions |
| `01-architecture.md` | Stack, folders, persistence schema, API, permissions, time, Nova, test harness, build order |
| `02-data-model.md` | Every type and default; seed loading and normalisation |
| `03-engine.md` | Every rule and algorithm, with exact strings and worked examples; §20 = deviations from the prototype to build |
| `04-ui.md` | Every screen, panel, field, state, interaction and string; the SelectMenu dropdown; §16 = differences from the prototype |
| `05-runtime.md` | Runs, executors, scheduler, adapters, inbox, run screens, Pause / Resume / Stop |
| `06-acceptance-tests.md` | 239 tests: the definition of done |
| `seed/*.json` | The data contract and fixtures. Use these field names exactly |
| `reference/flow-studio-v35.html` | Clickable prototype. Open it to see behaviour and look. **Never copy its code** |

**Precedence when documents disagree:** 00 → 03 → 02 → 04 → 06 (06 §7.3 records any known cases). The spec wins over the prototype wherever the spec says it deviates.

## Stack (do not change)

- Next.js App Router, TypeScript (`strict`), Tailwind CSS, lucide-react.
- AI: the existing `callGPT` helper (OpenAI GPT-4.1-mini). Do not add any other AI provider or SDK.
- Zod for validation. Vitest for unit tests. Playwright for end-to-end tests.
- Database: use the repo's existing data layer. Only if there is none, add Prisma + PostgreSQL as in `01-architecture.md` §4.
- Design: reuse the tokens and components of the **Workers Index** page (the design-system source of truth):
  - cyan accent, not indigo; slate neutrals;
  - slate-950 for the canvas and Nova surfaces;
  - amber / rose / emerald only as status signals;
  - badges `rounded-md text-[10px] font-black uppercase tracking-wider`.
- No new UI libraries unless the repo already has them. Build the canvas, nodes, If card and SelectMenu in-house.

## Non-negotiable product rules

1. **One thing to build: workflows.** Approvals are Approve steps on the canvas. Never build approval flows, an approvals tab, an approval library, drill-in or breadcrumbs, a "Request approval" step, an Update record step, a Milestone step, or a Settings page or button.
2. **No pills, no native `<select>`.** Every selection, single or multi, uses the one SelectMenu component (`04-ui.md` §13). Switches stay switches.
3. **Nothing is deleted.** There is no delete for workflows, versions or runs. Workflows are switched Active / Inactive. Steps can be deleted while editing.
4. **People decide.** Digital Workers never approve or reject. The worker never approves, reviews or is escalated to. Nobody eligible means the step pauses; it is never approved automatically. A request is never approved by the person who raised it.
5. **Exact copy.** Every user-visible string in 03/04/05 is exact, including curly quotes. Keep strings in `copy.ts` modules shared by components and tests.
6. **One engine.** Test (simulation) and real runs call the same pure engine functions. The engine has no React, DOM, network, database or system clock (pass `asOf` / `now`).
7. **Seed field names are the data model.** Never rename them. Normalise on load (`02-data-model.md` §15).
8. **Publishing is safe.** Show the impact; overlaps and must-fix items block. A second person with "Approve flow changes" approves. The author can never approve their own change. Running workflows keep their version.
9. **Accessible.** The roles and accessible names in `06-acceptance-tests.md` §1.5 are required. Keyboard works everywhere.

## Commands (create them if missing)

```
npm run lint
npm run typecheck          # tsc --noEmit
npm run test:engine        # vitest run tests/engine
npm run test:e2e           # builds, starts with LEVV_E2E=1 LEVV_FIXED_NOW=2026-10-20T09:00:00Z LEVV_MOCK_AUTOCOMPLETE=1, runs playwright
npm run seed:flow-studio   # loads docs/flow-studio/seed into the database (idempotent)
```

Before you finish any task, run `lint`, `typecheck` and the tests for the milestone you touched. Never leave a failing test without saying so in the report.

## Working style

- **Discover first.** On the first task, read the repo and write `docs/flow-studio/IMPLEMENTATION_NOTES.md` covering: folder conventions, auth and permissions, database layer, design tokens and components found, the `callGPT` signature, and any mismatch with the spec plus your resolution. Keep it updated.
- **Don't ask; decide and record.** When the spec is silent, apply the principles in `00-overview.md` §2, choose the simplest option, and record it in IMPLEMENTATION_NOTES under "Decisions made during the build". Do not stop to ask questions.
- **Small, complete files.** No TODOs in shipped paths. No commented-out code. No dead legacy features from the prototype.
- **Tests are the contract.** Implement the tests in `06` as written (ids in test names, e.g. `EN-017`, `UI-A1`, `RT-04`). If a test seems wrong, do not weaken it; record the issue in IMPLEMENTATION_NOTES and follow the precedence rule.
- At the end of each milestone, update `docs/flow-studio/BUILD_REPORT.md`: what was built, test counts (pass / fail), known gaps, and decisions made.

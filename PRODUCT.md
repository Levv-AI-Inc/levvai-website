# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Enterprise teams that run an external workforce (contractors, statement-of-work engagements and the suppliers behind them):

- **Hiring managers** raise requests for workers or SOW work and track them through approval, onboarding and the engagement. They are daily operators.
- **Programme and procurement admins** set the policy the product enforces: approval chains, rates and rate cards, suppliers, roles, compliance policies, onboarding and offboarding requirements, and workflows. They are daily operators.
- **Finance** approves timesheets, expenses and invoices, and watches cost.
- **Suppliers and workers** use their own portals: suppliers manage contacts, coverage and candidates; workers complete onboarding, timesheets and expenses.

Each tenant is one company, on its own subdomain (`<tenant>.levvai.com`).

## Product Purpose

Levv runs the whole life of external work on one operating record: requisition, approval, onboarding, the engagement itself (time, tenure, cost) and offboarding. It replaces email threads, spreadsheets and disconnected tools, so every decision carries its policy, commercial, worker and supplier context, and nothing about a worker falls between systems.

Success is a governed request that turns into a ready worker without manual chasing, and an engagement that closes cleanly (access removed, obligations met) when the work ends.

## Positioning

"The operating system for external work." One operating record from requisition to offboarding, with **Nova**, Levv's AI agent, reading each request, applying the company's policy (worker classification, IR35 and jurisdiction rules, co-employment tenure limits) and routing it to the right approval chain. Flow Studio lets admins design those workflows visually.

## Operating Context

- Requests: guided and direct intake for jobs and SOWs (define, qualifications, financials, suppliers, terms, review).
- Approvals: chains and groups; approvals are steps inside workflows. A request is never approved by the person who raised it, and digital workers never approve.
- Workers: index, onboarding (screening, compliance, training, access, workspace), engagements, offboarding, timesheets, expenses, digital workers.
- Suppliers: supplier network, contact access, coverage, roles and sites.
- Payments: invoices and payments. Compliance: policies. Inbox and runs for workflow tasks.
- Integrations named in the product: Workday HCM, DocuSign, Microsoft Teams, Slack.

## Capabilities and Constraints

- Stack: Next.js (App Router), TypeScript, Tailwind CSS, lucide-react, framer-motion; Django backend (django-tenants) on Supabase Postgres; deployed to Google Cloud Run behind a load balancer.
- No new UI libraries unless the repo already has them.
- Flow Studio (`/admin/workflows`) is specified exactly in `docs/flow-studio/` (strings, roles, accessible names, layout). Changes to it are recorded in `docs/flow-studio/IMPLEMENTATION_NOTES.md`.
- Product terms: request, work order, job posting, SOW, engagement, worker, digital worker, supplier, rate card, approval chain, workflow, run, Nova.

## Brand Commitments

- Name: **Levv** (company and product), written as the `levv.` wordmark in the app and `LEVVAI` in the brand lockup.
- Logo assets: `public/logos/levvai-brand.png` (mark + wordmark), `levvai-mark.png` (the folded "L" mark), `levvai-wordmark.png`.
- Keep the existing brand identity and the product's plain, operational voice; the redesign modernises, it does not rebrand.
- The AI agent is called **Nova**.
- Inside the signed-in app, text and numbers are set in **Helvetica** (Arial on Windows), the face the app always rendered in: its old stack named Inter but never loaded it. Archivo, loaded Inter and a monospace for figures were each tried and the user preferred Helvetica (2026-11-08). The landing page keeps Inter, with Archivo as its display face.

## Evidence on Hand

- Real product UI in this repository is the proof the marketing page may show.
- **No customer names, logos, testimonials, metrics or quotes exist. Never invent them.**
- The integration logo files in `public/logos/` (workday, docusign, teams, slack) are empty 0-byte files. Show integrations by name, or with their official icons only.

## Product Principles

1. One record, end to end: never split a worker's story across screens that disagree.
2. Policy is enforced before exposure: checks happen at request time, not after.
3. People decide: automation routes and prepares; accountable humans approve.
4. Every decision carries its context: the approver never has to go looking.
5. Nothing is lost: workflows, versions and runs are kept; things are switched off, not deleted.

## Accessibility & Inclusion

Keyboard works everywhere; roles and accessible names in Flow Studio follow `docs/flow-studio/06-acceptance-tests.md` §1.5.

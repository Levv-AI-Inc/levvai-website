---
version: 1
slug: "app-admin-layout-tsx"
primary_target: "app/admin/layout.tsx"
related_targets: ["app/admin/approval-groups/page.tsx","app/admin/approval-chains/components/ApprovalChainsListPage.tsx","app/home/page.tsx","app/layout.tsx"]
---

# Levv app: the Exposure record world (admin settings first, then the Control desk and every authenticated screen)

Mode: Operate. Visitor: programme and procurement admins, hiring managers and finance, at a desk in office light, setting policy at onboarding and returning when it changes. Constraints: the landing page keeps its own brand surface; spec-pinned screens (Flow Studio, run screens, inbox, `.levv-spec`) keep their pinned look; the admin settings menu's labels, order and column geometry are pinned by Flow Studio's acceptance tests; motion stays at press and hover feedback; only real data in sentences, figures and marks.

## Direction contract

THESIS: The app reads like a precise exposure record, not a SaaS dashboard: one tonal ramp from Rail Navy to backlit paper, square geometry, tracked capitals for every legend and tabular figures for every number, with hatching that shows where approval capacity is thin and crossed hatching where one person holds two steps. It refuses the AI-app default of grey grounds with white rounded cards and pill badges.

OWN-WORLD: Eleven neutrals only (Z0 #0a1330 to Z10 #f5f4ef); Levv Blue #2658e4 is the single glowing accent for the primary action, selection and focus; status markers are small solid squares. Helvetica for text (the face the app always rendered in; the user's call over Archivo and loaded Inter), UPPERCASE tracked .06em at 11–12px for labels, column heads, nav sections and buttons; numbers in tabular Helvetica, semibold where they lead (the user's call over Martian Mono). Corners 0–2px; no cards: tables sit on the ground under a 2px Z0 head rule with 1px Z8 rules between rows. A thin zone wedge (eleven swatches) is the one small mark in page headers.

STORY: The admin sees what the page governs in a plain sentence, reads the scale in tabular figures, spots bottlenecks and conflicts by hatching before reading a word, and edits one row.

FIRST VIEWPORT: Navy rail at the left; the settings column beside it; content on paper: breadcrumb in tracked caps, the title in Helvetica 30–34px with the zone wedge at the right, the sentence beneath, the primary action in Levv Blue at the right; a conflict notice when one exists; filters with caps labels above standard controls; the hatch legend; the table to the fold; a summary line under it.

FORM: Exposure record (the dealt lead of the bolder re-roll, chosen by the user over Coupon book and Route map); seed:01aac8661fa91b6b.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

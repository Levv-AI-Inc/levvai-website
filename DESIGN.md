---
name: Levv
description: The operating system for external work. The signed-in app reads as an exposure record; the landing page is a navy stage.
colors:
  levv-blue: "#2658e4"
  levv-blue-deep: "#1e46c4"
  levv-blue-wash: "#eef4ff"
  focus-halo: "rgb(38 88 228 / 0.28)"
  zone-0-rail-navy: "#0a1330"
  zone-1: "#19213b"
  zone-2: "#283049"
  zone-3: "#3a425a"
  zone-4: "#4f566c"
  zone-5: "#676d81"
  zone-6: "#82879a"
  zone-7: "#a1a5b3"
  zone-8: "#c2c4cd"
  zone-9: "#e0e1e5"
  zone-10-backlit-paper: "#f5f4ef"
  record-surface: "#fbfaf6"
  record-sunken: "#ecebe6"
  record-rule: "#d3d4d9"
  status-positive: "#1f8a5b"
  status-attention: "#d97706"
  status-critical: "#c0392b"
  nova-cyan: "#3fb6f7"
  landing-ground: "#f3f5f9"
  landing-surface: "#ffffff"
  landing-sunken: "#f6f8fb"
  landing-line: "#e0e6ef"
  landing-ink: "#0a1128"
  landing-muted: "#616e84"
typography:
  record-title:
    fontFamily: "Helvetica, Arial, sans-serif"
    fontSize: "2.125rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  record-title-compact:
    fontFamily: "Helvetica, Arial, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  stat-figure:
    fontFamily: "Helvetica, Arial, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
    fontFeature: "'tnum'"
  title:
    fontFamily: "Helvetica, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
  statement:
    fontFamily: "Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.625
  body:
    fontFamily: "Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  body-small:
    fontFamily: "Helvetica, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  legend:
    fontFamily: "Helvetica, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "0.06em"
  legend-control:
    fontFamily: "Helvetica, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "0.06em"
  landing-display:
    fontFamily: "Archivo, Inter, ui-sans-serif, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 500
    lineHeight: 0.98
    letterSpacing: "-0.032em"
    fontVariation: "'wdth' 112"
  landing-section:
    fontFamily: "Archivo, Inter, ui-sans-serif, sans-serif"
    fontSize: "3rem"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.032em"
    fontVariation: "'wdth' 112"
  landing-body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'cv02', 'cv03', 'cv04', 'cv11'"
rounded:
  record-hairline: "1px"
  record: "2px"
  landing-sm: "0.125rem"
  landing-md: "0.375rem"
  landing-lg: "0.5rem"
  landing-xl: "0.625rem"
  landing-2xl: "0.75rem"
  landing-pill: "9999px"
spacing:
  cell: "12px"
  control-inline: "14px"
  section: "24px"
  page-sm: "20px"
  page-md: "24px"
  page-lg: "32px"
  control-height: "36px"
  top-bar: "64px"
  rail: "248px"
  rail-collapsed: "68px"
  settings-column: "208px"
components:
  button-primary:
    backgroundColor: "{colors.levv-blue}"
    textColor: "{colors.zone-10-backlit-paper}"
    typography: "{typography.legend-control}"
    rounded: "{rounded.record}"
    height: "36px"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.levv-blue-deep}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.zone-0-rail-navy}"
    typography: "{typography.legend-control}"
    rounded: "{rounded.record}"
    height: "36px"
    padding: "0 14px"
  button-secondary-hover:
    backgroundColor: "{colors.zone-9}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.zone-3}"
    typography: "{typography.legend-control}"
    rounded: "{rounded.record}"
    height: "36px"
    padding: "0 14px"
  input:
    backgroundColor: "{colors.record-surface}"
    textColor: "{colors.zone-0-rail-navy}"
    typography: "{typography.body}"
    rounded: "{rounded.record}"
    height: "36px"
    padding: "0 12px"
  segmented-option:
    backgroundColor: "transparent"
    textColor: "{colors.zone-2}"
    typography: "{typography.legend}"
    height: "34px"
    padding: "0 14px"
  segmented-option-selected:
    backgroundColor: "{colors.levv-blue}"
    textColor: "{colors.zone-10-backlit-paper}"
  tab:
    textColor: "{colors.zone-5}"
    typography: "{typography.legend-control}"
    height: "40px"
  tab-selected:
    textColor: "{colors.zone-0-rail-navy}"
  table-head:
    textColor: "{colors.zone-5}"
    typography: "{typography.legend}"
    padding: "10px 12px"
  table-cell:
    textColor: "{colors.zone-2}"
    typography: "{typography.body}"
    padding: "12px"
  status-marker:
    backgroundColor: "{colors.status-positive}"
    size: "8px"
  rail-nav-item:
    backgroundColor: "{colors.zone-0-rail-navy}"
    textColor: "{colors.zone-7}"
    rounded: "{rounded.record}"
    height: "36px"
    padding: "0 10px"
  rail-nav-item-active:
    backgroundColor: "{colors.levv-blue}"
    textColor: "{colors.zone-10-backlit-paper}"
  settings-nav-item-active:
    backgroundColor: "{colors.record-surface}"
    textColor: "{colors.levv-blue}"
    rounded: "{rounded.record}"
    height: "32px"
    padding: "0 10px"
  landing-button:
    rounded: "{rounded.landing-pill}"
---

# Design System: Levv

The site carries three visual worlds, and each has a hard boundary in the code:

1. **The signed-in app, the exposure record.** Everything under `body.levv-auth-shell`: the navy rail, the top bar, the admin settings column and every authenticated page. This is the main system and most of this file.
2. **Spec-pinned screens.** Flow Studio, run screens and the inbox carry `.levv-spec`. They keep their own pinned palette and corners. Only the boundary is recorded here.
3. **The landing page.** `/` renders in the standalone body, without the auth shell. It has its own type pairing and the navy stage.

Tokens prefixed `landing-` belong only to world 3. Every other token belongs to world 1.

## Overview

**Creative North Star: "The Exposure Record"**

The signed-in app reads like a precise record, not a SaaS dashboard. One tonal ramp runs from Rail Navy to backlit paper. Geometry is square. Every legend is set in tracked capitals and every figure is tabular. Hatching shows where approval capacity is thin before anyone reads a word. Pages open on what they govern: a location trail, a title, one plain sentence computed from the live data, and a summary line of figures. Tables sit straight on the paper, with no box around them.

The density suits operators at a desk who return to the same settings over and over. Rows are compact (12px cells, 36px controls), colour is held back, and Levv Blue is the only thing that glows. Text and numbers are set in Helvetica (Arial on Windows). The app always rendered in this face, because the old stack named Inter but never loaded it. The user tried Archivo, loaded Inter and a monospace for figures, and kept Helvetica.

**Key Characteristics:**
- Eleven-step zone ramp, Z0 Rail Navy to Z10 backlit paper; Levv Blue the single accent.
- 1–2px corners on everything inside the shell, whatever radius class a component asks for.
- Tracked uppercase legends (11–12px, .06em) for column heads, labels, buttons, tabs and segmented options.
- A status is a small solid square beside plain text.
- Tables are unframed, with a 2px Rail Navy rule under the heads and hairline rules between rows.
- Motion is feedback only: press, colour fades and the frame's disclosures.

## Colors

The app is a cool-to-warm grey ramp with one blue voice. Status colours appear only beside the thing they qualify.

### Primary
- **Levv Blue** (`levv-blue`): the primary action on a page, the selected segmented option, the open tab's underline, the current page in the rail (filled) and in the settings column (blue text), focus borders and the focus outline. Hover deepens it to **Levv Blue Deep** (`levv-blue-deep`). **Focus Halo** (`focus-halo`) is the 3px ring around a focused field.
- **Levv Blue Wash** (`levv-blue-wash`): the hover ground behind the Nova prompt's text button. Nowhere else in the app.

### Neutral
The zone ramp sets the whole Tailwind `slate` and `gray` scale inside the shell (slate-950 = Z0 down to slate-50 = Z10). Existing utility classes therefore land on the ramp without being edited.
- **Rail Navy, Z0** (`zone-0-rail-navy`): the rail, primary ink (`--ink`), the 2px rule under table heads and over stat strips, secondary-button borders and the segmented control's frame. The browser theme colour too.
- **Z1** (`zone-1`): secondary ink for h2/h3 (`--ink-2`).
- **Z2–Z3**: table-cell text and ghost-button text.
- **Z5** (`zone-5`): muted text, legends, column heads and labels (`--muted`).
- **Z6** (`zone-6`): faint text, icons at rest, rail section legends and the hatch stroke (`--faint`).
- **Z7** (`zone-7`): strong rule, the field border (`--line-strong`).
- **Z9** (`zone-9`): hover ground for ghost and secondary controls.
- **Backlit Paper, Z10** (`zone-10-backlit-paper`): the page ground under the top bar and content (`--ground`).
- **Record Surface** (`record-surface`): fields, panels and the open settings-column item. A shade lighter than the ground.
- **Record Sunken** (`record-sunken`): row hover, read-only fields and detail tiles.
- **Record Rule** (`record-rule`): hairline rules between rows, panel borders and the top bar's lower edge (`--line`).

### Status
- **Positive** (`status-positive`), **Attention** (`status-attention`), **Critical** (`status-critical`): status markers, notice rings and their icons. Critical also draws the conflict cross-hatch and the unread dot on the bell.
- **Nova Cyan** (`nova-cyan`): the Sparkles mark inside the Nova prompt's navy tile. It belongs to Nova and to nothing else.

### Named Rules
**The One Glow Rule.** Levv Blue is the only accent inside the shell. Violet and purple utilities are repainted to Levv Blue by the shell itself. Never add a second accent.

**The Ramp Rule.** Neutrals come from the zone ramp or its three surface companions (surface, sunken, rule). Don't hand-mix another grey.

## Typography

**Body Font:** Helvetica (with Arial, sans-serif), set as `--font-app` under the auth shell. It sets text, figures, headings and controls alike.
**Label Font:** the same face, in tracked uppercase.

**Character:** One neutral grotesque, used at a few sizes and set apart by weight and tracking. Hierarchy comes from tracked capitals against sentence case, never from a second family.

### Hierarchy
- **Record title** (600, 1.875rem, rising to 2.125rem from 640px up, line-height 1.1, -0.025em): the h1 of every record header.
- **Stat figure** (600, 1.375rem, -0.015em, tabular): values in a stat strip.
- **Title** (600, 15px): panel headings.
- **Statement** (400, 14px, line-height 1.625, max 72ch): the sentence under the title.
- **Body** (400, 14px): table cells, fields, prose. **Body small** (13px) for secondary lines, status text, notices and figure values in the summary line.
- **Legend** (600, 11px, .06em, uppercase): column heads, figure labels, filter labels, the trail, framed tags and segmented options. Buttons and tabs use the 12px step.

### Named Rules
**The Tabular Rule.** Every number is tabular (`tabular-nums`; tables apply it automatically). A number that leads its line is semibold.

**The One Face Rule.** Don't load Inter, Archivo or a monospace inside the shell. They were tried and rejected. Inside the shell, `font-sans` resolves to Helvetica.

## Layout

The frame is three columns. On the left is the navy rail: 248px, collapsing to 68px, and off-canvas below 1024px. Next comes the main column, under a sticky 64px top bar holding search, the bell and the account menu. Admin pages add a 208px settings column, sticky from 1024px, ruled off at its right. Below 1024px it becomes a horizontal strip ruled underneath.

Content padding is 20px, then 24px from 640px and 32px from 1024px. Pages are capped at 1440px (`LevvPage` wide) and stack their sections 24px apart. Within a page the order is fixed: record header, then any conflict notice, then filters (legends above standard controls), then the hatch legend where hatching appears, then the table.

Lists answer to their column, not the viewport. A `levv-cq` container shows stacked rows below 700px of its own width, the table from 700px, and wide-only columns from 860px. This matters because, between 1024px and 1340px, the rail and the settings column are both docked and the content column is narrow.

### Named Rules
**The Live Sentence Rule.** Every record header carries one sentence computed from the data on the page: counts, the routing rule, or the empty or error case. It has states for loading, error, empty, and one versus many. Never write a slogan there. A page that loads nothing it could count (a prototype on sample data, a generator with no records) keeps its plain description instead and shows no figures: a missing sentence is better than an invented one.

## Elevation & Depth

The record is flat. Pages, tables, panels and stat strips have no shadow. Depth comes from the ramp (paper ground, slightly lighter surfaces, sunken hover) and from rules: hairlines between rows, 2px navy rules above data.

Only floating layers cast a shadow. These are the account menu, search results and right-hand drawers, as soft navy-tinted shadows (values in the sidecar).

### Named Rules
**The Flat Record Rule.** Anything that sits in the page flow is flat. A shadow means the layer floats above the page and can be dismissed.

## Shapes

Inside the shell, every Tailwind radius step resolves to 2px (`rounded-sm` to 1px). Panels, fields, buttons, notices and menus therefore all read as square, even when the component asks for `rounded-xl`. Buttons and links with `rounded-xl` or `rounded-2xl` are forced to the same 2px. Status markers, lifecycle segments, the zone wedge and hatch swatches are true squares and rectangles.

### Hatching
Hatching is a 45° pattern of 1px strokes in Z6. It marks how many people can complete an approval step. It is dense (4px pitch) for one person, mid (7px) for two, and light (11px) for three or more. **Crossed hatching** in Critical (5px pitch, ±45°) marks one person holding two steps of the same chain. Wherever hatching appears, a legend sits right beside it and explains the densities in plain words.

### Named Rules
**The Square Rule.** Corners are 1–2px. Don't use pills or circles for status, tags, buttons or segmented options.

## Components

### Buttons
Buttons are square, tracked and firm.
- **Shape:** 2px corners, 36px tall, 14px inline padding, 12px tracked capitals, 16px icons.
- **Primary:** Levv Blue with white text, deepening on hover. A page has one primary action, at the right of its record header.
- **Secondary:** transparent, with a 1px Rail Navy border and navy text. Hover adds Z9.
- **Ghost:** Z3 text that darkens to Z0 over Z9 on hover. Danger ghost uses rose text.
- **Press and focus:** a 120ms press to 97% scale, 160ms colour fades, and a 2px Levv Blue focus ring offset from the paper.

### Segmented control
This is one choice among two to four. The group is framed by 1px Rail Navy and the options are divided by navy hairlines. The selected option is filled with Levv Blue and white text. The others are Z2 text over Z9 on hover. Options are 34px tall and set as legends.

### Tabs
Tabs mark sections of one page. They are 12px tracked capitals, 40px tall and 24px apart, on a hairline rule. The open tab carries a 2px Levv Blue underline and Z0 text, and counts sit beside labels in tabular Z6. Tabs move with the arrow keys, and if every option has a route the strip renders as links.

### Status
- **Marker:** an 8px solid square in the status colour beside 13px text (Z0 text, or Z5 for neutral). Neutral is a hollow square with a Z6 border.
- **Framed tag:** a tag without a marker is a legend in a 1px half-tone border of its status colour. It is never filled and never round.

### Tables
- No frame and no head fill. Heads are legends in Z5 over a 2px Rail Navy rule, 10px vertical padding, and never wrap.
- Cells are 14px Z2 text with 12px padding and Record Rule hairlines. Row hover fades to Record Sunken in 160ms.
- In a narrow column the same rows render as a stacked list under the same 2px navy rule.

### Inputs / Fields
- **Style:** 36px tall on Record Surface, with a 1px Z7 border, 2px corners and 14px text. Placeholder text is Z5.
- **Focus:** the border turns Levv Blue and a 3px Focus Halo appears, with no outline.
- **Read-only:** Record Sunken, with muted text.
- **Labels:** legends above the control.

### Cards / Containers
- **Panel:** Record Surface with a 1px Record Rule border, 2px corners and no shadow. Panels hold forms and detail groups. Lists and tables are never put in a panel.
- **Stat strip:** figures as one strip of the record, not a row of tiles. It has a 2px Rail Navy rule on top, legend labels and stat figures, in two columns on small screens and one row from 1024px.
- **Notice:** Record Surface with a 1px inset ring in the tone colour at 40–45% and an icon in the tone. Critical notices are announced as alerts. A conflict notice sits directly under the header.
- **Empty state:** centred, with a 40px Z9 icon tile, a 14px semibold title and a 13px muted line.

### Navigation
- **Rail:** Rail Navy, with rows 36px tall at 13.5px medium weight. Rows at rest are Z7 text with Z6 icons. Hover lifts to 7% white with white text. The current page is filled Levv Blue with white text and icon. Section legends are 11px tracked capitals in Z6, and when the rail collapses they become hairlines.
- **Settings column:** rows 32px tall at 13.5px. The current page is Levv Blue semibold on Record Surface with a hairline inset ring. Others are Z3, darkening over Z9 on hover. Labels and order are pinned by Flow Studio's acceptance tests.
- **Top bar:** paper ground over a Record Rule hairline.

### Record header (signature)
A page opens on its record:
- the trail (the page's location in legend type, such as "Admin settings / Approval chains") at the left, with the **zone wedge** at the right;
- the record title;
- the live statement;
- the summary line of figures (legend labels beside 13px semibold tabular values);
- the page's one command, bottom-right.

The zone wedge is the world's one small mark: the eleven ramp steps as 10×6px swatches inside a hairline frame. It is hidden below 640px.

### Lifecycle track (signature)
This shows where a record stands in its five stages: requisition, approval, onboarding, engagement, offboarding. Segments are 6px tall with 3px gaps. The current stage is a 16px segment in Levv Blue (or amber or rose), finished stages are 10px Z6 and stages ahead are Z8, followed by a 13px label.

### Nova prompt (signature)
Nova has one recognisable place on every screen that offers it. It is a 36px field holding a 28px Rail Navy tile with the Nova Cyan spark, a bare input, and a blue text button, "Ask Nova".

## Do's and Don'ts

### Do:
- **Do** open every record page with `LevvRecordHeader` and a statement computed from its data, with loading, error and empty variants.
- **Do** set every legend, column head, button, tab and filter label in 11–12px uppercase at .06em.
- **Do** put tables straight on the paper under a 2px Rail Navy head rule, and let `levv-cq` switch them to stacked rows in narrow columns.
- **Do** show status as an 8px square beside plain text.
- **Do** keep Levv Blue for the primary action, selection, the current page and focus.
- **Do** pair hatching with its legend every time it appears.
- **Do** limit motion to the 120ms press, 160ms colour fades and the frame's disclosure transitions, and honour reduced motion.

### Don't:
- **Don't** wrap a table or list in a card, or give a page-flow surface a shadow.
- **Don't** use pill badges, rounded-full chips or corners above 2px inside the shell.
- **Don't** invent a statement, figure, count or mark. If the data has not loaded, the sentence says so.
- **Don't** load Inter, Archivo or a monospace inside the shell, or set figures in a second face.
- **Don't** introduce a second accent, and don't use status colours as decoration.
- **Don't** animate content into view inside the app. Entrances, reveals and the ribbon belong to the landing page.

---

## World 2: spec-pinned screens (boundary only)

Flow Studio (`/admin/workflows`, `/flow-studio`), run screens (`/runs`) and the inbox (`/inbox`) follow `docs/flow-studio/` exactly. `AGENTS.md` pins their look: cyan accent, slate neutrals, slate-950 canvas and Nova surfaces, and badges at `rounded-md text-[10px] font-black uppercase tracking-wider`. Their containers carry `.levv-spec`. This class does three things:
- It restores Tailwind's own `slate`, `gray`, `blue` and `cyan` values, so pinned colours compute exactly as specified even though the brand repaints those families everywhere else.
- It restores its own radius scale: 0.125rem, 0.25rem, 0.375rem, 0.5rem, 0.75rem, 1rem and 1.5rem.
- It keeps the app face. Inside the auth shell, `.levv-spec` still resolves `--font-app` to Helvetica.

Run screens and the inbox also leave off the main column's `flex-1`. That class is the hook for the shell's control and table normalisation, so the exposure-record table and field rules never reach them. Don't apply exposure-record rules inside `.levv-spec`, and don't copy spec-pinned styling out of it.

## World 3: the landing page

The landing page (`/`) renders in the standalone body: no auth shell, the cool `:root` tokens, and Tailwind's default-sized radii.
- **Type:** Inter, loaded through `next/font`, for the body (15–17px, with character variants cv02, cv03, cv04 and cv11). Archivo is the display face at weight 500, tracked -0.032em and stretched to 112% width: the hero runs 2.5 → 3.25 → 3.75rem at line-height .98, and section heads 2.25 → 3rem at 1.05.
- **Colour:** a cool ground (`landing-ground`) with white surfaces, ink and muted text, and hairline lines. Levv Blue stays the accent.
- **The stage:** the hero and the close sit on Rail Navy (Z0) in white type. Behind the window, never behind the words, runs one ribbon of light: a screen-blended video (`/media/levv-ribbon.mp4`) whose black disappears into the navy. It fades in over 1.8s, plays only while on screen and holds as a still under reduced motion. Above the ribbon sit a navy scrim and 35% overlay grain.
- **Glass:** one material, a 4% white fill with 4px blur and a hairline rim of light that is bright top and bottom and gone at the sides. The strong variant uses 24px blur and a deep drop shadow.
- **Motion:** once-only entrances (blur-rise, fade-rise, window-rise and pop, each delayed per element) and scroll reveals armed only for elements that start below the first screen. All of it is disabled under reduced motion.
- **Shape:** pill buttons and 8–20px rounded windows. These are landing-only.

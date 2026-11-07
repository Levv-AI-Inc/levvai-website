---
name: Levv
description: The operating system for external work, drawn as one record from requisition to offboarding.
colors:
  accent: "#2658e4"
  accent-hover: "#1e46c4"
  accent-soft: "#eef4ff"
  focus: "rgb(38 88 228 / 0.28)"
  rail: "#0a1330"
  command-navy: "#131b35"
  nova: "#3fb6f7"
  ink: "#0a1128"
  ink-2: "#232c42"
  ink-body: "#364157"
  ink-copy: "#465166"
  muted: "#5a677d"
  ink-muted: "#616e84"
  faint: "#8d99ad"
  ink-faint: "#95a1b5"
  line-strong: "#c9d2df"
  line: "#e0e6ef"
  wash: "#eef2f7"
  surface-sunken: "#f6f8fb"
  ground: "#f3f5f9"
  surface: "#ffffff"
  positive: "#047857"
  positive-soft: "#ecfdf5"
  attention: "#b45309"
  attention-ink: "#92400e"
  attention-soft: "#fffbeb"
  critical: "#be123c"
  critical-soft: "#fff1f2"
typography:
  display:
    fontFamily: "Archivo, Inter, ui-sans-serif, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.032em"
    fontVariation: "'wdth' 112"
  display-section:
    fontFamily: "Archivo, Inter, ui-sans-serif, sans-serif"
    fontSize: "3rem"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.032em"
    fontVariation: "'wdth' 112"
  lead:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.625
    fontFeature: "'cv02', 'cv03', 'cv04', 'cv11'"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.022em"
    fontFeature: "'cv02', 'cv03', 'cv04', 'cv11'"
  figure:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
    fontFeature: "'cv02', 'cv03', 'cv04', 'cv11', 'tnum'"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.5
    fontFeature: "'cv02', 'cv03', 'cv04', 'cv11'"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "'cv02', 'cv03', 'cv04', 'cv11'"
  control:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.5
    fontFeature: "'cv02', 'cv03', 'cv04', 'cv11'"
  ui:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'cv02', 'cv03', 'cv04', 'cv11'"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "0em"
    fontFeature: "'cv02', 'cv03', 'cv04', 'cv11'"
rounded:
  md: "6px"
  lg: "8px"
  xl: "10px"
  "2xl": "12px"
  full: "9999px"
spacing:
  control-gap: "8px"
  stack: "12px"
  section: "24px"
  cell-x: "16px"
  cell-y: "12px"
  panel-x: "20px"
  panel-y: "16px"
  page-gutter: "32px"
  band: "112px"
components:
  button-primary:
    backgroundColor: "{colors.command-navy}"
    textColor: "{colors.surface}"
    typography: "{typography.control}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.ink-2}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    typography: "{typography.control}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-sunken}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-copy}"
    typography: "{typography.control}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.command-navy}"
  button-brand:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "0 20px"
    height: "44px"
  button-brand-hover:
    backgroundColor: "{colors.accent-hover}"
  button-tonal:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-hover}"
    rounded: "{rounded.lg}"
    padding: "0 20px"
    height: "44px"
  segment-selected:
    backgroundColor: "{colors.command-navy}"
    textColor: "{colors.surface}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "28px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.ui}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "36px"
  badge-neutral:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink-copy}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  badge-info:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-hover}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  badge-positive:
    backgroundColor: "{colors.positive-soft}"
    textColor: "{colors.positive}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  badge-attention:
    backgroundColor: "{colors.attention-soft}"
    textColor: "{colors.attention-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  badge-critical:
    backgroundColor: "{colors.critical-soft}"
    textColor: "{colors.critical}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
  stat:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.figure}"
    padding: "16px 20px"
  lifecycle-current:
    backgroundColor: "{colors.accent}"
    rounded: "{rounded.full}"
    width: "16px"
    height: "6px"
  lifecycle-passed:
    backgroundColor: "{colors.ink-faint}"
    rounded: "{rounded.full}"
    width: "10px"
    height: "6px"
  lifecycle-ahead:
    backgroundColor: "{colors.line}"
    rounded: "{rounded.full}"
    width: "10px"
    height: "6px"
  nova-chip:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.nova}"
    rounded: "{rounded.md}"
    size: "28px"
  nova-prompt:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.command-navy}"
    typography: "{typography.ui}"
    rounded: "{rounded.lg}"
    padding: "0 4px"
    height: "36px"
  rail-item:
    backgroundColor: "transparent"
    textColor: "{colors.line-strong}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "36px"
  rail-item-active:
    backgroundColor: "rgb(255 255 255 / 0.1)"
    textColor: "{colors.surface}"
  settings-nav-item-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-hover}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
---

# Design System: Levv

## Overview

**Creative North Star: "The Operating Record"**

Levv draws everything as one record that moves. A worker, a request or a work order is a row, a panel, a stat strip and a five-stage track, and every screen is a view onto that same record rather than a dashboard about it. The navy of the wordmark is the structure the record sits in: the rail down the left of the app, the stage behind the landing page's hero and close, the chip that marks Nova. Levv Blue points at where the record stands and what has focus. Everything else is cool white, hairlines and ink.

The app is dense and calm: 13px Inter for working text, 36px controls, flat white panels on a cool grey ground, borders instead of shadows. The brand surface (the landing page) runs the same materials at a larger scale and adds one voice the app never uses, Archivo set wide after the wordmark's stance. Product proof on brand pages is the product itself, drawn as live HTML windows, never a screenshot or an illustration.

Colour is spent on meaning. Navy commands, blue locates, sky belongs to Nova, and emerald, amber and rose report status. A screen that is all working well is mostly ink on white.

Coverage today: the shell (rail, top bar, settings column), the landing page and about twenty of the 127 routes are built on the components in `app/components/ui/levv-app.tsx`; the Workers index (`app/workers/workers/page.tsx`) is the reference implementation. The remaining routes still use raw Tailwind classes. They inherit the palette, because the `slate`, `gray`, `blue` and `cyan` families are the Levv ramps, and the app layer in `globals.css` normalises their headings, labels, tables, inputs and buttons, but their layouts are not yet rebuilt. Flow Studio, the run screens and the inbox are a deliberate exception, described under Colors.

**Key Characteristics:**
- One record, one track: the five-stage lifecycle (Requisition, Approval, Onboarding, In engagement, Offboarding) appears wherever a record's position matters.
- Navy structure, blue position, sky for Nova, status colours for status only.
- Flat and hairlined: panels, tables and stat strips have borders, not shadows; only floating things cast shadow.
- Inter everywhere in the product; Archivo, set wide, only on brand surfaces.
- Small, firm corners (6–12px), 36px controls, tabular figures, sentence-case labels.
- Every pressable thing presses (scale 0.97); nothing animates in from nothing.

## Colors

A cool, navy-anchored palette: one blue for position and focus, one sky reserved for Nova, and a single ink ramp for everything neutral.

### Primary
- **Levv Blue** (#2658e4): the mark's mid tone and the only everyday chromatic colour. Focus outlines and rings, the current lifecycle stage, the active tab underline, the in-progress approval step, links, the pulse on the integrations diagram, and on brand pages the main action button.
- **Deep Levv Blue** (#1e46c4): hover for blue fills, and the text colour wherever blue sits on its wash: link text, the "Ask Nova" button, the current settings-nav item, info badges.
- **Selection Wash** (#eef4ff): the ground of things that are selected or informational: the current settings-nav item, a focused table row, the tonal button on the landing page, info badges and notices.
- **Focus Glow** (rgb(38 88 228 / 0.28)): the 3px ring around a focused input, select or Nova prompt.

### Secondary
- **Rail Navy** (#0a1330): the structure. The app's sidebar rail, the landing page's stage (hero and close) and its Nova band, the Nova chip, avatar initials in the preview drawer and account menu, and the browser theme colour.
- **Command Navy** (#131b35): the fill of the one command a view asks for (the primary button), the chosen option in a segmented filter, and steps already done in step markers.

### Tertiary
- **Nova Sky** (#3fb6f7): Nova's colour. It lives only on Rail Navy: the sparkle in the Nova chip, the current page's icon in the rail, and inside the Nova band, where it takes the accent's place.

### Neutral
All neutrals are the Levv ink ramp (the `slate`/`gray` utilities), which leans toward the wordmark's navy.
- **Wordmark Ink** (#0a1128): headings, names, figures and every value a person reads first.
- **Ink Soft** (#232c42): secondary headings (the app layer sets every `h2` and `h3` to it, so panel titles land here), secondary button text, primary button hover.
- **Body Ink** (#364157): table cell text and panel body copy.
- **Copy Slate** (#465166): long-form paragraphs on the landing page, ghost button text, neutral badge text.
- **Muted Slate** (#5a677d): labels and table headers, set by the app layer. Components set descriptions and meta lines with the ramp's next step, **Ink Muted** (#616e84); the two do one job.
- **Faint Slate** (#8d99ad): placeholders on older pages, set by the app layer. Components use **Ink Faint** (#95a1b5) for icons, placeholders and passed lifecycle stages.
- **Control Line** (#c9d2df): borders of controls (inputs, selects, secondary buttons, the segmented filter), the scrollbar thumb, and the rail's resting text.
- **Hairline** (#e0e6ef): every container border and divider, and the stages still ahead on the lifecycle track.
- **Wash** (#eef2f7): hover fill for ghost buttons and menu rows, neutral badges, empty-state icon tiles, chips in product windows.
- **Sunken Grey** (#f6f8fb): table header rows, table row hover, detail tiles, the page-search field at rest, product window title bars, and the alternate bands on the landing page.
- **Cool Ground** (#f3f5f9): the app canvas behind every panel, and the standalone and worker-portal grounds.
- **Surface White** (#ffffff): panels, tables, controls, the top bar, menus and dialogs.

### Status
Status colours are Tailwind's own emerald, amber and rose, unchanged.
- **Positive** (#047857 on #ecfdf5): compliant, approved, done; positive stat figures.
- **Attention** (#b45309 for figures; #92400e for text on #fffbeb): pending, due, review required; onboarding on the lifecycle track.
- **Critical** (#be123c on #fff1f2): non-compliant, blocked, errors. Critical notices take `role="alert"`.
Dots inside badges use each family's 500 step.

### Named Rules
**The Navy Commands, Blue Locates Rule.** Navy fills what a person does next (the primary button, the chosen filter, a step already taken); blue marks where the record or the person is (the current stage, the current page, the focused field). In the app the one command per view is navy; on brand pages Levv Blue carries the main action.

**The Sky-On-Navy Rule.** Nova Sky only ever sits on Rail Navy. It never appears on white, never fills a button, and never stands in for the accent outside the Nova band.

**The Signals Only Rule.** Emerald, amber and rose report status and nothing else. There is no violet or purple in the product: the app layer recolours legacy violet classes to Levv Blue.

**The Pinned Spec Rule.** Screens a specification pins (Flow Studio in `src/components/flow-studio/`, the run screens and the inbox) carry `.levv-spec`, which restores Tailwind's own `slate`, `gray`, `blue`, `cyan` and its larger `xl`/`2xl`/`3xl` radii, and they render outside `main.flex-1` (Flow Studio is portalled to `<body>`; run screens use `grow basis-0`) so the app layer cannot touch them. Their colours are the ones `docs/flow-studio/04-ui.md` §1.2–1.3 pins: cyan accent, slate-950 canvas. Only their chrome follows Levv: Inter, press feedback and the 64px top bar.

## Typography

**Display Font:** Archivo, variable width axis (fallback Inter, ui-sans-serif)
**Body Font:** Inter (fallback ui-sans-serif, system-ui, -apple-system, Segoe UI)
**Label/Mono Font:** Inter for labels; the system monospace stack only for Nova's machine trace on the landing page.

**Character:** Inter carries the product: neutral, compact, with the alternate glyphs `cv02`, `cv03`, `cv04` and `cv11` switched on everywhere for a more open, legible working face. Archivo, stretched wide, borrows the stance of the wide-set wordmark and appears only where Levv speaks as a brand.

### Hierarchy
- **Display** (Archivo 500, 2.5rem → 3.25rem at 640px → 3.75rem at 1024px, line-height 0.98, -0.032em, width 112): the landing h1 only, broken by hand into three lines on the stage, white with the last line ("for enterprises") in Levv Blue 300 (#96b6fd).
- **Display Section** (Archivo 500, 2.25rem → 3rem at 640px, line-height 1.05, -0.032em, width 112): landing section headings and the close line. The dialog title and mobile menu links use the same face at 1.5rem.
- **Lead** (Inter 400, 17px, line-height 1.625; the hero sub-line steps to 20px at 640px): landing paragraphs, held to 42–48ch.
- **Headline** (Inter 650, 1.625rem, line-height 1.25, -0.022em, Wordmark Ink): the page title in the app, one per page. The component asks 600; the app layer sets every page `h1` to 650.
- **Figure** (Inter 600, 1.375rem, line-height 1.25, -0.015em, tabular): stat values in the stat strip.
- **Title** (Inter 600, 15px): panel titles. Drawer titles step up to 18px.
- **Body** (Inter 400, 14px, line-height 1.45): page descriptions under the headline (held to 68ch), Nova brief copy, empty-state titles at 600.
- **UI** (Inter 400/500, 13px, line-height 1.5): the working size. Table cells, controls, menus, nav, notices, values in detail lists. Names and IDs in cells take 500.
- **Label** (Inter 500, 12px, line-height 1.45, letter-spacing 0, sentence case): field labels, table headers (the app layer sets them at weight 550, Muted Slate), badges, meta lines, the stat strip's detail line. 11px is the floor, used for record IDs inside product windows and the rail's section labels.

### Named Rules
**The Wide Name Rule.** Archivo, set wide, is the brand's voice and appears only on brand surfaces: the landing page, its dialog and its mobile menu. Inside the authenticated app, every heading is Inter.

**The Sentence-Case Label Rule.** Labels, table headers, badges and buttons are sentence case with no added letter-spacing. The app layer strips uppercase and tracking from older pages' headers, labels and buttons. (Flow Studio's spec-pinned 10px uppercase badge is the one exception.)

**The Tabular Figures Rule.** Every ID, date, count, rate and money value uses tabular numerals; table cells and `[data-numeric]` get them by default.

## Layout

**The app shell.** A navy rail (248px, collapsing to 68px) on the left; to its right a white top bar (64px, hairline beneath) holding page search, notifications and the account menu; then `main` on Cool Ground with 20px padding, 24px from 640px and 32px from 1024px. Below 1024px the rail leaves the layout and becomes a drawer that slides in from the left over a Wordmark Ink scrim at 40%, opened by a menu button in the top bar; page search hides below 640px. Admin pages add a 208px settings column, a white hairlined panel sticky 80px from the top, 32px from the content; below 1024px it becomes a horizontally scrolling row above the content.

**Page widths.** `LevvPage` centres content at 1440px by default ("wide"), 1152px for single-column desks such as Home ("standard"), or full width. Flow Studio fills the column with no padding.

**The index page anatomy.** Every list page reads top to bottom: page header (headline, description, actions or the Nova prompt on the right from 1024px) → stat strip → toolbar (search, filters, reset, a right-aligned "n of m" count) → table shell → empty state inside the shell when nothing matches. Blocks are 24px apart; the toolbar sits 12px above its table; controls in a toolbar are 8px apart and wrap.

**Rhythm.** A 4px base. Panel padding is 20px across and 16px down; table cells 16px across and 12px down (header rows 10–11px down); drawers 24px across and 20px down. Tables keep a minimum width (880–1080px) and scroll sideways inside their shell rather than squeezing columns. The stat strip is two columns with 1px hairline gaps below 1024px and one row of equal cells above.

**Drawers.** Record previews open from the right at up to 440px, full height, with a lighter Wordmark Ink scrim at 30%, a header, a scrolling body and a footer of actions.

**The brand surface.** The landing page uses a 1264px container with 20px gutters (32px from 640px) on a 12-column grid. Sections have 80px of vertical padding (112px from 640px) and take their content's height; only the hero fills the first screen. They alternate Surface White and Sunken Grey, with the Nova band in Rail Navy. Section intros split heading (6 columns) and lead (4–5 columns, offset right). The hero is a 6/6 split on the navy stage: text left, the product window right in a glass bezel. The light section after the hero rises over the stage as a sheet with 40px top corners (32px below 640px), and the close rises the same way, dark, over the questions.

**The stage.** The hero and the close stand on Rail Navy with one ribbon of light behind them: `public/media/levv-ribbon.mp4` (provenance in `public/media/media-credits.json`), screen-blended so the clip's black disappears into the navy and the frame has no edge. The ribbon runs behind the window and never behind the words; a navy scrim (left to right from 1024px, top down below it) and a faint grain sit over it. It plays only while on screen and is a still with reduced motion. On the stage the nav is clear, gaining a navy glass backing once the page moves and turning white once the hero has scrolled under it.

## Elevation & Depth

Levv is flat by default and draws depth with tone and hairlines: white panels on Cool Ground, Sunken Grey for recessed rows and tiles, 1px Hairline borders everywhere. Shadow is reserved for things that float above the page, and every shadow is tinted with Wordmark Ink (rgb 10 17 40), never pure black.

### Shadow Vocabulary
- **Button lift** (`box-shadow: 0 1px 2px rgb(10 17 40 / 0.05)`): primary and secondary buttons, so they sit a hair above the surface.
- **Control rest** (`box-shadow: 0 1px 1px rgb(10 17 40 / 0.03)`): inputs, selects and textareas in the app at rest.
- **Focus glow** (`box-shadow: 0 0 0 3px rgb(38 88 228 / 0.28)`): focused fields, with the border turning Levv Blue.
- **Pop** (`box-shadow: 0 16px 40px -12px rgb(10 17 40 / 0.22), 0 2px 6px -1px rgb(10 17 40 / 0.06)`): menus, the page-search results, dialogs.
- **Drawer** (`box-shadow: 0 20px 44px -12px rgb(10 17 40 / 0.18), 0 4px 10px -4px rgb(10 17 40 / 0.06)`): record preview drawers and the phone rail.
- **Product window** (`box-shadow: 0 24px 60px -28px rgb(10 17 40 / 0.35), 0 2px 6px rgb(10 17 40 / 0.05)`): the live product windows on the landing page, and nothing else.

### Named Rules
**The Hairline-First Rule.** Panels, tables, stat strips, tiles and cards sit flat with a 1px Hairline. If it does not float above the page (menu, dialog, drawer) or is not a product window on a brand page, it has no shadow.

## Shapes

Small, firm corners on a fixed ladder: 6px for things inside controls (badges, segmented options, sub-nav items, the Nova chip, chips in product windows), 8px for every control (buttons, inputs, selects, notices, menu rows, detail tiles, rail rows), 10px for containers (panels, table shells, the stat strip, menus, the settings column, product windows), 12px for the landing page's larger bands (control cards, the integrations hub, the Nova trace, the access dialog), 20px for the glass bezel around the hero window, 32–40px for the top corners of the landing sheets. Full rounding is for dots, avatars, step numbers and lifecycle segments. The direction contract asked 12–16px for windows; the build settled on 10px windows inside 12px bands. Older pages that still reach for 16px corners keep them on containers, but the app layer clamps their buttons to 8px.

Borders are always 1px, in Hairline for containers and Control Line for controls; tinted notices and badges use a 1px inset ring of their tone at 15–20% instead of a border.

### Named Rules
**The Inner-Step Rule.** Whatever sits inside a rounded control takes the next step down: 6px options in an 8px segmented group, a 6px chip and button inside the 8px Nova prompt, 8px tiles inside 10px panels.

**The 8px Control Rule.** Every standalone button and field is 8px, at every size, on every surface; only a control nested inside another control steps down to 6px.

## Components

### Buttons
Firm, compact and quiet until pressed.
- **Shape:** gently squared (8px), 36px tall in the app with 14px side padding and 13px medium text; 44px tall with 20px padding and 15px text on brand pages. Icons are 16px with an 8px gap.
- **Primary:** Command Navy with white text and the button lift; hover to Ink Soft. One per view.
- **Secondary:** Surface White, 1px Control Line border, Ink Soft text, button lift; hover to Sunken Grey with a slightly darker border.
- **Ghost:** no fill, Copy Slate text; hover fills Wash and darkens the text. Used for Reset, Open record, Close, and icon-only buttons (36×36).
- **Brand main action:** Levv Blue with white text, hover Deep Levv Blue, lifting 1px. Landing page only; `levvUi.accentButton` exists for the same role in the app but no app view uses it yet. A rose danger recipe also exists, unused so far.
- **Tonal:** Selection Wash with Deep Levv Blue text, for a second action on light landing sections.
- **Stage pills:** on the navy stage the actions are pills, 48px tall: the main action white with navy text and a 32px Levv Blue disc holding an up-right arrow that nudges 2px on hover; the second action ("See how it works") liquid glass (4% white fill, 4px blur, a 1.4px rim of light at top and bottom). The nav's action is a compact 36px white pill while the nav is clear.
- **Press / Focus:** everything pressable scales to 0.97 while pressed (120ms, ease-out) and shows a 2px Levv Blue focus outline 2px out. Disabled is 50% opacity with a not-allowed cursor.

### Segmented filter
A single choice among two to four states (the Workers index status filter). A white group with a 1px Control Line border and 2px inner padding; 28px options, 6px corners, 13px medium. The chosen option is Command Navy with white text and `aria-pressed`; the rest are Copy Slate, hovering to Wash.

### Status badges
- **Style:** 6px corners, 2px × 8px padding, 12px medium sentence-case text, the tone's 50 wash with its 700 text (amber uses 800) and a 1px inset ring of the tone at 15–20%, led by a 6px dot.
- **Tones:** blue (info, in progress), emerald (positive), amber (attention), rose (critical), slate (neutral). The dot can be swapped for a 12px icon or dropped.

### Cards / Containers
- **Panel:** Surface White, 10px corners, 1px Hairline, no shadow. A panel header carries a 16px Ink Faint icon, a 15px title and a 13px description, with actions at the right; list rows inside are divided by Hairlines.
- **Stat strip:** figures read as one strip of a record, not a row of tiles. One bordered 10px container with Hairline dividers; each cell has a 13px label, the figure, and an optional 12px detail line. A tone (positive, attention, critical) colours only the figure.
- **Detail tile:** Sunken Grey, 8px corners, no border, a 12px label over a 13px medium value.
- **Table shell:** the panel shape around a table. Sunken Grey header row with 12px Muted Slate headers; 13px Body Ink cells divided by Hairlines; row hover to Sunken Grey; keyboard-focusable rows that turn Selection Wash on focus; a trailing chevron that nudges 2px right on hover.

### Inputs / Fields
- **Style:** 36px, 8px corners, Surface White, 1px Control Line border, 13px Wordmark Ink text, Ink Faint placeholder, the control-rest shadow. Search fields carry a 16px search icon at the left; selects are native, styled the same, with a chevron at the right and medium text.
- **Focus:** the border turns Levv Blue and the 3px focus glow appears (150ms).
- **Read-only:** Sunken Grey fill, Muted Slate text, no shadow.
- **Brand pages:** the access dialog's fields are 44px with 15px text, same treatment.

### Notices and empty states
- **Notice:** 8px corners, 16px × 12px padding, 13px text, the tone's wash with its 900 text and inset ring, a 16px icon in the tone's 600, an optional bold title and a right-aligned action.
- **Empty state:** centred inside its container with 56px vertical padding; a 40px Wash icon tile, a 14px semibold title, a 13px muted explanation that says what to try, and an optional action.

### Navigation
- **Rail (app):** Rail Navy, a white tile holding the folded L mark (the mark needs a light ground) with the wordmark beside it, then sections labelled in 11px medium sentence case. Rows are 36px, 8px corners, 13.5px medium, Control Line text with 18px icons; hover lifts to white at 7%; the current page is white at 10% with white text and a Nova Sky icon, marked `aria-current`. Groups expand with a 200ms height ease and indent their children (32px rows, 13px) behind a faint left rule. A collapse control sits at the foot; collapsed rows show icons only with titles.
- **Top bar (app):** white, 64px, Hairline below. Page search is a 36px Sunken Grey field that turns white on focus, with a ⌘K hint; results open in a pop menu. The account button shows navy initials in a 28px circle.
- **Settings column (admin):** a white 10px panel, 32px rows with 6px corners at 13px; the current item is Selection Wash with Deep Levv Blue text and `aria-current`.
- **Brand nav (landing):** white, 64px, Hairline below, on a three-part grid: lockup left, four section anchors centred (14px medium, an underline that grows from the left on hover), the main action right. On phones, a full-screen sheet of 24px display-face links with the actions pinned at the bottom.

### Lifecycle track (signature)
The five stages of every engagement (Requisition, Approval, Onboarding, In engagement, Offboarding) as five rounded segments 6px tall and 3px apart: the current stage is a 16px Levv Blue segment, passed stages are 10px Ink Faint, stages ahead are 10px Hairline. A 13px Body Ink label names the stage ("Offboarding complete" when the record is closed, with every segment passed). Tone switches the current segment to amber or rose when the stage is held up. It is one `role="img"` with a full accessible label ("Lifecycle: Approval (stage 2 of 5)"). On brand pages a larger 8px-tall variant (28px current, 16px others) moves with the record tabs, its segments easing width and colour over 300ms.

### Nova prompt and Nova chip (signature)
One recognisable place to ask the agent, on every screen that offers it. The prompt is a 36px input-shaped form: a 28px Nova chip (Rail Navy, 6px corners, a 14px Nova Sky sparkle) at the left, a bare 13px field, and a 28px "Ask Nova" text button in Deep Levv Blue that hovers to Selection Wash; the whole form takes the input's focus treatment. The chip alone marks anything Nova did or said, in the app and on brand pages ("Nova routed REQ-0091").

### Product window (brand surfaces)
The product's own window drawn in live HTML: a white 10px frame with a Hairline border and the product-window shadow, a 40px Sunken Grey title bar with three Control Line dots and a 12px tenant path ("acme.levvai.com / requests / REQ-0091"), and real product UI inside, built from the same tokens as the app. The hero sets one on a lit sky panel (#e9f1fd with a white light at the top right), cut off by the panel's right and bottom edges, with a single result card over its lower left.

### Nova band (brand surfaces)
The one Rail Navy section on a brand page. Inside it the accent becomes Nova Sky; text is white, Control Line and Ink Faint; frames are white at 10% borders over white at 4% fills; Nova's trace is set in the monospace stack at 13px. It has no scroll effect: the band is on screen the moment it scrolls in.

## Do's and Don'ts

### Do:
- **Do** build app screens from `app/components/ui/levv-app.tsx` in the index anatomy (page header → stat strip → toolbar → table shell → empty state), and check new work against the Workers index (`app/workers/workers/page.tsx`).
- **Do** show where a record stands with the five-stage lifecycle track (16px current, 10px others, 6px tall, 3px apart).
- **Do** mark everything Nova does or offers with the Nova chip: Rail Navy, 6px corners, a Nova Sky sparkle.
- **Do** give every pressable element the press (scale 0.97, 120ms, ease-out) and the 2px Levv Blue focus outline; under reduced motion, presses stop scaling, pops only fade and the integration pulse is hidden.
- **Do** set every ID, date, count and money value in tabular figures.
- **Do** show the product on brand pages as live HTML windows built from real product UI and the app's own tokens.
- **Do** keep spec-pinned screens (Flow Studio, run screens, inbox) inside `.levv-spec` and outside `main.flex-1`, so the colours their spec pins compute exactly.

### Don't:
- **Don't** put Nova Sky on white, use it as a button fill, or use it for anything that is not Nova or the current item on the navy rail.
- **Don't** use emerald, amber or rose for decoration, and don't use violet or purple anywhere outside Flow Studio's spec-pinned Digital Worker tone.
- **Don't** set Archivo inside the authenticated app; app headings are Inter.
- **Don't** uppercase or letter-space labels, table headers, badges or buttons (Flow Studio's spec-pinned badge excepted).
- **Don't** shadow panels, tables, stat strips or cards; a 1px Hairline separates them.
- **Don't** lay figures out as a row of separate stat tiles; a set of figures is one stat strip.
- **Don't** box filters in a panel of their own; the toolbar sits on the page, directly above what it scopes.
- **Don't** round a standalone button or field anything but 8px.

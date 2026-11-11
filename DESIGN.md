---
name: Gate
description: A calm decision console. Three panes and one cursor, dark by default, light on request.
colors:
  # light values: `skills/team-view/tokens.css`
  ground: "#161514"
  panel: "#201e1c"
  raised: "#2a2825"
  cur: "#34312d"
  edge: "#2f2c29"
  line: "#77716a"
  foot: "#24221f"
  rail: "#6c665f"
  rail-lit: "#e6e1d9"
  ink: "#eeeae4"
  ink-2: "#c6c0b7"
  ink-3: "#a8a198"
  amber: "#e8b65c"
  amber-bg: "#3a2f1c"
  green: "#93d18c"
  green-bg: "#1f2b1d"
  red: "#f09080"
  red-bg: "#33201c"
  biz: "#d9a8e8"
  biz-bg: "#2e2433"
  tech: "#72cfc0"
  tech-bg: "#1a2d2a"
  pro: "#9db6ff"
  pro-bg: "#1b2440"
  con: "#e8935a"
  con-bg: "#36220f"
typography:
  headline:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI Variable Text\", \"Segoe UI\", \"Noto Sans\", \"Adwaita Sans\", Cantarell, Ubuntu, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "27px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.012em"
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI Variable Text\", \"Segoe UI\", \"Noto Sans\", \"Adwaita Sans\", Cantarell, Ubuntu, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.005em"
  lead:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI Variable Text\", \"Segoe UI\", \"Noto Sans\", \"Adwaita Sans\", Cantarell, Ubuntu, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.5
  pane-title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI Variable Text\", \"Segoe UI\", \"Noto Sans\", \"Adwaita Sans\", Cantarell, Ubuntu, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 650
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI Variable Text\", \"Segoe UI\", \"Noto Sans\", \"Adwaita Sans\", Cantarell, Ubuntu, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  control:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI Variable Text\", \"Segoe UI\", \"Noto Sans\", \"Adwaita Sans\", Cantarell, Ubuntu, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "14.5px"
    fontWeight: 550
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI Variable Text\", \"Segoe UI\", \"Noto Sans\", \"Adwaita Sans\", Cantarell, Ubuntu, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "13.5px"
    fontWeight: 650
  caption:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI Variable Text\", \"Segoe UI\", \"Noto Sans\", \"Adwaita Sans\", Cantarell, Ubuntu, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  mono-id:
    fontFamily: "ui-monospace, \"SF Mono\", \"Cascadia Mono\", \"JetBrains Mono\", \"Noto Sans Mono\", \"DejaVu Sans Mono\", Menlo, Consolas, monospace"
    fontSize: "12.5px"
    fontWeight: 600
  code:
    fontFamily: "ui-monospace, \"SF Mono\", \"Cascadia Mono\", \"JetBrains Mono\", \"Noto Sans Mono\", \"DejaVu Sans Mono\", Menlo, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
  keycap:
    fontFamily: "ui-monospace, \"SF Mono\", \"Cascadia Mono\", \"JetBrains Mono\", \"Noto Sans Mono\", \"DejaVu Sans Mono\", Menlo, Consolas, monospace"
    fontSize: "11.5px"
    fontWeight: 600
    lineHeight: 1
rounded:
  keycap: "5px"
  badge: "6px"
  control-sm: "8px"
  control: "10px"
  popover: "12px"
  panel: "14px"
  dialog: "16px"
  pill: "20px"
spacing:
  hair: "4px"
  tight: "6px"
  sm: "8px"
  md: "10px"
  base: "12px"
  gutter: "14px"
  edge: "20px"
  block: "26px"
  inset: "30px"
components:
  button:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "6px 12px 6px 14px"
    height: "38px"
  button-hover:
    backgroundColor: "{colors.raised}"
  button-primary:
    backgroundColor: "#3a3631"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "6px 12px 6px 14px"
    height: "38px"
  button-primary-hover:
    backgroundColor: "#45403a"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    padding: "6px 10px"
  option:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "11px"
    padding: "6px 14px 6px 8px"
    height: "44px"
  option-chosen:
    backgroundColor: "{colors.green-bg}"
    textColor: "{colors.ink}"
  recommended-tag:
    backgroundColor: "{colors.amber-bg}"
    textColor: "{colors.amber}"
    rounded: "{rounded.badge}"
    padding: "0 7px"
    height: "20px"
  keycap:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink-2}"
    typography: "{typography.keycap}"
    rounded: "{rounded.keycap}"
    padding: "0 5px"
    height: "20px"
  input:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 11px"
    height: "36px"
  panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
  list-row:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "3px 10px 3px 36px"
  list-row-hover:
    backgroundColor: "{colors.raised}"
  list-row-current:
    backgroundColor: "{colors.cur}"
  tag:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink-2}"
    rounded: "7px"
    padding: "0 9px"
    height: "24px"
  tag-blocker:
    backgroundColor: "{colors.red-bg}"
    textColor: "{colors.red}"
  lens-mark-business:
    backgroundColor: "{colors.biz-bg}"
    textColor: "{colors.biz}"
    rounded: "{rounded.pill}"
    padding: "0 7px 0 6px"
    height: "20px"
  lens-mark-tech:
    backgroundColor: "{colors.tech-bg}"
    textColor: "{colors.tech}"
    rounded: "{rounded.pill}"
    padding: "0 7px 0 6px"
    height: "20px"
  lens-switch:
    backgroundColor: "{colors.ground}"
    rounded: "{rounded.popover}"
    padding: "4px"
  lens-switch-selected:
    backgroundColor: "{colors.cur}"
    textColor: "{colors.ink}"
    rounded: "9px"
  evidence-box:
    backgroundColor: "{colors.ground}"
    rounded: "11px"
---

# Design System: Gate

## Overview

**Creative North Star: "The Calm Decision Console"**

The gate is an instrument, not a page to read. Three panes share one cursor: the list of every card with its dependency rails on the left, the card being decided in the centre with its choice pinned at the bottom, its evidence by lens on the right. The lineage is the keyboard console (lazygit, tig) translated into plain language: every action has a key, every key is shown on a real keycap, and the screen never scrolls as a whole; only panes scroll inside a fixed frame.

The default world is a warm lifted dark. The ground is near-black with a brown cast, and soft-edged panels sit one step above it, so the three working areas read as objects on a desk rather than regions of one sheet. Colour is almost absent. What colour there is carries meaning, one meaning per hue: amber for the recommendation, green for what has been chosen or improved, red for blockers and lifted constraints, and a violet and a blue for the Business and Tech lenses. Density is that of a tool used for minutes at a time: 15px body, compact rows, no ornament between the eye and the decision.

Two themes, dark by default. The light world is off-white paper, not white: the ground is a sand grey, the panels are the lightest surface, the wells (raised, cur, foot) sit darker than the panel, and the pane shadow is a warm brown. The page follows the system or the viewer's theme until the reader picks one with the top-bar toggle (a sun or moon icon at every width, its name in the tooltip) or `d`; the choice is remembered for every gate. Shared pages use the same worlds and the same toggle. `d` is listed in the keys help only, not in the always-on legend: it decides nothing. Print is always light.

**Key Characteristics:**
- Fixed full-viewport frame; panes scroll, the page does not.
- Warm neutral ladder (ground, panel, raised, cur) carries all hierarchy; colour carries only meaning.
- One hue per meaning, always paired with a word or a drawn mark.
- Real controls: bordered buttons with keycaps, a real progress bar, a pressed state you can see.
- System sans for the interface, monospace only for ids, code, paths and keycaps.

## Colors

A warm brown-grey neutral ladder with five small semantic hues, each lifted to pastel brightness on the dark and given a matching deep tint for fills. The light theme inverts both: the hues deepen to ink strength and the tints pale; the values below are the dark ones, the light ones live in `skills/team-view/tokens.css`.

### Primary
- **Recommendation Amber** (amber, with amber-bg fill): marks the recommended option and nothing else: the border of the recommended choice and its "Recommended" tag. It is the rarest colour on screen.

### Secondary
- **Chosen Green** (green, with green-bg fill): what the human decided or what got better. Chosen option fill and ring, the progress fill, "Decided" status words, satisfied relations, improving metrics, added diff lines.
- **Blocker Red** (red, with red-bg fill): what stops or costs. Blocker severity, lifted constraints, an undecided base under a chosen card, worsening metrics, removed diff lines.

### Tertiary
- **For Blue** (pro, with pro-bg fill): the For sign. Arguments never take the green and red of a code diff.
- **Against Copper** (con, with con-bg fill): the Against sign. Copper, not amber: amber stays "Recommended".
- **Business Violet** (biz, with biz-bg fill): the business lens mark, tag and column label ("Biz"); on acceptance pages it marks the Business lens.
- **Tech Teal** (tech, with tech-bg fill): the Tech lens mark, tag and column label; on acceptance pages it marks the Technical lens. Teal, so it never reads as For Blue.

### Neutral
- **Ground** (ground): the page, and recessed wells inside panels (inputs, the lens switch, evidence boxes, keycaps).
- **Panel** (panel): the three panes, dialogs, resting buttons and options.
- **Raised** (raised): hover fill, inline code, tags, relation rows, popover menus.
- **Cursor** (cur): the current row, a pressed pill or lens, the selected tab. One step above raised.
- **Foot** (foot): the pinned "Your choice" bar and the accepted-by footer, a half step above panel.
- **Edge** (edge): hairline dividers and panel borders; barely there.
- **Line** (line): control borders (buttons, inputs, options), the current-row ring, link underlines. The only neutral meant to be seen as a stroke.
- **Rail / Rail Lit** (rail, rail-lit): dependency rails in the list at rest and when the cursor's family lights them.
- **Ink / Ink 2 / Ink 3** (ink, ink-2, ink-3): primary text; secondary text, labels and section heads; tertiary text, counts, hints and placeholders.

### Named Rules
**The One Meaning Per Hue Rule.** Each semantic hue means one thing across the whole gate. Amber is never decoration, green is never a brand colour, red is never emphasis.

**The Word Beside The Colour Rule.** No state is carried by colour alone: status is a drawn mark plus a word ("To decide", "Blocker", "Recommended"), lenses are an icon plus a name.

**The Tint Pair Rule.** A semantic fill uses its own deep tint (amber-bg, green-bg, red-bg, pro-bg, con-bg, biz-bg, tech-bg) with the bright hue as text; never the bright hue as a fill under ink.

## Typography

**Interface Font:** the platform system sans (system-ui, falling back through Segoe UI Variable, Noto Sans, Cantarell, Helvetica Neue, Arial)
**Mono Font:** the platform monospace (ui-monospace, falling back through SF Mono, Cascadia Mono, JetBrains Mono, Menlo, Consolas)

**Character:** Native and quiet: the gate must render offline, as a file sent to someone, with no font fetch, so it speaks in the reader's own system face and earns hierarchy through weight (400, 550, 600, 650) and the neutral ladder rather than through a typeface.

### Hierarchy
- **Headline** (650, 27px, 1.25, -0.012em, balanced, max 36ch): the current card's title. 22px on phones.
- **Title** (650, 18px, 1.3): the gate title in the top bar; ellipsised to one line.
- **Lead** (400, 18px, 1.5, max 62ch): "What's at stake" and the summary answer.
- **Pane title** (650, 16px): the list pane heading.
- **Body** (400, 15px, 1.55, prose max 68ch): details, arguments, the note.
- **Control** (550, 14.5px): buttons, options (15px), list row titles, relation rows, lens switch (14px).
- **Label** (650, 13.5–15px, ink-2): block heads ("Details", "Your choice"), evidence heads, section names in the list, argument authors. Sentence case.
- **Caption** (400, 13px, ink-3): counts, hints, figure captions, the key legend.
- **Mono id** (600, 12.5px mono): card ids in rows and constraints; 14px inside the headline's id chip.
- **Code** (400, 13px/1.6 mono): diffs and code blocks; inline code at 0.88em on a raised chip.
- **Keycap** (600, 11.5px mono): every keyboard hint.

### Named Rules
**The Mono Means Machine Rule.** Monospace is reserved for ids, file paths, code and keycaps. Prose, labels and numbers stay in the sans.

**The Tabular Count Rule.** Every count and figure that changes (progress, section counts, metrics) uses tabular numerals.

**The Sentence Case Rule.** Every label is sentence case at normal tracking. Nothing is set in capitals or letter-spaced.

## Layout

A fixed 100dvh grid: top bar, the three panes, and a quiet key legend at the foot. A debate page opens on its first story row (the cover when there is one); other kinds open on the Summary item; a card named in the address (`#d-ID`) opens instead. Only panes scroll. The page edge is 20px, panes sit 14px apart.

- **Wide (above 1400px):** list 400px, card fluid, evidence 460px. A card marked wide spans card and evidence columns.
- **1400px and below:** list 340px, evidence 400px; top-bar keycaps drop.
- **1180px and below:** the top bar wraps: title on its own line, progress stretches.
- **Tablet (761–1100px):** list beside the card; evidence stacks under the card (3:2 rows); For/Against stack.
- **Phone (760px and below):** one pane at a time, chosen by a segmented tab bar; progress and actions pin to the bottom; the card scrolls as one with "Your choice" following the arguments; touch navigation replaces the key legend.
- **640px and below:** the trade-off table becomes one block per option, each cost labelled by its lens.

The list collapses to a 116px rail (status marks, rails and ids only) or closes entirely; the centre and evidence take the room; on a debate page closed leaves a 52px rail on the left, like the evidence pane's, and a click on it reopens the list.

Spacing rhythm is small and even: 4–14px inside components, 26px between blocks in the card, 30px card inset (22px tablet, 18px phone).

**The Evidence Beside The Choice Rule.** The evidence pane stays beside the card on every kind, never behind a click. On a debate page it folds like the decisions list (a close control in its header, a rail on the right, `e`, remembered and kept from card to card) and is absent, with no rail, on a card or row with nothing for it. On a debate page it follows one option: the option rows say its cost and any constraint it breaks; its pros and cons, trade-off and own evidence sit at the top of the pane, the whole question under them. On pages without a story view, arguments live in the centre and evidence in the right pane.

## Elevation & Depth

Depth is tonal first. Hierarchy comes from the neutral ladder (ground, panel, foot, raised, cur), each step a few points lighter in dark; in light the ladder inverts, the panel lightest and the wells a few points darker; plus hairline edges. A single soft shadow lifts the panes off the ground; everything else is flat, and rings are inset strokes, not shadows.

### Shadow Vocabulary
- **Pane lift** (`--pane-lift`; dark `0 1px 0 rgba(255,255,255,.025) inset, 0 10px 28px -16px rgba(0,0,0,.7)`, light `0 1px 0 rgba(255,252,246,.7) inset, 0 10px 28px -16px rgba(74,52,28,.32)`): the three panes only. A top highlight and a low diffuse fall, warm brown in light.
- **Inset ring** (`box-shadow: inset 0 0 0 1px <colour>`): the current row and selected lens (line), the chosen option (green), a gap row (red at 60%), the progress track (edge).
- **Dialog scrim** (`--scrim`; dark `rgba(10,9,8,.72)`, light `rgba(58,48,38,.38)`): behind keys, share and zoom dialogs.

### Named Rules
**The One Lift Rule.** Only panes cast a shadow. Buttons, menus, dialogs and cards inside panes are separated by tone and a 1px border. The light pane lift's 70% near-white inset highlight is part of that one lift, not a second one.

## Shapes

Soft, consistent corners that scale with the object: 5px keycaps and inline code, 6px badges, 8px small controls, 10px buttons, inputs and rows, 12px popovers and segmented controls, 14px panes, 16px dialogs, full-round (20px) only for lens marks and counts. Borders are 1px; keycaps carry a 2px bottom edge to read as physical keys.

Rails are the system's own geometry: 2px strokes, solid with an elbow for "refines", dashed for "needs … first", with 16px drawn nodes centred on the lowercase of the row's first line, measured in the reader's font. Status marks are small drawn SVG glyphs (open ring for to decide, filled for decided), never emoji or font icons.

## Components

### Buttons
Real, bordered, quiet until touched.
- **Shape:** gently rounded (10px), 38px tall, 1px line border.
- **Default:** panel fill, ink text, control weight; a keycap sits inside at the right when the action has a key.
- **Primary:** one step warmer fill with an ink-3 border, for Copy decisions and Send to Claude.
- **Ghost:** no border or fill, ink-2 text; for Reset and Keys.
- **Hover:** fill steps up one tone (0.2s ease-out). **Disabled:** ink-3 text, edge border, no fill. **Focus:** 2px ink outline, 2px offset.

### Options ("Your choice")
The decision itself, pinned in the foot bar of the centre pane.
- **Shape:** 11px corners, at least 44px tall, keycap number on the left.
- **Recommended:** amber border plus an amber "Recommended" tag.
- **Chosen:** green border, inset green ring, green-bg fill, check mark and "your choice" word, keycap turns green.
- **Lifted constraint:** a red inline word on the option. **Moot:** dashed border, no fill, ink-3.

### Chips, tags and lens marks
- **Tag:** raised fill, ink-2, 7px corners, 24px; blocker variant red on red-bg, warn variant an inset line ring.
- **Lens mark:** full-round, icon plus "Biz" or "Tech" in its hue on its deep tint. On acceptance pages only; on other kinds a line shows the plain label ("for the business", "for the build") only where it differs from its card's default lens.
- **Filter pill:** panel fill with edge border; pressed state takes the cursor fill and an ink-3 border.

### Inputs / Fields
- **Style:** recessed: ground fill, 1px line border, 10px corners, 36px search, 38px note.
- **Focus:** 2px ink outline; the note grows to 76px on focus.

### Panes
- **Corner Style:** 14px. **Background:** panel. **Border:** 1px edge. **Shadow:** the pane lift.
- **Internal Padding:** 18px pane heads, 30px card body, 18px evidence body. A pane whose list overflows fades to panel at its foot.

### Card list (navigation)
- **Row:** two lines: mono id and title, then status word, relation and lens marks indented past the id. 10px corners.
- **States:** hover raised; current takes the cursor fill, an inset line ring and a 600 title; a newly reached row flashes briefly.
- **Rails:** drawn to the left of the rows; the cursor's family lights to rail-lit.

### Story
The one layout of a debate card. The title keeps the card-title size; the card's `detail` shows right after its stake line; up to 3 key numbers follow (a before/after one reads `40 → 20`, centred), then one centred drawing. Then *Your choice* in the pinned decide bar: one row per option, all of one shape: the number key, the label with its cost line, then the Recommended tag, a Breaks badge per constraint it breaks (the text on hover and keyboard focus) and an "in the pane" mark on the option the evidence pane shows (that row a shade lighter, the chosen row green); the whole row picks, then the note. The evidence pane (460px, always shown, as on the other kinds) follows the picked option, else the recommended, else the first: an *Evidence for* segmented picker of every option (`[` `]`, without choosing), that option's for and against in two columns ("No argument raised" on an empty side), its trade-off, its own evidence, the constraints as they stand under it; then a dashed divider, *The whole question*: the options compared (the shown row marked), the card's other numbers, code, examples, figures, sources. A context row or the recap shows its own evidence there, else one line; at 760px and under the pane is the Evidence tab. There is no mode control. A card whose options carry nothing shows plain decide-bar buttons and no picker. The list runs in story order: context rows open the page, the recap row closes it.

### Cover strip
Share pages only (`--share`, every kind); hidden on the local page. A note above the tabs, between the top bar and the panes, in panel fill with an edge border and the pane radius, 10px by 16px padding, 14px text. The lead sentence says what the reader is asked and how many questions need an answer (an acceptance page: how many cases to read, nothing to send back); the line on how to send the answer back sits under it in ink-2. At 760px and under that line folds into a native "What to do next" disclosure (44px tap target), closed by default; wider, the summary is hidden and the line reads as plain text. The key legend is absent on share pages; the `?` panel keeps every key.

### Spec example (case card)
On an acceptance case that cites an example id, a folded block under the title tags: "Example E3 from the specification", a native disclosure in the raised fill that opens on the example's given, when and then. The id is text, never colour.

### Uncovered examples (Summary)
Under the Summary's bullets (at the top of the Cases when there is no Summary): a section headed "Examples from the specification that no case on this page covers", each example in a raised well with its id and given / when / then, and a note that it is an observation with nothing to decide.

### Lens switch
Acceptance pages only. A segmented control (Both | Biz | Tech) recessed in ground with a 4px inner padding; the selected segment takes the cursor fill and an inset line ring. Counts sit beside each name in ink-3.

### Evidence boxes
Recessed ground wells with a 1px edge and 11px corners holding constraints, the trade-off table, metrics, code and location; rows inside divide with edge hairlines. Code diffs tint whole lines green or red.

### Progress
"Decided n of m" over a 6px full-round track (raised with an edge ring) and a green fill that scales from the left (0.45s, expo-out).

### Keycap
Inline-grid, 20px, ground fill, line border with a 2px bottom edge, 5px corners, 600 11.5px mono in ink-2. Used everywhere a key works; the bottom legend shows only the keys that work now.

## Do's and Don'ts

### Do:
- **Do** keep the frame fixed at full viewport height and scroll inside panes only.
- **Do** build hierarchy from the neutral ladder (ground, panel, raised, cur) and weight before reaching for colour.
- **Do** pair every semantic colour with a word or a drawn mark.
- **Do** show a keycap on every control that has a key, and keep the key legend to the keys that work now.
- **Do** use monospace only for ids, paths, code and keycaps; tabular numerals for every count.
- **Do** use the pane lift shadow on panes only; separate everything inside with tone and 1px edges.
- **Do** keep each option's figure, pros and cons and any constraint it breaks beside the choice; the rest of the evidence is one key away, in place. Pages without a story view keep arguments in the centre and evidence in the right pane, nothing behind a click.

### Don't:
- **Don't** ship a white one: no `#fff`, no fully opaque white, no black shadow on light. The brightest light surface is `--panel` (`#eee9df`, off-white); white glares.
- **Don't** use amber for anything but the recommended option.
- **Don't** use a semantic hue for decoration, emphasis or brand.
- **Don't** fetch fonts, icons or libraries; the file is self-contained and works offline.
- **Don't** set labels in capitals or letter-spaced small type, and don't put a label above a heading to introduce it.
- **Don't** use emoji or font glyphs as icons; status and lens marks are drawn SVG.
- **Don't** stack scrolling SaaS cards beside a filter sidebar; the gate is three panes and one cursor.

# Drawing figures

Read this before drawing any figure on a gate page: an `outcome` diagram or a figure on one item. Adapted for this page, dark and light, from [diagram-design](https://github.com/cathrynlavery/diagram-design) (MIT).

## Draw, or not

A figure earns its place when the human decides faster with it than without it. If a three-column table, the `metrics` chips or the `code` panes say the same thing, use those. A screenshot of today beats a drawing of today.

## Pick the type

| The figure shows… | Type | Typical place |
|-------------------|------|---------------|
| the target system: components and the calls between them | Architecture | `outcome` `system` |
| the system today and after, side by side | Architecture + *Before/after* below | `outcome` `system`, refactor item |
| a workflow: who calls whom, in what order | Sequence | `outcome` `system` |
| the life of one object (order, invoice, job) | State machine | `outcome`, item that adds or removes a state |
| a data model that changes | ER / data model | `outcome`, migration item |
| coupling, fan-in, a dependency cycle | Dependency graph | refactor item |
| a layer that calls past its neighbour | Layer stack | refactor item |
| options placed on two axes (effort / impact) | Quadrant | debate decision or tension |
| options scored on 3 to 5 criteria | Radar | debate decision |
| build, buy or reuse | Wardley map | debate, kickoff |
| what goes in the first release, and what waits | Story map | kickoff, plan |
| several numbers, before → after | Slopegraph | refactor or debate item |
| the causes of one incident | Fishbone | debate after an incident |

Any type that compares two states (architecture, data model, state machine, dependency graph) uses the *Before/after* grammar below. The order the work runs in is the executor's concern: no Gantt, timeline or step graph on the page.

## Rules for every figure

1. **Page palette.** Strokes and text are `currentColor`. Secondary marks (ordinary arrows, sublabels, gridlines) use `style="stroke: var(--ink-2)"` or `fill: var(--ink-2)`. Box fills and label masks are `var(--surface)`, except where a type card names `var(--surface-2)`. No hex colour, no light fill. Green and red belong to the metric chips: a figure never uses them. A mark with no fill takes the text colour, so give every box its `var(--surface)` fill.
2. **One focus.** `var(--accent)` marks at most 2 elements: what the human should look at first. If 4 things want it, you haven't chosen yet.
3. **Delete before you add.** Each box is a distinct idea: two boxes that always travel together are one. Each arrow says something the layout doesn't. Each label says something the shape doesn't.
4. **Budget.** At most 9 boxes and 12 arrows (tighter limits per type below). Over that, draw an overview and a detail, never fewer arrows than the system has.
5. **Size.** `viewBox` 700–900 units wide, `font-size` 12–13. Names inherit the page font; technical text (paths, ports, SQL types, commands) uses `font-family: var(--mono)`.
6. **Arrows.** Draw them before the boxes, so lines pass behind. Right angles only, except where a type card below says otherwise (state machine, Wardley map, fishbone, radar, slopegraph): a straight line when both ends share x or y, otherwise an elbow with an 8-unit corner radius. Dashed (`stroke-dasharray="5 4"`) means optional, async or return, and its label starts with which one, e.g. `async webhook`. No two arrows share a stroke or an attach point: offset parallel routes by 12 units, spread several arrows on one edge 12 units apart. An arrow never passes behind a box that isn't one of its ends.
7. **Labels.** An arrow label is short (≤ 14 characters) and sits on a `var(--surface)` mask 6–10 units clear of its stroke, beside a vertical segment rather than on it. Never vertical text.
   - **Size every label before placing it:** about 7 units per character at `font-size` 12 (8 in mono capitals). A label keeps 8 units clear of every stroke it doesn't belong to, zone borders included, and 16 units inside the `viewBox`. One that doesn't fit wraps onto a second line or moves; it never crosses an edge.
   - **Text never inherits a stroke.** Put `stroke` on the shapes themselves, never on the `<svg>` root or a `<g>` that also holds text, or the text renders bold and blurred.
8. **Legend.** Only when a mark's meaning isn't written on it, as one strip under the drawing, covering exactly the marks used.

## Before/after

1. **The change list first.** Before drawing, write one line per difference, each starting with its status word, naming the part and the difference. Arrows are parts too: a rewired arrow gets its own line naming its old and new end, e.g. `REWIRED confirmation email: orderService → mailer becomes notifications.js → mailer`, even when a `NEW` line already mentions its new end. A part that both changes job and moves takes two lines. This list goes under `after`, in place of a legend.
2. **One layout.** Draw `before`, then copy every box's coordinates into `after`. A part that survives keeps its place and its name.
3. **Each line of the list puts its status word on its part**, in capitals beside it, with a line style that repeats it:

   | Status | Means | Drawn as |
   |--------|-------|----------|
   | `NEW` | only in after | solid outline |
   | `REMOVED` | only in before | dashed outline, kept in `after` at its old place |
   | `CHANGED` | same part, different job | solid outline, sublabel with the new job |
   | `MOVED` | same part, new place (only when the move is the point) | solid outline at the new place |
   | `REWIRED` | same arrow, different end | one arrow drawn to its new end, labelled `REWIRED` — not a removed arrow plus a new one |

   Unchanged parts carry no word: they are the quiet context. Status lives in the word and the line style, never in colour.
   **Last, count:** the status words drawn on the diagram and the lines in the list are the same number, word for word. A mismatch is a line you forgot.

## Types
### Architecture
**Shows:** which components exist, which zone each sits in, how data flows.
**Grammar:**
- One flow direction, tiers as columns or rows. Draw zones, then connectors, then boxes.
- Boxes rx=6. Zone: dashed rect (rx=8, `var(--ink-2)` stroke), 12-16 units header gap, label on a `var(--surface)` mask.
- Connectors leave a box perpendicular, at least 8 units from a corner.
- At a crossing, the less important line hops (an 8-unit arc).
**Budget:** 3 zones, 1-2 accent nodes.
**Avoid:** accenting every important box; two-way arrows where direction is obvious; diagonal connectors.

### Sequence
**Shows:** who calls whom, in what order, where the flow branches.
**Grammar:**
- Actor boxes in a top row; dashed lifelines (`3,3`, `var(--ink-2)`) below; time flows down, arrows never point up.
- Messages horizontal, 24 units apart. Call: solid, filled head. Return: dashed, filled head. Async: dashed, open (hollow) head.
- Activation bar: 8 units wide rect on the lifeline, closed when the call ends.
- Branch: one frame spanning only involved lifelines, inset 12 units, mono tab `ALT`/`OPT`/`LOOP`, `[guard]` under it; ALT splits in two by a dashed divider.
- Self-message: small U-loop, label right.
**Budget:** 5 lifelines, 12 messages, 1 fragment, no nesting, 1-2 accent messages.
**Avoid:** if/else as loose arrow clusters; open head on returns; labels crossing a lifeline.

### State machine
**Shows:** which states exist and which events move between them.
**Grammar:**
- States: rounded rects (rx=8), name in sans. Start: filled dot r=6. End: ring r=8 with filled core r=5.
- Lay out along the main flow; rearrange before accepting crossings.
- Transitions: curved arrows labelled in mono `event [guard] / action`, omitting empty parts. Self-loops curve above.
- Accent the one state to notice (error or completion).
- "From any state" is one note (`* -> Error on timeout`), not arrows from every state.
**Budget:** transitions at most 2 x states, else split the machine.
**Avoid:** unlabelled transitions; an arrow from every state to Error; several accented states.

### ER / data model
**Shows:** which entities exist and how they relate; with column detail, the physical tables and keys.
**Grammar:**
- Logical (default): box with header (mono `ENTITY` tag, sans name) and mono field list; PK `#`, FK `->`.
- Lines join boxes; cardinality (`1`, `N`, `0..1`, `1..*`, mono 8-9 units) 10-12 units from each edge, same notation both ends; optional verb on a mask. Accent the aggregate root.
- Physical, only when types or keys matter: header `schema.table`, 24 units rows (name left, mono SQL type right, chips PK/FK/UQ/NN rx=2). FK edge joins column row centre to column row centre, orthogonal, labelled `ON DELETE ...`. Truncate with `+ N more columns`.
**Budget:** logical about 6 entities; physical 5 tables, 8 rows, 6 FKs.
**Avoid:** an arrow per FK on big models; box-to-box FKs in physical mode.

### Dependency graph
**Shows:** what depends on what, including shared dependencies and one cycle.
**Grammar:**
- Use only if a node has 2+ parents or a cycle exists; else draw a tree.
- Rank rows by depth, top = nothing depends on it, rows about 120 units apart. Nodes rx=6, about 160x56.
- Fan-in badge top-right: small rx=2 mono `4 in`; highest fan-in is the story.
- External: `var(--ink-2)` stroke, `var(--surface-2)` fill, version sublabel (`v3.2 · npm`).
- Edges go down or sideways. The one back-edge: `var(--accent)`, dashed `5,4`, routed outside the stack, masked `CYCLE` label; nodes stay unaccented.
**Budget:** 9 nodes, 14 edges, 4 ranks, 1 cycle; collapse extras to `+6 leaves`.
**Avoid:** upward edges besides the cycle; unranked hairballs; one node per file.

### Layer stack
**Shows:** an ordered hierarchy of layers and which one matters.
**Grammar:**
- Full-width bands, same x and width, 56-72 units tall, hairline `var(--ink-2)` dividers.
- Row, left to right: mono index tag (`L3`), name in sans 13 bold, mono sublabel far right in `var(--ink-2)`.
- Fills: all `var(--surface)`, or alternate it with `var(--surface-2)`.
- Left-margin direction cue: small arrow plus mono word.
- Accent stroke on one layer.
**Budget:** 4-6 layers, equal heights, 1 accent.
**Avoid:** non-hierarchical layers (use architecture); skipped numbers; a colour per layer.

### Quadrant
**Shows:** where items fall on two named axes and what to do first.
**Grammar:**
- 1-unit `var(--ink-2)` cross through the centre; arrows stop 60-80 units short of the edge.
- Axis name: one uppercase mono word at each arrow tip, no glyphs or "high/low"; never at the midpoint.
- Items: dots r=4, label 8-10 units away, never crossing an axis, never on one.
- Accent the do-first item (usually top-right).
- Scenario variant: double-ended arrows, four named cells with 1-3 line text, one accented cell.
**Budget:** about 12 items, 1 accent.
**Avoid:** four differently filled quadrants; items on axes; unnamed axes.

### Radar
**Shows:** the shape of 3-5 options across 3-5 criteria on one scale.
**Grammar:**
- First axis at top, clockwise. Point = centre + (v/S) x R x (cos a, sin a), a = -90 deg + 360 deg x i/N; R about 130-160.
- Five closed rings at 0.2-1.0, faint `var(--ink-2)`, outer slightly stronger; spokes without arrowheads.
- Axis label: one sans word, bold, 16 units outside the ring; anchor middle top/bottom, start right, end left. Tick numbers on the top axis only.
- Series polygon: stroke 1.5, fill 0.18 opacity. Focal in `var(--accent)`, stroke 1.8, r=4 dots on it only. Draw smallest first, focal last.
**Budget:** 3-5 axes, 3-5 series, one normalised scale, 1 accent.
**Avoid:** dots on every series; a non-zero inner ring; 2 series or mixed units.

### Wardley map
**Shows:** how evolved each part of a value chain is, and what is about to move.
**Grammar:**
- Y: `Visible` at top, `Invisible` at bottom, as separate horizontal text lines; no numbers, no rotation.
- X: bands Genesis | Custom-built | Product | Commodity, three dashed `4,4` hairlines, mono uppercase labels below.
- Component: dot r=6, `var(--surface)` fill, `currentColor` stroke, sans 12 units bold label 12 units above; place by band, not score.
- Dependency: thin 0.8 units straight `var(--ink-2)` line, no arrowhead (diagonals allowed here).
- Movement: short right-pointing accent arrow, dashed `5,4`; the moving dot is accent too.
**Budget:** 9 components, 12 links, 2 arrows, every component linked.
**Avoid:** left-pointing arrows; numeric maturity scores; using it as an architecture diagram.

### Story map
**Shows:** the user's story in order and which stories form the first release.
**Grammar:**
- Top to bottom: backbone cards (activities in narrative order; rx=6, sans 12 units bold over mono `ACTIVITY 1`, 24 units gutters), step cards (rx=4, 32 units), release lanes.
- Lane: full-width band, fills alternating `var(--surface)` and `var(--surface-2)`, mono label (`MVP`, `RELEASE 2`, `LATER`) in a 96 units left margin; story cards rx=4, 48 units, title plus mono ticket/estimate. Add dashed column hairlines if lanes have gaps.
- Release cut: 1.5 units accent rule under the MVP lane, masked `RELEASE CUT`. Riskiest card: dashed accent stroke plus `RISK` tag.
**Budget:** 4 activities in 700-900 wide (card width = (width - 96 - gutters)/n), 3 lanes, 12 cards, 2 accents.
**Avoid:** no release cut; columns ordered by priority; date-named lanes; state or sentiment columns.

### Slopegraph
**Shows:** how several series changed between exactly two states, who crossed whom.
**Grammar:**
- Two vertical axis rules about 360 units apart (less than plot height), one shared scale and origin; mono state captions beneath.
- Names right-aligned left of the left axis, values next to it; mirrored on the right.
- Each series: one straight line, dots r=3 at both ends, both endpoints print real values; no gridlines.
- Lines `currentColor` 1.2 units with opacity 0.80 to 0.62 (floor 0.53); focal `var(--accent)` 2.4 units, dots r=4. Labels stay `currentColor`/`var(--ink-2)`.
- State the domain bounds in a source line.
**Budget:** 4-10 series, 1 accent.
**Avoid:** different scales per axis; nudging an endpoint to fit its label; reading mid-path values off a slope.

### Fishbone
**Shows:** causes of one observed effect, by category, with the confirmed root cause marked.
**Grammar:**
- Horizontal spine with arrowhead into the effect box on the right; the box states the symptom, not a fix.
- Bones: straight diagonals at 60 deg to the spine (dx:dy = 96:168), alternating above and below, evenly spaced; category tag at the outer end.
- Sub-causes: 32 units horizontal ticks at 1/3 and 2/3 along the bone; mono label past the open end.
- Accent: root-cause bone with its tag, plus the effect box.
**Budget:** 4 bones at 160 units pitch in about 800 wide (5 need about 1200), 3 sub-causes each, 2 accents.
**Avoid:** a bone with no sub-causes; sub-causes restating the category; two accented root causes.

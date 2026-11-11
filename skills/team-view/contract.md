# Gate page contract

For the agent that writes a gate's JSON. Your dispatch gives the gate's path, its `source` record, the calling skill's mapping (what each part of the synthesis becomes on the page), and the `render.js` command.

- **Show the destination.** Fill `outcome` (see *Outcome*) before the cards: the human approves where the work lands, not a list of steps.
- **Evidence goes on the item it supports.** Arguments, metrics, code and figures belong to the decision, tension or rejected item they concern, never to a page-level section. Copy every screenshot an item relies on into `.council/gates/YYYY-MM-DD-<topic>/`: scratchpad and `/tmp` are wiped after the session.
- **Render until it passes.** Run the `render.js` command you were given. It rejects invalid JSON with a list of errors. It also rejects an item that mentions a screenshot or "figure N" but has no `figures`. Fix and re-run.

## Triage before you render

The page is for decisions, not an inventory. Before writing the JSON:
- **One question, one card.** Settle every open question by `counting.md`: a majority goes in `decisions`, no majority goes in `tensions`, never both. The count goes in the item's `tags`. Two cards where a choice on one makes the other moot are one question: merge them into one card whose options are the coherent combinations. A card that only makes sense within another's choice carries `on` and renders in that card's block; one that builds on another's work carries `after`. The page orders both.
- **At most ~7 weighty decisions.** These are what the human must actually weigh: anything touching money, contracts or users, and tensions. Routine items with a clear recommendation (backlog steps, plan steps) don't count toward the cap; **Accept recommended** takes them in one click. On a review gate, a finding whose recommended fix no seat and no verifier contests is routine, whatever its severity: it stays a decision card and does not count toward the cap.
- **Everything else is `minor: true` with a `default`.** Edge-case quirks and cosmetic items become rows marked "Defaults applied, open to change." in the list, default applied.
- **Structure in one card.** Unanimous, zero-cost structural choices are one card *Confirm the structure*, each choice a `detail` bullet; a choice gets its own card only when seats split or a cost is accepted.
- **Accept recommended.** The page's *Accept recommended* takes every recommendation, and every default on a minor item; moot cards are skipped.
- **Fold it yourself.** Over the cap, fold to minor by stakes; never ask which.
- **Settled without you.** Everything the run decided without the human goes in `settled` (see *Field rules*).
- **Order by stakes.** The item the human explicitly asked about goes first.

## Outcome

`outcome` is one entry per view the work changes. The renderer rejects a `plan` or `kickoff` page without it. Include it on a `debate` page when the direction changes a screen or the system's shape, and on a `refactor` page when module boundaries move.

| `view` | Use it when | `after` is | `before` is |
|--------|-------------|------------|-------------|
| `ui` | a user sees something different | a wireframe of the target screen: real layout, real labels, sample data from the domain | a screenshot of today's screen |
| `system` | components, APIs, data flow, jobs or a workflow change | the target architecture (boxes = components, arrows = calls or data), or the target workflow as a sequence | the same diagram, today |

- `after` is required. `before` goes in whenever something exists today; a kickoff has none.
- `on`: `{ "id", "when": [option values] }` when the destination depends on one card's answer: one entry per destination, each shown while that card's answer (chosen, else recommended) is in its `when`, headed "If D1 = …". The card is a decision or a tension; a tension's option values are its sides' `who`.
- `caption` (required): one line naming what changed, e.g. "Discount line moves under the subtotal; nothing else moves".
- `states` (optional): `[ { "label", "svg" | "src", "caption" } ]`, the target in each state the framing's variants give it (same day, another day, incomplete, done…), one entry per state that looks different, shown in a row under `after`. `label` (≤ 40 characters) names the state; `caption` (required) says what differs from `after`. At most 6; `after` stays the main state.
- Both views when both change. A figure is `{ "svg" }`, `{ "src" }` or, for a screen, `{ "html" }` (rules below). A `.svg` or `.html` file given as `src` is inlined, so an agent can write the sketch to the gate folder and point to it.

**Before drawing any figure** (an outcome or an item's), read `figures.md` (your dispatch says where). It says whether to draw at all, picks the diagram type for what the figure shows, and holds the drawing rules, including the before/after grammar for a pair.

## Writing an item

Each field has one job, so no two say the same thing:

| Field | Its job | Shape |
|-------|---------|-------|
| `title` | The question (when `options` are custom) or the move (Approve/Decline) | ≤ 8 words |
| `detail` | The facts the title lacks: what is true today and what it costs | ≤ 3 bullets (4 is the hard limit), or one sentence; ≤ 200 characters each, ≤ 600 in all (on an acceptance gate: ≤ 120 each, ≤ 240 in all) |
| `why` | What the choice changes for the human, in their words; a jargon option gets a gloss in `detail` | One line; ≤ 160 characters |
| `options` | The answers, each a different outcome | ≤ 5 words each |

**An item that corrects a premise** (something the human answered, or an earlier record states) carries the tag `corrects <premise>`, e.g. `corrects answer 9`. Its `why` reads: *"You said `<premise>`; the code shows `<fact>`."* In plain words, no identifiers, a few words each so it fits the 160-character `why`; the rest goes in `detail`.

`detail` and `why` take an array of bullets, or a string whose `- ` lines become bullets. Inline `` `code` `` and `**bold**` are rendered; put the key number in bold. On a deciding page `detail` shows in the story block, right after `why`; the evidence pane keeps the evidence (option arguments, sides, constraints, examples, code, metrics, figures).

```json
{ "id": "F1", "title": "Gold discount rounding",
  "detail": ["Gold floors the 10 % discount; other tiers round", "49.95 € order: **4.99 €** off instead of **5.00 €**"],
  "why": "Changes invoices customers already received.",
  "options": [ { "value": "keep", "label": "Keep floor + comment" }, { "value": "round", "label": "Round like other tiers" } ] }
```

A weighty item's `detail` opens with what exists today: `Today: …` (the file, the tests that cover it). No option rests on a case in the data without evidence the case occurs.

The renderer rejects a `detail` or `why` over its limit, a `detail` that opens with the title, an option label that repeats the title, and a `detail` that holds every word of an option label.

## JSON contract

The gate JSON file is `<topic>.gate.json`; an older `.ceo.json` is still read. `kind: "council"` is still accepted and reads as `debate`.

```json
{
  "kind": "refactor | debate | plan | kickoff | review | acceptance",
  "title": "Refactoring backlog — src/invoice.js",
  "date": "2026-09-26",
  "source": ".council/refactors/2026-09-26-invoice.md",
  "context": [
    { "id": "I0", "title": "Four small steps, not a rewrite", "why": "One line: what the page is about and the overall call.",
      "facts": [ { "label": "Recommendation", "text": "Approve S1–S4. Run team-review on src/invoice.js before executing." } ] },
    { "id": "I1", "title": "Three weak spots in the code today",
      "facts": [ { "label": "Tax rule", "text": "The 20% tax rule is written out in three places." }, { "label": "Dead code", "text": "exportCsv() has no callers." } ] },
    { "id": "I2", "title": "invoice.js after the steps", "outcome": 0 }
  ],
  "outcome": [
    { "view": "system", "title": "invoice.js after the steps", "caption": "Tier switch leaves as computeDiscount(); tax is one constant",
      "before": { "src": "2026-09-26-invoice/system-before.svg" }, "after": { "src": "2026-09-26-invoice/system-after.svg" } }
  ],
  "decisions": [
    {
      "id": "S1", "group": "Backlog", "title": "Extract Function: computeDiscount(tier, total)",
      "at": { "path": "src/invoice.js", "line": 42 },
      "tags": ["structure", "no behavior change"],
      "detail": ["The tier switch sits inline in `buildInvoice`, 28 lines deep", "Extracting it leaves **3** branches to read (figure 1)"],
      "why": "Every later step reads the discount rule from one place.",
      "metrics": [ { "label": "buildInvoice length", "before": 64, "after": 36, "better": "lower" } ],
      "code": { "before": "switch (tier) { case 'gold': … }", "after": "const discount = computeDiscount(tier, total)" },
      "figures": [ { "src": "2026-09-26-invoice/s1-calls.svg", "caption": "Figure 1 — buildInvoice calls computeDiscount once" } ],
      "after": ["S0"],
      "options": [
        { "value": "extract", "label": "Extract now", "recommended": true,
          "for": [ { "who": "Mechanics", "point": "A named function can be tested without building a whole invoice." } ],
          "against": [ { "who": "Minimalist", "point": "One caller today; the inline switch is still readable." } ] },
        { "value": "later", "label": "Leave for the next run", "negative": true }
      ]
    },
    { "id": "S2", "group": "Backlog", "title": "Name the rate TAX_RATE_PCT?", "on": { "id": "S1" } },
    { "id": "S3", "group": "Backlog", "title": "Rename Variable: grand → total", "after": ["S0"], "minor": true, "default": "approve" }
  ],
  "tensions": [
    { "id": "T1", "topic": "Extract buildInvoice?", "sides": [
      { "who": "Responsibilities + Depth", "position": "Strongest case for…" },
      { "who": "Minimalist", "position": "Strongest case against…", "recommended": true } ] }
  ],
  "settled": [ { "id": "A1", "title": "Is the tier read per invoice?", "answer": "Per invoice", "source": "src/invoice.js:12", "who": "Mechanics" } ],
  "rejected": [ { "id": "DP-3", "title": "Per-type rule table", "reason": "One use; hides the floor quirk" } ]
}
```

## Story

A page that decides (every kind but acceptance) tells its story in order: context rows, then the cards, then the recap, in a list of two states (open, or a 52px rail), the card, and the evidence pane. The pane follows the option shown (the picked one, else the recommended, else the first), folds to a rail on the right (its close control, or `e`; the state is remembered and kept from card to card) and is not shown at all on a row or card with no evidence of its own. Every card opens story-first: its question, what is at stake, `detail`, up to three key numbers and one drawing, then *Your choice*: one row per option, all of one shape (number, label, cost line, Recommended, a Breaks badge per constraint it breaks, a mark on the option the pane shows); a click or 1–n picks. Two fields set it: `context`, the rows between cards, and `story`, their order. There is no `summary`: the first context row is the page's cover.

```json
"context": [
  { "id": "C1", "title": "Closing the books takes a day", "why": "Three customers wait on an export.", "outcome": 0,
    "metrics": [ { "label": "Manual hours per close", "before": 8, "after": 1, "key": true } ] }
],
"story": ["C1", "D3", "D1", "D2"]
```

- `context`: `[ { "id", "title", "why"?, "detail"?, "outcome"?, "figures"?, "metrics"?, "facts"?, "cases"?, "note"? } ]`, outside `decisions`. The first row is the page's cover: a one-line title (70 characters at most), `why` the verdict or what the page is about, `facts` the labelled sentences that used to be summary bullets. A row is listed with no status word, never counted, and writes nothing to the decisions block. `title` is its headline (a card or context-row title over 70 characters warns the writer: it is the list row and the card's headline, and nothing is cut); `why` and `detail` follow the card limits; `outcome: n` draws outcome entry `n` (0-based) as the row's drawing; `figures` and `metrics` as on a card. Three optional fields read better than bullets in `detail`: `facts`, `[ { "label", "text" } ]`, labelled sentences (Recommendation, What does not change, Out of scope), over 4 warns; one or two sentences each, never a `; `-joined list (an old summary label that held several points becomes its own context row, one fact per point, each labelled by its topic in 1-3 words); `cases`, `[ { "title", "tag"?, "figure"?, "text" } ]`, the parallel situations a rule covers in a two-column grid, each with one small drawing (a `figures` entry, `src` resolved like any figure), each distinct tag gets its own tone (3 tones: more distinct tags warn), a tag over 24 characters or a single case warns, an empty list is refused; `note`, a muted line at the row's end (a source, a period). Text is inline markdown. They show on the page in the order cases, facts, note, never in the evidence pane; the renderer refuses a malformed entry, an empty string or an unknown key in them.
- `story`: an optional list of ids, context rows and weighty decisions and tensions; on acceptance it is refused (the cover comes first, the cases follow in their Rule sections). It holds no prose of its own. Absent, the order is the context rows in their order, then the weighty decisions and tensions in the page's order, each followed by the cards that refine it (`on`). Given, the order is its ids, then every weighty decision or tension it leaves out, in that default order, each with the warning `D3 is not in "story": it is listed after the story's ids`. A context row it leaves out is not in the order, with the warning `context row "C2" is not in "story": it is not shown`.
- A minor item is never a story id: it stays in *Minor items*. A minor card that refines (`on`) a weighty one is placed under its root by the page.
- **Order rule (K12).** A card that refines another (`on`) comes right after its parent, or after the parent's earlier refinements: every id between the parent and it descends from the parent. A card that needs another (`after`) comes after it. The default order follows both rules too, and is checked like a given one; a card that refines one card and needs a later one can break it: then write `story`. The renderer refuses a break with `Q3 refines Q2: put it right after Q2 in story` or `Q4 needs Q1: put Q1 before Q4 in story`.
- The recap is the page's own last row; never write it. Ids starting with `_` are the page's own.
- The renderer refuses: `"story" is not read on acceptance gates`; `"story" must be a non-empty array of ids`; `"story" is now a list of ids ("C1", "D1", ...): sections { "title", "show" } are no longer read`; `story[i] must be an id string`; `story[i] "X" is not a context row, a decision or a tension`; `story[i] "X" is a minor item: minor items stay in their own section`; `story[i] "X" is named twice`; `"context" must be an array of { "id", "title", "why"?, "detail"?, "outcome"?, "figures"?, "metrics"?, "facts"?, "cases"?, "note"? }`; `context[i] needs "id" and "title"`; `context[i] takes no "K": only id, title, why, detail, outcome, figures, metrics, facts, cases, note`; `context[i] id "X" is already used`; `context[i] id "X" is reserved: ids starting with "_" are the page's own`; `context[i].outcome N: the gate has M outcome entries`; `context[i].metrics must be an array`; and `why`/`detail` over their limits.
- The renderer warns, on stderr, and the render still succeeds: `outcome[3] is not shown: name it in a context row's "outcome"` for each outcome entry no context row names; `"figures" are not shown on a deciding gate: put each on the card or context row it shows`; `D1 has 5 key metrics: the page shows 3 large, the rest in the evidence`; `D2 options "a" and "b" show the same figure: give an option a figure only where it lands differently` (an option with no figure is fine); `D1 option "a" label is 72 characters: keep it to 60 or less; the card's text can carry the rest` (an option label over 60 characters; nothing is cut).
- Both fields are read on every kind; acceptance reads `context` only. A card of a deciding gate with several options reads like a debate card.

## Field rules
- `story` (every kind but acceptance): the order of the page, a list of context row and weighty card ids (*Story*).
- `context` (every kind): the rows the story tells between cards, `[ { "id", "title", "why"?, "detail"?, "outcome"?, "figures"?, "metrics"?, "facts"?, "cases"?, "note"? } ]`; never decided, never counted (*Story*).
- **No `outcome` on a card.** On every kind but acceptance the renderer refuses `decisions[i] ("D1").outcome is not read on a card: put its drawing in the card's "figures"`; a mockup used on two cards is copied into each one's `figures`. `outcome: n` belongs on a context row.
- Only `title` and `decisions` (each with `id` and `title`) are required, plus `outcome` for `plan` and `kickoff`; an acceptance page takes `cases` instead (*Acceptance pages*). Ids are unique across decisions, tensions, questions, settled and rejected items, stable from the synthesis to the record, never reused.
- **No `summary`.** The renderer refuses it on every kind: `"summary" is not read: put the page's cover in a context row (its why and facts), and an outcome in a context row's "outcome"`. The cover is the first context row (*Story*); a review's cover facts also feed the posted review body (*Share fields*). It never counts cards: the renderer counts a review's findings.
- **Every item** (decision, tension, rejected, settled) accepts `detail`, `why`, `tags`, `metrics`, `examples`, `code`, `figures`, `options`, `default` and the bridge fields `lens`, `constraints` and `accepts` (*Bridge fields*). Arguments (`for`, `against`) go on options and tension sides only, never on the item.
- `unillustrated` (any item): a non-empty string saying why this card cannot be drawn. A debate or kickoff card with no `examples`, `figures`, option `examples` or `figures`, and no outcome whose `on.id` names it (`metrics` alone do not count), warns the gate writer; with `unillustrated` the warning is silenced. Nothing is shown on the page. Without it the renderer warns `D3 is not illustrated: give it examples or a figure, or say why in "unillustrated"` on stderr. A warning, never a refusal; old `council` gates are not checked. On a kickoff only the scope items (`lens: "business"`) are checked; the stack and conventions tail (`lens: "tech"`) is not.
- `examples`: the behaviour, case by case: `[ { "given", "when", "then" } ]`, one row per case (the state before, what someone does, the state after), each cell one line ≤ 120 characters, at most 8 rows. Use it when a rule's effect depends on the state it meets (a copy, a recalculation, a notification): the human checks rows, not a rule. Rows that differ by answer go on the option (*An option's own evidence*). It shows in the evidence pane under *Examples*, a three-column table. Lens as for `metrics`: the row's `lens`, else the item's. The decision record copies the chosen rows; team-plan turns each into a test, team-acceptance into a case.
- `for` / `against`: arguments, each attributed to the role that made it, as `{ "who", "point" }`, one concrete sentence each, read on `options[]` and a tension's `sides[]` only, as the direct for or against of that choice. Give a weighty option both columns. An empty `against` shows as "No argument raised", which is itself information. Use only arguments the panel made.
- `options[].label`: keep it to 60 characters (the option is one row of the card's choice); a longer one warns the writer and is not cut.
- `options[].for` / `options[].against` (and a tension side's): on the option they back or oppose. Put each argument on its option, on every kind; one that fits two options is written on both. A role that wants the question dropped backs an option marked `"negative": true` ("Drop this question"), which needs no `brief`. On a debate gate (the one place it is required) every decision with its own `options` carries exactly one option marked `"negative": true`, listed last (the page shows it last), worded for that question ("Don't build it", "Not yet: ask the customers first"; on a refinement, no to that refinement only); a gate without one is refused (`D1 has no negative option: add one with "negative": true and a label that says no to this question`). An argument about the whole question goes directly on the option it backs or opposes (its `for` or `against`), on several if it applies to several: no flip. Item-level `for`/`against` on a decision or tension of any kind are refused (`D2 has arguments on the question: put each on the option it backs or opposes directly (its "for" or "against"), on several if it applies to several`; on a decision with default options: `D4 has arguments on the question: write its options out ("approve" labelled "Approve", and "decline" labelled "Decline" with "negative": true) and put each argument on the option it backs or opposes directly; arguments for approving are Approve's "for", against approving Approve's "against"`; on a tension: `T1 has arguments on the question: put each on the side it backs (sides[].for / sides[].against)`), and so are those on a rejected, settled or question item (`R1 has arguments on the item: put each on the option it backs or opposes ("revive" / "keep-rejected" …)`).
- `after`: ids of the items this one builds on (old name `needs`, still read). Not a hard requirement: the page shows the link both ways and flags a chosen item whose `after` ids are not chosen (a dashed rail, "needs … first"), and Claude asks about it before acting. Unknown ids are rejected. It orders and links; it does not group.
- `on`: `{ "id", "when"? }`, one relation: the card only makes sense within the target's choice; `when`: option values of the target. If the target's answer removes or forces some of its options, it is not a child: merge them into one card of the coherent combinations; on a decision or tension (minor ones too), not on a rejected or settled item. The card renders in its root's block (follow `on` to a card without one), under the root behind a rail, with its relation in words ("refines D3") and a solid elbow rail in the list. In the story list a card with no `on` hangs under the first id of its `after` that is above it, behind a dashed elbow (dashed = needs it first, solid = refines), when the rows between them all hang under that base; otherwise it keeps its "Needs … first" word and no rail. Moot: once the root is answered, the card is moot when its choice is negative, outside `when`, or the root is moot; it greys out, shows "not needed: D1 = …", writes `M3 = moot (D1 = hand)`, and is skipped by *Accept recommended*. The root must be a weighty decision or a tension. The renderer orders by `after` and `on`, and rejects: a loop through `after`/`on`; a weighty card that comes `after` a minor one; a decision that comes `after` a tension (use `on`); an `after` card in Tensions, Minor or Settled below it; one in another decision group only when the dependent's group is already placed above (else the groups reorder).
- `settled`: page array of `{ "id", "title", "answer", "source", "who" }`, with the usual item fields. `title` is the question; `answer` ≤ 160 characters. They become rows of *Settled without you*, marked "Defaults applied, open to change.", with options OK (pre-applied) or Reopen. The decisions block says `A1 = ok` or `A1 = reopen | note: …`. `unverified` (optional string): what would settle a line nobody could confirm; the card shows it, and the shared prompt and review list such lines under "Not verified" instead of with the checked ones. A shared review lists them under "Settled without a question", never as threads; the shared prompt, under "Already checked", so the reader's agent neither redoes nor reopens them; a reopened one is an open question in both.
- `questions`: page array of `{ "id", "title", "source", "who" }`, with the usual item fields; review gates on someone else's branch only. `title` is the question, `source` what it is about (a `file:line`, the MR/PR, a ticket), `who` the seat that asks; `why` says what hangs on the answer. They become rows of *Questions for the author*, with options Ask the author (pre-applied) or Drop. The decisions block says `A11 = ask` or `A11 = drop | note: …`. The shared prompt and a shared review list the asked ones, with the note, right after the verdict; a dropped one appears nowhere.
- `at`: `{ "path", "line" }`, where the card's code is (repo-relative path, line at the reviewed commit), on decisions and tensions. It anchors the card in a shared review on the merge/pull request; a card without it goes in the body.
- **File names** in any text: write them repo-relative in backticks, `` `src/a.js` `` or `` `src/a.js:42` ``. When the file exists in the repo, the renderer links it, as it links `at` and the record: on the served page a click opens it in the human's editor; any page links it on the remote repo, at the pushed commit, else the pushed branch, when git tracks it.
- **Web links** in any text: put the URL behind the words it stands for, `[ticket #1892](https://…)`, never bare. Only `http(s)` links. A bare URL still links, but it reads as noise.
- `suggestion`: `{ "lines", "text" }`, on an item or one of its options: the exact replacement for the `lines` lines starting at `at.line`, up to ~10 lines. Only for a small, certain fix on lines the change touches (a rename, a constant, a guard), written from the reviewed commit: the reader applies it in one click from the review, as written, so never guess. Anything bigger stays in the brief.
- `brief` (Markdown): how an option gets done, as its executor will get it. The evidence pane shows the shown option's under *How it gets done*, folded; an option that leads to work without one shows nothing there. Put it on each option that leads to work, or on the item when only one does: the renderer rejects an item brief beside two options that lead to work, each without its own. team-review writes it (*Share fields*), team-refactor writes the Step Card; other gates leave it out.
- `options` defaults to Approve/Decline. Set `"recommended": "decline"` on the decision to recommend declining.
- **Tensions** hold only questions with no majority (see *Triage*). They get their id from their position (`T1`, `T2`…) unless you set `id`. Their default options are "Side with `<who>`" for each side, plus Defer. Mark the recommended side with `"recommended": true` on that side.
- **Rejected** items default to *Keep rejected* (pre-applied) or *Revive*, and `reason` is shown on the card.
- `metrics` show as before→after figures in the evidence pane. A metric is `{ "label", "before", "after", "better"?, "unit"?, "lens"? }` or `{ "label", "value", "unit" }`; `after` alone is a single value. `better` (`higher` or `lower`) colors the change green or red. Page-level `metrics` are rejected by the renderer.
- `metrics[].key: true` (on a card or a context row, never on an option): a key number. On every deciding page it is drawn large and centred: a before/after one reads `before → after`, a single value shows alone, and it is not repeated in the pane's numbers. On acceptance the flag is read on context rows only. At most 3 show large: more warns `D1 has 5 key metrics: the page shows 3 large, the rest in the evidence`. The renderer refuses `<where>.metrics[j].key must be true or absent` and `<where> option "v".metrics[j].key is read on a card or a context row only`.
- `code` shows as before/after panes: include it for every step that moves code, ≤ 15 lines each. When the options change the code differently, give each one its own: `code: { "after" }` on the option (or the tension side), with `"before"` only where it differs, and keep only `before` on the item. An option without `code` shows *Before* alone.
- **An option's own evidence.** Evidence that differs by answer goes on the option (or the tension side), never on the item labelled "for B": `code` (above), `metrics`, `examples`, `figures` and `accepts` (*Bridge fields*). On a deciding page the pane (460px, right of the card, closable and absent when the card has no evidence; the Evidence tab at 760px and under) follows the picked option, else the recommended one, else the first, and its picker lists every option, the negative one too (`[` and `]` move it): at the top, the shown option's `for` and `against` in two columns, its trade-off (business, tech, `accepts`), its own `metrics`, `examples`, `code` and `figures`, and the card's constraints as they stand under it (holds or breaks); then, under *The whole question*, the options compared (a column per lens and per number the options give, the shown option's row marked), the card's numbers not shown large, `code`, `examples`, other figures and sources. A context row or the recap shows its own evidence there, else one short line. A card whose options are labels only has no picker.
- `figures` entries take one of `svg`, `html` or `src`:
  - `src` points to an image such as a screenshot. It must be **relative to the JSON file**; absolute, `/tmp` and URL paths are rejected. The renderer embeds the image, so the `.html` stays one file. The caption says what to look at.
  - `svg` is trusted inline SVG. Palette and size rules: `figures.md` (a narrower `viewBox` gets scaled up).
  - `html` is a fragment of HTML and CSS (a `<style>` plus the markup), for a screen mockup only (`figures.md` § *HTML for a screen*). It renders in its own shadow root: its CSS stays inside, the page's tokens (`var(--surface)`, `var(--ink-2)`…) reach it. The renderer rejects `<script>`, an `on…=` attribute, `javascript:`, `<link>`, `@import`, `<iframe>`, `<object>`, `<embed>`, `<form>`, any `http(s)://` or `//` URL, and a fragment over 60 KB.
- Page-level `figures` are only for evidence that spans many items (it shows under the outcome). Anything about one item goes on that item.

## Bridge fields

On debate, plan and kickoff gates; the calling skill's mapping says what fills them, and `bridge.md` (copied beside this file) defines lens, constraint and trade-off. All optional: a gate without them renders as before.

```json
{ "decisions": [ { "id": "D1", "title": "Accounting export: build or buy?", "lens": "business",
    "constraints": [ { "id": "K2", "lens": "tech", "text": "No new database in production", "source": "CLAUDE.md:12", "status": "confirmed" } ],
    "options": [
      { "value": "build", "label": "Build in-house", "recommended": true, "tradeoff": { "business": "Live mid-November", "tech": "Duplicates the PDF pipeline (debt)" } },
      { "value": "buy", "label": "Third-party service", "tradeoff": { "business": "200 €/month", "tech": "No debt; one new dependency" }, "violates": ["K2"] },
      { "value": "neither", "label": "Neither: keep the manual export", "negative": true,
        "for": [ { "who": "CTO", "point": "Two PDF code paths to keep in sync", "lens": "tech" } ],
        "against": [ { "who": "PO", "point": "Unblocks the three customers waiting on the export" } ] } ],
    "accepts": "PDF pipeline debt, to make the 1 Dec closing",
    "metrics": [ { "label": "Weeks to ship", "before": 0, "after": 3, "better": "lower", "lens": "tech" } ] } ] }
```

- `lens` (`"business"` or `"tech"`): on an item, its default; on a `for`/`against` entry, a `metrics` entry or a `figures` entry, its own. Set each argument's lens from its role's default (`bridge.md`) unless the line carries its own, and leave it out only where the item's lens already says it. An entry with no lens takes the item's, else the kind's default (`debate`, `council` and `kickoff` business, `plan` tech); `review` and `refactor` have none and refuse it. `code` is always `tech`.
- `constraints`: on items only; a page-level `constraints` is rejected. Copy each constraint onto every card it binds — decision, tension or settled; one that binds no card is not a constraint. Each is `{ "id", "lens", "text", "source", "status" }`, status `confirmed`, `assumed` or `contested`. One id is one constraint: its copies on other cards are identical.
- `options[].tradeoff`: `{ "business"?, "tech"? }`, one line each, ≤ 80 characters. A cost with no evidence ends with `(estimate)`. A tension side takes `tradeoff` and `violates` too.
- `options[].violates`: the ids of the constraints the option breaks, on its item. The option stays choosable, with a *lifts K2* badge; choosing it lifts them, and the decisions block says so: `D1 = buy (lifts K2)`.
- `accepts`: one line, ≤ 160 characters: what the recommended option costs. Required on an item whose options carry `tradeoff` and one is recommended, unless that option carries its own. `options[].accepts` (or a side's): what that option costs, shown while it is chosen or picked; an option without one shows the recommended option's, labelled as such.
- `title`, `why`, `detail` and `options` stay shared, above the bridge.

**On the page**, a card shows its bridge (its constraints, the options' trade-offs side by side, and *Accepts*) in the evidence pane (right), split by option: the constraints under the shown option, its trade-off in its section, and the options compared under *The whole question*. A line (an argument, a constraint, a metric) reads *for the business* or *for the build* only where its lens differs from its card's default lens, and the trade-off columns always read theirs. There is no lens filter, tab or key on a decision page; only an acceptance page keeps its Business / Technical tabs and `l`.

**The renderer rejects** a `lens` other than `business` or `tech`; an entry of a lensed item with no lens; a constraint missing a field, with an unknown status, or an id whose copies differ, or the same id twice on one card; a page-level `constraints`; a `violates` id not on its item; a `tradeoff` with neither key, another key, or a line over 80 characters; a missing or over-long `accepts`; and a recommended or default option that violates any constraint: only the human lifts one, and auto-accept takes the recommendations.

## Share fields

A review gate (kind "review") is always share-ready: its gate writer writes these fields with the rest of the page. Other gates leave them out, except `brief` (*Field rules*), which the local page shows too.

The posted review body (`--review github|gitlab`) comes from the cover context row: its `why` is the verdict line, its `facts` follow as `- **label**: text`, then the page link. The review's cover therefore keeps four facts: *Blockers*, *Not raised*, *For team-refactor*, *Recommendation*, two sentences at most each. A review gate with no context row warns `a review gate with no context row posts a review body with no verdict: put the cover first`. Context row titles over 70 characters warn on every kind, acceptance included. The negative option is shown last on every deciding kind.

The reader is someone else, typically the owner of the branch the review looked at. They may not have team-skills, they saw none of the review, and they paste the page's prompt into their own coding agent (Claude Code, Codex, Cursor…). Write every field for them.

**Read first**
- The review record: it holds the mechanics (files, lines, verify commands) that the cards leave out.
- `git -C <checkout> rev-parse --abbrev-ref HEAD` and `git -C <checkout> rev-parse HEAD`.
- The checkout's agent instructions (`AGENTS.md`, `CLAUDE.md` or similar) and contributing docs, for the commit convention and the test commands. Don't assume the reader's agent is Claude.
- The CI config (`.gitlab-ci.yml`, `.github/workflows/`, or similar): lint and type-check commands are the CI's, flags included, never a laxer local variant.

**`lang`**: `"fr"` or `"en"`, the conversation's language. It was a share field and now drives every gate: every chrome string of the page, the prompt text of a local gate as well as a shared one; absent, the page is in English. An older local gate carrying `lang: "fr"` now shows French. Write every text of the gate in it: `title`, `preamble`, every brief, and the cover's `facts` labels too. The skills name those labels in English (*Blockers*, *Not raised*, *For team-refactor*…); on a `"fr"` gate, translate them (*Bloquants*, *Non relevé*, *Pour team-refactor*…).

**`preamble`** (Markdown), in this order:
- Put in it only what holds whatever the reader chooses; a rule about one finding ("run the Docker test for F3") goes in that finding's brief, or in `after`.
- `# Mission:` one line.
- **Context**: the repo, the branch, the reviewed commit's full SHA, and the scope as a list of files relative to the repo root.
- **Baseline**: which tests are green and how many, the command for each, known failures that come from the environment.
- **Rules**: each fix gets a failing test first that reproduces the finding, then the fix; one finding per commit, in the repo's commit convention; never change an existing test's expected value unless the finding says so; don't push.
- Last line: "If `HEAD` is not `<short SHA>`, the branch has moved since the review: find code by symbol, not by line number, and tell me what differs."

**`brief`** (Markdown), on each fix option of each finding: `fix`, or `fix-a` and `fix-b` when the finding has two candidate fixes. The `leave` option is `"negative": true` and has no brief. Each brief is written for someone who saw none of the review:
- **What**: the fix, by name.
- **Where**: files relative to the repo root, symbols, lines at the reviewed commit.
- **How**: the mechanics, as steps.
- **Leave alone**: what must not change.
- **Verify**: the exact command, and what green looks like.
- **Commit**: the message, in the repo's convention.

**`why`**: by *Field rules*. What sharing adds: the prompt carries it under each finding's title, so it tells the reader's agent what the fix protects; under a finding left as is, with the note as its reason, so the agent does not "fix" it in passing. A shared review's body carries the same lines for a finding left as is, which gets no thread. Such a finding needs a note: the Share button and `--preset` refuse one without.

**`after`, `at`, `suggestion`**: by *Field rules*. What sharing adds: when the reader keeps a finding but not what it comes `after`, the prompt tells their agent to ask first.

**Rules**
- **Only what the review found.** Where the review left the *how* open (a fix whose mechanics nobody settled), the brief says so and ends: "Ask me before doing this, with the options you see."
- **No paths the reader lacks.** No absolute paths (`/home/…`, `/Users/…`, `/tmp/…`, `C:\…`), no `<REPO>`-style placeholders, nothing under `.council/`. Name files relative to the repo root.
- **Every command run once.** Before rendering, run each command the preamble and the briefs give, in the review worktree at the reviewed commit, from the directory the text names; a command the *Baseline* already ran counts. On unchanged code a *Verify* runs and is green, or fails as its brief predicts (the new test). A command that errors on its own (a wrong path, an unknown flag, a missing script) is fixed before sharing, never shipped for the reader to discover.
- **Same outcome, one option.** If two options of a finding lead to the same change, write one.
- **No customer data.** No names, emails, phone numbers, amounts tied to a person or tokens in any brief, code pane, figure or screenshot. When the review touched such data, describe it ("a customer's email") instead.

**Checks.** `render.js --share` on any other kind than `review` writes `<gate>.share.html` (no record path, no preamble, SHA or brief) and rejects `--preset`; on a review it rejects a missing preamble, a preamble without a commit SHA, an option that leads to work without a brief, an item-level brief standing in for two options that lead to work, a local path, an unknown `lang`, and an `at` that is not repo-relative. Fix the JSON and re-run until it passes. Never edit the `.html`.

## Acceptance pages

`kind: "acceptance"`, written by team-acceptance: a page that presents a pushed branch case by case. Nothing on it is decided: no options, no note, no progress, no Copy or Send; it opens on the Business lens. It is rendered and opened, never served: `render.js` refuses `--serve` and `--accept-recommended`; `--share` writes it as a file (nothing to send back); it prints the page's size after its path.

```json
{ "kind": "acceptance", "title": "Acceptance — invoice CSV export", "date": "2026-11-09", "lang": "en",
  "branch": "feat-invoice-export", "commit": "9b1e4c7a2f",
  "context": [ { "id": "I0", "title": "Invoice CSV export, ready to try", "why": "What the branch brings.", "facts": [ { "label": "Environment", "text": "…" } ] } ],
  "examples": [ { "id": "E1", "given": "Three invoices in October", "when": "Export CSV is pressed", "then": "A CSV with three lines downloads" } ],
  "cases": [
    { "id": "C1", "group": "Export", "title": "Export the invoices of a month", "example": "E1",
      "steps": ["Open Invoices", "Pick October 2026", "Click **Export CSV**"],
      "expected": "A CSV downloads, one line per invoice of October.",
      "figures": [ { "src": "export/c1-bouton.png", "caption": "The Export CSV button" } ],
      "tech": { "how": "…", "files": ["src/invoices/export.js"], "data": "…" } },
    { "id": "C3", "group": "Limits", "title": "…", "steps": ["…"], "expected": "…", "unshown": "Why it could not be shown" } ] }
```

- `branch` and `commit` (the presented head, 7–40 hex characters) are required; the header shows them. No `summary`: the first context row is the cover (`title` what the branch does, `why` what it brings, `facts` *Environment* and *Not shown*, one or two sentences each); an acceptance page reads `context` and refuses `story`, so the cover comes first and the cases follow in their Rule sections, with no recap and no option rows.
- A case takes only `id` (unique), `group` (optional; its list section: the business rule; absent → *Cases*), `title`, `steps` (non-empty array), `expected`, `figures` (its screenshots, `src` relative to the JSON) or `unshown` (why it could not be shown; one of the two is required), and, optionally, `tech` (`how`, `files` as repo-relative paths, `data`) and `example` (an id like `E3` of the gate's `examples`). Any other key is refused, options included.
- `examples` (optional, top level): `{ id, given, when, then }` rows, ids like `E1` and unique, the three texts non-empty and uncapped. It is copied from the decision record's `## Examples`; the renderer reads no record, so a typo in the copy is not caught there. A case that cites `E3` shows "Example E3 from the specification", closed, its given / when / then inside it. Three refusals: `cases[i].example must be an id like "E3"`; `cases[i].example "E9" is not in "examples"` (an empty list is a list); `cases[i].example needs a top-level "examples" list to check it against`. An example no case cites is legal, and listed as "not replayed" in the cover card, after its facts: an observation, nothing to decide.
- Screenshots show under the Business lens, `tech` under the Technical one. Text fields take the page's inline marks; `tech.files` link like any file the page names.
- The renderer also refuses `decisions`, `tensions`, `questions`, `settled`, `rejected`, `outcome` and `preamble` on this kind.

Example: `examples/acceptance/export.acceptance.json`.

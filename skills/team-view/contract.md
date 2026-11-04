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
- Both views when both change. A figure is `{ "svg" }` or `{ "src" }` (rules below). A `.svg` file given as `src` is inlined, so an agent can write the sketch to the gate folder and point to it.

**Before drawing any figure** (an outcome or an item's), read `figures.md` (your dispatch says where). It says whether to draw at all, picks the diagram type for what the figure shows, and holds the drawing rules, including the before/after grammar for a pair.

## Writing an item

Each field has one job, so no two say the same thing:

| Field | Its job | Shape |
|-------|---------|-------|
| `title` | The question (when `options` are custom) or the move (Approve/Decline) | ≤ 8 words |
| `detail` | The facts the title lacks: what is true today and what it costs | ≤ 3 bullets (4 is the hard limit), ≤ 120 characters each, or one sentence; ≤ 240 characters in all |
| `why` | What the choice changes for the human, in their words; a jargon option gets a gloss in `detail` | One line; ≤ 160 characters |
| `options` | The answers, each a different outcome | ≤ 5 words each |

**An item that corrects a premise** (something the human answered, or an earlier record states) carries the tag `corrects <premise>`, e.g. `corrects answer 9`. Its `why` reads: *"You said `<premise>`; the code shows `<fact>`."* In plain words, no identifiers, a few words each so it fits the 160-character `why`; the rest goes in `detail`.

`detail` and `why` take an array of bullets, or a string whose `- ` lines become bullets. Inline `` `code` `` and `**bold**` are rendered; put the key number in bold.

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
  "kind": "refactor | debate | plan | kickoff | review",
  "title": "Refactoring backlog — src/invoice.js",
  "date": "2026-09-26",
  "source": ".council/refactors/2026-09-26-invoice.md",
  "summary": [
    { "label": "Verdict", "text": "One line: what is being decided and the overall call." },
    { "label": "Weak spots", "points": ["Three copies of the tax rule", "Dead exportCsv()"] },
    { "label": "Recommendation", "points": ["Approve S1–S4", "Run team-review on src/invoice.js before executing"] }
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
      "for": [ { "who": "Mechanics", "point": "A named function can be tested without building a whole invoice." } ],
      "against": [ { "who": "Minimalist", "point": "One caller today; the inline switch is still readable." } ],
      "metrics": [ { "label": "buildInvoice length", "before": 64, "after": 36, "better": "lower" } ],
      "code": { "before": "switch (tier) { case 'gold': … }", "after": "const discount = computeDiscount(tier, total)" },
      "figures": [ { "src": "2026-09-26-invoice/s1-calls.svg", "caption": "Figure 1 — buildInvoice calls computeDiscount once" } ],
      "after": ["S0"],
      "options": [
        { "value": "extract", "label": "Extract now", "recommended": true },
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
  "rejected": [ { "id": "DP-3", "title": "Per-type rule table", "reason": "One use; hides the floor quirk" } ],
  "figures": [ { "title": "Vote spread", "svg": "<svg viewBox='0 0 800 160'>…</svg>" } ]
}
```

## Field rules
- Only `title` and `decisions` (each with `id` and `title`) are required, plus `outcome` for `plan` and `kickoff`. Ids are unique across decisions, tensions, questions, settled and rejected items, stable from the synthesis to the record, never reused.
- `summary` is a list of bullets, never a paragraph. Each bullet is a string or a `{ "label", "text" }` / `{ "label", "points": [...] }` object. Aim for 3–5 labelled bullets; end with the recommendation. It never counts cards: the renderer counts a review's findings. The renderer rejects a string summary.
- **Every item** (decision, tension, rejected, settled) accepts `detail`, `why`, `tags`, `for`, `against`, `metrics`, `code`, `figures`, `options`, `default` and the bridge fields `lens`, `constraints` and `accepts` (*Bridge fields*).
- `for` / `against`: the arguments, each attributed to the role that made it, as `{ "who", "point" }`, one concrete sentence each. Give a weighty item both columns. An empty `against` shows as "No argument raised", which is itself information. Use only arguments the panel made.
- `after`: ids of the items this one builds on (old name `needs`, still read). Not a hard requirement: the page shows the link both ways and flags a chosen item whose `after` ids are not chosen (a dashed rail, "needs … first"), and Claude asks about it before acting. Unknown ids are rejected. It orders and links; it does not group.
- `on`: `{ "id", "when"? }`, one relation: the card only makes sense within the target's choice; `when`: option values of the target. If the target's answer removes or forces some of its options, it is not a child: merge them into one card of the coherent combinations; on a decision or tension (minor ones too), not on a rejected or settled item. The card renders in its root's block (follow `on` to a card without one), under the root behind a rail, with its relation in words ("refines D3") and a solid elbow rail in the list. Moot: once the root is answered, the card is moot when its choice is negative, outside `when`, or the root is moot; it greys out, shows "not needed: D1 = …", writes `M3 = moot (D1 = hand)`, and is skipped by *Accept recommended*. The root must be a weighty decision or a tension. The renderer orders by `after` and `on`, and rejects: a loop through `after`/`on`; a weighty card that comes `after` a minor one; a decision that comes `after` a tension (use `on`); an `after` card in Tensions, Minor or Settled below it; one in another decision group only when the dependent's group is already placed above (else the groups reorder).
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
- `metrics` show as before→after figures in the evidence pane. `better` (`higher` or `lower`) colors the change green or red. Page-level `metrics` are rejected by the renderer.
- `code` shows as before/after panes: include it for every step that moves code, ≤ 15 lines each. When the options change the code differently, give each one its own: `code: { "after" }` on the option (or the tension side), with `"before"` only where it differs, and keep only `before` on the item. An option without `code` shows *Before* alone.
- **An option's own evidence.** Evidence that differs by answer goes on the option (or the tension side), never on the item labelled "for B": `code` (above), `metrics`, `figures` and `accepts` (*Bridge fields*). The evidence pane shows the chosen option's, else the recommended one's, beside the item's own, and an *Evidence for* picker shows another option's without choosing it.
- `figures` entries take either `svg` or `src`:
  - `src` points to an image such as a screenshot. It must be **relative to the JSON file**; absolute, `/tmp` and URL paths are rejected. The renderer embeds the image, so the `.html` stays one file. The caption says what to look at.
  - `svg` is trusted inline SVG. Palette and size rules: `figures.md` (a narrower `viewBox` gets scaled up).
- Page-level `figures` are only for evidence that spans many items (it shows under the outcome). Anything about one item goes on that item.

## Bridge fields

On debate, plan and kickoff gates; the calling skill's mapping says what fills them, and `bridge.md` (copied beside this file) defines lens, constraint and trade-off. All optional: a gate without them renders as before.

```json
{ "decisions": [ { "id": "D1", "title": "Accounting export: build or buy?", "lens": "business",
    "constraints": [ { "id": "K2", "lens": "tech", "text": "No new database in production", "source": "CLAUDE.md:12", "status": "confirmed" } ],
    "options": [
      { "value": "build", "label": "Build in-house", "recommended": true, "tradeoff": { "business": "Live mid-November", "tech": "Duplicates the PDF pipeline (debt)" } },
      { "value": "buy", "label": "Third-party service", "tradeoff": { "business": "200 €/month", "tech": "No debt; one new dependency" }, "violates": ["K2"] } ],
    "accepts": "PDF pipeline debt, to make the 1 Dec closing",
    "for": [ { "who": "PO", "point": "Unblocks the three customers waiting on the export" } ],
    "against": [ { "who": "CTO", "point": "Two PDF code paths to keep in sync", "lens": "tech" } ],
    "metrics": [ { "label": "Weeks to ship", "before": 0, "after": 3, "better": "lower", "lens": "tech" } ] } ] }
```

- `lens` (`"business"` or `"tech"`): on an item, its default; on a `for`/`against` entry, a `metrics` entry or a `figures` entry, its own. Set each argument's lens from its role's default (`bridge.md`) unless the line carries its own, and leave it out only where the item's lens already says it. `code` is always `tech`.
- `constraints`: on items only; a page-level `constraints` is rejected. Copy each constraint onto every card it binds — decision, tension or settled; one that binds no card is not a constraint. Each is `{ "id", "lens", "text", "source", "status" }`, status `confirmed`, `assumed` or `contested`. One id is one constraint: its copies on other cards are identical.
- `options[].tradeoff`: `{ "business"?, "tech"? }`, one line each, ≤ 80 characters. A cost with no evidence ends with `(estimate)`. A tension side takes `tradeoff` and `violates` too.
- `options[].violates`: the ids of the constraints the option breaks, on its item. The option stays choosable, with a *lifts K2* badge; choosing it lifts them, and the decisions block says so: `D1 = buy (lifts K2)`.
- `accepts`: one line, ≤ 160 characters: what the recommended option costs. Required on an item whose options carry `tradeoff` and one is recommended, unless that option carries its own. `options[].accepts` (or a side's): what that option costs, shown while it is chosen or picked; an option without one shows the recommended option's, labelled as such.
- `title`, `why`, `detail` and `options` stay shared, above the bridge.

**On the page**, a card shows its bridge (its constraints, the options' trade-offs side by side, and *Accepts*) in the evidence pane (right), as one trade-off table with Biz and Tech columns. Each argument in the centre pane is tagged Biz or Tech. A *Both | Biz | Tech* switch narrows the evidence pane, and `l` cycles it (`b` / `t` pick a lens). The list pane's lens marks show which lens each card concerns, and its Filter menu hides the cards that concern only the other lens (a card with no lens stays).

**The renderer rejects** a `lens` other than `business` or `tech`; an entry of a lensed item with no lens; a constraint missing a field, with an unknown status, or an id whose copies differ, or the same id twice on one card; a page-level `constraints`; a `violates` id not on its item; a `tradeoff` with neither key, another key, or a line over 80 characters; a missing or over-long `accepts`; and a recommended or default option that violates any constraint: only the human lifts one, and auto-accept takes the recommendations.

## Share fields

A review gate (kind "review") is always share-ready: its gate writer writes these fields with the rest of the page. Other gates leave them out, except `brief` (*Field rules*), which the local page shows too.

The reader is someone else, typically the owner of the branch the review looked at. They may not have team-skills, they saw none of the review, and they paste the page's prompt into their own coding agent (Claude Code, Codex, Cursor…). Write every field for them.

**Read first**
- The review record: it holds the mechanics (files, lines, verify commands) that the cards leave out.
- `git -C <checkout> rev-parse --abbrev-ref HEAD` and `git -C <checkout> rev-parse HEAD`.
- The checkout's agent instructions (`AGENTS.md`, `CLAUDE.md` or similar) and contributing docs, for the commit convention and the test commands. Don't assume the reader's agent is Claude.
- The CI config (`.gitlab-ci.yml`, `.github/workflows/`, or similar): lint and type-check commands are the CI's, flags included, never a laxer local variant.

**`lang`**: `"fr"` or `"en"`, the conversation's language. It was a share field and now drives every gate: every chrome string of the page, the prompt text of a local gate as well as a shared one; absent, the page is in English. An older local gate carrying `lang: "fr"` now shows French. Write `preamble` and every brief in it.

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

**Checks.** `render.js --share` rejects a `kind` other than `review`, a missing preamble, a preamble without a commit SHA, an option that leads to work without a brief, an item-level brief standing in for two options that lead to work, a local path, an unknown `lang`, and an `at` that is not repo-relative. Fix the JSON and re-run until it passes. Never edit the `.html`.

# team-council-plan templates

What each agent produces. The orchestrator copies this file into the run folder and points each agent to its section.

A pointer to a `team-protocol` section means that section of `team-protocol.md`, copied beside this file.

## Plan (writers)

Whatever the format, add `Status: draft`, the decision file's path and the final-review bullet of *Verification* below. Traces cite decision ids only; a reviewer defect becomes a plain sentence; no run-folder paths. About 40 lines per task, 800 per plan; beyond, offer the CEO sub-plans. A step that changes a screen gives its states, exact copy and accessibility. Use the project's plan format if one exists; otherwise:

```markdown
# Plan — {topic}
Status: draft
_From council decision: .council/decisions/YYYY-MM-DD-<topic>.md_

## Goal
[The decided direction, in one or two sentences]

## Outcome
[Links to the approved sketches (committed copies if .council/gates/ is gitignored), one line each on what changes. The executor builds towards these]

## Accepted Trade-offs
[Copied from the decision record's `## Accepted trade-offs`: each cost, who accepted it, and its revisit condition when one was named]

## Structure
[Each structural choice the plan makes (`team-protocol` § *Structural choices*), one line each, with who settled it: "the decision" or "the CEO, before drafting". A line whose rule is a constraint carries its id (`K3`). "None" when the plan makes none]

## Constraints
[Those that bind the plan (`bridge.md`): id, lens, text, source, from the decision record's `## Constraints` and the profile's standing ones (`KS<n>`). One a *Structure* line states is listed by id only]

## Steps
1. [Concrete, verifiable step] — Size: S|M|L[, design-heavy: <reason>]
2. ...

## Execution economy
- Executors: sonnet; opus only for a step marked design-heavy, with the reason
- Batches: [the batch rule of `team-protocol` § *Execution*, written out in full, or the project's own], one commit per step
- Reviews: sonnet for spec compliance, opus for the final whole-branch review; fixups re-checked by `team-protocol` § *Execution*
- Diff guard: [the commands of `team-protocol` § *Code scope*, filled in for this project; each executor runs them on its staged change before each commit]

## Risks & Mitigations
[From CTO/PO review]

## Verification
[How we confirm each step and the whole works]
- After the final review, offer `team-review` on the executed diff (own branch); its intent is this plan and the decision record
- Final whole-branch review (opus): nothing smuggled in or dropped, the *Outcome* reached, no check weakened: [every item of `team-protocol` § *Weakened checks*, written out: the executing session may not load team-protocol]
```

## Review (reviewers)

- **CTO** — technical soundness, correct sequencing, testability, risk, adherence to quality gates; every structural choice a step makes is in *Structure*; no step breaks a `tech` constraint of *Constraints*.
- **PO** — scope fidelity to the decision, value ordering, nothing smuggled in or dropped; no step breaks a `business` constraint or exceeds an accepted trade-off (e.g. a second duplicated pipeline where one was accepted).
- **UX** — dispatched whenever the plan changes something a user sees: flow, states, accessibility, copy; no step breaks a `business` constraint or exceeds an accepted trade-off on what the user meets.
- **Ad-hoc specialist** — if the decision implicates another domain (e.g. a Performance Analyst for a perf change).

Pick 2–3 of your role's `## Sources` and end your verdict with `— via <sources>`. Cite evidence and flag concrete plan defects, not vibes. The CTO greps the existing tests before raising a test risk. A defect that depends on a case in the data carries evidence the case occurs; without it the card reads "occurrence unknown" and offers no rework.

**Outcome sketches.** The CTO draws the `system` view: the architecture or workflow the plan delivers, and the same diagram for today. UX draws the `ui` view: a wireframe of the target screen, and a screenshot of today's screen when the app runs (a sketch of it otherwise). Each writes SVG files to `.council/gates/YYYY-MM-DD-<topic>/` (`system-before.svg`, `system-after.svg`, `ui-before.png|svg`, `ui-after.svg`), following *Outcome* in `team-ceo-view`'s `contract.md` and `figures.md` (copies in the run folder). A reviewer who cannot draw the result reports that as a plan defect: the plan doesn't say what it builds.

## Gate page (gate writer)

Build the page (`kind: "plan"`, `source` = the draft plan) by `team-ceo-view`'s `contract.md`:
- `summary` (labelled bullets): *Goal*, *Accepted trade-offs*, *Shape of the plan*.
- `outcome`: the reviewers' sketches in `.council/gates/YYYY-MM-DD-<topic>/`, `system` and/or `ui`, each with `before` and `after`.
- No page `constraints`: the plan's *Constraints* go onto each card they bind (`contract.md` § *Bridge fields*).
- **Each plan step** without a decision id: `minor`, `default: "approve"` — the steps fold into one block, approved at once, each declinable. A step that carries a decision or an accepted risk stays a card. A step's `title` is the move; its `detail` gives only what the title lacks (impact, risk), or is omitted. The size goes in `tags` (`"S"`, `"M"`, `"L"`). Add `code` when a step changes an existing interface.
- **Each risk the reviewers raised that needs acceptance, with a majority** (`counting.md`): a weighty decision with options such as *accept / mitigate as proposed / rework*, with the reviewers' points in `for`/`against`. When the risk reopens a question the council decided, add the council's minority option too, labelled `reverses council D<n>` with the council record's id. Its arguments keep their reviewer's default lens (`bridge.md`); options with a cost carry `tradeoff`, and the item its `accepts`.
- **Each constraint found while planning**: a weighty decision carrying that constraint (`"status": "assumed"`), with the options *honor it* (the steps reworked to keep it, `recommended`) and *proceed without it* (`violates` its id). Choosing the second lifts it; the approval record writer records a lift in the record and the profile, and adds a kept constraint with the next free `K<n>` id (`SKILL.md` § *Approve & write*).
- **Each reviewer concern kept against the council's accepted trade-off** (your dispatch lists them): in the `against` of the step or risk it concerns, or a minor item when it concerns none.
- `tensions`: only risks the reviewers split on with no majority, by `counting.md`.
- No step dependency graph: the order is the executor's concern, and the human approves the destination.

If `.council/gates/` is gitignored and the plan location is not, also copy the approved sketches next to the plan (`<plan location>/YYYY-MM-DD-<topic>/`) and link those copies from its `## Outcome`: executors in a worktree see only committed files. Otherwise link the sketches where they are.

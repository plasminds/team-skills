# team-council templates

What each writing agent produces. The orchestrator copies this file into the run folder and points each agent to its section.

A pointer to a `team-protocol` section means that section of `team-protocol.md`, copied beside this file.

## Synthesis (synthesizer)

Read every role's file and the CEO's answers. Each open question goes in exactly one section, settled by `counting.md`. Every item carries a recommendation or `none — ask`; the gate writer never invents one. An item built on a premise a role marked `unverified` keeps the marker on that premise, however many roles repeated it (`reachability.md` § *Reachability check*). Ids are stable from here to the record. Lenses, constraints and trade-offs follow `bridge.md`. Length and readers: `team-protocol` § *Writers*.

```markdown
## Council Summary

### Decision: [what was being decided; who sat, and at which depth]

### Consensus Points
[Where every role that spoke agrees]

### Majority Calls
[One per question with a majority: the question, the majority's option and
who backs it, then the minority's option, who holds it and its strongest case]

### Key Tensions
[Only questions with no majority: each side's strongest version and who
holds it, then the PO's suggested side and why]

### Structural choices
[Every one the roles named (`team-protocol` § *Structural choices*): a settled
one points to the Majority Call or consensus point that settles it; the others
say "left to the plan" and why they can wait. "None" when the direction makes none]

### Settled
[Question → answer — source — who, for each item settled without the CEO]

### Constraints
[Only K by `bridge.md`; each names the items it binds. One line each: id, lens, text, source, status, with the profile's standing ones (`KS<n>`) and the CEO's answer where the pause settled one. "None" when nothing binds]

### Trade-offs
[One line per option and lens, consolidated from the roles' *Trade-offs*:
option, lens, gains, costs. A cost with no evidence ends "(estimate)"]

### PO Recommendation
[The overall direction. Refer to Majority Calls and Key Tensions by id;
don't restate them. It violates no constraint above. End with one line of
at most 160 characters: `Accepts: <what the pick costs>`]

### Dissenting Views Worth Noting
[Concerns not tied to a question above, and positions left uncounted for
lack of evidence. A minority on a Majority Call belongs in that call]
```

## Gate page (gate writer)

Build the page (`kind: "council"`) by `team-ceo-view`'s `contract.md`, from the synthesis and the reachability file (`reach.md`): an item it found unreachable goes to `settled` as `moot`, with its guard, and a reachable one carries its path in `detail`.
- `summary` (labelled bullets): *Decision* (what is being decided, and who sat), *Consensus*, *Recommendation* (the PO's pick and its `Accepts:` line).
- `outcome` (when the PO's pick changes a screen or the system's shape): sketch where the pick lands, `ui` and/or `system`, today beside the target, into `.council/gates/YYYY-MM-DD-<topic>/`, drawn by `figures.md`. When another option would land somewhere visibly different, add its `after` sketch to `D1`'s `figures`, captioned with the option's label, so the human compares destinations.
- **`D1`**: the decision itself. Its `options` are the approaches on the table, with `recommended` on the PO's pick. Its `title` is the question, and its `detail` the facts every option shares (≤ 3 bullets); the consensus points go there too when they fit. Put the roles' strongest arguments in `for` (for the pick) and `against` (dissent, risks), each credited to its role.
- **More decisions**: one per Majority Call. The majority's option is `recommended`, and the minority's option stays in `options` with its case in `against`.
- **`settled`**: the synthesis's *Settled* list. A Round 2 refutation goes into the card it refutes: an `against` argument, or a premise correction (`corrects <premise>`) that rewrites its options. A card that only makes sense within another's choice carries `on`, with `when` when it concerns only some of that card's options.
- **The bridge** (`contract.md` § *Bridge fields*): no page `constraints`; each constraint goes onto the cards it binds, the profile's standing ones (`KS<n>`) included. Each decision's options carry their `tradeoff` from the synthesis's *Trade-offs* and `violates` for each constraint they break. `D1`'s `accepts` is the `Accepts:` line; any other decision or tension whose options carry `tradeoff` takes the recommended option's costs, in one line.
- **Lenses**: every `for`/`against` entry, metric and figure keeps its role's default lens (`bridge.md`) or the one its line carries. Set the item's `lens` to the one most of its entries share, and give the others their own.
- **Structural choices**: unanimous zero-cost ones become one *Confirm the structure* card; the others are cards with `"lens": "tech"` (their Majority Call's, or built from the consensus with the pick `recommended`), never folded into `D1`'s `detail` or the summary. The ones left to the plan: one minor item naming them, so the CEO can ask for one to be settled now.
- `tensions`: one per Key Tension (by `counting.md`), each side attributed by role, with the PO's suggested side `recommended`. If D1 itself has no majority, it becomes `T1` and the page has no `D1`.
- Dissenting views worth noting go in the `against` of the decision they weigh on, or become a minor item if they concern none.
- **Figure** (only when there are 3+ options or the council split): a position map, roles × options, showing who backs what, in `D1`'s `figures`.
- `rejected`: approaches the council dropped, with the reason, so the CEO can revive one.

## Decision record (record writer)

Write the CEO's decisions (notes included) under the synthesis in `.council/decisions/YYYY-MM-DD-<topic>.md` (create `.council/decisions/` if absent), and set the header to `Status: decided YYYY-MM-DD`.
- **`## Constraints`**, by `bridge.md`: the synthesis's constraints with their final status; each one the CEO lifted (a `(lifts K<n>)` after a choice in the decisions block) as "`K<n>` lifted by the CEO, `<their words>`"; and the `tech` constraints born of the structural choices the CEO settled, source `<this record's path>, D<n>`. A lifted standing one (`KS<n>`): also mark its line `lifted by <this record's path>` in the profile's `## Constraints`; never delete it.
- **`## Accepted trade-offs`**: the costs of each chosen option that carries a trade-off, one line each, with who accepted them (`the CEO`, or `auto-accept` on a `mode: auto-accept` block) and the condition to revisit them when the council named one.
- **Supersession**: when it replaces an earlier decision, put `Supersedes: <path>` at the top and add `Superseded by: <path>` to the old record. Never delete or rewrite the old one: it says why the project once chose otherwise.
- **Correction**: when it corrects a fact in an earlier record without replacing its decision, add `Corrected by: <path> — <the line it corrects>` to the old record.
- **Within this record**: it opens with *Decisions in 10 lines*. A correction folds into the decision it corrects, with one *History* line (`gate pick X, changed in chat to Y — "<CEO's words>"`); no stacked amendment sections.
- **The project's decision records**: when the profile lists them, also add one there in their format (location, numbering, headings), holding the context, the decision, its consequences and a link to the council record. `.council/decisions/` stays the record `team-council-plan` reads.

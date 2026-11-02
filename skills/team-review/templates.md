# team-review templates

What each agent writes. The orchestrator copies this file into the run folder and points each agent to its section.

A pointer to a `team-protocol` section means that section of `team-protocol.md`, and one to a `counting.md` section that section of `counting.md`: both are copied beside this file.

## Review Brief (Recon)

The *only* shared context for the seats, so the seats don't each re-read the same files. Its size cap and gate-command rule: `team-protocol` § *Code scope*. It holds:
- **Scope**: the changed line ranges per file (`git diff --unified=0`), so seats can tell new code from old; the reviewed commit's full SHA; for an MR/PR, its refs (base, start, head SHAs) from the run folder.
- **Intent**, from the first that exists, with its source named: the MR/PR title and description and its linked ticket (`gh pr view <n> --json title,body`, `glab mr view <iid>`); the author's note's *Intent* line; the commit messages; a matching `.council/decisions/` record and its plan. None → write `Intent: none found`; the orchestrator asks the user.
- **Author's note**, when `.council/author-notes/<branch>.md` exists (`/` in the branch name → `-`; read it from the user's checkout, not a review worktree): its *Choices*, *Gaps* and *Checked by hand* lines under that heading, copied as written, each marked `author claim`. A claim is what the author says, not evidence: don't check it, don't drop it. None → leave the heading out.
- **Intake only**: in place of *Intent*, the refactor records' paths and their *For team-review* lines, copied as written.
- Quality-gate commands, each with its result (`team-protocol` § *Code scope*). Red is a result to report, not a reason to stop.
- *Settled*, *Ungated*, *Unformatted*, *Known flakes* and the *Diff guard*, by `team-protocol` § *Code scope*. The Intent seat cards each *Ungated* path in scope.
- **Coverage of the changed lines**: which are exercised by a test, which are not.
- **Expected load**, with its source: the profile's `## Expected load`, or with no profile, your own read of the README and deploy config (one person running a script, one server process, several instances or workers sharing a store), marked `assumed` when nothing states it. Seats judge races, concurrency and cost against it.
- **Reach**, diff scopes only: for each signature, return value, exported name, field, error or unit the diff changes, every caller or reader outside the changed lines (tests, fixtures, config and string references included), one line each with `file:line`, and `ok` or `broken: <why>` against the new contract. More than ~20 lines: group them by changed symbol, broken ones in full, the `ok` ones counted. `none` when the diff changes no contract.
- Leads from the profile's tools (type checker, `npm audit`, `osv-scanner`, `semgrep`, `gitleaks`, dead-code tools), run on the scope. A lead is not a finding: a seat verifies each by hand before citing it. The profile's `(machine)` tools run by `machine-tools.md` § *Run recipes*, each lead list opening with the mode line of `machine-tools.md` § *Mode line*; a lead is still verified by hand (`machine-tools.md` § *Leads, not findings*). The brief carries the orchestrator's osv-scanner answer; it governs every osv-scanner run, the project-declared one included (run only on `yes`).
- **Trust boundaries**, for every scope: where the code in scope takes input it does not control or acts with privilege (an entry point, authn/authz, input parsing, an outbound call, a stored secret, untrusted content rendered), each with `file:line`, or `none`. `none` means the Security seat does not sit: list a boundary when in doubt. Put this line in your reply, or the count of boundaries, written `none` for 0: the orchestrator seats Security from it.
- **Excerpts**: the changed code itself, with `file:line` headers.

## Finding Card (seats)

At most 5 cards: the cap forces prioritization. Then a *For team-refactor* list (≤ 3 lines, by `team-protocol` § *Lane hand-offs*) of structural trouble you stumbled on, never a card.

```markdown
### <PREFIX>-<n>: <defect> in <file:line>
- Lens: <correctness | error-handling | security | intent | tests | types | performance | conventions>
- In diff: <yes | reach (<the changed file:line that breaks it>) | no (audit)>
- Scenario: <the concrete input, state or call where it breaks, and what happens. A race, concurrency or cost card names the load it assumes>
- Evidence: <cited lines, opened in source, not only quoted from the Review Brief>
- Refutation: <what you checked that could have proved this wrong — the guard, the caller, the test — and what you found>
- Fix: <the fix. When two fixes are defensible, both, as `(a) …` and `(b) …`, each saying what behavior or data it keeps and what it loses>
- Replacement: <optional: the exact new lines at one place, ≤ ~10, for a one-click suggestion>
- Severity: <blocker | major | minor>
- Confidence: <high|med|low> (by `counting.md` § *Confidence*; a low card skips the verifier and goes to *Not raised*)
```

- **Prefix.** Your seat's two letters: `CR`, `SE`, `IN` or `CF` (`HO` for an intake card), never the seat's name: `### CF-2`, not `### CRAFT-2`.
- **Severity.** `blocker`: merging it loses money or data, opens a hole, or breaks a main path at the brief's *Expected load*. `major`: wrong behavior on a real path, a swallowed error, new logic with no test. `minor`: names, conventions, a cost with no hot path at that load.
- **Diff scope.** A caller the diff breaks is a card, `In diff: reach`, with the broken caller in its heading. A defect the diff did not cause is one line under *Not raised*, after *For team-refactor*, never a card.
- **Author claims.** A line of the brief's *Author's note* explains a choice; it refutes nothing. When your scenario still breaks with the choice made, write the card and name the claim in its *Refutation*. When the choice already weighs your scenario (a trade-off it states, a gap it defers), one line under *Not raised*: `author choice: <the claim> — <the scenario it accepts>`.

## Intake cards (Recon, intake)

For `team-review <refactor record>…`, after the Review Brief: one Finding Card per *For team-review* line of the records, and per *Execution* → *Notes* line that suspects a bug, by § *Finding Card*, into `<run folder>/seat-handoff.md` under `### Finding Cards`, prefix `HO`, then a `### Not raised` list.
- Re-check each line against the code at HEAD: open the cited lines, trace the scenario, look for the guard or test that would refute it (*Evidence*, *Refutation*). A line whose code is gone, whose scenario no longer holds, with no scenario at all, or that the brief lists as *Settled*, goes under *Not raised* with why: never a card.
- `In diff: no (audit)`. *Lens*: the one the defect falls under.
- A line that names a pinning test: the *Fix* says that test's expected value changes to the fixed behavior, and names the test.
- No cap of 5: one card per surviving line. *Confidence* by `counting.md` § *Confidence*, as for any card.

## Verdict (verifier)

One block per card in `{CARDS}`, in its order:

```markdown
### <card id>: CONFIRMED | REFUTED | UNSURE
- Checked: <what you looked at or ran>
- Found: <what it showed>
- Scenario: <for CONFIRMED: the concrete input and outcome>
```

- `CONFIRMED`: the refutation failed; name the scenario you traced or ran.
- `REFUTED`: name what contradicts the card (the guard, the caller's contract, the type, the test, the framework behavior, the config), with `file:line` or the command's output.
- `UNSURE`: neither. Say what would settle it.
- Never a new finding, even one you are sure of.

## Synthesis (synthesizer)

Its length and its readers: `team-protocol` § *Writers*. It holds everything the gate page and the exec brief need.

```markdown
## Review — <scope>
Owner: <own branch | someone else's (<author>) | audit>. Reviewed commit: <full SHA>. Refs: <base, start, head SHAs, for an MR/PR>.
Intent: <source> — <one line>
Author's note: <n claims | none>
Quality gates: <commands verbatim, each with its result>
Known flakes: <the brief's, or none>
Expected load: <the brief's, with its source>
Diff guard: <the brief's commands, verbatim>
Security: <seated | not seated (no trust boundary) | intake: no seats>

### Verdict
<not mergeable | mergeable after fixes | mergeable> — <the rule that decided it, with the card ids>

### Findings
[Ranked blocker → major → minor, at most ~15. Each: the card's fields in full
(title, Lens, In diff, Scenario, Evidence, Fix, Replacement when present, Severity), its seat, the
verifier's verdict with its Checked, Found and Scenario lines, and its
*Options* line, its `Tags:` line when it has one, and a `Needs: <card ids>` line when its fix assumes another finding fixed first]

### Refuted
[<card id> — one line: what refuted it, from the verdict]

### Not raised
[One line each: UNSURE cards (now med), low cards, findings over the cap,
the seats' *Not raised* lines (defects the diff did not cause, `author choice:` lines)]

### For team-refactor
[The seats' lines merged, at most ~5, by `team-protocol` § *Lane hand-offs*]
```

- **Verdicts.** `CONFIRMED` → *Findings*. `REFUTED` → *Refuted*. `UNSURE` → `med`, *Not raised*. `low` cards skip verification → *Not raised*.
- **Dedup.** Two cards on the same line → keep the more specific (error handling beats correctness for a swallowed catch), and credit both seats.
- **Rank** blocker → major → minor; within a severity, the scenario with the widest reach first.
- **Cap** at ~15 findings; the rest goes to *Not raised*. A gate with 30 findings gets rubber-stamped.
- **Verdict.** **Not mergeable** if any confirmed blocker; **mergeable after fixes** if any confirmed major; else **mergeable**.
- Copy the cards' fields; don't reword a scenario or re-rate a severity.
- **Options.** End each finding with its `Options:` line, which the gate writer and, on an auto-accept run, the record writer take as written (`team-protocol` § *Auto-accept*). One fix: `Options: fix (default) | leave`. Two (`(a)` and `(b)` on its *Fix*): `fix-a` and `fix-b`, recommending the one that keeps the behavior and data from before the change (what the base branch accepted, a saved file that still loads), e.g. `Options: fix-b (recommended: keeps 7/32 imports) | fix-a | leave`. When neither keeps them, or both do, recommend none and say why: the human picks, and auto-accept asks. A finding that contradicts what the intent, the author's note or the human stated also gets `Tags: corrects <premise>`.

## Gate page (gate writer)

Build the page by `team-ceo-view`'s `contract.md`, from the synthesis, `kind: "review"`:
- `summary`: labelled bullets *Verdict*, *Blockers*, *Not raised*, *For team-refactor*, *Recommendation*; no card counts (the renderer adds them). `source` is the review record, `.council/reviews/YYYY-MM-DD-<topic>.md`.
- **Each finding is a decision**, `id` its card id, `tags` its lens and severity, `detail` its evidence and scenario, `why` its stakes. Its options are its *Options* line: **fix** (`recommended: true`, with its `brief`), or **fix-a** and **fix-b**, each with its own `brief` and `recommended: true` only on the one the line recommends; and **leave** (`negative: true`, no brief: the human's note gives the reason). A `corrects <premise>` tag goes in `tags`.
- Blocker and major: major decisions. Minor: `minor: true`. `default` is the *Options* line's default or recommended fix, and absent when it recommends none.
- `at` on each finding: its file and line at the reviewed commit, as in its card. A `reach` finding is anchored on the changed line its *In diff* names, so its thread lands in the diff, and its `detail` names the broken caller.
- `after` from the finding's `Needs:` line.
- `suggestion`: the card's `Replacement:` line, copied.
- Threads: every finding whose line is in the diff gets its own.
- `settled`: author-intent questions on someone else's branch, `who` the seat, `answer` "asked the author"; each *Not raised* `author choice:` line, `who` the seat, `answer` the claim and the scenario it accepts.
- Refuted cards stay off the page: the record lists them.

Write the share fields by `contract.md` § *Share fields* on every review gate, whoever owns the branch. The record does not exist yet: the synthesis stands in for the review record that section says to read first. The fix briefs feed the exec brief too, so write each one for an executor who never sees the page. Render the page until it passes.

## Record and exec brief (record writer)

From the synthesis, the gate JSON's fix briefs, and the decisions block or the share block. On an auto-accept run with no page there is no gate JSON: take the human's chat answer where one was given, else each finding's default, else its recommended option, from its *Options* line, and write each Fix card from the finding's *Fix*.
- **The record**, `.council/reviews/YYYY-MM-DD-<topic>.md`, for humans and future reviews: scope, owner, intent source, status, the synthesis's *Quality gates*, *Known flakes*, *Expected load* and *Security* lines, every finding with its verifier verdict and the human's decision and note, the refuted cards with what refuted them, *Not raised*, *For team-refactor*. For an audit, each finding left is known debt with its reason, so the next audit does not reopen it.
  - Someone else's branch, or any shared gate: from the synthesis and the share block, the human's curation (declined findings with their notes) and the share line from `team-ceo-view`'s *Share*. `Status: shared`. No exec brief.
  - Own branch, audit: `Status: approved, not executed`. An auto-accept run adds *"Auto-accepted: every recommendation taken without opening the page"*.
- **The exec brief**, `.council/reviews/YYYY-MM-DD-<topic>.exec.md`, by `team-protocol` § *Writers*: its header holds the synthesis's *Quality gates*, *Known flakes* and *Diff guard*; then one Fix card per approved finding, in order: blockers first, and a finding after any finding it `needs`. Each card comes from the finding's brief and the human's note.
- **New known flakes**: append each test the synthesis lists under *Known flakes* that the profile's `## Known flakes` lacks, one line each in that section's format.
- **Corrected load**: when a human note or chat answer corrects the *Expected load*, replace the profile's `## Expected load` line with the corrected one, source `the user`.

After execution, the record is completed by `team-protocol` § *Writers*; its *Notes* count as *Not raised* lines for the next review.

## Fix card (record writer, executors)

```markdown
## Fix <id>: <defect> — <file:line>
Why: <scenario>
Test first: <the failing test to write, and the command that shows it red>
Do: <the brief's How>
Fence: <files and behaviors not to touch>. Format only the lines you change.
Verify: <commands>, then the header's *Diff guard* on the staged change: a `GUARD:` line, a staged file the card does not name or its *Fence* rules out, or a failed format check → unstage, revert, reply `stopped — <the hit>`
Commit: fix(<scope>): <defect>
On red: revert your fix, report why, go on with your next card.
```

Executors run the cards in order. For each: write the test, run it and see it fail, fix, see it pass, run *Verify*, commit test and fix together. A test that passes before the fix means the scenario does not reproduce: don't fix, reply `blocked — does not reproduce`. Two exceptions, named in the card's *Test first*: a *tests* finding, where the test is the fix and may pass at once (`Commit: test(<scope>): …`); a finding with no behavior to pin (a rename, a type annotation), `Test first: none — <why>`, where *Verify* carries the type check. A card from an intake (`HO`) whose *Fix* names a refactor's pinning test: *Test first* changes that test's expected value to the fixed behavior and shows it red, and the card names the test, so the change is announced (`team-protocol` § *Weakened checks*). When the repo's commit convention differs from the `Commit:` line, use the repo's. Reply with one line per finding: commit hash, `blocked — <reason>`, or `stopped — <the diff guard's hit>`.

## Final review (reviewer)

Rerun the quality gates from the exec brief's header, then read the full diff against the exec brief:
- each commit fixes exactly its finding, with a test that failed before it (or the exception its card names);
- nothing smuggled in: no second finding in a commit, no refactoring its finding did not ask for, no formatting outside the changed lines;
- no check weakened (`team-protocol` § *Weakened checks*); an intake fix that changes a pinning test's expected value names that test on its card;
- the *Diff guard* clean on every commit.

Tag each finding `fix` or `note`, with the finding it belongs to.

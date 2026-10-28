---
name: team-review
description: "Use when a change needs reviewing before it merges — a merge or pull request, a branch (yours or a colleague's), or an audit of a path or module for bugs, security holes, swallowed errors, missing tests, slow paths or a gap with what was asked. Also when the user asks for a code review, a security review, or whether a branch is ready to merge, and in the session that wrote a change, to leave its author's note for the review panel (a file under .council/, not the merge request's description or a comment on it). Not for restructuring code that works: team-refactor."
---

# team-review

A panel of seats (Security among them where the change crosses a trust boundary) reviews a diff, a path or a module in **isolated contexts**, a verifier tries to refute every finding before it reaches the human, and the human (CEO) curates the findings on a gate page: then shares them as a review on the merge/pull request, or has them fixed test-first. Same family as `team-refactor`: evidence-backed, attributed, recorded under `.council/reviews/`.

**Core principle:** a finding reaches the human only after an agent other than its author tried to prove it wrong. A review that cries wolf gets ignored.

**REQUIRED BACKGROUND:** follow `team-protocol` for dispatch, writers, the run folder, the agent contract, counting positions, code scope, lane hand-offs, the handoff, execution, weakened checks, the sweep and auto-accept.

## Lanes

| Skill | Question | When |
|-------|----------|------|
| `team-council` | Which way do we go? | Before the code exists |
| `team-council-plan` | How do we carry out the decision? | After a council decision, before the code |
| `team-refactor` | Is this code shaped for the next change? | Code exists; fixes preserve behavior |
| **`team-review`** | Can this change merge as is? | Code exists; fixes change behavior |

**The fix decides the lane, not the topic.** A fix that changes behavior (a bug, a hole, a swallowed error, a missing test for new or changed behavior, a gap with the request, a slow path) is review's; a characterization test of unchanged behavior is refactor's (its Step 0). A named, behavior-preserving refactoring is refactor's. A misleading name the diff introduces is review's (a one-click rename); moving or extracting code to fix it is refactor's.

**Hunting vs stumbling.** The seats hunt only in this lane. Structural trouble they stumble on goes to one *For team-refactor* list (≤ ~5 lines, in the format of `team-protocol` § *Lane hand-offs*: unverified, no decision, no extra agent), which `team-refactor <review record>` takes in. A refactor's *For team-review* list comes back the other way, through § *Intake*.

## Iron Laws

1. **A finding names a scenario, or it is not a finding.** The concrete input, state or call where it breaks, and what happens then.
2. **Only the verifier confirms.** A card its author alone believes is `med` at most, and only a `CONFIRMED` card reaches the gate.
3. **Diff scope flags only what the diff introduces or worsens.** A break the diff causes in a file it leaves untouched (a caller of a changed signature, a reader of a renamed field) is the diff's: a card, `In diff: reach`. A defect that was already there is one line in *Not raised*, never a card.
4. **Structure is refactor's.** No card for duplication, dead code, cycles or design: one line under *For team-refactor*.
5. **Fix test-first, one finding per commit.** A test that reproduces the defect fails, the fix makes it pass, one commit carries both (exceptions: `templates.md` § *Fix card*).
6. **The human submits a review; Claude never posts one.** A shared review stays pending until the human submits it.

**Violating the letter of these laws is violating their spirit.**

Laws 3 and 4 are the master text of the diff-scope and structure lines every seat file repeats (a role file is its agent's whole prompt). Change them here first, then in each seat's `roles/role-*.md`.

## The Panel

Templates in `roles/` (overridable per project, see `team-protocol`). Each role is a *lens on a body of work*, not an impersonation.

| Role | Sources (a sample; all in the role file) | Signature question | Owns |
|------|-------|--------------------|------|
| **Correctness** (`role-correctness.md`) | Hoare, Dijkstra, Nygard, Armstrong | "Does it work, and when it fails, does it show?" | Correctness, error handling |
| **Security** (`role-security.md`) | OWASP, Saltzer & Schroeder, Shostack, CWE Top 25 | "Is it exploitable?" | Security, when the brief lists a trust boundary |
| **Intent** (`role-intent.md`) | Adzic, North, Beck, DeMillo et al. | "Is it what was asked, and is it pinned?" | Intent conformance, tests |
| **Craft** (`role-craft.md`) | Minsky, King, Gregg, Knuth, Kernighan & Pike | "Does it fit this code?" | Types, performance, conventions |
| **Verifier** (`role-verifier.md`) | Popper, Feynman | "What would prove this card wrong?" | **The refutation** |

Card IDs carry the seat's prefix: CR, SE, IN, CF, and HO for an intake card (§ *Intake*); the verifier's verdicts are keyed by card id.

## Separation of Context

Every agent gets the minimum it needs (`team-protocol` § *Dispatch*). `templates.md` (copied into the run folder, see `team-protocol`) holds what each one writes.

**The session that wrote the code has no voice.** It sits on no seat, answers no seat, and does not run the review: its certainty is the bias the verifier exists for, and its context would be re-read on every dispatch. What it knows that the diff, the commits and the MR/PR don't say reaches the panel through one file, `.council/author-notes/<branch>.md` (`/` in the branch name → `-`), which it writes as its last step:

```markdown
# Author's note — <branch>
Intent: <what the change is for, in the user's words where there was a request>
Choices:
- <file:line> — <the choice> — <why, and what it trades away>
Gaps:
- <what is knowingly left undone or deferred, and where it is tracked>
Checked by hand:
- <what was verified outside the tests, and how>
```

~20 lines at most, only what the diff and the commit messages don't already say. Claims, not a defense: no "this is safe", no "already reviewed". Recon copies it into the Review Brief as claims; the seats check the code against them; the verifier never sees it (`templates.md` § *Review Brief*, § *Finding Card*).

| Agent | Type | Model | Tool budget | Receives | Writes by `templates.md` |
|-------|------|-------|-------------|----------|--------------------------|
| Recon | analyst | sonnet | ~30 | scope, profile | *Review Brief* |
| Recon (intake) | analyst | sonnet | ~30 | the refactor records, profile | *Review Brief*, then *Intake cards* |
| Seat ×3–4 (R1) | analyst | sonnet | ~15 | role file + Review Brief | *Finding Card* |
| Verifier | judge | opus (sonnet if all minor) | ~3 per card | `{CARDS}` + read access to the code | *Verdict* |
| Synthesizer | analyst | sonnet | ~10 | cards + verdicts + the Review Brief | *Synthesis* |
| Gate writer (none on an auto-accept run on your own branch or an audit) | maker | sonnet | ~12 | the synthesis | *Gate page* |
| Record writer | maker | sonnet | ~8 | the synthesis + the gate's fix briefs + the decisions or share block (auto-accept, no page: the synthesis + the chat answers) | *Record and exec brief* |
| Executor | maker | sonnet | — | **one** batch of Fix cards + the exec brief's header | *Fix card* |
| Final reviewer | judge | opus | — | full diff + exec brief | *Final review* |

The verifier receives each card's title, location, scenario and fix — never its Evidence or Refutation lines. Put this line first in each seat's *How to work* block: `- Start from the Review Brief. Open a file only to confirm or cite evidence. Before a test-gap card, grep the specs for the behaviour; before a convention card, check the line is added by the diff.` Seats and the verifier also get `team-protocol`'s *leave the project tree as you found it* line.

## Flow

```
0. Preconditions   → scope, whose branch, profile
1. Recon           → Review Brief (one agent)
2. Round 1 (blind) → 3–4 seats in parallel → Finding Cards │ intake: Recon's HO cards, no seats
3. Verification    → the verifier tries to refute each high/med card
4. Synthesis       → dedup, rank, cap, verdict, options
5. Gate            → team-ceo-view page (kind "review") │ auto-accept on own branch or audit: no page
6. Deliver         → someone else's branch: share a review │ own branch, audit: fix test-first
```

### 0. Preconditions
- **Scope**: a diff (a branch, an MR/PR), a path or module, the whole repo, or one or more refactor records (§ *Intake*), sized by `team-protocol` § *Code scope*, counting changed lines. To narrow it, Recon ranks zones by churn × complexity × exposure, one option per zone, plus "all of them" (one panel per zone, one page, by `team-protocol` § *Sweep*). Resolve the forge's head first (`glab mr view` / `gh pr view`: the head SHA) and review that commit; when the local branch differs, say so on the first line and offer to align it. Someone else's branch goes in a separate worktree (`git -C <repo> worktree add <path> <branch>`), not by switching the user's checkout; a dirty tree is never stashed or touched.
- **This conversation wrote or edited code in scope?** Then it does not review it: write the author's note (§ *Separation of Context*), and hand off (`team-protocol` § *Handoff*) with the prompt `team-review <scope>`.
- **Owner**: `git -C <checkout> log --format=%ae <base>..HEAD | sort -u` against `git -C <checkout> config user.email`. Only yours → own branch; none yours → someone else's; mixed, or a shared account → ask. A path or module → audit.
- **MR/PR**: take the host from `git -C <checkout> remote get-url origin` (`<origin URL>`). GitHub: `gh pr view <branch> -R <owner/repo> --json number,headRefOid,baseRefName`; GitLab: `glab mr view <branch> -R <origin URL> --output json` (the `iid`). Then get its refs and diff by loading `team-ceo-view` (Skill tool) and using its *Share* → `as: review` → *Refs and diff*, writing the diff to the run folder instead of `$TMPDIR`. Recon reads them from there.
- **Profile**: read `.council/project-profile.md` if present; offer `team-scan` if not (not required).
- **Red tests do not block.** Recon records them; they become a finding.

### 1. Recon → Review Brief
One agent writes the brief by `templates.md` § *Review Brief*, following the Recon rules of `team-protocol` § *Code scope*. Long gates (integration, E2E) go to their own sonnet agent; only the verifier and synthesizer read its result. If the brief says *Intent: none found*, ask the user what the change is for and append the answer to the brief before Round 1.

### 2. Round 1 — blind seats (parallel)
Dispatch the seats in one message, agent ids `seat-correctness`, `seat-intent`, `seat-craft`, and `seat-security` unless Recon's reply gives *Trust boundaries: none* (§ *Proportionality*). In each prompt, resolve the role template's placeholders: `{PROJECT_PROFILE}` → the profile path (or "none"), `{SCOPE}` inline, `{REVIEW_BRIEF}` → the brief's path, `{FINDING_CARD_FORMAT}` → `templates.md` § *Finding Card*.

### 3. Verification
Strip the cards of their reasoning without reading them: `sh <base directory>/cards.sh <run folder>` keeps each `high` and `med` card's title, *Scenario* and *Fix* from the `seat-*.md` files into `<run folder>/cards.md`, drops `low` cards, and prints `cards ok: <n>` or `MISMATCH: …`. On `MISMATCH`, stop: re-dispatch that seat (or a fresh agent to repair its file), then rerun the script. On `cards ok: 0` there is nothing to verify: skip to Synthesis. Otherwise dispatch one verifier for all zones, after the last zone's seats, with `{PROJECT_PROFILE}`, `{SCOPE}` and `{CARDS}` → `cards.md`. It writes one verdict per card by § *Verdict*: `CONFIRMED`, `REFUTED` or `UNSURE`.

### 4. Synthesis
A separate synthesizer agent writes the review by `templates.md` § *Synthesis*: dedup, rank, cap, verdict.

### 5. Gate
**REQUIRED SUB-SKILL:** `team-ceo-view`. The gate writer builds and renders the page by § *Gate page*; it is share-ready whoever owns the branch. Serve it with `--channels` as team-ceo-view's SKILL.md step 3 says. On an auto-accept run on your own branch or an audit, no gate writer runs: the synthesis carries every finding's options (`team-protocol` § *Auto-accept*).

### 6. Deliver
**Someone else's branch.** The human curates on the page (declines false positives, adds notes), then clicks **Share → Review**: follow team-ceo-view's *Share*. An `auto-accept` run (`team-protocol` § *Auto-accept*) does not change this: the gate still goes to its owner. A declined finding is not posted; the review body carries the verdict, *Not raised* and *For team-refactor*. When you tell the human to submit, suggest *Request changes* when the verdict is not mergeable or mergeable after fixes, else *Comment*. The record writer writes the record from the synthesis and the share block, `Status: shared`; no exec brief, no execution. Delete the run folder and the author's note.

**Own branch, audit.** Read the decisions block (team-ceo-view steps 4–5), or on an auto-accept run, the synthesis (`team-protocol` § *Auto-accept*). The record writer writes the record and the exec brief. When the page returns a share block instead of a decisions block, proceed as for someone else's branch: follow team-ceo-view's *Share*; the record writer records `Status: shared`; no exec brief, no execution. Otherwise hand off (`team-protocol` § *Handoff*), whatever the number of fixes, with the prompt `execute the review fixes in <exec brief path>`.

**Execute** by `team-protocol` § *Execution*, from the exec brief, on a clean tree. The steps are the Fix cards; each executor (sonnet) gets its batch's Fix cards and the exec brief's header. Each fix goes test-first (`superpowers:test-driven-development`, or the profile's TDD skill when it lists one), one commit per finding; the executor replies one line per finding: the commit hash, `blocked — <reason>` or `stopped — <the diff guard's hit>`. After each batch, run the exec brief's quality gates: red → `git revert` that fix's commit yourself (a revert is not a patch), report it, and go on with the next batch.

Last, the final reviewer runs § *Final review*. Its `fix` findings go to fresh executors as `fixup!` commits of their finding's commit (`team-protocol` § *Execution*), each with the Fix card it names. Complete the record (`team-protocol` § *Writers*); its *Notes* count as *Not raised* lines for the next review. Delete the exec brief, the run folder and the author's note. Every later Recon reads this record (`team-protocol` § *Code scope*): an audit's known debt is not reopened.

Then name the next step. In a sweep, its next command (`team-protocol` § *Sweep*). Otherwise, when the record's *For team-refactor* list is not empty, hand off (`team-protocol` § *Handoff*) with the prompt `team-refactor the For team-refactor lines of <record path>` (team-refactor § *Intake*); when it is empty, say so in one line.

## Intake

`team-review <refactor record>…` reviews what one or more refactor records list *For team-review* (`team-protocol` § *Lane hand-offs*), as an audit of the lines they name, once those refactors are executed: a *pinned by* test exists only after Step 0 runs. No seats sit: the refactor panel already raised these lines, and the seats would rediscover them at full price.

1. **Recon** writes the Review Brief for the files the lines name, at HEAD, then one Finding Card per line by `templates.md` § *Intake cards*. Recon always runs on an intake: it writes the cards. Its reply gives the number of cards and of lines dropped.
2. **Verification**, **Synthesis**, **Gate** and **Deliver** as above: `cards.sh` reads `seat-handoff.md` like a seat's file.

A Fix card from an intake card that names a refactor's pinning test changes that test's expected value to the fixed behavior, and says so: an announced change is not a weakened check (`team-protocol` § *Weakened checks*).

## Proportionality

By `team-protocol` § *Code scope*, counting changed lines, the brief being the Review Brief (`templates.md` § *Review Brief*). Outside an intake run (no seats), Correctness, Intent, Craft and the verifier always run: a small diff is where a confident wrong finding costs the most trust. Security sits when the brief lists a trust boundary, whatever the size. With `none` it does not sit, and the record says `Security: not seated (no trust boundary)`: a seat with nothing to attack only adds noise.

## Rationalizations

The shared ones are in `team-protocol`. These are the review's own.

| Excuse | Reality |
|--------|---------|
| "The seat is sure, skip the verifier" | The author's certainty is the bias the verifier exists for. |
| "I wrote this code, I'll review it here: I have the context" | That context is the code author's certainty, and every dispatch would re-read it. Write the author's note, then hand off. |
| "The author's note explains it, drop the card" | A note is a claim. A choice whose scenario still breaks stays a card that names the claim. |
| "It's pre-existing but bad, flag it" | Diff scope: once in *Not raised*, never a card. |
| "The broken caller is in a file the diff doesn't touch: *Not raised*" | The diff broke it. A card, `In diff: reach`, anchored on the changed line. |
| "Two requests at once would race here" (a one-user CLI) | Judge against the brief's *Expected load*. A race that load never reaches is *Not raised*. |
| "This function does too much, it's a finding" | Structure is refactor's: *For team-refactor*. |
| "Post the review, the human will read it anyway" | The human submits; Claude never posts a review. |
| "Fix it while we're there" (someone else's branch) | Their branch, their call: share, don't push. |
| "The tests are red, stop the review" | Red is a finding, not a blocker for the review. |
| "The fix is obvious, the test can come after" | A test written after the fix never failed: it proves nothing about the defect. |
| "The verifier was unsure, but I'd keep it" | `UNSURE` goes to *Not raised*. The gate shows only what survived a refutation. |
| "Only two fixes, I'll run them here" | The gate's session holds the whole review, and every executor dispatch re-reads it. Own branch and audit always hand off. |
| "No trust boundary is listed, but run Security to be safe" | Recon lists one when in doubt. With `none`, the seat has nothing to attack. |
| "Intake: dispatch the seats too, they might find more" | The refactor panel already stumbled on these lines. Recon writes their cards; the verifier settles them. |
| "Both fixes work; the gate writer can pick" | One may drop data the base branch accepted. The synthesis recommends the one that keeps it, or none, and then the human picks. |

## Red Flags — stop and re-read the laws

- A card without a scenario
- A card marked `high` that the verifier never saw
- A thread on a line outside the diff
- A caller the brief's *Reach* marks broken, filed under *Not raised*
- A race or scale card whose scenario names no load
- A review posted (not pending)
- A fix commit carrying two findings, or a refactoring its finding did not ask for
- A behavior fix whose test passed before the fix
- Reading a seat's file to "help" the verifier
- A review run in the conversation that wrote the code
- A seat or verifier prompt carrying the code author's reasoning, or the verifier given the author's note
- Security not seated while the brief lists a trust boundary
- An intake run that dispatched seats
- A Fix card that changes a refactor's pinning test without naming it
- A finding with two fixes whose *Options* line recommends neither, auto-accepted without asking

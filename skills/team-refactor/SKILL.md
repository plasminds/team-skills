---
name: team-refactor
description: "Use when code needs refactoring or cleanup, or its structure judged — god functions, tangled responsibilities, duplication, over-engineering, legacy code without tests, or code that resists the next change. Also when the user invokes Uncle Bob, Fowler, Beck, Feathers, Ousterhout, SOLID, KISS, YAGNI or clean code on existing code. Not for bugs, security or whether a change can merge: team-review."
---

# team-refactor

A panel of refactoring lenses reviews a scoped piece of code in **isolated contexts**, a KISS/YAGNI gate kills speculative work, the human (CEO) approves a backlog, then execution happens in tiny behavior-preserving steps. Same family as `team-council`: evidence-backed, attributed, recorded under `.council/`.

**Core principle:** refactoring changes structure, never behavior. Everything else in this skill protects that line or keeps the refactoring from becoming its own over-engineering.

**REQUIRED BACKGROUND:** follow `team-protocol` for dispatch, writers, the run folder, the agent contract, counting positions, code scope, lane hand-offs, structural choices, the handoff, execution, weakened checks, the sweep and auto-accept.

## Iron Laws

1. **Behavior-preserving only.** Any observable change — outputs, rounding, error types, side effects, call order, emails, logs relied on — is a *For team-review* item. It is never a backlog step, even if the user said "fix it while you're there" or "whatever, make it clean".
2. **No safety net, no refactor.** Code the step touches must be pinned by tests first, and the tests must be proven to bite (see Step 0). Characterization tests of unchanged behavior are this skill's work; a missing test for new or changed behavior is team-review's.
3. **One named refactoring per commit.** Structure and behavior never share a commit (Beck, *Tidy First*).
4. **Red means revert.** A failing gate after a step → `git checkout` the step, shrink it, retry. Never debug forward.
5. **An abstraction needs a present second case.** Roadmap talk ("we plan to add providers"), TODOs, and "might" are not cases. Two real call sites today, or it doesn't exist.
6. **Stay inside the approved scope.** No drive-by edits outside the files and steps the CEO approved.

**Violating the letter of these laws is violating their spirit.**

## The Panel

Templates in `roles/` (overridable per project, see `team-protocol`). Each role is a *lens on a body of work*, not an impersonation.

| Role | Sources (a sample; all in the role file) | Signature question | Owns |
|------|-------|--------------------|------|
| **Responsibilities** (`role-responsibilities.md`) | Martin, Liskov, Meyer, Wirfs-Brock | "How many reasons does this have to change?" | Responsibilities, naming, contracts, dependency direction |
| **Mechanics** (`role-mechanics.md`) | Fowler, Opdyke, Metz & Owen, Lawall | "Which smell, and which named refactoring removes it?" | Vocabulary, mechanics |
| **Sequencing** (`role-sequencing.md`) | Beck, Descartes, Ohno, the Mikado Method | "What change is coming, and what tidying makes it easy?" | Sequencing, step size |
| **Safety Net** (`role-safety-net.md`) | Feathers, Bache, mutation testing, Claude Bernard | "How do we get this under test before we touch it?" | Safety net, seams |
| **Depth** (`role-depth.md`) | Ousterhout, Parnas, Hermans, Simondon | "Is the interface simpler than what it hides?" | Depth; counterweight to over-splitting |
| **Minimalist** (`role-minimalist.md`) | Jeffries, Metz, Saint-Exupéry, Wirth, Ockham | "What breaks if we don't do this?" | **The gate** |

Card IDs carry the panelist's prefix: RS, MC, SQ, SN, DP, and MN for the Minimalist.

### Panel size

On fresh code, the panel is **Mechanics, Depth and Safety Net**, and the Minimalist sits only as the Round 2 gate. Fresh means the current branch added more than half the lines in scope (the *Fresh* line of Recon's reply). All six sit when the code is not fresh, when the scope comes from a review record (§ *Intake*), or when the human asks. On fresh code, five or six of the six name the same top smell; these three cover the vocabulary, the depth and the safety net.

## Separation of Context

Every agent gets the minimum it needs (`team-protocol` § *Dispatch*). `templates.md` (copied into the run folder, see `team-protocol`) holds what each one writes.

| Agent | Type | Model | Tool budget | Receives | Writes by `templates.md` |
|-------|------|-------|-------------|----------|--------------------------|
| Recon | analyst | sonnet | ~30 | scope, profile | *Code Brief* |
| Panelist (R1), 3 or 6 (§ *Panel size*) | analyst | sonnet | ~15 | role template + Code Brief | *Finding Card* |
| Minimalist gate (R2) | judge | opus | ~10 | all Finding Cards | its role file's *Round 2 Job* |
| Tension pair (R2) | analyst | sonnet | ~5 | own + counterpart's cards only | one direct reply |
| Synthesizer | judge | opus | ~10 | cards + verdicts + tension replies | *Synthesis* |
| Gate writer (none on an auto-accept run) | maker | sonnet | ~12 | the synthesis | *Gate page* |
| Record writer | maker | sonnet | ~8 | the synthesis + the Code Brief + the decisions block (auto-accept: the chat answers) | *Record and exec brief* |
| Executor | maker | sonnet | — | **one** Step Batch + the exec brief's header | *Step Card* |
| Final reviewer | judge | opus | — | full diff + exec brief | *Final review* |

Put this line first in each panelist's *How to work* block: `- Start from the Code Brief. Open a file only to confirm or cite evidence.`

## Flow

```
0. Preconditions   → scope, clean tree, green tests, profile
1. Recon           → Code Brief (one agent)
2. Round 1 (blind) → the panel in parallel (3 or 6) → Finding Cards
3. Round 2         → Minimalist gate on every card + tension pairs
4. Synthesis       → Backlog + For-team-review + Rejected + Tensions
5. CEO gate        → approves steps (auto-accept: no page); record + exec brief
   ── fresh session ──
6. Execute         → from the exec brief: Step 0 safety net, then one Step Batch per fresh executor
7. Record          → .council/refactors/YYYY-MM-DD-<topic>.md
```

### 0. Preconditions
- **Scope**: a path, module, or diff, or one or more review records (§ *Intake*), sized by `team-protocol` § *Code scope*, counting the lines in scope. To narrow it, Recon ranks hotspots by churn × complexity, with the smells it sees; each option also names its main smell, and one more option is "all of them, by `team-protocol` § *Sweep*" (each zone reviewed first, refactored where its review asks). When the scope is a diff (a branch, a merge request), the panel flags only smells the diff introduces or worsens. A smell in code the diff leaves untouched is listed once under *Leave alone*, never a card.
- **Clean working tree** (`.council/` excepted; the record is committed alongside Step 0) and a **green test run**.
- **No pending review fixes**: a review record on this scope with `Status: approved, not executed` is executed first (`team-protocol` § *Sweep*). Step 0 pins behavior as it is; it must pin the fixed one.
- **Profile**: read `.council/project-profile.md` if present; offer `team-scan` if not (not required).
- **Proportionality**: size the Code Brief (`templates.md` § *Code Brief*) by `team-protocol` § *Code scope*. The panel (§ *Panel size*) and the gate always run. A scope small enough that you write the brief yourself also runs at most 2 tension pairs.

### 1. Recon → Code Brief
One agent writes the brief by `templates.md` § *Code Brief*, following the Recon rules of `team-protocol` § *Code scope*.

### 2. Round 1 — blind panel (parallel)
Dispatch the panel (§ *Panel size*) in one message. In each prompt, resolve the role template's placeholders: `{PROJECT_PROFILE}` → the profile path (or "none"), `{SCOPE}` inline, `{CODE_BRIEF}` → the brief's path, `{FINDING_CARD_FORMAT}` → `templates.md` § *Finding Card*.

### 3. Round 2 — gate and tensions (parallel)
- **Minimalist gate**: `{ALL_FINDING_CARDS}` → the panelists' files. It returns `KEEP`, `SHRINK` or `KILL` per card and lists the cards independent panelists found. Its `KILL` is a gate, not a vote. A `KILL — behavior change` sends the card to *For team-review* (`templates.md` § *Synthesis*).
- **Tension pairs**: where two cards conflict (same code, opposite moves), send each side the other's card for one direct reply. Agreeing roles skip.

### 4. Synthesis
A separate synthesizer agent writes the backlog by `templates.md` § *Synthesis*, caps included.

### 5. CEO gate
**REQUIRED SUB-SKILL:** `team-ceo-view`. The gate writer builds and renders the page by § *Gate page*; you serve it and read the decisions block. On an auto-accept run no gate writer runs: the synthesis carries every item's options (`team-protocol` § *Auto-accept*). The CEO approves steps (all, some, or edits). Suspected bugs are listed for team-review, never decided here.

Then the record writer writes the record and the exec brief, and you hand off (`team-protocol` § *Handoff*) with the prompt `execute the refactor in <exec brief path>`.

### 6. Execute
Execute by `team-protocol` § *Execution*, from the exec brief. The steps are the approved Step Cards, sized S, M or L; each executor gets its batch's Step Cards and the exec brief's header.

**Step 0 — safety net** (Safety Net): add characterization tests for every unpinned behavior the approved steps touch, run them green against the *untouched* code, then prove they bite: break the code deliberately (flip a rounding, a comparison, a constant), confirm a test fails, restore. Commit `test: characterize <scope>`.

Then group the approved steps into **Step Batches** and dispatch a fresh executor per batch (`team-protocol` § *Execution*). It commits each step on its own, so Iron Laws 3 and 4 still hold per step.

Last, the final reviewer runs § *Final review*. Its `fix` findings go to fresh executors as `fixup!` commits of their step (`team-protocol` § *Execution*), each with the Step Card it names.

### 7. Record
Complete the record (`team-protocol` § *Writers*); its *Notes* that suspect a bug are *For team-review* lines, for the next intake. Delete the exec brief and the run folder: anything worth keeping is in the record by now. Every later Recon reads it (`team-protocol` § *Code scope*).

Then name the next step. In a sweep, its next command (`team-protocol` § *Sweep*). Otherwise, when the record's *For team-review* list is not empty, hand off (`team-protocol` § *Handoff*) with the prompt `team-review the For team-review lines of <record path>` (team-review § *Intake*); when it is empty, say so in one line.

## Intake

`team-refactor <review record>…` refactors what one or more review records list *For team-refactor* (`team-protocol` § *Lane hand-offs*). The scope is the files those lines name, with their callers in the same package. Recon's Code Brief puts the lines first in *Hotspots*, ahead of churn, and the full panel sits (§ *Panel size*). A line a past refactor record settled (*Settled*) goes to *Leave alone*. Run it once that review's fixes are executed (see *Preconditions*).

## Rationalizations

The shared ones are in `team-protocol`. These are the refactor's own.

| Excuse | Reality |
|--------|---------|
| "The user plans more providers, so an interface now is cheap" | One data point is a guess at an API. When the second one arrives you'll know its shape; adding the seam then costs the same. |
| "One file per concern is SRP" | Splitting 50 lines into 4 files creates shallow modules. SRP is about reasons to change, not file count. |
| "They said 'whatever, make it clean', so I can fix the rounding" | A vague aside isn't a decision on customer-facing money. Surface it, don't make the call. |
| "The tests pass, so it's safe" | Two tests on one branch pin nothing. Check the coverage map. |
| "This step is tiny, I'll fold it into the next commit" | Folded steps lose the ability to revert one cleanly. Batch steps in one executor, never in one commit. |
| "Parameterize and move are one gesture" | Two refactorings are two steps and two commits, so each one can be reverted alone. |
| "It went red, I'll just fix the test" | The test is the spec. Revert the step. |
| "It passed on a rerun, it's a flake" | `team-protocol` § *Execution*, *Known flakes*: only a listed flake passes a rerun. Any other red reverts. |
| "The linter trips on the moved code; one `eslint-disable` and it's green" | That is a weakened check (`team-protocol` § *Weakened checks*): it lowers the bar the step is measured against. Revert, shrink the step, retry. |
| "These two copies look alike; merging them is a dedup" | Copies that behave differently (a fallback, an error type, a branch) are two behaviors. Merging them changes one: a *For team-review* line, never a step. |
| "Fresh code, but run all six to be thorough" | Three lenses plus the gate cover it (§ *Panel size*); a review hand-off earns six. |

## Red Flags — stop and return to the flow

- Writing an interface, base class, registry or plugin point with one implementation
- A commit message containing "and"
- Changing an expected value in an existing test
- A weakened check (`team-protocol` § *Weakened checks*), or a `TODO` where moved code used to be
- Editing a file outside the fence
- Reasoning "they'll need this later"
- A step that merges copies the Minimalist never compared
- Refactoring code whose review fixes are approved but not executed

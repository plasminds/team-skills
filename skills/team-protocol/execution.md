# Execution

For a caller whose approved work is carried out by executor agents, in the fresh session the handoff opened. The caller keeps its step format, the brief its executors start from, and what a red batch does.

- **Start from the exec brief** (a plan, for team-council-plan) the handoff named. Don't read the record or an earlier run folder. Copy the caller's `templates.md`, and this skill's `SKILL.md` as `team-protocol.md`, into a fresh run folder first (§ *Dispatch*), before you or any agent reads a section of either: you read the copies too.
- **Batches.** Group the approved steps into batches: consecutive steps, in the brief's order, that touch overlapping files, at most 4 per batch. When the caller sizes its steps, only S steps share a batch; an M or L step is a batch of one.
- **A fresh executor per batch** (`maker`), given its batch and the header its caller names, never the record. It commits each step on its own.
- **Diff guard.** Before each commit, the executor runs its exec brief's *Diff guard* (§ *Code scope*) on the staged change. A suppression comment added, a staged file the card's *Fence* rules out or one its card does not name, or the format check failing on a file not listed *Unformatted* → unstage, then revert the step or fix the hit, and reply `stopped — <the hit>`. Never work around it: the guard exists because a fence's words alone get ignored.
- **Known flakes.** A red that passes on an isolated rerun counts as green only when the exec brief's header lists that test as a known flake. Any other red follows the caller's rule for a red step.
- **Parallel runs.** Two exec briefs whose fences share no file may execute at once, each in its own worktree branched from the same commit. Create each worktree yourself (`superpowers:using-git-worktrees`, or `git -C <repo> worktree add <path> -b <branch> <commit>`) and give its path to every executor of that run: the batch rule holds inside it, a fresh `maker` per batch. Never the Agent tool's `isolation: "worktree"`: it gives one agent its own worktree, so that one agent runs the whole brief and its context grows with every step. When both are done, rebase each onto the target branch in the order their records were approved, rerun the header's gates after each rebase, then autosquash. A rebase conflict stops the later run: report it, don't resolve it.
- **A final reviewer on opus** (`judge`) reads the whole diff against the brief after the last batch, and tags each finding `fix` or `note`.
- **Fixes as `fixup!` commits.** Every `fix` finding goes to a fresh executor with the reviewer's report and the step it names. It commits the fix as a `fixup!` of that step's commit, so `git rebase --autosquash` folds it in before the push. A fixup that touches only formatting, comments or test names gets no re-check; its *Execution* line says so. Any other fixup gets a fresh opus re-check (`judge`) of that fixup's diff alone, against its finding.
- **A failing re-check.** A fixup and its re-check are one attempt. A failed re-check sends its finding to one more fresh executor for a second fixup, re-checked the same way. A second failed re-check of the same finding ends the attempts. Flip the record's `Status:` line to `stopped — fixup re-check failed twice` at once, with no *Execution* section yet. Print the message below, with the finding in one line, and halt the whole execution, every parallel run included: no further fixup, no autosquash, no squash, no record completion, until the human answers. Retry goes back to a fixup with the human's guidance. Keep leaves the step's commits as they stand and lists the finding under *Reverted or blocked* as `kept — fixup re-check failed twice`. Drop reverts the step and its fixups and lists the finding there too. Either then resumes what the halt held: the remaining fixups, then the autosquash, the squash and the record.

  ```
  stopped — fixup re-check failed twice: <the finding, one line>
  Branch: step commits kept, fixups not squashed, nothing squashed or pushed.
  Answer with one of:
  - retry: one more fixup, with your guidance.
  - keep: keep the commits as they stand; go on to autosquash, squash and record.
  - drop: revert the item's step and its fixups; record it under *Reverted or blocked*.
  ```
- **Squash** after the autosquash, before the record is completed, as the profile's *Run preferences* `Squash after execution` line says (`team-scan`): `branch` folds every commit since the merge-base with the target branch into one, `run` folds this run's commits into one, `none` leaves them. With no line, ask once (AskUserQuestion, those three options) and record the answer as that line. A commit already pushed is rewritten only on a yes asked then, whatever the line says. The message follows the project's commit convention and lists the run's items; the record's *Commits* lines then name the squash commit.
- **Never patch code yourself.** Don't fix or dismiss a finding, and don't edit a file between batches: your context is the most expensive one in the run.

## Sweep

When the human asks to review and refactor a whole branch or several zones at once (a phase end, a release), or picks the *all of them* option when a scope is narrowed:

1. **Review each zone** with team-review. Two zones may go through to their gates together, one run folder and one record each.
2. **Execute each zone's review fixes** before that zone is refactored. A refactor's Step 0 pins behavior as it is; it should pin the fixed one.
3. **Refactor only where a review asks:** `team-refactor <review record>` for each review record whose *For team-refactor* list is not empty. A zone with none is not refactored; say so in one line.
4. **One intake review**, once the refactors are executed, of every refactor record's *For team-review* list: `team-review <refactor record>…`.

Each step is its own run, with its own gate and handoff (§ *Handoff*); the records carry the sweep from one run to the next. Exec briefs whose fences share no file may execute in parallel (§ *Execution*). At the end of each step, the last message names the sweep's next command (e.g. `team-refactor <review record>`, or "zone X has no For team-refactor lines: next zone").

## Weakened checks

A change weakens a check when it brings any of these:
- a lowered threshold;
- a skipped or deleted test;
- a removed assertion;
- an existing test's expected value changed without the finding or step saying so;
- a new `@ts-ignore`, `eslint-disable` or coverage-ignore comment;
- a stub or an empty `catch` where the work should be.

A caller writes "no check weakened (`team-protocol` § *Weakened checks*)" and adds its own items. A final reviewer fails a diff that holds one.

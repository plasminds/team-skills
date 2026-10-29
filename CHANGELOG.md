# Changelog

What each version of team-skills changed, newest first.

## 0.18.2 — 2026-10-29

- **A bound on the fix loop.** `team-protocol` § *Execution* counts a fixup and its re-check as one attempt per finding, and allows two. After a second failed re-check, the record's `Status:` becomes `stopped — fixup re-check failed twice`, every run halts, and the human answers retry, keep or drop.
- **A launch line in the profile.** team-scan writes how the project starts its app under `## Conventions`, as `- Launch: <command> — <file:line>` or `- Launch: none found`, re-detected on every rescan. Nothing runs it.

## 0.18.1 — 2026-10-29

- **Plans go where the project keeps them.** The profile's *Run preferences* gain `Plan location`: team-scan records the folder that already holds plans, else `.council/plans/`. Gate sketches are copied next to the plan only when its folder is tracked; otherwise the plan links them.
- **References are checked.** `test/skills/refs.test.js` fails on a `§` reference to a missing heading, a broken README link, or a skill missing from the README table.

## 0.18.0 — 2026-10-28

- **Run preferences.** The profile gains `## Run preferences` (`Commit records`, `Oversized scope`, `Squash after execution`, `Next step`). A run follows the line instead of asking, and the first answer to a question with no line becomes the line.
- **Squash after execution.** Execution squashes after the autosquash, as `Squash after execution` says (`branch`, `run` or `none`). Pushed commits are rewritten only on an explicit yes.
- **A handoff to paste, or to launch.** The handoff ends with the next prompt alone in a code block, ready to paste. With `Next step: launch`, it also starts that prompt in a new detached session, which stops when it needs the human.
- **The next step after execution.** After review fixes, team-review hands off to team-refactor when its *For team-refactor* list is not empty; team-refactor does the same toward team-review.
- **Fewer questions the ticket could answer.** The council's framing reads the ticket or MR it was given, and a new variant starts from how the existing one works. Agents look there before asking.
- **Parallel executions stay batched.** The orchestrator creates each worktree itself and dispatches a fresh `maker` per batch inside it.
- **A profile for every worktree.** team-scan and its callers copy the newest profile from a sibling worktree when theirs is missing.
- **The author's note is not the MR note.** team-review's description says the author's note is a file under `.council/`, not the merge request's description.
- **team-protocol** stays under 16,000 bytes: rationalizations and a red flag that restated rules written elsewhere are gone.

## 0.17.0 — 2026-10-23

- **Dedicated agents.** Three agents ship in `agents/`: `team-analyst` (Sonnet, no Edit) for Recon, roles, seats and plan reviewers; `team-judge` (Opus, no Edit) for verifiers, syntheses and final reviews; `team-maker` (Sonnet) for writers and executors. Each dispatch table gains a `Type` column, and a call that forgets its `model` falls back to the agent's own instead of the session's.
- **team-protocol trimmed** back under 16,000 bytes, wording only.

## 0.16.3 — 2026-10-23

- **How it gets done.** The evidence pane shows the option's brief (files touched, steps, verify command, commit) under *How it gets done*, so the CEO sees the mechanics before choosing. team-refactor writes briefs for its steps too.
- **The stakes reach the prompt.** Copied prompts on a share page carry each finding's `why`.
- **One choice, one fix.** `--share` rejects a card whose options lead to work without a brief each.

## 0.16.2 — 2026-10-23

- **Biz, not Business.** The page labels the business lens *Biz*. The JSON key stays `business`, so existing gates render unchanged.

## 0.16.1 — 2026-10-23

- **List marks on the first line.** A row's status mark is centred on the first line of its title, whatever the font.

## 0.16.0 — 2026-10-22

- **The author's note (team-review).** The session that wrote a change leaves a short note in `.council/author-notes/<branch>.md` (intent, deliberate choices, known gaps) and hands the review to a fresh session. Its claims reach the brief but never the verifier; a choice the note accepts goes to *Settled without you*, where the CEO can reopen it.

## 0.15.0 — 2026-10-22

- **Evidence per option.** An option or a tension side can carry its own code, metrics, figures and `accepts`. The evidence pane shows the chosen option's, and an *Evidence for* picker shows another's without choosing it.
- **Accepts follows the choice.** It shows the chosen option's cost, not always the recommended one's.
- **An outcome can follow a card.** `outcome[].on` shows an entry only for some answers of a card.
- **First click on an option no longer lost** when the key legend wrapped.
- **Three sides stack** one under the other.

## 0.14.2 — 2026-10-22

- **Figures readable again.** The colours `figures.md` gives figure authors are defined again, and a test checks them.
- **Web links in text.** Markdown links and bare `http(s)` URLs render as links.

## 0.14.1 — 2026-10-22

- **The gate page opens on the summary**, the first row of the list. A card named in the address (`#d-ID`) still opens first.

## 0.14.0 — 2026-10-21

- **File links on gate pages.** A repo file the page names becomes a link that opens it in your editor at that line; a GitHub or GitLab logo beside it opens it on the remote. The shared page links the remote only.

## 0.13.1 — 2026-10-21

- Agents read run-folder files with the Read tool instead of `cat`, which avoids permission prompts.

## 0.13.0 — 2026-10-21

The gate page is redesigned as a decision console.

- **Three panes:** the list of cards, the current card with its arguments and your choice, and its evidence.
- **Rails** in the list show which card refines or needs another; search and a filter sit above it.
- **Lenses:** a *Both | Business | Tech* switch narrows the evidence.
- **One meaning per colour:** amber for the recommendation, green for your choice, red for blockers.
- **Keyboard first:** every action has a key, and `?` lists them.
- Dark only; tabs on phones.

## 0.12.0 — 2026-10-21

- **team-review: breakage outside the diff.** Recon lists every caller of what the diff changes; a caller broken in an untouched file becomes a card.
- **team-review: an expected load.** Races and cost are judged against the project's expected load.
- **team-scan:** the profile gains `## Expected load`.

## 0.11.0 — 2026-10-20

Clearer gates and leaner runs.

**Gate page**
- **Linked cards.** A card that only matters under another's choice renders under it (`on`) and goes moot when that choice rules it out.
- **Order you can trust.** `after` (formerly `needs`) orders the page so nothing shows before what it relies on.
- **Settled without you.** Answers taken from the code, assumptions and defaults gather in a last section, pre-applied, each one reopenable.
- **Constraints sit on the cards they bind.**
- Fewer, plainer cards: minor steps are approved at once, and a gate holds about seven weighty cards at most.
- Some old gates fail the new renderer (a page-level `constraints`, a decision `after` a tension, cards relied on across groups) and need a small edit.

**All skills**
- **Lean runs.** Agents return asynchronously, and small follow-ups go to cheap agents. `team-protocol` is split into files read only when needed.
- **Only real questions reach you.** A question the code answers is answered with `file:line`; visible choices (placement, wording, flow) are yours.
- **Open answers** get one check, then one question in chat.
- **Handoff checks** keep what the next phase needs before the run folder is deleted.

**Per skill**
- team-council: the framing lists variants and a glossary; the evidence pass runs first.
- team-council-plan: size limits per task and per plan, and a consolidation pass before approval.
- team-review: the forge head is resolved first; one verifier for all zones.
- team-scan: the profile gains `## Environment limits`; a missing profile is offered or run.
- Records: a correction folds into its decision with a one-line *History*.

## 0.10.1 — 2026-10-19

- A review shared on GitHub or GitLab gives every card whose line is in the diff its own thread, minor ones included; the body keeps only the cards it cannot anchor.

## 0.10.0 — 2026-10-16

team-review and team-refactor work as one loop.

- **Hand-offs are taken in.** Each skill takes the other's hand-off list directly: `/team-review <refactor record>`, `/team-refactor <review record>`.
- **Sweep.** Review every zone, execute its fixes, refactor only where a review asks.
- **Records first.** Recon reads earlier records on its scope and does not raise again what was settled.
- **Diff guard.** Before committing, each executor checks its staged change for added suppressions, files outside the fence and formatting.
- **Gates cover the scope.** Files that lint and typecheck never reach are flagged.
- **Known flakes** live in the profile.
- **Auto-accept builds no page** for team-review and team-refactor.
- team-review: Security sits only when there is a trust boundary; a finding may carry two candidate fixes.
- team-refactor: a lighter panel on fresh code.
- A fixup gets an opus re-check unless it is cosmetic.

## 0.9.0 — 2026-10-15

The bridge: business and tech on one decision.

- Every argument, metric and figure carries a `business` or `tech` lens, and cards can be filtered by lens.
- Each weighty card shows the constraints that bind it and what each option gains and costs per lens.
- An option that breaks a constraint stays choosable and visibly lifts it; a recommendation never does.
- `team-protocol/bridge.md` defines lenses, constraints and trade-offs once.

## 0.8.2 — 2026-10-15

Structural choices are the CEO's.

- A new package or module, layer, dependency rule, public contract or folder convention is a choice the CEO makes between options, never a writer's call or an "approve" on a routine step. Defined once in `team-protocol`.
- team-council's CTO names each one; team-council-plan settles the rest before drafting and records them in the plan's *Structure*; team-refactor and team-kickoff put them on their gates.

## 0.8.1 — 2026-10-15

One rule, one place.

- After an audit, every rule several skills share lives once in `team-protocol` (writers, code scope, execution, weakened checks); each skill keeps only its own additions.
- team-review always hands its fixes to a fresh session.
- team-ceo-view fields are defined once in `contract.md`. Markdown only; no renderer change.

## 0.8.0 — 2026-10-14

- Per-run `auto-accept`: every gate of that run skips the page and takes each card's default or recommendation (`render.js --accept-recommended`). Claude asks in chat only about cards with no recommendation, items relying on a declined one, and premise corrections.

## 0.7.0 — 2026-10-14

- **team-review**: four blind seats (Correctness, Security, Intent, Craft) and a verifier that tries to refute each finding before it reaches the human. On your own branch, fixes go test-first, one finding per commit. Recorded under `.council/reviews/`.
- **Share a review gate** with the branch owner: as a file, a claude.ai link, or a pending review on the MR/PR (`--share`, `--review=github|gitlab`), with the sharer's choices pre-filled (`--preset`).
- One lane per skill: the fix decides the lane, and each skill hands off what it finds outside its own.
- `render.js` becomes a thin CLI over `lib/`, with tests (`node --test test/ceo-view/*.test.js`).

## 0.6.0 — 2026-10-10

Lessons from live council, plan and refactor runs.

- Skill files are copied into the run folder before dispatch, so agents read them without permission prompts.
- team-refactor: one refactoring per step; gate commands verbatim; known flakes.
- team-council: the framing lists environment facts; CEO answers kept verbatim; an evidence pass.
- team-council-plan: open questions and human-only inputs settled before drafting; the contract and keystone sub-plan before consumers; amending a decision at the gate re-gates only what changed.
- Each skill split by reader (`templates.md`, `contract.md`, `counting.md`), so the orchestrator loads less.

## 0.5.1 — 2026-10-09

- Final-review findings in team-refactor go to a fresh executor as `fixup!` commits, never to the orchestrator.

## 0.5.0 — 2026-10-09

Hardened against shortcuts.

- Descriptions say when to use a skill, never its workflow.
- Shared rationalizations and red flags in `team-protocol`; an off-model seat (Codex or Gemini CLI) with the user's yes.
- team-council: a framing interview, earlier decisions given to every role, supersession links, records in the project's ADR format.
- team-kickoff: the vision step is an interview. team-refactor: weakened checks are red flags.

## 0.4.0 — 2026-10-09

- Roles are lenses, named after what they look at, each with 5–8 declared sources; agents pick and name the 2–3 that fit.
- team-refactor seats renamed: Responsibilities, Mechanics, Sequencing, Safety Net, Depth, Minimalist.

## 0.3.0 — 2026-10-08

- A drawing guide for figures (`figures.md`): when to draw, which diagram fits, drawing rules for the page.

## 0.2.1 — 2026-09-30

- Companion skills (planning, execution, exploration, TDD) come from the project profile, not by name.

## 0.2.0 — 2026-09-30

- `team-protocol`: one shared skill for dispatch, the run folder, the agent contract, counting positions and the fresh-session handoff.
- team-council fits its roster to the decision; only a position with checkable evidence counts toward a majority.
- The CEO page shows the outcome under the summary and keeps cards short; `render.js --serve` posts the decisions back to Claude.
- One card per question: a majority makes a decision, no majority a tension.
- Token economy: model tiers, tool budgets, an agent contract and fresh-session handoffs.

## 0.1.0 — 2026-09-27

- First release: team-scan, team-council, team-council-plan, team-kickoff, team-refactor and team-ceo-view, packaged as a Claude Code plugin marketplace.

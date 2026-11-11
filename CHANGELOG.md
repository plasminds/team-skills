# Changelog

What each version of team-skills changed, newest first.

## 0.28.1 — 2026-11-12

- **The card's drawing.** A card with no figure shows its diff, its suggested change or its examples in the story block, when they hold for the whole card; a diff or examples that differ by option stay in the evidence pane under each option.
- **One figure, one place.** A figure shown by two cards or context rows warns the gate writer; a figure several cards share goes in a context row before them.

## 0.28.0 — 2026-11-10

- **Story.** Every debate card opens as a story: the question, key numbers, one drawing, then one row per option. `story` is an id list; context rows open the page, the recap closes it; a context row can carry labelled facts, cases with a small drawing each, and a source note. The list is open or a 52px rail. Saved choices on a debate page start fresh.
- **Evidence pane.** A debate card keeps the three panes and the always-visible evidence pane: it follows the picked option (else the recommended), with its for and against, trade-off, own evidence and constraint status; *Evidence for* (`[` `]`) shows another option; the whole question sits below. The pane folds to a rail (`e`) and is absent when empty; the card's `accepts` sits in the recommended option's trade-off.
- **Every kind.** Plan, refactor, review, kickoff and acceptance pages take the debate page's shape: the list in story order with a recap, option rows, the evidence pane. No `summary`: a cover context row opens every page and gives the posted review its verdict. Arguments sit on options only, as the direct for and against of that choice.
- **No option.** Every debate question shows a negative option worded for it; arguments on the question itself are gone: they back or oppose that option.
- **Illustration warning.** The renderer warns the gate writer on a debate card with nothing drawn; nothing on the page.
- **Lenses.** No lens filter, tabs or keys outside acceptance; a line reads "for the business" or "for the build" only where it differs from its card's default; on debate pages arguments carry no lens label.
- **Copy decisions.** One plain sentence per question, then the block.
- **The business decider** in PRODUCT.md.
- **File share.** `--share` works on every kind: no record path, no keycap legend, a cover line with what is asked and how many, and on a phone a folded line on how to send it back; a review keeps its work order.
- **Example ids.** `E<n>` in the record's examples, cited by plan tests and by acceptance cases; an acceptance page shows "Example E3 from the specification" (folded) and lists the examples no case covers.
- **Kickoff.** A scope item with nothing drawn warns the gate writer.

## 0.27.0 — 2026-11-10

- **Examples.** An item or an option can carry `examples`, given / when / then rows shown as a table in the evidence pane. The decision record keeps the chosen rows; team-plan makes each a test, team-acceptance a case.
- **States.** An outcome can show its target in each state (`states`), one wireframe per state.
- **The product's colours.** A figure may use a colour the product's screens give a meaning to, written on the mark too. A screen mockup is drawn on the measured loaded case.
- **HTML mockups.** A figure can be an HTML fragment (`html`), for a screen mockup: rendered in its own shadow root, static, no external resource.
- **Data evidence.** team-debate's evidence pass can measure a case's frequency with read-only queries on the environments the profile's `Data evidence envs` line names.
- **Neighbouring work.** The debate framing reads the open tickets and MRs/PRs on the same objects; a collision becomes a coordination card.
- **Scope on the debate page.** The summary says what stays unchanged, what is out of scope and the known limits.

## 0.26.0 — 2026-11-09

- **team-acceptance.** An acceptance page (recette) of a pushed branch: cases with their steps, expected result and screenshots taken on a running environment, a Business view and a Technical one. Nothing to decide.
- **Acceptance pages in team-view.** `kind: "acceptance"` renders cases with no decision controls and opens on the Business lens.

## 0.25.2 — 2026-11-09

- **Removed.** team-view § *Next round* (reading the branch owner's answers from the merge/pull request's threads and drafting replies).

## 0.25.1 — 2026-11-07

- **Fewer permission prompts.** An execution session copies its skill files into a fresh run folder before reading any; a skill file not copied is copied, never read in place. Agents keep working files in the run folder, pass commit messages inline, run `gh` and `glab` alone, and run the diff guard without saving it to a script.

## 0.25.0 — 2026-11-06

- **French gates.** Every text of a gate is written in its `lang`, summary labels included, and a review's tags (lenses, severities) show translated; the review summary uses the French colon.
- **The review links the page.** `--page-url` puts the uploaded share page in the review's body, right after the summary.
- **The shared page shows only the reviewer's picks.** The agents' recommendation no longer shows to the reader: options carry a "Suggested" tag where the reviewer picked one, and Accept takes those picks only.
- **Next round.** Where the branch owner stands is read from the merge/pull request's threads and the new commits; replies are drafted for the human to post.
- **Removed.** Sharing as a claude.ai link (`--artifact`): a review is shared as a file or as a review on the merge/pull request.

## 0.24.0 — 2026-11-05

- **Renamed.** `team-ceo-view` is `team-view`, `team-council` is `team-debate`, `team-council-plan` is `team-plan`; "CEO" is now "the human". Old gate files, blocks and env still read: `.ceo.json`, `CEO DECISIONS`, `CEO SHARE`, `kind: "council"`, `CEO_VIEW_EDITOR`.
- **Light theme.** The gate page has a light theme and a dark one, with a toggle and the key `d`; print is always light. Colors live in `tokens.css`.
- **French chrome.** The page's chrome and the prompt text follow `lang`: a local gate with `lang: "fr"` shows French.

## 0.23.0 — 2026-11-04

- **Plans run on team-protocol.** An approved plan executes by `team-protocol` § *Execution*, as reviews and refactors do. A plugin's execution skill (superpowers' subagent-driven-development) runs only when the human names it; the project's own workflow still comes first. The handoff prompt names team-council-plan, and a plan format's own execution line is replaced.
- **Fresh executor on a red batch.** A red *Verification* goes to a new executor as a `fixup!`, never back to the batch's executor.

## 0.22.0 — 2026-11-04

- **Questions for the author.** A review on someone else's branch asks the author's questions as questions: their own page section (ask or drop), right after the verdict in the shared prompt and in the posted review. They no longer sit under *Settled*.
- **Settled lines checked.** Seats type the questions they answered (`answered:`) beside `author choice:`; the verifier checks both. A refuted line is corrected, an unsure one marked unverified.
- **Left as is, still shown.** A finding the reviewer leaves as is gets no thread, but the review body lists it with its stakes and the note. Share and `--preset` refuse one left without a note.
- **Not verified, not checked.** A settled item can carry `unverified`; the shared prompt and review list it under *Not verified*, not with the lines the agent must not reopen.

## 0.21.1 — 2026-11-04

- **A fuller shared prompt.** A finding left as is carries its stakes and the reviewer's note as its reason. Settled items are listed under *Already checked*. `--share` no longer asks settled items for a brief.
- **Review first.** The Share dialog picks a review on the merge/pull request when one can be posted.
- **Commands run before sharing.** Every command in the preamble and the briefs is run once in the review worktree; lint and type-check commands come from the CI config.

## 0.21.0 — 2026-11-03

- **Reachability.** A card whose scenario today's code cannot reach no longer reaches the CEO. Every scenario names the path that reaches it, else it is `unverified`; before the gate, one agent checks every `unverified` premise and sends the unreachable ones to *Settled* as `moot`. A position on a scenario counts only if its premise has its own evidence.
- **Lifecycle map.** The evidence pass of team-council and team-council-plan maps each stateful entity the decision touches: states, transitions, guards across modules, and the invariants they hold. Questions about today's behaviour are answered from it, not asked of the CEO.
- **Whole classes.** A rule about what code allows reads the whole class that decides it, never a line window, and greps guards by their effect.

## 0.20.1 — 2026-11-03

- **Machine tool sources.** Each machine tool names where it comes from (crapper and dryer: Uncle Bob's repos). team-scan cites the source of every tool it did not find or that fails, and a seat's not-found line carries it too.

## 0.20.0 — 2026-11-02

- **Machine tools.** team-scan detects crapper, dryer, ast-grep, gitleaks and osv-scanner and names the ones it did not find and, apart, the ones that fail. The recon seats run them read-only, by the recipes in `machine-tools.md`, and treat every hit as a lead to verify.
- **Dependency scan preference.** osv-scanner runs only where the project's Run preferences say yes.

## 0.19.0 — 2026-11-02

- **Tests instead of sources.** Each role's `## Sources` is now `## Tests`: the questions stay, the author and title go. Card lines, council Positions and plan verdicts no longer name a source.
- **Role overrides.** An override that copies a role file whole keeps its old `## Sources`, the intro asking to name a source and `— via <sources>` on the Position line. Rename the section `## Tests`, drop the names, delete those two lines.

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

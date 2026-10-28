---
name: team-protocol
description: Use when running any team-* skill (team-council, team-council-plan, team-kickoff, team-refactor, team-review) — dispatching its role agents, settling what they disagree on, or handing off at a CEO gate.
---

# team-protocol

The rules every team-* skill shares. Each caller owns its roles, rounds and gate mapping; this skill owns how agents are dispatched, how their positions are counted, how a run hands off, and how approved work is executed and checked. When a caller and this skill disagree, the caller wins for its own flow.

## Dispatch

- **One agent per role, dispatched in parallel.** Never play the roles yourself in one context (one context, one opinion in several costumes).
- **Separation of context.** Every agent gets the minimum it needs; none receives the conversation, the raw transcripts or another agent's output unless its caller says so. The caller's table says what each one receives.
- **Agents return async.** Send every agent of a round in one message. Each completion wakes you for a turn that re-reads the whole run: until the round's last agent is back, answer a notice in one line under 10 words — no tool call, no Read, no summary of the reply. Then read the replies once and take the next step.
- **Pass the model and budget** from the caller's table to every dispatch.
- **Seat agent.** Dispatch each agent as its type: the caller's `Type` column, or outside a table `maker` if it writes a project file or code, `judge` if it weighs other agents' output on opus, else `analyst`. Use `team-skills:team-<type>` if the session lists it, else `team-<type>`, else `general-purpose`, said once in one line before the first dispatch. Pass the model either way.
- **Skill files go into the run folder first.** The skill's base directory (`~/.claude/skills/…` or the plugin cache) is outside the project: a Read there waits on a permission prompt. Once the caller's preconditions pass, create the run folder; the run's first action copies, in one Bash call, every skill file an agent will Read: the caller's `templates.md` and role files; this skill's `counting.md`, `bridge.md`, `scope.md`, `execution.md`, `auto-accept.md` and `lane-handoffs.md`, and its `SKILL.md` as `team-protocol.md` when `templates.md` points to a `team-protocol` section; `team-ceo-view`'s `contract.md` and `figures.md` for an agent that builds a page or draws a sketch. E.g. `cp <base directory>/{templates.md,roles/role-*.md} <base directory>/../team-protocol/{counting.md,bridge.md,scope.md,execution.md,auto-accept.md,lane-handoffs.md} <base directory>/../team-ceo-view/{contract.md,figures.md} <run folder>/ && cp <base directory>/../team-protocol/SKILL.md <run folder>/team-protocol.md`. Check overrides with `[ -d .council/role-overrides ] && ls .council/role-overrides` (a bare `ls` fails on a missing folder). team-council-plan copies its role files from `<base directory>/../team-council/roles/`; team-kickoff has neither `templates.md` nor `roles/` (its council run copies team-council's). Point each agent to its copy; a pointer to a `team-protocol` section means that section of `team-protocol.md`. Scripts run through Bash (`render.js`, `cards.sh`) and project overrides need no copy. **You read the copies too:** until the copy, no skill file but the SKILL.md the Skill tool loaded; then sections from the copy (`grep -n '^## ' <run folder>/templates.md` first), never from the base directory.
- **Role overrides.** Templates live in the caller's `roles/`. A project may override any of them with `.council/role-overrides/role-<name>.md`; the project file wins. `<name>` is the role's file name.
- **Roles are lenses.** A role is named after what it looks at, never after a person. This holds for built-in roles, ad-hoc specialists and project overrides.
- **Sources.** Every role file has a `## Sources` section: 5–8 entries, one line each, a source and the question or test it brings. The list is varied on purpose, in gender, country, discipline and epoch. A source earns its place by changing what the agent does.
- **Pick and declare.** The agent picks the 2–3 sources that best fit the case and is not bound to the others. It names the ones it used, where its caller's output format says.
- **Ad-hoc specialists.** When you summon one, write it 3–5 sources by the same rule.
- **Attribution.** Every finding is credited to the role that made it, including what a role got from a specialist skill.

## Writers

Writers keep the orchestrator short. Gate JSON, decision, refactor and review records, exec briefs and plans are written by agents (from the synthesis file, the decisions block or a reviewer's lines). The orchestrator writes prompts and small run-folder notes, flips a `Status:` line, appends a record's *Execution* section, serves the page, and passes the decisions block on. A CEO follow-up that needs more than one grep goes to a sonnet evidence agent: your context is the run's most expensive. A record amendment of ≤ 5 lines you append yourself (`cat >>`), no writer. Each caller's table gives these writers a model and a budget.

- **The synthesis** stays under ~300 lines and holds everything the gate page and the record need, since it is the only run-folder file the gate writer and the record writer read.
- **The exec brief** is for the executors and nothing else: a header (scope, the quality-gate commands copied verbatim, fences for the whole run), then the approved cards in order. No debate, no arguments, no declined or rejected items. Aim under ~150 lines.
- **After execution**, complete the record yourself with one Bash call that appends to it (`cat >> <record> <<'EOF'`), then flip `Status:` to `executed`. The appended `## Execution` section copies the reply lines as they came: *Commits* (hash and item, one line each), *Reverted or blocked* (item and reason), *Notes* (the final reviewer's `note` findings; the caller says what they count as).

## Off-model seat

The caller names the seat that can go off-model. Before the roster line that seats it, read `off-model.md` in this skill's base directory: why, when to offer it, and how to run it.

## Run folder

`.council/runs/YYYY-MM-DD-<topic>/`. Every agent writes its full output there, except a writer whose output is a project file (*Agent contract*). Later agents (Round 2, gate, synthesizer) read the files they need from it. The orchestrator reads only the synthesis file, or, in a flow with none, the reply lines its caller names.

## Agent contract

Append this block to every dispatch prompt, with the budget, run folder and agent id filled in. Every turn re-reads the whole context, so context size × turns is the bill.

```markdown
## How to work
- Budget: about <N> tool calls. Put several searches in one Bash call; Read a file once, whole.
- Read run-folder files with the Read tool, several in one message; never `cat` them through Bash or copy them to `$TMPDIR`.
- Tool rules: <the user's standing tool rules from CLAUDE.md, e.g. "absolute paths, never `cd`">
- Only a command's output counts, never IDE diagnostics (they can come from stale buffers). Run each gate command exactly as your brief writes it, with no pipe, redirect or prefix added.
- Write your full output to <run folder>/<agent id>.md.
- A question the code, the ticket or the MR/PR answers is yours: answer it with `file:line` or the link. Before asking how a new variant behaves, say how its sibling behaves today. A claim that something does not exist names the terms and paths you searched, else mark it `unverified`.
- Reply with: the file path, one line per position, card, verdict or defect (id + title), the questions for the CEO, and what you settled alone (`question → answer — source`). Nothing else.
```

Drop the *Tool rules* line when the user has none. A caller may add lines above the budget (team-refactor adds "Start from the Code Brief").

**A writer whose output is a project file** (a plan, a record, an exec brief, a gate JSON) writes it there: its project path replaces the run-folder line, as `- Write your full output to <project path>.` An off-model seat replaces that line too (`off-model.md`).

An agent whose job is not to change the project (a role, a reviewer, an evidence pass) also gets this line: `- Leave the project tree as you found it. Scratch files (a probe test, a script) go in <run folder>; if a tool only runs them from inside the tree, delete them before you reply and say so.`

## Counting positions

Every question the roles disagree on is settled by `counting.md` in this skill's base directory: the count goes in `tags` (`3–1`). The synthesizer and the writers apply it from their copy.

**Confidence.** `counting.md` § *Confidence* is the only definition of `high`, `med` and `low`; agents apply it from their copy.

## Bridge

How business and tech meet on one decision is set by `bridge.md` in this skill's base directory: lenses, constraints and trade-offs. A caller that follows it names it in its REQUIRED BACKGROUND line; its role agents, synthesizer and writers apply it from their copy.

## Structural choices

A structural choice is any of: a new package or module, a new layer, a dependency direction or import rule, a public contract other code builds on, a folder convention. Each is expensive to undo, so the CEO makes it as a choice between options, with a recommendation. A writer never settles one, and an `approve` on a routine step that happens to create one is not that choice. The caller says where its structural choices reach the CEO. A settled one that later work could break also becomes a constraint (`bridge.md` § *Structural choices and constraints*). A choice the user sees (a screen's layout or placement, wording, a flow) is the CEO's in the same way. A spike answers a fact; it never settles one of these.

## Settled without the CEO

The CEO sees every question, and every answer nobody asked them for.
- **A question the code, the ticket or the MR/PR answers is not a CEO question.** The agent that raises it answers it, or an evidence pass does before the pause.
- **Everything settled without the CEO goes on the gate's *Settled without you* list** (`contract.md`, `settled`): a question answered from code, an `assumed` premise or constraint taken as true, a default you or a writer took, an author-intent question sent to a merge request's comment. The CEO can reopen each one.
- **Before the question pause, grep the role files for `assumed`.** Each one is in a question or on the list.

## Project profile

A git worktree with no `.council/project-profile.md` takes a sibling worktree's first (`team-scan` § *Sibling worktrees*), before the caller's rule for a missing profile applies.

## Code scope

For any caller that reads existing code (Recon, seats, executors): read `scope.md` (copied to the run folder).

## Lane hand-offs

For team-refactor and team-review, which hand what they stumble on in the other lane to a list: read `lane-handoffs.md` (copied to the run folder).

## Handoff

Each CEO gate ends a session. **An open answer.** An UNDECIDED, or a note that asks a question: one check (an evidence agent if it needs code), then one question in chat that states only what the run's files hold and flags the rest as unchecked. The record says "gate pick X, changed in chat to Y" and quotes the CEO; a card made moot is recorded `moot`. Write the record the next phase needs. Before deleting the run folder, grep the deliverables for `runs/` and for ids that exist only in the run (reviewer defects); rewrite those as plain sentences. Evidence, settled notes and sketches worth keeping go to `.council/decisions/<name>-sources/`. Then delete the run folder (anything worth keeping is in the record by then). **Commit** as the profile's *Run preferences* say (`team-scan`). With no `Commit records` line, ask once with AskUserQuestion: *"Commit `<the files the next phase reads>` now, as one docs commit?"*, naming each gitignored one (`git check-ignore`), and record the answer as that line. Worktree executors only see committed files, and a commit after the handoff costs turns at the session's largest context.

**The handoff** ends your last message: `/clear`, then the next prompt alone in a fenced code block, whole and ready to paste (paths filled in, nothing else inside):

````markdown
`/clear`, then:
```
execute the review fixes in .council/reviews/2026-10-28-checkout.exec.md
```
````

The next phase starts from that file, not from a context that holds the whole debate.

**Launch.** The next phase can start itself in a new session, per the profile's `Next step` line (`launch` | `paste`); with none, ask in the commit question's AskUserQuestion call and record the answer. On `launch`, run outside the sandbox, detached:

```bash
setsid -f claude -p --name "<topic>" --append-system-prompt "Headless team-* handoff: no AskUserQuestion. At the first point needing the human (a question, a gate page to serve), write it as text and end your turn; they resume this session." "<the prompt>" > /dev/null 2>&1
```

Say it runs alone, to open from the session history or `/resume`. The handoff block still ends the message.

## Execution

At execution, read `execution.md` (copied to the run folder).

## Weakened checks

Read `## Weakened checks` in `execution.md` (copied to the run folder). A caller writes "no check weakened (`team-protocol` § *Weakened checks*)".

## Sweep

For a sweep of zones: read `## Sweep` in `execution.md`.

## Auto-accept

Only on an `auto-accept` run: read `auto-accept.md` (copied to the run folder).

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "I'll play the roles myself, it's faster" | One context gives one opinion wearing several costumes, and no tension. Dispatch them. |
| "It's close, I'll pick a side and call it a decision" | No majority makes it a tension. The synthesizer suggests a side; the CEO takes it. |
| "We're on a roll, I'll keep going in this session" | The next phase would pay for this whole context on every turn. Write the record, then `/clear`. |
| "The code answers it, no need to mention it" | Answer it, and put it on *Settled without you*: nothing is decided in the dark. |
| "A new package is an implementation detail; the writer will shape it" | Its boundaries, dependencies and folders are expensive to undo, and an `approve` on one step line among forty is not a choice the human made (§ *Structural choices*). |
| "The fence says format only the changed lines; the executor will comply" | It didn't, seven times in one sweep. The *Diff guard* runs before every commit; words alone don't. |

## Red Flags

- Writing a role's position, card or verdict yourself
- A dispatch without `model`, or as `general-purpose` while its `team-*` agent is listed
- Writing or patching a gate JSON, record, exec brief or plan yourself (a `Status:` line and the *Execution* append aside)
- Fixing a reviewer's finding, or editing code between batches, yourself
- A skill file read from its base directory, by you or an agent
- A counted position written before a CEO answer that contradicts it
- Every role agreeing on everything
- A count in `tags` that includes a position with no `file:line`, doc, output or measurement
- Opening a run-folder file other than the synthesis or a skill-file copy
- Starting the next phase in the session that ran the gate
- An external model CLI called without a yes on record
- A gate auto-accepted in a run the human did not invoke with `auto-accept`
- A template pointing an agent to a `team-protocol` section, with no `team-protocol.md` in its run folder
- A structural choice that reached the CEO only as a routine step, or not at all
- A commit made without its brief's *Diff guard* run
- A hand-off line with no scenario
- A card that restates a *Settled* line with no new evidence
- On an auto-accept run with no page, an item without a recommendation, a `corrects` item or an unmet `after` that was never asked about

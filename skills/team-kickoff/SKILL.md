---
name: team-kickoff
description: Use when starting a brand-new project or an empty directory, and the user wants several perspectives on its vision, scope, stack and conventions before the first line of code.
---

# team-kickoff

New-project bootstrap. Brings the roles in before there's any code, so the project's direction and conventions are shaped by the full team rather than defaulted. Reuses `team-debate` internally.

**REQUIRED BACKGROUND:** follow `team-protocol` for dispatch, the run folder, the agent contract, counting positions, the bridge, structural choices and the handoff.

## Flow

```
1. Gather vision      → ask the user: what, who, why
2. team-scan          → run on the directory (even if empty — detects global tools)
3. Dispatch debate    → full debate with the vision as decision context
4. PO synthesis       → team input → kickoff record
5. Human approval     → present the kickoff record, iterate
6. Write foundations  → .council/project-profile.md + initial CLAUDE.md
7. Hand off           → existing project setup / scaffolding workflow
```

### 1. Gather vision
The roles debate the vision you bring back, so get the one the user holds, not the one that sounds right.

1. **Hypothesize.** Write your read of the project in one sentence, plus your confidence in it (a percentage). Below ~70%, ask the user about what is missing first.
2. **One question at a time, each with your guess attached.** The user corrects a wrong guess faster than they answer from scratch. Wait for the answer before the next question, since it often changes the next one.
3. **Listen for "should want".** Buzzwords as goals ("scalable", "modern"), deferring to convention ("the standard way"), "I should probably…". Then ask: *"If you didn't have to justify this to anyone, what would you build?"*
4. **Stop when you can predict their answers to your next three questions.** Several rounds without getting there means something basic is missing: say so and step back.
5. **Restate**, in their words, one line each, and ask *yes / no / refine?*
   - **What**: what is being built
   - **Who**: the users and their context
   - **Environment**: where they use it (platform, OS, language, keyboard layout), so no role assumes its own
   - **Why**: the problem, and why now
   - **Success**: how we will know it worked
   - **Constraints**: the binding limits (time, money, stack, team), each one passing "what happens if we break it?" (`team-protocol` § *Bridge*)
   - **Out of scope**: what v1 will not do. Always filled in: half of misalignment is silent disagreement about what is not being built.
6. **Get an explicit yes.** "Sounds good", "sure" and "whatever you think" are not one: ask which line they would change, or offer two concrete options. Fold corrections in and restate.

The confirmed restate is the debate's decision context, and *Out of scope* is its fence. Each of its *Constraints* enters the debate's framing as a constraint, `confirmed`, source "the human, kickoff restate", with a lens (`business` or `tech`; the framing and the gate JSON require one). The Wildcard may contest one; it stays binding unless the human lifts it at the gate.

### 2. Scan
Run `team-scan` on the target directory. On an empty directory it still detects globally available skills, agents, and MCP tools. The intended stack is not in the profile yet: step 6 adds it from the roles' conclusions.

### 3. Debate on the vision
Invoke `team-debate` with the confirmed restate as its framing and decision context (the user already said yes to it, so skip the debate's framing questions), with every role seated and at two-round depth: a vision is open and not cheap to reverse. The roles debate the shape of the project — scope, architecture direction, the initial structure (repo layout, packages or modules, folder conventions; `team-protocol` § *Structural choices*), UX principles, first-principles soundness, and ambitious alternatives — before anything is committed. Run the debate through its synthesis but **skip its gate**: step 5 is the single gate for kickoff.

### 4. Synthesis → kickoff record
The debate's synthesizer writes its *Debate Summary* (team-debate's `templates.md` § *Synthesis*): the agreed vision, the initial scope, the technical and UX direction. Points it defers past v1 go to the kickoff record's *To revisit* (step 5), not to `tensions`. A gate writer (sonnet, ~15) then sketches v1 into `.council/gates/YYYY-MM-DD-kickoff/`: the `system` view (components, data flow, external services) and, if the project has a UI, the `ui` view (a wireframe of the core screen). Both are `after` only, since nothing exists yet. Copy `team-view`'s `contract.md` and `figures.md` into the run folder first (`team-protocol`); the writer draws by `figures.md` and builds the page by `contract.md` and the mapping in step 5.

### 5. Human approval
A record writer (sonnet, ~8) writes the kickoff record to `.council/decisions/YYYY-MM-DD-kickoff.md` in team-debate's *Decision record* shape (its `templates.md` § *Decision record*, copied in the debate's run folder), so `team-plan` reads it like any decision:

```markdown
# Kickoff — <project>
Status: draft

## What
[The confirmed restate's line, in the user's words]

## Who
[The confirmed restate's line]

## Environment
[The confirmed restate's line: platform, OS, language, keyboard layout]

## Why
[The confirmed restate's line]

## Success
[The confirmed restate's line]

## Constraints
[In team-debate's record shape (`bridge.md`): id, lens, text, source, status; the restate's first (source "the human, kickoff restate"), then those the roles added; one the human lifted as "K<n> lifted by the human, <their words>"]

## Out of scope
[The confirmed restate's line]

## Debate Summary
[The debate's synthesis, as written]

## Accepted trade-offs
[The costs of each direction choice the human took, with who accepted them and the condition to revisit them]

## To revisit
[Points the roles defer past v1, and its dissenting views worth noting: what, who raised it, what would reopen it. A choice with no majority goes to `tensions`, not here]

## Human decisions
[Each gate item with its choice and the human's note]
```

**REQUIRED SUB-SKILL:** use `team-view` (`kind: "kickoff"`, `source` = the kickoff record); the gate writer builds and renders the page. Map it like this:
- **Context**: no `summary`. A cover context row, first, holds a one-line `title` (≤ 70 characters), *What* as its `why`, and the facts *Who*, *Why*, *v1 in one line*, one or two sentences each, never a `; `-joined list. `story` is optional: absent, context rows then cards.
- `settled`: what the restate and the roles settled without the human.
- **Constraints**: onto the cards they bind (`contract.md` § *Bridge fields*), never page level.
- `outcome`: the v1 sketches from step 4, each drawn by a context row's `outcome: n`.
- **Each scope item**: a routine decision with options *In v1 / Later / Out*, `"lens": "business"`, and an example, a mockup or states for it (`examples`, `figures`, or an `outcome` entry whose `on` names it); a scope item that cannot be drawn says why in `unillustrated`. The renderer warns on one with neither.
- **Each direction choice with a majority** (stack, architecture, UX principles): a weighty decision whose options are the roles' alternatives, with the majority's option marked and each role's argument in the `for` or `against` of the option it directly backs or opposes (an item-level argument is refused). Each option carries its `tradeoff`, and the item its `accepts` (`bridge.md`).
- **The initial structure**: always on the page, as a direction choice like the ones above (or a tension), so the scaffolding workflow builds a layout the human chose instead of inventing one.
- `tensions`: direction choices with no majority, by `counting.md`. *To revisit* stays in the kickoff record, off the page.

Iterate: notes or changed choices → the record writer revises the kickoff record, the gate writer re-renders. The human is satisfied when a decisions block comes back with nothing to revise; the record writer then sets `Status: decided YYYY-MM-DD` on the kickoff record.

### 6. Write foundations
A foundations writer (sonnet, ~10) writes both, from the kickoff record and the scan's profile:
- `.council/project-profile.md` — the profile (from team-scan, enriched by the roles' conclusions about intended stack and conventions).
- `CLAUDE.md` — initial project instructions: quality gates, design context, principles, conventions the roles agreed on.

### 7. Hand off
Delete the debate's run folder (its own handoff was skipped with its gate), then hand off (`team-protocol`) to the project's setup/scaffolding workflow, or to `team-plan` on the kickoff record if the next step is planning the first milestone.

## Notes
- team-kickoff is the only skill that expects to run before code exists; the others assume a project.
- Everything it writes is a starting point: `team-scan` re-runs as the project matures.

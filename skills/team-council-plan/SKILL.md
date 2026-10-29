---
name: team-council-plan
description: Use when a council decision is recorded under `.council/decisions/` and the next step is planning how to carry it out, or when the user asks to plan the council's decision. Not for planning work the council never decided.
---

# team-council-plan

The second half of the council workflow. `team-council` decides **what**; `team-council-plan` produces the **how** — a reviewed implementation plan grounded in that decision.

**REQUIRED BACKGROUND:** follow `team-protocol` for dispatch, writers, the run folder, the agent contract, counting positions, the bridge, structural choices, the handoff, execution and weakened checks.

## Preconditions

- **A resolved decision**: read the most recent (or user-specified) file in `.council/decisions/YYYY-MM-DD-<topic>.md`. If none exists, the council hasn't run — stop and point the user to `team-council` first.
- **Project profile**: read `.council/project-profile.md`. If it is missing, run `team-scan` at once, announced in one line.

## Flow

```
Load decision + profile
        ↓
Settle open questions and human-only inputs
        ↓
Draft plan (the profile's planning skill conventions, if any); keystone first
        ↓
Role review (parallel): CTO (technical soundness, sequencing, risk) + system sketch
                        PO  (scope, value, priority ordering)
                        UX  (when a user sees a change) + screen mockup
                        + any specialist the decision implicates
        ↓
Reconcile review feedback → revised plan
        ↓
Write draft to <Plan location>/YYYY-MM-DD-<topic>.md (profile's Run preferences)
        ↓
Present plan to CEO → approved: remove Status: draft, hand off
```

### 1. Load context
Read the decision file and the profile. The *Council Summary* and the CEO decisions are what the plan needs; the rest of the record is archive. Extract the accepted direction, the record's `## Constraints` and `## Accepted trade-offs` (they, not the PO's prose, say what binds and what was accepted, and by whom), the profile's standing constraints (its `## Constraints`), any dissenting views worth guarding against, and the summary's *Structural choices*: the settled ones go into the plan's *Structure* as "the decision", the ones left to the plan are settled in § 1b. A record without those two sections (written before they existed): the plan's *Constraints* says "none recorded" for the record and still lists the profile's standing ones, and § 1b asks the user whether any binds; its *Accepted Trade-offs* quotes the *PO Recommendation*, marked as such.

### 1b. Settle before drafting
Writers type in a settled design. Before any draft, list:
- **Open design questions**: what the decision leaves open that would change the plan's shape (which path a call takes, where a type lives, whether two entry points share one route). Settle each with the user (AskUserQuestion, a recommendation first), or with a spike agent that writes its numbers into the brief. A spike answers a fact; a choice it opens that the user will see goes to the CEO (`team-protocol` § *Structural choices*).
- **Structural choices** (`team-protocol` § *Structural choices*) the plan would make and the decision does not: each is settled as above and recorded in the plan's *Structure*. One whose rule later work could break is also a constraint (`bridge.md` § *Structural choices and constraints*): it gets the next `K<n>` id, on its *Structure* line and in the plan's *Constraints*, source `<plan path>, Structure`.
- **Human-only inputs**: captures, probes, credentials, measurements on the user's machine. Human-only inputs include what the profile's `## Environment limits` says the sandbox cannot run. Collect them now. A writer that needs one waits for it, never guesses it.
- **Unobserved facts**: when the plan rests on what the code does today, one evidence-pass agent gathers them first (agent id `evidence`).
- **A constraint found while planning** (by a spike, the evidence pass or a reviewer): never folded silently into the plan. It goes on the plan gate as a decision (`templates.md` § *Gate page*), like a `reverses council D<n>` option.

### 2. Draft the plan
Writers produce a step-by-step implementation plan in the project's plan format, or the conventions of the planning skill the profile's Process domain lists, or else `templates.md` § *Plan*. The plan implements the council's chosen direction; it does not relitigate it.

Writers and fixers write the plan files in the profile's *Run preferences* `Plan location` folder (`.council/plans/` when the line is missing), as `YYYY-MM-DD-<topic>.md`, sub-plans beside it, not in the run folder: that path replaces the run-folder line of `team-protocol` § *Agent contract*. Agent ids: `evidence`, `spike-<n>`, `index`, `plan-<part>`, `fix-<part>`, `review-<role>`, `gate`, `record`.

A plan that fits one file is drafted by one writer. A plan large enough to split into sub-plans splits along interfaces, in this order:
1. **The index** (one writer): the sub-plans, their order, and the **cross-plan contract**: every name, signature, id and type one sub-plan exports and another uses.
2. **The keystone sub-plan** (the one the others build on), written against that contract. Its *Interfaces* block is then frozen.
3. **The consumers**, in parallel, each given the frozen contract, never a guess at it.

A writer that needs to change the contract stops and reports. A fresh `fix-index` writer amends the contract and the keystone before any consumer adapts.

### 3. Role review (parallel)
Dispatch the reviewers by `templates.md` § *Review*: CTO and PO always, UX whenever the plan changes something a user sees, and an ad-hoc specialist when the decision implicates another domain (write its `## Sources` with 3–5 entries, `team-protocol`). Each gets its council role's `## Sources` (`../team-council/roles/role-<role>.md` from this skill's base directory, copied into the run folder) and the copy of `bridge.md`, and the CTO and UX also the copies of `contract.md` and `figures.md` for their sketches.

| Agent | Type | Model | Tool budget |
|-------|------|-------|-------------|
| Evidence pass, spike | analyst | sonnet (opus for a design spike) | ~20 |
| Keystone writer | maker | opus | ~30 |
| Other writers | maker | sonnet | ~25 |
| Fixers (review defects, CEO rulings) | maker | sonnet | ~20 |
| Reviewers: CTO, PO, UX, specialists | analyst | sonnet | ~10 |
| Gate writer | maker | sonnet | ~12 |
| Record writer (amendments, approval) | maker | sonnet | ~8 |

### 4. Reconcile
Fold review feedback into a revised plan. One fixer per round takes every defect at once and writes the amendment's line under `## Plan gate` in the decision record. Its brief adds: "Add nothing unasked; list your own additions first." Before the approval pass, one consolidation pass deletes superseded rules and their references. Where a reviewer's concern conflicts with the council's accepted trade-off, keep the decision and pass the concern to the gate writer: it goes in the `against` of the step or risk it concerns, or becomes a minor item (`templates.md` § *Gate page*).

### 5. Approve & write
The revised plan sits at the plan location of step 2, with `Status: draft` and the source decision's path at the top.

**REQUIRED SUB-SKILL:** `team-ceo-view`. The gate writer builds and renders the page by `templates.md` § *Gate page*; you serve it and read the decisions block.

Declines or notes → revise by § 4 and re-render.

**The CEO amends the decision at the gate** (picks a `reverses council D<n>` option, or says so in a note):
1. No fixer ran, so a record writer (sonnet, ~8) writes that `## Plan gate` line: the item, the new direction, the CEO's words.
2. Revise only the sub-plans or steps it changes.
3. One CTO reviewer (sonnet, ~10) checks the changed steps.
4. Re-gate only those steps. An amendment merges into the gate while it is unanswered; `-r<N>` only for a gate already answered (`<topic>-plan-r<N>.ceo.json`; the earlier `.decisions.txt` stays on record).

On full approval, a record writer adds the constraints born in § 1b to the decision record's `## Constraints` (source `<plan path>, Structure`); records each `(lifts K<n>)` of the plan gate's decisions as `K<n> lifted by the CEO, <their words>` and marks a lifted `KS<n>` line of the profile `lifted by <record path>`; adds each constraint found while planning that the CEO kept (`confirmed`, source `<plan path>`, the next free `K<n>` id); and appends every new `tech` constraint, from the council gate or § 1b or kept at the plan gate, to the profile's `## Constraints` with the next free `KS<n>` id (`team-scan`), unless the rule is already listed there, `lifted by` ones included. Then remove `Status: draft` and hand off (`team-protocol` § *Handoff*) with the prompt `execute <plan path> with <plan-execution skill>`. Name the skill the profile lists (see *Execution*); if it lists none, drop the "with" part. Execution starts from the plan file, not from a context holding the planning.

## Execution

This skill plans; it does not implement. The executing session uses the plan-execution skill from the profile's Process domain (e.g. `superpowers:subagent-driven-development`), or the project's own execution workflow, and follows the plan's *Execution economy*: models, batches, re-review.

When the profile lists none, execute from the plan file by `team-protocol` § *Execution*, with these rules of its own:
1. Batch as the plan's *Execution economy* says; a plan without one batches by `team-protocol` § *Execution*. Executors run on sonnet, opus for a design-heavy step. Each gets its batch's steps and the plan's *Goal* and *Outcome*, never the decision record.
2. The executor writes a failing test first when a step changes behavior, commits each step on its own, and replies with one line per step: commit hash, `blocked — <reason>`, or `stopped — <the diff guard's hit>`.
3. After each batch, run the *Verification* commands yourself. Red → send the failure back to that batch's executor once, then stop and ask the human.
4. Last, the final reviewer (opus) reads the full diff against the plan: nothing smuggled in, nothing dropped, the *Outcome* reached, no check weakened (`team-protocol` § *Weakened checks*). Its `fix` findings go to fresh executors as `fixup!` commits (`team-protocol` § *Execution*).

Whichever path ran, offer, never impose, `team-review` on the executed diff, as a review of your own branch: the final reviewer checks conformance to the plan, not correctness or security. Its Recon takes this plan and the decision record as the intent.

Set `Status: executed` on the plan when done.
## Rationalizations

The shared ones are in `team-protocol`. These are the planner's own.

| Excuse | Reality |
|--------|---------|
| "The council's pick has a flaw; the plan can quietly route around it" | The plan implements the decision. Record the concern in the `against` of the step it concerns, or put the minority option on the gate as `reverses council D<n>`. Only the CEO amends the decision; a wholly different direction is a new council. |
| "The writers can start now and align on names later" | Consumers that guess the keystone's API get rewritten. Freeze the contract first. |
| "I'll leave that design question to the writer" | A writer who meets an open question guesses, and the gate undoes the guess. Settle it before drafting. |
| "This extra step is small and useful" | Nothing smuggled in, nothing dropped: that is what the PO reviewer checks. Raise it at the gate instead. |
| "It's approved, I'll start executing here" | Execution starts from the plan file, in a fresh session. |

## Red Flags

- A step that traces to nothing in the decision
- A step that makes a structural choice neither the decision nor the plan's *Structure* settled
- A consumer writer dispatched before the contract it codes against is frozen
- A writer guessing a human-only input (a capture, a probe result)
- An amended step re-gated without a review
- A reviewer concern that is in neither the revised plan nor the gate (an `against`, a minor item or a tension)
- An accepted trade-off overridden without a note
- A step that exceeds an accepted trade-off (a second copy where one was accepted)
- A step that breaks a constraint of the plan's *Constraints* with no gate decision
- Code written during planning

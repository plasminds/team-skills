---
name: team-council
description: 'Use before the code exists, at a decision point that deserves more than one perspective: choosing between approaches, an architecture, an "are we sure?" before implementing. Also when the user asks for the council, a debate, or a PO, CTO or UX view on a choice. Not for reviewing code that exists: team-review (is it right?) or team-refactor (is it well-shaped?).'
---

# team-council

A project-agnostic dispatcher that runs a structured, evidence-backed debate before the human (CEO/client) makes the final call. Complements brainstorming/planning/review — it does not replace them.

**REQUIRED BACKGROUND:** follow `team-protocol` for dispatch, the run folder, the agent contract, counting positions, the bridge, structural choices and the handoff.

## Preconditions

- **Project profile**: read `.council/project-profile.md`. If it is missing, run `team-scan` at once, announced in one line.
- **Decision framing**: every role gets the same framing, so a skewed one skews them all. Write your read of it:
  - the question, the options on the table, what is out of scope, and whether it is reversible;
  - **the facts every role will assume**: who the user is, their platform and locale (OS, language, keyboard layout), and what the work may add: fixes only, or new features too. Back each one with a file or the profile, or mark it *unchecked*;
  - **the constraints**: each limit that removes options and passes the test "what happens if we break it?" (`team-protocol` § *Bridge*), with its lens and its source (a file, a record, or the user's words), or marked *unchecked*. Those of an earlier decision on the same question, and the profile's standing ones (its `## Constraints`, `KS<n>`), come in `confirmed`, with their own source;
  - **Variants.** Each mode, type or state the decided object comes in (an enum, a flag set at creation); each is a fact or a question.
  - **Glossary.** The CEO's own terms for the objects in play, written into the decision context; roles and writers use them verbatim. A term that names another object in the project is a question.
  - **What the request already says.** A ticket or MR/PR given or linked (by the user, the branch or its MR): its description, its comments, and the MRs and plans it links (`glab issue view <n> --comments`, `gh issue view <n> --comments`, the MR's discussion). What they settle is a fact with that link as source, never a question.
  - **Precedent.** For a new mode or variant of an existing object, how the existing one does it today (`file:line`): the default for the new one, written as such. Each departure from it is a question.
  - the answer you expect from the user to each open sub-question;
  - your confidence in that read (a percentage).

  Every *unchecked* fact or constraint and every expected answer you can't fill is a question. Below ~70%, or with any such question left, ask the user one question at a time, each with your guess attached, until you could predict their next answers. Then restate the framing and get an explicit yes. "Sounds good" and "whatever you think" are not a yes: ask which line they would change, or offer two framings to pick from.
- **Earlier decisions**: look in `.council/decisions/`, and in the project's decision records the profile lists, for one on the same question. If there is one, every role gets it as context, and the new record supersedes it.

## Roles

Templates live in `roles/` next to this file. Each role is a lens with its own `## Sources`, like the panel in `team-refactor`.

| Role | Sources (a sample; all in the role file) | Signature question | Specialists (from the profile) |
|------|-------|--------------------|--------------------------------|
| **PO** (`role-po.md`) | Cagan, Torres, Perri, Adžić, Osterwalder & Pigneur | "Which outcome does this move, and what is the cheapest way to learn if it will?" | Process domain, project docs, git history |
| **CTO** (`role-cto.md`) | Brooks, Nygard, Kruchten & Ozkaya, Majors, Hamilton | "What is expensive to undo, and what will this cost to run and change?" | Technical domain, lint/typecheck/test commands |
| **UX** (`role-ux.md`) | Norman, Nielsen, Holmes, Suchman, Bertin | "Where does the user get stuck, and how do they know what happened?" | UX domain (e.g. `impeccable`) |
| **Philosopher** (`role-philosopher.md`) | Ibn al-Haytham, Popper, Bachelard, Longino, Gigerenzer | "What would prove this wrong, and has anyone looked?" | Read-only tools only |
| **Wildcard** (`role-wildcard.md`) | Munger, Klein, Altshuller, Meadows, Queneau | "If this failed a year from now, why, and which option would have avoided it?" | Any specialist, read-only |

**Ad-hoc specialists**: summon extras when the decision turns on a lens no seated role holds (e.g. a Performance Analyst for perf-heavy calls), or when the user asks for one. Write each one 3–5 sources (see `team-protocol`), and tell it to label every line `business` or `tech` (`bridge.md`).

**Evidence pass**: when the question rests on facts nobody has observed, one agent gathers them (agent id `evidence`). It runs before Round 1, and before the restate when a constraint rests on code behaviour. Every claim carries `file:line`; it ends with any two of its own claims that conflict. Its file goes to every role; its open questions join the pause. It leaves the project tree as found (`team-protocol` agent contract).

**Scope control**: a role invokes only its allowed specialists, never a tool that modifies state.

### Roster: who sits

PO, CTO and Philosopher always sit. Add:
- **UX** when the decision changes something a user sees or does: a screen, a flow, copy, an error, a public API's ergonomics.
- **Wildcard** when the question is open: the user hasn't named the options, or asks "how should we…". Skip it when the choice is between options already on the table.
- **Specialists** as above.

Tell the user the roster in one line before dispatching, with the reason for each role left out ("UX out: no user-facing change"); they can add one back. The page's *Decision* bullet names who sat.

**Off-model seat**: the Philosopher, whose job is to test what everyone else assumed. When the profile lists a model CLI, follow *Off-model seat* in `team-protocol` and add its offer to the roster line. The seat stays off-model in both rounds.

### Depth: how many rounds

- **One round** when the decision is reversible: undone by reverting one commit, with no public contract, data migration or money involved. Round 1, then the synthesis on sonnet. No Round 2, except for a seat a CEO answer contradicts: it alone sits again (sonnet, ~5) before the synthesis.
- **Two rounds** otherwise: the full flow below.

When unsure, it is two rounds.

## Flow

```
Evidence pass       → only when the question rests on unobserved facts
Round 1 (parallel)  → the roster: independent position + specialist evidence
Question pause      → orchestrator groups agents' flagged questions, attributed → CEO answers
Round 2 (parallel)  → two-round depth only: Philosopher (sees all R1) + conflicting pairs
                      + every seat a CEO answer contradicts
Synthesis           → PO synthesis agent → consensus / majority calls / tensions / recommendation
Gate page           → gate writer builds and renders it from the synthesis
CEO decides         → record to .council/decisions/YYYY-MM-DD-<topic>.md
```

### Round 1 — independent positions (parallel)
Dispatch the roster simultaneously. Each agent receives: its role template, the project profile, the decision context, and the roster of other members (but not their output). In each prompt, resolve the role template's placeholders: `{PROJECT_PROFILE}` → the profile's path, `{DECISION_CONTEXT}` → the confirmed framing, inline, plus the path of any earlier decision and of the evidence file. Agents invoke the specialists their role file lists, when a claim needs evidence, and may flag questions for the human. PO and CTO name the variants their option handles.

### Question pause
Collect flagged questions, present them grouped and attributed by role. Run the `assumed` grep and settle what you can by `team-protocol` § *Settled without the CEO*; ask the rest, each with its role's guess attached (`bridge.md`). With none left, skip the pause.

Save the answers to `<run folder>/ceo-answers.md` in this shape, and feed that file into Round 2 (or the synthesis at one-round depth):

```markdown
## Q<n>: <the question, as asked>
Answer: <the user's words, verbatim>
Reading: <your interpretation, if any — a reading, not a fact>
Claims to check: <any fact about the code or the product the answer asserts>
Constraint: <K<n> confirmed | K<n> dropped — only when the question was a constraint>
```

An answer binds as the user's preference. A claim it makes about the code is something for Round 2 to check, not a fact.

### Round 2 — targeted debate (parallel)
Identify tensions from the Round 1 one-line positions:
- **At two-round depth, the Philosopher always participates** — sees all Round 1 output, applies Socratic analysis.
- **Conflicting pairs** see each other's positions and respond directly.
- **Every seat a CEO answer contradicts** sits again, with the answers file. So does a seat whose agreement you can't confirm from its one-line replies.
- **The other seats skip Round 2.**

Round 2 prompts repeat the role file's *Output Format*, its *Position* line's sources included. Questions Round 2 raises for the CEO go on the gate page as decisions or minor items, not into a second pause.

### Synthesis
The synthesizer (a separate call from the Round 1 PO) writes the *Council Summary* by `templates.md` § *Synthesis*.

### CEO gate
**REQUIRED SUB-SKILL:** `team-ceo-view`. The gate writer builds and renders the page by `templates.md` § *Gate page*; you serve it and read the decisions block. The Round 1 question pause stays in chat; those answers are free text.

### Decision recording
The record writer records the CEO's decisions by `templates.md` § *Decision record*, including supersession, corrections and the project's own decision records. `team-council-plan` reads this record next.

Then hand off (`team-protocol` § *Handoff*) with the prompt `run team-council-plan on <decision path>`.

## Dispatch mechanics

| Agent | Type | Model | Tool budget |
|-------|------|-------|-------------|
| Evidence pass | analyst | sonnet | ~15 |
| Round 1 roles, ad-hoc specialists | analyst | sonnet | ~12 |
| Round 2: Philosopher, conflicting pairs, contradicted seats | analyst | sonnet | ~5 |
| Synthesis, two-round depth | judge | opus | ~10 |
| Synthesis, one-round depth | analyst | sonnet | ~10 |
| Gate writer (JSON, sketches, render) | maker | sonnet | ~15 |
| Record writer | maker | sonnet | ~8 |

- Keep each agent's context lean: profile + decision + role template + `bridge.md` + (Round 2) the specific counterpart positions. Writers get their `templates.md` section and `bridge.md`, and the gate writer also `team-ceo-view`'s `contract.md` and `figures.md`.
- Agent ids for the run folder: `evidence`, `r1-<role>`, `r2-<role>`, `synthesis`, `gate`, `record`.

## Rationalizations

The shared ones are in `team-protocol`. These are the council's own.

| Excuse | Reality |
|--------|---------|
| "The answer is obvious, one round will do" | Depth follows reversibility, not confidence. |
| "No screen changes, so UX sits out" | An API's ergonomics, an error message or a line of copy is something a user meets. UX sits. |
| "The user already knows what they want, the council is a formality" | Then the council's job is to find what would prove them wrong. That is the Philosopher's question. |
| "The framing is clear enough, I'll skip the restate" | Every role inherits the framing. A one-line restate and a yes cost less than a debate on the wrong question. |
| "Everyone uses QWERTY / English / a Mac" | That is an environment fact every role will build on. Check it or ask. |
| "Their answer settles it, I'll record it as fact" | A preference, not a fact: Question pause. |
| "The user said 'just decide'" | Recommend clearly. *Accept recommended* is one click, and the record holds the CEO's call, not yours (`team-protocol` § *Auto-accept*). |

## Red Flags

- Dispatching before the framing got an explicit yes
- A framing with an *unchecked* environment fact nobody asked about
- A seat whose Round 1 position a CEO answer contradicts, counted without sitting again
- A record whose `Status:` still says it awaits the CEO
- UX left out of a change that users or API callers will meet
- A recommendation with no `Accepts:` line
- A recommended option that violates a constraint
- A constraint a role raised, recorded as confirmed without the CEO's answer
- A direction that makes a structural choice nobody named: no CTO line, no synthesis entry, no gate decision
- An earlier decision on the same question that no role was given
- A role editing files during the debate
- A decision recorded that the CEO didn't take

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **The human**: the developer who ran a team-* skill (debate, plan, refactor, review) and must now decide on what the agent team recommends. They open the gate page in a browser, alone, between terminal sessions. Reviews and refactors are quick triage (2–5 minutes: skim, take the recommendations, fix a few, send); debates and plans get a deep read (15+ minutes over arguments, trade-offs and code).
- **The branch owner**: a colleague who receives a shared review gate (a standalone file) and decides on the findings alone, then copies a prompt to their own agent.

## Product Purpose

The gate is the one place a human decides in a multi-agent run. Each card is a decision the agents could not or should not take alone: options, the recommended one, the arguments for and against with who made them, the constraints that bind it, and the evidence (code before/after, trade-off tables, metrics, figures). Success: every card answered with confidence in minutes, the answers sent back to Claude (Send to Claude, Copy decisions) or handed to the branch owner (Share).

## Positioning

Not a dashboard of agent output: a decision instrument. Agents recommend, the human decides; every recommendation arrives already argued, attributed, refuted and costed, and the page makes the decision, not the reading, the unit of work.

## Operating Context

- Rendered by `skills/team-view/render.js` from a gate JSON (`contract.md`) into one self-contained HTML page; served locally (`--serve`, Send to Claude posts the decisions back), or rendered standalone for sharing.
- Gate kinds: debate, plan, refactor, review. Sections: decisions, tensions, minor items, settled without you, considered and rejected; linked cards (`on`, refines) render as one block; `after` orders the work.
- 5 to ~15 cards per gate; a sweep can hold more.

## Capabilities and Constraints

- Single self-contained HTML file: inline CSS and JS, no network fetches, no external fonts or libraries (it must work offline, as a file sent to someone; `confirm()` is not used).
- The tests in `test/view/` drive the template's DOM and script; ids, data attributes and the decisions-block format they rely on are contract.
- Must keep: the keyboard flow (←/→ cards, number keys and Enter to choose, `u` next undecided, `n` note, `?` help), an overview of all cards and their status at once, evidence beside the choice (not behind clicks), and the share page for the branch owner.
- Dark by default, light on request: the page follows the system or the viewer, a toggle (or `d`) overrides it, shared pages included. The light theme is warm paper, never white.

## Brand Commitments

None beyond the names: team-skills, the gate, the gate page.

## Evidence on Hand

Example gates with real-shaped content in `examples/refactor-gate/`, `examples/debate-gate/`, `examples/review-gate/`; README screenshots in `docs/`.

## Product Principles

1. The human decides; the page never decides for them, and never hides what they are deciding on.
2. Evidence sits beside the choice: argument, constraint and code are read in one glance, not opened.
3. The recommendation leads, the dissent stays visible.
4. Speed for triage, depth on demand, in one page.
5. Substance over decoration: no flourish that slows reading.

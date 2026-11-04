# Reachability

For team-debate and team-plan, whose cards rest on what the code does today. A copy sits in the run folder.

## Today's rules are in the code

What the system allows, blocks or guarantees today is what its guards enforce, even when it takes several modules to see it. "Can this case happen?" or "what stops X?" is answered from the code, never asked of the human. The human answers what should change, and what the code can't hold: intent, contracts outside it, the data's history.

## Lifecycle map

When a decision touches an entity with states (a status enum, a flag that gates actions), the evidence pass maps it in its file, before any role sits:
- each state, and each transition with the use case that makes it (`file:line`);
- each guard on a transition, or on an action in a state, wherever it lives: a constructor, a prerequisite in another module, a lock on the action (`file:line`). Read each class that holds one whole, and grep guards by their effect (the error they throw, the constant list they read), not only by the state's name;
- the invariants those guards hold together, each with the guards that make it, e.g. `DELIVERED ⇒ contract aligned: assignment amends (a:12), preparation waits for the signature (b:92), the funder lock forbids a change after (c:40)`.

Roles and reviewers test every scenario against the map before they raise it.

## Reachability check

A card whose scenario today's code cannot reach never reaches the human.
- **A premise stays marked.** A position built on an `unverified` premise carries the marker, whoever repeats it; the synthesis and the gate writer keep it on the item. Evidence of what the case would cause is not evidence the case occurs (`counting.md`).
- **Checked before the gate.** Before the gate writer, grep the synthesis (team-debate) or the review files (team-plan) for `unverified`. One evidence agent (agent id `reach`, sonnet, ~10) takes them all at once, with the lifecycle map, and writes one line per premise to `reach.md`:
  - *reachable*: the card stays, the path in its `detail`;
  - *unreachable*: the card leaves the page for *Settled*, `moot`, with the guard that excludes it;
  - *only the data can tell*: the card stays as "occurrence unknown", with the query that would tell.

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "That's business knowledge, the human knows it" | Today's rules are what the code enforces. Trace them across modules (§ *Lifecycle map*); the human answers what should change. |
| "Three roles agree and each cites `file:line`" | Their evidence may show what the case would cause, not that it can happen. Check the premise (§ *Reachability check*). |
| "The guard must be near the method, I'll read lines 80–135" | A guard sits in the constructor, or in another module. Read the class whole. |

## Red Flags

- A card whose scenario names no path that reaches it, or whose `unverified` premise reached the gate unchecked
- A question about today's behaviour put to the human
- A line window on the class whose rule a card states
- An evidence pass on a stateful entity with no lifecycle map

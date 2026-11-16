# Reachability

For team-debate and team-plan, whose cards rest on what the code does today. A copy sits in the run folder.

## Today's rules are in the code

What the system allows, blocks or guarantees today is what its guards enforce, even when it takes several modules to see it. "Can this case happen?" or "what stops X?" is answered from the code, never asked of the human. The human answers what should change, and what the code can't hold: intent, contracts outside it, the data's history.

How a value is stored (a column's type, a date's format, a payload's shape) is quoted from the declaration the store reads (the column mapping, the schema, the migration), never from the language type of the field that holds it.

**Only states the app produces.** A case is produced by a caller, not by an entry point: an API that no caller sends the case to, behind a screen that forbids it, cannot reach it. A column's values come from its writers (grep its assignments), each with its guard. Work handles only the states some path produces today; a branch for any other is dead code, not defense. A predicate copied from a guard "for parity" keeps a term only if some reachable state makes that term alone false.

## Lifecycle map

When a decision touches an entity with states (a status enum, a flag that gates actions), the evidence pass maps it in its file, before any role sits:
- each state, and each transition with the use case that makes it (`file:line`);
- each guard on a transition, or on an action in a state, wherever it lives: a constructor, a prerequisite in another module, a lock on the action (`file:line`). Read each class that holds one whole, and grep guards by their effect (the error they throw, the constant list they read), not only by the state's name;
- the invariants those guards hold together, each with the guards that make it, e.g. `PAID ⇒ invoice frozen: payment refuses a draft (a:12), sending waits for the totals (b:92), the ledger lock forbids an edit after (c:40)`;
- the relations the work reads across, with the invariant on each and the guards that hold it (`one open invoice per order: invoicing refuses an order already billed (d:72)`), and the writers of each column a predicate tests, each with its guard (`billing address: written only with the customer's name (e:200)`).

Roles and reviewers test every scenario against the map before they raise it.

## Reachability check

A card whose scenario today's code cannot reach never reaches the human.
- **A premise stays marked.** A position built on an `unverified` premise carries the marker, whoever repeats it; the synthesis and the gate writer keep it on the item. Evidence of what the case would cause is not evidence the case occurs (`counting.md`).
- **Checked before the gate.** Before the gate writer, grep the synthesis (team-debate) or the review files (team-plan) for `unverified`; the caller may add cases to check (team-plan adds every case its plan handles). One evidence agent (agent id `reach`, sonnet, ~10, more when the caller says) takes them all at once, with the lifecycle map, and writes one line per premise to `reach.md`:
  - *reachable*: the card stays, the path that produces the case in its `detail`;
  - *unreachable*: the card leaves the page for *Settled*, `moot`, with the guard that excludes it;
  - *only the data can tell*: the card stays as "occurrence unknown", with the query that would tell, and nothing is built for it unless the human picks *handle it*; its recommended option is *leave it unhandled*. The check never keeps a defensive branch on its own.

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "That's business knowledge, the human knows it" | Today's rules are what the code enforces. Trace them across modules (§ *Lifecycle map*); the human answers what should change. |
| "Three roles agree and each cites `file:line`" | Their evidence may show what the case would cause, not that it can happen. Check the premise (§ *Reachability check*). |
| "The guard must be near the method, I'll read lines 80–135" | A guard sits in the constructor, or in another module. Read the class whole. |
| "I cite the line where the case breaks, that's my evidence" | That is what the case would cause. The path is the use case or screen that produces it. |
| "No backend guard, so the API allows it" | The API's callers produce the case, and the screen that blocks it is a guard (§ *Today's rules are in the code*). |
| "Occurrence unknown: keep a defensive branch" | Unknown means nothing is built, unless the human picks *handle it* with the query in hand. |

## Red Flags

- A card whose scenario names no path that reaches it, or whose `unverified` premise reached the gate unchecked
- A question about today's behaviour put to the human
- A line window on the class whose rule a card states
- An evidence pass on a stateful entity with no lifecycle map
- A branch or test for a case the work itself says no path reaches
- A test whose state is arranged in raw SQL, or by a Mock preset to a value the domain cannot return

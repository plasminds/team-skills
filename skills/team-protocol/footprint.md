# Footprint

A run's footprint is what it changes outside the code it targets. Each item is the human's to answer. None is minor, none takes a default, and none sits only on *Settled without you*: a writer who folds one away has decided it for them.

## Classes

The `footprint` value on a gate card (`contract.md` § *Field rules*):
- `ci`: CI and infrastructure. A new or changed job, trigger, schedule, cache, matrix or shard count, a job other jobs now wait on, a workflow file, a job name a branch protection may require, the runner time it costs.
- `deps`: dependencies and licences. A new package or crate, a toolchain or version pin, a licence exception.
- `surface`: new repo surface. A package, a script or command a developer must run, generated or committed binary files, a setup step.
- `removal`: what goes beyond what the decision names. Today's features, tests, scripts, commands, env vars or files.
- `behavior`: what a user meets that differs from today. Output, timing, copy, errors, accepted formats, speed. A trade-off a writer took alone counts here.
- `your-work`: what only the human can do. Listening, screenshots, approvals, measurements on their machine, with how many times.
- `threshold`: a number that gates something (a bar, a timeout, a cap, a shard count) that a writer invented and that neither the decision nor the code gives.

Not footprint: the code's own shape (files, names, test layout), and anything the decision record or the human already ruled on.

## Fewer, not folded

The section works only while it is short: forty cards get approved unread, like forty minor items.
- **No footprint a step does not need.** A writer adds a CI job, a dependency, a removal or a threshold only when the decision asks for it or a step cannot work without it. An extra that only helps (a nightly run to catch drift, a cache, a second shard) is left out, or offered as a card whose recommended option is not to add it.
- **Each item when it bites.** A plan split into sub-plans puts on its gate only the items that shape the whole plan (behavior users meet, a removal they would miss, your own work across sub-plans) and the first sub-plan's. Every other item goes in the plan's `## Footprint` list under its sub-plan, and is asked before that sub-plan's first batch (§ *During execution*). The cover row says how many wait there.
- **Too many is a plan doing too much.** More than ~10 items for one gate, or a plan over ~800 lines, means the plan carries more than one decision. Before the gate writer, ask once: split the decision (one debate per phase, recommended), or gate it whole. The renderer warns over 10 footprint cards.

## On the gate

- **One card per item, `footprint` set.** Its `title` says what changes, concretely: "Adds a nightly scheduled CI job", not "When does the suite run?". Its `source` names the plan line or step it comes from. A card with no options of its own gets Approve and Decline.
- **Options name what they add.** An option, on any card, that adds a footprint item says so in its label ("Path-filtered per push, plus a nightly scheduled job"), and the item gets its own footprint card too.
- **Accept recommended leaves them open**, and they do not count toward the ~7 weighty cards. An auto-accept run asks them in chat (`auto-accept.md`).

## Footprint sweep

Before the gate writer, one agent (agent id `footprint`, `analyst`, sonnet, ~12 tool calls) reads the revised plan whole, sub-plans included, with the decision record's decisions and the human's rulings. It lists every item of the classes above that neither the record nor the human decided. For each one it writes the plan file and line, what happens in plain words, the class, who decided it (writer, reviewer, `settled alone`), and what undoing it would take. It merges duplicates and ranks outward-facing and hard-to-undo items first. It has no cap, marks each item `gate` or `<sub-plan>` (§ *Fewer, not folded*), and writes `footprint-sweep.md` in the run folder. A fixer takes out the extras no step needs and writes the deferred items in the plan's `## Footprint`; the gate writer turns each remaining `gate` item into one footprint card.

## During execution

- **An executor's `settled alone` choice in a class** (it wired a job, pinned a version, retired a test) goes to the human after its batch, in one message with the batch's other ones, before the next batch builds on it: keep it, or change it as a `fixup!` of its step.
- **A plan split into sub-plans** gets the sweep again before each sub-plan's first batch, against the plan as amended, its `## Footprint` list and every ruling since. Ask about that sub-plan's listed items and any new ones in one chat message, or on a page holding only footprint cards when there are more than ~7.

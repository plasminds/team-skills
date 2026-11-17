# team-acceptance templates

What each agent writes. The orchestrator copies this file and team-view's `contract.md` into the run folder and points each agent to its section.

## Cases list (cases seat)

`<run folder>/cases.md`, one block per case, in the conversation's language, ids `C1`, `C2`… in the order a reader would try them:

```
### C1 — <what the user does, as a title>
Rule: <the business rule it falls under, in the business's words; it becomes the page section>
Steps:
1. <one action the reader can repeat>
Expected: <what the screen shows after the last step>
Shows: <what the screenshots frame, one per line, at most three: an element or screen the branch adds or changes, in the state after the last step; never a screen the steps only pass through>
Data: <what must exist first, and whether it exists on the env>
Files: <repo-relative paths of the code that makes it happen>
How: <one or two lines for a developer>
Source: <the MR/PR line, ticket or commit the case comes from>
```

Each row of a decision record's `## Examples` that the branch implements is a case (the record a plan the branch follows names, or one the MR/PR links): `given` becomes its Data, `when` its Steps, `then` its Expected, and its Source is the record and the row's id `E<n>` (a record with no ids: its decision id). Only what the branch changes or adds, as a user sees it. A case nobody can see in the app (a cron, a migration) is left out and named in one line at the end, under `Not visible:`.

After the cases, `## Data plan`, for the environment step 0 named:
- **Test sets**, shared by cases wherever they can be (`P1 — <what it is>: C1, C2, C4`), and for each, the cheapest reliable way to get it: rows the env already has (the read-only query that finds them, written out), else actions in the app (the click path), else a direct write where no screen gets there (the statement, one table each, and why no screen does).
- **Order**: the order to shoot the cases in, so that a later case's changes never undo an earlier one's state.
- **Writes**: one line per write or app action that changes data, `W<n> — <env>, <table or screen>: <what>`, with what it sets off outside the app (an email, a text message, a webhook, a payment) and to whom, or `nothing outside`.
- **Commands**: each command that runs outside the sandbox (a browser on a remote env, a tunnel, a seed script).
- A case whose state no screen produces is said so, with what the data would need: the human decides at step 1 whether it stays.

## Personal-data list (personal-data seat)

`<run folder>/personal-data.md`: one line per screenshot that shows apparent personal data (names, emails, phone numbers, postal addresses, amounts tied to a person, tokens): `<file> — <what>, <where on the screen>`. End with `Looked at: <n> screenshots`. Never write "none": with no line, write `No apparent personal data in <n> screenshots`. The seat also reads the cases list's text that goes on the page (titles, steps, expected results, Data lines, the captions the maker will write) and lists apparent personal data there the same way: `<case id>, <field> — <what>`.

## Acceptance page (maker)

`.council/acceptance/<topic>/<topic>.acceptance.json`, by `contract.md` § *Acceptance pages*, in the conversation's `lang`:
- `title`: `Recette — <what the branch does>` (`Acceptance — …` in English); `branch`, `commit` (short SHA of the presented head), `date`.
- **Cover**: no `summary`, no `story`. The first context row, in `lang`: `title` what the branch does (≤ 70 characters), `why` what it brings in one line, `facts` *Environment* (the env and the test data created) and *Not shown* (the ids of the cases with an `unshown`, the reasons left on their cards, then the `Not visible:` line of the cases list), one or two sentences each. The page lists it first, then the cases in their Rule sections.
- One case per checked line of the cases list: `group` = its Rule, `steps`, `expected`, `figures` (its `Shows:` screenshots in that order, paths relative to the JSON, a caption saying what to look at), or `unshown` (why, in one sentence); a case shown in part has both, its `unshown` naming what is missing and why; `tech` from its How, Files and Data. The figures are the case's card; its steps and expected result go to the evidence pane.
- `example`: on each case that replays a record row, that row's `E<n>` from its `Source` line. A record with no ids: no `example`.
- `examples`: the top-level list, the record's rows copied verbatim (`id`, `given`, `when`, `then`), one per row the plan's branch follows, cited or not. A record with no ids: no `examples`.
- No customer data in any text: describe it ("a customer's email").

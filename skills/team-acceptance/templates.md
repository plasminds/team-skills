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
Data: <what must exist first, and whether it exists on the env>
Files: <repo-relative paths of the code that makes it happen>
How: <one or two lines for a developer>
Source: <the MR/PR line, ticket or commit the case comes from>
```

Each row of a decision record's `## Examples` that the branch implements is a case (the record a plan the branch follows names, or one the MR/PR links): `given` becomes its Data, `when` its Steps, `then` its Expected, and its Source is the record and the row's decision id. Only what the branch changes or adds, as a user sees it. A case nobody can see in the app (a cron, a migration) is left out and named in one line at the end, under `Not visible:`.

## Personal-data list (personal-data seat)

`<run folder>/personal-data.md`: one line per screenshot that shows apparent personal data (names, emails, phone numbers, postal addresses, amounts tied to a person, tokens): `<file> — <what>, <where on the screen>`. End with `Looked at: <n> screenshots`. Never write "none": with no line, write `No apparent personal data in <n> screenshots`. The seat also reads the cases list's text that goes on the page (titles, steps, expected results, Data lines, the captions the maker will write) and lists apparent personal data there the same way: `<case id>, <field> — <what>`.

## Acceptance page (maker)

`.council/acceptance/<topic>/<topic>.acceptance.json`, by `contract.md` § *Acceptance pages*, in the conversation's `lang`:
- `title`: `Recette — <what the branch does>` (`Acceptance — …` in English); `branch`, `commit` (short SHA of the presented head), `date`.
- `summary`: *What the branch brings* (one line), *Environment* (the env and the test data created), *Not shown* (each `unshown` case with its reason, and the `Not visible:` line of the cases list), as labelled bullets in `lang`.
- One case per checked line of the cases list: `group` = its Rule, `steps`, `expected`, `figures` (paths relative to the JSON, a caption saying what to look at), or `unshown`; `tech` from its How, Files and Data.
- No customer data in any text: describe it ("a customer's email").

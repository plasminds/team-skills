---
name: team-lessons
description: "Use when the question is which mistakes keep coming back across past review and refactor records (leçons des revues, refactorisations, erreurs récurrentes) and the human wants them kept as standing rules: reads the records, lists the defect kinds seen on 3+ branches or dates, and after the human's picks writes .claude/rules/<topic>.md. Not for reviewing a change: team-review. Not for one claim: team-doubt. Not for restructuring code: team-refactor."
---

# team-lessons

One review finds a defect on one branch, and one refactor finds a smell in one place. The same kind found on three branches is a habit, and a fourth finding will not break it; a standing rule, loaded whenever the files it is about are open, can. This skill reads the project's past review and refactor records, has one fresh agent group their confirmed findings and approved steps by kind, prints the kinds that recur with the record and card ids behind each, and writes the kinds the human picks as path-scoped rules under `.claude/rules/`, after one confirmation.

It reads what is present locally: records a project commits work on every machine; records left out of git only on the one that wrote them. On request only: nothing runs it after a review, and there is no card on any review gate. No page, no record: the report and the answer come back in chat, and the only files written are the rules files the human confirmed.

## When

- The user asks which mistakes keep coming back in reviews or refactors, for the lessons of past reviews, or to turn recurring findings into rules for the project.
- Review or refactor records exist: `.council/reviews/` and `.council/refactors/` by default, or the paths the user names.

Not to review a change: `team-review`. Not for one claim about code: `team-doubt`. Not to edit a rule already written: the human edits the file by hand.

## Seat

| Agent | Type | Model | Tool budget | Receives | Replies |
|-------|------|-------|-------------|----------|---------|
| Analyst | analyst | sonnet | ~40 | the record paths (step 1), the paths of the project's `CLAUDE.md` and `.claude/rules/` | its output file path and one line: `<K> kinds kept, <A> already` |

Dispatch it as `team-skills:team-analyst` if the session lists it, else `team-analyst`, else `general-purpose`, with the model, in one fresh run. Its prompt ends with the block of `team-protocol` § *Agent contract*; it batches its reads (several records per call) and writes its full output to `.council/runs/YYYY-MM-DD-lessons/`, which is deleted at the end, folder included. Running as a subagent yourself (no Agent tool): reply with the record paths and "needs team-lessons from the main session", instead of reading the records in your own context.

## Flow

1. **Scope.** The caller passes a list of record paths or folders; the defaults are `.council/reviews/` and `.council/refactors/`, `*.exec.md` excluded in both (exec briefs hold fix or step cards for executors, not findings). The report opens `Read N records, committed yes|no` (counts both types): `yes` only when every record read is tracked by git (`git ls-files`), else `no`; a folder outside git is `no`. N = 0, exact copy, and stop: `Read 0 records, committed no. No review or refactor records found in <paths>. Run team-review or team-refactor first, or pass the folder that holds them. Nothing written.`
2. **Analyst.** One `team-analyst` run (*Seat*). In a review record it reads the finding bodies of confirmed carded findings (not refuted cards, not *Not raised*). In a refactor record, only the steps the human approved count: the rows of its steps table (*Steps* or *Executed steps*; a step the decisions block declines is not one), each step's smell named from the record alone: the step's named refactoring and target, the human's decisions block and the Notes, and the finding cards or `Why:` line when the record holds them (a missing `.exec.md` or `Why:` is not a reason to skip a step); never read an `.exec.md`; Step 0 (the safety net) names no smell and is not an occurrence. Never *Considered and rejected*, *Leave alone*, *Tensions* sides not picked, *Next run*, *For team-review* lines (suspected bugs, not confirmed). An occurrence is written `<record> Step <n>` (a review occurrence stays `<record> <card id>`). A kind is one mechanism whichever record type it comes from: occurrences from review and refactor records add up toward the bar. It names each defect kind by its mechanism, not by lens, and keeps kinds seen in 3+ distinct branches, or 3+ dates when a kind sits on only two branches. A branch is derived from the record's `Owner:`, `Intent:`, scope or filename (no branch field exists). Each kept kind comes with its occurrences as `<record> <card id>` (review) or `<record> Step <n>` (refactor) and one proposed rule line; a kind the project's `CLAUDE.md` or `.claude/rules/` already holds is marked `already in <file>`. Kinds with fewer occurrences are not listed. The analyst also resolves the files each kept kind cites (step 4).
3. **Report, then picks.** Print the report before any question: the Read line; `<N> kinds recur on 3+ branches or dates.`; then per kind, numbered by branches, then findings:
   ```
   <n>  <kind>   <B> branches · <F> findings
      Rule: <line>
      Seen: <record> <card> · <record> <card> · +<k> more
   ```
   `Seen:` names 3 ids at most. A kind marked `already` is listed after them as `already in <file>`, is not offered and is not counted. No kind left to offer: `Read <N> records, committed <yes|no>. No new kind recurs on 3+ branches or dates. Nothing written.` Offer at most 16 kinds, the ones with the most branches; the rest are named in the report: `<k> more kinds not offered: pass a narrower path.`

   AskUserQuestion, multi-select, all questions in one call, the kinds split evenly across up to 4 questions with no question of one option (5 gives 3+2, 9 gives 3+3+3, 13 gives 4+3+3+3); a single kind is one question `Write this rule?` with options `Write it` and `Write nothing`. Per question: header `Kinds <a>-<b>`; text `Which kinds become standing rules? Pick any; none writes nothing.`; per option, label `<n> <kind, 5 words at most>`, description `<B> branches · <F> findings. <rule line>`. No pick, whatever the count, writes nothing, and the answer says `Picked none. Nothing written.`; a free-text answer counts as no pick: `Ignored the free-text answer: pick from the list.`

   A launched session (`team-protocol` § *Handoff*) has no AskUserQuestion: the skill writes the report and the question in chat, `Which of these kinds become standing rules? Reply with their numbers; none writes nothing.`, and ends its turn. The picks arrive in the next message.
4. **Confirm, then write.** After the picks, one confirmation (AskUserQuestion, `Write these rules?`, options `Write` and `Write nothing`; in chat in a launched session, ending the turn again) shows each target file, its `paths:` and the exact lines. Only a yes writes. The orchestrator writes the files itself. Each goes to `.claude/rules/<topic>.md` in the project; a refused write is reported, not retried another way.

   Before the confirmation shows any `paths:` glob, the analyst resolves each cited file name to its repo-relative path (cards cite bare names such as `ArrangementGrid.vue:734` and package-relative ones such as `commands/command-blockers.ts`); a name it cannot resolve to one path gives no glob: that kind's lines go in `review-lessons.md`, and the confirmation says they load always. One file per top-level folder of the cited files, named after it in lowercase (`src/billing/…` gives `billing.md`); a kind citing several top-level folders goes in `review-lessons.md` with the union of their globs; a root file is its own glob; never a bare `**`. A new file is exactly:
```
---
paths:
  - "<folder>/**"
---
- <rule line>
```
   One bullet per rule, no heading, no record ids (they go stale). An existing file gets only the lines it lacks (exact text after trimming; a reworded rule is appended), its `paths:` widened by the globs it lacks; a file with no frontmatter gets no `paths:` block (it loads always; the confirmation says so) and only its missing lines. `CLAUDE.md` is never touched.
5. **Answer** in chat, exactly: `Picked <p> of <N> kinds. Wrote <f> file(s), <r> rule(s).`, then one line per file `  <path>   paths: <globs>   created|appended: <n> lines, <m> globs`, then `CLAUDE.md untouched. Edit a file by hand to change a rule or a glob.` A confirmation answered `Write nothing`: `Nothing written.` No page, no record. Delete the run folder.

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "I'll write the rules before asking, the kinds are obvious" | The picks and the confirmation are the human's. Nothing is written before both. |
| "Put them in `CLAUDE.md`, it is simpler" | The human settled it before drafting: path-scoped rules load only when the files match. `CLAUDE.md` is never touched. |
| "A kind seen twice is enough" | The bar is 3 branches or dates. Two is a coincidence the report does not list. |

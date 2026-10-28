# Code scope

For a caller that reads existing code (team-refactor, team-review). The caller names its brief, which lines it counts, how Recon ranks a whole repo, and the seats that always run whatever the size.

- **Size.** Under ~150 lines, write the brief yourself by the caller's template instead of dispatching Recon. Above ~3,000 lines, or more than one package, narrow the scope before dispatching the panel.
- **Narrowing.** For the whole repo, or a scope over that cap, dispatch Recon first to rank zones by the caller's criteria. Then ask the user to pick, with the ranking in the question: each option carries its size and its main risk, and one is marked *(Recommended)*. When the profile's *Run preferences* say `Oversized scope: all zones` (`team-scan`), skip the question: take every zone by `execution.md` § *Sweep* and list them in one line. A pick of *all of them* records that line.
- **Recon writes its brief to a file.** Dispatch it as `team-analyst` (`team-protocol` § *Dispatch*); without it, a general-purpose agent, or a code-exploration agent from the profile's Technical domain that has Write. The built-in `Explore` has no Write; if you use it, save its reply to the run folder yourself.
- **The brief** stays under ~40 lines, plus the excerpts, at most ~200 lines in all. Its quality-gate commands go in **verbatim as Recon ran them**, each with its result. No placeholders: a command nobody ran is not a gate.
- **Records first.** Recon reads every record under `.council/reviews/` and `.council/refactors/` that names a file in scope, and lists under *Settled*, one line each: refuted cards with what refuted them, findings left as known debt, rejected cards, *Leave alone* items, declined items with the CEO's note. A card that restates a *Settled* line is not raised again unless it cites evidence the record did not have. Recon starts from the latest such record's *Quality gates* and reruns them.
- **Gates cover the scope.** Recon checks that the lint and typecheck commands reach every file in scope (the `tsconfig` `include`, the linter's file patterns, the CI job's paths) and lists the files they miss under *Ungated* (a gate whose tool is missing is `Ungated: <gate> (tool missing)`, in the brief and the verdict line): a check that never runs on a file passes for it. A gate that fails repo-wide also gets a touched-files form, run on the scope (e.g. `npx prettier --check <files>`).
- **Known flakes.** Recon copies the profile's `## Known flakes` into the brief and adds each test that failed, then passed on a rerun, during its own runs. Recon copies the profile's `## Environment limits` into the brief and does not attempt what they block.
- **Diff guard.** Recon writes the brief's *Diff guard*: the commands each executor runs on its staged change before a commit (§ *Execution*), with the profile's formatter (prettier, biome, ruff, gofmt) in the third line, or without that line when the project has none. Recon runs that check on the files in scope first and lists those already failing under *Unformatted*; the third line leaves them out.
  ```bash
  P='eslint-disable|@ts-ignore|@ts-expect-error|(istanbul|c8|v8) ignore|noqa|type: ?ignore|pragma: no cover'; a=$(git -C <repo> diff --cached -U0 | grep -cE "^\+[^+].*($P)"); d=$(git -C <repo> diff --cached -U0 | grep -cE "^-[^-].*($P)"); [ "$a" -gt "$d" ] && echo "GUARD: suppression added ($a added, $d removed)"
  git -C <repo> diff --cached --name-only
  <the formatter's check on those files, e.g. npx prettier --check --ignore-unknown $(git -C <repo> diff --cached --name-only --diff-filter=d)>
  ```
  The first command prints nothing on a clean change (a moved suppression is not an added one); the second lists the staged files, to hold against the card's *Fence* and its named files.


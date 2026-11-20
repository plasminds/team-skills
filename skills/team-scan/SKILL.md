---
name: team-scan
description: Use before the first run of any other team-* skill in a project (team-debate, team-plan, team-kickoff, team-refactor, team-review, team-acceptance, team-deck, team-video), when `.council/project-profile.md` is missing, or when the stack, conventions, installed skills or agents have changed since the profile was written.
---

# team-scan

Produces the project profile that every team-* skill reads. Run it once per project, again when the stack, conventions or skills change. Re-running overwrites `.council/project-profile.md`, except its `## Constraints`, `## Known flakes`, `## Environment limits`, `## Run preferences` and a user-corrected `## Expected load`, which it keeps (see *Procedure*); git tracks history.

## What to detect

1. **Tech stack** — languages, frameworks, package manager, build tools, test runner. Read `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` etc., lockfiles, and config files (`vite.config`, `tsconfig`, `vitest.config`, CI files). Also dead-code and dependency-graph tools (`knip`, `ts-prune`, `madge`, `dependency-cruiser`, `vulture`, `deptry`) in the dependencies or config, with the command that runs each. Also security tools (`npm audit`, `osv-scanner`, `semgrep`, `gitleaks`, `bandit`) in the dependencies, config or CI, with the command that runs each.
2. **Conventions** — `CLAUDE.md`, `AGENTS.md`, lint/format config (eslint, prettier, biome, ruff), architecture patterns, directory layout, naming conventions. Also the launch command, in this order, the first found wins: a `package.json` script `dev`, `start` or `serve`; a Makefile or justfile target `run`, `dev` or `serve`; a compose file; the README's run block. Record the command with its source `file:line`; nothing found → `Launch: none found`. A hand-edited launch line is overwritten on rescan. The command is only written down: team-scan launches nothing, and nothing runs it.
3. **Available specialists by domain** — take the skills, agent types and MCP servers your session lists (that covers personal, project and plugin installs alike), and map each to a team-role domain by what its description says it does:
   - **UX domain**: interface design, visual critique or audit, accessibility, UX copy, motion
   - **Technical domain**: testing, debugging, code search and exploration, language or framework best practices, plus the project's lint/typecheck/test commands
   - **Process domain**: brainstorming, planning, executing plans, reviews
   - **Project-specific**: agents, MCP servers and skills that only make sense for this project (a database MCP, a deploy skill)

   Leave out what fits no domain (document formats, config helpers). The `team-*` skills and agents are not specialists.
4. **Other models** — `codex` and `gemini` on PATH (`command -v`), with `--version`. Detect only: never send them a prompt here. The debate's off-model seat (`team-protocol`) uses what you find.
5. **Project phase** — git history depth, existing plans (signal 9), maturity signals.
6. **Decision records** — an existing folder of architecture decisions (`docs/adr/`, `docs/decisions/`, `doc/architecture/decisions/`, or the path in `.adr-dir`): its format (MADR, Nygard, adr-tools), numbering and headings. Debate decisions under `.council/decisions/`.
7. **Team preferences** — memory files, feedback patterns, design docs, and a standing answer on the off-model seat if the user gave one.
8. **Standing constraints** — the `tech` rules later work must not break (`team-protocol` § *Bridge*): dependency directions and import rules, public contracts, folder conventions, stated in `CLAUDE.md` or `AGENTS.md`, or recorded in the decision records (a debate record's `## Constraints`, the project's ADRs). Only rules that pass "what happens if we break it?"; a style preference is not one.
9. **Run preferences** — `Commit records: no` when `git check-ignore -q .council/decisions/x` succeeds (source: the `.gitignore` line it prints with `-v`). `Plan location`: a folder that already holds plans (`docs/plans/`, `docs/superpowers/plans/`, or one `CLAUDE.md` names; source: that folder), else `.council/plans/` (source: `default`), so a plan never opens a new folder beside a gitignored `.council/`. The other lines come from the user's answers during runs, never from a guess.
10. **Expected load** — who runs the code and how many at once: one person running a script or CLI, one server process, or several instances or workers sharing a store, with data sizes where stated. Read the README, the deploy config (Dockerfile, compose, Kubernetes replicas, Procfile, serverless config, queue workers, cron) and the CI. The reviewers judge races and scale against it. Nothing states it → your best read, marked `assumed`.
11. **Machine tools** — `crapper`, `dryer`, `ast-grep`, `gitleaks` and `osv-scanner`, each by `command -v` and a probe that must succeed: `ast-grep`, `gitleaks` and `osv-scanner` by `--version`; `crapper` and `dryer` have no version command, so by `--help` exiting 0, and are named without a version. Nothing else runs; team-scan records only. A tool that is not on PATH is `not found`; one on PATH whose probe fails is `failing`. A failing tool still counts as absent for use, and is named apart from one never installed only in the summary line, never in the profile. The profile line lists found tools only, as a hint; each seat re-checks. The run recipes sit in `machine-tools.md`, not here. Sources, cited in the summary for a tool not found or failing:
    - crapper — github.com/unclebob/crapper (Uncle Bob's; no release, its README says how to install)
    - dryer — github.com/unclebob/dryer (Uncle Bob's; no release, its README says how to install)
    - ast-grep — github.com/ast-grep/ast-grep
    - gitleaks — github.com/gitleaks/gitleaks
    - osv-scanner — github.com/google/osv-scanner
12. **Layer practices** — for each layer the code has (data access, entry points such as controllers or queue readers, presenters or DTOs, tests per level), how its files do the layer's job. List the layer's files by folder or suffix (`infra/secondary/*Repository.ts`), count each way by a grep for its marker (a base class or a wrapper it builds, a query API, a mapping call), and name one typical file per way. The way most files take is the practice; each other way follows with its count. Count, never rank: which way is better is not the scan's call.

## Procedure

1. Confirm the target directory (default: cwd). In a git worktree, look at its siblings first (§ *Sibling worktrees*).
2. Gather the signals above with read-only tools. Prefer batched, non-interactive commands; do not modify project files other than the profile.
3. Write `.council/project-profile.md` using the output format below. Create `.council/` if absent. If a profile exists, keep its `## Constraints` lines as they are (ids, status, `lifted by` marks) and add the new ones with the next free `KS<n>` id (a rule already listed, `lifted by` ones included, is not new): a standing constraint is never renumbered or deleted. Keep its `## Known flakes`, `## Environment limits` and `## Run preferences` lines as they are too, and its `## Expected load` line when its source is `the user`.
4. Report a one-line summary and the profile path. The summary gains one machine-tools clause, the found tools first, then `; not found: <tools>` and `; failing: <tools>`, each empty clause left out; `none found` takes the place of the found tools when no tool answered its probe; `all five` may stand for the five names when a clause holds all of them. One line per state:
   - all found: `machine tools: all five found`
   - some not found: `machine tools: gitleaks, ast-grep; not found: crapper, dryer, osv-scanner`
   - some failing: `machine tools: gitleaks, ast-grep, dryer, osv-scanner; failing: crapper`
   - mixed: `machine tools: gitleaks, ast-grep; not found: dryer, osv-scanner; failing: crapper`
   - none found, none failing: `machine tools: none found; not found: all five`
   - none found, all failing: `machine tools: none found; failing: all five`
   - none found, some failing: `machine tools: none found; not found: dryer, osv-scanner; failing: crapper`

   When the clause names a tool not found or failing, a second line cites the source of each, from step 11, in the clause's order: `sources: dryer — github.com/unclebob/dryer (Uncle Bob's); osv-scanner — github.com/google/osv-scanner; crapper — github.com/unclebob/crapper (Uncle Bob's)`. Never an install command.

## Output: `.council/project-profile.md`

```markdown
# Project Profile — {project name}
_Generated by team-scan on {date}_

## Stack
- Language(s), framework(s), package manager, build, test runner

## Conventions
- Quality gates (lint/typecheck commands), architecture patterns, naming, key CLAUDE.md rules
- Launch: <command that starts the app locally> — <source: file:line>, or `Launch: none found`
- Dead-code and dependency-graph tools present in the project (e.g. `knip`, `ts-prune`, `madge`, `dependency-cruiser`, `vulture`, `deptry`), each with the command that runs it
- Security tools present in the project (e.g. `npm audit`, `osv-scanner`, `semgrep`, `gitleaks`, `bandit`), each with the command that runs it
- Machine tools (machine, a hint; each seat re-checks): <tool> <version>, … (a tool without a version command: `<tool> (no version)`; or `none found`)

## Layer practices
How most files of each layer do its job, counted; a plan or a refactor that departs from one makes a structural choice (`team-protocol` § *Structural choices*). One line per layer:
- <layer> (<folder or suffix>): <the practice> — <n>/<total> files, e.g. <file>; also: <other way> (<n>, e.g. <file>)

## Available Specialists (by domain)
One line each: `<name> — what it is for` (e.g. "writes plans", "executes plans", "TDD", "code exploration"), so a caller can pick the one it needs.
- UX: <mapped skills/agents>
- Technical: <mapped skills/agents + lint/typecheck commands>
- Process: <mapped skills/agents>
- Project-specific: <custom agents, MCP tools>

## Other Models
- `<cli> <version>` per CLI found, or "none"

## Project Phase
- Maturity, git depth, existing plans/decisions

## Expected load
One line; reviewers judge races and scale against it:
- <who runs it, how many at once, data sizes> — <source: file:line | assumed | the user>

## Decision Records
- The project's own: location, format, numbering (e.g. "docs/adr/, MADR, NNNN-title.md"), or "none"
- Debate decisions: count and latest under .council/decisions/

## Team Preferences
- Memory/feedback/design-doc signals worth carrying into debates
- Off-model seat: yes | no | ask (default: ask)

## Constraints
Standing `tech` constraints (`team-protocol` § *Bridge*), one line each, ids stable across runs:
- KS1 — <the rule> — <source: a decision record or plan path, or a CLAUDE.md line> — confirmed | lifted by <record path>

## Known flakes
Tests that fail, then pass on a rerun, one line each; an executor counts a red one as green only when its brief lists it (`team-protocol` § *Execution*):
- <test name or file:line> — <what makes it flaky, e.g. wall-clock timing under load> — <first seen: record path>

## Environment limits
What this machine or sandbox cannot run (sandbox limits, missing tools), one line each; a gate that needs one is `Ungated`:
- <limit> — <the gate it blocks>

## Run preferences
Standing answers to questions a run would otherwise ask every time; a run follows the line instead of asking. A missing line means ask, then record the answer here:
- Commit records: yes | no — <source: .gitignore:<line> | the user, <date>>
- Plan location: <folder> — <source: the folder found | default | the user, <date>>
- Oversized scope: all zones | ask — <source>
- Squash after execution: branch | run | none — <source>
- Next step: launch | paste — <source>
- Dependency scan (osv-scanner, sends the package list to api.osv.dev): yes | no — the user, <date>
- Data evidence envs: <envs, read-only>; <how to reach each: a client, a tunnel> — the user, <date>
- Recette writable envs (team-acceptance, team-video): <envs>; third-party services <isolated|not isolated> — the user, <date>
- Recette outbox (team-acceptance): <env>: <where it keeps what the app sends>; … — the user, <date>
- Brand (team-deck, team-video; default: <repo name>; none; neutral; the source's lang): <name>; <logo path from the root | none>; <#primary> [<#secondary>] [<#surface>] | neutral; <lang | source> — the user, <date>[, default taken]
```

## Sibling worktrees

A project checked out as one worktree per branch, with `.council/` gitignored, holds a profile in some worktrees and none in the others. Before scanning a worktree without one, list the others (`git -C <worktree> worktree list --porcelain`) and copy the newest `.council/project-profile.md` among them (`ls -t <each path>/.council/project-profile.md`), with its `.council/role-overrides/` if present, in one Bash call. Say so in one line (`profile copied from <worktree>`). It stands as this worktree's profile: scan only when no sibling has one, or the user asks.

## Notes
- Keep the profile to facts, one line each: it is injected into every agent's context.
- If a domain has no specialist, write "none"; the debate still runs.
- `## Constraints` also grows at plan approval (`team-plan` appends the new `tech` constraints), and is read by every debate framing, the plan reviewers and the gate writers. A constraint lifted at a gate is marked `lifted by <record path>`, never deleted.
- `## Known flakes` grows at each team-review or team-refactor gate: the record writer appends the flakes its Recon saw. Remove a line only when its test is fixed.
- `## Run preferences` grows when a run asks one of its questions: the orchestrator writes the user's answer as the line, source `the user, <date>`. A line changes only when the user says otherwise. team-scan never writes the `Dependency scan` line itself: the orchestrator asks and records it before Recon, by `machine-tools.md`, and the line is changed by editing it. team-scan never writes the `Brand` line either: the first of team-deck or team-video to run asks, in its opening question block, and records the answer in this section; with no answer it records the default above, source `the user, <date>, default taken`, so the question is asked once. The `Brand` colours are the primary, then an optional secondary and an optional surface, space-separated; a missing secondary takes the primary, a missing surface takes the primary mixed 8% into white; `neutral` means no brand colour. `<repo name>` is the last path segment of `git remote get-url origin`, `.git` stripped; with no `origin`, the folder that holds `git rev-parse --path-format=absolute --git-common-dir` (the parent of `.git` or `.bare`), never a worktree's own folder.
- The `Machine tools` line lists the found tools with versions (`crapper (no version)` for one without a version command, e.g. `gitleaks 8.30.1, ast-grep 0.51.1, crapper (no version)`), or `none found` when no tool answered its probe; it never names a tool not found or failing (that split is the summary line's only), and never says how to get a tool.
- `## Layer practices` is rewritten on every scan, from the code. A profile without it (written before it existed) gets the lines a run needs from item 12, counted by its evidence pass or Recon (`bridge.md` § *Departures*).
- `## Expected load` is corrected at a team-review gate when the human's note corrects it: the record writer replaces the line, source `the user`.

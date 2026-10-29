---
name: team-scan
description: Use before the first team-council, team-council-plan, team-kickoff, team-refactor or team-review run in a project, when `.council/project-profile.md` is missing, or when the stack, conventions, installed skills or agents have changed since the profile was written.
---

# team-scan

Produces the project profile that every council skill reads. Run it once per project, again when the stack, conventions or skills change. Re-running overwrites `.council/project-profile.md`, except its `## Constraints`, `## Known flakes`, `## Environment limits`, `## Run preferences` and a user-corrected `## Expected load`, which it keeps (see *Procedure*); git tracks history.

## What to detect

1. **Tech stack** — languages, frameworks, package manager, build tools, test runner. Read `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` etc., lockfiles, and config files (`vite.config`, `tsconfig`, `vitest.config`, CI files). Also dead-code and dependency-graph tools (`knip`, `ts-prune`, `madge`, `dependency-cruiser`, `vulture`, `deptry`) in the dependencies or config, with the command that runs each. Also security tools (`npm audit`, `osv-scanner`, `semgrep`, `gitleaks`, `bandit`) in the dependencies, config or CI, with the command that runs each.
2. **Conventions** — `CLAUDE.md`, `AGENTS.md`, lint/format config (eslint, prettier, biome, ruff), architecture patterns, directory layout, naming conventions.
3. **Available specialists by domain** — take the skills, agent types and MCP servers your session lists (that covers personal, project and plugin installs alike), and map each to a team-role domain by what its description says it does:
   - **UX domain**: interface design, visual critique or audit, accessibility, UX copy, motion
   - **Technical domain**: testing, debugging, code search and exploration, language or framework best practices, plus the project's lint/typecheck/test commands
   - **Process domain**: brainstorming, planning, executing plans, reviews
   - **Project-specific**: agents, MCP servers and skills that only make sense for this project (a database MCP, a deploy skill)

   Leave out what fits no domain (document formats, config helpers). The `team-*` skills and agents are not specialists.
4. **Other models** — `codex` and `gemini` on PATH (`command -v`), with `--version`. Detect only: never send them a prompt here. The council's off-model seat (`team-protocol`) uses what you find.
5. **Project phase** — git history depth, existing plans (signal 9), maturity signals.
6. **Decision records** — an existing folder of architecture decisions (`docs/adr/`, `docs/decisions/`, `doc/architecture/decisions/`, or the path in `.adr-dir`): its format (MADR, Nygard, adr-tools), numbering and headings. Council decisions under `.council/decisions/`.
7. **Team preferences** — memory files, feedback patterns, design docs, and a standing answer on the off-model seat if the user gave one.
8. **Standing constraints** — the `tech` rules later work must not break (`team-protocol` § *Bridge*): dependency directions and import rules, public contracts, folder conventions, stated in `CLAUDE.md` or `AGENTS.md`, or recorded in the decision records (a council record's `## Constraints`, the project's ADRs). Only rules that pass "what happens if we break it?"; a style preference is not one.
9. **Run preferences** — `Commit records: no` when `git check-ignore -q .council/decisions/x` succeeds (source: the `.gitignore` line it prints with `-v`). `Plan location`: a folder that already holds plans (`docs/plans/`, `docs/superpowers/plans/`, or one `CLAUDE.md` names; source: that folder), else `.council/plans/` (source: `default`), so a plan never opens a new folder beside a gitignored `.council/`. The other lines come from the user's answers during runs, never from a guess.
10. **Expected load** — who runs the code and how many at once: one person running a script or CLI, one server process, or several instances or workers sharing a store, with data sizes where stated. Read the README, the deploy config (Dockerfile, compose, Kubernetes replicas, Procfile, serverless config, queue workers, cron) and the CI. The reviewers judge races and scale against it. Nothing states it → your best read, marked `assumed`.

## Procedure

1. Confirm the target directory (default: cwd). In a git worktree, look at its siblings first (§ *Sibling worktrees*).
2. Gather the signals above with read-only tools. Prefer batched, non-interactive commands; do not modify project files other than the profile.
3. Write `.council/project-profile.md` using the output format below. Create `.council/` if absent. If a profile exists, keep its `## Constraints` lines as they are (ids, status, `lifted by` marks) and add the new ones with the next free `KS<n>` id (a rule already listed, `lifted by` ones included, is not new): a standing constraint is never renumbered or deleted. Keep its `## Known flakes`, `## Environment limits` and `## Run preferences` lines as they are too, and its `## Expected load` line when its source is `the user`.
4. Report a one-line summary and the profile path.

## Output: `.council/project-profile.md`

```markdown
# Project Profile — {project name}
_Generated by team-scan on {date}_

## Stack
- Language(s), framework(s), package manager, build, test runner

## Conventions
- Quality gates (lint/typecheck commands), architecture patterns, naming, key CLAUDE.md rules
- Dead-code and dependency-graph tools present in the project (e.g. `knip`, `ts-prune`, `madge`, `dependency-cruiser`, `vulture`, `deptry`), each with the command that runs it
- Security tools present in the project (e.g. `npm audit`, `osv-scanner`, `semgrep`, `gitleaks`, `bandit`), each with the command that runs it

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
- Council decisions: count and latest under .council/decisions/

## Team Preferences
- Memory/feedback/design-doc signals worth carrying into council debates
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
```

## Sibling worktrees

A project checked out as one worktree per branch, with `.council/` gitignored, holds a profile in some worktrees and none in the others. Before scanning a worktree without one, list the others (`git -C <worktree> worktree list --porcelain`) and copy the newest `.council/project-profile.md` among them (`ls -t <each path>/.council/project-profile.md`), with its `.council/role-overrides/` if present, in one Bash call. Say so in one line (`profile copied from <worktree>`). It stands as this worktree's profile: scan only when no sibling has one, or the user asks.

## Notes
- Keep the profile to facts, one line each: it is injected into every council agent's context.
- If a domain has no specialist, write "none"; the council still runs.
- `## Constraints` also grows at plan approval (`team-council-plan` appends the new `tech` constraints), and is read by every council framing, the plan reviewers and the gate writers. A constraint lifted at a gate is marked `lifted by <record path>`, never deleted.
- `## Known flakes` grows at each team-review or team-refactor gate: the record writer appends the flakes its Recon saw. Remove a line only when its test is fixed.
- `## Run preferences` grows when a run asks one of its questions: the orchestrator writes the user's answer as the line, source `the user, <date>`. A line changes only when the user says otherwise.
- `## Expected load` is corrected at a team-review gate when the human's note corrects it: the record writer replaces the line, source `the user`.

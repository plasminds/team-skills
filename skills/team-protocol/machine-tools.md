# Machine tools

For a caller that runs machine tools (team-review, team-refactor Recon): crapper, dryer, ast-grep, gitleaks, osv-scanner. A tool is a lead source, not a gate.

Where each comes from, cited wherever a tool is named not found:

- crapper — github.com/unclebob/crapper (Uncle Bob's; no release, its README says how to install)
- dryer — github.com/unclebob/dryer (Uncle Bob's; no release, its README says how to install)
- ast-grep — github.com/ast-grep/ast-grep
- gitleaks — github.com/gitleaks/gitleaks
- osv-scanner — github.com/google/osv-scanner

## Run-time re-check

Whatever the profile says, before using a tool run `command -v <tool>` and its version command: `--version` for ast-grep, gitleaks and osv-scanner; `--help` (exit 0) for crapper and dryer, which have no version and are named `<tool> (no version)`. A miss, a probe that fails, or a `command -v` that resolves inside the project tree or the run folder counts as absent (a shell without `command -v` is a miss). An absent tool is skipped, never a finding or an error, and never retried. Its lead list says `<tool> — not run (<reason>); see Environment limits`, and the seat's summary line names it.

One exact line per state, in the brief's Environment limits:

- `- crapper — not found (github.com/unclebob/crapper); complexity leads skipped` (any tool: its source from the list above)
- `- crapper — --help failed; complexity leads skipped` (ast-grep, gitleaks, osv-scanner: `version check failed`)
- `- crapper — dirtied the tree; complexity leads labelled`
- `- osv-scanner — dependency scan declined (Run preferences: no); nothing sent`
- `- osv-scanner — dependency scan not asked (no Run preferences line); package list not sent`
- `- osv-scanner — api.osv.dev unreachable or lockfile unreadable (exit 127); dependency leads skipped`
- `- osv-scanner — no lockfile found; dependency leads skipped`

For a machine tool this line wins over `Ungated: <gate> (tool missing)` (`scope.md:10`), which stays for quality gates.

## Read-only runs

Every output goes to the run folder; the seat leaves the tree as found.

- Paths are absolute: `<repo>` is `git -C <repo> rev-parse --show-toplevel`, the scope `<repo>/<scope>`. A relative path resolves against `--root`, not the cwd.
- Never run coverage. crapper takes `--use-existing-coverage` when the project has an `lcov.info`, else `--no-coverage`.
- Inside a git repo, run `git -C <repo> status --porcelain --ignored -- . ':(exclude)<run folder>'` before the runs and after. A difference goes in the brief and in the state line above; that tool's leads are labelled; nothing is cleaned up. Skipped outside a git repo.
- Fail closed: a failing exit, a missing output file or a timeout skips the tool with one Environment limits line holding the exit status, no stderr pasted, no retry. Exit 1 is a result, not a failure, for gitleaks (leaks found), ast-grep (no match, 0 leads) and osv-scanner (vulnerabilities found). Any other non-zero exit fails closed.
- Repo-controlled values (scope, repo path, branch name, file names) are quoted, and `--` precedes positional paths.

## Run recipes

Scope is the brief's scope; the seat fills `<run folder>`.

- **crapper**: `crapper --root <run folder> -s <repo>/<scope> --no-coverage`. With an `lcov.info`, copy it (never move) to `<run folder>/coverage/lcov.info`, then `crapper --root <run folder> -s <repo>/<scope> --use-existing-coverage`; the mode line says `coverage: yes (lcov.info copied)` only when the report shows a non-zero Cov% somewhere, else `coverage: no (lcov paths not matched)`. It writes `<run folder>/.metrics/crap.edn`. It scores generated code (no exclude option); the mode line says so.
- **dryer**: whole tree, `dryer --root <run folder> --min-lines 8 <repo>`; it writes `<run folder>/.metrics/dry.edn`. Keep only the pairs with at least one side in the scope and not in the run folder. `--changed` is not used (it missed a planted copy).
- **gitleaks**: `--redact` always. With a base: `gitleaks git --redact -r <run folder>/gitleaks.json --log-opts="<base>..HEAD" <repo>`. `<base>` is a commit SHA resolved first (`git rev-parse --verify`), never a branch name: for team-review the branch's merge base. For a path audit there is none: run `gitleaks dir --redact -r <run folder>/gitleaks.json <repo>` (working tree) and say so in the mode line. `gitleaks git` without `--log-opts` scans every ref's history and is not used. Drop leads whose file is under the run folder. The run folder may be committed.
- **ast-grep**: always the explicit `-c`. Recon writes this to `<run folder>/sgconfig.yml`, then runs `ast-grep run -p '<pattern>' -c <run folder>/sgconfig.yml -l <scope language> <repo>/<scope>` (`ts` for TS/JS; `-c` only when the scope holds `.vue`; `--json=compact` may be added for a parseable list). Recon chooses the patterns, for the scope's hotspots or the shapes the brief's Intent names; the `defineProps<$T>()` line is an example, never a sweep. It writes nothing.

  ```yaml
  languageGlobs:
    html: ["*.vue"]
  languageInjections:
  - hostLanguage: html
    rule: { pattern: "<script $$$ATTRS>$CONTENT</script>" }
    injected: ts
  ```

- **osv-scanner**: runs only when the brief carries `yes` from the profile's `Dependency scan (osv-scanner, sends the package list to api.osv.dev): yes` line. The orchestrator asks before Recon, once, when the line is missing and the profile names osv-scanner: `Scan this project's dependencies with osv-scanner? It sends the package names and versions from your lockfiles to api.osv.dev (an online vulnerability database). Your source code is not sent.`, options `Yes, scan dependencies` / `No, skip the dependency scan`; it records the answer as that line (`yes | no — the user, <date>`). To change it later, edit that line. Recon never asks. No line and no way to ask (headless launch, auto-accept): skipped, nothing recorded, the not-asked line. `no`: skipped, the declined line. Command, once per lockfile at the repo root (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, others osv-scanner reads): `osv-scanner scan source -L <lockfile> --format json --output-file <run folder>/osv-<lockfile>.json`; the leads from all files are merged. Exit 127 is the unreachable line (the JSON written is ignored). No lockfile at the repo root: the no-lockfile line, without running.
- The repo's own config (`.gitleaks.toml`, `.gitleaksignore`, `osv-scanner.toml`) is not overridden: it is the project's declaration, and the mode line names any the tool loaded.

## Mode line

Each lead list opens with one line: `<tool> <version>; scope <scope>; filter <none|…>; <tool-specific>; <note>`, plus `.vue not read` when the scope holds SFCs (crapper and dryer skip `.vue`), plus `config: <file> loaded` when a repo config was read. One example per tool:

- `crapper (no version); scope src/orders; filter none (generated code scored); coverage: no (complexity only, not weighted by tests); .vue not read`
- `dryer (no version); scope src/orders; whole tree, pairs touching scope; min-lines 8; .vue not read`
- `gitleaks 8.30.1; range main..HEAD; values redacted` (no base: `working tree, no range`)
- `ast-grep 0.51.1; scope src/orders; pattern defineProps<$T>(); .vue read via sgconfig.yml`
- `osv-scanner 2.7.0; lockfiles package-lock.json; sent to api.osv.dev (Run preferences: yes)`

A run with no hits says `…; 0 leads`; a tool that did not run gets its one line from *Run-time re-check*. A complexity-only crapper ranking stays in Recon, labelled `coverage: no`.

## Leads, not findings

A hit is a lead; a seat verifies each by hand before citing it (same rule as `skills/team-review/templates.md:19`). gitleaks hits are mostly false positives, and its leads cite file, line and rule id only, never the matched text.

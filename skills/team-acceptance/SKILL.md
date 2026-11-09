---
name: team-acceptance
description: "Use when a pushed branch whose change shows in the app needs an acceptance page (recette, cahier de recette) to present it: each case with its steps, its expected result and screenshots taken on a running environment, in one page with a business view and a technical one. Also when the user asks for a recette, an acceptance page, or screenshots of what a branch does. Not for deciding or reviewing anything: team-review."
---

# team-acceptance

Presents what a pushed branch does, case by case: the steps, the expected result and the screenshots, taken by an agent on a running environment, in one self-contained page with a Business view (the default) and a Technical one. Nothing on the page is decided and nothing comes back from it: it is read, printed or sent.

**REQUIRED BACKGROUND:** follow `team-protocol` for dispatch, writers, the run folder and the agent contract. The page is rendered by `team-view` (`contract.md` § *Acceptance pages*).

## Iron Laws

1. **No write without a yes.** Test data goes only to an environment the profile allows, after the human approved the list of writes and commands (step 2).
2. **No screenshot leaves unchecked.** The personal-data list (step 4) runs before the page is sent or attached anywhere.
3. **Show, don't judge.** A case says what we do and what we expect, and shows it. No verdict, no recommendation, no option.

## Seats

| Agent | Type | Model | Tool budget | Receives | Writes by `templates.md` |
|-------|------|-------|-------------|----------|--------------------------|
| Cases | analyst | sonnet | ~25 | branch, base, MR/PR, profile | *Cases list* |
| Maker | maker | sonnet | ~60 | the checked cases list, the agreed writes, `contract.md` | the capture script, the data, the screenshots, *Acceptance page* |
| Personal data | analyst | sonnet | ~2 per screenshot | the screenshots and the cases list's page text | *Personal-data list* |

## Flow

### 0. Preconditions
- The branch is pushed: `git -C <checkout> status -sb` shows nothing ahead of its upstream. Not pushed → ask the human to push, and stop.
- An environment runs the pushed head. Ask the human which one, and check the version it serves when the app shows one (a `/version` route, a footer, the CI deploy job). Another commit → stop and say so, before any write.
- The profile's `## Run preferences` has `Recette writable envs`. Missing → ask once, with a proposal drawn from the stack (a local database, a review app, staging; never production), and add the line `- Recette writable envs: <envs>; third-party services <isolated|not isolated> — the user, <date>`.
- The work folder is `.council/acceptance/<topic>/`, `<topic>` the branch name with `/` → `-`.

### 1. Cases
The cases seat reads the diff against the base, the commits, the MR/PR and its linked ticket when there is one, and the project's run instructions, and writes the *Cases list*. Show it to the human in chat, one line per case (`C1 — <title>: <expected>`), and take their edits. It is a check in chat, not a page decision: the page has none.

### 2. Writes, agreed
In one chat message, list the data each case needs and on which environment (one listed in `Recette writable envs`, else stop and ask), and every command that runs outside the sandbox (a browser on a remote env, an `aws ssm` tunnel, a `seed:*` script), each to be run as a single plain command. Wait for a yes. The yes covers these writes and commands only; it is never consent to a permission prompt. No to the writes → ask, in one line, whether the listed commands may still run to shoot the data already in place; step 3 then shoots only that data, and every case that needs a refused write or command gets `unshown`. A command never runs without its own yes.

### 3. Captures
The maker writes a Playwright script in `.council/acceptance/<topic>/shoot/` (the project's own Playwright; team-skills ships no browser), creates the agreed data, and saves each case's screenshots in `.council/acceptance/<topic>/<topic>/` (`c1-<what>.png`). A case it cannot shoot keeps its line, with `unshown: <why>`; the run goes on.

### 4. Personal data
A fresh personal-data seat, which saw none of the above, looks at every screenshot and writes the *Personal-data list*. It also reads the cases list's text that goes on the page (titles, steps, expected results, Data lines, the captions the maker will write) and lists apparent personal data there as `<case id>, <field> — <what>`. Show it to the human; for each line, keep, blur (the maker re-shoots with Playwright's `mask` on the named elements) or remove (the case gets `unshown`). A screenshot re-shot after this step (a blur) goes back through the personal-data seat before step 5.

### 5. The page
The maker writes `.council/acceptance/<topic>/<topic>.acceptance.json` by *Acceptance page* and runs `node <team-view base directory>/render.js <that file>` until it passes; it prints the page's path, then its size. Open the `.html` (`xdg-open` on Linux, `open` on macOS). team-view's steps 3–5 don't apply: nothing is served, nothing comes back.

### 6. Delivery
Give the human the page's path and size. To attach it to the MR/PR, ask first; after a yes, use `team-view` § *Share*'s commands for `via: review` with `as: file` (GitLab: upload, then a note; GitHub: a secret gist, then a comment). Those commands name `<gate>.share.html`: use `<topic>.acceptance.html` in its place. When asking before attaching on GitHub, say the page goes as a secret gist, readable by anyone who has its link. Write a message in the conversation's language: what the branch does, open the page, Business or Technical at the top of the evidence pane. Delete the run folder; keep `.council/acceptance/<topic>/`, so the page can be rebuilt.

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "It's staging, a few rows won't hurt" | Only an env in `Recette writable envs`, and only after step 2's yes. |
| "These screenshots only show test data" | Test data can copy a real customer. Step 4 decides, not the maker. |
| "That case failed, I'll mark it as not conforming" | No verdict. Show what you could; say why the rest is `unshown`. |
| "The human will want to pick cases on the page" | They pick in chat at step 1. The page decides nothing. |

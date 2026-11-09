---
name: team-view
description: Use when a team-* skill (team-refactor, team-debate, team-plan, team-kickoff, team-review) reaches a gate and the human must approve, decline, or choose between options. Also when the user asks for a visual, HTML, or browser view of a decision, backlog, or plan, or wants to share a team-review gate with the owner of the branch it reviewed.
---

# team-view

Turns a gate into a local HTML decision page: where the work lands beside today's state, then one card per decision, tension and rejected idea, each carrying its own evidence. The human decides in the browser and sends the decisions back with one click. A team-review gate can also be shared with the branch owner: it becomes a page, sent as a file or a review on the merge/pull request, whose reader decides alone and copies a prompt for their own coding agent.

**Markdown stays the source of truth.** The `.md` record gets every decision; the HTML is the human's view of the same gate.

## Procedure

1. **The gate JSON** goes to `.council/gates/YYYY-MM-DD-<topic>.gate.json` (create the folder if absent), written from `contract.md` in this skill's base directory (what goes on the page, how to write an item, the fields). In a team-* run the caller's gate writer writes it from copies of `contract.md` and `figures.md` in the run folder, and renders it until it passes. Outside a run, read `contract.md` and write it yourself.
2. **Check it:** `node <base directory>/render.js .council/gates/<file>.gate.json`, where `<base directory>` is the one shown when this skill loaded, for a manual and a plugin install alike. It writes the `.html` and prints its path, or lists what to fix. Re-rendering after the JSON changes gives the human a fresh set of decisions, so stale choices don't carry over onto edited items.
3. **Serve it.** On an auto-accept run (`team-protocol` § *Auto-accept*), don't: run `node <base directory>/render.js .council/gates/<file>.gate.json --accept-recommended` in the foreground instead. It prints the block the page would send after **Accept recommended** (each card's default, else its recommended option, else `UNDECIDED`), headed by a `mode: auto-accept` line, and saves it to `<gate>.decisions.txt`. Go to step 4. (A caller whose synthesis carries every item's options writes no gate JSON on an auto-accept run and never reaches this step: `team-protocol` § *Auto-accept*.) A review gate on someone else's branch is never auto-accepted: its owner decides (*Share*); say so in one line and serve it.
   On a review gate (kind "review"), first check what the Share dialog can offer, and pass it as `--channels='<json>'`.
   - `review`: from the host of `git -C <checkout> remote get-url origin` (`<origin URL>` below is that output; glab `-R` accepts it, so self-hosted GitLab resolves on the right host). GitLab (gitlab.com, or a host `glab auth status` lists): `glab auth status`, then `glab mr view <branch> -R <origin URL> --output json` → `{ "label": "Comment on merge request !<iid> (GitLab)" }`. GitHub: `gh auth status`, then `gh pr view <branch> -R <owner/repo> --json number` → `{ "label": "Comment on pull request #<n> (GitHub)" }`. Otherwise a string naming the fix: `"glab is not logged in: run glab auth login"`, `"gh is not logged in: run gh auth login"`, `"No merge request open for <branch>: open one, then ask Claude to reopen this page"`, `"No CLI support for <host>"`.

   Then run the same command with `--serve --channels='<json>'` (a review gate) or `--serve` (any other), **in the background** (Bash `run_in_background`, timeout 7200000). It serves the page on `127.0.0.1` and opens it in the browser. When the human clicks **Send to Claude**, it saves the block to `<gate>.decisions.txt`, prints it, and exits, which re-invokes you with the block as its output; the page then closes its tab. **Share** (shown on a review gate only) opens a dialog (what the reader gets: the file or a review on the merge/pull request, picked first when the `review` channel is available; where it goes; to whom) and posts the same block headed `GATE SHARE` with `as:`, `via:` and `to:` lines, saved to `<gate>.share.txt`. Tell the human the page is open, and that `?` lists the keyboard shortcuts (`←`/`→` between cards, `Tab` through options, `Enter` to choose). A file name the page shows opens in their editor on click (the IDE Claude runs in, else `code` or `idea`; `TEAM_VIEW_EDITOR` overrides it; `CEO_VIEW_EDITOR` is still read) and on the remote repo with the GitHub or GitLab logo beside it.
   No background commands, or the server can't start → open the `.html` itself (`xdg-open` on Linux, `open` on macOS) and wait for the human to paste the block from **Copy decisions**.
4. **Read the block** (the server's output, or the paste). A `GATE SHARE` block (a `CEO SHARE` header is still accepted), or the human asking to share the gate → follow *Share* below instead of steps 4–5.
   ```
   GATE DECISIONS — <title>
   record: <path>
   S1 = approve
   F1 = keep | note: add a comment explaining why
   D2 = buy (lifts K2) | note: the vendor already holds the data
   T1 = Minimalist
   RS-1a = revive
   S9 = UNDECIDED
   ```
   The block is headed `GATE DECISIONS` (and `GATE SHARE` for a share); the older `CEO DECISIONS` and `CEO SHARE` headers are still accepted.
   `T*` lines are tension verdicts (the side the human took, or `defer`). A rejected item comes back as `keep-rejected` or `revive`, and a revived one re-enters the calling skill's flow as a new candidate.
   A `(lifts K<n>)` after a choice: the human took an option that breaks constraint `K<n>`, which lifts it (`team-protocol` § *Bridge*); the calling skill's record writer records the lift. With no note on that line, ask once for the reason, in one line, to record as their words.
   `= reopen` on a settled item: that answer is open again; ask it in chat like an UNDECIDED. `= moot (D1 = x)`: the card is dropped; record it `moot`. `= ok`: nothing to do.
   Any `UNDECIDED` → ask about just those, in chat.
   A choice on an item tagged `corrects <premise>` that is not its recommended option → before recording it, ask once, in plain words and without code identifiers: what the page found, and whether the human still wants that option.
   A chosen item whose `after` (in the gate JSON) holds an item that is not chosen (declined, deferred, undecided, rejected) → before recording, ask once: what it comes after, what doing it without that means, and the alternatives (choose that item too, drop this one, or go ahead anyway).
   A `mode: auto-accept` block → also ask about every item tagged `corrects <premise>`, whatever its choice: the human has not seen what the page found. All these questions go in one chat message.
5. **Record** the decisions (with notes) into the `.md` record through the calling skill's record writer, then continue the calling skill's flow. A `mode: auto-accept` block: the writer adds *"Auto-accepted: every recommendation taken without opening the page"* to the record, beside any answers given in chat.

**Gate files.** Everything a gate leaves sits in `.council/gates/` and stays local; nothing is uploaded unless the human shares the gate. `<gate>` is the gate JSON's path without `.gate.json` (a `.ceo.json` is still read):
- `<gate>.gate.json`: the gate JSON (step 1). `<gate>.html`: the page rendered from it (step 2).
- `<gate>.decisions.txt`: the decisions block, saved by **Send to Claude** or `--accept-recommended`.
- `<gate>.share.txt`: the `GATE SHARE` block, saved by the Share dialog.
- `<gate>.share.html` (`--share`): the page for the reader.
- `<gate>.review.github.json` or `<gate>.review.gitlab/`: the pending review (`--review=`).
- `<topic>-plan-r<N>.gate.json`: a team-plan re-gate after an amendment, with its own `.html` and `.decisions.txt`. An amendment merges into the gate while it is unanswered; write `-r<N>` only for a gate already answered.
- `YYYY-MM-DD-<topic>/`: the sketches and screenshots the page embeds.

`.council/gates/` can be committed or gitignored: the decisions live in the `.md` record, and the page regenerates from its JSON.

## Share

For a team-review gate. On someone else's branch, Share hands the review to the branch owner; on your own branch or an audit, it hands the audit to the module's owner, or a fix to a colleague. The reader decides and acts on their own; nothing comes back. team-review's record writer records the share (Status: shared); there is no exec brief and no execution. Asked to share any other gate: say sharing is for team-review gates, and offer its page file (`<gate>.html`) to send as is.

1. **Render**: `node <base directory>/render.js <gate.json> --share`, plus `--preset=<gate>.share.txt` when the share came from the dialog (the server printed that path). The gate is share-ready already (`contract.md` § *Share fields*); if the render rejects it, fix the JSON by that section and re-run. No separate writer.
2. **Check before delivering.** The gate writer already applied *No customer data*; this is the second look. Look at every screenshot (`figures`, `outcome`) and every code pane in the gate JSON for customer data: names, emails, phone numbers, amounts tied to a person, tokens. If one may hold customer data, list it to the human and wait.
3. **Deliver** by the block's `as:`, `via:` and `to:` lines (asked in chat → ask the same two questions there). The dialog's **Share** is the go-ahead: don't ask again.
   - `as: review`: a review the human submits, its body linking the page. Don't post a separate comment. `<n>`/`<iid>`, `<owner/repo>` and `<host>` are the ones found when detecting the `review` channel in step 3.
     - **Refs and diff.** GitHub: `gh pr view <n> -R <owner/repo> --json headRefOid,baseRefName`, then `git -C <checkout> diff origin/<baseRefName>...<headRefOid> > $TMPDIR/review.diff`. GitLab: `glab api --hostname <host> projects/<owner%2Frepo>/merge_requests/<iid> | jq .diff_refs` gives `diff_refs` (`base_sha`, `start_sha`, `head_sha`), then `git -C <checkout> diff <base_sha> <head_sha> > $TMPDIR/review.diff`. If the checkout lacks a commit, `git -C <checkout> fetch` first. Always pass `--diff`: GitHub rejects the whole review when one comment's line is outside the diff.
     - **Page**: the review carries the page (step 1's `<gate>.share.html`), so the reader has one prompt for their agent. An attachment is an upload plus a link: GitLab `glab api --hostname <host> --method POST projects/<owner%2Frepo>/uploads --form file=@<gate>.share.html | jq -r .url` gives a `/uploads/…` path; GitHub has no attachment through the API: `gh gist create <gate>.share.html` (secret by default) gives the link.
     - **Render**: re-run the step 1 command with `--review=github --head=<headRefOid>` or `--review=gitlab --refs=<base_sha>,<start_sha>,<head_sha>`, plus `--diff=$TMPDIR/review.diff` and `--page-url=<the link or path>` (keep `--preset=`). The review body links the page right after the summary.
     - **Check first**: GitHub allows one pending review per person: `gh api repos/<owner>/<repo>/pulls/<n>/reviews --jq '[.[] | select(.state=="PENDING")] | length'`; GitLab (`glab api` has no `--jq`): `glab api --hostname <host> projects/<owner%2Frepo>/merge_requests/<iid>/draft_notes | jq length`. Non-zero → stop and tell the human to submit or discard it first.
     - **Post**: GitHub: `gh api repos/<owner>/<repo>/pulls/<n>/reviews --method POST --input <gate>.review.github.json` (no `event`: it stays pending). GitLab: each file of `<gate>.review.gitlab/` in name order, `glab api --hostname <host> --method POST -H 'Content-Type: application/json' projects/<owner%2Frepo>/merge_requests/<iid>/draft_notes --input <file>`. If a post fails midway, say which files went through; don't retry blindly.
     - **Tell the human**: open the merge/pull request, check the pending review (GitHub: *Finish your review*; GitLab: the drafts under *Submit review*), adjust if needed, and submit it as Comment, Request changes or Approve. Nothing is visible to the reader until then.
   - `via: self`: give the path of `<gate>.share.html` (`as: file`).
   - `via: review`, `as: file`: GitLab: `glab api --hostname <host> --method POST projects/<owner%2Frepo>/uploads --form file=@<gate>.share.html` (`<host>` the host of the remote; the project path URL-encoded) returns a `markdown` link; post it with `glab mr note create <iid> -R <origin URL> --resolvable=false -m "<message>"`. GitHub (no attachments on PR comments): `gh gist create <gate>.share.html` (secret by default) returns a URL; then `gh pr comment <n> -R <owner/repo> --body "<message>"` with that URL and "download the file, open it in a browser".
   - `via: mail`: give a clickable `mailto:<to>?subject=<…>&body=<…>` link (URL-encoded). With `as: file`, the body says the page is attached; give the path to attach.
   - `via: slack`: give the message in a code block, ready to paste. With `as: file`, give the path to drop into Slack.
   - `<message>`, in the conversation's language: you reviewed `<branch>`; open the page, pick an option per card (the reviewer's choices are pre-filled), click **Copy prompt** and paste it into your coding agent on the branch. Mention `to` when given (`@user` for a review comment or Slack; the recipient for mail).
   - If the claude.ai Slack or Gmail connector is connected, you may offer to send the prepared message yourself, after the human's "ok".
   Never edit the page by hand: fix the JSON and re-render.
4. **Record:** the line goes to the review record, through team-review's record writer: `Shared YYYY-MM-DD as <file|review> via <route> (<destination>). Decisions left to the branch owner.` For a review: `Shared YYYY-MM-DD as review via review (pending on !<iid>).`
5. **Tell the human**, in their language: what you did or prepared (the path, the link, the posted comment's URL, or the pending review on `!<iid> / #<n>` to submit, the mail link, the Slack message), what the reader does next, and the briefs that say "ask me first", by finding id.

## Who calls this

| Skill | Gate | Mapping lives in |
|-------|------|------------------|
| `team-refactor` | Refactoring backlog | its `templates.md` § *Gate page* |
| `team-debate` | Debate decision | its `templates.md` § *Gate page* |
| `team-plan` | Plan approval | its `templates.md` § *Gate page* |
| `team-kickoff` | Kickoff record (the single kickoff gate) | its step 5 |
| `team-review` | Review findings (fix or leave each) | its `templates.md` § *Gate page* |

Each caller owns *what* goes on the page; this skill owns *how* it's rendered and returned.

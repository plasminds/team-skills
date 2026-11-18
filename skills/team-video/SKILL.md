---
name: team-video
description: "Use when a branch has its acceptance page (recette) and the internal team should watch what it does as a short video (vidéo, film de démo): its own shoot of each case, before and after frames and filmed gestures, captions and chapters, rendered to an mp4. Also when the user asks for a video, a screencast or a demo film of a branch. Not for the acceptance page itself: team-acceptance."
---

# team-video

Turns a branch's acceptance page into a short mp4 for the internal team: its own shoot of each case (before and after frames, filmed gestures), captions from the steps and expected results, chapters from the groups, rendered by `video.js`.

**REQUIRED BACKGROUND:** follow `team-protocol` for dispatch and the agent contract. `.council/video/<topic>/` stands as the run folder and is kept.

## Iron laws

1. **No environment write before the writes yes.** Every write to film a state or gesture is listed and agreed first (flow 1).
2. **No frame leaves, and no render, without the personal-data record.** A `preview` shown in this session is not leaving; `render`, the mp4 and any share are.
3. **ffmpeg is checked here, at start**, by `video.js probe`.
4. **Writes only under `.council/video/<topic>/`**, and one write outside it: the `Brand` line in `.council/project-profile.md`.

## Seats

| Agent | Type | Model | Tool budget | Receives |
|-------|------|-------|-------------|----------|
| Maker | maker | sonnet | ~60 | the checked cases, the agreed writes, § *Slides file*: shoot, slides file, render |
| Personal data | analyst | sonnet | ~2 per item, fresh | only the frames and the slide texts, § *Personal-data record* |

Each seat's prompt carries the sections it needs, pasted.

## Flow

### 0. Start
Run `node <base directory>/video.js probe` first, where `<base directory>` is the one shown when this skill loaded. A stop is said as printed and nothing else runs.

No `.council/acceptance/<topic>/<topic>.acceptance.json` → `No acceptance page for <topic>. Run team-acceptance first.` A slides file already there → `video.js check <slides>`; say each `stale:` line as printed and propose the re-run, never "current"; a re-run starts by deleting `shots/` (its frames and `manifest.json`), so no frame from before it remains, then re-shoots every shot of the film; a shot whose gesture writes (flow 1's list) is re-filmed only after a new yes on its writes, in flow 1's form, and with no yes its case falls back as flow 1 says for no yes. The slides file's `commit` is re-stamped only once every shot is re-shot.

Then ask the questions with AskUserQuestion, each with 2-4 options, the recommended one first and marked, then work. Before asking, search the project for every answer it holds and offer what you found as options, each with its source `file:line`; free text only when nothing is found. The questions:

1. Cases (default: every case with figures; a case marked unshown is skipped; a case shown in part is filmed for its figures and the skipped steps are named at the end)
2. Gestures to film (default: proposed from the steps; the next message lists what each writes, and nothing is filmed without your yes)
3. Language (default: the Brand line's, else the acceptance page's); found on the acceptance page
4. Music (default: no; yes means I propose one CC0 or CC BY track and ask again before downloading it)
5. Brand, only when the profile has no Brand line: name, logo, colour set, language. Default: the one team-scan § Run preferences defines. I record it in .council/project-profile.md, section Run preferences, and do not ask again; edit that line to change it. Found in the project: the name (the `origin` repository name, the app's title, its logo files' names); the logo (logo files in the project; one whose wordmark is white or light is offered only with a note that it needs a dark background); the colour set (the project's theme config: Vuetify `themes`, Tailwind `theme.colors`, CSS custom properties such as `--primary`); the language (the acceptance page's).

AskUserQuestion takes at most 4 questions per call, so the brand question may go in a second call.

The `Brand` line's format and its default are defined once, in `team-scan` § *Run preferences*; read the line there and never restate the default here. The answer, or with none the default, is written to the profile with source `the user, <date>` or `the user, <date>, default taken`. The brand object takes the line's values: `none` becomes `null`, `source` becomes the acceptance page's language. Primary fills the top bar, secondary marks details, and the surface is the page background.

A music yes → `video.js probe --music` at once. The reading-time estimate comes later, from `check`.

### 1. Writes, agreed
One chat message, in the form of `team-acceptance` step 2: the data each gesture needs and on which env (one listed in `Recette writable envs`), what a write sets off outside the app (an email, a text message, a webhook, a payment) and to whom, and each command outside the sandbox, each to run as a single plain command. Wait for a yes; it is never consent to a permission prompt. No yes → no gesture is filmed; its case uses stills of states the environment already holds, shot in this run, never frames kept from an earlier shoot, and a case that cannot be shown without its write is dropped from the film and named in the delivery message.

### 2. Shoot
The maker writes a Playwright script in `.council/video/<topic>/shoot/` with the project's Playwright, signing in as the acceptance `shoot/` does. Viewport 1600×1000, DPR 4; the script makes only the writes the flow 1 list agreed. When the script fails after a write, a retry never repeats that write without a new yes in flow 1's form: the maker re-runs from after the write, or asks the new yes; every retry, not only flow 0's and flow 4's. Each shot is `shots/<name>.png`. `shots/manifest.json` is `{ "<name>": { "w", "h", "boxes": { "<key>": [x0, y0, x1, y1] } } }`, the boxes as fractions of the shot taken from `locator.boundingBox()` at the screenshot; a missing box fails the shoot. The maker notes the folder where the script resolves Playwright, for `--from`.

### 3. Slides file
Write the slides file by § *Slides file*: `group` becomes `chapter` (a case with no `group` gets the heading the acceptance page shows for ungrouped cases, in the page's language), `steps` and `expected` become captions, `commit` comes from the acceptance JSON, `brand` from the line. Then run `video.js check <slides> --from=<dir>` (validate, reading time, Playwright, stale) and show the human the per-slide list `<n> <chapter> — <title> — <d> s` with each warning and its fix, and each `stale:` line as printed. Show one `video.js preview <slides> --slide=<n> --from=<dir>` still per slide kind used, in chat, before any full render. Nothing is rendered on a failed check.

### 4. Personal data
In the form of `team-acceptance` step 4. `video.js check` lists the items to cover: each used frame and each slide's text (chapter, case, title, text, bullets). The seat looks at each and writes `clear`, or flags it as `<shot or slide n text>, <where> — <what>`. Show the flags to the human; each is decided by the human, who keeps, blurs or removes it.
- Keep → `kept: <what> (the human)`, written only on the human's word.
- Blur → the seat writes `blur: <what>` (pending, not yet checked); the maker re-shoots only the shots it replaces, with Playwright's `mask` (or edits the caption); a shot whose gesture writes is re-filmed only after a new yes on its writes, in flow 1's form. The file's new hash reads `unchecked`, the seat looks again and writes `blurred: <what>`, and the human sees the blurred frame once before render.
- Remove → the frame file is deleted and its slide drops it.

`render` stays refused until every item is checked.

### 5. Music
Only on a yes in flow 0. The maker names one CC0 or CC BY track in chat (host, title, author, licence, URL, length) and asks yes or no; only a yes on that track permits the download command; a no → no music. A track shorter than the video loops and fades out. Save it in `music/`, and set the slides file's `music` object.

### 6. Render
Run `video.js render <slides> --from=<dir>`. It refuses unchecked items and deletes `work/` after the mux.

### 7. Delivery
Give the path, size, duration, the chapter list, and the cases left out (unshown, no yes). When `check` printed any `stale:` line, repeat them as printed; the video is never called current. Kept: the mp4, `shots/`, the slides file, the record, `credits.txt`.

## Slides file

`.council/video/<topic>/<topic>.slides.json`, checked by `video.js check`. Highlights and cursor targets are mark keys from `shots/manifest.json`, never typed fractions. No code in the file. Fields are added, never renamed; any other field is an error.

| Field | Content |
|-------|---------|
| `version` | `1` |
| `topic` | the topic |
| `commit` | the acceptance JSON's commit, 7 to 40 hex digits |
| `brand` | `{ "name", "logo", "colors": "neutral" \| { "primary", "secondary"?, "surface"? }, "lang" }`: `logo` is `null` or a path, each colour `#rrggbb` |
| `music` | `null`, or `{ file, title, author, licence, url }`; licence `CC0…` or `CC BY` with an optional version only |
| `slides` | at least 2, each a kind below |

Every slide has a non-empty `chapter` and `title`.

| Kind | Fields |
|------|--------|
| `title` | `text?` |
| `text` | `bullets`: 1 to 6 |
| `image` | `case?`, `text`, `images`: 1 or 2 of `{ shot, hl? }` |
| `screen` | `case?`, `text`, `frames`: at least 2 of `{ shot, hl? }`, `cursor?`: `{ frame, to, click? }` |

`shot` is in `shots/manifest.json` and on disk. `hl` and `to` are mark-key strings in that shot's `boxes`. `cursor.frame` is the 0-based index of the frame it moves in; `click` is a boolean; `case` is a string.

## Personal-data record

`.council/video/<topic>/personal-data.md`, kept by `video.js check` and `render`:

```
# Personal data — <topic>
Looked for: names, e-mail addresses, phone numbers, postal addresses, bank or card numbers, identity numbers, faces, free-text notes
- <key> — <hash> — <verdict> — <seat>, <date>
```

An item is a used frame (`key` its path, `hash` the first 16 hex digits of the sha256 of the file the render reads, so a blurred or re-shot file has a new hash) or a slide's text (`key` `slide<n> text`, hash of chapter, case, title, text and bullets joined by newlines in that order, a missing one an empty line). Verdicts: `clear`, `blurred: <what>`, `kept: <what> (the human)`, `blur: <what>`, `removed: <what>`, `unchecked`. An item is checked when its line carries its current hash and a verdict of `clear`, `blurred:` or `kept:`. `blur:` and `unchecked` are not checked; a line with an old hash is rewritten `unchecked`, an item with no line is appended `unchecked`.

## Limits

Chrome strings are French when `lang` is `fr`, else English.

Tested on Linux; macOS and Windows unverified.

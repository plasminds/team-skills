---
name: team-deck
description: "Use when a decision, a spec or a plan is written and the business (le métier) must validate it in a meeting: a slide deck (présentation, diapo, diaporama) as one self-contained HTML page, one claim per slide, each open question on its slide and a recap, then a slide on what the meeting changed. Also when the user asks for slides, a deck or a présentation of a decision. Not for approving a gate: team-view. Not for a .pptx file."
---

# team-deck

Turns a written decision, spec or plan into one self-contained HTML deck for a business meeting: one claim per slide, each open question on the slide it concerns, a recap of the questions, and after the meeting a slide on what changed. Every slide is a fixed 16:9 frame in the project's brand, built from the material the audience already knows.

## Iron laws

1. **One HTML, no network, system fonts.** The deck is a single file kept in the project; no `http(s)://` in `src`, `href`, `@import` or `url()`. Local images are inlined by the build.
2. **Every slide fits its 16:9 frame.** Nothing scrolls or grows: a slide that does not fit is split or cut, never shrunk below the build's readability check.
3. **No deck is "ready" unseen.** Before giving the path, look at every shot the build wrote; a build that could not check the fit is said as such to the human.
4. **Publish only after a yes.** An Artifact publish waits for the human's yes.
5. **Writes only `.council/decks/`**, and one write outside it: the `Brand` line in `.council/project-profile.md`.
6. **Reads no team-view file.** The deck carries its own frame and styles.

## Flow

### 0. Questions
Ask the questions with AskUserQuestion, each with 2-4 options, the recommended one first and marked, then work. Before asking, search the project for every answer it holds and offer what you found as options, each with its source `file:line`; free text only when nothing is found. The questions:

1. Audience (default: the business side)
2. Language (default: the Brand line's, else the document's); found in the source document
3. Length (default: a cover, one slide per decision, a recap; at most 12 before the recap, the minor decisions folded into one slide, which I say here)
4. When (default: before the meeting; after it, a "what changed" slide is added)
5. Brand, only when the profile has no Brand line: name, logo, colour set, language. Default: the one team-scan § Run preferences defines. I record it in .council/project-profile.md, section Run preferences, and do not ask again; edit that line to change it. Found in the project: the name (the `origin` repository name, the app's title, its logo files' names); the logo (logo files in the project; the logo sits on the primary colour, in the top bar of every slide and on the cover, so offer the one that reads on it: a white or light wordmark on a dark primary); the colour set (the project's theme config: Vuetify `themes`, Tailwind `theme.colors`, CSS custom properties such as `--primary`); the language (the source document's).

AskUserQuestion takes at most 4 questions per call, so the brand question may go in a second call.

The `Brand` line's format and its default are defined once, in `team-scan` § *Run preferences*; read the line there and never restate the default here. The answer, or with none the default, is written to the profile with source `the user, <date>` or `the user, <date>, default taken`. The brand object takes the line's values: `none` becomes `null`, `source` becomes the document's language. The primary fills the top bar and the cover, the secondary draws the stripe under the bar and the marks where it stays visible, the surface is the slide; `neutral` keeps the frame's own palette.

### 1. Source
Before writing a slide, list what the audience already knows about the topic, from the source document and everything it points to:
- **Diagrams**: schemas in the document, in an artifact it links (read its files), in the tickets, mermaid blocks. Each one a slide covers is reused: its nodes, its branches and their labels, its wording. Redraw it landscape as inline SVG in the deck's colours, updated where the source document has since changed it (say which); embed the original image (`<img src="path">`, inlined by the build) only when it reads at slide size.
- **Tickets**: the parent and each sub-ticket, with its number and title, and the order of work when the source gives one. A slide on one ticket's scope names it in its eyebrow (`data-eyebrow="Achat · #1831"`); the plan's order is a slide of its own when the source has one.
- **Figures and names** the audience will check: amounts, rhythms, people and teams.

A slide that drops a branch a source diagram has, or a ticket the source names, is wrong, not simpler.

### 2. Slides
Write `.council/decks/<topic>.slides.html`, a run of `<section class="slide">`; the first may be `class="slide cover"`.
- Each slide holds one `<h2>` claim, written as a sentence; `data-eyebrow="…"` on the section puts a label in its top bar (the step, the ticket).
- Use the business lexicon of the document and the project; name tickets with their number as the source writes it (`#1831`), as text, never as a link.
- Each open question is an `<aside class="question">` on the slide it concerns; more than two questions on one slide, give the rest a slide of their own.
- A diagram or image goes in `<figure class="visual">`, which takes the room the text leaves and scales its content to fit. Text beside a diagram, or questions beside text: `<div class="cols">` with one child per column.
- Diagrams are inline `<svg role="img" aria-label="…">` with a `viewBox` near the slot's shape (about 1600 × 450 under a two-line title), text at 24 or more viewBox units, and colours from the frame's variables: `var(--page)` and `var(--title)` for boxes, `var(--raised)` and `var(--detail)` for decisions, `var(--bar)` with `var(--on)` text for the outcome to remember, `var(--ink)` and `var(--muted)` for text and arrows.
- No `http(s)://` anywhere in `src`, `href`, `@import` or `url()`.

Then write `.council/decks/<topic>.deck.json`: `{ "title", "brand": { "name", "logo", "colors": "neutral" | { "primary", "secondary"?, "surface"? }, "lang" }, "slides": "<topic>.slides.html" }`.

### 3. Build and look
From the project root, run `node <base directory>/deck.js .council/decks/<topic>.deck.json`, where `<base directory>` is the one shown when this skill loaded; add `--from=<dir>` when the project's Playwright lives in a subfolder (`frontend/`). It writes `<topic>.html`, opens it in the project's Playwright Chromium, measures every slide at 16:9 and writes one shot per slide to `<topic>.shots/`.
- Exit 1 names each slide that does not fit, or whose image or diagram text is too small to read, and the fix: split it, cut text, move the diagram beside the text, redraw it larger. Fix and rebuild until it exits 0.
- Exit 3: the fit was not checked (no Playwright, or the browser did not start). Tell the human, and ask before delivering a deck nobody measured.
- Then read every shot. A diagram whose arrows cross, a branch missing against the source, a label on the wrong arrow, a slide mostly empty: fix and rebuild.

### 4. Delivery
Give the path and what the shots showed. Ask before an Artifact publish; publish only after a yes.

### 5. After the meeting
Add `<section class="slide changed">` with what the meeting changed, set `data-answer="…"` on each answered question, and rebuild.

## Limits

Deck chrome strings exist in French and English; any other language shows English.

The fit check needs the project's own Playwright (`playwright` or `@playwright/test`); without it the deck builds unchecked.

Tested on Linux; macOS and Windows unverified.

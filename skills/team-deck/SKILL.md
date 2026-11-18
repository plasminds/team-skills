---
name: team-deck
description: "Use when a decision, a spec or a plan is written and the business (le métier) must validate it in a meeting: a slide deck (présentation, diapo, diaporama) as one self-contained HTML page, one claim per slide, each open question on its slide and a recap, then a slide on what the meeting changed. Also when the user asks for slides, a deck or a présentation of a decision. Not for approving a gate: team-view. Not for a .pptx file."
---

# team-deck

Turns a written decision, spec or plan into one self-contained HTML deck for a business meeting: one claim per slide, each open question on the slide it concerns, a recap of the questions, and after the meeting a slide on what changed.

## Iron laws

1. **One HTML, no network, system fonts.** The deck is a single file kept in the project; no `http(s)://` in `src`, `href`, `@import` or `url()`.
2. **Publish only after a yes.** An Artifact publish waits for the human's yes.
3. **Writes only `.council/decks/`**, and one write outside it: the `Brand` line in `.council/project-profile.md`.
4. **Reads no team-view file.** The deck carries its own frame and styles.

## Flow

### 0. Questions
Ask the questions with AskUserQuestion, each with 2-4 options, the recommended one first and marked, then work. Before asking, search the project for every answer it holds and offer what you found as options, each with its source `file:line`; free text only when nothing is found. The questions:

1. Audience (default: the business side)
2. Language (default: the Brand line's, else the document's); found in the source document
3. Length (default: a cover, one slide per decision, a recap; at most 12, the minor decisions folded into one slide, which I say here)
4. When (default: before the meeting; after it, a "what changed" slide is added)
5. Brand, only when the profile has no Brand line: name, logo, colour set, language. Default: the one team-scan § Run preferences defines. I record it in .council/project-profile.md, section Run preferences, and do not ask again; edit that line to change it. Found in the project: the name (the `origin` repository name, the app's title, its logo files' names); the logo (logo files in the project; one whose wordmark is white or light is offered only with a note that it needs a dark background); the colour set (the project's theme config: Vuetify `themes`, Tailwind `theme.colors`, CSS custom properties such as `--primary`); the language (the source document's).

AskUserQuestion takes at most 4 questions per call, so the brand question may go in a second call.

The `Brand` line's format and its default are defined once, in `team-scan` § *Run preferences*; read the line there and never restate the default here. The answer, or with none the default, is written to the profile with source `the user, <date>` or `the user, <date>, default taken`. The brand object takes the line's values: `none` becomes `null`, `source` becomes the document's language. Primary and secondary mark the deck (eyebrow bar, questions); its light and dark themes keep their own palette, and the surface is not used.

### 1. Slides
Write `.council/decks/<topic>.slides.html`, a run of `<section class="slide">`; the first may be `class="slide cover"`.
- Each slide holds one `<h2>` claim, written as a sentence.
- Use the business lexicon of the document and the project; name tickets, never number or link them.
- Each open question is an `<aside class="question">` on the slide it concerns.
- Diagrams are inline `<svg role="img" aria-label="…">`.
- No `http(s)://` anywhere in `src`, `href`, `@import` or `url()`.

Then write `.council/decks/<topic>.deck.json`: `{ "title", "brand": { "name", "logo", "colors": "neutral" | { "primary", "secondary"?, "surface"? }, "lang" }, "slides": "<topic>.slides.html" }`.

### 2. Build
Run `node <base directory>/deck.js .council/decks/<topic>.deck.json`, where `<base directory>` is the one shown when this skill loaded. Fix what it names; it prints the HTML's path.

### 3. Delivery
Give the path. Ask before an Artifact publish; publish only after a yes.

### 4. After the meeting
Add `<section class="slide changed">` with what the meeting changed, set `data-answer="…"` on each answered question, and rebuild.

## Limits

Deck chrome strings exist in French and English; any other language shows English.

Tested on Linux; macOS and Windows unverified.

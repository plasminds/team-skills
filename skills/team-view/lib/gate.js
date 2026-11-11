// Gate validation and normalization: decisions, tensions and rejected items become one list of decidable items.
const fs = require('fs');
const path = require('path');
const { readPreset } = require('./share');
const { linkItems } = require('./links');

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' };
// Text that points at visual evidence the human would expect to see next to it.
const MENTIONS_VISUAL = /\b(screenshots?|screen ?captures?|captures? d'écran|fig(ure)?\.? ?\d+)\b/i;
// Kinds whose gate approves something to build: the page must show where it lands.
const NEEDS_OUTCOME = ['plan', 'kickoff'];
const VIEWS = ['ui', 'system'];
// Card text is read at a glance: past these lengths it is a report, not a card.
const MAX = { detail: 240, why: 160, bullet: 120, bullets: 4 };
// The bridge (team-protocol's bridge.md): two lenses, three constraint statuses, one-line trade-offs.
const LENSES = ['business', 'tech'];
const STATUSES = ['confirmed', 'assumed', 'contested'];
const MAX_BRIDGE = { tradeoff: 80, accepts: 160 };
// What a tension side passes on to the option that sides with it.
const SIDE_KEYS = ['brief', 'suggestion', 'tradeoff', 'violates', 'code', 'metrics', 'examples', 'figures', 'accepts', 'for', 'against'];
// --share: the reader has neither this machine nor the .council/ folder.
const LANGS = ['en', 'fr'];
const LOCAL_PATH = /(?:^|[\s`'"(])(\/home\/|\/Users\/|\/tmp\/|[A-Za-z]:\\)|\.council\//;
// A commit id: 7-40 hex characters with at least one letter and one digit (not a date).
const SHA = /\b(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]{7,40}\b/;
// kind "acceptance": a page that presents a pushed branch case by case. Nothing on it is decided.
const ACCEPTANCE_TOP = ['decisions', 'tensions', 'questions', 'settled', 'rejected', 'outcome', 'preamble', 'preset'];
const CASE_KEYS = ['id', 'group', 'title', 'steps', 'expected', 'figures', 'unshown', 'tech', 'example'];
const EXAMPLE_KEYS = ['id', 'given', 'when', 'then'];
const EXAMPLE_ID = /^E[1-9][0-9]*$/;
const TECH_KEYS = ['how', 'files', 'data'];
const REPO_PATH = /^(?!\.{1,2}\/)[\w.@+-]+(?:\/(?!\.{1,2}(?:\/|$))[\w.@+-]+)*$/;
const COMMIT = /^[0-9a-f]{7,40}$/i;

const STORY_KINDS = ['debate', 'council'];
// A weighty card is a story id: a decision not marked minor, or a tension.
const weighty = it => (it.kind === 'decision' && !it.minor) || it.kind === 'tension';

// story: the order of the page's context rows and weighty cards, as an id list. Returns that order on a deciding gate (every kind but acceptance)
// (the given ids, then every weighty card they leave out, in default order), else undefined. `items` is linkItems' order.
function checkStory(data, items, context, errors, warnings) {
  const STORY = data.kind !== 'acceptance';
  if (data.story != null && !STORY) { errors.push('"story" is not read on acceptance gates'); return undefined; }
  if (!STORY) return undefined;
  const byId = new Map(items.map(it => [it.id, it]));
  const cards = items.filter(weighty);
  const inStory = new Set(cards.map(it => it.id));
  // The card a refinement hangs under in the story: follow "on" to the first weighty card.
  const parentOf = it => {
    const seen = new Set([it.id]);
    let cur = it.on && byId.get(it.on.id);
    while (cur && !inStory.has(cur.id) && cur.on && !seen.has(cur.id)) { seen.add(cur.id); cur = byId.get(cur.on.id); }
    return cur && inStory.has(cur.id) ? cur.id : null;
  };
  // Default order: context rows, then each top-level weighty card followed depth-first by the cards that refine it.
  const dflt = context.map(c => c.id);
  (function walk(parent) {
    cards.filter(it => parentOf(it) === parent).forEach(it => { dflt.push(it.id); walk(it.id); });
  })(null);
  let order = dflt;
  if (data.story != null) {
    if (!Array.isArray(data.story) || !data.story.length) { errors.push('"story" must be a non-empty array of ids'); return undefined; }
    if (data.story.some(v => v && typeof v === 'object')) {
      errors.push('"story" is now a list of ids ("C1", "D1", ...): sections { "title", "show" } are no longer read');
    }
    const rows = new Set(context.map(c => c.id));
    order = [];
    data.story.forEach((v, i) => {
      if (v && typeof v === 'object') return;
      if (typeof v !== 'string') { errors.push(`story[${i}] must be an id string`); return; }
      const it = byId.get(v);
      if (!rows.has(v) && (!it || (it.kind !== 'decision' && it.kind !== 'tension'))) errors.push(`story[${i}] "${v}" is not a context row, a decision or a tension`);
      else if (!rows.has(v) && !weighty(it)) errors.push(`story[${i}] "${v}" is a minor item: minor items stay in their own section`);
      else if (order.includes(v)) errors.push(`story[${i}] "${v}" is named twice`);
      else order.push(v);
    });
    context.filter(c => !order.includes(c.id)).forEach(c => warnings.push(`context row "${c.id}" is not in "story": it is not shown`));
    dflt.filter(id => inStory.has(id) && !order.includes(id)).forEach(id => {
      warnings.push(`${id} is not in "story": it is listed after the story's ids`);
      order.push(id);
    });
  }
  // K12: a refinement comes right after its parent or the parent's earlier refinements; a card comes after what it needs.
  const pos = new Map(order.map((id, i) => [id, i]));
  const descends = (id, root) => {
    const seen = new Set();
    for (let p = parentOf(byId.get(id) || {}); p && !seen.has(p); p = parentOf(byId.get(p))) { if (p === root) return true; seen.add(p); }
    return false;
  };
  order.forEach((id, i) => {
    const it = byId.get(id);
    if (!it) return;
    const parent = parentOf(it);
    if (parent && !(pos.get(parent) < i && order.slice(pos.get(parent) + 1, i).every(x => descends(x, parent)))) {
      errors.push(`${id} refines ${parent}: put it right after ${parent} in story`);
    }
    (Array.isArray(it.after) ? it.after : []).forEach(n => {
      if (pos.has(n) && pos.get(n) > i) errors.push(`${id} needs ${n}: put ${n} before ${id} in story`);
    });
  });
  return order;
}

// Reads and validates the gate JSON. Every problem accumulates into `errors` (the caller prints them).
function loadGate(src, { share: SHARE, preset: PRESET }) {
  const data = JSON.parse(fs.readFileSync(src, 'utf8'));
  const baseDir = path.dirname(path.resolve(src));
  const errors = [];
  const warnings = [];
  if (!data.title) errors.push('missing "title"');
  const ACCEPTANCE = data.kind === 'acceptance';
  if (!ACCEPTANCE && (!Array.isArray(data.decisions) || !data.decisions.length)) errors.push('"decisions" must be a non-empty array');
  if (data.summary != null) errors.push('"summary" is not read: put the page\'s cover in a context row (its why and facts), and an outcome in a context row\'s "outcome"');
  if (data.metrics) errors.push('top-level "metrics" is not supported — put each metric in the "metrics" of the item it measures');

  // Images are embedded as data URIs so the page is one self-contained file.
  // src must be relative to the JSON, so the gate folder holds its own evidence and re-renders later.
  function embed(fig, where) {
    if (!fig.svg && !fig.src && fig.html === undefined) { errors.push(`${where} needs "svg", "html" or "src"`); return; }
    if (fig.html !== undefined) checkHtml(fig.html, where);
    if (!fig.src || /^data:/.test(fig.src)) return;
    if (path.isAbsolute(fig.src) || /^[a-z]+:\/\//i.test(fig.src)) {
      errors.push(`${where}.src "${fig.src}" must be relative to the JSON — copy the file into the gate folder`);
      return;
    }
    const file = path.resolve(baseDir, fig.src);
    if (path.extname(file).toLowerCase() === '.svg' && fs.existsSync(file)) {
      // Inlined rather than embedded as <img>, so currentColor follows the page's text color.
      fig.svg = fs.readFileSync(file, 'utf8').replace(/<\?xml[^>]*>\s*/, '');
      delete fig.src;
      return;
    }
    if (path.extname(file).toLowerCase() === '.html') {
      if (!fs.existsSync(file)) { errors.push(`${where}.src "${fig.src}" not found (resolved to ${file})`); return; }
      fig.html = fs.readFileSync(file, 'utf8');
      delete fig.src;
      checkHtml(fig.html, where);
      return;
    }
    const mime = MIME[path.extname(file).toLowerCase()];
    if (!mime) { errors.push(`${where}.src "${fig.src}" is not a supported image type`); return; }
    if (!fs.existsSync(file)) { errors.push(`${where}.src "${fig.src}" not found (resolved to ${file})`); return; }
    fig.src = `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
  }

  // An html figure is a static screen mockup: no script, form or external resource.
  const HTML_RULES = [
    [/<script/i, 'a <script> tag'],
    [/\son[a-z]+\s*=/i, 'an inline event handler attribute'],
    [/javascript:/i, 'a javascript: URL'],
    [/<link/i, 'a <link> tag'],
    [/@import/i, 'an @import rule'],
    [/<iframe/i, 'an <iframe>'],
    [/<object/i, 'an <object>'],
    [/<embed/i, 'an <embed>'],
    [/<form/i, 'a <form>'],
    [/https?:\/\//i, 'an http(s) URL'],
    [/(^|[\s"'(=,])\/\/[^\s"')]+/, 'a protocol-relative URL']
  ];
  function checkHtml(html, where) {
    if (typeof html !== 'string' || !html.trim()) { errors.push(`${where}.html must be a non-empty string`); return; }
    if (Buffer.byteLength(html) > 60 * 1024) {
      errors.push(`${where}.html is larger than 60 KB — a screen mockup is static: no script, form or external resource`);
      return;
    }
    HTML_RULES.forEach(([re, what]) => {
      if (re.test(html)) errors.push(`${where}.html contains ${what} — a screen mockup is static: no script, form or external resource`);
    });
  }

  function checkOptions(opts, where) {
    (opts || []).forEach((o, j) => { if (!o.value || !o.label) errors.push(`${where}.options[${j}] needs "value" and "label"`); });
  }

  function checkArguments(item, where) {
    ['for', 'against'].forEach(k => {
      if (item[k] == null) return;
      if (!Array.isArray(item[k])) { errors.push(`${where}.${k} must be an array`); return; }
      item[k] = item[k].map(a => (typeof a === 'string' ? { point: a } : a));
      item[k].forEach((a, j) => { if (!a.point) errors.push(`${where}.${k}[${j}] needs "point"`); });
    });
  }

  // "Gold uses Math.floor…" → "gold uses math floor"
  const norm = t => String(t || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const words = t => norm(t).split(' ').filter(w => w.length > 2);
  const textOf = v => (Array.isArray(v) ? v.join('\n') : String(v || ''));

  // detail and why are a string ("- " lines become bullets) or an array of bullets.
  function checkText(item, key, where) {
    const v = item[key];
    if (v == null) return;
    if (!Array.isArray(v) && typeof v !== 'string') { errors.push(`${where}.${key} must be a string or an array of bullets`); return; }
    const text = textOf(v);
    const long = key === 'detail' && data.kind !== 'acceptance';
    const maxText = long ? 600 : MAX[key], maxBullet = long ? 200 : MAX.bullet;
    if (text.length > maxText) errors.push(`${where}.${key} is ${text.length} characters (max ${maxText}) — keep the facts the title lacks, as bullets`);
    const bullets = Array.isArray(v) ? v : v.split('\n').filter(l => /^\s*[-•]\s/.test(l));
    if (bullets.length > MAX.bullets) errors.push(`${where}.${key} has ${bullets.length} bullets (max ${MAX.bullets})`);
    bullets.forEach((b, j) => { if (String(b).length > maxBullet) errors.push(`${where}.${key} bullet ${j + 1} is ${String(b).length} characters (max ${maxBullet})`); });
  }

  // Each field has one job: the title names the question, detail gives the facts, options are the answers.
  // Text that restates another field makes the human read the same thing twice.
  function checkEcho(item, where) {
    const title = norm(item.title), detail = norm(textOf(item.detail));
    if (detail && title && detail.startsWith(title)) errors.push(`${where} ("${item.id}") detail starts by repeating the title — give only what the title doesn't say`);
    const dw = new Set(words(item.detail));
    (item.options || []).forEach(o => {
      const label = norm(o.label), lw = words(o.label);
      if (label && label === title) errors.push(`${where} ("${item.id}") option "${o.label}" is the title — title the question, not an answer`);
      if (lw.length >= 2 && lw.every(w => dw.has(w))) errors.push(`${where} ("${item.id}") detail describes option "${o.label}" — state the situation in detail, keep the answers in options`);
    });
  }

  // Shared by every kind of item: figures (with the legacy "images" alias), arguments, and the visual-mention check.
  function finish(item, where) {
    item.figures = (item.figures || []).concat(item.images || []);
    delete item.images;
    item.figures.forEach((f, j) => embed(f, `${where}.figures[${j}]`));
    if (item.unillustrated != null && (typeof item.unillustrated !== 'string' || !item.unillustrated.trim())) {
      errors.push(`${where}.unillustrated must be a non-empty string: why this card cannot be drawn`);
    }
    checkOwnEvidence(item, where);
    checkArguments(item, where);
    checkOptions(item.options, where);
    checkText(item, 'detail', where);
    checkText(item, 'why', where);
    checkEcho(item, where);
    const text = [item.title, textOf(item.detail), textOf(item.why)].join(' ');
    if (MENTIONS_VISUAL.test(text) && !item.figures.length && !item.options.some(o => o.figures && o.figures.length)) {
      errors.push(`${where} ("${item.id}") mentions "${text.match(MENTIONS_VISUAL)[0]}" but has no "figures" — attach it or drop the reference`);
    }
    checkCode(item, where);
    checkLens(item, where);
    checkBridge(item, where);
    concerns(item);
    // T1: a debate card draws in its own "figures"; an outcome entry is drawn by a context row.
    if (data.kind !== 'acceptance' && item.outcome != null) errors.push(`${where} ("${item.id}").outcome is not read on a card: put its drawing in the card's "figures"`);
    checkKeys(item, where, item.id);
    item.options.forEach(o => (Array.isArray(o.metrics) ? o.metrics : []).forEach((m, j) => {
      if (m && m.key != null) errors.push(`${where} ("${item.id}") option "${o.value}".metrics[${j}].key is read on a card or a context row only`);
    }));
    return item;
  }

  // key: true marks a metric the story shows large, at most 3 per card or context row.
  function checkKeys(holder, where, id) {
    if (!Array.isArray(holder.metrics)) return;
    let keys = 0;
    holder.metrics.forEach((m, j) => {
      if (!m || m.key == null) return;
      if (m.key !== true) errors.push(`${where}.metrics[${j}].key must be true or absent`);
      else keys++;
    });
    if (keys > 3) warnings.push(`${id} has ${keys} key metrics: the page shows 3 large, the rest in the evidence`);
  }

  // A context row's facts (labelled sentences) and cases (parallel situations, each with a small drawing).
  const nonEmpty = v => typeof v === 'string' && v.trim();
  function checkFacts(c, where) {
    if (c.facts == null) return;
    if (!Array.isArray(c.facts)) { errors.push(`${where}.facts must be an array of { "label", "text" }`); return; }
    c.facts.forEach((f, j) => {
      const w = `${where}.facts[${j}]`;
      if (!f || typeof f !== 'object' || Array.isArray(f)) { errors.push(`${w} must be an object { "label", "text" }`); return; }
      Object.keys(f).filter(k => !['label', 'text'].includes(k)).forEach(k => errors.push(`${w} takes no "${k}": only label, text`));
      ['label', 'text'].forEach(k => { if (!nonEmpty(f[k])) errors.push(`${w}.${k} must be a non-empty string`); });
    });
    if (c.facts.length > 4) warnings.push(`${c.id} has ${c.facts.length} facts: keep to 4 or fewer`);
  }
  function checkCases(c, where) {
    if (c.cases == null) return;
    if (!Array.isArray(c.cases)) { errors.push(`${where}.cases must be an array of { "title", "tag"?, "figure"?, "text" }`); return; }
    c.cases.forEach((k, j) => {
      const w = `${where}.cases[${j}]`;
      if (!k || typeof k !== 'object' || Array.isArray(k)) { errors.push(`${w} must be an object { "title", "tag"?, "figure"?, "text" }`); return; }
      Object.keys(k).filter(x => !['title', 'tag', 'figure', 'text'].includes(x)).forEach(x => errors.push(`${w} takes no "${x}": only title, tag, figure, text`));
      ['title', 'text'].forEach(x => { if (!nonEmpty(k[x])) errors.push(`${w}.${x} must be a non-empty string`); });
      if (k.tag != null) {
        if (!nonEmpty(k.tag)) errors.push(`${w}.tag must be a non-empty string`);
        else if (k.tag.length > 24) warnings.push(`${c.id} case ${j} tag is ${k.tag.length} characters: keep a tag to 24 or fewer`);
      }
      if (k.figure != null) {
        if (typeof k.figure !== 'object' || Array.isArray(k.figure)) errors.push(`${w}.figure must be one figures entry`);
        else embed(k.figure, `${w}.figure`);
      }
    });
    if (!c.cases.length) errors.push(`${where}.cases is empty: leave it out, or give at least 2 cases`);
    else if (c.cases.length < 2) warnings.push(`${c.id} has 1 case: cases are parallel situations, give at least 2`);
    const tags = new Set(c.cases.map(k => k && k.tag).filter(nonEmpty));
    if (tags.size > 3) warnings.push(`${c.id} has ${tags.size} distinct case tags: the page has 3 tones, so tags past the third look alike`);
  }

  // context: the rows the story tells between cards. Never decided, never counted.
  const CONTEXT_KEYS = ['id', 'title', 'why', 'detail', 'outcome', 'figures', 'metrics', 'facts', 'cases', 'note'];
  function checkContext(data, items, outcome, errors) {
    if (data.context == null) return [];
    if (!Array.isArray(data.context)) { errors.push('"context" must be an array of { "id", "title", "why"?, "detail"?, "outcome"?, "figures"?, "metrics"?, "facts"?, "cases"?, "note"? }'); return []; }
    const used = new Set(items.map(it => it.id));
    return data.context.filter((c, i) => {
      const where = `context[${i}]`;
      if (!c || typeof c !== 'object' || Array.isArray(c) || typeof c.id !== 'string' || !c.id || typeof c.title !== 'string' || !c.title) {
        errors.push(`${where} needs "id" and "title"`); return false;
      }
      Object.keys(c).filter(k => !CONTEXT_KEYS.includes(k)).forEach(k => errors.push(`${where} takes no "${k}": only ${CONTEXT_KEYS.join(', ')}`));
      if (c.id.startsWith('_')) errors.push(`${where} id "${c.id}" is reserved: ids starting with "_" are the page's own`);
      else if (used.has(c.id)) errors.push(`${where} id "${c.id}" is already used`);
      used.add(c.id);
      if (c.outcome != null && (!Number.isInteger(c.outcome) || c.outcome < 0 || c.outcome >= outcome.length)) errors.push(`${where}.outcome ${c.outcome}: the gate has ${outcome.length} outcome entries`);
      if (c.metrics != null && !Array.isArray(c.metrics)) errors.push(`${where}.metrics must be an array`);
      if (c.figures != null && !Array.isArray(c.figures)) errors.push(`${where}.figures must be an array`);
      if (Array.isArray(c.figures)) c.figures.forEach((f, j) => embed(f, `${where}.figures[${j}]`));
      checkText(c, 'why', where);
      checkText(c, 'detail', where);
      checkKeys(c, where, c.id);
      checkFacts(c, where);
      checkCases(c, where);
      if (c.note != null && (typeof c.note !== 'string' || !c.note.trim())) errors.push(`${where}.note must be a non-empty string`);
      return true;
    });
  }

  // kind "acceptance": the top-level examples list, copied from the decision record's `## Examples` (the renderer reads no
  // record, so it checks a case's example only against this list). Returns the ids, or null when the list is absent or unusable.
  function acceptanceExamples() {
    if (data.examples == null) return null;
    if (!Array.isArray(data.examples)) { errors.push('"examples" must be an array of { id, given, when, then }'); return null; }
    const ids = [];
    data.examples.forEach((e, i) => {
      const where = `examples[${i}]`;
      if (!e || typeof e !== 'object' || Array.isArray(e)) { errors.push(`${where} must be an object`); return; }
      if (Object.keys(e).some(k => !EXAMPLE_KEYS.includes(k))) errors.push(`${where} takes only ${EXAMPLE_KEYS.join(', ')}`);
      if (typeof e.id !== 'string' || !EXAMPLE_ID.test(e.id)) errors.push(`${where}.id must be an id like "E3"`);
      else if (ids.includes(e.id)) errors.push(`examples id "${e.id}" is named twice`);
      else ids.push(e.id);
      ['given', 'when', 'then'].forEach(k => { if (typeof e[k] !== 'string' || !e[k].trim()) errors.push(`${where}.${k} must be a non-empty string`); });
    });
    return ids;
  }

  // kind "acceptance": the cases to present, each with its screenshots (or why there are none) and a technical part.
  function acceptanceCases() {
    ACCEPTANCE_TOP.forEach(k => { if (data[k] != null) errors.push(`kind "acceptance" takes no "${k}": the page presents a branch, nothing on it is decided`); });
    if (typeof data.branch !== 'string' || !data.branch.trim()) errors.push('kind "acceptance" needs "branch": the presented branch');
    if (typeof data.commit !== 'string' || !COMMIT.test(data.commit)) errors.push('kind "acceptance" needs "commit": the presented head, 7-40 hex characters');
    if (data.lang != null && !LANGS.includes(data.lang)) errors.push(`"lang" must be one of ${LANGS.join(', ')}`);
    const exampleIds = acceptanceExamples();
    if (!Array.isArray(data.cases) || !data.cases.length) { errors.push('kind "acceptance" needs "cases": a non-empty array'); return []; }
    return data.cases.map((c, i) => {
      const where = `cases[${i}]`;
      if (!c || typeof c !== 'object' || Array.isArray(c)) { errors.push(`${where} must be an object`); return { kind: 'case', id: where, title: '', steps: [], expected: '', figures: [], options: [] }; }
      const name = c.id ? `${where} ("${c.id}")` : where;
      Object.keys(c).filter(k => !CASE_KEYS.includes(k)).forEach(k => errors.push(`${name} has "${k}": a case takes only ${CASE_KEYS.join(', ')} — nothing on this page is decided`));
      if (typeof c.id !== 'string' || !c.id || typeof c.title !== 'string' || !c.title) errors.push(`${where} needs "id" and "title"`);
      if (!Array.isArray(c.steps) || !c.steps.length || c.steps.some(s => typeof s !== 'string' || !s.trim())) errors.push(`${name} needs "steps": a non-empty array of strings`);
      if (typeof c.expected !== 'string' || !c.expected.trim()) errors.push(`${name} needs "expected": the expected result`);
      if (c.group != null && (typeof c.group !== 'string' || !c.group.trim())) errors.push(`${name}.group must be a non-empty string`);
      if (c.example != null) {
        if (typeof c.example !== 'string' || !EXAMPLE_ID.test(c.example)) errors.push(`${where}.example must be an id like "E3"`);
        else if (data.examples == null) errors.push(`${where}.example needs a top-level "examples" list to check it against`);
        else if (exampleIds && !exampleIds.includes(c.example)) errors.push(`${where}.example "${c.example}" is not in "examples"`);
      }
      if (c.figures != null && !Array.isArray(c.figures)) errors.push(`${name}.figures must be an array`);
      const figures = Array.isArray(c.figures) ? c.figures : [];
      if (c.unshown != null && (typeof c.unshown !== 'string' || !c.unshown.trim())) errors.push(`${name}.unshown must be a non-empty string: why the case could not be shown`);
      if (!figures.length && !c.unshown) errors.push(`${name} needs "figures" (its screenshots) or "unshown" (why it could not be shown)`);
      figures.forEach((f, j) => embed(f, `${name}.figures[${j}]`));
      if (c.tech != null) {
        const t = c.tech;
        if (!t || typeof t !== 'object' || Array.isArray(t)) errors.push(`${name}.tech must be { "how", "files", "data" }`);
        else {
          Object.keys(t).filter(k => !TECH_KEYS.includes(k)).forEach(k => errors.push(`${name}.tech has "${k}": it takes only ${TECH_KEYS.join(', ')}`));
          ['how', 'data'].forEach(k => { if (t[k] != null && (typeof t[k] !== 'string' || !t[k].trim())) errors.push(`${name}.tech.${k} must be a non-empty string`); });
          if (t.files != null) {
            if (!Array.isArray(t.files)) errors.push(`${name}.tech.files must be an array of repo-relative paths`);
            else t.files.forEach((f, j) => { if (typeof f !== 'string' || !REPO_PATH.test(f) || LOCAL_PATH.test(f)) errors.push(`${name}.tech.files[${j}] "${f}" is not a repo-relative path`); });
          }
        }
      }
      return Object.assign({}, c, { kind: 'case', figures, options: [] });
    });
  }

  // code: { before, after } on the item; when the options change the code differently, each option carries its own
  // "after" (and "before" only where it differs) and the item keeps the shared "before".
  const hasCode = item => !!(item.code && (item.code.before || item.code.after)) || item.options.some(o => o.code);
  function checkCode(item, where) {
    const bad = c => !c || typeof c !== 'object' || Array.isArray(c) || ['before', 'after'].some(k => c[k] != null && typeof c[k] !== 'string');
    if (item.code != null && bad(item.code)) errors.push(`${where} ("${item.id}").code must be { "before", "after" } strings`);
    const own = item.options.filter(o => o.code != null);
    own.forEach(o => {
      if (bad(o.code) || !o.code.after) errors.push(`${where} ("${item.id}") option "${o.value}".code must be { "after" }, plus "before" only where it differs from the item's`);
    });
    if (own.length && item.code && item.code.after != null) {
      errors.push(`${where} ("${item.id}") has "code.after" and options with their own code — put each option's "after" on that option and keep only "before" on the item`);
    }
  }

  // examples: given / when / then rows, one line each, on an item or an option.
  function checkExamples(list, where) {
    if (list == null) return;
    if (!Array.isArray(list)) { errors.push(`${where}.examples must be an array of { "given", "when", "then" }`); return; }
    if (list.length > 8) errors.push(`${where}.examples has ${list.length} rows (max 8)`);
    list.forEach((r, j) => {
      const at = `${where}.examples[${j}]`;
      if (!r || typeof r !== 'object' || Array.isArray(r)) { errors.push(`${at} must be { "given", "when", "then" }`); return; }
      ['given', 'when', 'then'].forEach(k => {
        const v = r[k];
        if (typeof v !== 'string' || !v.trim()) errors.push(`${at} needs "${k}": a non-empty one-line string`);
        else if (/[\r\n]/.test(v)) errors.push(`${at}.${k} must be one line`);
        else if (v.length > 120) errors.push(`${at}.${k} is ${v.length} characters (max 120)`);
      });
    });
  }

  // An option's own evidence, shown while it is chosen (else recommended) or picked: metrics, examples, figures, and what it accepts.
  function checkOwnEvidence(item, where) {
    checkExamples(item.examples, `${where} ("${item.id}")`);
    item.options.forEach(o => {
      const at = `${where} ("${item.id}") option "${o.value}"`;
      checkArguments(o, at);
      checkExamples(o.examples, at);
      ['metrics', 'figures'].forEach(k => { if (o[k] != null && !Array.isArray(o[k])) errors.push(`${at}.${k} must be an array`); });
      if (Array.isArray(o.figures)) o.figures.forEach((f, j) => embed(f, `${at}.figures[${j}]`));
      if (o.accepts == null) return;
      if (typeof o.accepts !== 'string' || !o.accepts) errors.push(`${at}.accepts must be a one-line string`);
      else if (o.accepts.length > MAX_BRIDGE.accepts) errors.push(`${at}.accepts is ${o.accepts.length} characters (max ${MAX_BRIDGE.accepts})`);
    });
  }

  // constraints: on the item they bind. Ids name one constraint across the page; a copy on another card must be identical.
  const constraintIds = new Map();
  function checkConstraints(list, where) {
    if (list == null) return [];
    if (!Array.isArray(list)) { errors.push(`${where} must be an array of { "id", "lens", "text", "source", "status" }`); return []; }
    const here = new Set();
    return list.filter((k, j) => {
      const at = `${where}[${j}]`;
      if (!k || typeof k !== 'object' || !k.id || !k.text || !k.source) { errors.push(`${at} needs "id", "text" and "source"`); return false; }
      if (!LENSES.includes(k.lens)) errors.push(`${at} ("${k.id}").lens must be one of ${LENSES.join(', ')}`);
      if (!STATUSES.includes(k.status)) errors.push(`${at} ("${k.id}").status must be one of ${STATUSES.join(', ')}`);
      const first = constraintIds.get(k.id);
      if (!first) constraintIds.set(k.id, k);
      else if (['lens', 'text', 'source', 'status'].some(f => first[f] !== k[f])) errors.push(`constraint "${k.id}" differs between the cards it is copied onto — copy it unchanged, or give it another id`);
      else if (here.has(k.id)) { errors.push(`${at}: constraint "${k.id}" is listed twice on this card`); return false; }
      here.add(k.id);
      return true;
    });
  }

  // The lens a kind of gate assumes for a line that names none (C5).
  const KIND_LENS = { debate: 'business', council: 'business', kickoff: 'business', plan: 'tech' };
  // lens: the item's default; each argument, metric and figure may carry its own. An item with none renders as before.
  function checkLens(item, where) {
    const oneOf = `must be one of ${LENSES.join(', ')}`;
    if (item.lens != null && !LENSES.includes(item.lens)) errors.push(`${where} ("${item.id}").lens ${oneOf}`);
    const entries = [];
    const collect = (holder, k, base) => {
      if (!Array.isArray(holder[k])) return;
      holder[k].forEach((e, j) => {
        if (!e || typeof e !== 'object') return;
        if (e.lens != null && !LENSES.includes(e.lens)) errors.push(`${base}.${k}[${j}].lens ${oneOf}`);
        entries.push({ e, at: `${base}.${k}[${j}]` });
      });
    };
    ['for', 'against', 'metrics', 'examples', 'figures'].forEach(k => collect(item, k, where));
    item.options.forEach(o => ['for', 'against', 'metrics', 'examples', 'figures'].forEach(k => collect(o, k, `${where} option "${o.value}"`)));
    if (item.lens == null && !entries.some(x => x.e.lens != null)) return;
    // Every entry gets a lens: its own, else the item's, else the kind's default. Review and refactor have none: those refuse.
    const dflt = item.lens != null ? item.lens : KIND_LENS[data.kind];
    entries.forEach(({ e, at }) => {
      if (e.lens == null && dflt != null) e.lens = dflt;
      if (e.lens == null) errors.push(`${at} has no lens and its item none to give — set "lens" on the entry or on the item`);
    });
    const lenses = new Set(entries.map(x => x.e.lens));
    if (hasCode(item)) lenses.add('tech'); // code is always tech
    // Tabs only where there is something to switch: entries of both lenses. A one-lens card says its lens in the header.
    if (lenses.has('business') && lenses.has('tech')) item.lensTabs = true;
  }

  // lenses: what the card concerns, for its header chips and the page's lens filter. Absent on a lens-free item.
  function concerns(item) {
    const found = new Set();
    if (LENSES.includes(item.lens)) found.add(item.lens);
    [item].concat(item.options).forEach(h => ['for', 'against', 'metrics', 'examples', 'figures'].forEach(k => {
      if (Array.isArray(h[k])) h[k].forEach(e => { if (e && LENSES.includes(e.lens)) found.add(e.lens); });
    }));
    item.options.forEach(o => {
      if (o.tradeoff && typeof o.tradeoff === 'object') LENSES.forEach(l => { if (o.tradeoff[l]) found.add(l); });
    });
    (item.bridge || []).forEach(k => { if (LENSES.includes(k.lens)) found.add(k.lens); }); // breaking a tech rule concerns tech
    // Code is tech, but a lens-free item with code stays lens-free.
    if (found.size && hasCode(item)) found.add('tech');
    if (found.size) item.lenses = LENSES.filter(l => found.has(l));
  }

  // The bridge: what each option gains and costs per lens, the constraints it breaks, and what the pick accepts.
  function checkBridge(item, where) {
    const own = checkConstraints(item.constraints, `${where}.constraints`);
    const known = new Set(own.map(k => k.id));
    let traded = false;
    item.options.forEach(o => {
      const at = `${where} ("${item.id}") option "${o.value}"`;
      const t = o.tradeoff;
      if (t != null) {
        if (!t || typeof t !== 'object' || Array.isArray(t) || (t.business == null && t.tech == null)) errors.push(`${at}: "tradeoff" needs "business" and/or "tech"`);
        else {
          traded = true;
          Object.keys(t).forEach(l => {
            if (!LENSES.includes(l)) errors.push(`${at}: tradeoff key "${l}" must be one of ${LENSES.join(', ')}`);
            else if (typeof t[l] !== 'string' || !t[l]) errors.push(`${at}: tradeoff.${l} must be a one-line string`);
            else if (t[l].length > MAX_BRIDGE.tradeoff) errors.push(`${at}: tradeoff.${l} is ${t[l].length} characters (max ${MAX_BRIDGE.tradeoff})`);
          });
        }
      }
      if (o.violates == null) return;
      if (!Array.isArray(o.violates) || o.violates.some(v => typeof v !== 'string')) { errors.push(`${at}: "violates" must be an array of constraint ids`); return; }
      o.violates.forEach(v => { if (!known.has(v)) errors.push(`${at} violates unknown constraint "${v}" (not on this item)`); });
      // Auto-accept takes defaults and recommendations: neither may lift a constraint, whatever its status.
      const breaks = o.violates.filter(v => known.has(v));
      if (breaks.length && (o.recommended || o.value === item.default)) {
        errors.push(`${at} is ${o.recommended ? 'recommended' : 'the default'} but violates ${breaks.join(', ')} — only the human lifts a constraint: recommend an option that keeps it`);
      }
    });
    if (item.accepts != null) {
      if (typeof item.accepts !== 'string' || !item.accepts) errors.push(`${where} ("${item.id}").accepts must be a one-line string`);
      else if (item.accepts.length > MAX_BRIDGE.accepts) errors.push(`${where} ("${item.id}").accepts is ${item.accepts.length} characters (max ${MAX_BRIDGE.accepts})`);
    } else if (traded && item.options.some(o => o.recommended && !o.accepts)) {
      errors.push(`${where} ("${item.id}") recommends an option with a "tradeoff" but has no "accepts" — say in one line what the pick costs`);
    }
    if (own.length) item.bridge = own;
  }

  if (Array.isArray(data.constraints) ? data.constraints.length : data.constraints != null) errors.push('page-level "constraints" are not supported — put each constraint on every card it binds (decisions, tensions or settled items); one that binds no card is not a constraint');
  const items = [];

  (data.decisions || []).forEach((d, i) => {
    const where = `decisions[${i}]`;
    if (!d.id || !d.title) errors.push(`${where} needs "id" and "title"`);
    const item = Object.assign({ kind: 'decision' }, d);
    // A debate decision with its own options carries one negative option, worded for the question; its arguments
    // go on the options, never on the question.
    if (STORY_KINDS.includes(data.kind) && d.id && Array.isArray(d.options) && d.options.length) {
      const neg = d.options.filter(o => o && o.negative).length;
      if (!neg) errors.push(`${d.id} has no negative option: add one with "negative": true and a label that says no to this question`);
      else if (neg > 1) errors.push(`${d.id} has ${neg} negative options: keep exactly one, with "negative": true and a label that says no to this question`);
    }
    if (d.id && ['for', 'against'].some(k => Array.isArray(d[k]) && d[k].length)) {
      errors.push(Array.isArray(d.options) && d.options.length
        ? `${d.id} has arguments on the question: put each on the option it backs or opposes directly (its "for" or "against"), on several if it applies to several`
        : `${d.id} has arguments on the question: write its options out ("approve" labelled "Approve", and "decline" labelled "Decline" with "negative": true) and put each argument on the option it backs or opposes directly; arguments for approving are Approve's "for", against approving Approve's "against"`);
    }
    // Sides are a tension's: on a decision they would show as evidence while its choices fall back to Approve and Decline.
    if (d.id && Array.isArray(d.sides) && d.sides.length) {
      errors.push(`${d.id} has "sides": a decision's choices are its options; write each side as an option (its position as the label, its for and against on it) with one "negative": true, or make it a tension`);
    }
    // The page shows the negative option last, whatever its place in the JSON (display order only; ids are unchanged).
    if (Array.isArray(item.options) && item.options.some(o => o && o.negative)) {
      item.options = item.options.filter(o => !(o && o.negative)).concat(item.options.filter(o => o && o.negative));
    }
    if (!item.options || !item.options.length) {
      item.options = [
        { value: 'approve', label: 'Approve', recommended: d.recommended !== 'decline' },
        { value: 'decline', label: 'Decline', negative: true, recommended: d.recommended === 'decline' }
      ];
    }
    items.push(finish(item, where));
  });

  (data.tensions || []).forEach((t, i) => {
    const where = `tensions[${i}]`;
    const id = t.id || `T${i + 1}`;
    if (!t.topic && !t.title) errors.push(`${where} needs "topic"`);
    if (!Array.isArray(t.sides) || t.sides.length < 2) errors.push(`${where} needs at least two "sides"`);
    if (t.recommended != null) errors.push(`${where}.recommended is not supported — set "recommended": true on the recommended side`);
    // Drop a leading "T1 — " from the topic: the id is shown separately.
    const title = String(t.topic || t.title || '').replace(new RegExp('^' + id + '\\s*[—:-]\\s*'), '');
    const item = Object.assign({}, t, { kind: 'tension', id, title, group: 'Tensions' });
    delete item.topic;
    if (['for', 'against'].some(k => Array.isArray(t[k]) && t[k].length)) {
      errors.push(`${id} has arguments on the question: put each on the side it backs (sides[].for / sides[].against)`);
    }
    if (!item.options || !item.options.length) {
      item.options = (t.sides || []).map((s, j) => Object.assign({
        value: String(s.who || `side ${j + 1}`).replace(/\|/g, '/'),
        label: 'Side with ' + (s.who || `side ${j + 1}`),
        recommended: !!s.recommended
      }, s.negative ? { negative: true } : {},
        ...SIDE_KEYS.filter(k => s[k] != null).map(k => ({ [k]: s[k] }))))
        .concat([{ value: 'defer', label: 'Defer', negative: true }]);
    }
    items.push(finish(item, where));
  });

  (data.rejected || []).forEach((r, i) => {
    const where = `rejected[${i}]`;
    if (!r.id || !r.title) errors.push(`${where} needs "id" and "title"`);
    const item = Object.assign({}, r, { kind: 'rejected', group: 'Considered and rejected' });
    if (['for', 'against'].some(k => Array.isArray(r[k]) && r[k].length)) errors.push(`${r.id || where} has arguments on the item: put each on the option it backs or opposes ("revive" / "keep-rejected" …)`);
    if (r.reason && !r.why) item.why = 'Rejected because: ' + r.reason;
    delete item.reason;
    if (!item.options || !item.options.length) {
      item.options = [
        { value: 'keep-rejected', label: 'Keep rejected', recommended: true },
        { value: 'revive', label: 'Revive' }
      ];
    }
    if (item.default == null) item.default = 'keep-rejected';
    items.push(finish(item, where));
  });

  (data.settled || []).forEach((s, i) => {
    const where = `settled[${i}]`;
    if (!s.id || !s.title || !s.answer || !s.source || !s.who) errors.push(`${where} needs "id", "title", "answer", "source" and "who"`);
    else if (String(s.answer).length > MAX.why) errors.push(`${where} ("${s.id}").answer is ${String(s.answer).length} characters (max ${MAX.why})`);
    // unverified: what would settle a line the verifier could not confirm, or never checked.
    if (s.unverified != null && (typeof s.unverified !== 'string' || !s.unverified.trim())) errors.push(`${where} ("${s.id}").unverified must be a non-empty string`);
    const item = Object.assign({}, s, { kind: 'settled', group: 'Settled without you' });
    if (['for', 'against'].some(k => Array.isArray(s[k]) && s[k].length)) errors.push(`${s.id || where} has arguments on the item: put each on the option it backs or opposes ("reopen" / "ok" …)`);
    if (!item.options || !item.options.length) item.options = [{ value: 'ok', label: 'OK', recommended: true }, { value: 'reopen', label: 'Reopen' }];
    if (item.default == null) item.default = 'ok';
    items.push(finish(item, where));
  });

  // Questions for the branch's author: a shared review asks them, unless the reviewer drops one.
  (data.questions || []).forEach((q, i) => {
    const where = `questions[${i}]`;
    if (!q.id || !q.title || !q.source || !q.who) errors.push(`${where} needs "id", "title", "source" and "who"`);
    const item = Object.assign({}, q, { kind: 'question', group: 'Questions for the author' });
    if (['for', 'against'].some(k => Array.isArray(q[k]) && q[k].length)) errors.push(`${q.id || where} has arguments on the item: put each on the option it backs or opposes ("drop" / "ask" …)`);
    if (!item.options || !item.options.length) item.options = [{ value: 'ask', label: 'Ask the author', recommended: true }, { value: 'drop', label: 'Drop', negative: true }];
    if (item.default == null) item.default = 'ask';
    items.push(finish(item, where));
  });

  if (ACCEPTANCE) acceptanceCases().forEach(it => items.push(it));

  const ids = new Set();
  items.forEach(it => {
    if (ids.has(it.id)) errors.push(`duplicate id "${it.id}" (ids must be unique across decisions, tensions, questions, settled and rejected)`);
    ids.add(it.id);
  });
  items.forEach(it => {
    // "needs" is the old name of "after": copied over, then dropped.
    if (it.needs != null) {
      if (it.after != null) { errors.push(`"${it.id}" has both "after" and its old name "needs" — keep "after"`); delete it.needs; return; }
      it.after = it.needs; delete it.needs;
    }
    if (it.after == null) return;
    if (!Array.isArray(it.after) || it.after.some(n => typeof n !== 'string')) { errors.push(`"${it.id}".after must be an array of ids`); return; }
    it.after.forEach(n => {
      if (n === it.id) errors.push(`"${it.id}".after names itself`);
      else if (!ids.has(n)) errors.push(`"${it.id}".after names unknown id "${n}"`);
    });
  });
  const ordered = linkItems(items, errors);
  // at: where a decision's or tension's code is, for the review's anchored comments.
  items.forEach(it => {
    if (it.at == null) return;
    const a = it.at;
    if (!a || typeof a !== 'object' || Array.isArray(a) || typeof a.path !== 'string' || !a.path || !Number.isInteger(a.line) || a.line < 1) {
      errors.push(`"${it.id}".at must be { "path", "line" } with a repo-relative path and a line ≥ 1`);
    } else if (LOCAL_PATH.test(a.path) || a.path.startsWith('/')) {
      errors.push(`"${it.id}".at.path "${a.path}" is not repo-relative`);
    }
  });
  // suggestion: { lines, text } on an item or on one option: replaces `lines` lines from at.line, for --review.
  items.forEach(it => {
    const holders = [it].concat(it.options || []).filter(h => h.suggestion != null);
    if (!holders.length) return;
    if (holders.length > 1) errors.push(`"${it.id}" has more than one suggestion`);
    holders.forEach(h => {
      const s = h.suggestion;
      if (!it.at) errors.push(`"${it.id}".suggestion needs "at"`);
      if (!s || typeof s !== 'object' || Array.isArray(s) || !Number.isInteger(s.lines) || s.lines < 1 || typeof s.text !== 'string') {
        errors.push(`"${it.id}".suggestion must be { "lines", "text" }`);
      } else if (s.text.split(/\r?\n/).some(l => /^\s*`{3,}\s*$/.test(l))) {
        errors.push(`"${it.id}".suggestion.text cannot contain a code fence`);
      }
    });
  });
  (data.figures || []).forEach((f, i) => embed(f, `figures[${i}]`));

  // An item brief stands for one option that leads to work, never two: the evidence pane and the prompt
  // would pair one choice with the other's fix.
  items.forEach(it => {
    if (!it.brief || it.kind === 'rejected' || it.kind === 'settled' || it.kind === 'question') return;
    const work = it.options.filter(o => !o.negative);
    if (work.length > 1) work.forEach(o => {
      if (!o.brief) errors.push(`"${it.id}" option "${o.value}" has no brief of its own — with ${work.length} options that lead to work, each needs its own "brief"`);
    });
  });

  let preset = null;
  // --share: every outcome that leads to work carries a brief the reader's Claude can follow alone.
  if (SHARE && data.kind !== 'review') {
    // K13: any other kind goes as a file with no work order: no preamble, SHA or brief, no preset.
    if (PRESET) errors.push('--preset needs a review gate: only a team-review share carries a preset');
  } else if (SHARE) {
    if (data.lang != null && !LANGS.includes(data.lang)) errors.push(`"lang" must be one of ${LANGS.join(', ')}`);
    if (!data.preamble) errors.push('--share needs "preamble": repo, branch, reviewed commit SHA, scope, baseline, rules (see contract.md, Share fields)');
    else if (!SHA.test(data.preamble)) errors.push('"preamble" names no commit SHA — give the reviewed commit, so the reader can tell when HEAD has moved');
    const texts = [['preamble', data.preamble]];
    items.forEach(it => {
      if (it.kind === 'rejected') return;
      if (it.brief != null) texts.push([`${it.id}.brief`, it.brief]);
      it.options.forEach(o => {
        if (o.brief != null) texts.push([`${it.id}.options[${o.value}].brief`, o.brief]);
        // A settled item or a question leads to no work: the prompt lists it, it never runs.
        if (!o.negative && !o.brief && !it.brief && it.kind !== 'settled' && it.kind !== 'question') {
          errors.push(`"${it.id}" option "${o.value}" leads to work but has no brief — set "brief" on the item or the option, or mark the option "negative": true`);
        }
      });
    });
    texts.forEach(([where, t]) => {
      if (t == null) return;
      if (typeof t !== 'string') { errors.push(`${where} must be a Markdown string`); return; }
      const m = t.match(LOCAL_PATH);
      if (m) errors.push(`${where} holds "${(m[1] || m[0]).trim()}", a path the reader doesn't have — name files relative to the repo root`);
    });
    if (PRESET) preset = readPreset(PRESET, items, errors);
  }

  // outcome: where the work lands, one entry per view it changes (ui mockup, system diagram).
  if (data.outcome != null && !Array.isArray(data.outcome)) errors.push('"outcome" must be an array of { "view", "after", "before"?, "caption" }');
  const outcome = Array.isArray(data.outcome) ? data.outcome : [];
  if (NEEDS_OUTCOME.includes(data.kind) && !outcome.length) {
    errors.push(`kind "${data.kind}" needs "outcome": a mockup ("view": "ui") and/or a diagram ("view": "system") of the result`);
  }
  outcome.forEach((o, i) => {
    const where = `outcome[${i}]`;
    if (!VIEWS.includes(o.view)) errors.push(`${where}.view must be one of ${VIEWS.join(', ')}`);
    if (!o.caption) errors.push(`${where} needs "caption": one line saying what to look at`);
    if (!o.after) errors.push(`${where} needs "after": the target state`);
    ['before', 'after'].forEach(k => { if (o[k]) embed(o[k], `${where}.${k}`); });
    if (o.states != null) {
      if (!Array.isArray(o.states)) errors.push(`${where}.states must be an array of { "label", "svg" | "src", "caption" }`);
      else {
        if (o.states.length > 6) errors.push(`${where}.states has ${o.states.length} entries (max 6)`);
        o.states.forEach((st, j) => {
          const at = `${where}.states[${j}]`;
          if (!st || typeof st !== 'object' || Array.isArray(st)) { errors.push(`${at} must be { "label", "svg" | "src", "caption" }`); return; }
          if (typeof st.label !== 'string' || !st.label.trim()) errors.push(`${at} needs "label": a non-empty string`);
          else if (st.label.length > 40) errors.push(`${at}.label is ${st.label.length} characters (max 40)`);
          if (typeof st.caption !== 'string' || !st.caption.trim()) errors.push(`${at} needs "caption": what differs from "after"`);
          if (!st.svg && !st.src && st.html === undefined) errors.push(`${at} needs "svg", "html" or "src": the figure of the state`);
          else embed(st, at);
        });
      }
    }
    // on: { id, when }: a destination that holds only for some answers of one card, shown while that answer is chosen or recommended.
    if (o.on == null) return;
    const target = o.on && items.find(it => it.id === o.on.id);
    if (!target || !Array.isArray(o.on.when) || !o.on.when.length) {
      errors.push(`${where}.on must be { "id", "when": [option values] } naming a decision or tension`);
    } else if (target.kind !== 'decision' && target.kind !== 'tension') {
      errors.push(`${where}.on names "${target.id}", a ${target.kind} item — an outcome follows a decision or a tension`);
    } else {
      o.on.when.forEach(v => { if (!target.options.some(x => x.value === v)) errors.push(`${where}.on.when names "${v}", not an option of "${target.id}"`); });
    }
  });
  // D2: a debate card with nothing drawn is warned about (writer), nothing on the page. A4: so is a kickoff scope item
  // (lens "business"; the stack and conventions tail is "tech"). Old "council" gates stay as they were.
  if (data.kind === 'debate' || data.kind === 'kickoff') {
    const has = x => x && ((Array.isArray(x.examples) && x.examples.length) || (Array.isArray(x.figures) && x.figures.length));
    items.filter(it => it.kind === 'decision' || it.kind === 'tension').forEach(it => {
      if (data.kind === 'kickoff' && it.lens !== 'business') return;
      if (has(it) || (it.options || []).some(has) || outcome.some(o => o.on && o.on.id === it.id)) return;
      if (!it.unillustrated) warnings.push(`${it.id} is not illustrated: give it examples${STORY_KINDS.includes(data.kind) ? ' or' : ','} a figure${STORY_KINDS.includes(data.kind) ? '' : ' or an outcome'}, or say why in "unillustrated"`);
    });
  }
  const context = checkContext(data, items, outcome, errors);
  // A context row's title is its list row's: over 70 characters it warns the writer, acceptance included; nothing is cut.
  const over70 = x => { if (typeof x.title === 'string' && x.title.length > 70) warnings.push(`${x.id} title is ${x.title.length} characters: keep a list title under 70`); };
  if (data.kind === 'acceptance') context.forEach(over70);
  // A deciding page shows the story: what no context row or card holds is not on it.
  if (data.kind !== 'acceptance') {
    if (data.kind === 'review' && !context.length) warnings.push('a review gate with no context row posts a review body with no verdict: put the cover first');
    outcome.forEach((o, i) => { if (!context.some(c => c.outcome === i)) warnings.push(`outcome[${i}] is not shown: name it in a context row's "outcome"`); });
    if (Array.isArray(data.figures) && data.figures.length) warnings.push('"figures" are not shown on a deciding gate: put each on the card or context row it shows');
    // A list title is the row and the card's headline: over 70 characters it warns the writer; nothing is cut.
    [...items, ...context].forEach(over70);
    // An option label is one row of the card's choice: over 60 characters it warns the writer; nothing is cut.
    items.forEach(it => (Array.isArray(it.options) ? it.options : []).forEach(o => {
      if (o && typeof o.label === 'string' && o.label.length > 60) warnings.push(`${it.id} option "${o.value}" label is ${o.label.length} characters: keep it to 60 or less; the card's text can carry the rest`);
    }));
    // The pane shows one option at a time, so one figure on two options says nothing about either.
    const shown = o => new Set((Array.isArray(o.figures) ? o.figures : []).map(f => f && (f.svg || f.src || f.html)).filter(Boolean));
    items.filter(it => Array.isArray(it.options)).forEach(it => it.options.forEach((a, i) => it.options.slice(i + 1).forEach(b => {
      const fa = shown(a);
      if ([...shown(b)].some(f => fa.has(f))) warnings.push(`${it.id} options "${a.value}" and "${b.value}" show the same figure: give an option a figure only where it lands differently`);
    })));
    // One figure, one place: drawn on two cards or context rows, it tells the reader nothing new the second time.
    const drawnBy = new Map();
    [...context, ...items].forEach(x => {
      const figs = [].concat(Array.isArray(x.figures) ? x.figures : [],
        (Array.isArray(x.cases) ? x.cases : []).map(k => k && k.figure),
        ...(Array.isArray(x.options) ? x.options : []).map(o => (o && Array.isArray(o.figures) ? o.figures : [])));
      new Set(figs.map(f => f && (f.svg || f.src || f.html)).filter(Boolean)).forEach(f => {
        if (!drawnBy.has(f)) drawnBy.set(f, []);
        drawnBy.get(f).push(x.id);
      });
    });
    drawnBy.forEach(ids => { if (ids.length > 1) warnings.push(`${ids.join(', ')} show the same figure: draw it once, on the card it explains; a figure several cards share goes in a context row before them`); });
    // Plain words: a code the reader must decode (O1, Q2, P5, KS6) warns unless the page defines it, as a card or context
    // id or a constraint on some card. Text in backticks is code on purpose. Only fields the page shows are read.
    const CODE = /\b(?:KS\d+|[A-Z]\d{1,2}[a-z]?)\b/g;
    const SHOWN = new Set(['title', 'topic', 'why', 'detail', 'accepts', 'label', 'point', 'business', 'tech', 'position', 'given', 'when', 'then', 'answer', 'text', 'caption', 'note']);
    const HIDDEN = new Set(['on', 'after', 'figures', 'code', 'brief', 'suggestion', 'at', 'bridge', 'constraints', 'outcome', 'figure']);
    const shownText = (x, key, out) => {
      if (typeof x === 'string') { if (SHOWN.has(key)) out.push(x); }
      else if (Array.isArray(x)) x.forEach(v => shownText(v, key, out));
      else if (x && typeof x === 'object') Object.keys(x).forEach(k => { if (!HIDDEN.has(k)) shownText(x[k], k, out); });
      return out;
    };
    const known = new Set([...items, ...context].map(x => x.id));
    items.forEach(it => (Array.isArray(it.bridge) ? it.bridge : []).forEach(k => k && k.id && known.add(k.id)));
    [...context, ...items].forEach(x => {
      const found = [];
      shownText(x, null, []).forEach(s => (s.replace(/`[^`]*`/g, '').match(CODE) || []).forEach(c => { if (!known.has(c) && !found.includes(c)) found.push(c); }));
      if (found.length) warnings.push(`${x.id} names ${found.join(', ')}: a code this page never defines; write what each stands for`);
    });
    // At most ~7 weighty cards (contract.md § Triage): tensions and decisions, not minor items or the structure card.
    if (STORY_KINDS.includes(data.kind)) {
      const weighty = items.filter(it => it.kind === 'tension' || (it.kind === 'decision' && !it.minor && !/^(confirm the structure|confirmer la structure)\b/i.test(it.title || '')));
      if (weighty.length > 7) warnings.push(`${weighty.length} weighty cards (${weighty.map(it => it.id).join(', ')}): keep about 7; fold the rest to minor items with a default, by stakes`);
    }
  }
  const story = checkStory(data, ordered, context, errors, warnings);
  return { data, items: ordered, outcome, errors, warnings, preset, story, context };
}

module.exports = { loadGate };

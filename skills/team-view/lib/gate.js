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
const SIDE_KEYS = ['brief', 'suggestion', 'tradeoff', 'violates', 'code', 'metrics', 'figures', 'accepts'];
// --share: the reader has neither this machine nor the .council/ folder.
const LANGS = ['en', 'fr'];
const LOCAL_PATH = /(?:^|[\s`'"(])(\/home\/|\/Users\/|\/tmp\/|[A-Za-z]:\\)|\.council\//;
// A commit id: 7-40 hex characters with at least one letter and one digit (not a date).
const SHA = /\b(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]{7,40}\b/;

// Reads and validates the gate JSON. Every problem accumulates into `errors` (the caller prints them).
function loadGate(src, { share: SHARE, preset: PRESET }) {
  const data = JSON.parse(fs.readFileSync(src, 'utf8'));
  const baseDir = path.dirname(path.resolve(src));
  const errors = [];
  if (!data.title) errors.push('missing "title"');
  if (!Array.isArray(data.decisions) || !data.decisions.length) errors.push('"decisions" must be a non-empty array');
  if (data.summary != null) {
    if (!Array.isArray(data.summary)) errors.push('"summary" must be an array of bullets — strings or { "label", "text" | "points" } — not a paragraph');
    else data.summary.forEach((b, i) => {
      if (typeof b === 'string') return;
      if (!b || typeof b !== 'object' || (!b.text && !(Array.isArray(b.points) && b.points.length))) errors.push(`summary[${i}] needs "text" or "points"`);
    });
  }
  if (data.metrics) errors.push('top-level "metrics" is not supported — put each metric in the "metrics" of the item it measures');

  // Images are embedded as data URIs so the page is one self-contained file.
  // src must be relative to the JSON, so the gate folder holds its own evidence and re-renders later.
  function embed(fig, where) {
    if (!fig.svg && !fig.src) { errors.push(`${where} needs "svg" or "src"`); return; }
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
    const mime = MIME[path.extname(file).toLowerCase()];
    if (!mime) { errors.push(`${where}.src "${fig.src}" is not a supported image type`); return; }
    if (!fs.existsSync(file)) { errors.push(`${where}.src "${fig.src}" not found (resolved to ${file})`); return; }
    fig.src = `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
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
    if (text.length > MAX[key]) errors.push(`${where}.${key} is ${text.length} characters (max ${MAX[key]}) — keep the facts the title lacks, as bullets`);
    const bullets = Array.isArray(v) ? v : v.split('\n').filter(l => /^\s*[-•]\s/.test(l));
    if (bullets.length > MAX.bullets) errors.push(`${where}.${key} has ${bullets.length} bullets (max ${MAX.bullets})`);
    bullets.forEach((b, j) => { if (String(b).length > MAX.bullet) errors.push(`${where}.${key} bullet ${j + 1} is ${String(b).length} characters (max ${MAX.bullet})`); });
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
    return item;
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

  // An option's own evidence, shown while it is chosen (else recommended) or picked: metrics, figures, and what it accepts.
  function checkOwnEvidence(item, where) {
    item.options.forEach(o => {
      const at = `${where} ("${item.id}") option "${o.value}"`;
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
    ['for', 'against', 'metrics', 'figures'].forEach(k => collect(item, k, where));
    item.options.forEach(o => ['metrics', 'figures'].forEach(k => collect(o, k, `${where} option "${o.value}"`)));
    if (item.lens == null && !entries.some(x => x.e.lens != null)) return;
    // Every entry lands in one tab: its own lens, else the item's.
    entries.forEach(({ e, at }) => {
      if (e.lens == null && item.lens != null) e.lens = item.lens;
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
    [item].concat(item.options).forEach(h => ['for', 'against', 'metrics', 'figures'].forEach(k => {
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
    if (!item.options || !item.options.length) item.options = [{ value: 'ok', label: 'OK', recommended: true }, { value: 'reopen', label: 'Reopen' }];
    if (item.default == null) item.default = 'ok';
    items.push(finish(item, where));
  });

  // Questions for the branch's author: a shared review asks them, unless the reviewer drops one.
  (data.questions || []).forEach((q, i) => {
    const where = `questions[${i}]`;
    if (!q.id || !q.title || !q.source || !q.who) errors.push(`${where} needs "id", "title", "source" and "who"`);
    const item = Object.assign({}, q, { kind: 'question', group: 'Questions for the author' });
    if (!item.options || !item.options.length) item.options = [{ value: 'ask', label: 'Ask the author', recommended: true }, { value: 'drop', label: 'Drop', negative: true }];
    if (item.default == null) item.default = 'ask';
    items.push(finish(item, where));
  });

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
  if (SHARE) {
    if (data.kind !== 'review') errors.push('--share needs kind "review": only a team-review gate is shared with the branch owner');
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
  return { data, items: ordered, outcome, errors, preset };
}

module.exports = { loadGate };

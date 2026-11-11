const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { composeTemplate } = require('../../skills/team-view/lib/compose');

const RENDER = path.join(__dirname, '..', '..', 'skills', 'team-view', 'render.js');

// A small review gate that passes --share: one Approve step, one item with per-option briefs,
// one tension whose minimalist side means no work, one rejected idea.
function shareGate(overrides) {
  const gate = {
    kind: 'review',
    title: 'Gate',
    source: '.council/refactors/2026-10-14-x.md',
    lang: 'en',
    preamble: '# Mission: tidy x.js\n\nRepo acme, branch feat-x, reviewed commit 3cc5e54a9f.',
    decisions: [
      { id: 'S1', title: 'Extract Constant: RATE', brief: 'Do S1.' },
      { id: 'F1', title: 'Rounding rule', options: [
        { value: 'keep', label: 'Keep floor', recommended: true, brief: 'Add a comment.' },
        { value: 'round', label: 'Round', brief: 'Use Math.round.' },
        { value: 'ask', label: 'Ask finance', negative: true }
      ] }
    ],
    tensions: [
      { topic: 'Split module?', sides: [
        { who: 'Responsibilities', position: 'Split it.', brief: 'Split into a.js and b.js.' },
        { who: 'Minimalist', position: 'Keep it.', recommended: true, negative: true }
      ] }
    ],
    rejected: [{ id: 'RS-1', title: 'Strategy per tier', reason: 'One use' }]
  };
  return Object.assign(gate, overrides || {});
}

// Every temporary directory a test makes, removed when its test process exits (a run makes about a thousand).
const made = [];
process.on('exit', () => made.forEach(d => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* already gone */ } }));
function tmpDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.push(dir);
  return dir;
}

function writeGate(gate) {
  const dir = tmpDir('gate-');
  const file = path.join(dir, 'g.gate.json');
  fs.writeFileSync(file, JSON.stringify(gate));
  return file;
}

function render(file, ...flags) {
  const r = spawnSync(process.execPath, [RENDER, file, ...flags], { encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

function pageData(html) {
  return JSON.parse(html.match(/<script type="application\/json" id="gate-data">([\s\S]*?)<\/script>/)[1]);
}

// A valid 1x1 PNG, for gates whose figures must exist on disk.
const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGM4UWEDAAOIAX3sK7CeAAAAAElFTkSuQmCC', 'base64');

// A small acceptance page: one case with a screenshot and a technical part, one that could not be shown.
function acceptanceGate(overrides) {
  return Object.assign({
    kind: 'acceptance', title: 'Recette — export', date: '2026-11-09', lang: 'fr',
    branch: 'feat-export', commit: '4c3ebf618',
    ...cover([{ label: 'Ce que la branche apporte', text: 'Un export CSV des factures.' }], { why: 'Un export CSV des factures.' }),
    cases: [
      { id: 'C1', group: 'Exporter', title: 'Exporter les factures', steps: ['Ouvrir Factures', 'Cliquer sur Exporter'],
        expected: 'Un fichier CSV se télécharge.', figures: [{ src: 'shot.png', caption: 'Le bouton Exporter' }],
        tech: { how: 'Un endpoint GET renvoie le CSV.', files: ['src/export.js'], data: 'Trois factures de test.' } },
      { id: 'C2', group: 'Exporter', title: 'Exporter sans facture', steps: ['Filtrer sur une période vide'],
        expected: 'Un message dit qu’il n’y a rien à exporter.', unshown: 'Aucun environnement sans facture.' }
    ]
  }, overrides || {});
}

function writeAcceptance(gate) {
  const file = writeGate(gate);
  fs.writeFileSync(path.join(path.dirname(file), 'shot.png'), TINY_PNG);
  return file;
}

// The gate page text as render composes it: template.html with style.css, tokens.css and chrome.js inlined.
function composedTemplate() {
  return composeTemplate(path.dirname(RENDER));
}

// A DOM just wide enough to run the main script: real nodes for what the page builds, a callable no-op for the rest.
function fakeDom(html) {
  const ids = new Map(), body = node('body');
  function node(tag) {
    const cls = new Set();
    const t = { tagName: String(tag).toUpperCase(), children: [], parentNode: null, listeners: {}, attrs: {}, style: loose({}), dataset: {}, textContent: '', value: '', className: '', hidden: false, open: false,
      classList: { add: c => cls.add(c), remove: c => cls.delete(c), toggle: (c, on) => { const want = on === undefined ? !cls.has(c) : !!on; if (want) cls.add(c); else cls.delete(c); return want; }, contains: c => cls.has(c) || String(t.className).split(/\s+/).includes(c) },
      focus() { document.activeElement = p; }, blur() { if (document.activeElement === p) document.activeElement = null; }, click() { (t.listeners.click || []).slice().forEach(f => f({ type: 'click', target: p, preventDefault() {}, stopPropagation() {} })); },
      _cls: cls,
      get childNodes() { return t.children; }, get firstChild() { return t.children[0] || null; }, get lastChild() { return t.children[t.children.length - 1] || null; },
      get nextSibling() { const s = t.parentNode && t.parentNode.children; return s ? s[s.indexOf(p) + 1] || null : null; },
      previousSibling: null,
      appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = p; t.children.push(c); return c; },
      insertBefore(c, ref) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = p; const i = t.children.indexOf(ref); t.children.splice(i < 0 ? t.children.length : i, 0, c); return c; },
      removeChild(c) { t.children = t.children.filter(x => x !== c); c.parentNode = null; return c; },
      addEventListener(type, f) { (t.listeners[type] = t.listeners[type] || []).push(f); },
      setAttribute(k, v) { t.attrs[k] = String(v); }, getAttribute: k => (k in t.attrs ? t.attrs[k] : null), removeAttribute(k) { delete t.attrs[k]; }, hasAttribute: k => k in t.attrs,
      querySelector: () => node('div'), querySelectorAll: sel => query(p, sel), closest: sel => closestOf(p, sel), contains: () => false
    };
    // A failing assert prints both values with util.inspect (customInspect off, getters on, depth 1000): walking a node's
    // links reaches the whole page by every path (parent, children, siblings), which grows exponentially and exhausts
    // memory. Links stay usable but are not enumerable, so the message shows the node's own fields only.
    for (const k of ['children', 'parentNode', 'childNodes', 'firstChild', 'lastChild', 'nextSibling', 'previousSibling', 'listeners', 'classList', '_cls']) Object.defineProperty(t, k, { enumerable: false });
    const p = loose(t, (k, v) => { if (k === 'id') ids.set(v, p); });
    return p;
  }
  // Descendants of a node (or of the page's roots) carrying every class of a simple selector like ".a.b"; a comma lists alternatives.
  function query(root, sel) {
    const alts = String(sel).split(',').map(s => s.trim()).filter(s => /^(\.[\w-]+)+$/.test(s)).map(s => s.slice(1).split('.'));
    const out = [];
    if (!alts.length) return out;
    const seen = new Set();
    (function walk(n) {
      (Array.isArray(n.children) ? n.children : []).forEach(c => {
        if (seen.has(c)) return; seen.add(c);
        const has = k => c.classList.contains(k) === true; // the loose proxy answers anything truthy
        if (alts.some(a => a.every(has))) out.push(c);
        walk(c);
      });
    })(root);
    return out;
  }
  // The nearest ancestor-or-self matching one of a comma list of simple selectors: tag, .class (chained), #id, [attr].
  function closestOf(start, sel) {
    const alts = String(sel).split(',').map(s => s.trim()).filter(Boolean);
    const hit = (n, a) => {
      const m = a.match(/^([\w-]+)?((?:[.#][\w-]+|\[[\w-]+\])*)$/);
      if (!m) return false;
      if (m[1] && String(n.tagName).toLowerCase() !== m[1].toLowerCase()) return false;
      return (m[2].match(/[.#][\w-]+|\[[\w-]+\]/g) || []).every(x => (x[0] === '.' ? n.classList.contains(x.slice(1)) === true
        : x[0] === '#' ? n.id === x.slice(1) : n.hasAttribute(x.slice(1, -1)) === true));
    };
    // Only real nodes (their children is a real array) count; a fake or a null parent ends the walk.
    for (let n = start; n && Array.isArray(n.children); n = n.parentNode) if (alts.some(a => hit(n, a))) return n;
    return null;
  }
  function loose(t, onSet) {
    return new Proxy(t, {
      get: (o, k) => (k === Symbol.for('nodejs.util.inspect.custom') ? () => `<${String(o.tagName).toLowerCase()}${o.attrs && o.attrs.id ? '#' + o.attrs.id : ''}${[...(o._cls || [])].map(c => '.' + c).join('')}>`
        : k in o ? o[k] : typeof k === 'symbol' ? undefined : any),
      set: (o, k, v) => { o[k] = v; if (onSet) onSet(k, v); return true; }
    });
  }
  const any = new Proxy(function () {}, { get: (o, k) => (k === Symbol.toPrimitive ? () => 0 : k === Symbol.for('nodejs.util.inspect.custom') ? () => '<any>' : typeof k === 'symbol' ? undefined : k === 'length' ? 0 : any), apply: () => node('div') });
  // A template element: placed in a holder, so the script can insert beside it.
  const placed = () => node('div').appendChild(node('div'));
  const layout = placed();
  const qs = new Map(), store = new Map(), docListeners = {}, replaced = [];
  const document = {
    body, documentElement: node('html'), activeElement: null, title: '', readyState: 'complete',
    getElementById: id => (id === 'gate-data' ? { textContent: html.match(/<script type="application\/json" id="gate-data">([\s\S]*?)<\/script>/)[1] } : ids.get(id) || (ids.set(id, placed()), ids.get(id))),
    querySelector: sel => (sel === '.layout' ? layout : qs.get(sel) || (qs.set(sel, placed()), qs.get(sel))),
    querySelectorAll: sel => { const roots = { children: [body, layout, ...qs.values(), ...ids.values()] }; return query(roots, sel); },
    createElement: node, createElementNS: (ns, tag) => node(tag), createTextNode: s => { const n = node('#text'); n.textContent = s; return n; }, createDocumentFragment: () => node('#fragment'),
    addEventListener(type, f) { (docListeners[type] = docListeners[type] || []).push(f); }, removeEventListener() {}
  };
  const ctx = {
    document, console, Promise, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0,
    localStorage: { get length() { return store.size; }, key: i => [...store.keys()][i], getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    location: { hash: '', href: 'https://example.com/x', search: '' }, history: { replaceState: (...a) => { replaced.push(a); } },
    navigator: { clipboard: { writeText: () => Promise.resolve() }, platform: '', userAgent: '' },
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }), getComputedStyle: () => ({ getPropertyValue: () => '' }),
    addEventListener() {}, removeEventListener() {}, scrollTo() {},
    IntersectionObserver: function () { return { observe() {}, disconnect() {} }; }, ResizeObserver: function () { return { observe() {}, disconnect() {} }; }, MutationObserver: function () { return { observe() {}, disconnect() {} }; },
  };
  ctx.window = ctx;
  // press: a keydown on the document, as the page's own key handler sees it.
  const press = (key, extra) => {
    const e = Object.assign({ type: 'keydown', key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, target: document.activeElement || body, preventDefault() { e.defaultPrevented = true; } }, extra);
    (docListeners.keydown || []).slice().forEach(f => f(e));
    return e;
  };
  return { ctx, ids, body, store, press, document, replaced, roots: () => [body, layout, ...qs.values(), ...ids.values()] };
}

// A deciding gate's cover: one context row (spike §4) holding the page's why and facts.
function cover(facts, extra) {
  return { context: [Object.assign({ id: 'I0', title: 'Cover', facts }, extra)] };
}

// An item with its item-level for/against moved onto written-out options: for -> Approve's for, against -> Approve's
// against; approve is recommended unless the item said recommended: "decline", decline is the negative option.
function argued(item) {
  const { for: pros, against: cons, recommended, ...rest } = item;
  const approve = { value: 'approve', label: 'Approve', recommended: recommended !== 'decline' };
  if (pros) approve.for = pros;
  if (cons) approve.against = cons;
  return { ...rest, options: [approve, { value: 'decline', label: 'Decline', negative: true, recommended: recommended === 'decline' }] };
}

module.exports = { tmpDir, argued, cover, fakeDom, composedTemplate, RENDER, shareGate, writeGate, render, pageData, TINY_PNG, acceptanceGate, writeAcceptance };

// The DOM a fakeDom page built, as text: one line per element (tag, id, sorted classes, attributes, dataset, style keys,
// other own primitive properties, own text), children indented by two spaces. script and style subtrees are skipped.
const DOM_PLUMBING = new Set(['tagName', 'children', 'parentNode', 'listeners', 'attrs', 'style', 'dataset', 'textContent', 'className', 'classList', '_cls',
  'childNodes', 'firstChild', 'lastChild', 'nextSibling', 'previousSibling', 'id']);
function domText(root) {
  const lines = [], seen = new Set();
  (function walk(n, depth) {
    if (typeof n.tagName !== 'string' || seen.has(n)) return; // the catch-all stand-in is not a node
    seen.add(n);
    const tag = String(n.tagName || '').toLowerCase();
    if (tag === 'script' || tag === 'style') return;
    const pad = '  '.repeat(depth);
    const classes = [...new Set([...(n._cls || []), ...String(n.className || '').split(/\s+/).filter(Boolean)])].sort();
    const parts = [tag + (typeof n.id === 'string' && n.id ? '#' + n.id : '') + classes.map(c => '.' + c).join('')];
    Object.keys(n.attrs || {}).sort().forEach(k => parts.push('[' + k + '=' + JSON.stringify(n.attrs[k]) + ']'));
    Object.keys(n.dataset || {}).sort().forEach(k => parts.push('{data-' + k + '=' + JSON.stringify(String(n.dataset[k])) + '}'));
    Object.keys(n.style || {}).sort().forEach(k => parts.push('(style ' + k + '=' + JSON.stringify(String(n.style[k])) + ')'));
    Object.keys(n).filter(k => !DOM_PLUMBING.has(k)).sort().forEach(k => {
      const v = n[k];
      if (v !== null && v !== undefined && ['string', 'number', 'boolean'].includes(typeof v)) parts.push(k + '=' + JSON.stringify(v));
    });
    if (n.textContent) parts.push('"' + String(n.textContent).replace(/\n/g, '\\n') + '"');
    lines.push(pad + parts.join(' '));
    (Array.isArray(n.children) ? n.children : []).forEach(c => walk(c, depth + 1));
  })(root, 0);
  return lines.join('\n') + '\n';
}
module.exports.domText = domText;

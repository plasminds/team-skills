const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { RENDER, shareGate, writeGate, render, pageData } = require('./helpers');

// The shared page shows the reviewer's picks, never the agents' recommendation. These tests run the page's script on a fake DOM.

// A DOM just wide enough to run the main script: real nodes for what the page builds, a callable no-op for the rest.
function fakeDom(html) {
  const ids = new Map(), body = node('body');
  function node(tag) {
    const t = { tagName: String(tag).toUpperCase(), children: [], parentNode: null, listeners: {}, attrs: {}, style: loose({}), dataset: {}, textContent: '', value: '', className: '', hidden: false,
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      get childNodes() { return t.children; }, get firstChild() { return t.children[0] || null; }, get lastChild() { return t.children[t.children.length - 1] || null; },
      get nextSibling() { const s = t.parentNode && t.parentNode.children; return s ? s[s.indexOf(p) + 1] || null : null; },
      previousSibling: null,
      appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = p; t.children.push(c); return c; },
      insertBefore(c, ref) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = p; const i = t.children.indexOf(ref); t.children.splice(i < 0 ? t.children.length : i, 0, c); return c; },
      removeChild(c) { t.children = t.children.filter(x => x !== c); c.parentNode = null; return c; },
      addEventListener(type, f) { (t.listeners[type] = t.listeners[type] || []).push(f); },
      setAttribute(k, v) { t.attrs[k] = String(v); }, getAttribute: k => (k in t.attrs ? t.attrs[k] : null), removeAttribute(k) { delete t.attrs[k]; }, hasAttribute: k => k in t.attrs,
      querySelector: () => node('div'), querySelectorAll: () => [], closest: () => null, contains: () => false
    };
    const p = loose(t, (k, v) => { if (k === 'id') ids.set(v, p); });
    return p;
  }
  function loose(t, onSet) {
    return new Proxy(t, {
      get: (o, k) => (k in o ? o[k] : typeof k === 'symbol' ? undefined : any),
      set: (o, k, v) => { o[k] = v; if (onSet) onSet(k, v); return true; }
    });
  }
  const any = new Proxy(function () {}, { get: (o, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'length' ? 0 : any), apply: () => node('div') });
  // A template element: placed in a holder, so the script can insert beside it.
  const placed = () => node('div').appendChild(node('div'));
  const layout = placed();
  const store = new Map();
  const document = {
    body, documentElement: node('html'), activeElement: null, title: '', readyState: 'complete',
    getElementById: id => (id === 'gate-data' ? { textContent: html.match(/<script type="application\/json" id="gate-data">([\s\S]*?)<\/script>/)[1] } : ids.get(id) || (ids.set(id, placed()), ids.get(id))),
    querySelector: sel => (sel === '.layout' ? layout : placed()), querySelectorAll: () => [],
    createElement: node, createElementNS: (ns, tag) => node(tag), createTextNode: s => { const n = node('#text'); n.textContent = s; return n; }, createDocumentFragment: () => node('#fragment'),
    addEventListener() {}, removeEventListener() {}
  };
  const ctx = {
    document, console, Promise, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0,
    localStorage: { get length() { return store.size; }, key: i => [...store.keys()][i], getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    location: { hash: '', href: 'https://example.com/x', search: '' }, history: { replaceState() {} },
    navigator: { clipboard: { writeText: () => Promise.resolve() }, platform: '', userAgent: '' },
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }), getComputedStyle: () => ({ getPropertyValue: () => '' }),
    addEventListener() {}, removeEventListener() {}, scrollTo() {},
    IntersectionObserver: function () { return { observe() {}, disconnect() {} }; }, ResizeObserver: function () { return { observe() {}, disconnect() {} }; }, MutationObserver: function () { return { observe() {}, disconnect() {} }; },
  };
  ctx.window = ctx;
  return { ctx, ids, body, store };
}


const storeKey = data => 'team-view:' + (data.source || data.title) + ':' + (data._rev || '');
const settleDom = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
const scriptsOf = html => [...html.matchAll(/<script(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
// F1's option buttons: its options group is labelled with its id.
const f1Buttons = made => made.filter(n => n.className === 'options' && /\bF1\b/.test(n.attrs['aria-label'] || ''))[0].children;

function shareHtml(preset) {
  const file = writeGate(shareGate());
  const args = ['--share'];
  if (preset) {
    const p = file.replace(/\.gate\.json$/, '.share.txt');
    fs.writeFileSync(p, preset);
    args.push('--preset=' + p);
  }
  assert.strictEqual(render(file, ...args).code, 0);
  return { file, html: fs.readFileSync(file.replace(/\.gate\.json$/, '.share.html'), 'utf8') };
}

// Runs the page, collecting every element it creates.
async function run(html) {
  const dom = fakeDom(html), made = [], orig = dom.ctx.document.createElement;
  dom.ctx.document.createElement = tag => { const n = orig(tag); made.push(n); return n; };
  dom.ctx.location.hash = '#d-F1'; // a card, not the summary, so options are drawn
  vm.createContext(dom.ctx);
  scriptsOf(html).forEach(s => vm.runInContext(s, dom.ctx));
  await settleDom();
  return { dom, made };
}

test('a shared page without a pick shows no suggestion and no amber mark, though the agents recommended an option', async () => {
  const { html } = shareHtml();
  assert.ok(pageData(html).items.find(i => i.id === 'F1').options.some(o => o.recommended));
  const { made } = await run(html);
  assert.strictEqual(f1Buttons(made).filter(n => n.children.some(c => c.className === 'rectag sug')).length, 0);
  assert.strictEqual(f1Buttons(made).filter(n => n.children.some(c => /rectag/.test(c.className))).length, 0);
  assert.strictEqual(f1Buttons(made).filter(n => /\bis-rec\b/.test(n.className)).length, 0);
});

test('a shared page tags the reviewer\'s pick as Suggested, and only that option', async () => {
  const file = writeGate(shareGate());
  const f1 = JSON.parse(fs.readFileSync(file, 'utf8')).decisions.find(d => d.id === 'F1');
  const pick = f1.options.find(o => !o.recommended && !o.negative) || f1.options.find(o => !o.recommended);
  const { html } = shareHtml('GATE SHARE\nF1 = ' + pick.value + ' | note: Cheaper, same outcome\n');
  const { made } = await run(html);
  const tagged = f1Buttons(made).filter(n => n.children.some(c => c.className === 'rectag sug'));
  assert.deepStrictEqual(tagged.map(b => b.dataset.value), [pick.value]);
  assert.strictEqual(tagged[0].children.find(c => c.className === 'rectag sug').textContent, 'Suggested');
  assert.deepStrictEqual(f1Buttons(made).filter(n => /\bis-rec\b/.test(n.className)).map(b => b.dataset.value), [pick.value]);
});

test('clicking an option on a share card records the choice', async () => {
  const { html } = shareHtml();
  const { dom } = await run(html);
  const all = n => [n].concat(...(Array.isArray(n.children) ? n.children : []).map(all));
  const opt = all(dom.ctx.document.getElementById('app')).find(n => /\bopt\b/.test(n.className) && (n.listeners.click || []).length);
  assert.ok(opt, 'a card shows its options');
  assert.doesNotThrow(() => opt.listeners.click.forEach(f => f({})));
  const stored = JSON.parse(dom.store.get(storeKey(pageData(html))) || '{}');
  assert.ok(Object.values(stored).some(s => s && s.choice), JSON.stringify(stored));
});

test('a shared page\'s r key, help lines, evidence pane and accepts footer follow the reviewer\'s pick', () => {
  const html = fs.readFileSync(path.join(path.dirname(RENDER), 'template.html'), 'utf8');
  assert.match(html, /var rv = shareMode \? reviewerSuggests\(data, c\.it\) : /);
  assert.match(html, /\['<kbd>r<\/kbd>', shareMode \? L\('help\.sug'\) : L\('help\.rec'\)\]/);
  assert.match(html, /\['<kbd>a<\/kbd>', shareMode \? L\('help\.acceptSug'\) : L\('help\.acceptAll'\)\]/);
  assert.match(html, /return shareMode \? o\.value === sugFirst : o\.recommended;/);
  assert.match(html, /base = \(!shareMode && rec && rec\.accepts\) \|\| it\.accepts/);
  assert.match(html, /!shareMode && o && !o\.accepts && rec && rec\.accepts && o !== rec \? L\('ev\.recAccepts'\)/);
});

test('a shared page\'s Accept takes the reviewer\'s picks only', () => {
  const html = fs.readFileSync(path.join(path.dirname(RENDER), 'template.html'), 'utf8');
  const src = html.slice(html.indexOf('function acceptRecommended'), html.indexOf('function decisionsBlock'));
  const { acceptRecommended } = vm.runInNewContext('function mootBy() { return false; }\n' + src + '\n({ acceptRecommended: acceptRecommended })');
  const items = [{ id: 'A', options: [{ value: 'x', recommended: true }, { value: 'y' }] }, { id: 'B', options: [{ value: 'x', recommended: true }, { value: 'y' }] }];
  const state = {};
  assert.strictEqual(acceptRecommended(items, state, it => (it.id === 'A' ? 'y' : null)), 1);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(state)), { A: { choice: 'y' } });
});

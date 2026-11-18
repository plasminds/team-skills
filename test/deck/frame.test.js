'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const FRAME = path.join(__dirname, '..', '..', 'skills', 'team-deck', 'frame.html');
const html = () => fs.readFileSync(FRAME, 'utf8');
const style = () => /<style>([\s\S]*?)<\/style>/.exec(html())[1];
const script = () => /<script>([\s\S]*?)<\/script>/.exec(html())[1];

const COPY = { themeToDark: 'Dark theme', themeToLight: 'Light theme' };

test('markers deck.js fills are all in the frame', () => {
  const h = html();
  ['__LANG__', '__TITLE__', '/*BRAND*/', '<!--SLIDES-->', '__COPY__'].forEach(m => assert.ok(h.includes(m), m));
  assert.match(h, /<script type="application\/json" id="copy">__COPY__<\/script>/);
});

test('no network reference, no web font', () => {
  const h = html();
  assert.doesNotMatch(h, /https?:\/\//i);
  assert.doesNotMatch(h, /(?:src|href)\s*=\s*["']?(?:https?:)?\/\//i);
  assert.doesNotMatch(h, /@import|url\(\s*["']?(?:https?:)?\/\//i);
  assert.doesNotMatch(h, /@font-face|fonts\.googleapis/i);
});

// The body of the first rule whose selector list is exactly `sel`.
const rule = (css, sel) => {
  const m = new RegExp('(?:^|[}\\s])' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}').exec(css);
  assert.ok(m, 'rule ' + sel);
  return m[1];
};
const token = (body, name) => (new RegExp('--' + name + ':\\s*(#[0-9a-f]{3,6})', 'i').exec(body) || [])[1];

test('reading mode: every card has the same min height and padding, and grows instead of clipping', () => {
  const card = rule(style(), '.slide');
  assert.match(card, /--slide-height:\s*calc\(100cqi \* 9 \/ 16\)/);
  assert.match(card, /min-height:\s*var\(--slide-height\)/);
  assert.match(card, /overflow:\s*visible/);
  assert.doesNotMatch(card, /overflow:\s*auto/);
  assert.doesNotMatch(card, /aspect-ratio/);
  assert.match(card, /padding:\s*clamp\(24px, 3\.4vw, 40px\) clamp\(20px, 5vw, 60px\)/);
  const narrow = style().slice(style().indexOf('@media (max-width: 700px)'));
  assert.doesNotMatch(rule(narrow, '.slide'), /padding|aspect-ratio|height/);
});

test('reading mode: above a phone, the space above the first card and below the last centres a card', () => {
  const css = style();
  const deck = rule(css, '.deck');
  assert.match(deck, /--gutter:\s*max\(16px, env\(safe-area-inset-left, 0px\)\)/);
  assert.match(deck, /padding-inline:\s*var\(--gutter\)/);
  assert.match(deck, /padding-block:\s*32px 88px/);
  assert.match(deck, /gap:\s*32px/);
  const wide = /@media \(min-width: 701px\)\s*\{\s*\.deck\s*\{([^}]*)\}/.exec(css);
  assert.ok(wide, 'a min-width: 701px .deck rule');
  assert.match(wide[1], /--centre:\s*calc\(\(100vh - \(min\(1280px, 100%\) - 2 \* var\(--gutter\)\) \* 9 \/ 16\) \/ 2\)/);
  assert.match(wide[1], /padding-block:\s*max\(32px, var\(--centre\)\) max\(88px, var\(--centre\)\)/);
  assert.ok(css.indexOf('@media (min-width: 701px)') < css.indexOf('@media print'), 'print overrides it');
  assert.match(rule(css.slice(css.indexOf('@media print')), '.deck'), /padding:\s*0/);
});

test('Home, End and ArrowRight all centre their card', () => {
  const p = page(3);
  const blocks = [];
  p.cards.forEach(c => { c.scrollIntoView = o => { blocks.push(c.id + ':' + o.block); }; });
  p.press('Home'); p.press('ArrowRight'); p.press('End');
  assert.deepStrictEqual(blocks, ['s1:center', 's2:center', 's3:center']);
});

test('no present mode left: no html.present rule, no present bar, no key shortcut attribute, no aria-pressed', () => {
  const h = html();
  assert.doesNotMatch(h, /html\.present/);
  assert.doesNotMatch(h, /present-bar/);
  assert.doesNotMatch(h, /aria-keyshortcuts/);
  assert.doesNotMatch(h, /aria-pressed/);
});

test('themes: the team-view palette, light on :root, dark under both dark selectors', () => {
  const css = style();
  const light = rule(css, ':root');
  const dark = rule(css, ':root[data-theme="dark"]');
  const media = /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/.exec(css)[1];
  const want = {
    light: { bg: '#e2dccf', card: '#eee9df', raised: '#e5dfd3', ink: '#2a251f', muted: '#4a433b', line: '#d6cfc2', accent: '#6a6256' },
    dark: { bg: '#161514', card: '#201e1c', raised: '#2a2825', ink: '#eeeae4', muted: '#c6c0b7', line: '#2f2c29', accent: '#77716a' }
  };
  Object.entries(want.light).forEach(([k, v]) => assert.strictEqual(token(light, k), v, 'light --' + k));
  [dark, media].forEach(body => Object.entries(want.dark).forEach(([k, v]) => assert.strictEqual(token(body, k), v, 'dark --' + k)));
  assert.match(light, /color-scheme:\s*light/);
  assert.match(dark, /color-scheme:\s*dark/);
  assert.match(media, /color-scheme:\s*dark/);
  const print = css.slice(css.indexOf('@media print'));
  ['bg', 'card', 'ink'].forEach(k => assert.strictEqual(token(rule(print, ':root:root:root'), k), want.light[k], 'print --' + k));
});

test('print rules keep an overflowing card whole (Review Focus 5)', () => {
  const css = style();
  const print = css.slice(css.indexOf('@media print'));
  assert.ok(print.startsWith('@media print'));
  assert.match(print, /@page\s*\{[^}]*size:\s*13\.333in 7\.5in/);
  assert.match(print, /height:\s*auto/);
  assert.match(print, /overflow:\s*visible/);
  assert.match(print, /print-color-adjust:\s*exact/);
  assert.match(print, /min-height:\s*7\.5in/);
  assert.match(print, /width:\s*13\.333in/);
});

test('every localStorage call sits inside a try block', () => {
  const js = script();
  let from = 0, n = 0;
  for (let i = js.indexOf('localStorage'); i !== -1; i = js.indexOf('localStorage', from)) {
    from = i + 1; n++;
    const before = js.slice(0, i);
    const t = before.lastIndexOf('try {');
    assert.ok(t !== -1, 'a try before the call');
    assert.ok(!/\bcatch\b/.test(before.slice(t)), 'no catch between the try and the call');
  }
  assert.ok(n > 0);
});

// A minimal fake page: just what the frame's script touches.
function fakeEl(id) {
  const classes = new Set();
  const el = {
    id, textContent: '', hidden: true, attrs: {}, listeners: {}, scrollHeight: 100, clientHeight: 100, scrollTop: 0,
    rect: { top: 0, height: 100 }, scrolled: 0, focused: 0,
    classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c),
      toggle: c => (classes.has(c) ? classes.delete(c) : classes.add(c)) },
    setAttribute(k, v) { el.attrs[k] = String(v); }, getAttribute(k) { return k in el.attrs ? el.attrs[k] : null; },
    addEventListener(type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    getBoundingClientRect() { return el.rect; },
    scrollIntoView() { el.scrolled++; }, focus() { el.focused++; }
  };
  return el;
}

function page(count) {
  const root = fakeEl('root'); const els = {}; const cards = [];
  for (let i = 0; i < count; i++) { const c = fakeEl('s' + (i + 1)); c.rect = { top: i * 600, height: 400 }; cards.push(c); }
  const doc = fakeEl('doc'); doc.documentElement = root;
  doc.getElementById = id => (els[id] = els[id] || fakeEl(id));
  doc.querySelectorAll = sel => (sel === '.slide' ? cards : []);
  doc.getElementById('copy').textContent = JSON.stringify(COPY);
  const win = fakeEl('win'); win.innerHeight = 400; win.matchMedia = () => ({ matches: false });
  const ctx = vm.createContext({ document: doc, window: win, localStorage: { getItem: () => null, setItem() {} } });
  vm.runInContext(script(), ctx);
  const press = (key, target, mods) => {
    const e = Object.assign({ key, target: target || { tagName: 'BODY' }, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; } }, mods);
    doc.listeners.keydown.forEach(fn => fn(e));
    return e;
  };
  return { root, cards, doc, press, el: id => doc.getElementById(id) };
}

test('the script reads its chrome strings from #copy', () => {
  const p = page(2);
  assert.strictEqual(p.el('theme-btn').textContent, 'Dark theme');
  assert.strictEqual(p.el('toolbar').hidden, false);
  ['Dark theme', 'Light theme'].forEach(s => assert.ok(!script().includes(s), s));
});

test('ArrowRight scrolls the next card, End the last', () => {
  const p = page(3);
  const e = p.press('ArrowRight');
  assert.ok(e.defaultPrevented);
  assert.strictEqual(p.cards[1].scrolled, 1);
  assert.strictEqual(p.cards[1].focused, 1);
  p.press('End');
  assert.strictEqual(p.cards[2].scrolled, 1);
  p.press('Home');
  assert.strictEqual(p.cards[0].scrolled, 1);
});

test('F and Escape do nothing: no mode, no walk', () => {
  const p = page(3);
  ['f', 'F', 'Escape'].forEach(k => {
    const e = p.press(k);
    assert.ok(!e.defaultPrevented, k);
  });
  assert.ok(p.cards.every(c => c.scrolled === 0 && c.focused === 0));
  assert.strictEqual(p.root.classList.contains('present'), false);
});

test('a modifier leaves the key alone', () => {
  const p = page(2);
  const e = p.press('ArrowRight', null, { ctrlKey: true });
  assert.ok(!e.defaultPrevented);
  assert.strictEqual(p.cards[1].scrolled, 0);
});

test('space on a button is the control\'s, ArrowRight on it walks', () => {
  const p = page(2);
  const btn = { tagName: 'BUTTON' };
  const s = p.press(' ', btn);
  assert.ok(!s.defaultPrevented);
  assert.strictEqual(p.cards[1].scrolled, 0);
  p.press('ArrowRight', btn);
  assert.strictEqual(p.cards[1].scrolled, 1);
});

test('the hidden toolbar stays hidden despite its display rule', () => {
  assert.match(style(), /\.toolbar\[hidden\]\s*\{\s*display:\s*none;?\s*\}/);
});

#!/usr/bin/env node
'use strict';
// Usage: node deck.js <topic>.deck.json
// Assembles frame.html + the maker-written slides fragment + the brand into one self-contained HTML,
// <topic>.html beside the json, and prints its path. Exit 1 on invalid input (stderr names each slide and the fix), 2 on a wrong call.
// deck.json: { "title", "brand": { "name", "logo", "colors": "neutral" | { "primary", "secondary"?, "surface"? }, "lang" }, "slides": "<topic>.slides.html" }
const fs = require('fs');
const path = require('path');

const USAGE = 'usage: node deck.js <topic>.deck.json';

const COPY = {
  en: {
    themeToDark: 'Dark theme', themeToLight: 'Light theme',
    recap: 'Open questions', question: 'Question', answered: 'Answered: ', changed: 'What changed',
  },
  fr: {
    themeToDark: 'Thème sombre', themeToLight: 'Thème clair',
    recap: 'Questions ouvertes', question: 'Question', answered: 'Réponse : ', changed: 'Ce qui a changé',
  },
};
const SCRIPT_KEYS = ['themeToDark', 'themeToLight'];
const MIME = { png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml' };
const HEX = /^#[0-9a-f]{6}$/i;
const COLOR_KEYS = ['primary', 'secondary', 'surface'];

// ---------- brand colours per theme (WCAG 2 contrast against the theme's card) ----------
// Card and neutral accent of each theme, as in frame.html's tokens.
const THEMES = { light: { card: '#eee9df', neutral: '#6a6256' }, dark: { card: '#201e1c', neutral: '#77716a' } };
const MARK_MIN = 3;
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map(k => { const c = parseInt(hex.slice(k, k + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
// themeColors(colors, theme) → { accent, question }: the structure marks take the first of primary, secondary reaching 3:1
// on the theme's card, else the theme's neutral accent; the question border the first of secondary, primary, else the accent.
function themeColors(colors, theme) {
  const { card, neutral } = THEMES[theme];
  const set = [colors.primary, colors.secondary].filter(Boolean).map(c => c.toLowerCase());
  const reach = list => list.find(c => contrast(c, card) >= MARK_MIN);
  const accent = reach(set) || neutral;
  return { accent, question: reach(set.slice().reverse()) || accent };
}
const vars = c => '--accent: ' + c.accent + '; --question: ' + c.question + ';';
// brandCss(colors) → the override rules, written after the frame's theme blocks: light on :root, dark on both dark selectors.
function brandCss(colors) {
  if (colors === 'neutral') return '';
  const light = themeColors(colors, 'light'), dark = themeColors(colors, 'dark');
  return ':root { ' + vars(light) + ' }\n@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ' + vars(dark) + ' } }\n' +
    ':root[data-theme="dark"] { ' + vars(dark) + ' }';
}

// Text and attribute values both go through the same escape: &, <, > and the double quote.
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Maker HTML already carries its own entities: only the characters that would open a tag are neutralised.
const keepEntities = s => String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');

const TAG_ATTRS = '((?:[^>"\']|"[^"]*"|\'[^\']*\')*)';
const SECTION = new RegExp('<section\\b' + TAG_ATTRS + '>([\\s\\S]*?)</section>', 'gi');
const ASIDE = new RegExp('<aside\\b' + TAG_ATTRS + '>([\\s\\S]*?)</aside>', 'gi');
const H2 = new RegExp('<h2\\b' + TAG_ATTRS + '>([\\s\\S]*?)</h2>', 'i');
const SVG = new RegExp('<svg\\b' + TAG_ATTRS + '>', 'gi');
const EXTERNAL = /(?:\b(?:src|href|poster|action)\s*=\s*["']?\s*|@import\s+(?:url\(\s*)?["']?\s*|\burl\(\s*["']?\s*)(https?:\/\/[^\s"'<>)]+)/gi;

function parseAttrs(str) {
  const out = [];
  const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(str))) out.push([m[1], m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : '']);
  return out;
}
const attrOf = (attrs, name) => { const a = attrs.find(x => x[0].toLowerCase() === name); return a ? a[1] : null; };
const classesOf = attrs => (attrOf(attrs, 'class') || '').split(/\s+/).filter(Boolean);
// Every attribute is re-emitted double-quoted and escaped, whatever quoting the maker used.
const emit = (pairs) => pairs.map(([k, v]) => ' ' + k + '="' + esc(v) + '"').join('');
const without = (attrs, names) => attrs.filter(a => !names.includes(a[0].toLowerCase()));

function check(deck, slides, readFile) {
  const errors = [];
  const brand = deck && typeof deck.brand === 'object' && deck.brand ? deck.brand : {};
  const blank = v => typeof v !== 'string' || !v.trim();
  if (blank(brand.name)) errors.push('brand.name: must be a non-empty string; set it in the deck.json');
  if (blank(brand.lang)) errors.push('brand.lang: must be a non-empty string such as "en" or "fr"; set it in the deck.json');
  if (Object.prototype.hasOwnProperty.call(brand, 'accent')) errors.push('brand.accent: replaced by brand.colors; write "colors": "neutral" or { "primary": "#rrggbb", "secondary": "#rrggbb" } in the deck.json and remove "accent"');
  const colors = brand.colors;
  if (colors && typeof colors === 'object' && !Array.isArray(colors)) {
    Object.keys(colors).filter(k => !COLOR_KEYS.includes(k)).forEach(k => errors.push('brand.colors.' + k + ': unknown; use primary, secondary or surface in the deck.json'));
    COLOR_KEYS.filter(k => k === 'primary' || colors[k] !== undefined).filter(k => !HEX.test(String(colors[k])))
      .forEach(k => errors.push('brand.colors.' + k + ': must be "#rrggbb"' + (k === 'primary' ? '' : ' or left out') + '; fix it in the deck.json'));
  } else if (colors !== 'neutral') errors.push('brand.colors: must be "neutral" or { "primary": "#rrggbb", "secondary"?, "surface"? }; fix it in the deck.json');
  let logo = null;
  if (brand.logo !== null && brand.logo !== undefined) {
    const ext = typeof brand.logo === 'string' ? (brand.logo.match(/\.(png|jpg|svg)$/i) || [])[1] : null;
    let data = null;
    if (ext) { try { data = readFile(brand.logo); } catch (e) { data = null; } }
    if (!ext || !data) errors.push('brand.logo: ' + brand.logo + ' not found; use a .png, .jpg or .svg');
    else logo = 'data:' + MIME[ext.toLowerCase()] + ';base64,' + Buffer.from(data).toString('base64');
  }
  if (!slides.length) errors.push('no slide: add at least one <section class="slide">');
  slides.forEach((s, i) => {
    const n = i + 1;
    const h2s = s.inner.match(/<h2\b/gi) || [];
    if (h2s.length !== 1) errors.push('slide ' + n + ': needs exactly one <h2> claim');
    let m;
    SVG.lastIndex = 0;
    while ((m = SVG.exec(s.inner))) {
      const a = parseAttrs(m[1]);
      if (attrOf(a, 'role') !== 'img' || !(attrOf(a, 'aria-label') || '').trim()) { errors.push('slide ' + n + ': <svg> needs role="img" and aria-label'); break; }
    }
    const seen = new Set();
    EXTERNAL.lastIndex = 0;
    while ((m = EXTERNAL.exec(s.inner))) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      errors.push('slide ' + n + ': external URL ' + m[1] + ' (the deck stays offline); inline it or name it in text');
    }
  });
  return { errors, logo, brand };
}

function parseSlides(fragment) {
  const slides = [];
  let m;
  SECTION.lastIndex = 0;
  while ((m = SECTION.exec(fragment))) {
    const attrs = parseAttrs(m[1]);
    if (classesOf(attrs).includes('slide')) slides.push({ attrs, inner: m[2] });
  }
  return slides;
}

// frame, deckJson (parsed), fragment (text), readFile(path) -> Buffer | null. Returns { html, errors }; html is null on errors.
function build(deckJson, fragment, frame, readFile) {
  const slides = parseSlides(String(fragment));
  const { errors, logo, brand } = check(deckJson, slides, readFile);
  if (errors.length) return { html: null, errors };
  const t = COPY[/^fr/i.test(brand.lang) ? 'fr' : 'en'];

  const cover = classesOf(slides[0].attrs).includes('cover') ? [slides[0]] : [];
  const rest = cover.length ? slides.slice(1) : slides;
  const isChanged = s => classesOf(s.attrs).includes('changed');
  const ordered = [...cover, ...rest.filter(isChanged), ...rest.filter(s => !isChanged(s))];
  const hasQuestion = ordered.some(s => { let f = false; s.inner.replace(ASIDE, (all, a) => { if (classesOf(parseAttrs(a)).includes('question')) f = true; return all; }); return f; });
  const total = ordered.length + (hasQuestion ? 1 : 0);

  const questions = [];
  const head = (n, eyebrow) => '<div class="slide-head"><span class="eyebrow">' + eyebrow + '</span><span class="num">' + n + ' / ' + total + '</span></div>';
  const sections = ordered.map((s, i) => {
    const n = i + 1;
    const classes = classesOf(s.attrs);
    let h2Inner = '';
    let inner = s.inner.replace(ASIDE, (all, a, body) => {
      const attrs = parseAttrs(a);
      const qc = classesOf(attrs);
      if (!qc.includes('question')) return all;
      const answer = attrOf(attrs, 'data-answer');
      const answered = answer !== null && answer.trim() !== '';
      questions.push({ n, body, answer: answered ? answer : null });
      const cls = qc.concat(answered && !qc.includes('answered') ? ['answered'] : []).join(' ');
      const others = without(attrs, ['class', 'aria-label']);
      return '<aside' + emit([['class', cls], ['aria-label', t.question]].concat(others)) + '><span class="q-label">' + esc(t.question) + '</span>' + body +
        (answered ? '<p class="q-answer">' + esc(t.answered) + keepEntities(answer) + '</p>' : '') + '</aside>';
    });
    inner = inner.replace(H2, (all, a, body) => {
      h2Inner = body;
      return '<h2' + emit([['id', 's' + n + '-h']].concat(without(parseAttrs(a), ['id']))) + '>' + body + '</h2>';
    });
    questions.filter(q => q.n === n).forEach(q => { q.h2 = h2Inner; });
    let eyebrow = '';
    if (cover.length && i === 0) eyebrow = logo ? '<img src="' + logo + '" alt="' + esc(brand.name) + '">' : esc(brand.name);
    else if (classes.includes('changed')) eyebrow = esc(t.changed);
    const open = emit([['class', classes.join(' ')], ['id', 's' + n], ['tabindex', '-1'], ['aria-labelledby', 's' + n + '-h']]
      .concat(without(s.attrs, ['class', 'id', 'tabindex', 'aria-labelledby'])));
    return '<section' + open + '>\n' + head(n, eyebrow) + '\n' + inner.trim() + '\n</section>';
  });
  if (hasQuestion) {
    const n = total;
    const items = questions.map(q =>
      '<li><div>' + q.body + '</div><p><a href="#s' + q.n + '">' + q.h2.replace(/<\/?a\b[^>]*>/gi, '') + '</a></p>' +
      (q.answer !== null ? '<p class="q-answer">' + esc(t.answered) + keepEntities(q.answer) + '</p>' : '') + '</li>');
    sections.push('<section class="slide recap" id="s' + n + '" tabindex="-1" aria-labelledby="s' + n + '-h">\n' + head(n, '') +
      '\n<h2 id="s' + n + '-h">' + esc(t.recap) + '</h2>\n<ol>\n' + items.join('\n') + '\n</ol>\n</section>');
  }

  const copy = {};
  SCRIPT_KEYS.forEach(k => { copy[k] = t[k]; });
  const fill = {
    __LANG__: esc(brand.lang.trim()),
    __TITLE__: esc(typeof deckJson.title === 'string' && deckJson.title.trim() ? deckJson.title : brand.name),
    // Each theme gets the colours that stay visible on its card; the surface is not used by the deck.
    '/*BRAND*/': brandCss(brand.colors),
    '<!--SLIDES-->': sections.join('\n'),
    __COPY__: JSON.stringify(copy).replace(/</g, '\\u003c'),
  };
  const html = String(frame).replace(/__LANG__|__TITLE__|\/\*BRAND\*\/|<!--SLIDES-->|__COPY__/g, k => fill[k]);
  return { html, errors: [] };
}

module.exports = { build, USAGE };

function main() {
  const args = process.argv.slice(2);
  const files = args.filter(a => !a.startsWith('--'));
  if (args.length !== 1 || files.length !== 1) { console.error(USAGE); process.exit(2); }
  const src = path.resolve(files[0]);
  const dir = path.dirname(src);
  const fail = msg => { console.error('invalid deck:\n- ' + msg); process.exit(1); };
  let deck;
  try { deck = JSON.parse(fs.readFileSync(src, 'utf8')); } catch (e) { fail(path.basename(src) + ': ' + e.message + '; fix the JSON'); }
  if (!deck || typeof deck !== 'object' || typeof deck.slides !== 'string' || !deck.slides) fail('slides: name the slides file in the deck.json, "slides": "<topic>.slides.html"');
  const slidesPath = path.resolve(dir, deck.slides);
  let fragment;
  try { fragment = fs.readFileSync(slidesPath, 'utf8'); } catch (e) { fail('slides: ' + deck.slides + ' not found; write the slides file first'); }
  const frame = fs.readFileSync(path.join(__dirname, 'frame.html'), 'utf8');
  // A logo path is read from the project root (where the profile line gives it), else beside the deck json.
  const readFile = p => {
    for (const base of [process.cwd(), dir]) {
      const f = path.resolve(base, p);
      try { if (fs.statSync(f).isFile()) return fs.readFileSync(f); } catch (e) { continue; }
    }
    return null;
  };
  const { html, errors } = build(deck, fragment, frame, readFile);
  if (errors.length) { console.error('invalid deck:\n- ' + errors.join('\n- ')); process.exit(1); }
  const out = path.join(dir, path.basename(src).replace(/(\.deck)?\.json$/, '') + '.html');
  fs.writeFileSync(out, html);
  console.log(out);
}

if (require.main === module) main();

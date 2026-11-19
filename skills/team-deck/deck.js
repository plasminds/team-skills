#!/usr/bin/env node
'use strict';
// Usage: node deck.js <topic>.deck.json [--from=<dir>] [--no-check]
// Assembles frame.html + the maker-written slides fragment + the brand into one self-contained HTML, <topic>.html beside
// the json, prints its path, then opens it in the project's Playwright Chromium: every slide is measured at 16:9 and
// shot to <topic>.shots/NN.png. Exit 0: built and every slide fits. 1: invalid input, or a slide that does not fit
// (stderr names each slide and the fix; the HTML and the shots are still written, to look at). 2: a wrong call.
// 3: built but not checked (no Playwright found, or the browser did not start); --no-check skips the check.
// deck.json: { "title", "brand": { "name", "logo", "colors": "neutral" | { "primary", "secondary"?, "surface"? }, "lang" }, "slides": "<topic>.slides.html" }
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const USAGE = 'usage: node deck.js <topic>.deck.json [--from=<dir>] [--no-check]';

const COPY = {
  en: {
    themeToDark: 'Dark theme', themeToLight: 'Light theme',
    recap: 'Open questions', question: 'Question', answered: 'Answered: ', changed: 'What changed', slide: 'Slide',
  },
  fr: {
    themeToDark: 'Thème sombre', themeToLight: 'Thème clair',
    recap: 'Questions ouvertes', question: 'Question', answered: 'Réponse : ', changed: 'Ce qui a changé', slide: 'Slide',
  },
};
const SCRIPT_KEYS = ['themeToDark', 'themeToLight'];
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp', gif: 'image/gif' };
const LOGO_EXT = /\.(png|jpg|svg)$/i;
const IMG_EXT = /\.(png|jpe?g|svg|webp|gif)$/i;
const HEX = /^#[0-9a-f]{6}$/i;
const COLOR_KEYS = ['primary', 'secondary', 'surface'];
// The recap holds this many questions per slide, so it fits like any other slide.
const RECAP_PER = 4;

// ---------- brand colours (WCAG 2 contrast), the same rules as team-video's slides ----------
const rgb = hex => [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16));
const hexOf = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
// mix(a, b, t): t of colour b into colour a.
const mix = (a, b, t) => { const y = rgb(b); return hexOf(rgb(a).map((v, k) => v * (1 - t) + y[k] * t)); };
function luminance(hex) {
  const [r, g, b] = rgb(hex).map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const TEXT_MIN = 4.5, MARK_MIN = 3;
const ON_DARK = '#fafafa', ON_LIGHT = '#111111';
// onColors(fill) → { on, onMuted }: text on the bar and the cover, near-white on a dark fill, near-black on a light one;
// the muted one mixes in as much of the fill as keeps 4.5:1.
function onColors(fill) {
  let on = contrast(ON_DARK, fill) >= contrast(ON_LIGHT, fill) ? ON_DARK : ON_LIGHT;
  if (contrast(on, fill) < TEXT_MIN) on = contrast('#ffffff', fill) >= contrast('#000000', fill) ? '#ffffff' : '#000000';
  const onMuted = [0.3, 0.25, 0.2, 0.15, 0.1, 0.05].map(t => mix(on, fill, t)).find(m => contrast(m, fill) >= TEXT_MIN) || on;
  return { on, onMuted };
}
// brandTokens(colors) → { light, dark } token maps, or null for "neutral" (the frame's own set).
// The bar and the cover take the primary; the stripe under the bar the secondary where it keeps 3:1 on the primary;
// the slide the surface (default: 8% of the primary into white); titles the primary where it keeps 4.5:1 on the slide;
// marks (question border, bullets) the first of secondary, primary keeping 3:1 on the slide.
function brandTokens(colors) {
  if (colors === 'neutral') return null;
  const p = colors.primary.toLowerCase();
  const s = (colors.secondary || colors.primary).toLowerCase();
  const surface = (colors.surface || mix('#ffffff', p, 0.08)).toLowerCase();
  const { on, onMuted } = onColors(p);
  const stripe = contrast(s, p) >= MARK_MIN ? s : 'transparent';
  const mark = (page, fallback) => [s, p].find(c => contrast(c, page) >= MARK_MIN) || fallback;
  const lightInk = '#1c1c1a';
  const lightMuted = contrast('#55534e', surface) >= TEXT_MIN ? '#55534e' : lightInk;
  const light = {
    bg: mix(surface, p, 0.1), page: surface, raised: mix(surface, p, 0.07), ink: lightInk, muted: lightMuted, line: mix(surface, p, 0.18),
    bar: p, on, 'on-muted': onMuted, stripe, title: contrast(p, surface) >= TEXT_MIN ? p : lightInk, detail: mark(surface, lightMuted),
  };
  const darkPage = mix('#141414', p, 0.16);
  const dark = {
    bg: mix('#0c0c0c', p, 0.1), page: darkPage, raised: mix(darkPage, '#ffffff', 0.07), ink: '#eeeae4', muted: '#c6c0b7',
    line: mix(darkPage, '#ffffff', 0.13), bar: p, on, 'on-muted': onMuted, stripe, title: '#eeeae4', detail: mark(darkPage, '#c6c0b7'),
  };
  return { light, dark };
}
const decl = t => Object.entries(t).map(([k, v]) => '--' + k + ': ' + v + ';').join(' ');
// brandCss(colors) → the override rules, written after the frame's theme blocks: light on :root and in print, dark on both dark selectors.
function brandCss(colors) {
  const t = brandTokens(colors);
  if (!t) return '';
  return ':root { ' + decl(t.light) + ' }\n@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ' + decl(t.dark) + ' } }\n' +
    ':root[data-theme="dark"] { ' + decl(t.dark) + ' }\n@media print { :root:root:root { ' + decl(t.light) + ' } }';
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
const IMG = new RegExp('<img\\b' + TAG_ATTRS + '>', 'gi');
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
// imageSize(ext, data) → [width, height] read from a PNG header, a JPEG frame marker or an SVG's viewBox/width/height; null when unread.
function imageSize(ext, data) {
  const b = Buffer.from(data);
  const e = ext.toLowerCase();
  if (e === 'png' && b.length >= 24 && b.toString('latin1', 12, 16) === 'IHDR') return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (e === 'jpg' || e === 'jpeg') {
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + b.readUInt16BE(i + 2);
    }
    return null;
  }
  if (e === 'svg') {
    const t = b.toString('utf8');
    const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(t);
    if (vb) return [+vb[1], +vb[2]];
    const w = /<svg\b[^>]*\bwidth\s*=\s*["']([\d.]+)/i.exec(t), h = /<svg\b[^>]*\bheight\s*=\s*["']([\d.]+)/i.exec(t);
    return w && h ? [+w[1], +h[1]] : null;
  }
  return null;
}
const dataUri = (ext, data) => 'data:' + MIME[ext.toLowerCase()] + ';base64,' + Buffer.from(data).toString('base64');
const localSrc = src => src && !/^(?:data:|https?:|\/\/|#)/i.test(src.trim());

function check(deck, slides, readFile) {
  const errors = [];
  const images = new Map();
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
    const ext = typeof brand.logo === 'string' ? (brand.logo.match(LOGO_EXT) || [])[1] : null;
    let data = null;
    if (ext) { try { data = readFile(brand.logo); } catch (e) { data = null; } }
    if (!ext || !data) errors.push('brand.logo: ' + brand.logo + ' not found; use a .png, .jpg or .svg');
    else logo = { uri: dataUri(ext, data), size: imageSize(ext, data) };
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
    IMG.lastIndex = 0;
    while ((m = IMG.exec(s.inner))) {
      const src = attrOf(parseAttrs(m[1]), 'src');
      if (!localSrc(src) || images.has(src)) continue;
      const ext = (src.match(IMG_EXT) || [])[1];
      let data = null;
      if (ext) { try { data = readFile(src); } catch (e) { data = null; } }
      if (!ext || !data) errors.push('slide ' + n + ': image ' + src + ' not found; give a .png, .jpg, .svg or .webp path from the project root or beside the deck json');
      else images.set(src, dataUri(ext, data));
    }
    const seen = new Set();
    EXTERNAL.lastIndex = 0;
    while ((m = EXTERNAL.exec(s.inner))) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      errors.push('slide ' + n + ': external URL ' + m[1] + ' (the deck stays offline); inline it or name it in text');
    }
  });
  return { errors, logo, brand, images };
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

const hasQuestion = s => { let f = false; s.inner.replace(ASIDE, (all, a) => { if (classesOf(parseAttrs(a)).includes('question')) f = true; return all; }); return f; };
const countQuestions = slides => slides.reduce((k, s) => k + (s.inner.match(ASIDE) || []).filter(a => classesOf(parseAttrs(a.match(/^<aside\b([^>]*)>/i)[1])).includes('question')).length, 0);

// frame, deckJson (parsed), fragment (text), readFile(path) -> Buffer | null. Returns { html, errors }; html is null on errors.
function build(deckJson, fragment, frame, readFile) {
  const slides = parseSlides(String(fragment));
  const { errors, logo, brand, images } = check(deckJson, slides, readFile);
  if (errors.length) return { html: null, errors };
  const t = COPY[/^fr/i.test(brand.lang) ? 'fr' : 'en'];

  const cover = classesOf(slides[0].attrs).includes('cover') ? [slides[0]] : [];
  const rest = cover.length ? slides.slice(1) : slides;
  const isChanged = s => classesOf(s.attrs).includes('changed');
  const ordered = [...cover, ...rest.filter(isChanged), ...rest.filter(s => !isChanged(s))];
  const recapPages = ordered.some(hasQuestion) ? Math.ceil(countQuestions(ordered) / RECAP_PER) : 0;
  const total = ordered.length + recapPages;

  // A logo whose size reads is written once, as --logo, and each bar shows it as a background (one copy for the whole
  // deck); one whose size does not read is an <img> in each bar.
  const sized = logo && logo.size && logo.size[0] > 0 && logo.size[1] > 0;
  const lead = !logo ? '<span class="name">' + esc(brand.name) + '</span>'
    : sized ? '<span class="logo" role="img" aria-label="' + esc(brand.name) + '"></span>'
      : '<img class="logo" src="' + logo.uri + '" alt="' + esc(brand.name) + '">';
  const logoCss = sized ? '\n:root { --logo: url("' + logo.uri + '"); }\nspan.logo { aspect-ratio: ' + logo.size[0] + ' / ' + logo.size[1] + '; }' : '';
  const bar = (n, eyebrow) => '<header class="bar">' + lead + '<span class="eyebrow">' + eyebrow + '</span><span class="num">' + n + ' / ' + total + '</span></header>';
  const questions = [];
  const sections = ordered.map((s, i) => {
    const n = i + 1;
    const classes = classesOf(s.attrs);
    let h2Inner = '';
    let inner = s.inner.replace(IMG, (all, a) => {
      const attrs = parseAttrs(a);
      const src = attrOf(attrs, 'src');
      if (!images.has(src)) return all;
      return '<img' + emit(attrs.map(([k, v]) => [k, k.toLowerCase() === 'src' ? images.get(src) : v])) + '>';
    });
    inner = inner.replace(ASIDE, (all, a, body) => {
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
    const own = attrOf(s.attrs, 'data-eyebrow');
    let eyebrow = own && own.trim() ? esc(own) : '';
    if (classes.includes('changed')) eyebrow = esc(t.changed);
    const open = emit([['class', classes.join(' ')], ['id', 's' + n], ['tabindex', '-1'], ['aria-labelledby', 's' + n + '-h']]
      .concat(without(s.attrs, ['class', 'id', 'tabindex', 'aria-labelledby', 'data-eyebrow'])));
    return '<section' + open + '>\n' + bar(n, eyebrow) + '\n<div class="body">\n' + inner.trim() + '\n</div>\n</section>';
  });
  for (let p = 0; p < recapPages; p++) {
    const n = ordered.length + p + 1;
    const title = esc(t.recap) + (recapPages > 1 ? ' (' + (p + 1) + '/' + recapPages + ')' : '');
    const items = questions.slice(p * RECAP_PER, (p + 1) * RECAP_PER).map(q =>
      '<li><div>' + q.body + '</div><p class="from"><a href="#s' + q.n + '">' + esc(t.slide) + ' ' + q.n + ' · ' + q.h2.replace(/<\/?a\b[^>]*>/gi, '') + '</a></p>' +
      (q.answer !== null ? '<p class="q-answer">' + esc(t.answered) + keepEntities(q.answer) + '</p>' : '') + '</li>');
    sections.push('<section class="slide recap" id="s' + n + '" tabindex="-1" aria-labelledby="s' + n + '-h">\n' + bar(n, '') +
      '\n<div class="body">\n<h2 id="s' + n + '-h">' + title + '</h2>\n<ol start="' + (p * RECAP_PER + 1) + '">\n' + items.join('\n') + '\n</ol>\n</div>\n</section>');
  }

  const copy = {};
  SCRIPT_KEYS.forEach(k => { copy[k] = t[k]; });
  const fill = {
    __LANG__: esc(brand.lang.trim()),
    __TITLE__: esc(typeof deckJson.title === 'string' && deckJson.title.trim() ? deckJson.title : brand.name),
    '/*BRAND*/': brandCss(brand.colors) + logoCss,
    '<!--SLIDES-->': sections.join('\n'),
    __COPY__: JSON.stringify(copy).replace(/</g, '\\u003c'),
  };
  const html = String(frame).replace(/__LANG__|__TITLE__|\/\*BRAND\*\/|<!--SLIDES-->|__COPY__/g, k => fill[k]);
  return { html, errors: [] };
}

// ---------- the fit check, in the project's own Playwright ----------
// The thresholds, on a slide 1920 px wide: an image shown under 35% of its own size, or diagram text whose line box is
// under 28 px high (a font of about 22 px, half the body text), is unreadable on a projector.
const IMG_MIN = 0.35, SVG_TEXT_MIN = 28;

// Runs in the page: per slide, how far its content passes the slide, the scale of each image and the smallest diagram text.
const MEASURE = async () => {
  if (document.fonts) await document.fonts.ready;
  return Array.prototype.map.call(document.querySelectorAll('.slide'), (s, i) => {
    const b = s.querySelector('.body');
    const k = 1920 / s.getBoundingClientRect().width;
    const imgs = Array.prototype.filter.call(s.querySelectorAll('.body img'), im => im.naturalWidth > 0).map(im => {
      const r = im.getBoundingClientRect();
      return { name: im.getAttribute('alt') || 'an image', scale: Math.min(r.width / im.naturalWidth, r.height / im.naturalHeight) * k };
    });
    const texts = Array.prototype.map.call(s.querySelectorAll('.body svg text'), el => el.getBoundingClientRect().height * k).filter(h => h > 0);
    return {
      n: i + 1, height: b ? b.clientHeight : 0,
      over: b ? Math.max(0, b.scrollHeight - b.clientHeight) : 0, overW: b ? Math.max(0, b.scrollWidth - b.clientWidth) : 0,
      imgs, svgText: texts.length ? Math.min.apply(null, texts) : null,
    };
  });
};

// fitErrors(report) → one line per slide that does not fit or is unreadable, each naming the fix.
function fitErrors(report) {
  const out = [];
  report.forEach(r => {
    if (r.over > 1) out.push('slide ' + r.n + ': its content is ' + Math.round(100 * r.over / Math.max(1, r.height)) + '% taller than the slide; split it in two, cut text, or put the diagram beside the text (class="cols")');
    if (r.overW > 1) out.push('slide ' + r.n + ': its content is wider than the slide; let the diagram scale (class="visual") or cut it');
    r.imgs.filter(im => im.scale < IMG_MIN).forEach(im => out.push('slide ' + r.n + ': ' + im.name + ' shows at ' + Math.round(100 * im.scale) + '% of its size, too small to read; redraw it landscape as an inline <svg>, or give it a slide of its own'));
    if (r.svgText !== null && r.svgText < SVG_TEXT_MIN) out.push('slide ' + r.n + ': the diagram\'s text is ' + Math.round(r.svgText) + ' px high on a 1920 px slide, too small to read; fewer boxes, a larger font-size, or a slide of its own');
  });
  return out;
}

// checkFit(playwright, htmlPath, shotsDir) → the MEASURE report; writes shotsDir/NN.png per slide (the folder is emptied first).
async function checkFit(playwright, htmlPath, shotsDir) {
  fs.rmSync(shotsDir, { recursive: true, force: true });
  fs.mkdirSync(shotsDir, { recursive: true });
  const browser = await playwright.chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, colorScheme: 'light' });
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
    const report = await page.evaluate(MEASURE);
    const els = await page.$$('.slide');
    for (let i = 0; i < els.length; i++) await els[i].screenshot({ path: path.join(shotsDir, String(i + 1).padStart(2, '0') + '.png') });
    return report;
  } finally {
    await browser.close();
  }
}

// resolvePlaywright(dir) → the path of the project's `playwright` module, searched from `dir` upward: `playwright`
// itself, else the one beside the real path of `@playwright/test` (a pnpm layout). Null when neither is found.
function resolvePlaywright(dir) {
  const tryResolve = (request, from) => { try { return require.resolve(request, { paths: [from] }); } catch (e) { if (e.code === 'MODULE_NOT_FOUND') return null; throw e; } };
  const from = path.resolve(dir);
  const direct = tryResolve('playwright', from);
  if (direct) return direct;
  const testPkg = tryResolve('@playwright/test/package.json', from);
  return testPkg ? tryResolve('playwright', path.dirname(fs.realpathSync(testPkg))) : null;
}

module.exports = { build, brandTokens, contrast, fitErrors, checkFit, MEASURE, USAGE };

async function main() {
  const args = process.argv.slice(2);
  const files = args.filter(a => !a.startsWith('--'));
  const flags = args.filter(a => a.startsWith('--'));
  const fromFlag = flags.find(a => a.startsWith('--from='));
  const noCheck = flags.includes('--no-check');
  if (files.length !== 1 || flags.some(f => f !== '--no-check' && !f.startsWith('--from=')) || (fromFlag && noCheck)) { console.error(USAGE); process.exit(2); }
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
  // A logo or image path is read from the project root (where the profile line gives it: the working directory, or the
  // folder holding .council/ when the json sits in .council/decks/), else beside the deck json.
  const root = path.basename(path.dirname(dir)) === '.council' ? path.dirname(path.dirname(dir)) : null;
  const readFile = p => {
    for (const base of [process.cwd(), root, dir].filter(Boolean)) {
      const f = path.resolve(base, p);
      try { if (fs.statSync(f).isFile()) return fs.readFileSync(f); } catch (e) { continue; }
    }
    return null;
  };
  const { html, errors } = build(deck, fragment, frame, readFile);
  if (errors.length) { console.error('invalid deck:\n- ' + errors.join('\n- ')); process.exit(1); }
  const topic = path.basename(src).replace(/(\.deck)?\.json$/, '');
  const out = path.join(dir, topic + '.html');
  fs.writeFileSync(out, html);
  console.log(out);
  if (noCheck) { console.log('fit not checked (--no-check): look at every slide at 16:9 before delivering'); return; }

  const from = path.resolve(fromFlag ? fromFlag.slice('--from='.length) : process.cwd());
  const pw = resolvePlaywright(from);
  if (!pw) { console.error('fit not checked: no Playwright found from ' + from + '; pass --from=<folder holding node_modules>'); process.exit(3); }
  const shots = path.join(dir, topic + '.shots');
  let report;
  try { report = await checkFit(require(pw), out, shots); } catch (e) {
    console.error('fit not checked: the browser did not run (' + String(e.message).split('\n')[0] + ')');
    process.exit(3);
  }
  console.log('shots: ' + shots);
  const bad = fitErrors(report);
  if (bad.length) { console.error('slides that do not fit:\n- ' + bad.join('\n- ')); process.exit(1); }
  console.log('every slide fits at 16:9 (' + report.length + ' slides)');
}

if (require.main === module) main().catch(e => { console.error(e && e.stack || e); process.exit(1); });

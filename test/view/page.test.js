const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { RENDER, shareGate, writeGate, render, pageData } = require('./helpers');

const TEMPLATE = path.join(path.dirname(RENDER), 'template.html');

test('the template has a hidden Share button and no blocking confirm on reset', () => {
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  assert.match(html, /<button class="btn wide" id="share" type="button" hidden>Share<\/button>/);
  assert.doesNotMatch(html, /confirm\('Clear all decisions/);
  assert.match(html, /share\.hidden = data\.kind !== 'review';/);
  assert.doesNotMatch(html, /share\.hidden = false;/);
  assert.match(html, /data\.mode === 'share'/);
  assert.match(html, /Share this page/);
  assert.match(html, /shareBlock\(output\(\), /);
  assert.match(html, /shareChoices\(data\.channels\)/);
  assert.doesNotMatch(html, /post\(output\(\)\.replace\(\/\^GATE DECISIONS\/, 'GATE SHARE'\)/);
  assert.match(html, /JSON\.parse\(JSON\.stringify\(data\.preset \|\| \{\}\)\)/);
  assert.match(html, /Pre-filled by the reviewer: /);
  assert.match(html, /state = JSON\.parse\(JSON\.stringify\(data\.preset \|\| \{\}\)\);\s*items\.forEach\(function \(it\) \{ cards\[it\.id\]\.note\.value = \(state\[it\.id\] && state\[it\.id\]\.note\) \|\| ''; \}\);/);
  assert.match(html, /var p = data\.preset\[id\]; if \(!p \|\| typeof p !== 'object'\) return;/);
  assert.match(html, /p\.choice !== defaultOf\(id\)/);
  assert.doesNotMatch(html, /Confirm reset/);
  assert.match(html, /recAll'\)\.disabled = /);
  assert.match(html, /'Every card already has a choice'/);
  { const t = loadChrome().CHROME_TEXT;
    assert.strictEqual(t.en['toast.accepted'].one, '{n} card set to the recommended option.');
    assert.strictEqual(t.en['toast.accepted'].other, '{n} cards set to the recommended option.');
    assert.ok(t.fr['toast.accepted']);
    assert.ok(html.includes("Lp('toast.accepted', n)")); }
  assert.match(html, /'No undecided card has a recommended option\.'/);
  assert.match(html, /\.btn:disabled \{/);
  assert.doesNotMatch(html, /Claude Code/);
});

function post(url, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' } }, res => {
      let text = ''; res.on('data', c => { text += c; }); res.on('end', () => resolve({ status: res.statusCode, text }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

function serveGate(t) {
  const file = writeGate(shareGate());
  const child = spawn(process.execPath, [RENDER, file, '--serve', '--no-open'], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  let out = '';
  child.stdout.on('data', c => { out += c; });
  const url = new Promise((resolve, reject) => {
    child.stdout.on('data', () => { const m = out.match(/serving (http:\/\/\S+)/); if (m) resolve(m[1]); });
    child.on('close', code => reject(new Error('server exited early: ' + code)));
  });
  const closed = new Promise(resolve => child.on('close', resolve));
  return { file, url, closed, out: () => out };
}

test('the server saves a GATE SHARE block next to the gate, prints it and exits', async t => {
  const s = serveGate(t);
  const body = 'GATE SHARE — Gate\nS1 = approve | note: ask Ana';
  const res = await post((await s.url) + 'decisions', body);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(await s.closed, 0);
  const shareFile = s.file.replace(/\.gate\.json$/, '.share.txt');
  assert.strictEqual(fs.readFileSync(shareFile, 'utf8'), body + '\n');
  assert.ok(s.out().includes('share requested, choices saved to ' + shareFile + '\n\n' + body));
  assert.strictEqual(fs.existsSync(s.file.replace(/\.gate\.json$/, '.decisions.txt')), false);
});

test('the server still rejects a body that is neither block', async t => {
  const s = serveGate(t);
  const res = await post((await s.url) + 'decisions', 'hello');
  assert.strictEqual(res.status, 400);
});

test('--channels reaches the served page without changing its _rev', async t => {
  const channels = { review: { label: 'MR !12 (GitLab)' } };
  const file = writeGate(shareGate());
  const plain = pageData(fs.readFileSync(render(file).stdout.trim().split('\n')[0], 'utf8'));
  const child = spawn(process.execPath, [RENDER, file, '--serve', '--no-open', '--channels=' + JSON.stringify(channels)], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  let out = '';
  const url = await new Promise((resolve, reject) => {
    child.stdout.on('data', c => { out += c; const m = out.match(/serving (http:\/\/\S+)/); if (m) resolve(m[1]); });
    child.on('close', code => reject(new Error('server exited early: ' + code)));
  });
  const body = await new Promise((resolve, reject) => {
    http.get(url, res => { let b = ''; res.on('data', c => { b += c; }); res.on('end', () => resolve(b)); }).on('error', reject);
  });
  const served = pageData(body);
  assert.deepStrictEqual(served.channels, channels);
  assert.strictEqual(served._rev, plain._rev);
  assert.strictEqual(plain.channels, undefined);
});

test('the template links after both ways and flags a chosen item whose after ids are not chosen', () => {
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  assert.match(html, /missingAfter\(it, items, state\)/);
  assert.ok(html.includes(' come after this'));
  assert.ok(html.includes('after '));
  { const t = loadChrome().CHROME_TEXT;
    assert.ok(t.en['rel.gap'].one.includes("you'll be asked before") && t.en['rel.gap'].other.includes("you'll be asked before"));
    assert.ok(t.fr['rel.gap']);
    assert.ok(html.includes("Lp('rel.gap', miss.length")); }
  assert.ok(html.includes('.chip.gap {'));
});

test('the Share dialog forces the review route when the reader gets a review', () => {
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  assert.match(html, /sel\.as === 'review'/);
  assert.match(html, /sel\.via = 'review'/);
});

test('the template makes unfilled figure marks take the text colour', () => {
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  assert.match(html, /\.figure svg \{[^}]*fill: currentColor;/);
});

test('the template defines every colour figures.md gives figure authors', () => {
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  const figures = fs.readFileSync(path.join(path.dirname(TEMPLATE), 'figures.md'), 'utf8');
  const names = [...new Set([...figures.matchAll(/var\((--[a-z0-9-]+)\)/g)].map(m => m[1]))];
  const rule = /\.figure svg \{([^}]*)\}/.exec(html)[1];
  const tokens = fs.readFileSync(path.join(path.dirname(TEMPLATE), 'tokens.css'), 'utf8');
  const root = /:root[^{]*\{([^}]*)\}/.exec(tokens)[1];
  names.forEach(n => assert.ok(rule.includes(n + ':') || root.includes(n + ':'), n + ' is not defined'));
});

test('the template takes its tokens from tokens.css', () => {
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  assert.strictEqual(html.split('/*TOKENS*/').length - 1, 1);
  assert.ok(!html.includes(':root {'));
});

test('the rendered gate carries tokens.css verbatim', () => {
  const tokens = fs.readFileSync(path.join(path.dirname(TEMPLATE), 'tokens.css'), 'utf8').replace(/\n$/, '');
  const file = writeGate(shareGate());
  assert.strictEqual(render(file).code, 0);
  const html = fs.readFileSync(file.replace(/(\.(ceo|gate))?\.json$/, '') + '.html', 'utf8');
  assert.ok(html.includes(tokens));
  assert.ok(!html.includes('/*TOKENS*/'));
});

test('text links are web links only, and plain text keeps them as words', () => {
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  assert.ok(html.includes(String.raw`/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/`));
  assert.match(html, /if \(plain\) return document\.createTextNode\(label\);/);
  assert.match(html, /a\.rel = 'noopener noreferrer'/);
});

test('the server still accepts a CEO DECISIONS block', async t => {
  const s = serveGate(t);
  const res = await post((await s.url) + 'decisions', 'CEO DECISIONS — Gate\nS1 = approve');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(await s.closed, 0);
});

// Light theme: tokens.css carries a light block selected by data-view-theme on <html> and <body>; a startup script picks it.
const vm = require('node:vm');
const TOKENS = path.join(path.dirname(TEMPLATE), 'tokens.css');
const tokenNames = block => [...block.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1]);
function tokenBlocks() {
  const css = fs.readFileSync(TOKENS, 'utf8');
  const root = /:root\s*\{([^}]*)\}/.exec(css)[1];
  const light = /:is\(html, body\)\[data-view-theme="light"\]\s*\{([^}]*)\}/.exec(css);
  return { css, root, light: light && light[1] };
}
const themeRegion = html => /\/\*THEME-START\*\/([\s\S]*?)\/\*THEME-END\*\//.exec(html)[1];
const themeScript = html => /<script>\s*(\/\*THEME-START\*\/[\s\S]*?)<\/script>/.exec(html)[1];

function elementStub(attrs) {
  return { a: Object.assign({}, attrs), setAttribute(k, v) { this.a[k] = String(v); }, getAttribute(k) { return k in this.a ? this.a[k] : null; } };
}
function runTheme(src, { saved, stamp, systemLight, throwStorage } = {}) {
  const store = new Map(saved == null ? [] : [['team-view:theme', saved]]);
  const html = elementStub(stamp ? { 'data-theme': stamp } : {}), body = elementStub();
  const handlers = {}, mq = [], observers = [];
  const deny = () => { throw new Error('denied'); };
  const env = {
    store, html, body, handlers, mq, observers, light: !!systemLight,
    ctx: {
      localStorage: throwStorage ? { getItem: deny, setItem: deny, removeItem: deny }
        : { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
      document: { documentElement: html, body },
      matchMedia: () => ({ get matches() { return env.light; }, addEventListener: (t, f) => mq.push(f) }),
      MutationObserver: function (f) { observers.push(f); this.observe = () => {}; },
      addEventListener: (t, f) => { handlers[t] = f; }
    }
  };
  vm.runInNewContext(src, env.ctx);
  return env;
}
const both = env => [env.html.a['data-view-theme'], env.body.a['data-view-theme']];

test('tokens.css has a light block covering every dark token', () => {
  const { root, light } = tokenBlocks();
  assert.ok(light, 'no :is(html, body)[data-view-theme="light"] block');
  assert.match(light, /color-scheme: light;/);
  const set = tokenNames(light);
  tokenNames(root).filter(n => !['--sans', '--mono', '--r'].includes(n)).forEach(n => assert.ok(set.includes(n), n + ' has no light value'));
});

test('the light block sets no token that :root does not', () => {
  const { root, light } = tokenBlocks();
  const dark = tokenNames(root);
  tokenNames(light).forEach(n => assert.ok(dark.includes(n), n + ' is light only'));
  ['--sel', '--scroll', '--primary', '--primary-hover', '--flash', '--del-ink', '--add-ink', '--pane-lift', '--scrim'].forEach(n => assert.ok(dark.includes(n), n));
});

test('the template CSS holds no colour literal but the scrim fallback', () => {
  const css = /<style>([\s\S]*?)<\/style>/.exec(fs.readFileSync(TEMPLATE, 'utf8'))[1];
  const hits = css.split('\n').filter(l => /#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(l));
  assert.strictEqual(hits.length, 1, hits.join('\n'));
  assert.match(hits[0], /dialog::backdrop \{ background: var\(--scrim, rgba\(10, 9, 8, \.72\)\); \}/);
});

test('pickTheme: saved over the viewer stamp over the system over dark', () => {
  const { pickTheme } = vm.runInNewContext(themeRegion(fs.readFileSync(TEMPLATE, 'utf8')) + '\n({ pickTheme: pickTheme })');
  assert.strictEqual(pickTheme('light', 'dark', false), 'light');
  assert.strictEqual(pickTheme('dark', 'light', true), 'dark');
  assert.strictEqual(pickTheme(null, 'light', false), 'light');
  assert.strictEqual(pickTheme(null, 'dark', true), 'dark');
  assert.strictEqual(pickTheme(null, null, true), 'light');
  assert.strictEqual(pickTheme(null, null, false), 'dark');
  assert.strictEqual(pickTheme('blue', 'auto', true), 'light');
});

test('the startup script sets both attributes and survives a throwing localStorage', () => {
  const src = themeScript(fs.readFileSync(TEMPLATE, 'utf8'));
  assert.deepStrictEqual(both(runTheme(src, { saved: 'light' })), ['light', 'light']);
  assert.deepStrictEqual(both(runTheme(src, { stamp: 'light', systemLight: false })), ['light', 'light']);
  assert.deepStrictEqual(both(runTheme(src, {})), ['dark', 'dark']);
  assert.deepStrictEqual(both(runTheme(src, { throwStorage: true, systemLight: true })), ['light', 'light']);
  const env = runTheme(src, { throwStorage: true });
  assert.doesNotThrow(() => env.ctx.viewTheme.toggle());
  assert.deepStrictEqual(both(env), ['light', 'light']);
});

test('nextTheme flips and clears storage when landing on the system theme', () => {
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  const { nextTheme } = vm.runInNewContext(themeRegion(html) + '\n({ nextTheme: nextTheme })');
  assert.deepStrictEqual({ ...nextTheme('dark', 'dark') }, { theme: 'light', store: 'light' });
  assert.deepStrictEqual({ ...nextTheme('dark', 'light') }, { theme: 'light', store: null });
  assert.deepStrictEqual({ ...nextTheme('light', 'light') }, { theme: 'dark', store: 'dark' });
  assert.deepStrictEqual({ ...nextTheme('light', 'dark') }, { theme: 'dark', store: null });
  const env = runTheme(themeScript(html), { systemLight: false });
  env.ctx.viewTheme.toggle();
  assert.strictEqual(env.store.get('team-view:theme'), 'light');
  env.ctx.viewTheme.toggle();
  assert.strictEqual(env.store.has('team-view:theme'), false);
  assert.deepStrictEqual(both(env), ['dark', 'dark']);
});

test('with no saved theme the page follows the system and the viewer live', () => {
  const env = runTheme(themeScript(fs.readFileSync(TEMPLATE, 'utf8')), { systemLight: false });
  assert.strictEqual(env.mq.length, 1);
  assert.strictEqual(env.observers.length, 1);
  env.light = true; env.mq[0]();
  assert.deepStrictEqual(both(env), ['light', 'light']);
  env.html.a['data-theme'] = 'dark'; env.observers[0]();
  assert.deepStrictEqual(both(env), ['dark', 'dark']);
  env.ctx.viewTheme.toggle();
  assert.strictEqual(env.store.get('team-view:theme'), 'light');
  env.light = false; env.mq[0](); env.html.a['data-theme'] = 'dark'; env.observers[0]();
  assert.deepStrictEqual(both(env), ['light', 'light']);
});

test('the rendered page holds the light rule and html, body keep the ground', () => {
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  assert.match(html, /\nhtml, body \{[^}]*background: var\(--ground\);/);
  const file = writeGate(shareGate());
  assert.strictEqual(render(file).code, 0);
  const out = fs.readFileSync(file.replace(/(\.(ceo|gate))?\.json$/, '') + '.html', 'utf8');
  assert.ok(out.includes(':is(html, body)[data-view-theme="light"] {'));
});

test('print is always light, and afterprint restores the theme', () => {
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  assert.match(html, /addEventListener\('beforeprint'/);
  assert.match(html, /addEventListener\('afterprint'/);
  const env = runTheme(themeScript(html), {});
  env.handlers.beforeprint();
  assert.deepStrictEqual(both(env), ['light', 'light']);
  env.handlers.afterprint();
  assert.deepStrictEqual(both(env), ['dark', 'dark']);
});

test('the theme toggle leads the actions and d toggles it', () => {
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  assert.match(html, /<body>\n<script>\n\/\*THEME-START\*\//);
  assert.match(html, /<div class="actions">\s*<button class="btn ghost" id="theme" type="button"[^>]*>[\s\S]*?<\/button>\s*<button class="btn ghost" id="reset"/);
  assert.match(html, /else if \(k === 'd'\) viewTheme\.toggle\(\);/);
  { const t = loadChrome().CHROME_TEXT;
    assert.strictEqual(t.en['help.theme'], 'Light / dark theme');
    assert.ok(t.fr['help.theme']);
    assert.match(html, /\['<kbd>d<\/kbd>', L\('help\.theme'\)\]/); }
  assert.ok(html.includes("'Switch to light theme'") && html.includes("'Switch to dark theme'"));
  assert.ok(html.includes("'Light theme ( d )'") && html.includes("'Dark theme ( d )'"));
  assert.doesNotMatch(html, /id="theme"[^>]*aria-pressed/);
});

// fr/en chrome: one label table, CHROME_TEXT, in its own region; makeL(lang) gives L(key, vars) and Lp(key, n, vars).
const chromeRegion = html => /\/\*CHROME-START\*\/([\s\S]*?)\/\*CHROME-END\*\//.exec(html)[1];
const loadChrome = () => vm.runInNewContext(chromeRegion(fs.readFileSync(TEMPLATE, 'utf8')) + '\n({ CHROME_TEXT: CHROME_TEXT, makeL: makeL })');
// Strings the same in both languages on purpose.
const SAME_IN_BOTH = ['title.suffix', 'opt.ok', 'section.tensions', 'lens.count', 'card.vote', 'card.note', 'card.kindTension', 'ev.option', 'row.titleChosen', 'share.withLabel', 'legend.note', 'tag.tests', 'tag.types', 'tag.performance', 'tag.conventions'];
// Computed lookups go through fixed lists: the gate kinds the top bar names.
const kinds = ['debate', 'plan', 'refactor', 'review', 'kickoff', 'decision'];
// The template's REVIEW_TAGS list and the chrome key each tag looks up (error-handling → tag.errorHandling).
const reviewTags = html => JSON.parse(/var REVIEW_TAGS = (\[[^\]]*\]);/.exec(html)[1].replace(/'/g, '"'));
const tagKey = t => 'tag.' + t.replace(/-([a-z])/g, (m, c) => c.toUpperCase());

test('CHROME_TEXT: every key in both languages, and French differs but for a short list', () => {
  const { CHROME_TEXT } = loadChrome();
  const en = Object.keys(CHROME_TEXT.en).sort(), fr = Object.keys(CHROME_TEXT.fr).sort();
  assert.ok(en.length > 0);
  assert.deepStrictEqual(en.filter(k => !fr.includes(k)), [], 'keys missing in fr');
  assert.deepStrictEqual(fr.filter(k => !en.includes(k)), [], 'keys missing in en');
  en.forEach(k => assert.match(k, /^[a-z]+\.[A-Za-z]+$/, k));
  const same = en.filter(k => JSON.stringify(CHROME_TEXT.en[k]) === JSON.stringify(CHROME_TEXT.fr[k]));
  assert.deepStrictEqual(same, SAME_IN_BOTH.filter(k => en.includes(k)).sort());
  en.filter(k => typeof CHROME_TEXT.en[k] === 'object').forEach(k => {
    ['en', 'fr'].forEach(l => assert.deepStrictEqual(Object.keys(CHROME_TEXT[l][k]).sort(), ['one', 'other'], l + ' ' + k));
  });
  kinds.forEach(k => assert.ok(CHROME_TEXT.en['kind.' + k] && CHROME_TEXT.fr['kind.' + k], k));
});

test('L falls back to English, then to the key, and fills placeholders; Lp picks the plural form', () => {
  const { CHROME_TEXT, makeL } = loadChrome();
  const en = makeL('en'), fr = makeL('fr');
  assert.strictEqual(en.L('missing.key'), 'missing.key');
  assert.strictEqual(fr.L('missing.key'), 'missing.key');
  assert.strictEqual(en.L('bar.reset'), 'Reset');
  assert.strictEqual(fr.L('bar.reset'), 'Réinitialiser');
  assert.strictEqual(makeL('de').L('bar.reset'), 'Reset');
  assert.strictEqual(en.L('server.opened', { path: 'a.js' }), 'Opened a.js in your editor.');
  assert.strictEqual(en.L('kind.other', { kind: 'Audit' }), 'Audit gate');
  assert.strictEqual(en.L('server.opened'), 'Opened {path} in your editor.');
  delete CHROME_TEXT.fr['bar.reset'];
  assert.strictEqual(fr.L('bar.reset'), 'Reset');
  assert.strictEqual(en.Lp('send.confirm', 1), '1 item undecided. Send anyway? Claude will ask about it.');
  assert.strictEqual(en.Lp('send.confirm', 2), '2 items undecided. Send anyway? Claude will ask about them.');
  assert.strictEqual(en.Lp('send.confirm', 0), '0 items undecided. Send anyway? Claude will ask about them.');
  const one = CHROME_TEXT.fr['send.confirm'].one, other = CHROME_TEXT.fr['send.confirm'].other;
  assert.strictEqual(fr.Lp('send.confirm', 0), one.replace('{n}', '0'));
  assert.strictEqual(fr.Lp('send.confirm', 1), one.replace('{n}', '1'));
  assert.strictEqual(fr.Lp('send.confirm', 2), other.replace('{n}', '2'));
});

test('L and Lp are never shadowed, and no L() result is joined with +', () => {
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  const rest = html.replace(chromeRegion(html), '');
  const decls = [...rest.matchAll(/(?:\bvar\b|\blet\b|\bconst\b|,)\s*(Lp?)\s*=(?!=)/g)].map(m => m[0].trim());
  assert.deepStrictEqual(decls, [', L =', ', Lp =']);
  assert.match(rest, /var _l = makeL\(LANG\), L = _l\.L, Lp = _l\.Lp;/);
  const params = [...rest.matchAll(/function\s*[\w$]*\s*\(([^)]*)\)/g)].filter(m => m[1].split(',').some(p => /^\s*Lp?\s*$/.test(p)));
  assert.deepStrictEqual(params.map(m => m[0]), []);
  assert.doesNotMatch(rest, /function\s+Lp?\s*\(/);
  assert.doesNotMatch(html, /\bLp?\([^)]*\)\s*\+/);
  assert.match(rest, new RegExp("var GATE_KINDS = \\[" + kinds.map(k => "'" + k + "'").join(', ') + "\\];"));
});

test('a lang "fr" gate gets French chrome, <html lang> and its title at render time', () => {
  const file = writeGate(shareGate({ lang: 'fr', title: 'Facture' }));
  const r = render(file);
  assert.strictEqual(r.code, 0, r.stderr);
  const html = fs.readFileSync(file.replace(/\.gate\.json$/, '.html'), 'utf8');
  assert.strictEqual(pageData(html).lang, 'fr');
  assert.match(html, /<html lang="fr">/);
  assert.match(html, /<title>Facture · Gate<\/title>/);
  assert.ok(html.includes('Réinitialiser'));
  const enFile = writeGate(shareGate({ lang: undefined, title: 'Invoice' }));
  assert.strictEqual(render(enFile).code, 0);
  const en = fs.readFileSync(enFile.replace(/\.gate\.json$/, '.html'), 'utf8');
  assert.match(en, /<html lang="en">/);
  assert.match(en, /<title>Invoice · Gate<\/title>/);
});

// Step 8: cards, options, lenses. The sampled en values are the text the page had before they moved into the table
// (copied from the template at 2f6b739), so the wording does not drift.
const PINNED_EN = {
  'card.yourChoice': 'Your choice',
  'card.hintMany': 'Press 1–{max} or click',
  'arg.noneFor': 'Nobody argued for it.',
  'ev.tradeoffs': 'Trade-offs',
  'ev.howDone': 'How it gets done',
  'card.stake': 'What’s at stake',
  'lens.noEvidence': 'No {lens} evidence on this card.',
  'file.openEditor': 'Open in your editor',
  'card.notePlaceholder': 'Optional: a note, or an edit to this choice',
  'sum.target': 'Target'
};
const PINNED = Object.keys(PINNED_EN);

test('step 8 keys: the en values keep the wording the page had', () => {
  const { CHROME_TEXT } = loadChrome();
  PINNED.forEach(k => {
    assert.strictEqual(CHROME_TEXT.en[k], PINNED_EN[k], k);
  });
  assert.strictEqual(CHROME_TEXT.en['card.yourChoice'], 'Your choice');
  assert.strictEqual(CHROME_TEXT.en['card.hintMany'], 'Press 1–{max} or click');
  assert.strictEqual(CHROME_TEXT.en['card.stake'], 'What’s at stake');
});

test('step 8 keys: French has its own words for the sampled keys and uses vous', () => {
  const { CHROME_TEXT, makeL } = loadChrome();
  const fr = makeL('fr');
  PINNED.forEach(k => {
    assert.notStrictEqual(fr.L(k), k, k);
    assert.notStrictEqual(CHROME_TEXT.fr[k], CHROME_TEXT.en[k], k);
  });
  assert.strictEqual(fr.L('card.yourChoice'), 'Votre choix');
  assert.strictEqual(fr.L('sum.target'), 'Cible');
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  const table = chromeRegion(html);
  assert.doesNotMatch(table.slice(table.indexOf('  fr: {')), /\b(ton|ta|tes|tu|toi)\b/);
});

test('step 8 plurals: counted strings read in both languages', () => {
  const { makeL } = loadChrome();
  const en = makeL('en'), fr = makeL('fr');
  assert.strictEqual(en.Lp('rel.baseFor', 1), 'Base for 1 card');
  assert.strictEqual(en.Lp('rel.baseFor', 3), 'Base for 3 cards');
  assert.strictEqual(fr.Lp('rel.baseFor', 0), 'Base de 0 carte');
  assert.strictEqual(fr.Lp('rel.baseFor', 1), 'Base de 1 carte');
  assert.strictEqual(fr.Lp('rel.baseFor', 2), 'Base de 2 cartes');
  assert.strictEqual(en.Lp('lens.hidden', 1, { lens: 'Biz' }), '1 Biz argument hidden by the lens.');
  assert.strictEqual(en.Lp('lens.hidden', 2, { lens: 'Biz' }), '2 Biz arguments hidden by the lens.');
  assert.strictEqual(fr.Lp('lens.hidden', 0, { lens: 'Métier' }), '0 argument Métier masqué par la lentille.');
  assert.strictEqual(fr.Lp('lens.hidden', 2, { lens: 'Métier' }), '2 arguments Métier masqués par la lentille.');
  assert.strictEqual(en.Lp('ev.replace', 1), 'Replace 1 line with');
  assert.strictEqual(en.Lp('ev.replaceFrom', 4, { line: 9 }), 'Replace 4 lines from line 9 with');
  assert.strictEqual(fr.Lp('ev.replace', 1), 'Remplacer 1 ligne par');
  assert.strictEqual(fr.Lp('ev.replaceFrom', 4, { line: 9 }), 'Remplacer 4 lignes à partir de la ligne 9 par');
  assert.strictEqual(en.Lp('lens.onlyTitle', 1, { lens: 'Tech', key: 't' }), 'Tech only: 1 item on this card  ( t )');
  assert.strictEqual(en.Lp('lens.onlyTitle', 0, { lens: 'Tech', key: 't' }), 'Tech only: 0 items on this card  ( t )');
  assert.strictEqual(en.Lp('choose.set', 1, { id: 'D1', label: 'Yes' }), 'D1: Yes. 1 card still to decide.');
  assert.strictEqual(en.Lp('choose.set', 2, { id: 'D1', label: 'Yes' }), 'D1: Yes. 2 cards still to decide.');
  assert.strictEqual(en.L('choose.setDone', { id: 'D1', label: 'Yes' }), 'D1: Yes. Every card decided.');
  assert.strictEqual(fr.Lp('choose.cleared', 1, { id: 'D1' }), 'D1 effacé. 1 carte reste à décider.');
  assert.strictEqual(fr.Lp('choose.cleared', 3, { id: 'D1' }), 'D1 effacé. 3 cartes restent à décider.');
  assert.strictEqual(en.Lp('card.breaks', 1, { ids: 'K1' }), 'Breaks K1: choosing it lifts it');
  assert.strictEqual(en.Lp('card.breaks', 2, { ids: 'K1, K2' }), 'Breaks K1, K2: choosing it lifts them');
  assert.strictEqual(en.L('meta.presetOneMany', { c: 1, n: 2 }), 'Pre-filled by the reviewer: 1 choice, 2 notes. Change any.');
  assert.strictEqual(en.L('meta.presetManyOne', { c: 0, n: 1 }), 'Pre-filled by the reviewer: 0 choices, 1 note. Change any.');
});

test('step 8: sentences built from pieces are whole keys, and no plural() caller is left', () => {
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  const rest = html.replace(chromeRegion(html), '');
  ["'Base for '", "' still to decide.'", "' hidden by the lens.'", "'Pre-filled by the reviewer: '", "'Found by '", "'Asked by '", "' of ' + k.all", "'Replace '"]
    .forEach(f => assert.ok(!rest.includes(f), f));
  assert.deepStrictEqual([...rest.matchAll(/\bplural\(/g)].length, 0, 'step 9 deleted the definition');
});

// Step 9: list, filters, help, completeness. The template's own keys against the table, in both directions.
const templateRest = () => { const html = fs.readFileSync(TEMPLATE, 'utf8'); return html.replace(chromeRegion(html), ''); };

test('completeness (a): every L() and Lp() key the template uses exists in en and fr', () => {
  const { CHROME_TEXT } = loadChrome();
  const rest = templateRest();
  const used = [...rest.matchAll(/\bLp?\(\s*'([a-z]+\.[A-Za-z]+)'/g)].map(m => m[1]);
  assert.ok(used.length > 150, 'keys used: ' + used.length);
  used.forEach(k => {
    assert.ok(Object.prototype.hasOwnProperty.call(CHROME_TEXT.en, k), 'en lacks ' + k);
    assert.ok(Object.prototype.hasOwnProperty.call(CHROME_TEXT.fr, k), 'fr lacks ' + k);
  });
  // The computed lookups go through fixed lists: the gate kinds, and team-review's tags (REVIEW_TAGS).
  const computed = [...rest.matchAll(/\bLp?\((?!\s*')[^)]*\)/g)].map(m => m[0]);
  assert.ok(computed.every(c => /^L\('(kind|tag)\./.test(c)), computed.join(' | '));
});

test('completeness (b): no key of the table is unused', () => {
  const { CHROME_TEXT } = loadChrome();
  const used = new Set([...templateRest().matchAll(/\bLp?\(\s*'([a-z]+\.[A-Za-z]+)'/g)].map(m => m[1]));
  kinds.forEach(k => used.add('kind.' + k));
  reviewTags(fs.readFileSync(TEMPLATE, 'utf8')).forEach(t => used.add(tagKey(t)));
  assert.deepStrictEqual(Object.keys(CHROME_TEXT.en).filter(k => !used.has(k)), []);
});

test('completeness (c): a lang "fr" gate is <html lang="fr"> at render time and by the script\'s own logic', () => {
  const file = writeGate(shareGate({ lang: 'fr', title: 'Facture' }));
  assert.strictEqual(render(file).code, 0);
  const html = fs.readFileSync(file.replace(/\.gate\.json$/, '.html'), 'utf8');
  assert.match(html, /<html lang="fr">/);
  const rest = templateRest();
  assert.ok(rest.includes('document.documentElement.lang = LANG;'));
  const decl = /var LANG = [^;]+;/.exec(rest)[0];
  const { makeL } = loadChrome();
  [['fr', 'fr', 'Réinitialiser'], ['en', 'en', 'Reset'], [undefined, 'en', 'Reset'], ['de', 'en', 'Reset']].forEach(([lang, want, reset]) => {
    const ctx = vm.runInNewContext(decl + '\n({ LANG: LANG })', { data: { lang } });
    assert.strictEqual(ctx.LANG, want);
    assert.strictEqual(makeL(ctx.LANG).L('bar.reset'), reset);
  });
});

test('completeness (d): the decisions block of a fr gate is the text of an en gate\'s', () => {
  const block = lang => {
    const file = writeGate(shareGate({ lang, title: 'Gate' }));
    assert.strictEqual(render(file).code, 0);
    const html = fs.readFileSync(file.replace(/\.gate\.json$/, '.html'), 'utf8');
    const src = html.match(/\/\*PROMPT-START\*\/([\s\S]*?)\/\*PROMPT-END\*\//)[1];
    const data = pageData(html);
    const fns = vm.runInNewContext(src + '\n({ decisionsBlock: decisionsBlock })');
    const state = { F1: { choice: 'round', note: 'check' }, T1: { choice: 'Minimalist' }, 'RS-1': { choice: 'revive' } };
    return fns.decisionsBlock(data, data.items, state);
  };
  const fr = block('fr'), en = block('en');
  assert.match(en, /^GATE DECISIONS/);
  assert.strictEqual(fr, en);
});

test('step 9: no plural() is left, and the list, filters, help and share picker read their text from the table', () => {
  const rest = templateRest();
  assert.doesNotMatch(rest, /\bplural\(/);
  ["'Hide the list'", "'Has a note'", "'Clear filters'", "'All tags'", "'Any status'", "'Keyboard keys'", "'Move around'", "'Widen the list", "' shown'",
    "'Defaults applied", "'No item matches", "'Not needed'", "'To decide'", "'Decisions reset.'", "'All decided'", "'Answer it first'"]
    .forEach(f => assert.ok(!rest.includes(f), f));
  const { CHROME_TEXT } = loadChrome();
  ['side.hide', 'row.note', 'filter.clear', 'filter.allTags', 'filter.anyStatus', 'help.title', 'help.move', 'side.widenTitle', 'share.whatFile'].forEach(k => {
    assert.ok(CHROME_TEXT.en[k] && CHROME_TEXT.fr[k], k);
    assert.ok(rest.includes("'" + k + "'"), k);
  });
  assert.strictEqual(CHROME_TEXT.en['side.hide'], 'Hide the list');
  assert.strictEqual(CHROME_TEXT.en['filter.clear'], 'Clear filters');
  assert.strictEqual(CHROME_TEXT.fr['filter.clear'], 'Effacer les filtres');
  assert.strictEqual(CHROME_TEXT.en['toast.reset'], 'Decisions reset.');
});

test('every built-in option label lib/gate.js writes is shown in the page language', () => {
  const gateSrc = fs.readFileSync(path.join(path.dirname(RENDER), 'lib', 'gate.js'), 'utf8');
  const built = [...gateSrc.matchAll(/value: '([a-z-]+)', label: '([^']+)'/g)].map(m => m[1] + '=' + m[2]).sort();
  const rest = templateRest();
  const mapped = [...rest.matchAll(/'?([a-z-]+)'?: \['([^']+)', L\('opt\.[A-Za-z]+'\)\]/g)].map(m => m[1] + '=' + m[2]).sort();
  assert.ok(built.length >= 9, built.join(' '));
  assert.deepStrictEqual(mapped, built);
  // A tension's sides: gate.js writes "Side with <who>"; the page keeps <who> and words the label from the table.
  assert.match(gateSrc, /label: 'Side with ' \+/);
  assert.match(rest, /L\('opt\.sideWith', \{ who: /);
  assert.doesNotMatch(rest, /o\.label\.replace\(\/\^Side with/);
  const { CHROME_TEXT } = loadChrome();
  assert.strictEqual(CHROME_TEXT.en['opt.sideWith'], 'Side with {who}');
  assert.strictEqual(CHROME_TEXT.en['opt.askAuthor'], 'Ask the author');
});

test('the theme toggle is an icon only, at every width: its name is in aria-label and title', () => {
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  const btn = /<button[^>]*id="theme"[^>]*>([\s\S]*?)<\/button>/.exec(html);
  assert.ok(btn, 'no #theme button');
  assert.match(btn[0], /aria-label="Switch to light theme"/);
  assert.strictEqual(btn[1].replace(/<kbd>D<\/kbd>/, '').trim(), '');
  assert.doesNotMatch(html, /tword/);
});

test('review tags show in the page language: each lens and severity of team-review has an en and fr name', () => {
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  const chrome = require('node:vm').runInNewContext(/\/\*CHROME-START\*\/([\s\S]*?)\/\*CHROME-END\*\//.exec(html)[1] + '\n({ CHROME_TEXT: CHROME_TEXT, makeL: makeL })');
  const md = fs.readFileSync(path.join(path.dirname(RENDER), '..', 'team-review', 'templates.md'), 'utf8');
  const list = name => new RegExp('^- ' + name + ': <([^>]+)>', 'm').exec(md)[1].split('|').map(s => s.trim());
  const values = list('Lens').concat(list('Severity'));
  assert.ok(values.length >= 11, 'read the lens and severity lists');
  assert.deepStrictEqual(reviewTags(html), values, 'REVIEW_TAGS follows team-review/templates.md');
  ['en', 'fr'].forEach(lang => values.forEach(v => {
    const s = chrome.CHROME_TEXT[lang][tagKey(v)];
    assert.ok(typeof s === 'string' && s.length, lang + ' ' + tagKey(v));
  }));
  assert.strictEqual(chrome.makeL('fr').L(tagKey('error-handling')), 'Gestion des erreurs');
  // The card's tag chips and the tag filter's options both go through tagName; the filter keeps the raw value.
  assert.match(html, /function tagName\(t\)/);
  assert.match(html, /el\('span', 'tag' \+ cls, [^\n]*tagName\(t\)/);
  assert.match(html, /el\('option', null, tagName\(t\)\); o\.value = t;/);
  // The card list's severity word too.
  assert.match(html, /el\('span', 'sevw ' \+ sev, tagName\(sev\)\)/);
});

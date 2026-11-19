'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { tmpDir } = require('../view/helpers');

const DECK_DIR = path.join(__dirname, '..', '..', 'skills', 'team-deck');
const DECK_JS = path.join(DECK_DIR, 'deck.js');
const FRAME = fs.readFileSync(path.join(DECK_DIR, 'frame.html'), 'utf8');
const { build, brandTokens, contrast, fitErrors, checkFit, recapSizes } = require(DECK_JS);

const brand = (over = {}) => ({ name: 'Acme Invoicing', logo: null, colors: 'neutral', lang: 'en', ...over });
const deckOf = (over = {}) => ({ title: 'Invoice decision', brand: brand(), slides: 'x.slides.html', ...over });
const noFile = () => null;
const built = (fragment, over, readFile) => build(deckOf(over), fragment, FRAME, readFile || noFile);

const PLAIN = [
  '<section class="slide cover"><h2>Invoices are numbered per customer</h2></section>',
  '<section class="slide"><h2>Late invoices get a reminder after 14 days</h2></section>',
  '<section class="slide"><h2>Orders close at month end</h2></section>',
].join('\n');

const section = (html, n) => (html.match(new RegExp('<section[^>]*id="s' + n + '"[^>]*>[\\s\\S]*?</section>')) || [''])[0];
const copyOf = html => JSON.parse(html.match(/<script type="application\/json" id="copy">([\s\S]*?)<\/script>/)[1]);
const count = (text, needle) => text.split(needle).length - 1;
const NETWORK = /(?:\b(?:src|href)\s*=\s*["']?\s*https?:\/\/|@import\s+(?:url\(\s*)?["']?\s*https?:|url\(\s*["']?\s*https?:\/\/)/i;

test('numbers the slides 1 / 3 to 3 / 3 and labels each by its h2', () => {
  const { html, errors } = built(PLAIN);
  assert.deepStrictEqual(errors, []);
  ['1 / 3', '2 / 3', '3 / 3'].forEach((n, i) => {
    assert.match(section(html, i + 1), new RegExp('<span class="num">' + n + '</span>'));
  });
  assert.ok(!html.includes('4 / 3') && !html.includes('/ 4'));
  [1, 2, 3].forEach(n => {
    assert.match(html, new RegExp('<section[^>]*id="s' + n + '"[^>]*tabindex="-1"[^>]*aria-labelledby="s' + n + '-h"'));
    assert.match(section(html, n), new RegExp('<h2 id="s' + n + '-h"'));
  });
  assert.match(html, /<section class="slide cover" id="s1"/);
});

test('lang drives the html lang and the chrome copy, French or English', () => {
  const q = PLAIN.replace('</section>', '<aside class="question">Weekends?</aside></section>');
  const fr = built(q, { brand: brand({ lang: 'fr-FR' }) }).html;
  assert.match(fr, /<html lang="fr-FR">/);
  const cf = copyOf(fr);
  assert.strictEqual(cf.themeToDark, 'Thème sombre');
  assert.strictEqual(cf.themeToLight, 'Thème clair');
  assert.match(fr, /Questions ouvertes/);
  assert.match(fr, /<span class="q-label">Question<\/span>/);
  const en = built(q, { brand: brand({ lang: 'en' }) }).html;
  assert.match(en, /<html lang="en">/);
  const ce = copyOf(en);
  assert.strictEqual(ce.themeToDark, 'Dark theme');
  assert.strictEqual(ce.themeToLight, 'Light theme');
  assert.match(en, /Open questions/);
  assert.ok(!/Questions ouvertes/.test(en));
  assert.ok(!/__[A-Z]+__|<!--SLIDES-->|\/\*BRAND\*\//.test(en), 'every marker filled');
  assert.strictEqual(copyOf(built(PLAIN, { brand: brand({ lang: 'de' }) }).html).themeToDark, 'Dark theme');
});

test('E8: the changed slide moves after the cover, the answer shows on its slide and in the recap', () => {
  const fragment = [
    '<section class="slide cover"><h2>Invoice reminders</h2></section>',
    '<section class="slide"><h2>Late invoices get a reminder</h2><aside class="question" data-answer="Yes, weekdays only">Should reminders go out on weekends?</aside></section>',
    '<section class="slide changed"><h2>The meeting moved reminders to weekdays</h2></section>',
  ].join('\n');
  const { html, errors } = built(fragment);
  assert.deepStrictEqual(errors, []);
  assert.match(section(html, 2), /class="slide changed"/);
  assert.match(section(html, 2), /What changed/);
  const own = section(html, 3);
  assert.match(own, /<aside class="question answered"/);
  assert.match(own, /<p class="q-answer">Answered: Yes, weekdays only<\/p>/);
  const recap = section(html, 4);
  assert.match(recap, /class="slide recap"/);
  assert.match(recap, /Open questions/);
  assert.match(recap, /Should reminders go out on weekends\?/);
  assert.match(recap, /href="#s3"/);
  assert.match(recap, /Answered: Yes, weekdays only/);
  assert.match(recap, /4 \/ 4/);
});

test('changed is first when there is no cover', () => {
  const fragment = '<section class="slide"><h2>Reminders</h2></section>\n<section class="slide changed"><h2>Weekdays only now</h2></section>';
  assert.match(section(built(fragment).html, 1), /class="slide changed"/);
});

test('no question, no recap', () => {
  const { html } = built(PLAIN);
  assert.ok(!html.includes('class="slide recap"'));
  assert.ok(!html.includes('Open questions'));
});

test('an unanswered question keeps no answer line and the recap links its slide', () => {
  const { html } = built(PLAIN.replace('Orders close at month end</h2>', 'Orders close at month end</h2><aside class="question">Close on the 30th?</aside>'));
  assert.match(section(html, 3), /<aside class="question" aria-label="Question"><span class="q-label">Question<\/span>Close on the 30th\?<\/aside>/);
  assert.ok(!html.includes('class="q-answer"'));
  assert.match(section(html, 4), /href="#s3"/);
});

test('Review Focus 4: entities, inline tags and double quotes in an h2 never reach an attribute', () => {
  const fragment = [
    '<section class="slide cover"><h2>Q&amp;A on <em>"quoted"</em> invoices</h2></section>',
    '<section class="slide"><h2>It&rsquo;s the customer&rsquo;s call</h2><aside class="question" data-answer=\'Say "yes" &amp; move on\'>Do we <strong>bill</strong> now?</aside></section>',
  ].join('\n');
  const { html, errors } = built(fragment, { brand: brand({ name: 'Acme "Invoices" & Sons' }) });
  assert.deepStrictEqual(errors, []);
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  const values = [];
  (main.match(/<[a-zA-Z][^<>]*>/g) || []).forEach(tag => {
    const rest = tag.replace(/^<[a-zA-Z][\w-]*/, '').replace(/\/?>$/, '');
    assert.match(rest, /^(\s+[\w:-]+(\s*=\s*"[^"<>]*")?)*\s*$/, 'attributes parse: ' + tag);
    (rest.match(/"[^"]*"/g) || []).forEach(v => values.push(v));
  });
  assert.ok(values.length > 5);
  values.forEach(v => {
    assert.ok(!/Q&amp;A|quoted|customer|It&rsquo;s/.test(v), 'no attribute holds the h2 text: ' + v);
  });
  assert.ok(count(main, 'Q&amp;A on <em>"quoted"</em> invoices') === 1);
  assert.ok(main.includes('It&rsquo;s the customer&rsquo;s call</h2>'));
  const recap = section(html, 3);
  assert.ok(recap.includes('<a href="#s2">Slide 2 · It&rsquo;s the customer&rsquo;s call</a>'));
  assert.ok(recap.includes('Do we <strong>bill</strong> now?'));
  assert.ok(recap.includes('Answered: Say "yes" &amp; move on'));
  assert.ok(main.includes('Acme &quot;Invoices&quot; &amp; Sons'));
});

test('brand: neutral colours and no logo write no override, no img, the name in every slide\'s bar', () => {
  const { html } = built(PLAIN);
  assert.strictEqual(count(html, '--bar:'), count(FRAME, '--bar:'));
  assert.ok(!html.includes('<img'));
  [1, 2, 3].forEach(n => assert.match(section(html, n), /<header class="bar"><span class="name">Acme Invoicing<\/span><span class="eyebrow"><\/span><span class="num">/));
  assert.strictEqual(brandTokens('neutral'), null);
});

test('brand: the primary fills the bar, the secondary draws the stripe where it shows on it, marks fall back by contrast', () => {
  const navy = '#1d214e', green = '#2edc76';
  const t = brandTokens({ primary: '#1D214E', secondary: '#2EDC76' });
  assert.strictEqual(t.light.bar, navy);
  assert.strictEqual(t.light.on, '#fafafa');
  assert.ok(contrast(t.light['on-muted'], navy) >= 4.5);
  assert.strictEqual(t.light.stripe, green, 'green keeps 3:1 on navy');
  assert.strictEqual(t.light.page, '#ededf1', 'no surface: 8% of the primary into white');
  assert.strictEqual(t.light.title, navy);
  assert.strictEqual(t.light.detail, navy, 'green is under 3:1 on the light page, the marks fall to navy');
  assert.strictEqual(t.dark.detail, green, 'on the dark page green shows');
  assert.strictEqual(t.dark.title, t.dark.ink);
  assert.strictEqual(brandTokens({ primary: '#1d214e', secondary: '#2edc76', surface: '#ffffff' }).light.page, '#ffffff');
  const pale = brandTokens({ primary: '#f0e68c' });
  assert.strictEqual(pale.light.on, '#111111', 'a light primary takes dark text');
  assert.strictEqual(pale.light.stripe, 'transparent', 'a missing secondary takes the primary, invisible on itself');
  assert.strictEqual(pale.light.title, pale.light.ink, 'a light primary is no title colour');
});

test('brand: a colour set writes its tokens after the frame, light, both dark selectors and print; a logo goes in every bar', () => {
  const h = built(PLAIN, { brand: brand({ colors: { primary: '#1D214E', secondary: '#2EDC76' } }) }).html;
  const o = h.slice(h.indexOf(':root { --bg:', h.indexOf('/* Toolbar */')));
  assert.match(o, /^:root \{ --bg: #\w+;[^}]*--bar: #1d214e;[^}]*\}\n@media \(prefers-color-scheme: dark\) \{ :root:not\(\[data-theme="light"\]\) \{ [^}]*\} \}\n:root\[data-theme="dark"\] \{ [^}]*\}\n@media print \{ :root:root:root \{ [^}]*--stripe: #2edc76;[^}]*\} \}/);
  const seen = [];
  const { html, errors } = built(PLAIN, { brand: brand({ logo: 'brand/logo.svg' }) }, p => { seen.push(p); return Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'); });
  assert.deepStrictEqual(errors, []);
  assert.deepStrictEqual(seen, ['brand/logo.svg']);
  [1, 2, 3].forEach(n => assert.match(section(html, n), /<header class="bar"><img class="logo" src="data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+" alt="Acme Invoicing">/));
  assert.ok(!NETWORK.test(html));
  const png = built(PLAIN, { brand: brand({ logo: 'l.png' }) }, () => Buffer.from([1, 2, 3])).html;
  assert.ok(png.includes('data:image/png;base64,AQID'));
});

test('data-eyebrow labels the bar and leaves the section; the changed slide says so', () => {
  const fragment = '<section class="slide" data-eyebrow="Billing · INV-12"><h2>Late invoices get a reminder</h2></section>\n<section class="slide changed" data-eyebrow="x"><h2>Weekdays only</h2></section>';
  const { html } = built(fragment);
  assert.match(section(html, 2), /<span class="eyebrow">Billing · INV-12<\/span>/);
  assert.ok(!/<section[^>]*data-eyebrow/.test(html));
  assert.match(section(html, 1), /<span class="eyebrow">What changed<\/span>/);
});

test('a local image is inlined as a data URI; a missing one names the slide and the fix', () => {
  const frag = '<section class="slide"><h2>Flow</h2><figure class="visual"><img src="docs/flow.png" alt="Invoice flow"></figure></section>';
  const seen = [];
  const { html, errors } = built(frag, {}, p => { seen.push(p); return p === 'docs/flow.png' ? Buffer.from([1, 2, 3]) : null; });
  assert.deepStrictEqual(errors, []);
  assert.deepStrictEqual(seen, ['docs/flow.png']);
  assert.match(html, /<img src="data:image\/png;base64,AQID" alt="Invoice flow">/);
  assert.ok(!html.includes('docs/flow.png'));
  assert.ok(built(frag).errors.includes('slide 1: image docs/flow.png not found; give a .png, .jpg, .svg or .webp path from the project root or beside the deck json'));
  assert.deepStrictEqual(built('<section class="slide"><h2>A</h2><img src="data:image/png;base64,AQID" alt=""></section>').errors, []);
});

test('the recap takes the fewest slides of at most five questions, spread evenly, the first slides taking one more', () => {
  const sizes = { 1: [1], 5: [5], 6: [3, 3], 7: [4, 3], 8: [4, 4], 9: [5, 4], 10: [5, 5], 11: [4, 4, 3], 12: [4, 4, 4], 16: [4, 4, 4, 4] };
  Object.entries(sizes).forEach(([n, expected]) => assert.deepStrictEqual(recapSizes(Number(n)), expected, n + ' questions'));
});

test('the recap is numbered on across its slides, and the counts include every recap slide', () => {
  const q = i => '<aside class="question">Q' + i + '?</aside>';
  const fragment = [1, 2, 3, 4].map(i => '<section class="slide"><h2>Claim ' + i + '</h2>' + q(2 * i - 1) + q(2 * i) + '</section>').join('\n').replace(q(8), '');
  const { html } = built(fragment);
  assert.match(section(html, 5), /<h2 id="s5-h">Open questions \(1\/2\)<\/h2>\n<ol start="1">/);
  assert.strictEqual(count(section(html, 5), '<li>'), 4);
  assert.match(section(html, 6), /<h2 id="s6-h">Open questions \(2\/2\)<\/h2>\n<ol start="5">/);
  assert.strictEqual(count(section(html, 6), '<li>'), 3);
  assert.match(section(html, 1), /<span class="num">1 \/ 6<\/span>/);
  assert.match(built(PLAIN.replace('</section>', q(1) + '</section>')).html, /<h2 id="s4-h">Open questions<\/h2>/, 'one recap slide keeps the plain title');
});

test('fitErrors names each slide that overflows or is unreadable, with the fix', () => {
  const ok = { n: 1, height: 800, over: 0, overW: 0, imgs: [{ name: 'Flow', scale: 0.8 }], svgText: 34 };
  assert.deepStrictEqual(fitErrors([ok, { ...ok, n: 2, over: 1 }]), [], 'a pixel of rounding passes');
  const errs = fitErrors([{ ...ok, n: 3, over: 240 }, { ...ok, n: 4, overW: 30 }, { ...ok, n: 5, imgs: [{ name: 'Old schema', scale: 0.19 }] }, { ...ok, n: 6, svgText: 21 }]);
  assert.strictEqual(errs.length, 4);
  assert.match(errs[0], /^slide 3: its content is 30% taller than the slide; split it in two, cut text/);
  assert.match(errs[1], /^slide 4: its content is wider than the slide/);
  assert.match(errs[2], /^slide 5: Old schema shows at 19% of its size, too small to read; redraw it landscape as an inline <svg>/);
  assert.match(errs[3], /^slide 6: the diagram's text is 21 px high on a 1920 px slide, too small to read/);
});

test('checkFit empties the shots folder, shoots every slide and closes the browser', async () => {
  const dir = tmpDir('deck-');
  const shots = path.join(dir, 'a.shots');
  fs.mkdirSync(shots);
  fs.writeFileSync(path.join(shots, '09.png'), 'stale');
  const calls = [];
  const report = [{ n: 1, height: 800, over: 0, overW: 0, imgs: [], svgText: null }];
  const el = i => ({ screenshot: async o => { calls.push('shot ' + path.basename(o.path)); fs.writeFileSync(o.path, 'png'); } });
  const playwright = { chromium: { launch: async () => ({
    newPage: async o => { calls.push('page ' + o.viewport.width + 'x' + o.viewport.height); return {
      goto: async u => { calls.push('goto ' + u.startsWith('file://')); }, evaluate: async () => report, $$: async () => [el(0), el(1)] }; },
    close: async () => { calls.push('close'); } }) } };
  const got = await checkFit(playwright, path.join(dir, 'a.html'), shots);
  assert.strictEqual(got, report);
  assert.deepStrictEqual(calls, ['page 1600x1000', 'goto true', 'shot 01.png', 'shot 02.png', 'close']);
  assert.deepStrictEqual(fs.readdirSync(shots).sort(), ['01.png', '02.png']);
});

test('CLI: with no Playwright found, the deck is written and the run exits 3 saying the fit was not checked', () => {
  const dir = tmpDir('deck-');
  fs.writeFileSync(path.join(dir, 'a.slides.html'), PLAIN);
  const json = path.join(dir, 'a.deck.json');
  fs.writeFileSync(json, JSON.stringify(deckOf({ slides: 'a.slides.html' })));
  const r = spawnSync(process.execPath, [DECK_JS, json, '--from=' + dir], { encoding: 'utf8' });
  assert.strictEqual(r.status, 3, r.stderr);
  assert.ok(fs.existsSync(path.join(dir, 'a.html')));
  assert.match(r.stderr, /fit not checked: no Playwright found from .*; pass --from=<folder holding node_modules>/);
  assert.strictEqual(spawnSync(process.execPath, [DECK_JS, json, '--no-check', '--from=' + dir], { encoding: 'utf8' }).status, 2);
});

test('brand checks name the field and the fix', () => {
  const msgs = over => built(PLAIN, over).errors.join('\n');
  assert.match(msgs({ brand: brand({ name: '' }) }), /brand\.name/);
  assert.match(msgs({ brand: brand({ lang: ' ' }) }), /brand\.lang/);
  assert.match(msgs({ brand: brand({ colors: 'blue' }) }), /brand\.colors: must be "neutral" or \{ "primary": "#rrggbb".*fix it in the deck\.json/);
  assert.match(msgs({ brand: brand({ colors: { primary: '#1a6b3c', secondary: 'green' } }) }), /brand\.colors\.secondary: must be "#rrggbb" or left out; fix it in the deck\.json/);
  assert.match(msgs({ brand: brand({ colors: { secondary: '#1a6b3c' } }) }), /brand\.colors\.primary: must be "#rrggbb"; fix it in the deck\.json/);
  assert.match(msgs({ brand: brand({ colors: { primary: '#1a6b3c', tertiary: '#ffffff' } }) }), /brand\.colors\.tertiary: unknown/);
  assert.match(msgs({ brand: brand({ accent: '#1a6b3c' }) }), /brand\.accent: replaced by brand\.colors; write "colors": "neutral" or \{ "primary": "#rrggbb".*remove "accent"/);
  assert.ok(msgs({ brand: brand({ logo: 'gone.png' }) }).includes('brand.logo: gone.png not found; use a .png, .jpg or .svg'));
  assert.ok(built(PLAIN, { brand: brand({ logo: 'logo.gif' }) }, () => Buffer.from('x')).errors.includes('brand.logo: logo.gif not found; use a .png, .jpg or .svg'));
  assert.deepStrictEqual(build(deckOf({ brand: undefined }), PLAIN, FRAME, noFile).errors.length > 0, true);
});

test('exact copy: no slide, h2 count, svg, external URL', () => {
  assert.ok(built('<p>nothing</p>').errors.includes('no slide: add at least one <section class="slide">'));
  const two = '<section class="slide"><h2>A</h2><h2>B</h2></section>';
  assert.ok(built(PLAIN + '\n' + two).errors.includes('slide 4: needs exactly one <h2> claim'));
  assert.ok(built('<section class="slide"><p>no claim</p></section>').errors.includes('slide 1: needs exactly one <h2> claim'));
  const svg = PLAIN.replace('Orders close at month end</h2>', 'Orders close at month end</h2><svg viewBox="0 0 1 1"></svg>');
  assert.ok(built(svg).errors.includes('slide 3: <svg> needs role="img" and aria-label'));
  const okSvg = PLAIN.replace('Orders close at month end</h2>', 'Orders close at month end</h2><svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Flow"></svg>');
  assert.deepStrictEqual(built(okSvg).errors, []);
  const ext = '<section class="slide"><h2>A</h2></section>\n<section class="slide"><h2>B</h2><img src="https://cdn.example.com/logo.png" alt=""></section>';
  assert.ok(built(ext).errors.includes('slide 2: external URL https://cdn.example.com/logo.png (the deck stays offline); inline it or name it in text'));
  const css = '<section class="slide"><h2>B</h2><div style="background:url(https://x.example/a.png)"></div></section>';
  assert.match(built(css).errors.join('\n'), /slide 1: external URL https:\/\/x\.example\/a\.png/);
  const link = '<section class="slide"><h2>B</h2><a href="http://tracker.example/INV-9">INV-9</a></section>';
  assert.match(built(link).errors.join('\n'), /slide 1: external URL http:\/\/tracker\.example\/INV-9/);
  assert.strictEqual(built(ext).html, null);
});

test('the built output has no network reference', () => {
  assert.ok(!NETWORK.test(built(PLAIN).html));
});

test('CLI: writes <topic>.html beside the json and prints its path', () => {
  const dir = tmpDir('deck-');
  fs.writeFileSync(path.join(dir, 'invoices.slides.html'), PLAIN);
  const json = path.join(dir, 'invoices.deck.json');
  fs.writeFileSync(json, JSON.stringify(deckOf({ slides: 'invoices.slides.html' })));
  const r = spawnSync(process.execPath, [DECK_JS, json, '--no-check'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  const out = path.join(dir, 'invoices.html');
  assert.strictEqual(r.stdout.split('\n')[0], out);
  assert.match(r.stdout, /fit not checked \(--no-check\)/);
  assert.match(fs.readFileSync(out, 'utf8'), /<html lang="en">/);
});

test('CLI: an external URL exits 1 with the copy on stderr and writes nothing', () => {
  const dir = tmpDir('deck-');
  fs.writeFileSync(path.join(dir, 'a.slides.html'), '<section class="slide"><h2>A</h2><img src="https://cdn.example.com/x.png" alt=""></section>');
  const json = path.join(dir, 'a.deck.json');
  fs.writeFileSync(json, JSON.stringify(deckOf({ slides: 'a.slides.html' })));
  const r = spawnSync(process.execPath, [DECK_JS, json], { encoding: 'utf8' });
  assert.strictEqual(r.status, 1);
  assert.ok(r.stderr.includes('slide 1: external URL https://cdn.example.com/x.png (the deck stays offline); inline it or name it in text'));
  assert.ok(!fs.existsSync(path.join(dir, 'a.html')));
});

test('CLI: a logo path resolves and an svg without role exits 1', () => {
  const dir = tmpDir('deck-');
  fs.writeFileSync(path.join(dir, 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  fs.writeFileSync(path.join(dir, 'a.slides.html'), '<section class="slide"><h2>A</h2><svg></svg></section>');
  const json = path.join(dir, 'a.deck.json');
  fs.writeFileSync(json, JSON.stringify(deckOf({ slides: 'a.slides.html', brand: brand({ logo: 'logo.svg' }) })));
  const bad = spawnSync(process.execPath, [DECK_JS, json], { encoding: 'utf8' });
  assert.strictEqual(bad.status, 1);
  assert.ok(bad.stderr.includes('slide 1: <svg> needs role="img" and aria-label'));
  fs.writeFileSync(path.join(dir, 'a.slides.html'), '<section class="slide cover"><h2>A</h2></section>');
  const ok = spawnSync(process.execPath, [DECK_JS, json, '--no-check'], { encoding: 'utf8' });
  assert.strictEqual(ok.status, 0, ok.stderr);
  assert.match(fs.readFileSync(path.join(dir, 'a.html'), 'utf8'), /<img class="logo" src="data:image\/svg\+xml;base64,/);
});

test('CLI: a wrong call exits 2 with the usage, bad json or a missing slides file exits 1', () => {
  const none = spawnSync(process.execPath, [DECK_JS], { encoding: 'utf8' });
  assert.strictEqual(none.status, 2);
  assert.match(none.stderr, /usage: node deck\.js <topic>\.deck\.json/);
  assert.strictEqual(spawnSync(process.execPath, [DECK_JS, 'a.json', '--x'], { encoding: 'utf8' }).status, 2);
  const dir = tmpDir('deck-');
  const json = path.join(dir, 'a.deck.json');
  fs.writeFileSync(json, '{ nope');
  assert.strictEqual(spawnSync(process.execPath, [DECK_JS, json], { encoding: 'utf8' }).status, 1);
  fs.writeFileSync(json, JSON.stringify(deckOf({ slides: 'missing.html' })));
  const miss = spawnSync(process.execPath, [DECK_JS, json], { encoding: 'utf8' });
  assert.strictEqual(miss.status, 1);
  assert.match(miss.stderr, /missing\.html/);
});

test('E5: the deck builds with an empty PATH and nothing under team-deck mentions the video encoder', () => {
  const dir = tmpDir('deck-');
  fs.writeFileSync(path.join(dir, 'a.slides.html'), PLAIN);
  const json = path.join(dir, 'a.deck.json');
  fs.writeFileSync(json, JSON.stringify(deckOf({ slides: 'a.slides.html' })));
  const r = spawnSync(process.execPath, [DECK_JS, json, '--no-check'], { encoding: 'utf8', env: { PATH: '' } });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(dir, 'a.html')));
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  walk(DECK_DIR).forEach(f => assert.ok(!/ffmpeg/i.test(fs.readFileSync(f, 'utf8')), f));
});

test('CLI: a logo path from the project root resolves when the json sits in <root>/.council/decks/, whatever the working directory', () => {
  const root = tmpDir('deck-');
  const decks = path.join(root, '.council', 'decks');
  fs.mkdirSync(decks, { recursive: true });
  fs.mkdirSync(path.join(root, 'assets'));
  fs.writeFileSync(path.join(root, 'assets', 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  fs.writeFileSync(path.join(decks, 'a.slides.html'), PLAIN);
  const json = path.join(decks, 'a.deck.json');
  fs.writeFileSync(json, JSON.stringify(deckOf({ slides: 'a.slides.html', brand: brand({ logo: 'assets/logo.svg' }) })));
  const r = spawnSync(process.execPath, [DECK_JS, json, '--no-check'], { encoding: 'utf8', cwd: tmpDir('elsewhere-') });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(fs.readFileSync(path.join(decks, 'a.html'), 'utf8'), /<img class="logo" src="data:image\/svg\+xml;base64,/);
});

test('a logo whose size reads is written once, as --logo, with its ratio; each bar shows it as a span', () => {
  const png = Buffer.alloc(33);
  png.write('\x89PNG\r\n\x1a\n', 0, 'latin1');
  png.writeUInt32BE(13, 8); png.write('IHDR', 12, 'latin1'); png.writeUInt32BE(4252, 16); png.writeUInt32BE(679, 20);
  const { html, errors } = built(PLAIN, { brand: brand({ logo: 'logo.png' }) }, () => png);
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(count(html, 'data:image/png;base64,'), 1);
  assert.match(html, /:root \{ --logo: url\("data:image\/png;base64,[A-Za-z0-9+/=]+"\); \}\nspan\.logo \{ aspect-ratio: 4252 \/ 679; \}/);
  [1, 2, 3].forEach(n => assert.match(section(html, n), /<header class="bar"><span class="logo" role="img" aria-label="Acme Invoicing"><\/span>/));
  const svg = built(PLAIN, { brand: brand({ logo: 'l.svg' }) }, () => Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 30"/>')).html;
  assert.match(svg, /span\.logo \{ aspect-ratio: 120 \/ 30; \}/);
});

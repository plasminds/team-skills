const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { writeGate, writeAcceptance, acceptanceGate, shareGate, render, pageData, fakeDom } = require('./helpers');

// D5 / K13: --share works on every kind and writes the page as a file; the review keeps its work order.

const OUTCOME = [{ view: 'ui', caption: 'The screen', after: { svg: '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>' } }];
const gate = (kind, extra) => Object.assign({
  kind, title: 'File gate', lang: 'en', source: '.council/decisions/2026-11-11-x.md',
  decisions: [
    { id: 'D1', title: 'Build or buy?', options: [{ value: 'a', label: 'Build', recommended: true }, { value: 'b', label: 'Buy' }, { value: 'none', label: 'Neither', negative: true }] },
    { id: 'D2', title: 'Where?', options: [{ value: 'a', label: 'Here' }, { value: 'b', label: 'There' }, { value: 'none', label: 'Neither', negative: true }] }
  ]
}, kind === 'plan' || kind === 'kickoff' ? { outcome: OUTCOME } : {}, extra || {});
const sharePath = f => f.replace(/\.gate\.json$/, '.share.html');
const read = f => fs.readFileSync(sharePath(f), 'utf8');

async function boot(html, matchMedia) {
  const dom = fakeDom(html);
  if (matchMedia) dom.ctx.matchMedia = matchMedia;
  dom.copied = [];
  dom.ctx.navigator.clipboard.writeText = t => { dom.copied.push(t); return Promise.resolve(); };
  vm.createContext(dom.ctx);
  [...html.matchAll(/<script(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g)].forEach(m => vm.runInContext(m[1], dom.ctx));
  for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve));
  return dom;
}
const settle = () => new Promise(resolve => setImmediate(resolve));
const opts = (dom, id) => dom.document.getElementById('d-' + id).querySelectorAll('.opt');
const all = n => [n].concat(...(Array.isArray(n.children) ? n.children : []).map(all));

for (const kind of ['debate', 'plan', 'kickoff', 'refactor']) {
  test(`D5-2: --share on a ${kind} gate writes <gate>.share.html with no work order`, () => {
    const f = writeGate(gate(kind));
    const r = render(f, '--share');
    assert.strictEqual(r.code, 0, r.stderr);
    assert.ok(fs.existsSync(sharePath(f)));
    const data = pageData(read(f));
    assert.strictEqual(data.mode, 'share');
    assert.ok(!('preamble' in data), 'no preamble');
    assert.ok(!('source' in data), 'no record path');
  });
}

test('D5-2: a share page copies what the plain page copies, and never says "Claude"', async () => {
  for (const kind of ['plan', 'kickoff', 'refactor', 'debate']) {
    const f = writeGate(gate(kind));
    assert.strictEqual(render(f, '--share').code, 0);
    const dom = await boot(read(f));
    opts(dom, 'D1')[1].click(); opts(dom, 'D2')[0].click();
    dom.document.getElementById('copy').click();
    await settle();
    assert.strictEqual(dom.copied.length, 1, kind);
    assert.match(dom.copied[0], /GATE DECISIONS — File gate/, kind);
    assert.match(dom.copied[0], /D1 = b/, kind);
    assert.ok(!/record:/.test(dom.copied[0]), kind + ': no record line on a shared page');
    assert.ok(!/mission|preamble/i.test(dom.copied[0]), kind);
    const toast = dom.document.getElementById('toast').textContent;
    assert.match(toast, /send it back/i, kind);
    assert.ok(!/claude/i.test(toast), kind + ': ' + toast);
  }
});

test('D5-2: a shared debate page copies the sentences, a blank line, the intro, then the block', async () => {
  const f = writeGate(gate('debate'));
  assert.strictEqual(render(f, '--share').code, 0);
  const dom = await boot(read(f));
  opts(dom, 'D1')[1].click(); opts(dom, 'D2')[0].click();
  dom.document.getElementById('copy').click();
  await settle();
  const [sentences, rest] = dom.copied[0].split('\n\nSame answers in the form Claude reads:\n');
  assert.strictEqual(sentences, 'D1. Build or buy? Answer: Buy\nD2. Where? Answer: Here');
  assert.match(rest, /^GATE DECISIONS — File gate\nD1 = b\nD2 = a$/);
});

test('D5-2: a shared debate page keeps "Accept recommended" and the "Recommended" tag, with no suggestion mark, and Send stays hidden', async () => {
  const f = writeGate(gate('debate'));
  assert.strictEqual(render(f, '--share').code, 0);
  const dom = await boot(read(f));
  assert.strictEqual(dom.document.getElementById('recAllLabel').textContent, 'Accept recommended');
  const tags = all(dom.document.getElementById('app')).filter(n => /\brectag\b/.test(n.className));
  assert.ok(tags.some(n => n.textContent === 'Recommended'));
  assert.ok(tags.every(n => !/\bsug\b/.test(n.className)));
  assert.match(read(f), /<button[^>]*id="send"[^>]*hidden|<button[^>]*hidden[^>]*id="send"/);
});

test('D5-4: a review share page keeps the Copy prompt work order', async () => {
  const f = writeGate(shareGate());
  assert.strictEqual(render(f, '--share').code, 0);
  const html = read(f);
  assert.match(pageData(html).preamble, /Mission: tidy x\.js/);
  const dom = await boot(html);
  assert.strictEqual(dom.document.getElementById('recAllLabel').textContent, 'Accept the suggestions');
  assert.strictEqual(dom.document.getElementById('copyLabel').textContent, 'Copy prompt');
  dom.document.getElementById('copy').click();
  await settle();
  assert.match(dom.copied[0], /Mission: tidy x\.js/);
  assert.match(dom.document.getElementById('toast').textContent, /coding agent/);
});

test('D5-3: an acceptance gate shares as a file; --serve and --accept-recommended stay refused', () => {
  const f = writeAcceptance(acceptanceGate());
  const r = render(f, '--share');
  assert.strictEqual(r.code, 0, r.stderr);
  assert.strictEqual(pageData(read(f)).mode, 'share');
  for (const flag of ['--serve', '--accept-recommended']) {
    const x = render(f, flag);
    assert.strictEqual(x.code, 1, flag);
    assert.match(x.stderr, /--serve and --accept-recommended do not apply/);
  }
});

test('D5-5: --preset on a gate that is not a review is refused, and names the review-only flag', () => {
  const f = writeGate(gate('debate'));
  const p = f.replace(/\.gate\.json$/, '.share.txt');
  fs.writeFileSync(p, 'GATE SHARE\nD1 = a\n');
  const r = render(f, '--share', '--preset=' + p);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /--preset needs a review gate/);
});

test('D5-5: --review on a gate that is not a review is a usage error', () => {
  const f = writeGate(gate('debate'));
  const r = render(f, '--share', '--review=github', '--head=9b1e4c7a2f3d5e6b8c0a1d2e3f4a5b6c7d8e9f01');
  assert.strictEqual(r.code, 2);
  assert.match(r.stderr, /--review needs a review gate/);
});

test('a shared page prints no record line', async () => {
  const f = writeGate(gate('plan'));
  assert.strictEqual(render(f, '--share').code, 0);
  const dom = await boot(read(f));
  opts(dom, 'D1')[0].click();
  dom.document.getElementById('copy').click();
  await settle();
  assert.ok(!/^record:/m.test(dom.copied[0]));
});

test('the .review-share rules hide the agents\' tag, and show only the suggestion', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'skills', 'team-view', 'style.css'), 'utf8');
  assert.match(css, /^\.review-share \.rectag \{ display: none; \}$/m);
  assert.match(css, /^\.review-share \.opt \.rectag\.sug \{ display: inline-flex; \}$/m);
  assert.ok(!/^\.share-mode \.rectag/m.test(css));
});

// S12: the cover strip on a share page, no key legend (D5-1, D5-3, D5-4, D5-6, D5-7).
const textOf = n => (n.textContent || '') + (Array.isArray(n.children) ? n.children.map(textOf).join('') : '');
const byClass = (dom, id, cls) => all(dom.document.getElementById(id)).filter(n => new RegExp('(^|\\s)' + cls + '(\\s|$)').test(n.className));
const byTag = (dom, id, tag) => all(dom.document.getElementById(id)).filter(n => n.tagName === tag);
const narrow = narrowMatches => q => ({ matches: /max-width: 760px/.test(q) ? narrowMatches : false, addEventListener() {}, addListener() {} });
const cssText = () => fs.readFileSync(path.join(__dirname, '..', '..', 'skills', 'team-view', 'style.css'), 'utf8');
const twoOpen = (kind, extra) => gate(kind, Object.assign({
  decisions: [
    { id: 'D1', title: 'Build or buy?', options: [{ value: 'a', label: 'Build', recommended: true }, { value: 'b', label: 'Buy' }, { value: 'none', label: 'Neither', negative: true }] },
    { id: 'D2', title: 'Where?', options: [{ value: 'a', label: 'Here' }, { value: 'b', label: 'There' }, { value: 'none', label: 'Neither', negative: true }] },
    { id: 'D3', title: 'Naming?', minor: true, default: 'a', options: [{ value: 'a', label: 'Short' }, { value: 'b', label: 'Long' }, { value: 'none', label: 'Neither', negative: true }] }
  ]
}, extra || {}));

test('D5-1: a debate share page has a visible strip with the count of open questions, no legend, no record path', async () => {
  const f = writeGate(twoOpen('debate'));
  assert.strictEqual(render(f, '--share').code, 0);
  const html = read(f);
  const dom = await boot(html);
  const ask = dom.document.getElementById('ask');
  assert.strictEqual(ask.hidden, false);
  assert.strictEqual(ask.attrs.role === undefined ? 'note' : ask.attrs.role, 'note');
  assert.match(textOf(ask), /You are asked to decide 2 questions\./);
  assert.match(textOf(dom.document.getElementById('ptxt')), /3/, 'the counter counts every item');
  const legend = dom.document.getElementById('legend');
  assert.strictEqual(legend.hidden, true);
  assert.strictEqual(legend.children.length, 0);
  assert.ok(!/Record:/.test(textOf(dom.document.getElementById('gt'))));
  assert.strictEqual(dom.document.getElementById('ask').attrs['aria-label'], 'What this page asks');
});

test('D5-1: a debate share page opens on its context cover row, and the ? keys panel still opens', async () => {
  const f = writeGate(twoOpen('debate', { context: [{ id: 'C1', title: 'Where we are', why: 'Exports take a day.' }] }));
  assert.strictEqual(render(f, '--share').code, 0);
  const dom = await boot(read(f));
  const row = dom.document.getElementById('r-C1');
  assert.ok(row, 'the cover row exists');
  assert.strictEqual(row.getAttribute('aria-current'), 'true', 'the cover row is the current one');
  assert.strictEqual(dom.document.getElementById('r-D1').getAttribute('aria-current'), null);
  const help = dom.roots().flatMap(all).find(n => n.tagName === 'DIALOG' && /(^|\s)help(\s|$)/.test(n.className));
  assert.ok(help, 'the keys panel exists');
  help.showModal = () => { help.open = true; };
  dom.press('?');
  assert.strictEqual(help.open, true, 'the ? key opens the keys panel');
  help.open = false;
  dom.document.getElementById('keys').click();
  assert.strictEqual(help.open, true, 'the Keys button opens it too');
});

test('D5-1: one open question reads in the singular, none reads "nothing to decide"', async () => {
  const one = writeGate(gate('debate', { decisions: [
    { id: 'D1', title: 'Build or buy?', options: [{ value: 'a', label: 'Build', recommended: true }, { value: 'b', label: 'Buy' }, { value: 'none', label: 'Neither', negative: true }] }] }));
  assert.strictEqual(render(one, '--share').code, 0);
  assert.match(textOf((await boot(read(one))).document.getElementById('ask')), /You are asked to decide 1 question\./);
  const none = writeGate(gate('debate', { decisions: [
    { id: 'D1', title: 'Build or buy?', default: 'a', options: [{ value: 'a', label: 'Build', recommended: true }, { value: 'b', label: 'Buy' }, { value: 'none', label: 'Neither', negative: true }] }] }));
  assert.strictEqual(render(none, '--share').code, 0);
  const dom = await boot(read(none));
  assert.match(textOf(dom.document.getElementById('ask')), /Nothing to decide on this page: read it through\./);
  assert.strictEqual(byTag(dom, 'ask', 'DETAILS').length, 0);
});

test('D5-1: each kind has its own lead, and a lang "fr" share page holds the French strings', async () => {
  const leads = { plan: /approve or decline 2 points of this plan/, kickoff: /settle 2 choices for the start of this project/, refactor: /rule on 2 proposed changes/ };
  for (const kind of Object.keys(leads)) {
    const f = writeGate(twoOpen(kind));
    assert.strictEqual(render(f, '--share').code, 0, kind);
    assert.match(textOf((await boot(read(f))).document.getElementById('ask')), leads[kind], kind);
  }
  const f = writeGate(twoOpen('debate', { lang: 'fr' }));
  assert.strictEqual(render(f, '--share').code, 0);
  const dom = await boot(read(f));
  assert.match(textOf(dom.document.getElementById('ask')), /On vous demande de trancher 2 questions\./);
  assert.strictEqual(byTag(dom, 'ask', 'SUMMARY')[0].textContent, 'Que faire ensuite');
  assert.strictEqual(dom.document.getElementById('ask').attrs['aria-label'], 'Ce que demande cette page');
});

test('D5-3: an acceptance share page: N cases to read, nothing to send back, no details', async () => {
  const f = writeAcceptance(acceptanceGate({ lang: 'en' }));
  assert.strictEqual(render(f, '--share').code, 0);
  const dom = await boot(read(f));
  assert.match(textOf(dom.document.getElementById('ask')), /2 cases to read\. Nothing to send back\./);
  assert.strictEqual(byTag(dom, 'ask', 'DETAILS').length, 0);
  assert.strictEqual(dom.document.getElementById('ask').hidden, false);
  assert.strictEqual(dom.document.getElementById('legend').hidden, true);
});

test('D5-4: the review share page: findings in the lead, Copy prompt in the how-to line, no legend', async () => {
  const f = writeGate(shareGate());
  assert.strictEqual(render(f, '--share').code, 0);
  const dom = await boot(read(f));
  const ask = dom.document.getElementById('ask');
  assert.strictEqual(ask.hidden, false);
  assert.match(textOf(byClass(dom, 'ask', 'ask-lead')[0]), /You are asked to decide \d+ findings?\./);
  assert.match(textOf(byClass(dom, 'ask', 'ask-how')[0]), /Copy prompt/);
  assert.strictEqual(dom.document.getElementById('legend').children.length, 0);
  assert.strictEqual(dom.document.getElementById('copyLabel').textContent, 'Copy prompt');
});

test('D5-4: a review share page opened with a preset shows the pre-filled lead', async () => {
  const f = writeGate(shareGate());
  const p = f.replace(/\.gate\.json$/, '.share.txt');
  fs.writeFileSync(p, 'GATE SHARE — Gate\nF1 = round\n');
  const r = render(f, '--share', '--preset=' + p);
  assert.strictEqual(r.code, 0, r.stderr);
  const dom = await boot(read(f));
  assert.match(textOf(byClass(dom, 'ask', 'ask-lead')[0]), /The sender has pre-filled their choices\./);
  assert.match(textOf(byClass(dom, 'ask', 'ask-how')[0]), /Check them, change any/);
});

test('D5-6: the plain page of each kind has no strip, the legend, and the record path', async () => {
  for (const kind of ['debate', 'plan', 'refactor', 'kickoff']) {
    const f = writeGate(gate(kind));
    assert.strictEqual(render(f).code, 0, kind);
    const dom = await boot(fs.readFileSync(f.replace(/\.gate\.json$/, '.html'), 'utf8'));
    assert.match(fs.readFileSync(f.replace(/\.gate\.json$/, '.html'), 'utf8'), /<div class="ask" id="ask"[^>]*\bhidden>/, kind);
    assert.strictEqual(dom.document.getElementById('ask').children.length, 0, kind);
    const legend = dom.document.getElementById('legend');
    assert.ok(legend.children.length > 0, kind);
    assert.notStrictEqual(legend.hidden, true, kind);
    assert.match(textOf(dom.document.getElementById('gt')), /2026-11-11-x\.md/, kind);
  }
});

test('D5-7: at 760px or less the how-to line is folded under "What to do next"; wider it is open', async () => {
  const f = writeGate(twoOpen('debate'));
  assert.strictEqual(render(f, '--share').code, 0);
  const html = read(f);
  const phone = await boot(html, narrow(true));
  const closed = byTag(phone, 'ask', 'DETAILS')[0];
  assert.ok(closed, 'a details element');
  assert.strictEqual(closed.open, false);
  assert.match(textOf(byClass(phone, 'ask', 'ask-lead')[0]), /2 questions/);
  const sum = byTag(phone, 'ask', 'SUMMARY')[0];
  assert.strictEqual(sum.textContent, 'What to do next');
  assert.ok(!('tabindex' in sum.attrs), 'the summary stays in the tab order');
  assert.match(textOf(closed), /Copy decisions and send the text back/);
  const wide = await boot(html, narrow(false));
  assert.strictEqual(byTag(wide, 'ask', 'DETAILS')[0].open, true);
});

test('D5-7: the strip follows the query when the window is resized', async () => {
  const f = writeGate(twoOpen('debate'));
  assert.strictEqual(render(f, '--share').code, 0);
  let fire;
  const mm = q => ({ matches: false, addEventListener: (t, fn) => { if (/max-width: 760px/.test(q) && t === 'change') fire = fn; }, addListener() {} });
  const dom = await boot(read(f), mm);
  assert.strictEqual(byTag(dom, 'ask', 'DETAILS')[0].open, true);
  assert.ok(fire, 'a change listener');
  fire({ matches: true });
  assert.strictEqual(byTag(dom, 'ask', 'DETAILS')[0].open, false);
});

test('S12: the strip and legend rules in style.css', () => {
  const css = cssText();
  assert.match(css, /^\.legend\[hidden\] \{ display: none; \}$/m);
  assert.match(css, /^\.ask\[hidden\] \{ display: none; \}$/m);
  assert.match(css, /grid-template-areas: "top" "ask" "tabs" "panes" "foot"/);
  assert.match(css, /"top" "ask" "sum" "tabs" "panes" "foot" "prog" "acts"/);
  assert.match(css, /^\.ask-how > summary \{ display: none; \}$/m);
  const phone = css.slice(css.indexOf('@media (max-width: 760px)'));
  assert.match(phone, /\.ask-how > summary \{[^}]*display: (block|flex)[^}]*min-height: 44px/);
});

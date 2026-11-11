const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { composedTemplate, RENDER, shareGate, writeGate, render, pageData, fakeDom, acceptanceGate, writeAcceptance, argued, tmpDir } = require('./helpers');

// A debate gate in the spec's shape: a page constraint, an item constraint, both lenses, a violating option.
function bridgeGate(overrides) {
  const gate = {
    kind: 'debate',
    title: 'Export',
    source: '.council/decisions/2026-10-14-export.md',
    decisions: [{
      id: 'D1', title: 'Accounting export: build or buy?', lens: 'business',
      constraints: [{ id: 'K2', lens: 'tech', text: 'No new database in production', source: 'CLAUDE.md:12', status: 'confirmed' },
        { id: 'K1', lens: 'business', text: 'Live before the 1 Dec closing', source: 'the human, framing', status: 'confirmed' }],
      options: [
        { value: 'build', label: 'Build in-house', recommended: true, tradeoff: { business: 'Live mid-November', tech: 'Duplicates the PDF pipeline (debt)' } },
        { value: 'buy', label: 'Third-party service', tradeoff: { business: '200 €/month', tech: 'No debt; one new dependency' }, violates: ['K2'] },
        { value: 'none', label: 'Neither: keep the manual export', negative: true,
          for: [{ who: 'CTO', point: 'Two PDF code paths to keep in sync', lens: 'tech' }],
          against: [{ who: 'PO', point: 'Unblocks the three customers waiting on the export' }] }
      ],
      accepts: 'PDF pipeline debt, to make the 1 Dec closing',
      metrics: [{ label: 'Weeks to ship', before: 0, after: 3, better: 'lower', lens: 'tech' }]
    }]
  };
  return Object.assign(gate, overrides || {});
}

function page(gate) {
  const file = writeGate(gate);
  const r = render(file);
  assert.strictEqual(r.code, 0, r.stderr);
  return pageData(fs.readFileSync(file.replace(/\.gate\.json$/, '.html'), 'utf8'));
}

function rejects(gate, pattern) {
  const r = render(writeGate(gate));
  assert.strictEqual(r.code, 1, 'expected a rejection');
  assert.match(r.stderr, pattern);
}

const item = (data, id) => data.items.find(it => it.id === id);
const ids = list => list.map(k => k.id);
// One decision on a page of the given kind.
const plain = (kind, d) => ({ kind, title: 'G', decisions: [Object.assign({ id: 'S1', title: 'Extract Function: total' }, d)] });
const plainArgued = (kind, d) => ({ kind, title: 'G', decisions: [argued(Object.assign({ id: 'S1', title: 'Extract Function: total' }, d))] });

test('a debate gate with both lenses: entries take the item lens, the bridge holds the item constraint', () => {
  const data = page(bridgeGate());
  const d1 = item(data, 'D1');
  assert.strictEqual(data.constraints, undefined);
  assert.strictEqual(d1.options[2].against[0].lens, 'business');
  assert.strictEqual(d1.options[2].for[0].lens, 'tech');
  assert.strictEqual(d1.metrics[0].lens, 'tech');
  assert.strictEqual(d1.lensTabs, true);
  assert.deepStrictEqual(d1.lenses, ['business', 'tech']);
  assert.deepStrictEqual(ids(d1.bridge), ['K2', 'K1']);
  assert.strictEqual(d1.accepts, 'PDF pipeline debt, to make the 1 Dec closing');
  assert.deepStrictEqual(d1.options[1].violates, ['K2']);
});

test('an item constraint an option violates shows on its bridge', () => {
  const g = bridgeGate(); g.decisions[0].options[1].violates = ['K2', 'K1'];
  assert.deepStrictEqual(ids(item(page(g), 'D1').bridge), ['K2', 'K1']);
});

test('a lens-free gate gets no bridge fields', () => {
  const file = writeGate(shareGate());
  assert.strictEqual(render(file).code, 0);
  const json = JSON.stringify(pageData(fs.readFileSync(file.replace(/\.gate\.json$/, '.html'), 'utf8')));
  assert.doesNotMatch(json, /"lens"|"lenses"|"lensTabs"|"bridge"|"constraints"/);
});

test('tabs: entries of both lenses show them on any page', () => {
  const both = { for: [{ who: 'PO', point: 'Ships sooner.', lens: 'business' }], against: [{ who: 'CTO', point: 'More code.', lens: 'tech' }] };
  assert.strictEqual(page(plainArgued('refactor', both)).items[0].lensTabs, true);
  const withCode = { for: [{ who: 'PO', point: 'Ships sooner.', lens: 'business' }], code: { before: 'a', after: 'b' } };
  assert.strictEqual(page(plainArgued('refactor', withCode)).items[0].lensTabs, true); // code is tech
});

test('a one-lens card gets no tabs, on any page: its header names the lens', () => {
  const tech = { lens: 'tech', options: [{ value: 'a', label: 'A', recommended: true }, { value: 'no', label: 'No', negative: true, against: [{ who: 'CTO', point: 'Cheaper to run.' }] }] };
  const debateGate = page(plain('debate', tech)).items[0];
  assert.strictEqual(debateGate.lensTabs, undefined);
  assert.deepStrictEqual(debateGate.lenses, ['tech']);
  assert.strictEqual(debateGate.options[1].against[0].lens, 'tech');
  assert.deepStrictEqual(page(plain('debate', { lens: 'business', minor: true, default: 'approve' })).items[0].lenses, ['business']);
});

test('lenses: what a card concerns counts its trade-offs and the constraints it can break, not only its arguments', () => {
  const g = bridgeGate();
  g.decisions.push({ id: 'D2', title: 'Charge for it?', lens: 'business',
    options: [{ value: 'free', label: 'Free', recommended: true }, { value: 'paid', label: 'Paid', violates: ['K3'] },
      { value: 'none', label: 'Do not charge', negative: true, against: [{ who: 'PO', point: 'Customers asked.' }] }],
    constraints: [{ id: 'K3', lens: 'tech', text: 'No new payment provider', source: 'CTO', status: 'confirmed' }] });
  const d2 = item(page(g), 'D2');
  assert.deepStrictEqual(d2.lenses, ['business', 'tech']); // breaking a tech rule concerns tech
  assert.strictEqual(d2.lensTabs, undefined); // but every argument is business: nothing to switch
});

test('lenses: code counts as tech once a trade-off lenses the card', () => {
  const it = page(plain('debate', { code: { before: 'a', after: 'b' },
    options: [{ value: 'a', label: 'A', recommended: true, tradeoff: { business: 'Live sooner' } }, { value: 'b', label: 'B', negative: true, against: [{ who: 'PO', point: 'Faster.' }] }],
    accepts: 'Some debt' })).items[0];
  assert.deepStrictEqual(it.lenses, ['business', 'tech']);
});

test('tabs: a lens-free item keeps no lens, even with code', () => {
  const it = page(plain('debate', { code: { before: 'a', after: 'b' },
    options: [{ value: 'a', label: 'A', recommended: true }, { value: 'no', label: 'No', negative: true, against: [{ who: 'Mechanics', point: 'Testable alone.' }] }] })).items[0];
  assert.doesNotMatch(JSON.stringify(it), /"lens"|"lenses"|"lensTabs"|"bridge"/);
});

test('a tension side carries its trade-off and the constraints it breaks', () => {
  const g = bridgeGate({ tensions: [{ topic: 'Ship a sync too?', lens: 'business', constraints: [{ id: 'K1t', lens: 'business', text: 'Live before the 1 Dec closing', source: 'the human, framing', status: 'confirmed' }], accepts: 'Users download a file for now', sides: [
    { who: 'PO', position: 'Later.', recommended: true, tradeoff: { business: 'One feature at a time' } },
    { who: 'UX', position: 'Now.', tradeoff: { business: 'Users never download' }, violates: ['K1t'] }
  ] }] });
  const t1 = item(page(g), 'T1');
  const ux = t1.options.find(o => o.value === 'UX');
  assert.deepStrictEqual(ux.violates, ['K1t']);
  assert.deepStrictEqual(ux.tradeoff, { business: 'Users never download' });
  assert.deepStrictEqual(ids(t1.bridge), ['K1t']);
  delete g.tensions[0].accepts;
  rejects(g, /tensions\[0\] \("T1"\) recommends an option with a "tradeoff" but has no "accepts"/);
});

test('code per option: each option its own after, a tension side its code, and code counts as tech', () => {
  const it = page(plain('debate', { code: { before: 'a' },
    options: [{ value: 'a', label: 'A', recommended: true, code: { after: 'b' } }, { value: 'b', label: 'B', code: { before: 'z', after: 'c' } }, { value: 'no', label: 'No', negative: true, against: [{ who: 'PO', point: 'Faster.', lens: 'business' }] }] })).items[0];
  assert.deepStrictEqual(it.options.map(o => o.code), [{ after: 'b' }, { before: 'z', after: 'c' }, undefined]);
  assert.strictEqual(it.lensTabs, true);
  const g = bridgeGate({ tensions: [{ topic: 'Rename?', code: { before: 'REQUIRED' }, sides: [
    { who: 'CTO', position: 'Keep.', recommended: true, code: { after: 'ENFORCED' } },
    { who: 'UX', position: 'Describe.', code: { after: 'JOIN_OR_CREATE' } },
    { who: 'PO', position: 'Both.' }] }] });
  assert.deepStrictEqual(item(page(g), 'T1').options.map(o => o.code && o.code.after), ['ENFORCED', 'JOIN_OR_CREATE', undefined, undefined]);
});

test('code per option needs an after, and the item keeps only the shared before', () => {
  rejects(plain('debate', { code: { before: 'a', after: 'b' }, options: [{ value: 'a', label: 'A', code: { after: 'c' } }, { value: 'b', label: 'B' }, { value: 'no', label: 'No', negative: true }] }),
    /has "code.after" and options with their own code/);
  rejects(plain('debate', { options: [{ value: 'a', label: 'A', code: { before: 'c' } }, { value: 'b', label: 'B' }, { value: 'no', label: 'No', negative: true }] }),
    /option "a"\.code must be \{ "after" \}/);
  rejects(plain('debate', { code: 'a → b' }), /\.code must be \{ "before", "after" \} strings/);
});

test('an option carries its own numbers, figures and accepts; a side passes them on', () => {
  const g = bridgeGate({ tensions: [{ topic: 'Rename?', lens: 'tech', accepts: 'One glossary break', sides: [
    { who: 'CTO', position: 'Keep.', recommended: true, tradeoff: { tech: 'Two lines' },
      metrics: [{ label: 'Files touched', before: 0, after: 2 }], figures: [{ svg: '<svg/>', caption: 'Figure 1 — names' }] },
    { who: 'UX', position: 'Describe.', tradeoff: { tech: '63 files' }, accepts: 'Longer names everywhere', metrics: [{ label: 'Files touched', before: 0, after: 63, lens: 'business' }] }] }] });
  const t1 = item(page(g), 'T1');
  assert.strictEqual(t1.options[0].metrics[0].lens, 'tech'); // the item's lens
  assert.strictEqual(t1.options[0].figures[0].caption, 'Figure 1 — names');
  assert.strictEqual(t1.options[1].accepts, 'Longer names everywhere');
  assert.strictEqual(t1.lensTabs, true); // the UX side's business metric
  // The recommended option's own accepts stands in for the item's.
  delete g.tensions[0].accepts; g.tensions[0].sides[0].accepts = 'Two lines of churn';
  assert.strictEqual(item(page(g), 'T1').options[0].accepts, 'Two lines of churn');
  g.tensions[0].sides[1].accepts = 'x'.repeat(161);
  rejects(g, /option "UX"\.accepts is 161 characters \(max 160\)/);
});

test('an item that mentions a figure an option carries passes', () => {
  assert.strictEqual(page(plain('debate', { detail: 'See figure 1', options: [
    { value: 'a', label: 'A', recommended: true, figures: [{ svg: '<svg/>' }] }, { value: 'b', label: 'B' }, { value: 'no', label: 'No', negative: true }] })).items[0].options[0].figures.length, 1);
});

test('an outcome can follow one card\'s answer', () => {
  const g = bridgeGate({ outcome: [
    { view: 'system', caption: 'In-house', after: { svg: '<svg/>' }, on: { id: 'D1', when: ['build'] } },
    { view: 'system', caption: 'Vendor', after: { svg: '<svg/>' }, on: { id: 'D1', when: ['buy'] } }] });
  assert.deepStrictEqual(page(g).outcome.map(o => o.on.when[0]), ['build', 'buy']);
  g.outcome[1].on = { id: 'D1', when: ['lease'] };
  rejects(g, /outcome\[1\]\.on\.when names "lease", not an option of "D1"/);
  g.outcome[1].on = { id: 'D9', when: ['buy'] };
  rejects(g, /outcome\[1\]\.on must be \{ "id", "when": \[option values\] \}/);
});

test('the template follows one option across the evidence pane and stacks three sides', () => {
  const html = composedTemplate();
  assert.ok(html.includes("var pick = el('div', 'optpick')"));
  assert.ok(html.includes('if (c.view.choice !== v) { c.view.choice = v; c.view.shown = null; }'));
  assert.ok(html.includes('drawOutcomes();'));
  assert.ok(html.includes("el('div', 'args' + (it.sides.length > 2 ? ' stack' : ''))"));
  assert.match(html, /\.args\.stack \.argcol \+ \.argcol \{ border-top/);
});

test('lens values are business or tech, on items and entries', () => {
  const a = bridgeGate(); a.decisions[0].lens = 'ux';
  rejects(a, /decisions\[0\] \("D1"\)\.lens must be one of business, tech/);
  const b = bridgeGate(); b.decisions[0].options[2].for[0].lens = 'money';
  rejects(b, /decisions\[0\] option "none"\.for\[0\]\.lens must be one of business, tech/);
});

// C5: the kind sets the default lens, so an unlensed entry of a mixed item no longer needs the item's lens. Only a kind with
// no default (review, refactor) still refuses it. (Replaces "an entry with no lens and none from the item is rejected".)
test('C5: on a debate gate, an unlensed entry of a mixed item reads business and is no longer rejected', () => {
  const g = bridgeGate(); delete g.decisions[0].lens;
  const d1 = item(page(g), 'D1');
  assert.strictEqual(d1.options[2].against[0].lens, 'business');
  assert.strictEqual(d1.options[2].for[0].lens, 'tech');
  const p = bridgeGate({ kind: 'plan', outcome: [{ view: 'ui', caption: 'The screen', after: { svg: '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>' } }] }); delete p.decisions[0].lens;
  p.decisions[0] = argued(Object.assign({}, p.decisions[0], { for: [{ who: 'PO', point: 'Unblocks the three customers waiting on the export' }] }));
  assert.strictEqual(item(page(p), 'D1').options[0].for[0].lens, 'tech');
});

test('C5: the same mixed item on a review gate is still refused', () => {
  const g = bridgeGate({ kind: 'review' }); delete g.decisions[0].lens;
  g.decisions[0] = argued(Object.assign({}, g.decisions[0], { for: [{ who: 'PO', point: 'Unblocks the three customers waiting on the export' }],
    against: [{ who: 'CTO', point: 'Two PDF code paths to keep in sync', lens: 'tech' }] }));
  rejects(g, /option "approve"\.for\[0\] has no lens and its item none to give/);
});

test('constraints need every field, a known lens and status, and one id for identical copies only', () => {
  const a = bridgeGate(); delete a.decisions[0].constraints[0].source;
  rejects(a, /decisions\[0\]\.constraints\[0\] needs "id", "text" and "source"/);
  const b = bridgeGate(); b.decisions[0].constraints[1].lens = 'legal';
  rejects(b, /constraints\[1\] \("K1"\)\.lens must be one of business, tech/);
  const c = bridgeGate(); c.decisions[0].constraints[1].status = 'maybe';
  rejects(c, /constraints\[1\] \("K1"\)\.status must be one of confirmed, assumed, contested/);
  const d = bridgeGate(); d.decisions[0].constraints[0].id = 'K1';
  rejects(d, /constraint "K1" differs/);
});

test('violates names constraints on the item', () => {
  const a = bridgeGate(); a.decisions[0].options[1].violates = ['K9'];
  rejects(a, /decisions\[0\] \("D1"\) option "buy" violates unknown constraint "K9"/);
  const b = bridgeGate(); b.decisions[0].options[1].violates = 'K2';
  rejects(b, /option "buy": "violates" must be an array of constraint ids/);
});

test('tradeoff takes business and/or tech, one line of at most 80 characters each', () => {
  const a = bridgeGate(); a.decisions[0].options[0].tradeoff = {};
  rejects(a, /option "build": "tradeoff" needs "business" and\/or "tech"/);
  const b = bridgeGate(); b.decisions[0].options[0].tradeoff = { tech: 'One new table', ux: 'Fewer clicks' };
  rejects(b, /option "build": tradeoff key "ux" must be one of business, tech/);
  const c = bridgeGate(); c.decisions[0].options[0].tradeoff.tech = 'x'.repeat(81);
  rejects(c, /option "build": tradeoff\.tech is 81 characters \(max 80\)/);
});

test('accepts is required beside a recommended trade-off and holds at most 160 characters', () => {
  const a = bridgeGate(); delete a.decisions[0].accepts;
  rejects(a, /decisions\[0\] \("D1"\) recommends an option with a "tradeoff" but has no "accepts"/);
  const b = bridgeGate(); b.decisions[0].accepts = 'x'.repeat(161);
  rejects(b, /decisions\[0\] \("D1"\)\.accepts is 161 characters \(max 160\)/);
});

test('a recommended option never violates a constraint, whatever its status', () => {
  const swap = status => {
    const g = bridgeGate();
    g.decisions[0].constraints[0].status = status;
    g.decisions[0].options[0].recommended = false;
    g.decisions[0].options[1].recommended = true;
    return g;
  };
  rejects(swap('confirmed'), /decisions\[0\] \("D1"\) option "buy" is recommended but violates K2 — only the human lifts a constraint/);
  rejects(swap('contested'), /option "buy" is recommended but violates K2/);
});

test('a default option never violates a constraint', () => {
  const g = bridgeGate();
  g.decisions.push({ id: 'D2', title: 'Cache the export', minor: true, default: 'cache', constraints: [{ id: 'K3', lens: 'business', text: 'Exports are never cached', source: 'the human', status: 'confirmed' }], options: [
    { value: 'cache', label: 'Cache it', violates: ['K3'] }, { value: 'skip', label: 'Skip' }, { value: 'none', label: 'Neither', negative: true }
  ] });
  rejects(g, /decisions\[1\] \("D2"\) option "cache" is the default but violates K3/);
});

test('--preset reads a choice that lifts a constraint', () => {
  const gate = shareGate();
  gate.decisions[1].constraints = [{ id: 'K9', lens: 'business', text: 'Invoices already sent stay as they are', source: 'the human, framing', status: 'confirmed' }];
  gate.decisions[1].options[1].violates = ['K9'];
  const file = writeGate(gate);
  const preset = path.join(tmpDir('gate-preset-'), 'g.share.txt');
  fs.writeFileSync(preset, 'GATE SHARE — Gate\nF1 = round (lifts K9) | note: finance agreed\n');
  const r = render(file, '--share', '--preset=' + preset);
  assert.strictEqual(r.code, 0, r.stderr);
  const data = pageData(fs.readFileSync(file.replace(/\.gate\.json$/, '.share.html'), 'utf8'));
  assert.deepStrictEqual(data.preset, { F1: { choice: 'round', note: 'finance agreed' } });
});


// The page's own decisionsBlock, loaded from the PROMPT block as render.js --accept-recommended does.
function decisionsBlock(data, state) {
  const src = composedTemplate().match(/\/\*PROMPT-START\*\/([\s\S]*?)\/\*PROMPT-END\*\//)[1];
  return vm.runInNewContext(src + '\ndecisionsBlock;')(data, data.items, state);
}

test('the decisions block marks a lifted constraint, before the note', () => {
  const data = page(bridgeGate());
  assert.match(decisionsBlock(data, { D1: { choice: 'buy', note: 'the vendor hosts it' } }), /^D1 = buy \(lifts K2\) \| note: the vendor hosts it$/m);
  assert.match(decisionsBlock(data, { D1: { choice: 'build' } }), /^D1 = build$/m);
});

test('auto-accept takes the recommendations and never lifts a constraint', () => {
  const r = render(writeGate(bridgeGate()), '--accept-recommended');
  assert.strictEqual(r.code, 0, r.stderr);
  assert.match(r.stdout, /^D1 = build$/m);
  assert.doesNotMatch(r.stdout, /lifts/);
});

test('the page script parses', () => {
  const src = composedTemplate().match(/<script>\n([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new vm.Script(src));
});

const loadEn = html => require('node:vm').runInNewContext(/\/\*CHROME-START\*\/([\s\S]*?)\/\*CHROME-END\*\//.exec(html)[1] + '\n({ CHROME_TEXT: CHROME_TEXT })').CHROME_TEXT;
test('the template draws the bridge; D3: no lens chips, per-card tabs or lens filter outside acceptance', () => {
  const html = composedTemplate();
  // D3: control removed. Acceptance keeps its tab bar (lensTabBar) and the data-lens view rules.
  assert.match(html, /\.card\[data-lens="business"\] \[data-lens="tech"\], \.card\[data-lens="tech"\] \[data-lens="business"\] \{ display: none; \}/);
  assert.ok(html.includes('function lensTabBar('));
  assert.ok(html.includes("g.setAttribute('role', 'group')"));
  assert.ok(!html.includes("lensMark("));
  assert.ok(!html.includes("lens-chips"));
  assert.ok(!html.includes("lc.appendChild("));
  assert.ok(!/\(e\.key === 'b' \|\| e\.key === 't'\) && c && c\.tabs/.test(html));
  { const t = loadEn(html);
    assert.ok(!('filter.lens' in t.en) && !('filter.lens' in t.fr));
    assert.ok(!html.includes("pills(L('filter.lens'), 'lens'")); }
  assert.ok(!html.includes("filters.lens"));
  const { en, fr } = (t => ({ en: t.en, fr: t.fr }))(loadEn(html));
  assert.ok(!('lens.noArgRaised' in en) && !('lens.noArgRaised' in fr)); // D3: control removed
  assert.strictEqual(en['lens.forBusiness'], 'for the business');
  assert.strictEqual(en['lens.forBuild'], 'for the build');
  assert.strictEqual(fr['lens.forBusiness'], 'pour le métier');
  assert.strictEqual(fr['lens.forBuild'], 'pour la réalisation');
  assert.ok(!('ev.recAccepts' in en) && !('ev.recAccepts' in fr), 'the recommended-option label is gone: an option section says it');
  assert.strictEqual(en['ev.accepts'], 'Accepts: ');
  assert.ok(fr['ev.accepts']);
  // A breaking option stays choosable: no strike-through, a badge naming what choosing it lifts.
  assert.strictEqual(en['card.lifts'], 'lifts {ids}');
  assert.ok(fr['card.lifts']);
  assert.ok(html.includes("el('span', 'lift', L('card.lifts', { ids: o.violates.join(', ') }))"));
  assert.doesNotMatch(html, /line-through/);
  assert.ok(html.includes("'<kbd>b</kbd> / <kbd>t</kbd>'"));
});

// D3-1 / D3-2: a DOM run of the page. fakeDom retains the document's key listener, so press() reaches the page's own handler.
async function domRun(html, hash) {
  const dom = fakeDom(html);
  dom.ctx.location.hash = hash;
  vm.createContext(dom.ctx);
  [...html.matchAll(/<script(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g)].forEach(m => vm.runInContext(m[1], dom.ctx));
  for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve));
  return dom;
}
const renderHtml = gate => { const f = writeGate(gate); assert.strictEqual(render(f).code, 0); return fs.readFileSync(f.replace(/\.gate\.json$/, '.html'), 'utf8'); };
const textOf = n => (n.textContent || '') + (n.children || []).map(textOf).join('');
const allNodes = dom => { const out = [], seen = new Set(); (function walk(n) { (Array.isArray(n.children) ? n.children : []).forEach(c => { if (seen.has(c)) return; seen.add(c); out.push(c); walk(c); }); })({ children: dom.roots() }); return out; };

test('D3-1: an old debate gate with lens on cards and entries parses and shows no lens filter, chips or tabs', async () => {
  const html = renderHtml(bridgeGate());
  const dom = await domRun(html, '#d-D1');
  assert.strictEqual(dom.document.querySelectorAll('.lens-chips').length, 0);
  assert.strictEqual(dom.document.querySelectorAll('.lswitch').length, 0);
  const nodes = allNodes(dom);
  assert.ok(!nodes.some(n => n.attrs && n.attrs['aria-label'] === 'Lens'), 'no lens filter group');
  assert.ok(!nodes.some(n => n.attrs && n.attrs.role === 'tablist'));
});

test('D3-1: l, b and t do nothing on a debate gate, and the help lists no lens key', async () => {
  const html = renderHtml(bridgeGate());
  const dom = await domRun(html, '#d-D1');
  const snap = () => JSON.stringify(allNodes(dom).filter(n => typeof n.tagName === 'string').map(n => [String(n.className), typeof n.textContent === 'string' ? n.textContent : '', JSON.stringify(n.attrs || {}), n.hidden === true]));
  const before = snap();
  ['l', 'b', 't', 'b'].forEach(k => { const e = dom.press(k); assert.ok(!e.defaultPrevented, k + ' is not taken'); });
  assert.strictEqual(snap(), before);
  assert.ok(!allNodes(dom).some(n => n.tagName === 'DIALOG' && /<kbd>(l|b)<\/kbd>/.test(n.innerHTML || '')));
});

test('D3-1: a line reads its lens label only where it differs from its card default; trade-off headers always read theirs', async () => {
  const dom = await domRun(renderHtml(bridgeGate()), '#d-D1');
  const labelled = dom.document.querySelectorAll('.klens'), labels = labelled.map(textOf);
  const inTag = tag => labelled.filter(n => n.parentNode.tagName === tag).map(textOf);
  const underClass = cls => labelled.filter(n => String(n.parentNode.className).split(/\s+/).includes(cls)).map(textOf);
  // D1 is a business card: its business argument carries no tag, its tech argument and tech constraint read "for the build".
  assert.deepStrictEqual(labels.filter(t => t === 'for the build').length >= 3, true, labels.join('|')); // K2 and the trade-off header among them
  const heads = inTag('TH');
  assert.deepStrictEqual(heads, ['for the business', 'for the build']);
  const argTags = underClass('who');
  assert.deepStrictEqual(argTags, [], 'a debate page: the arguments shown on tiles carry no lens tag (the coherence pass)');
  const kt = underClass('kt');
  assert.deepStrictEqual(kt, ['for the build']); // K1 (business) on a business card: no tag
});

test('D3-2: an acceptance page keeps its Business / Technical tabs and its l key', async () => {
  const file = writeAcceptance(acceptanceGate());
  assert.strictEqual(render(file).code, 0);
  const html = fs.readFileSync(file.replace(/\.gate\.json$/, '.html'), 'utf8');
  const id = pageData(html).items[0].id;
  const dom = await domRun(html, '#d-' + id);
  assert.ok(dom.document.querySelectorAll('.lswitch').length >= 1);
  const e = dom.press('l');
  assert.ok(e.defaultPrevented, 'l still cycles the lens on acceptance');
});

test('A9: a refactor card with an argued Approve shows For/Against in the pane on Approve, none on Decline, and still decides approve/decline', async () => {
  const g = { kind: 'refactor', title: 'G', decisions: [argued({ id: 'S1', title: 'Extract Function: total', brief: 'Do S1.',
    for: [{ who: 'Safety Net', point: 'Only the silver path is tested.' }], against: [{ who: 'Minimalist', point: 'More code.' }] })] };
  const file = writeGate(g);
  const html = renderHtml(g);
  const data = pageData(html);
  assert.deepStrictEqual(data.items[0].options.map(o => [o.value, o.label]), [['approve', 'Approve'], ['decline', 'Decline']]);
  assert.strictEqual(data.items[0].for, undefined);
  const dom = await domRun(html, '#d-S1');
  const secs = dom.document.querySelectorAll('.osec');
  const byLabel = l => secs.find(n => n.attrs && n.attrs['aria-label'] === l);
  const on = byLabel('Approve'), off = byLabel('Decline');
  assert.ok(on, 'an Approve section in the pane');
  const argText = textOf(on);
  assert.ok(argText.includes('Only the silver path is tested.') && argText.includes('More code.'), argText);
  assert.ok(!off || !textOf(off).includes('silver path'), 'no argument on Decline');
  assert.strictEqual(dom.document.querySelectorAll('.args').length > 0, true);
  const r = render(file, '--accept-recommended');
  assert.strictEqual(r.code, 0, r.stderr);
  assert.match(r.stdout, /S1 = approve/);
});

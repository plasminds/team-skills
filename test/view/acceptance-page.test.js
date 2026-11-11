const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { composedTemplate, render, acceptanceGate, writeAcceptance, fakeDom } = require('./helpers');

const TEMPLATE = composedTemplate();
const region = (name, expose) => vm.runInNewContext(new RegExp('/\\*' + name + '-START\\*/([\\s\\S]*?)/\\*' + name + '-END\\*/').exec(TEMPLATE)[1] + '\n(' + expose + ')');

test('pageMode: an acceptance page decides nothing and opens on the business lens; other kinds are unchanged', () => {
  const pageMode = region('MODE', 'pageMode');
  const a = pageMode('acceptance');
  assert.strictEqual(a.decide, false);
  assert.strictEqual(a.lens, 'business');
  ['1', '9', 'Tab', 'Enter', 'u', 'r', 'n', 'a', 'c', 's', '[', ']'].forEach(k => assert.ok(a.blocked.includes(k), k + ' should do nothing'));
  ['l', 'b', 't', 'e', 'd', '/', '?', 'ArrowDown'].forEach(k => assert.ok(!a.blocked.includes(k), k + ' should still work'));
  ['review', 'refactor', 'debate', 'plan', 'kickoff', 'decision', undefined].forEach(k => {
    assert.deepStrictEqual(JSON.parse(JSON.stringify(pageMode(k))), { decide: true, lens: 'both', blocked: [] });
  });
});

test('chrome: the acceptance labels exist in English and French', () => {
  const chrome = region('CHROME', '{ makeL: makeL }');
  const en = chrome.makeL('en'), fr = chrome.makeL('fr');
  const keys = ['kind.acceptance', 'list.cases', 'section.cases', 'meta.branch', 'card.kindCase', 'case.steps', 'case.expected', 'case.screens', 'case.unshown', 'case.how', 'case.files', 'case.data'];
  keys.forEach(k => { assert.notStrictEqual(en.L(k), k, 'en ' + k); assert.notStrictEqual(fr.L(k), k, 'fr ' + k); });
  assert.strictEqual(fr.L('kind.acceptance'), 'Recette');
  assert.strictEqual(fr.L('case.steps'), 'Ce qu\'on fait');
  assert.strictEqual(en.Lp('list.caseCount', 2), '2 cases');
  assert.strictEqual(fr.Lp('list.caseCount', 2), '2 cas');
});

test('the rendered acceptance page carries the mode, the case card and hides the decision chrome', () => {
  const file = writeAcceptance(acceptanceGate());
  assert.strictEqual(render(file).code, 0);
  const html = fs.readFileSync(file.replace(/\.gate\.json$/, '.html'), 'utf8');
  assert.ok(html.includes('.acceptance-mode .progress'));
  assert.ok(html.includes('function caseCard(it)'));
  assert.ok(html.includes("if (it.kind === 'case') return caseCard(it);"));
  assert.ok(html.includes("classList.add('acceptance-mode')"));
});

// D4: the spec-example label on a case, and the examples no case covers.
const EXS = [
  { id: 'E3', given: 'Three invoices', when: 'Export is pressed', then: 'A CSV lists three rows' },
  { id: 'E4', given: 'No invoice', when: 'Export is pressed', then: 'A message says nothing to export' }
];
const exGate = overrides => acceptanceGate(Object.assign({ lang: 'en', examples: EXS,
  cases: acceptanceGate().cases.map((c, i) => (i === 0 ? Object.assign({}, c, { example: 'E3' }) : c)) }, overrides || {}));
async function domOf(gate) {
  const file = writeAcceptance(gate);
  assert.strictEqual(render(file).code, 0);
  const html = fs.readFileSync(file.replace(/\.gate\.json$/, '.html'), 'utf8');
  const dom = fakeDom(html);
  vm.createContext(dom.ctx);
  [...html.matchAll(/<script(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g)].forEach(m => vm.runInContext(m[1], dom.ctx));
  for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve));
  return dom;
}
const textOf = n => (n.textContent || '') + (n.children || []).map(textOf).join('');
const walkAll = dom => { const out = [], seen = new Set(); (function w(n) { (Array.isArray(n.children) ? n.children : []).forEach(c => { if (seen.has(c)) return; seen.add(c); out.push(c); w(c); }); })({ children: dom.roots() }); return out; };
const byClass = (dom, cls) => walkAll(dom).filter(n => typeof n.tagName === 'string' && String(n.className).split(/\s+/).includes(cls));

test('replayedIds and notReplayed are pure and load with node:vm', () => {
  const r = region('MODE', '{ replayedIds: replayedIds, notReplayed: notReplayed }');
  const cases = [{ example: 'E3' }, {}, { example: 'E3' }];
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r.replayedIds(cases))), ['E3']);
  const ids = list => JSON.parse(JSON.stringify(list.map(e => e.id)));
  assert.deepStrictEqual(ids(r.notReplayed(EXS, cases)), ['E4']);
  assert.strictEqual(r.notReplayed(undefined, cases).length, 0);
  assert.strictEqual(r.notReplayed([], cases).length, 0);
  assert.deepStrictEqual(ids(r.notReplayed(EXS, [])), ['E3', 'E4']);
});

test('chrome: the example labels exist in English and French', () => {
  const chrome = region('CHROME', '{ makeL: makeL }');
  const en = chrome.makeL('en'), fr = chrome.makeL('fr');
  assert.strictEqual(en.L('ex.replays', { id: 'E3' }), 'Example E3 from the specification');
  assert.strictEqual(fr.L('ex.replays', { id: 'E3' }), 'Exemple E3 de la spécification');
  assert.strictEqual(en.L('ex.notReplayed'), 'Examples from the specification that no case on this page covers');
  assert.strictEqual(fr.L('ex.notReplayed'), 'Exemples de la spécification qu\'aucun cas de cette page ne couvre');
  assert.match(en.L('ex.notReplayedNote'), /An observation, nothing to decide/);
  assert.match(fr.L('ex.notReplayedNote'), /Une observation, rien à décider/);
});

test('D4-1: a cited case shows a closed details, its summary the label, its dl the three cells of E3', async () => {
  const dom = await domOf(exGate());
  const reps = byClass(dom, 'replays');
  assert.strictEqual(reps.length, 1);
  assert.strictEqual(reps[0].tagName, 'DETAILS');
  assert.strictEqual(reps[0].open, false);
  const sum = reps[0].children.find(c => c.tagName === 'SUMMARY');
  assert.strictEqual(textOf(sum), 'Example E3 from the specification');
  const dl = reps[0].children.find(c => c.tagName === 'DL');
  assert.deepStrictEqual(dl.children.filter(c => c.tagName === 'DD').map(textOf), ['Three invoices', 'Export is pressed', 'A CSV lists three rows']);
  assert.deepStrictEqual(dl.children.filter(c => c.tagName === 'DT').map(textOf), ['Before', 'What is done', 'After']);
  assert.ok(!textOf({ children: [reps[0]] }).includes('A message says nothing'), 'E4 is not in the case');
});

test('D4-1 FR: the label is French', async () => {
  const dom = await domOf(exGate({ lang: 'fr' }));
  assert.strictEqual(textOf(byClass(dom, 'replays')[0].children.find(c => c.tagName === 'SUMMARY')), 'Exemple E3 de la spécification');
});

test('D4-2: E4, cited by no case, is listed under the heading with its cells; E3 is not; a note says nothing is decided', async () => {
  const dom = await domOf(exGate());
  const blocks = byClass(dom, 'not-replayed');
  assert.strictEqual(blocks.length, 1);
  assert.strictEqual(blocks[0].tagName, 'SECTION');
  const t = textOf(blocks[0]);
  assert.ok(t.includes('Examples from the specification that no case on this page covers'));
  assert.ok(t.includes('E4') && t.includes('No invoice') && t.includes('A message says nothing to export'));
  assert.ok(!t.includes('E3') && !t.includes('Three invoices'));
  assert.ok(t.includes('An observation, nothing to decide'));
});

test('D4-2: with a cover row the block sits in the cover card, after its facts', async () => {
  const dom = await domOf(exGate());
  const cover = walkAll(dom).find(n => n.id === 'd-I0');
  assert.ok(cover, 'the cover card');
  assert.ok(textOf(cover).includes('no case on this page covers'));
  const nested = [cover].concat(walkAll({ roots: () => [cover] }));
  const host = nested.find(n => String(n.className).split(/\s+/).includes('sblock'));
  const kids = host.children.map(n => String(n.className).split(/\s+/));
  assert.ok(kids.findIndex(c => c.includes('facts')) >= 0 && kids.findIndex(c => c.includes('not-replayed')) > kids.findIndex(c => c.includes('facts')), 'after the facts');
  const first = nested.find(n => n.id === 'd-C1');
  assert.ok(!first, 'not in a case');
  assert.strictEqual(byClass(dom, 'not-replayed').length, 1);
});

test('D4-5: both uncited are both listed; no block when every example is cited or none exist', async () => {
  const dom = await domOf(exGate({ cases: acceptanceGate().cases }));
  const t = textOf(byClass(dom, 'not-replayed')[0]);
  assert.ok(t.includes('E3') && t.includes('E4'));
  assert.strictEqual(byClass(dom, 'replays').length, 0);
  const all = await domOf(exGate({ examples: [EXS[0]] }));
  assert.strictEqual(byClass(all, 'not-replayed').length, 0);
  const none = await domOf(acceptanceGate({ lang: 'en' }));
  assert.strictEqual(byClass(none, 'not-replayed').length, 0);
  assert.strictEqual(byClass(none, 'replays').length, 0);
});

test('D4: with no cover row the block is at the top of the cases and the page lands on case 1', async () => {
  const dom = await domOf(exGate({ context: undefined }));
  assert.strictEqual(byClass(dom, 'not-replayed').length, 1);
  const all = walkAll(dom).filter(n => typeof n.tagName === 'string');
  const first = all.find(n => n.id === 'd-C1');
  const scroll = [first].concat(walkAll({ roots: () => [first] })).find(n => String(n.className).split(/\s+/).includes('c-scroll'));
  assert.ok(scroll, 'the first case body');
  assert.ok(String(scroll.children[0].className).includes('not-replayed'), 'the block is the first thing in the first case');
  assert.ok(!all.some(n => /^r-.*sum/i.test(String(n.id))), 'no summary row');
  assert.ok(!all.some(n => n.id === 'd-I0'), 'no cover card');
});

test('D4: the details and the not-replayed block have their style rules', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'skills', 'team-view', 'style.css'), 'utf8');
  assert.match(css, /\.replays\b/);
  assert.match(css, /\.not-replayed\b/);
});

// A9 step 5: the acceptance page takes the debate page's list and pane shell.
async function bootAt(gate, hash, setup) {
  const file = writeAcceptance(gate);
  assert.strictEqual(render(file).code, 0);
  const html = fs.readFileSync(file.replace(/\.gate\.json$/, '.html'), 'utf8');
  const dom = fakeDom(html);
  dom.ctx.location.hash = hash || '';
  if (setup) setup(dom);
  vm.createContext(dom.ctx);
  [...html.matchAll(/<script(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g)].forEach(m => vm.runInContext(m[1], dom.ctx));
  for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve));
  return dom;
}
const SIDE = 'team-view:sidebar:Recette — export';
const sideBtn = (dom, label) => walkAll(dom).filter(n => n.tagName === 'BUTTON' && n.attrs && n.attrs['aria-label'] === label)[0];

test('A9: a cover context row heads the list with its facts; the cases follow in their Rule sections; no summary, no recap', async () => {
  const dom = await bootAt(acceptanceGate({ lang: 'en' }));
  const list = dom.document.getElementById('r-I0').parentNode;
  assert.strictEqual(list.children[0].id, 'r-I0', 'the cover is the first row');
  assert.ok(String(list.children[0].className).includes('ctxrow'));
  const cover = walkAll(dom).find(n => n.id === 'd-I0');
  assert.strictEqual(byClass(dom, 'fact').length, 1, 'its fact');
  assert.ok(textOf(cover).includes('Ce que la branche apporte'));
  const ids = walkAll(dom).map(n => String(n.id));
  assert.ok(ids.includes('r-C1') && ids.includes('r-C2'));
  assert.ok(!ids.includes('r-_recap') && !ids.includes('d-_recap'), 'no recap');
  assert.ok(!ids.some(i => /sum/i.test(i)), 'no summary');
  assert.ok(dom.body.classList.contains('story-page'));
});

test('A9: two list states, no hide button; a stored "closed" opens on the rail', async () => {
  const dom = await bootAt(acceptanceGate({ lang: 'en' }));
  assert.strictEqual(dom.document.querySelectorAll('button[aria-label="Hide the list"]').length, 0, 'no third state');
  sideBtn(dom, 'Narrow the list').click();
  assert.ok(dom.body.classList.contains('side-rail'));
  sideBtn(dom, 'Widen the list').click();
  assert.ok(!dom.body.classList.contains('side-rail'));
  const again = await bootAt(acceptanceGate({ lang: 'en' }), '', d => d.store.set(SIDE, 'closed'));
  assert.ok(again.body.classList.contains('side-rail'));
  assert.ok(!again.body.classList.contains('side-closed'));
});

test('A9: the cover row has nothing for the pane (body.ev-none); a case with evidence has it, e closes and reopens it, [ and ] are not taken', async () => {
  const dom = await bootAt(acceptanceGate({ lang: 'en' }), '#d-I0');
  assert.ok(dom.body.classList.contains('ev-none'), 'nothing for the pane on the cover');
  assert.ok(!dom.press('e').defaultPrevented, 'e does nothing where the pane is absent');
  const c1 = await bootAt(acceptanceGate({ lang: 'en' }), '#d-C1');
  assert.ok(!c1.body.classList.contains('ev-none'));
  assert.ok(!c1.body.classList.contains('ev-closed'));
  assert.ok(c1.press('e').defaultPrevented);
  assert.ok(c1.body.classList.contains('ev-closed'));
  c1.press('e');
  assert.ok(!c1.body.classList.contains('ev-closed'));
  assert.ok(!c1.press('[').defaultPrevented, '[ is not taken');
  assert.ok(!c1.press(']').defaultPrevented, '] is not taken');
  assert.ok(!c1.body.classList.contains('side-rail'), '[ no longer folds the list');
  const pane = walkAll(c1).find(n => n.id === 'ev-C1');
  const kids = pane.children.map(n => String(n.className).split(/\s+/)[0]);
  assert.ok(kids.indexOf('phead') >= 0 && kids.indexOf('lswitch') > kids.indexOf('phead'), 'the lens tabs sit under the head: ' + kids);
});

test('A9: the legend and the help name the evidence pane and no [ ] or z', async () => {
  const dom = await bootAt(acceptanceGate({ lang: 'en' }), '#d-C1');
  const legend = textOf(dom.document.getElementById('legend'));
  assert.ok(/E\s*Evidence pane|E.*evidence/i.test(legend), legend);
  const help = walkAll(dom).find(n => String(n.className) === 'help');
  const h = String(help.innerHTML);
  assert.ok(h.includes('<kbd>e</kbd>'));
  assert.ok(!h.includes('<kbd>[</kbd>') && !h.includes('<kbd>z</kbd>'));
});

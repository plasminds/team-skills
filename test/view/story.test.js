const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');

const { writeGate, render, pageData, cover } = require('./helpers');
const { loadGate } = require('../../skills/team-view/lib/gate');

const ROW = { given: 'a', when: 'b', then: 'c' };

// C1 draws the outcome entry, so a gate whose every card is drawn warns nothing.
function debateGate(overrides) {
  return Object.assign({
    kind: 'debate',
    title: 'Story gate',
    lang: 'en',
    context: [{ id: 'C1', title: 'The screen today', outcome: 0 }],
    decisions: [
      { id: 'D1', title: 'First', examples: [ROW] },
      { id: 'D2', title: 'Second', options: [
        { value: 'a', label: 'A', recommended: true, examples: [ROW] },
        { value: 'b', label: 'B', negative: true }
      ] },
      { id: 'D3', title: 'Third', unillustrated: 'nothing to draw yet' }
    ],
    tensions: [
      { id: 'T1', topic: 'Split?', unillustrated: 'nothing to draw yet', sides: [
        { who: 'A', position: 'Yes.', recommended: true },
        { who: 'B', position: 'No.' }
      ] }
    ],
    outcome: [{ view: 'ui', caption: 'The screen', after: { svg: '<svg viewBox="0 0 10 10"></svg>' } }]
  }, overrides || {});
}

function refused(gate, text) {
  const r = render(writeGate(gate));
  assert.strictEqual(r.code, 1, r.stderr);
  assert.ok(r.stderr.includes(text), `expected "${text}" in:\n${r.stderr}`);
}
const orderOf = gate => loadGate(writeGate(gate), {}).story;

const FULL = ['C1', 'D1', 'D2', 'D3', 'T1'];
const SECTIONS = '"story" is now a list of ids ("C1", "D1", ...): sections { "title", "show" } are no longer read';

test('a valid story renders, and loadGate returns it as the page order', () => {
  const file = writeGate(debateGate({ story: FULL }));
  const r = render(file);
  assert.strictEqual(r.code, 0, r.stderr);
  assert.ok(!r.stderr.includes('warning:'), r.stderr);
  assert.deepStrictEqual(loadGate(file, {}).story, FULL);
});

// Step 3 puts the order on the page (page.story): a gate without a story gets the default one, and no warning.
test('a gate without a story gets the default order on the page and no story warning', () => {
  const file = writeGate(debateGate());
  const r = render(file);
  assert.strictEqual(r.code, 0, r.stderr);
  const page = pageData(fs.readFileSync(file.replace(/\.gate\.json$/, '.html'), 'utf8'));
  assert.deepStrictEqual(page.story, FULL);
  assert.deepStrictEqual(page.context.map(c => c.id), ['C1']);
  assert.ok(!r.stderr.includes('is not in "story"'), r.stderr);
});

test('a page of every deciding kind carries its story order and its context; acceptance carries its context only', () => {
  const file = writeGate({ kind: 'refactor', title: 'R', lang: 'en', decisions: [{ id: 'S1', title: 'Do it', brief: 'Do S1.' }] });
  assert.strictEqual(render(file).code, 0);
  const page = pageData(fs.readFileSync(file.replace(/\.gate\.json$/, '.html'), 'utf8'));
  assert.deepStrictEqual(page.story, ['S1']);
  assert.deepStrictEqual(page.context, []);
  const acc = writeGate({ kind: 'acceptance', title: 'A', lang: 'en', branch: 'b', commit: 'abcdef1', cases: [{ id: 'A1', title: 'x', steps: ['s'], expected: 'e', unshown: 'no screen' }] });
  const ar = render(acc);
  assert.strictEqual(ar.code, 0, ar.stderr);
  const apage = pageData(fs.readFileSync(acc.replace(/\.gate\.json$/, '.html'), 'utf8'));
  assert.ok(!('story' in apage));
  assert.deepStrictEqual(apage.context, []);
});

test('story is refused on acceptance, accepted on every other kind', () => {
  refused(debateGate({ kind: 'acceptance', context: undefined, story: FULL }), '"story" is not read on acceptance gates');
  const plan = render(writeGate(debateGate({ kind: 'plan', story: FULL })));
  assert.strictEqual(plan.code, 0, plan.stderr);
  const council = render(writeGate(debateGate({ kind: 'council', story: FULL })));
  assert.strictEqual(council.code, 0, council.stderr);
});

test('story must be a non-empty array of ids', () => {
  refused(debateGate({ story: [] }), '"story" must be a non-empty array of ids');
  refused(debateGate({ story: 'x' }), '"story" must be a non-empty array of ids');
});

test('old sections { title, show } are refused (ST1-2)', () => {
  refused(debateGate({ story: [{ title: 'Look', show: [{ card: 'D1' }] }] }), SECTIONS);
  refused(debateGate({ story: [{ show: [{ card: 'D1' }], note: 'x' }] }), SECTIONS);
});

test('a story entry is an id string', () => {
  refused(debateGate({ story: ['D1', 3] }), 'story[1] must be an id string');
  refused(debateGate({ story: [null] }), 'story[0] must be an id string');
});

test('an old ref object in the list is refused as a section', () => {
  refused(debateGate({ story: ['D1', { card: 'D2' }] }), SECTIONS);
});

test('a story id names a context row, a decision or a tension', () => {
  refused(debateGate({ story: ['ZZ'] }), 'story[0] "ZZ" is not a context row, a decision or a tension');
  refused(debateGate({ story: ['R1'], rejected: [{ id: 'R1', title: 'No', reason: 'x' }] }), 'story[0] "R1" is not a context row, a decision or a tension');
});

test('a context row is named in the story like a card', () => {
  assert.deepStrictEqual(orderOf(debateGate({ story: ['D1', 'C1', 'D2', 'D3', 'T1'] })), ['D1', 'C1', 'D2', 'D3', 'T1']);
});

test('a minor item is refused in the story: it stays in its own section', () => {
  const gate = debateGate({ story: ['C1', 'M1'] });
  gate.decisions.push({ id: 'M1', title: 'Minor', minor: true, default: 'approve' });
  refused(gate, 'story[1] "M1" is a minor item: minor items stay in their own section');
});

test('an id named twice is refused', () => {
  refused(debateGate({ story: ['D1', 'D2', 'D1'] }), 'story[2] "D1" is named twice');
});

test('a context row the story leaves out is not appended', () => {
  assert.deepStrictEqual(orderOf(debateGate({ story: ['D1', 'D2', 'D3', 'T1'] })), ['D1', 'D2', 'D3', 'T1']);
});

test('a card the story leaves out gets a warning, exit code unchanged', () => {
  const r = render(writeGate(debateGate({ story: ['C1', 'D1', 'D2', 'T1'] })));
  assert.strictEqual(r.code, 0, r.stderr);
  assert.ok(r.stderr.includes('warning: D3 is not in "story": it is listed after the story\'s ids'), r.stderr);
  assert.ok(!r.stderr.includes('D1 is not in "story"'), r.stderr);
});

// The story on the page (C3, C4, A2): a DOM run of the composed page, fakeDom from helpers.js.
const vm = require('node:vm');
const { fakeDom, composedTemplate } = require('./helpers');

const K2 = { id: 'K2', lens: 'tech', text: 'No new database in production', source: 'CLAUDE.md:12', status: 'confirmed' };
// D1 has a recommended option and one that breaks K2; D3 hangs on D2 and is moot once D2 is "b".
function domGate(story, overrides) {
  return Object.assign({
    kind: 'debate', title: 'Story DOM', lang: 'en',
    ...cover([{ label: 'Direction', text: 'Do it.' }], { outcome: 0 }),
    decisions: [
      { id: 'D1', title: 'Build or buy?', constraints: [K2], options: [
        { value: 'build', label: 'Build', recommended: true },
        { value: 'buy', label: 'Buy', violates: ['K2'] },
        { value: 'none', label: 'Neither', negative: true }
      ] },
      { id: 'D2', title: 'Where?', examples: [ROW], options: [{ value: 'a', label: 'Here', recommended: true }, { value: 'b', label: 'There', negative: true }] },
      { id: 'D3', title: 'Charge?', on: { id: 'D2', when: ['a'] }, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No', recommended: true }, { value: 'none', label: 'Not now', negative: true }] }
    ],
    outcome: [{ view: 'ui', caption: 'The screen', after: { svg: '<svg viewBox="0 0 10 10"></svg>' } }]
  }, story ? { story } : {}, overrides || {});
}
const STORY3 = ['D1', 'D2', 'D3'];

function htmlOf(gate) {
  const f = writeGate(gate);
  const r = render(f);
  assert.strictEqual(r.code, 0, r.stderr);
  return fs.readFileSync(f.replace(/\.gate\.json$/, '.html'), 'utf8');
}
async function boot(html, hash, setup) {
  const dom = fakeDom(html);
  dom.ctx.location.hash = hash || '';
  if (setup) setup(dom);
  dom.copied = [];
  dom.ctx.navigator.clipboard.writeText = t => { dom.copied.push(t); return Promise.resolve(); };
  vm.createContext(dom.ctx);
  [...html.matchAll(/<script(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g)].forEach(m => vm.runInContext(m[1], dom.ctx));
  for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve));
  return dom;
}
const textOf = n => (n.textContent || '') + (n.children || []).map(textOf).join('');
const at = dom => { const r = dom.replaced[dom.replaced.length - 1]; return r && r[2]; };
// The decide bar's option row: a debate card's tiles carry pick buttons of their own (step 4).
const cardOpts = (dom, id) => dom.document.getElementById('d-' + id).querySelectorAll('.options')[0].querySelectorAll('.opt');

test('the card option row: one button per option, numbered, with its marks, in a labelled group', async () => {
  const dom = await boot(htmlOf(domGate()), '#d-D1');
  const bs = cardOpts(dom, 'D1');
  assert.deepStrictEqual(bs.map(b => b.dataset.value), ['build', 'buy', 'none']);
  bs.forEach((b, i) => {
    assert.strictEqual(textOf(b.querySelectorAll('.k')[0]), String(i + 1));
    assert.strictEqual(b.querySelectorAll('.ck').length, 1);
    assert.strictEqual(b.querySelectorAll('.yc').length, 1);
    assert.strictEqual(b.getAttribute('aria-pressed'), 'false');
  });
  assert.deepStrictEqual(bs.map(b => textOf(b.querySelectorAll('.ol')[0])), ['Build', 'Buy', 'Neither']);
  assert.strictEqual(bs[0].querySelectorAll('.rectag').length, 1);
  assert.strictEqual(bs[1].querySelectorAll('.rectag').length, 0);
  assert.strictEqual(textOf(bs[1].querySelectorAll('.lift')[0]), 'lifts K2');
  assert.match(bs[1].title, /^Breaks K2/);
  const group = bs[0].parentNode;
  assert.strictEqual(group.getAttribute('role'), 'group');
  assert.strictEqual(group.getAttribute('aria-label'), 'Decision for D1');
});

test('recapRows: the pure part, run alone through the region markers', () => {
  const src = composedTemplate().match(/\/\*STORY-START\*\/([\s\S]*?)\/\*STORY-END\*\//)[1];
  const ctx = {}; vm.createContext(ctx); vm.runInContext(src, ctx);
  const plain = x => JSON.parse(JSON.stringify(x)); // arrays from the vm realm
  const items = [
    { id: 'D1', kind: 'decision', title: 'A?', options: [{ value: 'x', label: 'X', recommended: true }, { value: 'y', label: 'Y' }], examples: [ROW] },
    { id: 'T1', kind: 'tension', title: 'B?', options: [{ value: 'p', label: 'P' }] },
    { id: 'R1', kind: 'rejected', title: 'C', options: [] }
  ];
  const rows = ctx.recapRows(items, { D1: { choice: 'y' } }, it => (it.id === 'T1' ? { id: 'D1' } : null));
  assert.deepStrictEqual(plain(rows.map(r => [r.id, r.title, r.rec, r.choice, r.status])), [['D1', 'A?', 'X', 'Y', 'decided'], ['T1', 'B?', null, null, 'moot']]);
  assert.deepStrictEqual(plain(ctx.recapRows(items, {}, () => null).map(r => r.status)), ['open', 'open']);
});

test('C3-3: #d-D2 opens D2, whatever the story', async () => {
  const dom = await boot(htmlOf(domGate(STORY3)), '#d-D2');
  assert.strictEqual(at(dom), '#d-D2');
});

// Step 3, the page: the left list follows the story order, context rows and the recap row (D1, ST1, ST5, K12, A2).
const rowIds = dom => dom.document.querySelectorAll('.row').map(r => r.id.replace(/^r-/, ''));
// A row's depth, as drawn: the left of its status node (fakeDom keeps no style property set through setProperty).
const nodeX = (dom, id) => Number(/class="node" style="left:(\d+)px/.exec(dom.document.getElementById('r-' + id).children[0].innerHTML)[1]);
const opts2 = (extra) => Object.assign({ unillustrated: 'not drawn here', options: [{ value: 'a', label: 'A', recommended: true }, { value: 'b', label: 'B' }, { value: 'none', label: 'None', negative: true }] }, extra || {});
// D1-1: a cover, two context rows, Q1-Q6, Q5 needing Q3; no story given.
function deckGate(overrides) {
  return Object.assign({
    kind: 'debate', title: 'Deck', lang: 'en',
    context: [{ id: 'COVER', title: 'Cover words', why: 'What is at stake.' }, { id: 'CTXA', title: 'Today' }, { id: 'CTXB', title: 'The numbers', metrics: [{ label: 'Users', value: 12, unit: 'k' }] }],
    decisions: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'].map(id => Object.assign({ id, title: 'Question ' + id }, opts2(id === 'Q5' ? { after: ['Q3'] } : {})))
  }, overrides || {});
}
const DECK = ['COVER', 'CTXA', 'CTXB', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', '_recap'];

test('D1-1: a debate page opens on its cover; the list reads cover, context rows, Q1-Q6, then the recap', async () => {
  const dom = await boot(htmlOf(deckGate()));
  assert.strictEqual(at(dom), '#d-COVER');
  assert.deepStrictEqual(rowIds(dom), DECK);
  assert.strictEqual(dom.document.querySelectorAll('.sec').length, 0, 'no section heading above the story');
  const cover = dom.document.getElementById('r-COVER');
  assert.strictEqual(cover.tagName, 'BUTTON');
  assert.ok(textOf(cover).includes('COVER') && textOf(cover).includes('Cover words'));
  assert.strictEqual(cover.querySelectorAll('.stw').length, 0, 'a context row has no status word');
  assert.strictEqual(cover.getAttribute('aria-current'), 'true');
  const card = dom.document.getElementById('d-COVER');
  assert.ok(textOf(card).includes('What is at stake.'));
  const region = card.querySelectorAll('.c-main')[0];
  assert.strictEqual(region.getAttribute('role'), 'region');
  assert.ok(textOf(dom.document.getElementById('d-CTXB')).includes('Users'));
});

test('D1-2: a council gate with a cover and no story opens on its cover, no summary row', async () => {
  const dom = await boot(htmlOf(domGate(null, { kind: 'council' })));
  assert.strictEqual(at(dom), '#d-I0');
  assert.ok(!dom.ids.has('r-_summary') && !dom.ids.has('d-_summary'));
  assert.deepStrictEqual(rowIds(dom), ['I0', 'D1', 'D2', 'D3', '_recap']);
  dom.press('z');
  assert.strictEqual(at(dom), '#d-I0', 'z does nothing on a deciding page');
});

test('ST1-3: context rows are never counted, decided or written', async () => {
  const file = writeGate(deckGate());
  const acc = render(file, '--accept-recommended');
  assert.strictEqual(acc.code, 0, acc.stderr);
  assert.ok(!/^(COVER|CTXA|CTXB)\b/m.test(acc.stdout) && !acc.stdout.includes('Cover words'), acc.stdout);
  const dom = await boot(fs.readFileSync(file.replace(/\.gate\.json$/, '.html'), 'utf8'));
  assert.ok(textOf(dom.document.getElementById('ptxt')).includes('0 of 6'));
  dom.press('u');
  assert.strictEqual(at(dom), '#d-Q1');
  dom.document.getElementById('copy').click();
  for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(dom.copied.length, 1);
  assert.ok(!/^(COVER|CTXA|CTXB)\b/m.test(dom.copied[0]) && !dom.copied[0].includes('Cover words'), dom.copied[0]);
});

test('ST5-1: the list and j/k follow the story order, the recap last', async () => {
  const gate = debateGate({ story: ['C1', 'D1', 'T1', 'D2'] });
  gate.decisions = gate.decisions.filter(d => d.id !== 'D3');
  gate.tensions[0].id = 'T1';
  const dom = await boot(htmlOf(gate));
  assert.deepStrictEqual(rowIds(dom), ['C1', 'D1', 'T1', 'D2', '_recap']);
  assert.strictEqual(at(dom), '#d-C1');
  const seen = [];
  for (let i = 0; i < 4; i++) { dom.press('j'); seen.push(at(dom)); }
  assert.deepStrictEqual(seen, ['#d-D1', '#d-T1', '#d-D2', '#d-_recap']);
  dom.press('k');
  assert.strictEqual(at(dom), '#d-D2');
});

test('ST5-2: cards of different groups placed together keep the story order, under no heading', async () => {
  const gate = domGate(['D2', 'D3', 'D1']);
  gate.decisions[0].group = 'Build';
  gate.decisions[1].group = 'Place';
  const dom = await boot(htmlOf(gate));
  assert.deepStrictEqual(rowIds(dom), ['D2', 'D3', 'D1', '_recap']);
  assert.strictEqual(dom.document.querySelectorAll('.sec').length, 0);
});

test('ST5-3: a minor card refining a story card has one row, nested under its root, absent from Minor items', async () => {
  const gate = domGate(STORY3);
  gate.decisions.push({ id: 'M1', title: 'Name it?', minor: true, default: 'a', on: { id: 'D2' }, options: [{ value: 'a', label: 'A', recommended: true }, { value: 'b', label: 'B' }, { value: 'none', label: 'Neither', negative: true }] });
  gate.decisions.push({ id: 'M2', title: 'Colour?', minor: true, default: 'a', options: [{ value: 'a', label: 'A', recommended: true }, { value: 'b', label: 'B' }, { value: 'none', label: 'Neither', negative: true }] });
  const dom = await boot(htmlOf(gate), '#d-D3');
  assert.deepStrictEqual(rowIds(dom), ['D1', 'D2', 'D3', 'M1', 'M2', '_recap']);
  assert.strictEqual(nodeX(dom, 'M1'), nodeX(dom, 'D3'), 'M1 sits at its root\'s refinement depth');
  assert.ok(nodeX(dom, 'M1') > nodeX(dom, 'D2'));
  assert.deepStrictEqual(dom.document.querySelectorAll('.gname').map(textOf), ['Minor items']);
  dom.press('j');
  assert.strictEqual(at(dom), '#d-M1');
  assert.ok(/ of 5$/.test(textOf(dom.document.getElementById('ptxt'))), textOf(dom.document.getElementById('ptxt')));
});

test('K12 on the page: a refinement hangs under its parent on a solid rail; a needing card is not nested and reads "needs"', async () => {
  const dom = await boot(htmlOf(deckGate({ decisions: deckGate().decisions.concat([Object.assign({ id: 'Q7', title: 'Refines Q2', on: { id: 'Q2' } }, opts2())]) })));
  assert.deepStrictEqual(rowIds(dom), ['COVER', 'CTXA', 'CTXB', 'Q1', 'Q2', 'Q7', 'Q3', 'Q4', 'Q5', 'Q6', '_recap']);
  const row = id => dom.document.getElementById('r-' + id);
  const rails = id => row(id).children[0].innerHTML;
  assert.ok(/class="rh[" ]/.test(rails('Q7')) && !rails('Q7').includes('rh after'), rails('Q7'));
  assert.strictEqual(nodeX(dom, 'Q5'), nodeX(dom, 'Q1'));
  assert.ok(nodeX(dom, 'Q7') > nodeX(dom, 'Q2'));
  assert.ok(!rails('Q5').includes('class="rh'), rails('Q5'));
  assert.ok(/Needs\s*Q3\s*first/.test(textOf(row('Q5'))), textOf(row('Q5')));
});

test('A2-R: the recap row lists each pick against the recommendation, with Copy; a question title opens its card', async () => {
  const dom = await boot(htmlOf(domGate(STORY3)), '#d-D1');
  const recapText = () => dom.document.querySelectorAll('.recap')[0].querySelectorAll('.recap-q').map(b => b.parentNode.parentNode).map(textOf);
  dom.document.getElementById('r-_recap').click();
  assert.strictEqual(at(dom), '#d-_recap');
  assert.deepStrictEqual(recapText(), ['D1Build or buy?BuildTo decide', 'D2Where?HereTo decide', 'D3Charge?NoTo decide']);
  cardOpts(dom, 'D1')[1].click();
  cardOpts(dom, 'D2')[1].click();
  assert.deepStrictEqual(recapText(), ['D1Build or buy?BuildBuy', 'D2Where?HereThere', 'D3Charge?NoNot needed']);
  const links = dom.document.querySelectorAll('.recap-q');
  assert.strictEqual(links[1].tagName, 'BUTTON');
  assert.strictEqual(links[1].getAttribute('aria-label'), 'Open card D2: Where?');
  const region = dom.document.getElementById('d-_recap').querySelectorAll('.c-main')[0];
  assert.strictEqual(region.getAttribute('role'), 'region');
  dom.document.querySelectorAll('.story-copy')[0].click();
  for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(dom.copied.length, 1);
  links[1].click();
  assert.strictEqual(at(dom), '#d-D2');
});

test('a filter hides the context rows and the recap row', async () => {
  const dom = await boot(htmlOf(deckGate()));
  const search = dom.document.getElementById('find').children[0];
  search.value = 'Q1';
  search.listeners.input.forEach(f => f({}));
  assert.ok(dom.document.getElementById('r-COVER').hidden && dom.document.getElementById('r-_recap').hidden);
  assert.ok(!dom.document.getElementById('r-Q1').hidden);
  search.value = '';
  search.listeners.input.forEach(f => f({}));
  assert.ok(!dom.document.getElementById('r-COVER').hidden && !dom.document.getElementById('r-_recap').hidden);
});

test('storyRows: the pure order, refinements nested, minor refiners placed under their root', () => {
  const src = composedTemplate().match(/\/\*STORY-START\*\/([\s\S]*?)\/\*STORY-END\*\//)[1];
  const ctx = {}; vm.createContext(ctx); vm.runInContext(src, ctx);
  const items = [
    { id: 'D1', kind: 'decision' }, { id: 'D2', kind: 'decision' }, { id: 'D3', kind: 'decision', on: { id: 'D2' } },
    { id: 'M1', kind: 'decision', minor: true, on: { id: 'D2' } }, { id: 'M2', kind: 'decision', minor: true }
  ];
  const rows = ctx.storyRows({ story: ['C1', 'D2', 'D3', 'D1'], context: [{ id: 'C1', title: 'c' }] }, items);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(rows)), [
    { id: 'C1', context: true, depth: 0, parent: null, kind: null },
    { id: 'D2', context: false, depth: 0, parent: null, kind: null },
    { id: 'D3', context: false, depth: 1, parent: 'D2', kind: 'on' },
    { id: 'M1', context: false, depth: 1, parent: 'D2', kind: 'on', minor: true },
    { id: 'D1', context: false, depth: 0, parent: null, kind: null }
  ]);
});

// Step 4, the card in story mode: the story block (stake line, key numbers, drawing, "On the question") and one tile
// per option (figure, label, cost line, Breaks line, 2 pros and 2 cons, pick button), on every card kind (D1-D7, S4, SK, T1).
const sfig = t => ({ title: t, svg: '<svg viewBox="0 0 10 10"><text>' + t + '</text></svg>' });
const arg = (who, point) => ({ who, point });
const K4 = { id: 'K4', lens: 'business', text: 'Each option keeps its pros and cons beside the choice', source: 'PRODUCT.md:33', status: 'confirmed' };
const two = [{ value: 'a', label: 'Yes', recommended: true }, { value: 'b', label: 'No', negative: true }];
function cardGate() {
  return {
    kind: 'debate', title: 'Cards', lang: 'en',
    context: [
      { id: 'COVER', title: 'Where we stand', why: 'Three numbers say it.', metrics: [
        { label: 'Read', after: 20, unit: '%', key: true }, { label: 'Kept', after: 88, unit: '%', key: true }, { label: 'Done', after: 96, unit: '%', key: true }] },
      { id: 'SCREEN', title: 'The screen today', outcome: 2 }
    ],
    decisions: [
      { id: 'D1', title: 'How should each question card open?', why: 'The first screen decides the meeting.', figures: [sfig('Card drawing')],
        metrics: [
          { label: 'Time to choose', before: 40, after: 20, key: true }, { label: 'Pages', after: 7, key: true },
          { label: 'Cards', value: 9, unit: 'k', key: true }, { label: 'Roles', value: 4, unit: 'k', key: true },
          { label: 'Gates', value: 3, unit: 'k', key: true }, { label: 'Hidden', value: 1, unit: 'k' }, { label: 'Later', after: 5 }
        ],
        options: [
          { value: 'a', label: 'Detail first', for: [arg('CTO', 'A keeps the evidence near.')], figures: [sfig('A')] },
          { value: 'b', label: 'Story first', recommended: true, for: [arg('PO', 'B reads from afar.'), arg('UX', 'B shows one thing.')], figures: [sfig('B')] },
          { value: 'drop', label: 'Drop this question', negative: true, for: [arg('Philosopher', 'The question answers itself.'), arg('CTO', 'Q con one.')], against: [arg('PO', 'Q pro one.'), arg('UX', 'Q pro two.'), arg('CTO', 'Q pro three.')] }
        ] },
      { id: 'D2', title: 'Which layout?', constraints: [K4], unillustrated: 'tiles only', options: [
        { value: 'a', label: 'One column', tradeoff: { business: 'Costs a scroll' }, violates: ['K4'], for: [arg('PO', 'p1'), arg('UX', 'p2'), arg('CTO', 'p3')] },
        { value: 'b', label: 'Two columns', recommended: true, tradeoff: { tech: 'A grid rule' }, accepts: 'One more grid rule.', figures: [sfig('Grid')] },
        { value: 'c', label: 'Three columns' }, { value: 'd', label: 'Free' }, { value: 'none', label: 'Keep it as is', negative: true }
      ] },
      { id: 'D3', title: 'Keep notes?', unillustrated: 'a yes or no', options: two },
      { id: 'D4', title: 'Where do notes go?', unillustrated: 'a place', on: { id: 'D3', when: ['a'] }, options: [{ value: 'a', label: 'Bar', recommended: true }, { value: 'b', label: 'Card' }, { value: 'none', label: 'Nowhere', negative: true }] },
      { id: 'D5', title: 'Bare?', options: two }
    ],
    tensions: [{ id: 'T1', topic: 'Split the page?', unillustrated: 'two views', sides: [
      { who: 'PO', position: 'Split it.', recommended: true, for: [arg('PO', 'Split pro.')], against: [arg('CTO', 'Split con.')] },
      { who: 'CTO', position: 'Keep one page.' }
    ] }],
    settled: [{ id: 'S1', title: 'Which font?', answer: 'System fonts.', source: 'DESIGN.md:12', who: 'UX' }],
    questions: [{ id: 'QA', title: 'Why a grid?', source: 'style.css:12', who: 'CTO' }],
    rejected: [{ id: 'R1', title: 'Slides', reason: 'Too heavy.' }],
    outcome: [
      { view: 'ui', caption: 'One', after: { svg: '<svg viewBox="0 0 10 10"></svg>' } },
      { view: 'ui', caption: 'Two', after: { svg: '<svg viewBox="0 0 10 10"></svg>' } },
      { view: 'ui', caption: 'Before and after', before: { svg: '<svg viewBox="0 0 10 10"><text>old</text></svg>' }, after: { svg: '<svg viewBox="0 0 10 10"><text>new</text></svg>' } }
    ]
  };
}
let cardHtml = null;
const cardPage = hash => boot(cardHtml = cardHtml || htmlOf(cardGate()), hash);
const q = (n, sel) => n.querySelectorAll(sel);
const one = (n, sel) => n.querySelectorAll(sel)[0];
const cls = n => String(n.className).split(/\s+/);
const sblockOf = (dom, id) => one(dom.document.getElementById('d-' + id), '.sblock');
const rowsOf = (dom, id) => q(dom.document.getElementById('d-' + id), '.orow');
const mainOf = (dom, id) => one(dom.document.getElementById('d-' + id), '.c-main');
// fakeDom matches class selectors only, and an icon reads as junk text: a point is the last child of its .arg.
const pointOf = a => textOf(a.children[a.children.length - 1]);
const lastText = n => textOf(n.children[n.children.length - 1]);
const kidsOf = n => n.children || [];
const path = require('node:path');
const cssText = () => fs.readFileSync(path.join(__dirname, '../../skills/team-view/style.css'), 'utf8');
// A6 (2026-11-11): the evidence pane of a debate card, always shown; its picker, one section per option, then the whole question.
const paneOf = (dom, id) => dom.document.getElementById('ev-' + id);
const secsOf = (dom, id) => q(paneOf(dom, id), '.osec');
const shownSecs = (dom, id) => secsOf(dom, id).filter(x => !x.hidden).map(x => x.getAttribute('aria-label'));
const pickBtns = (dom, id) => kidsOf(one(paneOf(dom, id), '.oseg'));
const marks = (dom, id) => rowsOf(dom, id).map(r => !one(r, '.oshown').hidden);
const tabOf = dom => dom.document.querySelector('.layout').dataset.tab;
const NOTHING = 'Nothing more on this row.';
const OLD_MODE_KEY = 'team-view:card:Cards';
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
// A matchMedia whose "(max-width: 760px)" query reports `narrow`.
function narrowMedia(dom, narrow) {
  const m = { matches: narrow, fire: [] };
  dom.ctx.matchMedia = qy => (/max-width/.test(qy) ? Object.assign(m, { addEventListener: (t, f) => { if (t === 'change') m.fire.push(f); }, addListener() {} }) : { matches: false, addEventListener() {}, addListener() {} });
  return m;
}
const bootWith = (hash, setup) => boot(cardHtml = cardHtml || htmlOf(cardGate()), hash, setup);
const opt = (value, label, extra) => Object.assign({ value, label }, extra);
const gateOf = decisions => Object.assign(cardGate(), { decisions, tensions: [], settled: [], questions: [], rejected: [] });

test('a debate page is a story page with one layout; the block sits right after the heading', async () => {
  const dom = await cardPage('#d-D1');
  assert.ok(dom.body.classList.contains('story-page'));
  assert.strictEqual(dom.body.dataset.card, undefined, 'no card mode');
  const scroll = one(dom.document.getElementById('d-D1'), '.c-scroll');
  assert.ok(cls(scroll.children[0]).includes('ch'));
  assert.ok(cls(scroll.children[1]).includes('sblock'));
});

test('D4-1, D5-3, ST1-1, D3-1: the title is the headline, the stake line moves into the block, 3 key numbers, the drawing; the option rows sit in the decide bar, no question-level block', async () => {
  const dom = await cardPage('#d-D1');
  const card = dom.document.getElementById('d-D1'), sb = sblockOf(dom, 'D1');
  assert.strictEqual(textOf(one(card, '.ctitle')), 'How should each question card open?');
  assert.ok(textOf(dom.document.getElementById('r-D1')).includes('How should each question card open?'));
  assert.strictEqual(q(card, '.lead').length, 1, 'the stake line shows once');
  assert.strictEqual(textOf(one(sb, '.lead')), 'The first screen decides the meeting.');
  const kn = q(sb, '.knum');
  assert.strictEqual(kn.length, 3, '5 key metrics: 3 shown large');
  assert.strictEqual(textOf(one(kn[0], '.kv')), '40 → 20', 'before, an arrow, after');
  assert.strictEqual(textOf(one(kn[0], '.kbef')), '40');
  assert.strictEqual(textOf(one(kn[0], '.kaft')), '20');
  assert.strictEqual(q(kn[0], '.kw').length, 0, 'no "was" line');
  assert.strictEqual(textOf(one(kn[0], '.kl')), 'Time to choose');
  assert.strictEqual(textOf(one(kn[1], '.kv')), '7');
  assert.strictEqual(q(kn[1], '.kbef').length + q(kn[1], '.karr').length, 0, 'a single value alone');
  assert.strictEqual(textOf(one(kn[2], '.kv')), '9 k');
  const kids = sb.children.map(c => cls(c).find(k => ['lead', 'gev', 'knums', 'sdraw', 'sq', 'tmoot', 'tiles', 'orows'].includes(k)));
  assert.deepStrictEqual(kids, ['lead', 'knums', 'sdraw'], 'the block ends with the drawing');
  assert.ok(textOf(one(sb, '.sdraw')).includes('Card drawing'));
  assert.strictEqual(q(sb, '.sq').length, 0, 'no block on the question');
  assert.ok(one(one(card, '.c-decide'), '.orows'), 'the option rows are in the decide bar');
  const neg = secsOf(dom, 'D1')[2];
  assert.deepStrictEqual(q(neg, '.arg').map(pointOf), ['The question answers itself.', 'Q con one.', 'Q pro one.', 'Q pro two.', 'Q pro three.']);
});

test('D6-1, A6: one row per option in a labelled group; each option\'s arguments, with role chips, sit in its own pane section', async () => {
  const dom = await cardPage('#d-D1');
  const card = dom.document.getElementById('d-D1'), rows = rowsOf(dom, 'D1'), g = one(card, '.orows');
  assert.strictEqual(g.getAttribute('role'), 'group');
  assert.strictEqual(g.getAttribute('aria-label'), 'Decision for D1');
  assert.strictEqual(rows.length, 3);
  const secs = secsOf(dom, 'D1');
  assert.deepStrictEqual(secs.map(s => s.getAttribute('aria-label')), ['Detail first', 'Story first', 'Drop this question']);
  assert.deepStrictEqual(secs.map(s => q(s, '.arg').map(a => textOf(one(a, '.chip')))), [['CTO'], ['PO', 'UX'], ['Philosopher', 'CTO', 'PO', 'UX', 'CTO']]);
  assert.strictEqual(q(mainOf(dom, 'D1'), '.arg').length + q(mainOf(dom, 'D1'), '.argcol').length, 0, 'no argument in the card');
  assert.ok(textOf(one(rows[2], '.ol')).includes('Drop this question'));
  assert.strictEqual(textOf(one(rows[1], '.rectag')), 'Recommended', 'the Recommended tag is in the row');
  assert.strictEqual(q(rows[0], '.rectag').length, 0);
  assert.strictEqual(q(g, '.sdraw').length, 0, 'no figure in a row');
  assert.deepStrictEqual(q(secs[0], '.eh').map(textOf), ['Figures'], 'the option\'s figure is in its section');
  const p = one(rows[1], '.opick');
  assert.strictEqual(p.tagName, 'BUTTON');
  assert.strictEqual(p.getAttribute('aria-pressed'), 'false');
  assert.strictEqual(textOf(one(p, '.k')), '2');
  assert.ok(textOf(p).includes('Story first'));
});

test('a pick on a row chooses, presses the bar button too, marks the row chosen; a click elsewhere on a row picks it too', async () => {
  const dom = await cardPage('#d-D1');
  const rows = rowsOf(dom, 'D1'), p = one(rows[1], '.opick');
  p.click();
  assert.strictEqual(p.getAttribute('aria-pressed'), 'true');
  assert.ok(rows[1].classList.contains('chosen') && !rows[0].classList.contains('chosen'));
  assert.strictEqual(cardOpts(dom, 'D1')[1].getAttribute('aria-pressed'), 'true');
  const saved = [...dom.store.values()].map(v => { try { return JSON.parse(v); } catch (e) { return null; } }).find(v => v && v.D1);
  assert.strictEqual(saved.D1.choice, 'b');
  rows[0].click();
  assert.ok(rows[0].classList.contains('chosen') && !rows[1].classList.contains('chosen'));
});

test('the negative option is an ordinary last row, its section holds the flipped arguments, and Copy decisions names it', async () => {
  const dom = await cardPage('#d-D1');
  const rows = rowsOf(dom, 'D1');
  assert.strictEqual(q(dom.document.getElementById('d-D1'), '.sq').length, 0, 'no block on the question');
  assert.deepStrictEqual(rows.map(t => t.classList.contains('neg')), [false, false, true]);
  assert.ok(textOf(one(rows[2], '.ol')).includes('Drop this question'));
  const heads = q(secsOf(dom, 'D1')[2], '.argcol').map(c => textOf(c.children[0]));
  assert.ok(heads[0].includes('For') && heads[1].includes('Against'), heads.join('|'));
  one(rows[2], '.opick').click();
  dom.document.getElementById('copy').click();
  await settle();
  assert.match(dom.copied[0], /^D1 = drop\b/m);
});

test('a negative option listed first is shown as the last row, and picking it writes its own id', async () => {
  const dom = await boot(htmlOf(gateOf([
    { id: 'D1', title: 'Order', unillustrated: 'x', options: [{ value: 'no', label: 'Nope', negative: true }, { value: 'a', label: 'A', recommended: true, for: [arg('CTO', 'A is cheap.')] }, { value: 'b', label: 'B' }] }
  ])), '#d-D1');
  const rows = rowsOf(dom, 'D1');
  assert.deepStrictEqual(rows.map(t => cls(t).includes('neg')), [false, false, true]);
  assert.ok(textOf(one(rows[2], '.ol')).includes('Nope'));
  one(rows[2], '.opick').click();
  dom.document.getElementById('copy').click();
  await settle();
  assert.match(dom.copied[0], /^D1 = no\b/m);
});

test('Tab cycles the rows\' pick buttons, from the recommended one', async () => {
  const dom = await cardPage('#d-D1');
  dom.press('Tab');
  const ae = dom.document.activeElement;
  assert.ok(ae && cls(ae).includes('opick') && ae.dataset.value === 'b', ae && ae.className);
  dom.press('Tab');
  assert.strictEqual(dom.document.activeElement.dataset.value, 'drop');
});

test('S4-1, D6-2, D6-3, A6: every row has one shape, with or without arguments; a Breaks badge in its tags, its text on hover and focus; five rows', async () => {
  const dom = await cardPage('#d-D2');
  const rows = rowsOf(dom, 'D2');
  assert.strictEqual(rows.length, 5);
  rows.forEach(r => assert.deepStrictEqual(kidsOf(r).map(c => cls(c)[0]), ['opick', 'otags'], 'one shape'));
  rows.forEach(r => assert.deepStrictEqual(kidsOf(one(r, '.opick')).map(c => cls(c)[0]), ['k', 'ck', 'ol']));
  const a = rows[0];
  assert.strictEqual(textOf(one(a, '.ocost')), 'Costs a scroll');
  const badge = one(one(a, '.otags'), '.tbreak');
  assert.strictEqual(lastText(badge), 'Breaks K4');
  assert.strictEqual(badge.getAttribute('tabindex'), '0');
  const tip = dom.document.getElementById(badge.getAttribute('aria-describedby'));
  assert.ok(tip && cls(tip).includes('ttip'));
  assert.strictEqual(tip.getAttribute('role'), 'tooltip');
  assert.strictEqual(textOf(tip), 'Breaks K4: Each option keeps its pros and cons beside the choice');
  assert.match(one(a, '.opick').title, /^Breaks K4/);
  assert.strictEqual(q(a, '.arg').length, 0, 'its three arguments are in the pane');
  assert.strictEqual(q(rows[1], '.tbreak').length, 0);
  assert.strictEqual(textOf(one(rows[1], '.ocost')), 'A grid rule');
  assert.strictEqual(q(rows[2], '.ocost').length, 0);
  assert.strictEqual(q(paneOf(dom, 'D2'), '.klist').length, 1, 'the constraint list, in the pane');
});

// D3 and D4 labelled only are bare cards (no rows); this variant gives each a second option with a cost line so they keep their rows.
const rowsD4Html = () => { const g = cardGate(); [2, 3].forEach(i => { g.decisions[i].options = g.decisions[i].options.map(o => Object.assign({}, o)); g.decisions[i].options[1].tradeoff = { business: 'Costs a click' }; g.decisions[i].options[0].accepts = 'One click.'; }); return htmlOf(g); };
test('D7-1 and a moot card: a row pick and a note reach Copy; the refining card shows its moot line above its rows and disables its picks', async () => {
  const dom = await boot(rowsD4Html(), '#d-D3');
  const d4 = dom.document.getElementById('d-D4'), tm = one(d4, '.mootmsg');
  assert.ok(tm.hidden);
  one(rowsOf(dom, 'D3')[1], '.opick').click();
  const note = dom.document.getElementById('note-D3');
  note.value = 'Later.';
  note.listeners.input.forEach(f => f({}));
  dom.document.getElementById('copy').click();
  await settle();
  assert.match(dom.copied[0], /^D3 = b\b.*Later\./m);
  assert.ok(!tm.hidden);
  assert.ok(textOf(tm).includes('Not needed: D3'), textOf(tm));
  const bar = one(d4, '.c-decide');
  assert.ok(bar.children.indexOf(tm) < bar.children.indexOf(one(bar, '.orows')));
  assert.ok(tm.id);
  q(d4, '.opick').forEach(p => { assert.ok(p.disabled); assert.strictEqual(p.getAttribute('aria-describedby'), tm.id); });
  rowsOf(dom, 'D4').forEach(r => assert.ok(r.classList.contains('off')));
});

test('D1-4: a card with no figure and no key number shows the title and the bar\'s option buttons, no picture box; the writer is warned', async () => {
  const r = render(writeGate(cardGate()));
  assert.strictEqual(r.code, 0, r.stderr);
  assert.ok(r.stderr.includes('D5 is not illustrated'), r.stderr);
  const dom = await cardPage('#d-D5');
  const sb = sblockOf(dom, 'D5');
  assert.strictEqual(q(sb, '.sdraw').length + q(sb, '.figure').length + q(sb, '.knums').length, 0);
  assert.strictEqual(rowsOf(dom, 'D5').length, 0, 'bare: no rows');
  assert.strictEqual(cardOpts(dom, 'D5').length, 2);
});

test('D4-2, D5-1, T1-2: a context row: its title the headline, three key numbers, its outcome entry drawn, no option rows', async () => {
  const dom = await cardPage('');
  assert.strictEqual(at(dom), '#d-COVER');
  const sb = sblockOf(dom, 'COVER');
  assert.strictEqual(textOf(one(dom.document.getElementById('d-COVER'), '.ctitle')), 'Where we stand');
  assert.strictEqual(textOf(one(sb, '.lead')), 'Three numbers say it.');
  assert.deepStrictEqual(q(sb, '.kv').map(textOf), ['20 %', '88 %', '96 %']);
  assert.strictEqual(q(dom.document.getElementById('d-COVER'), '.orows').length, 0);
  const sc = sblockOf(dom, 'SCREEN');
  assert.strictEqual(q(sc, '.oview').length, 1);
  assert.strictEqual(q(sc, '.opane').length, 2, 'before beside after');
});

test('SK-1 to SK-4: tension, settled, question and rejected cards get the block and their rows, and keep their own fact', async () => {
  const dom = await cardPage('#d-T1');
  const t = rowsOf(dom, 'T1');
  assert.strictEqual(textOf(one(t[0], '.ocost')), 'Split it.');
  assert.deepStrictEqual(q(secsOf(dom, 'T1')[0], '.arg').map(a => textOf(one(a, '.chip'))), ['PO', 'CTO']);
  assert.strictEqual(textOf(one(t[1], '.ocost')), 'Keep one page.');
  ['T1', 'S1', 'QA', 'R1'].forEach(id => {
    assert.ok(sblockOf(dom, id), id + ' has a story block');
    rowsOf(dom, id).forEach(x => assert.strictEqual(q(x, '.sdraw').length, 0, id));
  });
  assert.ok(textOf(one(dom.document.getElementById('d-S1'), '.keep-answer')).includes('System fonts.'));
  assert.ok(textOf(one(dom.document.getElementById('d-QA'), '.keep-asker')).includes('CTO'));
  const r1 = dom.document.getElementById('d-R1');
  assert.ok(textOf(one(r1, '.keep-reason')).includes('Too heavy.'));
  assert.strictEqual(q(sblockOf(dom, 'R1'), '.lead').length, 0, 'the reason shows once, in place');
  assert.strictEqual(q(dom.document.getElementById('d-D1'), '.keep-answer').length, 0);
});

test('storyView: the pure part, key numbers, drawing, cost line, Breaks and tension positions', () => {
  const src = composedTemplate().match(/\/\*STORY-START\*\/([\s\S]*?)\/\*STORY-END\*\//)[1];
  const ctx = {}; vm.createContext(ctx); vm.runInContext(src, ctx);
  const plain = x => JSON.parse(JSON.stringify(x));
  const three = [arg('A', '1'), arg('B', '2'), arg('C', '3')];
  const v = plain(ctx.storyView({
    id: 'D1', kind: 'decision', for: three, against: [], figures: [{ svg: 'x' }, { svg: 'y' }], bridge: [{ id: 'K4', text: 'Keep it' }, { id: 'K5', text: 'Fast' }],
    metrics: [{ label: 'a', value: 1, key: true }, { label: 'b', value: 2 }, { label: 'c', value: 3, key: true }, { label: 'd', value: 4, key: true }, { label: 'e', value: 5, key: true }],
    options: [{ value: 'a', label: 'A', for: three, against: three.slice(0, 1), tradeoff: { tech: 'T', business: 'B' }, violates: ['K5', 'K4'] }, { value: 'b', label: 'B', tradeoff: { tech: 'T' } }, { value: 'c', label: 'C' }]
  }));
  assert.deepStrictEqual(v.keys.map(m => m.label), ['a', 'c', 'd']);
  assert.deepStrictEqual(v.drawing, { svg: 'x' });
  assert.strictEqual(v.onQuestion, undefined, 'the question\'s own arguments are not read');
  assert.deepStrictEqual(v.rows.map(x => x.line), ['B', 'T', null]);
  assert.deepStrictEqual(Object.keys(v.rows[0]).sort(), ['breaks', 'line', 'o'], 'a row carries no arguments: they are in the pane');
  assert.deepStrictEqual(v.rows[0].breaks, [{ id: 'K5', text: 'Fast' }, { id: 'K4', text: 'Keep it' }]);
  assert.deepStrictEqual(v.rows[1].breaks, []);
  assert.strictEqual(v.rows[0].o.value, 'a');
  const t = plain(ctx.storyView({ id: 'T1', kind: 'tension', sides: [{ who: 'PO', position: 'Split.' }, { who: 'C|X', position: 'Keep.' }], options: [{ value: 'PO', label: 'Side with PO' }, { value: 'C/X', label: 'Side with C|X' }, { value: 'defer', label: 'Defer', negative: true }] }));
  assert.deepStrictEqual(t.rows.map(x => x.line), ['Split.', 'Keep.', null]);
  assert.strictEqual(t.drawing, null);
  const c = plain(ctx.storyView({ id: 'C1', title: 'c', outcome: 2, figures: [{ svg: 'x' }] }));
  assert.deepStrictEqual(c.drawing, { outcome: 2 });
  assert.deepStrictEqual(c.rows, []);
});

test('A6: three panes on a debate page: the evidence pane shows on load on every card, context row and the recap; an old saved mode is ignored and #d-D2 opens D2', async () => {
  const dom = await bootWith('#d-D2', d => d.store.set(OLD_MODE_KEY, 'detail'));
  assert.strictEqual(at(dom), '#d-D2');
  assert.strictEqual(dom.body.dataset.card, undefined);
  ['D1', 'D2', 'D3', 'T1', 'COVER', 'SCREEN', '_recap'].forEach(id => {
    const c = dom.document.getElementById('d-' + id), p = paneOf(dom, id);
    assert.strictEqual(q(c, '.mtoggle').length, 0, id);
    assert.ok(p && p.hidden === false, id + ': the pane shows');
    assert.strictEqual(p.getAttribute('role'), 'region');
    assert.ok(p.getAttribute('aria-label'), id);
    assert.ok(!cls(c).includes('wide'), id + ': the card leaves the pane its column');
  });
  assert.ok(!dom.body.classList.contains('ev-open'));
  const css = cssText();
  assert.match(css, /\.story-page \.panes \{ grid-template-columns: 320px minmax\(0, 1fr\) 460px; \}/);
  assert.ok(!/ev-open/.test(css), 'no open or closed pane state');
  assert.ok(!/\.story-page \.scard \.c-main \{[^}]*grid-area/.test(css), 'the card never spans the pane\'s column');
});

test('A6: the pane shows the recommended option while nothing is picked, the picked one after a pick, else the first; the row it shows is marked', async () => {
  const dom = await cardPage('#d-D1');
  assert.deepStrictEqual(shownSecs(dom, 'D1'), ['Story first']);
  assert.deepStrictEqual(marks(dom, 'D1'), [false, true, false]);
  assert.ok(rowsOf(dom, 'D1')[1].classList.contains('shown'));
  assert.strictEqual(textOf(one(rowsOf(dom, 'D1')[1], '.oshown')), 'in the pane');
  assert.deepStrictEqual(pickBtns(dom, 'D1').map(b => b.getAttribute('aria-pressed')), ['false', 'true', 'false']);
  one(rowsOf(dom, 'D1')[0], '.opick').click();
  assert.deepStrictEqual(shownSecs(dom, 'D1'), ['Detail first']);
  assert.deepStrictEqual(marks(dom, 'D1'), [true, false, false]);
  const dom2 = await boot(htmlOf(gateOf([
    { id: 'D1', title: 'No rec', unillustrated: 'x', options: [{ value: 'a', label: 'A', accepts: 'a costs' }, { value: 'b', label: 'B', accepts: 'b costs' }, { value: 'n', label: 'No', negative: true }] }
  ])), '#d-D1');
  assert.deepStrictEqual(shownSecs(dom2, 'D1'), ['A'], 'no pick, no recommendation: the first');
});

test('A6: the picker lists every option, the negative one too, and shows another without changing the pick or the decisions block; a new pick brings the pane back', async () => {
  const dom = await cardPage('#d-D2');
  const pick = pickBtns(dom, 'D2');
  assert.deepStrictEqual(pick.map(textOf), ['1One column', '2Two columns', '3Three columns', '4Free', '5Keep it as is']);
  assert.deepStrictEqual(pick.map(b => b.title), ['One column', 'Two columns', 'Three columns', 'Free', 'Keep it as is']);
  assert.strictEqual(textOf(one(one(paneOf(dom, 'D2'), '.optpick'), '.pl')), 'Evidence for');
  one(rowsOf(dom, 'D2')[0], '.opick').click();
  assert.deepStrictEqual(shownSecs(dom, 'D2'), ['One column']);
  pick[4].click();
  assert.deepStrictEqual(shownSecs(dom, 'D2'), ['Keep it as is']);
  assert.deepStrictEqual(marks(dom, 'D2'), [false, false, false, false, true]);
  assert.ok(rowsOf(dom, 'D2')[0].classList.contains('chosen'), 'the pick stays');
  assert.ok(pick[0].classList.contains('mine') && pick[4].getAttribute('aria-pressed') === 'true');
  dom.document.getElementById('copy').click();
  await settle();
  assert.match(dom.copied[0], /^D2 = a\b/m, 'the decisions block keeps the pick');
  one(rowsOf(dom, 'D2')[2], '.opick').click();
  assert.deepStrictEqual(shownSecs(dom, 'D2'), ['Three columns'], 'a new pick brings the pane to it');
});

test('A6: [ and ] move the picker, wrapping, without picking; e folds the pane and not the picker; on a context row [ and ] are not taken', async () => {
  const dom = await cardPage('#d-D2');
  const side = dom.body.className;
  assert.deepStrictEqual(shownSecs(dom, 'D2'), ['Two columns']);
  assert.ok(dom.press(']').defaultPrevented);
  assert.deepStrictEqual(shownSecs(dom, 'D2'), ['Three columns']);
  dom.press(']');
  assert.deepStrictEqual(shownSecs(dom, 'D2'), ['Free']);
  dom.press('[');
  assert.deepStrictEqual(shownSecs(dom, 'D2'), ['Three columns']);
  dom.press('['); dom.press('['); dom.press('[');
  assert.deepStrictEqual(shownSecs(dom, 'D2'), ['Keep it as is'], 'wraps');
  q(dom.document.getElementById('d-D2'), '.opick').forEach(b => assert.strictEqual(b.getAttribute('aria-pressed'), 'false'));
  assert.strictEqual(dom.body.className, side, '[ does not fold the list on a debate page');
  const e = dom.press('e');
  assert.ok(e.defaultPrevented, 'e folds the pane (A6 amended)');
  assert.deepStrictEqual(shownSecs(dom, 'D2'), ['Keep it as is'], 'e leaves the picker alone');
  const dom2 = await cardPage('#d-COVER');
  assert.ok(!dom2.press(']').defaultPrevented);
});

test('A6: for and against sit in the shown option\'s section, two columns, "No argument raised" on an empty side; the card holds none', async () => {
  const dom = await cardPage('#d-D2');
  const [one1, two1] = secsOf(dom, 'D2');
  const cols = q(two1, '.argcol');
  assert.strictEqual(cols.length, 2);
  cols.forEach(c => { assert.strictEqual(textOf(one(c, '.none')), 'No argument raised'); assert.strictEqual(q(c, '.n').length, 0, 'no count on an empty side'); });
  const [pro, con] = q(one1, '.argcol');
  assert.deepStrictEqual(q(pro, '.arg').map(pointOf), ['p1', 'p2', 'p3']);
  assert.strictEqual(textOf(one(pro, '.n')), '3');
  assert.strictEqual(textOf(one(con, '.none')), 'No argument raised');
  assert.strictEqual(q(mainOf(dom, 'D2'), '.argcol').length, 0);
});

test('A6: the constraints read their status under the shown option, holds or breaks, in the pane\'s top part', async () => {
  const dom = await cardPage('#d-D2');
  const pane = paneOf(dom, 'D2'), li = one(pane, '.kst'), top = one(pane, '.etop');
  assert.ok(one(top, '.klist'), 'with the shown option, above the whole question');
  assert.ok(textOf(one(li, '.ks')).includes('Holds'));
  assert.ok(!li.classList.contains('lifted'));
  pickBtns(dom, 'D2')[0].click();
  assert.ok(li.classList.contains('lifted'));
  assert.ok(textOf(one(li, '.ks')).includes('Breaks under this option'));
  one(rowsOf(dom, 'D2')[2], '.opick').click();
  assert.ok(!li.classList.contains('lifted'), 'a pick moves the pane, and the status with it');
  assert.ok(textOf(one(li, '.ks')).includes('Holds'));
});

test('A6: "The whole question" follows the shown option\'s part: the options compared, every option a row, the shown one marked', async () => {
  const dom = await cardPage('#d-D2');
  const pane = paneOf(dom, 'D2'), evb = one(pane, '.ev-scroll');
  assert.deepStrictEqual(kidsOf(evb).slice(0, 4).map(n => cls(n).find(k => ['optpick', 'etop', 'wholeq', 'evb'].includes(k))), ['optpick', 'etop', 'wholeq', 'evb']);
  assert.strictEqual(textOf(one(evb, '.wholeq')), 'The whole question');
  const table = one(pane, '.ocomp'), [head, body] = kidsOf(table);
  assert.deepStrictEqual(kidsOf(kidsOf(head)[0]).map(textOf), ['Option', 'for the business', 'for the build']);
  const trs = kidsOf(body);
  assert.strictEqual(trs.length, 5, 'every option, the negative one too');
  assert.deepStrictEqual(trs.map(r => r.classList.contains('shown')), [false, true, false, false, false]);
  assert.strictEqual(textOf(one(trs[0], '.lift')), 'Breaks K4');
  assert.deepStrictEqual(kidsOf(trs[2]).slice(1).map(textOf), ['—', '—']);
  pickBtns(dom, 'D2')[0].click();
  assert.deepStrictEqual(trs.map(r => r.classList.contains('shown')), [true, false, false, false, false]);
  const dom1 = await cardPage('#d-D1');
  assert.strictEqual(q(paneOf(dom1, 'D1'), '.ocomp').length, 0, 'no cost, number or Breaks on D1\'s options: no table');
  assert.ok(one(paneOf(dom1, 'D1'), '.wholeq'), 'its other numbers are the whole question');
  const dom6 = await boot(htmlOf(gateOf([
    { id: 'Q6', title: 'One message or two?', unillustrated: 'x', options: [
      { value: 'one', label: 'One message', recommended: true, metrics: [{ label: 'Sends', value: '4' }] },
      { value: 'two', label: 'Two messages', metrics: [{ label: 'Sends', value: '8' }] },
      { value: 'none', label: 'No message', negative: true }
    ] }
  ])), '#d-Q6');
  const t6 = one(paneOf(dom6, 'Q6'), '.ocomp'), [h6, b6] = kidsOf(t6);
  assert.deepStrictEqual(kidsOf(kidsOf(h6)[0]).map(textOf), ['Option', 'Sends'], 'a column per number the options give');
  assert.deepStrictEqual(kidsOf(b6).map(r => textOf(kidsOf(r)[1])), ['4', '8', '—']);
  pickBtns(dom6, 'Q6')[1].click();
  assert.deepStrictEqual(q(secsOf(dom6, 'Q6')[1], '.mv').map(textOf), ['8'], 'the shown option\'s own number in its section');
});

test('A6: no tiles, no columns, no Evidence buttons; the help panel and the keys bar name [ ] and e', async () => {
  const dom = await cardPage('#d-D1');
  ['tile', 'tiles', 'tcols', 'tevb', 'gevb', 'tmore', 'tpick', 'sread', 'shint', 'tmoot'].forEach(k => assert.strictEqual(q(dom.document, '.' + k).length, 0, k));
  const help = one(dom.body, '.help');
  assert.ok(help.innerHTML.includes('<kbd>[</kbd> <kbd>]</kbd>'));
  assert.ok(help.innerHTML.includes('<kbd>e</kbd>'));
  const spans = dom.document.getElementById('legend').children.map(textOf);
  assert.ok(spans.includes('[ ]Evidence for'), spans.join('|'));
  assert.ok(spans.includes('EEvidence pane'), spans.join('|'));
});

test('A6: at 760px a debate page has the Evidence tab, as the other kinds, and the pane shows there', async () => {
  const dom = await bootWith('#d-D2', d => { narrowMedia(d, true); });
  const ev = dom.document.getElementById('tabs').children.filter(b => b.dataset.tab === 'ev')[0];
  assert.strictEqual(ev.hidden, false);
  ev.click();
  assert.strictEqual(tabOf(dom), 'ev');
  assert.match(cssText(), /\.layout\[data-tab="ev"\] \.card\.current \.c-ev/);
});

test('localStorage blocked: the page opens and the pane shows its sections', async () => {
  const dom = await bootWith('#d-D1', d => {
    const boom = () => { throw new Error('blocked'); };
    d.ctx.localStorage = { getItem: boom, setItem: boom, removeItem: boom, key: boom, length: 0 };
  });
  assert.strictEqual(at(dom), '#d-D1');
  assert.ok(secsOf(dom, 'D1').length);
  assert.strictEqual(paneOf(dom, 'D1').hidden, false);
});

test('a bare card has no rows and no picker; its pane shows its own evidence under an Evidence heading, else one line', async () => {
  const dom = await cardPage('#d-D3');
  const pane = paneOf(dom, 'D3');
  assert.strictEqual(secsOf(dom, 'D3').length + q(pane, '.optpick').length + q(pane, '.wholeq').length, 0);
  assert.strictEqual(textOf(one(pane, '.phead').children[0]), 'Evidence');
  assert.ok(textOf(pane).includes(NOTHING));
  const dom2 = await boot(htmlOf(gateOf([{ id: 'B1', title: 'Bare with evidence', unillustrated: 'x', at: { path: 'src/a.js', line: 3 }, examples: [ROW], options: [opt('a', 'Alpha', { recommended: true }), opt('b', 'Beta'), opt('n', 'None', { negative: true })] }])), '#d-B1');
  const p2 = paneOf(dom2, 'B1');
  assert.ok(cls(dom2.document.getElementById('d-B1')).includes('bare'));
  assert.strictEqual(q(p2, '.extable').length, 0, 'the examples are the card\'s drawing now');
  assert.strictEqual(q(one(one(dom2.document.getElementById('d-B1'), '.sblock'), '.sdraw'), '.extable').length, 1);
  assert.strictEqual(q(p2, '.loc').length, 1);
  assert.strictEqual(q(p2, '.wholeq').length, 0);
  assert.ok(one(p2, '.ev-empty').hidden, 'the one line hides beside evidence');
});

test('on a context row or the recap the pane shows the row\'s own evidence, else one short line', async () => {
  const dom = await cardPage('#d-D1');
  dom.press('k');
  assert.strictEqual(at(dom), '#d-SCREEN');
  assert.strictEqual(paneOf(dom, 'SCREEN').hidden, false);
  assert.ok(textOf(paneOf(dom, 'SCREEN')).includes(NOTHING));
  dom.press('k');
  assert.strictEqual(at(dom), '#d-COVER');
  assert.ok(textOf(paneOf(dom, 'COVER')).includes(NOTHING));
  const recap = dom.document.getElementById('ev-_recap');
  assert.strictEqual(recap.hidden, false);
  assert.ok(textOf(recap).includes(NOTHING));
  assert.ok(q(paneOf(dom, 'D1'), '.metric').length >= 1, 'a card with evidence shows it');
});

test('a context row with numbers past the 3 large ones shows them in its pane', async () => {
  const g = cardGate();
  g.context[0].metrics.push({ label: 'Extra', after: 7 });
  const dom = await boot(htmlOf(g), '#d-COVER');
  assert.deepStrictEqual(q(paneOf(dom, 'COVER'), '.metric').map(r => textOf(one(r, '.ml'))), ['Extra']);
  assert.ok(!textOf(paneOf(dom, 'COVER')).includes(NOTHING));
});

// A9: every deciding kind has the debate card and pane; its list stays its own until the list's shell reaches it.
test('A9: a refactor page has the debate page\'s evidence pane: open on load, its close control and rail, no Evidence button; and its list shell', async () => {
  const dom = await boot(htmlOf({ kind: 'refactor', title: 'R', lang: 'en', decisions: [{ id: 'S1', title: 'Do it', brief: 'Do S1.', code: { before: 'a', after: 'b' } }] }), '#d-S1');
  assert.ok(dom.body.classList.contains('story-page'));
  assert.ok(!dom.body.classList.contains('ev-open'));
  const card = dom.document.getElementById('d-S1'), ev = one(card, '.c-ev');
  assert.ok(cls(card).includes('scard'), 'a story card');
  assert.ok(ev, 'the pane is there');
  assert.ok(!ev.hidden);
  assert.ok(!dom.body.classList.contains('ev-closed') && !dom.body.classList.contains('ev-none'));
  assert.strictEqual(q(card, '.evclose').length, 1);
  assert.strictEqual(q(card, '.evrail').length, 1);
  assert.strictEqual(q(card, '.tevb').length, 0);
});

test('D3-1 pane half: the negative option\'s arguments all sit in its own section, none under the question in the card\'s own evidence', async () => {
  const dom = await cardPage('#d-D1');
  const cf = paneOf(dom, 'D1');
  const titles = q(cf, '.blk').map(b => textOf(b.children[0]));
  assert.ok(!titles.includes('On the question'), titles.join('|'));
  const nf = secsOf(dom, 'D1').filter(f => f.getAttribute('aria-label') === 'Drop this question')[0];
  assert.deepStrictEqual(q(nf, '.arg').map(pointOf), ['The question answers itself.', 'Q con one.', 'Q pro one.', 'Q pro two.', 'Q pro three.']);
  assert.strictEqual(q(dom.document.getElementById('d-D1'), '.blk').filter(b => /: for and against$/.test(textOf(b.children[0]))).length, 0);
  const dom2 = await boot(htmlOf(gateOf([
    { id: 'D1', title: 'Chip', unillustrated: 'x', options: [{ value: 'a', label: 'A', for: [arg('CTO', 'A.')] }, { value: 'b', label: 'B', negative: true, against: [arg('Ghost', 'Nobody takes it.'), arg('CTO', 'CTO says.')] }] }
  ])), '#d-D1');
  assert.strictEqual(q(dom2.document.getElementById('d-D1'), '.bnone').length, 0, 'no "backs no option" chip: every argument is on an option');
  assert.ok(cls(rowsOf(dom2, 'D1')[1]).includes('neg'));
  assert.ok(q(secsOf(dom2, 'D1')[1], '.arg').map(pointOf).some(p => p.includes('Nobody takes it.')), 'Ghost\'s point shows in the negative option\'s section');
});

test('D5-1 pane half: key numbers show large only; the numbers not shown large sit in the card\'s pane', async () => {
  const dom = await cardPage('#d-COVER');
  assert.strictEqual(q(paneOf(dom, 'COVER'), '.metric').length, 0, 'three key numbers and nothing else: the pane has nothing more');
  assert.ok(textOf(paneOf(dom, 'COVER')).includes(NOTHING));
  assert.strictEqual(q(dom.document.getElementById('d-COVER'), '.metric').length, 0);
  const rows = q(paneOf(dom, 'D1'), '.metric');
  assert.deepStrictEqual(rows.map(r => textOf(one(r, '.ml'))), ['Roles', 'Gates', 'Hidden', 'Later']);
  assert.strictEqual(textOf(one(rows[3], '.mv')), '5', 'a {label, after} metric prints its after value');
});

test('an option\'s section: all its arguments, its trade-off (both lenses, what it accepts), numbers, examples, all its figures', async () => {
  const four = [arg('PO', 'o1'), arg('UX', 'o2'), arg('CTO', 'o3'), arg('PO', 'o4')];
  const dom = await boot(htmlOf(gateOf([
    { id: 'D1', title: 'Fold', unillustrated: 'x', options: [
      { value: 'a', label: 'A', for: four, tradeoff: { business: 'Biz cost', tech: 'Tech cost' }, metrics: [{ label: 'Speed', value: 3 }],
        examples: [{ given: 'g', when: 'w', then: 't' }], figures: [sfig('F1'), sfig('F2')], accepts: 'Slower.' },
      { value: 'b', label: 'B', negative: true }
    ] }
  ])), '#d-D1');
  const fs1 = secsOf(dom, 'D1'), f = fs1[0];
  assert.strictEqual(f.getAttribute('aria-label'), 'A');
  assert.deepStrictEqual(q(f, '.arg').map(pointOf), ['o1', 'o2', 'o3', 'o4']);
  assert.strictEqual(q(f, '.argcol').length, 2, 'both sides, the empty one says so');
  assert.deepStrictEqual(q(f, '.tv').map(textOf), ['Biz cost', 'Tech cost', 'Slower.']);
  assert.deepStrictEqual(q(f, '.tl').map(textOf), ['for the business', 'for the build', 'Accepts']);
  assert.strictEqual(q(f, '.metric').length, 1);
  assert.strictEqual(q(f, '.extable').length, 1);
  assert.ok(textOf(f).includes('F1') && textOf(f).includes('F2'), 'every figure of the option');
  assert.strictEqual(fs1.length, 2, 'every option has a section, the negative one too');
  assert.strictEqual(q(paneOf(dom, 'D1'), '.ocomp').length, 1, 'the options compared in the whole question');
  assert.strictEqual(q(paneOf(dom, 'D1'), '.extable').length, q(f, '.extable').length, 'the option\'s examples stay in its own section');
});

test('foldsOf: the pure part, what a card shows in the whole question and what each option shows of its own', () => {
  const src = composedTemplate().match(/\/\*STORY-START\*\/([\s\S]*?)\/\*STORY-END\*\//)[1];
  const ctx = {}; vm.createContext(ctx); vm.runInContext(src, ctx);
  const f = x => JSON.parse(JSON.stringify(ctx.foldsOf(x)));
  const plain = { id: 'D1', kind: 'decision', why: 'w', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] };
  const card = extra => Object.assign({}, plain, extra);
  const opt = extra => ({ options: [Object.assign({ value: 'a', label: 'A' }, extra), { value: 'b', label: 'B' }] });
  const three = [arg('A', '1'), arg('B', '2'), arg('C', '3')];
  assert.deepStrictEqual(f(plain), { card: false, options: [false, false] });
  assert.strictEqual(f(card({ for: three })).card, false, 'item-level arguments are not read on a card');
  assert.strictEqual(f(card({ detail: 'more' })).card, false, 'its detail shows in the story block');
  assert.strictEqual(f(card({ bridge: [{ id: 'K1', text: 't' }] })).card, true, 'its constraints are evidence: the pane stays');
  assert.deepStrictEqual(f(card(opt({ violates: ['K1'] }))), { card: true, options: [false, false] }, 'the comparison table marks it');
  assert.deepStrictEqual(f(card(opt({ for: three.slice(0, 1) }))).options, [true, false], 'one argument is the option\'s own');
  assert.deepStrictEqual(f(card(opt({ tradeoff: { business: 'b' } }))), { card: true, options: [true, false] });
  assert.deepStrictEqual(f(card(opt({ metrics: [{ label: 'm', value: 1 }] }))), { card: true, options: [true, false] });
  assert.deepStrictEqual(f(card(opt({ figures: [{ svg: 'a' }] }))).options, [true, false]);
  assert.deepStrictEqual(f(card(opt({ accepts: 'x' }))), { card: false, options: [true, false] });
  assert.deepStrictEqual(f(card(opt({ brief: 'x', negative: true }))).options, [false, false], 'a negative option has no brief');
  assert.strictEqual(f(card({ figures: [{ svg: 'a' }] })).card, false);
  assert.strictEqual(f(card({ metrics: [{ label: 'a', value: 1, key: true }] })).card, false);
  assert.strictEqual(f(card({ metrics: [{ label: 'a', value: 1 }] })).card, true);
  assert.strictEqual(f(card({ metrics: [1, 2, 3, 4].map(n => ({ label: 'm' + n, value: n, key: true })) })).card, true, 'a 4th key number');
  assert.deepStrictEqual(f({ id: 'C1', title: 'c' }), { card: false, options: [] });
  assert.strictEqual(f({ id: 'C1', title: 'c', detail: 'd' }).card, false, 'its detail shows in the story block');
  assert.strictEqual(f({ id: 'C1', title: 'c', metrics: [{ label: 'a', after: 1, key: true }] }).card, false, 'a key number shows large, nowhere else');
  assert.strictEqual(f({ id: 'C1', title: 'c', metrics: [{ label: 'a', after: 1 }] }).card, true);
  assert.strictEqual(f({ id: 'C1', title: 'c', outcome: 0, figures: [{ svg: 'x' }] }).card, true);
  assert.strictEqual(f({ id: 'C1', title: 'c', figures: [{ svg: 'x' }] }).card, false);
});

test('coherence: the evidence is in one pane beside the card: the picker, each option\'s section by its label, the constraints, then the card\'s own', async () => {
  const dom = await cardPage('#d-D2');
  const card = dom.document.getElementById('d-D2'), pane = paneOf(dom, 'D2');
  assert.strictEqual(q(mainOf(dom, 'D2'), '.osec').length, 0, 'no section in the card');
  assert.strictEqual(q(one(card, '.c-scroll'), '.c-ev').length, 0, 'the pane is not in the card\'s own column');
  const top = one(pane, '.etop');
  assert.deepStrictEqual(kidsOf(top).map(n => cls(n)[0]), ['osecs', 'evb']);
  assert.deepStrictEqual(kidsOf(kidsOf(top)[0]).map(d => d.getAttribute('aria-label')), ['One column', 'Two columns', 'Three columns', 'Free', 'Keep it as is']);
});

test('coherence: a rejected card\'s reason comes before its story block', async () => {
  const dom = await cardPage('#d-R1');
  const scroll = one(dom.document.getElementById('d-R1'), '.c-scroll'), order = kidsOf(scroll);
  const reason = order.findIndex(n => n.classList.contains('keep-reason')), sb = order.indexOf(sblockOf(dom, 'R1'));
  assert.ok(reason >= 0 && reason < sb, order.map(n => cls(n).join('.')).join('|'));
});

test('A6: the debate bar reads "Your choice" and says the pane follows the option', async () => {
  const dom = await cardPage('#d-D1');
  const dh = one(dom.document.getElementById('d-D1'), '.dh');
  assert.strictEqual(textOf(dh.children[0]), 'Your choice');
  assert.strictEqual(textOf(one(dh, '.hint')), 'Press 1–3 or click · the evidence pane follows the option');
});

test('coherence: no lifts chip in the option rows, which say Breaks; the pane\'s table keeps its marks', async () => {
  const dom = await cardPage('#d-D2');
  const card = dom.document.getElementById('d-D2');
  assert.strictEqual(textOf(dom.document.getElementById(one(rowsOf(dom, 'D2')[0], '.tbreak').getAttribute('aria-describedby'))), 'Breaks K4: ' + K4.text);
  secsOf(dom, 'D2').forEach(f => assert.strictEqual(q(f, '.lift').length, 0));
  assert.strictEqual(q(one(card, '.orows'), '.lift').length, 0);
  assert.strictEqual(q(paneOf(dom, 'D2'), '.klist').length, 1);
  assert.strictEqual(q(one(paneOf(dom, 'D2'), '.ocomp'), '.lift').length, 1);
});

test('coherence: the option rows carry no arguments and no lens tag; the arguments in the pane carry no lens tag either', async () => {
  const dom = await cardPage('#d-D1');
  const g = one(dom.document.getElementById('d-D1'), '.orows');
  assert.strictEqual(q(g, '.argcol').length + q(g, '.klens').length, 0);
  assert.ok(!textOf(g).includes('Nobody argued'));
  secsOf(dom, 'D1').forEach(s => assert.strictEqual(q(one(s, '.oargs'), '.klens').length, 0));
});

test('coherence: the keys bar shows one "1–n Choose" entry on a debate page, not each option', async () => {
  const dom = await cardPage('#d-D1');
  const spans = dom.document.getElementById('legend').children.map(textOf);
  assert.ok(spans.includes('1–3Choose'), spans.join('|'));
  ['Detail first', 'Story first', 'Drop this question'].forEach(l => assert.ok(!spans.some(s => s.includes(l)), l));
});

test('option rows: the + and − glyphs take the For and Against hues; no grid rule reads data-n', async () => {
  const css = cssText();
  assert.match(css, /\.story-page \.argcol\.pro \.sg \{[^}]*color: var\(--pro\)/);
  assert.match(css, /\.story-page \.argcol\.con \.sg \{[^}]*color: var\(--con\)/);
  assert.ok(!/\.story-page \.tiles\[data-n/.test(css));
});

test('coherence: the recommended row has its word tag, no fill of its own; chosen alone is green', async () => {
  const dom = await cardPage('#d-D1');
  assert.strictEqual(textOf(one(rowsOf(dom, 'D1')[1], '.rectag')), 'Recommended');
  const css = cssText();
  assert.ok(![...css.matchAll(/([^{}]*\.orow\.is-rec[^{}]*)\{([^}]*)\}/g)].some(r => /background|--amber/.test(r[2])));
  assert.match(css, /\.story-page \.orow\.chosen \{[^}]*var\(--green\)/);
  const tokens = fs.readFileSync(path.join(__dirname, '../../skills/team-view/tokens.css'), 'utf8');
  assert.ok(!/--rec-bg|--num-bg/.test(tokens));
});

// Tags top right, bare options, the centred figure, Tab reaching the Breaks badges (the human, 2026-11-11).
test('tags: a debate card\'s tags sit in the heading line, after the title; they wrap under it at 760px', async () => {
  const dom = await cardPage('#d-D1');
  const card = dom.document.getElementById('d-D1'), ch = one(card, '.ch'), scroll = one(card, '.c-scroll');
  const tags = one(ch, '.tags');
  assert.ok(tags, 'tags in .ch');
  assert.ok(ch.children.indexOf(tags) > ch.children.indexOf(one(ch, '.ctitle')));
  assert.strictEqual(scroll.children.filter(n => cls(n).includes('tags')).length, 0, 'none left under the heading');
  assert.match(textOf(tags), /Decision/);
  assert.match(cssText(), /\.story-page \.scard \.ch \.tags \{[^}]*margin: 0 0 0 auto/);
  assert.match(cssText(), /@media \(max-width: 760px\) \{[^@]*\.story-page \.scard \.ch \.tags \{[^}]*flex: 1 0 100%/);
});

test('bareOptions: labels alone are bare; a figure, cost line, Breaks, argument or option evidence is not', () => {
  const src = composedTemplate().match(/\/\*STORY-START\*\/([\s\S]*?)\/\*STORY-END\*\//)[1];
  const ctx = {}; vm.createContext(ctx); vm.runInContext(src, ctx);
  const opts = extra => [{ value: 'a', label: 'A' }, Object.assign({ value: 'b', label: 'B' }, extra)];
  const bare = extra => ctx.bareOptions({ id: 'X', kind: 'decision', options: opts(extra), bridge: [{ id: 'K1', text: 'k' }] });
  assert.strictEqual(bare({}), true);
  assert.strictEqual(bare({ negative: true, recommended: true }), true);
  [{ figures: [{ svg: 'x' }] }, { tradeoff: { business: 'Cheap' } }, { tradeoff: { tech: 'Small' } }, { violates: ['K1'] },
    { for: [{ point: 'p' }] }, { against: [{ point: 'p' }] }, { examples: [{ given: 'a', when: 'b', then: 'c' }] }, { code: { after: 'x' } }].forEach(x => {
    assert.strictEqual(bare(x), false, JSON.stringify(x));
  });
  assert.strictEqual(ctx.bareOptions({ id: 'X', kind: 'decision', options: [] }), false);
});

test('bare options: D4 (labels only) has no rows and no picker; the bar\'s own buttons show, pick with 1 and 2, and Tab cycles them', async () => {
  const dom = await cardPage('#d-D4');
  const card = dom.document.getElementById('d-D4');
  assert.ok(cls(card).includes('bare'));
  assert.strictEqual(q(card, '.orows').length + q(card, '.opick').length + q(card, '.orow').length + q(card, '.oseg').length, 0);
  assert.strictEqual(q(card, '.sread').length + q(card, '.shint').length, 0);
  const css = cssText();
  assert.match(css, /\.story-page \.scard:not\(\.bare\) \.c-decide \.options/);
  assert.ok(!/\.story-page \.scard \.c-decide \.options/.test(css), 'no unscoped rule hides the bar buttons');
  const opts = cardOpts(dom, 'D4');
  assert.deepStrictEqual(opts.map(b => textOf(one(b, '.ol'))), ['Bar', 'Card', 'Nowhere']);
  assert.strictEqual(textOf(one(one(card, '.dh'), '.hint')), 'Press 1–3 or click');
  assert.strictEqual(textOf(one(card, '.dh').children[0]), 'Your choice');
  assert.ok(dom.document.getElementById('legend').children.map(textOf).some(t => t.includes('Bar')), 'the keys bar names the options, as on other pages');
  dom.press('Tab');
  assert.strictEqual(dom.document.activeElement.dataset.value, 'a', 'the recommended one first');
  dom.press('Tab');
  assert.strictEqual(dom.document.activeElement.dataset.value, 'b');
  dom.press('Tab');
  assert.strictEqual(dom.document.activeElement.dataset.value, 'none');
  dom.press('2');
  assert.strictEqual(opts[1].getAttribute('aria-pressed'), 'true');
  assert.strictEqual(opts[0].getAttribute('aria-pressed'), 'false');
  dom.press('1');
  assert.strictEqual(opts[0].getAttribute('aria-pressed'), 'true');
  opts[1].click();
  assert.strictEqual(opts[1].getAttribute('aria-pressed'), 'true');
});

test('bare options: a moot bare card says so in the bar and disables the bar\'s buttons', async () => {
  const dom = await cardPage('#d-D3');
  cardOpts(dom, 'D3')[1].click();
  const d4 = dom.document.getElementById('d-D4');
  assert.ok(!one(d4, '.mootmsg').hidden);
  cardOpts(dom, 'D4').forEach(b => assert.ok(b.disabled));
});

test('bare options: one option with a cost line keeps its rows, their picks and the bar hint for rows', async () => {
  const dom = await boot(rowsD4Html(), '#d-D4');
  const card = dom.document.getElementById('d-D4');
  assert.ok(!cls(card).includes('bare'));
  assert.strictEqual(rowsOf(dom, 'D4').length, 3);
  assert.strictEqual(q(card, '.opick').length, 3);
  assert.strictEqual(textOf(one(one(card, '.dh'), '.hint')), 'Press 1–3 or click · the evidence pane follows the option');
});

test('figure centred: the card\'s drawing is centred, the rest stays left', () => {
  const css = cssText();
  assert.match(css, /\.story-page \.sblock > \.sdraw \{[^}]*text-align: center/);
  assert.match(css, /\.story-page \.sblock > \.sdraw img, \.story-page \.sblock > \.sdraw svg \{[^}]*margin-left: auto; margin-right: auto/);
  assert.ok(!/\.story-page \.orow[^{]*\{[^}]*text-align: center/.test(css));
});

test('Tab reaches each Breaks badge, in DOM order with the picks, and Shift+Tab goes back', async () => {
  const dom = await cardPage('#d-D2');
  const card = dom.document.getElementById('d-D2'), badge = one(card, '.tbreak'), picks = q(card, '.opick');
  const at = () => dom.document.activeElement;
  dom.press('Tab');
  assert.strictEqual(at(), picks[1], 'the recommended pick first');
  dom.press('Tab');
  assert.strictEqual(at(), picks[2]);
  dom.press('Tab');
  assert.strictEqual(at(), picks[3]);
  dom.press('Tab');
  assert.strictEqual(at(), picks[4], 'the negative option\'s pick follows');
  dom.press('Tab');
  assert.strictEqual(at(), picks[0], 'and wraps');
  dom.press('Tab');
  assert.strictEqual(at(), badge, 'the badge after its row\'s pick');
  dom.press('Tab');
  assert.strictEqual(at(), picks[1]);
  dom.press('Tab', { shiftKey: true });
  assert.strictEqual(at(), badge);
  dom.press('Tab', { shiftKey: true });
  assert.strictEqual(at(), picks[0]);
  dom.press('Tab', { shiftKey: true });
  assert.strictEqual(at(), picks[4]);
});

// The detail amendment (the human, 2026-11-11): a debate card's detail shows in the story block, right after the stake
// line, and is no longer folded; the pane keeps the evidence.
function detailGate() {
  const g = cardGate();
  g.context[1].detail = ['The screen today lists every row.'];
  g.decisions[2].detail = ['Notes are lost on reload.', 'Two reviewers asked for them.'];
  g.decisions[2].why = 'Notes decide the review.';
  g.decisions[1].detail = 'A grid rule costs one line.';
  return g;
}

test('a decision card\'s detail sits in the story block after the stake line, not in the pane', async () => {
  const dom = await boot(htmlOf(detailGate()), '#d-D3');
  const sb = sblockOf(dom, 'D3');
  assert.deepStrictEqual(sb.children.map(c => cls(c).find(k => ['lead', 'prose'].includes(k))).slice(0, 2), ['lead', 'prose']);
  assert.ok(textOf(sb).includes('Notes are lost on reload.'));
  assert.deepStrictEqual(one(sb, '.prose').children[0].children.map(textOf), ['Notes are lost on reload.', 'Two reviewers asked for them.']);
  assert.strictEqual(secsOf(dom, 'D3').length, 0, 'its only evidence was the detail: nothing for the pane');
  assert.ok(!textOf(paneOf(dom, 'D3')).includes('Notes are lost on reload.'));
  assert.ok(textOf(paneOf(dom, 'D3')).includes(NOTHING));
});

test('a card with other evidence keeps it in the pane, without the detail', async () => {
  const dom = await boot(htmlOf(detailGate()), '#d-D2');
  assert.ok(textOf(sblockOf(dom, 'D2')).includes('A grid rule costs one line.'));
  const cf = paneOf(dom, 'D2');
  assert.ok(q(cf, '.klist').length, 'the constraint list is in the pane');
  assert.ok(!textOf(cf).includes('A grid rule costs one line.'), 'the detail is not in the pane');
});

test('a context row\'s detail shows in the story block and its pane has nothing more when that was all it held', async () => {
  const dom = await boot(htmlOf(detailGate()), '#d-SCREEN');
  assert.ok(textOf(sblockOf(dom, 'SCREEN')).includes('The screen today lists every row.'));
  assert.strictEqual(q(paneOf(dom, 'SCREEN'), '.metric').length, 0);
  assert.ok(textOf(paneOf(dom, 'SCREEN')).includes(NOTHING));
  assert.ok(!textOf(paneOf(dom, 'SCREEN')).includes('The screen today lists every row.'));
});

const evGateIds = gate => ['decisions', 'tensions', 'settled', 'questions', 'rejected'].reduce((a, k) => a.concat((gate[k] || []).map(x => x.id)), []);
test('A6: for every debate card of the example and the fixtures, a card with rows has a picker of every option, and "The whole question" shows exactly when something follows it', async () => {
  const exDir = path.join(__dirname, '../../examples/debate-gate');
  const plainGate = gateOf([
    { id: 'P1', title: 'No arguments anywhere', unillustrated: 'x', options: [opt('a', 'Alpha', { recommended: true, accepts: 'c1' }), opt('b', 'Beta', { accepts: 'c2' }), opt('c', 'Gamma'), opt('n', 'None', { negative: true })] },
    { id: 'P2', title: 'Mixed', unillustrated: 'x', examples: [ROW], options: [opt('a', 'Alpha', { recommended: true, for: [arg('PO', 'p1')] }), opt('b', 'Beta', { examples: [ROW] }), opt('c', 'Gamma'), opt('n', 'None', { negative: true })] }
  ]);
  const cases = [[fs.readFileSync(path.join(exDir, 'export.html'), 'utf8'), JSON.parse(fs.readFileSync(path.join(exDir, 'export.gate.json'), 'utf8')), 'example']]
    .concat([[cardGate(), 'cards'], [domGate(), 'dom'], [plainGate, 'plain']].map(([g, l]) => [htmlOf(g), g, l]));
  let n = 0;
  for (const [html, gate, label] of cases) {
    for (const id of evGateIds(gate)) {
      const dom = await boot(html, '#d-' + id);
      const pane = paneOf(dom, id);
      if (!pane) continue;
      const evb = one(pane, '.ev-scroll'), card = dom.document.getElementById('d-' + id), wq = one(evb, '.wholeq');
      if (!cls(card).includes('bare') && rowsOf(dom, id).length > 1) assert.strictEqual(pickBtns(dom, id).length, rowsOf(dom, id).length, label + ' ' + id + ': every option in the picker');
      if (wq) assert.ok(evb.children.indexOf(wq) < evb.children.length - 1, label + ' ' + id + ': something follows the divider');
      else assert.ok(evb.children.every(k => ['optpick', 'etop', 'ev-empty'].some(c => cls(k).includes(c)) || cls(card).includes('bare')), label + ' ' + id + ': nothing of the card\'s own without the divider');
      n++;
    }
  }
  assert.ok(n >= 12, 'checked ' + n + ' cards');
});

// A6 amended (the human, 2026-11-11): the evidence pane closes like the decisions list, and is absent when empty.
const EV_KEY = 'team-view:evpane:Cards';
const evClosed = dom => dom.body.classList.contains('ev-closed'), evNone = dom => dom.body.classList.contains('ev-none');

test('A6 amended: the pane has a close control; closed it leaves a rail with a reopen control; e toggles; the state is remembered and kept from card to card', async () => {
  const dom = await cardPage('#d-D1');
  assert.ok(!evClosed(dom) && !evNone(dom));
  const pane = paneOf(dom, 'D1');
  assert.strictEqual(q(pane, '.evclose').length, 1, 'one close control in the header');
  assert.ok(one(pane, '.evclose').getAttribute('aria-label'));
  assert.strictEqual(q(pane, '.evrail').length, 1, 'the rail is in the pane, shown by CSS when closed');
  one(pane, '.evclose').click();
  assert.ok(evClosed(dom));
  assert.strictEqual(dom.store.get(EV_KEY), 'closed');
  assert.ok(one(pane, '.evrail').getAttribute('aria-label'));
  one(pane, '.evrail').click();
  assert.ok(!evClosed(dom));
  assert.strictEqual(dom.store.get(EV_KEY), 'open');
  assert.ok(dom.press('e').defaultPrevented);
  assert.ok(evClosed(dom));
  dom.press('j'); // D2
  assert.strictEqual(at(dom), '#d-D2');
  assert.ok(evClosed(dom), 'kept from card to card');
  assert.strictEqual(q(paneOf(dom, 'D2'), '.evclose').length, 1);
  dom.press('e');
  assert.ok(!evClosed(dom));
  const again = await boot(htmlOf(cardGate()), '#d-D1', d => d.store.set(EV_KEY, 'closed'));
  assert.ok(evClosed(again), 'remembered');
});

test('A6 amended: the picker pane and a head-only pane both carry the close control', async () => {
  const dom = await cardPage('#d-D2');
  assert.strictEqual(q(one(paneOf(dom, 'D2'), '.optpick'), '.evclose').length, 1, 'in the picker row');
  assert.strictEqual(q(one(paneOf(dom, 'D5'), '.phead') || paneOf(dom, 'D5'), '.evclose').length, 1, 'a bare card');
});

test('A6 amended: a card or row with nothing for the pane shows no pane and cannot open it; the next card with evidence brings it back as it was', async () => {
  const dom = await cardPage('#d-COVER');
  assert.ok(evNone(dom), 'a context row with no evidence of its own');
  const before = dom.store.get(EV_KEY);
  dom.press('e');
  assert.ok(!evClosed(dom), 'e does nothing');
  assert.strictEqual(dom.store.get(EV_KEY), before);
  assert.ok(!dom.document.getElementById('toast') || !textOf(dom.document.getElementById('toast')));
  dom.press('j'); // SCREEN: a drawing only
  assert.ok(evNone(dom));
  dom.press('j'); // D1
  assert.strictEqual(at(dom), '#d-D1');
  assert.ok(!evNone(dom));
  dom.press('e');
  assert.ok(evClosed(dom));
  ['D3', 'D5', '_recap'].forEach(id => { dom.ctx.location.hash = '#d-' + id; dom.document.getElementById('d-' + id); });
  const recap = await boot(htmlOf(cardGate()), '#d-_recap', d => d.store.set(EV_KEY, 'closed'));
  assert.ok(evNone(recap) && !evClosed(recap), 'the recap has none: no pane and no rail even when closed');
  const bare = await boot(htmlOf(cardGate()), '#d-D3');
  assert.ok(evNone(bare), 'a card whose options and card have no evidence');
  const ev = await boot(htmlOf(cardGate()), '#d-D2');
  assert.ok(!evNone(ev));
});

test('A6 amended: the CSS closes to a rail 52px wide on the right, takes the full width when none, and hides both on a phone', () => {
  const css = cssText();
  assert.match(css, /\.story-page\.ev-closed \.panes \{ grid-template-columns: 320px minmax\(0, 1fr\) 52px; \}/);
  assert.match(css, /\.story-page\.ev-none \.panes \{ grid-template-columns: 320px minmax\(0, 1fr\); grid-template-areas: "list card"; \}/);
  assert.match(css, /\.story-page\.ev-none \.c-ev \{ display: none; \}/);
  assert.match(css, /@media \(min-width: 761px\) \{ \.story-page\.ev-closed \.c-ev > :not\(\.evrail\) \{ display: none; \} \}/);
  assert.match(css, /@media \(max-width: 760px\) \{[^@]*\.story-page \.evclose, \.story-page \.evrail \{ display: none/);
});

test('A9: on a refactor page e closes the pane to its rail and opens it again, as on a debate page', async () => {
  const dom = await boot(htmlOf({ kind: 'refactor', title: 'R', lang: 'en', decisions: [{ id: 'S1', title: 'Do it', brief: 'Do S1.', code: { before: 'a', after: 'b' } }] }), '#d-S1');
  assert.ok(!evClosed(dom) && !evNone(dom));
  assert.ok(dom.press('e').defaultPrevented);
  assert.ok(evClosed(dom), 'e closes it');
  assert.ok(dom.press('e').defaultPrevented);
  assert.ok(!evClosed(dom), 'e opens it again');
});

test('A9: a refactor card with nothing for its pane has none (body.ev-none), and e does nothing there', async () => {
  const dom = await boot(htmlOf({ kind: 'refactor', title: 'R', lang: 'en', decisions: [{ id: 'S1', title: 'Do it' }] }), '#d-S1');
  assert.ok(evNone(dom));
  assert.ok(!evClosed(dom));
  assert.ok(!dom.press('e').defaultPrevented);
});

// Review fixes of db8dde1.
test('the card\'s accepts shows in the recommended option\'s trade-off, not as a closing line of the whole question', async () => {
  const g = cardGate();
  g.decisions[0].accepts = 'One extra click.';
  const dom = await boot(htmlOf(g), '#d-D1');
  const secs = secsOf(dom, 'D1'), rec = secs[1];
  assert.ok(textOf(one(rec, '.otrade')).includes('One extra click.'), 'the recommended option\'s Accepts row');
  assert.strictEqual(q(secs[0], '.otrade').length, 0);
  assert.strictEqual(q(paneOf(dom, 'D1'), '.accfoot').length, 0);
  const none = cardGate();
  none.decisions[0].accepts = 'One extra click.';
  none.decisions[0].options.forEach(o => { delete o.recommended; });
  const d2 = await boot(htmlOf(none), '#d-D1');
  assert.strictEqual(q(paneOf(d2, 'D1'), '.accfoot').length, 1, 'with no recommended option it stays in the whole question');
});

test('the comparison table says Breaks, as the rows do', async () => {
  const dom = await cardPage('#d-D2');
  assert.strictEqual(textOf(one(one(paneOf(dom, 'D2'), '.ocomp'), '.lift')), 'Breaks K4');
});

test('the phone grid override, the 44px picker segments and the recommended row\'s rule are pinned in the CSS', () => {
  const css = cssText();
  assert.match(css, /@media \(max-width: 760px\) \{[^@]*\.story-page \.panes \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(css, /@media \(max-width: 760px\) \{[^@]*\.story-page \.oseg button \{ min-height: 44px; \}/);
  assert.ok(!/\.orow\.is-rec/.test(css), 'the recommended row has no fill of its own');
  assert.match(css, /\.story-page \.orow \{[^}]*background: var\(--panel\)/);
  assert.match(css, /\.story-page \.otags \.rectag \{ margin: 0; \}/);
});

test('A9: [ and ] on a refactor page step the pane\'s option, as on a debate page; the list does not fold', async () => {
  const two = [{ value: 'a', label: 'Inline', recommended: true, accepts: 'A longer file', brief: 'Inline it.', tradeoff: { tech: 'One file less' } }, { value: 'b', label: 'Extract', brief: 'Extract it.', tradeoff: { tech: 'One more file' } }];
  const dom = await boot(htmlOf({ kind: 'refactor', title: 'R', lang: 'en', decisions: [{ id: 'S1', title: 'Do it', options: two }] }), '#d-S1');
  assert.deepStrictEqual(shownSecs(dom, 'S1'), ['Inline']);
  assert.ok(dom.press(']').defaultPrevented);
  assert.deepStrictEqual(shownSecs(dom, 'S1'), ['Extract']);
  assert.ok(dom.press('[').defaultPrevented);
  assert.deepStrictEqual(shownSecs(dom, 'S1'), ['Inline']);
  assert.ok(!dom.body.classList.contains('side-rail'), 'the list keeps its width');
});

test('a click on a Breaks badge does not pick its row', async () => {
  const dom = await cardPage('#d-D2');
  const row = rowsOf(dom, 'D2')[0];
  // The fake DOM does not bubble: hand the row's own listener a click whose target is the badge, as a real click reaches it.
  [one(row, '.tbreak'), one(row, '.tbw')].forEach(t => row.listeners.click.forEach(f => f({ type: 'click', target: t })));
  rowsOf(dom, 'D2').forEach(r => assert.ok(!r.classList.contains('chosen')));
  row.click();
  assert.ok(rowsOf(dom, 'D2')[0].classList.contains('chosen'), 'the row itself still picks');
});

test('on a phone, a card or row with no evidence hides the Evidence tab, and a card with evidence shows it again', async () => {
  const dom = await bootWith('#d-D3', d => { narrowMedia(d, true); });
  assert.ok(evNone(dom), 'D3 has no evidence: body.ev-none');
  assert.match(cssText(), /@media \(max-width: 760px\) \{[^@]*\.story-page\.ev-none \.tabs button\[data-tab="ev"\] \{ display: none; \}/);
  dom.press('k'); // D2, with evidence
  assert.ok(!evNone(dom), 'D2 has evidence: the tab is back');
  dom.press('j'); // D3
  assert.ok(evNone(dom));
});

test('on a phone, being on the Evidence tab and moving to a card with no evidence switches to the Card tab', async () => {
  const dom = await bootWith('#d-D2', d => { narrowMedia(d, true); });
  dom.document.getElementById('tabs').children.filter(b => b.dataset.tab === 'ev')[0].click();
  assert.strictEqual(tabOf(dom), 'ev');
  dom.press('j'); // D3, no evidence
  assert.ok(evNone(dom));
  assert.strictEqual(tabOf(dom), 'card');
});

// A debate page's list has two states, open or a 52px rail of marks and ids (the human, 2026-11-11).
const SIDE_KEY = 'team-view:sidebar:Cards';
const sideBtn = (dom, label) => q(dom.document.getElementById('sideHead'), '.icon-btn').filter(b => b.getAttribute('aria-label') === label)[0];
const sideRailed = dom => dom.body.classList.contains('side-rail');

test('list rail: a debate page has no hide button; the narrow button toggles open and rail; the state is stored', async () => {
  const dom = await cardPage('#d-D1');
  assert.strictEqual(q(dom.document, 'button[aria-label="Hide the list"]').length, 0, 'no third state');
  assert.strictEqual(q(dom.document, '.siderail').length, 0);
  sideBtn(dom, 'Narrow the list').click();
  assert.ok(sideRailed(dom));
  assert.strictEqual(dom.store.get(SIDE_KEY), 'rail');
  sideBtn(dom, 'Widen the list').click();
  assert.ok(!sideRailed(dom));
  assert.strictEqual(dom.store.get(SIDE_KEY), 'open');
  const again = await boot(htmlOf(cardGate()), '#d-D1', d => d.store.set(SIDE_KEY, 'rail'));
  assert.ok(sideRailed(again), 'remembered');
});

test('list rail: a stored "closed" opens a debate page on the rail, and there is no top-bar open button', async () => {
  const dom = await boot(htmlOf(cardGate()), '#d-D1', d => d.store.set(SIDE_KEY, 'closed'));
  assert.ok(sideRailed(dom));
  assert.ok(!dom.body.classList.contains('side-closed'));
  assert.strictEqual(q(dom.document, '.side-open').length, 0);
});

test('list rail: a refactor page has no hide button either; a stored "closed" opens it on the rail', async () => {
  const html = htmlOf({ kind: 'refactor', title: 'R', lang: 'en', decisions: [{ id: 'S1', title: 'Do it', brief: 'Do S1.', code: { before: 'a', after: 'b' } }] });
  const dom = await boot(html, '#d-S1');
  assert.strictEqual(q(dom.document, 'button[aria-label="Hide the list"]').length, 0);
  assert.strictEqual(q(dom.document, '.side-open').length, 0);
  sideBtn(dom, 'Narrow the list').click();
  assert.ok(sideRailed(dom));
  const again = await boot(html, '#d-S1', d => d.store.set('team-view:sidebar:R', 'closed'));
  assert.ok(sideRailed(again));
  assert.ok(!again.body.classList.contains('side-closed'));
});

test('list rail: the CSS makes the debate rail 52px with each id under its mark, on desktop and tablet only', () => {
  const css = cssText();
  assert.match(css, /@media \(min-width: 761px\) \{\n  \.story-page\.side-rail \.panes \{ grid-template-columns: 52px minmax\(0, 1fr\) 460px; \}/);
  assert.match(css, /\.story-page\.side-rail \.row \{ flex-direction: column; align-items: center;/);
  assert.match(css, /\.story-page\.side-rail \.node \{ left: 50% !important; top: 14px !important; \}/);
  assert.ok(!/:not\(\.story-page\)/.test(css), 'no transitional rules for the other kinds');
  assert.match(css, /\.story-page\.ev-closed\.side-rail \.panes \{ grid-template-columns: 52px minmax\(0, 1fr\) 52px; \}/);
  assert.match(css, /\.story-page\.ev-none\.side-rail \.panes \{ grid-template-columns: 52px minmax\(0, 1fr\); \}/);
  assert.ok(!/siderail/.test(css), 'the closed list rail is gone');
  assert.ok(!/\.story-page[^{]*side-closed/.test(css), 'a debate page is never closed');
  assert.match(css, /@media \(max-width: 760px\) \{[^@]*\.story-page\.side-rail \.panes, \.story-page\.ev-none\.side-rail \.panes, \.story-page\.ev-closed\.side-rail \.panes \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(css, /@media \(min-width: 761px\) \{\n  \.side-rail #side \.phead \{/, 'a stored rail does not strip the phone List tab');
});

// Context rows with cases, facts and a note (a6).
test('a context row renders cases, then facts, then its note, inside its story block after the drawing; its pane stays empty', async () => {
  const g = domGate(STORY3, { context: [{
    id: 'C1', title: 'Where', why: 'The stake.', figures: [{ caption: 'f', svg: '<svg viewBox="0 0 1 1"></svg>' }],
    cases: [{ title: 'One', tag: 'A', text: 'first' }, { title: 'Two', tag: 'B', text: 'second' }, { title: 'Three', tag: 'A', text: 'third' }],
    facts: [{ label: 'Recommendation', text: 'Do **it**.' }, { label: 'Out of scope', text: 'Billing.' }],
    note: 'Source: audit.'
  }], story: ['C1', 'D1', 'D2', 'D3'] });
  const dom = await boot(htmlOf(g), '#d-C1');
  const card = dom.document.getElementById('d-C1');
  const kids = one(card, '.sblock').children.map(c => c.className);
  const at = cls => kids.findIndex(k => k.split(' ').includes(cls));
  assert.ok(at('lead') >= 0 && at('lead') < at('sdraw') && at('sdraw') < at('cases') && at('cases') < at('facts') && at('facts') < at('ctxnote'), kids.join(' | '));
  assert.deepStrictEqual(q(card, '.case-hd').map(h => textOf(h.children[0])), ['One', 'Two', 'Three']);
  assert.deepStrictEqual(q(card, '.ctag').map(t => t.className.split(' ').pop()), ['t0', 't1', 't0']);
  assert.deepStrictEqual(q(card, '.flabel').map(textOf), ['Recommendation', 'Out of scope']);
  assert.strictEqual(textOf(one(card, '.ctxnote')), 'Source: audit.');
  assert.ok(evNone(dom), 'nothing for the pane: body.ev-none');
  const css = cssText();
  assert.match(css, /\.story-page \.cases \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); gap: 14px; \}/);
  assert.match(css, /@media \(max-width: 1100px\) \{ \.story-page \.cases \{ grid-template-columns: minmax\(0, 1fr\); \} \}/);
  assert.match(css, /@media \(max-width: 760px\) \{[^@]*\.story-page \.cases \{ grid-template-columns: minmax\(0, 1fr\); \}/);
});

// A9 step 2: the list of every deciding kind is the story list.
const listIds = dom => dom.document.querySelectorAll('.row').map(r => r.id.replace(/^r-/, ''));
const twoOpts = extra => Object.assign({ options: [{ value: 'a', label: 'A', recommended: true }, { value: 'b', label: 'B', negative: true }] }, extra || {});

test('A9 list: a plan page starts with its context row, then the story order, the minor items, and the recap closes the list', async () => {
  const dom = await boot(htmlOf({
    kind: 'plan', title: 'P', lang: 'en',
    context: [{ id: 'C1', title: 'Where we are', why: 'The stake.', outcome: 0 }],
    outcome: [{ view: 'ui', caption: 'The screen', after: { svg: '<svg viewBox="0 0 10 10"></svg>' } }],
    story: ['C1', 'D3', 'D1'],
    decisions: [
      Object.assign({ id: 'D1', title: 'First' }, twoOpts()),
      Object.assign({ id: 'D2', title: 'Small', minor: true }, twoOpts()),
      Object.assign({ id: 'D3', title: 'Third' }, twoOpts())
    ]
  }), '#d-D3');
  assert.deepStrictEqual(listIds(dom), ['C1', 'D3', 'D1', 'D2', '_recap'], 'no summary row on a plan page');
  assert.ok(dom.body.classList.contains('story-page'));
  assert.strictEqual(q(dom.document, 'button[aria-label="Hide the list"]').length, 0, 'two list states only');
  assert.strictEqual(listIds(dom).slice(-1)[0], '_recap');
});

test('A9 list: a review page without "story" keeps its gate order, and has the recap row', async () => {
  const dom = await boot(htmlOf({
    kind: 'review', title: 'R', lang: 'en',
    decisions: ['CR-1', 'SE-1', 'CF-1', 'IN-1'].map(id => Object.assign({ id, title: 'Finding ' + id }, twoOpts()))
  }), '#d-CR-1');
  assert.deepStrictEqual(listIds(dom), ['CR-1', 'SE-1', 'CF-1', 'IN-1', '_recap']);
});

test('A9 list: a refactor list has no group heading, and "after" hangs the dependents under their base on a dashed rail', async () => {
  const st = (id, extra) => Object.assign({ id, title: 'Step ' + id, group: 'Backlog', brief: 'Do ' + id + '.' }, extra);
  const dom = await boot(htmlOf({
    kind: 'refactor', title: 'R', lang: 'en',
    decisions: [st('S0'), st('S1', { after: ['S0'] }), st('S2', { after: ['S0'] }), st('S3', { after: ['S0'] }), st('S4', { after: ['S0'] }), st('S5', { on: { id: 'S1' } })]
  }), '#d-S0');
  assert.deepStrictEqual(listIds(dom), ['S0', 'S1', 'S5', 'S2', 'S3', 'S4', '_recap']);
  assert.ok(!textOf(dom.document.getElementById('list')).includes('Backlog'), 'no group heading');
  assert.strictEqual(q(dom.document, '.gname').filter(g => textOf(g) === 'Backlog').length, 0);
  const rails = id => dom.document.getElementById('r-' + id).children[0].innerHTML;
  const depth = id => (nodeX(dom, id) - 18) / 22;
  assert.deepStrictEqual(['S0', 'S1', 'S5', 'S2', 'S3', 'S4'].map(depth), [0, 1, 2, 1, 1, 1]);
  assert.ok(rails('S1').includes('rh after') && rails('S1').includes('rv after'), rails('S1'));
  assert.ok(rails('S2').includes('rh after'), rails('S2'));
  assert.ok(/class="rh[" ]/.test(rails('S5')) && !rails('S5').includes('rh after'), 'on stays solid: ' + rails('S5'));
  assert.ok(/Needs\s*S0\s*first/.test(textOf(dom.document.getElementById('r-S2'))));
  assert.ok(textOf(dom.document.getElementById('r-S0')).includes('Base for 4 cards'), textOf(dom.document.getElementById('r-S0')));
});

test('A9 list: an "after" card with a row between its base and it that is not under the base gets no rail, only the word', async () => {
  const st = (id, extra) => Object.assign({ id, title: 'Step ' + id, group: 'Backlog', brief: 'Do ' + id + '.' }, extra);
  const dom = await boot(htmlOf({
    kind: 'refactor', title: 'R', lang: 'en',
    decisions: [st('S0'), st('S1'), st('S2', { after: ['S0'] })]
  }), '#d-S0');
  const ids = listIds(dom);
  assert.strictEqual(ids.indexOf('S1') - ids.indexOf('S0'), 1, ids.join());
  assert.strictEqual(ids.indexOf('S2') - ids.indexOf('S1'), 1, ids.join());
  const rails = id => dom.document.getElementById('r-' + id).children[0].innerHTML;
  assert.ok(!rails('S2').includes('class="rh'), rails('S2'));
  assert.strictEqual(nodeX(dom, 'S2'), nodeX(dom, 'S0'));
  assert.ok(/Needs\s*S0\s*first/.test(textOf(dom.document.getElementById('r-S2'))));
});

test('A9 pane: a card whose options carry no argument has no For/Against columns; one with arguments keeps "No argument raised" on the others', async () => {
  const dom = await boot(htmlOf({
    kind: 'review', title: 'R', lang: 'en',
    decisions: [
      Object.assign({ id: 'CR-1', title: 'Bare' }, twoOpts()),
      { id: 'CR-2', title: 'Argued', options: [
        { value: 'a', label: 'A', recommended: true, for: [arg('PO', 'It is cheap.')] },
        { value: 'b', label: 'B', negative: true }
      ] }
    ]
  }), '#d-CR-1');
  assert.strictEqual(q(paneOf(dom, 'CR-1'), '.argcol').length, 0);
  assert.strictEqual(q(paneOf(dom, 'CR-1'), '.oargs').length, 0);
  assert.strictEqual(q(paneOf(dom, 'CR-2'), '.oargs').length, 2, 'every option of an argued card has its columns');
  assert.ok(textOf(paneOf(dom, 'CR-2')).includes('No argument raised'));
});

// A9 final review fixes.
const { shareGate } = require('./helpers');
const warningsOf = gate => render(writeGate(gate)).stderr;

test('A9 fix: a card whose only evidence is its constraints keeps its pane', async () => {
  for (const kind of ['refactor', 'review']) {
    const dom = await boot(htmlOf({ kind, title: 'T', lang: 'en', decisions: [{ id: 'D1', title: 'Do it', constraints: [K4] }] }), '#d-D1');
    assert.ok(!evNone(dom), kind + ': the pane is not hidden');
    assert.strictEqual(q(paneOf(dom, 'D1'), '.klist').length, 1, kind + ': the constraint list is in it');
  }
});

test('A9 fix: a plain Approve/Decline card shows its accepts under the whole question, with the plain label', async () => {
  const dom = await boot(htmlOf({ kind: 'refactor', title: 'R', lang: 'en', decisions: [{ id: 'S1', title: 'Do it', accepts: 'One more file.' }] }), '#d-S1');
  const foot = q(paneOf(dom, 'S1'), '.accfoot');
  assert.strictEqual(foot.length, 1);
  assert.strictEqual(textOf(foot[0]), 'Accepts: One more file.');
  assert.ok(!evNone(dom));
});

test('A9 fix: with no recommended option the card\'s accepts closes the whole question, never "The recommended option accepts"', async () => {
  const dom = await boot(htmlOf({ kind: 'refactor', title: 'P', lang: 'en', decisions: [{ id: 'D1', title: 'Pick', accepts: 'A cost.', options: [
    { value: 'a', label: 'A', tradeoff: { tech: 'x' } }, { value: 'b', label: 'B' }, { value: 'none', label: 'None', negative: true }] }] }), '#d-D1');
  const foot = q(paneOf(dom, 'D1'), '.accfoot');
  assert.strictEqual(foot.length, 1);
  assert.strictEqual(textOf(foot[0]), 'Accepts: A cost.');
  assert.ok(!textOf(paneOf(dom, 'D1')).includes('recommended option accepts'));
});

test('A9 fix: a review gate with no context row warns that the posted body has no verdict; a cover silences it', () => {
  const msg = 'a review gate with no context row posts a review body with no verdict: put the cover first';
  assert.ok(warningsOf(shareGate()).includes(msg));
  assert.ok(!warningsOf(Object.assign(shareGate(), cover([{ label: 'Blockers', text: 'None' }]))).includes(msg));
  assert.ok(!warningsOf(debateGate()).includes(msg), 'only a review gate');
});

test('A9 fix: a context row title over 70 characters warns on an acceptance gate too', () => {
  const long = 'x'.repeat(71);
  const base = { kind: 'acceptance', title: 'A', lang: 'en', branch: 'b', commit: 'abcdef1', cases: [{ id: 'A1', title: 'x', steps: ['s'], expected: 'e', unshown: 'no screen' }] };
  assert.ok(warningsOf(Object.assign({}, base, { context: [{ id: 'I0', title: long }] })).includes('I0 title is 71 characters: keep a list title under 70'));
  assert.ok(!warningsOf(Object.assign({}, base, { context: [{ id: 'I0', title: 'short' }] })).includes('characters'));
});

test('A9 fix: the negative option is shown last on every deciding kind', () => {
  for (const kind of ['plan', 'kickoff', 'refactor', 'review']) {
    const g = { kind, title: 'T', lang: 'en', decisions: [{ id: 'D1', title: 'Pick', unillustrated: 'x', options: [
      { value: 'none', label: 'Leave it', negative: true }, { value: 'a', label: 'A', recommended: true }, { value: 'b', label: 'B' }] }] };
    const out = loadGate(writeGate(g), {});
    assert.deepStrictEqual(out.items[0].options.map(o => o.value), ['a', 'b', 'none'], kind);
  }
});

test('A9 fix: a review body takes an array or bulleted why of the cover as one line', () => {
  for (const why of [['Mergeable.', 'One nit.'], '- Mergeable.\n- One nit.']) {
    const file = writeGate(Object.assign(shareGate(), cover([{ label: 'Blockers', text: 'None' }], { why })));
    assert.strictEqual(render(file, '--share', '--review=github', '--head=abc1234def5678').code, 0);
    const body = JSON.parse(fs.readFileSync(file.replace(/\.gate\.json$/, '.review.github.json'), 'utf8')).body;
    assert.strictEqual(body.split('\n\n')[1], 'Mergeable.; One nit.');
  }
});

// The card's illustration (2026-11-12): the story block draws the card's diff, suggestion or examples when it has no figure.
const drawOf = (dom, id) => q(sblockOf(dom, id), '.sdraw');
const REFAC = { before: 'old()', after: 'neu()' };
test('storyView drawing: figure, else the card\'s code (no option code), else its suggestion, else its examples (no option examples)', () => {
  const src = composedTemplate().match(/\/\*STORY-START\*\/([\s\S]*?)\/\*STORY-END\*\//)[1];
  const ctx = {}; vm.createContext(ctx); vm.runInContext(src, ctx);
  const d = it => JSON.parse(JSON.stringify(ctx.storyView(it).drawing));
  const sug = { text: 'x', lines: 1 };
  assert.deepStrictEqual(d({ id: 'A', figures: [{ svg: 'f' }], code: REFAC, suggestion: sug, examples: [ROW] }), { svg: 'f' });
  assert.deepStrictEqual(d({ id: 'A', code: REFAC, suggestion: sug, examples: [ROW] }), { code: REFAC });
  assert.deepStrictEqual(d({ id: 'A', code: REFAC, options: [{ value: 'a', label: 'A', code: { after: 'z' } }], suggestion: sug }), { suggestion: sug });
  assert.deepStrictEqual(d({ id: 'A', suggestion: sug, examples: [ROW] }), { suggestion: sug });
  assert.deepStrictEqual(d({ id: 'A', examples: [ROW] }), { examples: [ROW] });
  assert.strictEqual(d({ id: 'A', examples: [ROW], options: [{ value: 'a', label: 'A', examples: [ROW] }] }), null);
  assert.strictEqual(d({ id: 'A', options: [{ value: 'a', label: 'A', suggestion: sug }] }), null, 'an option\'s suggestion stays in the pane');
});

test('a refactor card with its own code and no option code draws the diff in its story block, not in the pane', async () => {
  const dom = await boot(htmlOf({ kind: 'refactor', title: 'R', lang: 'en', decisions: [{ id: 'S1', title: 'Do it', brief: 'Do S1.', code: REFAC }] }), '#d-S1');
  assert.strictEqual(drawOf(dom, 'S1').length, 1);
  assert.strictEqual(q(one(sblockOf(dom, 'S1'), '.sdraw'), '.code').length, 2, 'before and after');
  assert.strictEqual(q(paneOf(dom, 'S1'), '.code').length, 0);
});

test('the same card where an option has its own code keeps the diff in the pane and draws none in the story block', async () => {
  const dom = await boot(htmlOf({ kind: 'refactor', title: 'R', lang: 'en', decisions: [{ id: 'S1', title: 'Do it', brief: 'Do S1.', code: { before: 'old()' },
    options: [opt('a', 'Alpha', { recommended: true, code: { after: 'alt()' } }), opt('n', 'None', { negative: true })] }] }), '#d-S1');
  assert.strictEqual(drawOf(dom, 'S1').length, 0);
  assert.ok(q(paneOf(dom, 'S1'), '.code').length >= 2);
});

test('a review card with a suggestion and no code draws it in its story block, with its location in the pane', async () => {
  const dom = await boot(htmlOf({ kind: 'review', title: 'R', lang: 'en', decisions: [Object.assign({ id: 'CR-1', title: 'Rate', at: { path: 'src/x.js', line: 10 }, suggestion: { lines: 2, text: 'a\nb' } }, twoOpts())] }), '#d-CR-1');
  const draw = one(sblockOf(dom, 'CR-1'), '.sdraw');
  assert.ok(draw && textOf(draw).includes('Replace 2 lines from line 10'), draw && textOf(draw));
  assert.strictEqual(q(paneOf(dom, 'CR-1'), '.code').length, 0);
  assert.strictEqual(q(paneOf(dom, 'CR-1'), '.loc').length, 1);
});

test('a card with examples and no figure or code draws the table in its story block; an emptied pane is body.ev-none', async () => {
  const dom = await boot(htmlOf({ kind: 'refactor', title: 'R', lang: 'en', decisions: [{ id: 'S1', title: 'Do it', examples: [ROW] }] }), '#d-S1');
  assert.strictEqual(q(one(sblockOf(dom, 'S1'), '.sdraw'), '.extable').length, 1);
  assert.strictEqual(q(paneOf(dom, 'S1'), '.extable').length, 0);
  assert.ok(evNone(dom), 'nothing left for the pane');
});

test('a card with a figure keeps the figure as its drawing and its code in the pane', async () => {
  const dom = await boot(htmlOf({ kind: 'refactor', title: 'R', lang: 'en', decisions: [{ id: 'S1', title: 'Do it', brief: 'Do S1.', code: REFAC, figures: [{ svg: '<svg viewBox="0 0 10 10"></svg>', caption: 'x' }] }] }), '#d-S1');
  assert.strictEqual(q(one(sblockOf(dom, 'S1'), '.sdraw'), '.code').length, 0);
  assert.strictEqual(q(one(sblockOf(dom, 'S1'), '.sdraw'), '.figure').length, 1);
  assert.ok(q(paneOf(dom, 'S1'), '.code').length >= 2);
});

test('the code, suggestion and table drawn in a story block are left-aligned and full width', () => {
  const css = cssText();
  assert.match(css, /\.story-page \.sblock > \.sdraw\.sdoc \{ text-align: left;/);
});

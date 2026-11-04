const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { RENDER } = require('./helpers');

const TEMPLATE = fs.readFileSync(path.join(path.dirname(RENDER), 'template.html'), 'utf8');
const prompt = vm.runInNewContext(TEMPLATE.match(/\/\*PROMPT-START\*\/([\s\S]*?)\/\*PROMPT-END\*\//)[1]
  + '\n({ relyLines: relyLines, buildPrompt: buildPrompt, buildReview: buildReview, mootBy: mootBy, missingAfter: missingAfter, decisionsBlock: decisionsBlock, acceptRecommended: acceptRecommended, relyType: relyType, reverseAfter: reverseAfter, buildItemPrompt: buildItemPrompt, itemBlock: itemBlock })');

const items = [
  { kind: 'decision', id: 'S0', title: 'Tests', options: [{ value: 'approve', label: 'Approve' }, { value: 'decline', label: 'Decline', negative: true }] },
  { kind: 'decision', id: 'S1', title: 'Extract', after: ['S0'], options: [{ value: 'approve', label: 'Approve' }] },
  { kind: 'decision', id: 'N6', title: 'Gate', on: { id: 'S1' }, block: 'S1', options: [{ value: 'fix', label: 'Fix' }] }
];

test('relyLines gives each relied-on card and its current choice', () => {
  assert.deepEqual(prompt.relyLines(items[1], items, { S0: { choice: 'approve' } }), [{ id: 'S0', label: 'Approve', negative: false }]);
  assert.deepEqual(prompt.relyLines(items[1], items, {}), [{ id: 'S0', label: null, negative: false }]);
  assert.deepEqual(prompt.relyLines(items[2], items, { S1: { choice: 'approve' } }), [{ id: 'S1', label: 'Approve', negative: false }]);
  assert.deepEqual(prompt.relyLines(items[0], items, {}), []);
});

test('the review body counts posted findings and lists settled items, never as threads', () => {
  const its = [
    { kind: 'decision', id: 'F1', title: 'Bug', at: { path: 'a.js', line: 3 }, options: [{ value: 'fix', label: 'Fix' }, { value: 'leave', label: 'Leave', negative: true }] },
    { kind: 'decision', id: 'F2', title: 'Nit', minor: true, options: [{ value: 'fix', label: 'Fix' }] },
    { kind: 'decision', id: 'F3', title: 'Dropped', options: [{ value: 'fix', label: 'Fix' }, { value: 'leave', label: 'Leave', negative: true }] },
    { kind: 'settled', id: 'A1', title: 'Why a new role?', answer: 'Asked the author', source: 'MR description', who: 'Intent', options: [{ value: 'ok', label: 'OK' }, { value: 'reopen', label: 'Reopen' }] }
  ];
  const state = { F1: { choice: 'fix' }, F2: { choice: 'fix' }, F3: { choice: 'leave' }, A1: { choice: 'ok' } };
  const rv = prompt.buildReview({ kind: 'review', title: 'R', lang: 'en' }, its, state, () => true, 'github');
  assert.match(rv.body, /Findings posted — major: 1, minor: 1\./);
  assert.match(rv.body, /### Settled without a question\n- A1 — Why a new role\?: Asked the author \(Intent\)/);
  assert.deepEqual(rv.comments.map(c => c.id), ['F1']);
  const fr = prompt.buildReview({ kind: 'review', title: 'R', lang: 'fr' }, its, state, () => true, 'github');
  assert.match(fr.body, /Constats publiés — majeurs : 1, mineurs : 1\./);
});

test('a reopened settled item shows in the review body as an open question', () => {
  const its = [{ kind: 'settled', id: 'A1', title: 'Gate per call?', answer: 'Per call', source: 'x.ts:4', who: 'Evidence', options: [{ value: 'ok', label: 'OK' }, { value: 'reopen', label: 'Reopen' }] }];
  const rv = prompt.buildReview({ kind: 'review', title: 'R', lang: 'en' }, its, { A1: { choice: 'reopen', note: 'check the cache' } }, () => true, 'github');
  assert.match(rv.body, /### Reopened — to discuss\n- A1 — Gate per call\? — check the cache/);
  assert.doesNotMatch(rv.body, /Settled without a question/);
  const bare = prompt.buildReview({ kind: 'review', title: 'R', lang: 'en' }, its, { A1: { choice: 'reopen' } }, () => true, 'github');
  assert.match(bare.body, /### Reopened — to discuss\n- A1 — Gate per call\?$/);
  const fr = prompt.buildReview({ kind: 'review', title: 'R', lang: 'fr' }, its, { A1: { choice: 'reopen' } }, () => true, 'github');
  assert.match(fr.body, /### Rouvert — à discuter\n- A1 — Gate per call\?/);
});

test('a reopened settled item is an open question in the prompt', () => {
  const its = [{ kind: 'settled', id: 'A1', title: 'Gate per call?', answer: 'Per call', source: 'x.ts:4', who: 'Evidence', options: [{ value: 'ok', label: 'OK' }, { value: 'reopen', label: 'Reopen' }] }];
  const out = prompt.buildPrompt({ lang: 'en', preamble: '' }, its, { A1: { choice: 'reopen' } });
  assert.match(out, /- A1 — Gate per call\? \(Per call\)/);
  const ok = prompt.buildPrompt({ lang: 'en', preamble: '' }, its, { A1: { choice: 'ok' } });
  assert.match(ok, /## Already checked\n.*\n- A1 — Gate per call\? → Per call \(Evidence\)/);
  assert.doesNotMatch(ok, /## Undecided/);
});

test('the template renders blocks, the reliance line and the settled section; no page constraints', () => {
  assert.doesNotMatch(TEMPLATE, /head-constraints/);
  assert.match(TEMPLATE, /sectionFor\('Settled without you', true\)/);
  assert.match(TEMPLATE, /function home\(it\)/);
  assert.match(TEMPLATE, /'answer it first ↑'/);
  assert.match(TEMPLATE, /className = 'block'|el\('div', 'block'\)/);
});

const mootItems = [
  { kind: 'decision', id: 'D1', title: 'Transport', options: [{ value: 'ws', label: 'WebSocket' }, { value: 'hand', label: 'By hand', recommended: true }, { value: 'decline', label: 'Decline', negative: true }] },
  { kind: 'decision', id: 'M3', title: 'Port', block: 'D1', on: { id: 'D1', when: ['ws'] }, options: [{ value: 'fix', label: 'Fix', recommended: true }] },
  { kind: 'decision', id: 'N7', title: 'Too', block: 'D1', on: { id: 'M3' }, options: [{ value: 'fix', label: 'Fix' }] }
];
const D = { title: 'T' };

test('mootBy: a child is moot when its root answered outside "when", or negative, or its own root is moot', () => {
  assert.strictEqual(prompt.mootBy(mootItems[1], mootItems, {}), null);
  assert.strictEqual(prompt.mootBy(mootItems[1], mootItems, { D1: { choice: 'ws' } }), null);
  const m = prompt.mootBy(mootItems[1], mootItems, { D1: { choice: 'hand' } });
  assert.strictEqual(m.id, 'D1'); assert.strictEqual(m.value, 'hand'); assert.strictEqual(m.label, 'By hand');
  const no = [mootItems[0], Object.assign({}, mootItems[1], { on: { id: 'D1' } })];
  assert.strictEqual(prompt.mootBy(no[1], no, { D1: { choice: 'decline' } }).value, 'decline');
  assert.strictEqual(prompt.mootBy(no[1], no, { D1: { choice: 'ws' } }), null);
  assert.ok(prompt.mootBy(mootItems[2], mootItems, { D1: { choice: 'hand' }, M3: { choice: 'fix' } }));
  assert.strictEqual(prompt.mootBy(mootItems[2], mootItems, { D1: { choice: 'ws' } }), null);
});

test('a moot card writes "= moot (...)" in the decisions block, whatever it stored', () => {
  const out = prompt.decisionsBlock(D, mootItems, { D1: { choice: 'hand' }, M3: { choice: 'fix' } });
  assert.match(out, /^M3 = moot \(D1 = hand\)$/m);
});

test('accept recommended skips a card that is moot', () => {
  const st = { D1: { choice: 'hand' } };
  prompt.acceptRecommended(mootItems, st);
  assert.strictEqual((st.M3 || {}).choice, undefined);
  assert.strictEqual((st.N7 || {}).choice, undefined);
});

test('the share prompt and the review skip moot cards', () => {
  const st = { D1: { choice: 'hand' }, M3: { choice: 'fix' } };
  assert.doesNotMatch(prompt.buildPrompt(D, mootItems, st), /M3/);
  assert.doesNotMatch(prompt.buildReview({ title: 'T', kind: 'review' }, mootItems, st, () => false, 'github').body, /M3/);
});

test('relyLines shows the root for every relation', () => {
  assert.deepEqual(prompt.relyLines(mootItems[1], mootItems, {}), [{ id: 'D1', label: null, negative: false }]);
});

test('a chain reports the upstream cause even when the middle card is moot and unset', () => {
  const st = { D1: { choice: 'hand' } };
  const m = prompt.mootBy(mootItems[2], mootItems, st);
  assert.strictEqual(m.id, 'D1'); assert.strictEqual(m.value, 'hand');
  assert.match(prompt.decisionsBlock(D, mootItems, st), /^N7 = moot \(D1 = hand\)$/m);
});

test('missingAfter does not list a moot dependency', () => {
  assert.deepEqual(prompt.missingAfter(mootItems[2], mootItems, { D1: { choice: 'hand' } }), []);
});

test('relyType tells "after" from "refines"; reverseAfter counts only after', () => {
  assert.equal(prompt.relyType(items[1], 'S0'), 'after');
  assert.equal(prompt.relyType(items[2], 'S1'), 'refines');
  assert.deepEqual(prompt.reverseAfter(items), { S0: ['S1'] });
});

test('the FR after strings reach the item prompt and the thread block', () => {
  const its = [
    { kind: 'decision', id: 'A', title: 'a', options: [{ value: 'ok', label: 'Ok' }] },
    { kind: 'decision', id: 'B', title: 'b', options: [{ value: 'ok', label: 'Ok' }] },
    { kind: 'decision', id: 'C', title: 'c', after: ['A', 'B'], options: [{ value: 'ok', label: 'Ok' }] },
    { kind: 'decision', id: 'D', title: 'd', after: ['A'], options: [{ value: 'ok', label: 'Ok' }] }
  ];
  const data = { lang: 'fr', items: its };
  const p = prompt.buildItemPrompt(data, its, its[2], its[2].options[0]);
  assert.match(p, /Vient après A, B : vérifie qu'ils sont faits/);
  assert.match(prompt.buildItemPrompt(data, its, its[3], its[3].options[0]), /Vient après A : vérifie que c'est fait/);
  const t = { suggestion: 's: ', noteOnly: 'n: ', afterThread: 'Vient après %s (voir son fil ou le corps de la revue).' };
  assert.match(prompt.itemBlock(data, its, {}, its[2], t, null, 'github').text, /Vient après A, B \(voir son fil/);
});

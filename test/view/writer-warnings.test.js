// test/view/writer-warnings.test.js
const test = require('node:test');
const assert = require('node:assert');
const { writeGate, render } = require('./helpers');
const { loadGate } = require('../../skills/team-view/lib/gate');

const K6 = { id: 'K6', lens: 'tech', text: 'One core everywhere', source: 'owner', status: 'confirmed' };
const warnsOf = g => loadGate(writeGate(g), {}).warnings;
const named = g => warnsOf(g).filter(w => w.includes(' names '));
const base = extra => Object.assign({
  kind: 'debate', title: 'Codes', lang: 'en',
  decisions: [{ id: 'D1', title: 'Which core?', unillustrated: 'none', constraints: [K6], detail: ['O1 fails K6; see D2', 'Built by `faust -lang P3`'],
    options: [{ value: 'a', label: 'One core (O3)', recommended: true }, { value: 'b', label: 'Not yet', negative: true }] },
  { id: 'D2', title: 'Second', unillustrated: 'none' }]
}, extra || {});

test('a code the page never defines warns, once per item, in first-seen order', () => {
  assert.deepStrictEqual(named(base()), ['D1 names O1, O3: a code this page never defines; write what each stands for']);
});

test('card ids, constraint ids and text in backticks are not codes', () => {
  const g = base(); g.decisions[0].detail = ['K6 holds; see D2', '`O1` stays'];
  g.decisions[0].options[0].label = 'One core';
  assert.deepStrictEqual(named(g), []);
});

test('context facts and tension sides are read too', () => {
  const g = base({ context: [{ id: 'C0', title: 'Cover', facts: [{ label: 'Answers', text: 'Bound, not bit-exact (Q1)' }] }],
    tensions: [{ id: 'T1', topic: 'FAUST path?', unillustrated: 'none', sides: [{ who: 'A1: into core', position: 'Compile it.', recommended: true }, { who: 'Host', position: 'Host it.' }] }] });
  g.decisions[0].detail = ['K6 holds']; g.decisions[0].options[0].label = 'One core';
  assert.deepStrictEqual(named(g), [
    'C0 names Q1: a code this page never defines; write what each stands for',
    'T1 names A1: a code this page never defines; write what each stands for'
  ]);
});

test('an ordinary word that looks like a code warns but never refuses the render', () => {
  const g = base(); g.decisions[0].detail = ['Printed on an A4 sheet']; g.decisions[0].options[0].label = 'One core';
  assert.deepStrictEqual(named(g), ['D1 names A4: a code this page never defines; write what each stands for']);
  assert.strictEqual(render(writeGate(g)).code, 0);
});

const card = (id, extra) => Object.assign({ id, title: 'Card ' + id, unillustrated: 'none' }, extra || {});
const cap = w => w.filter(x => x.includes('weighty cards'));

test('a debate page with more than 7 weighty cards warns; minor and structure cards do not count', () => {
  const eight = Array.from({ length: 8 }, (_, i) => card('D' + (i + 1)));
  assert.deepStrictEqual(cap(warnsOf({ kind: 'debate', title: 'Cap', lang: 'en', decisions: eight })),
    ['8 weighty cards (D1, D2, D3, D4, D5, D6, D7, D8): keep about 7; fold the rest to minor items with a default, by stakes']);
  const seven = eight.slice(0, 6).concat(card('D7', { title: 'Confirm the structure' }), card('M1', { minor: true, default: 'approve' }), card('D9'));
  assert.deepStrictEqual(cap(warnsOf({ kind: 'debate', title: 'Cap', lang: 'en', decisions: seven })), []);
  const fr = eight.slice(0, 7).concat(card('D8', { title: 'Confirmer la structure' }));
  assert.deepStrictEqual(cap(warnsOf({ kind: 'debate', title: 'Cap', lang: 'fr', decisions: fr })), []);
});

test('tensions count toward the cap; other kinds are not capped', () => {
  const g = { kind: 'debate', title: 'Cap', lang: 'en', decisions: Array.from({ length: 6 }, (_, i) => card('D' + (i + 1))),
    tensions: [1, 2].map(i => ({ id: 'T' + i, topic: 'Tie ' + i, unillustrated: 'none', sides: [{ who: 'A', position: 'Yes.', recommended: true }, { who: 'B', position: 'No.' }] })) };
  assert.strictEqual(cap(warnsOf(g)).length, 1);
  assert.deepStrictEqual(cap(warnsOf(Object.assign({}, g, { kind: 'refactor' }))), []);
});

test('a context row case is read (title, text, note); a case figure is not', () => {
  const g = base({ context: [{ id: 'C0', title: 'Cover', note: 'See Q7', cases: [{ title: 'Case Q1', text: 'Then Q2', figure: { svg: '<svg></svg>', caption: 'Q3' } }] }] });
  g.decisions[0].detail = ['K6 holds']; g.decisions[0].options[0].label = 'One core';
  assert.deepStrictEqual(named(g), ['C0 names Q7, Q1, Q2: a code this page never defines; write what each stands for']);
});

test('an old council page is capped like a debate', () => {
  const nine = Array.from({ length: 8 }, (_, i) => card('D' + (i + 1)));
  assert.strictEqual(cap(warnsOf({ kind: 'council', title: 'Cap', lang: 'en', decisions: nine })).length, 1);
});

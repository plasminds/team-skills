// Footprint cards: what a run changes outside the code it targets (a CI job, a dependency, a removal, the human's own work).
// The human answers each one: never minor, no default, outside the story and the cap, skipped by Accept recommended.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');

const { writeGate, render, fakeDom } = require('./helpers');
const { loadGate } = require('../../skills/team-view/lib/gate');

const card = (id, extra) => Object.assign({ id, title: 'Card ' + id, unillustrated: 'none' }, extra || {});
const FP = extra => card('F1', Object.assign({ title: 'Adds a nightly scheduled CI job', footprint: 'ci', source: 'plan.md:56' }, extra || {}));
const planGate = extra => Object.assign({
  kind: 'plan', title: 'Plan', lang: 'en', source: 'docs/plans/x.md',
  context: [{ id: 'C1', title: 'The pipeline after', outcome: 0 }],
  outcome: [{ view: 'system', caption: 'The pipeline', after: { svg: '<svg viewBox="0 0 10 10"></svg>' } }],
  decisions: [card('D1'), card('S1', { minor: true, default: 'approve' }), FP()]
}, extra || {});
const errorsOf = g => loadGate(writeGate(g), {}).errors;
const warnsOf = g => loadGate(writeGate(g), {}).warnings;
const has = (list, text) => assert.ok(list.some(e => e.includes(text)), `expected "${text}" in:\n${list.join('\n')}`);

test('a footprint card renders; --accept-recommended leaves it UNDECIDED', () => {
  const f = writeGate(planGate());
  const r = render(f, '--accept-recommended');
  assert.strictEqual(r.code, 0, r.stderr);
  assert.ok(r.stdout.includes('D1 = approve'));
  assert.ok(r.stdout.includes('S1 = approve'));
  assert.ok(r.stdout.includes('F1 = UNDECIDED'), r.stdout);
});

test('footprint is refused when minor, with a default, of an unknown class, or on another kind', () => {
  has(errorsOf(planGate({ decisions: [FP({ minor: true })] })), 'F1 has "footprint" and "minor"');
  has(errorsOf(planGate({ decisions: [FP({ default: 'approve' })] })), 'F1 has "footprint" and "default"');
  has(errorsOf(planGate({ decisions: [FP({ footprint: 'cost' })] })), '.footprint must be one of ci, deps, surface, removal, behavior, your-work, threshold');
  has(errorsOf(planGate({ settled: [{ id: 'A1', title: 'Q?', answer: 'A', source: 'x.js:1', who: 'CTO', footprint: 'ci' }] })), 'only a decision takes "footprint"');
});

test('a footprint card stands alone: no "on", no "after", nothing "on" it, never a story id', () => {
  has(errorsOf(planGate({ decisions: [card('D1'), FP({ on: { id: 'D1' } })] })), '"F1" is a footprint card: it takes no "on"');
  has(errorsOf(planGate({ decisions: [card('D1'), FP({ after: ['D1'] })] })), '"F1" is a footprint card: it takes no "after"');
  has(errorsOf(planGate({ decisions: [FP(), card('D2', { on: { id: 'F1' } })] })), '"D2".on names footprint card "F1"');
  has(errorsOf(planGate({ story: ['C1', 'D1', 'F1'] })), 'story[2] "F1" is a footprint card');
});

test('footprint cards stay out of the story and the 7-card cap', () => {
  const seven = Array.from({ length: 7 }, (_, i) => card('D' + (i + 1)));
  const fps = [1, 2, 3].map(i => FP({ id: 'F' + i }));
  const g = { kind: 'debate', title: 'Cap', lang: 'en', decisions: seven.concat(fps) };
  assert.deepStrictEqual(warnsOf(g).filter(w => w.includes('weighty cards')), []);
  assert.deepStrictEqual(loadGate(writeGate(planGate()), {}).story, ['C1', 'D1']);
});

test('more than 10 footprint cards warn, on every kind', () => {
  const fps = n => Array.from({ length: n }, (_, i) => FP({ id: 'F' + (i + 1) }));
  const fpWarn = g => warnsOf(g).filter(w => w.includes('footprint cards'));
  assert.deepStrictEqual(fpWarn(planGate({ decisions: [card('D1')].concat(fps(10)) })), []);
  const w = fpWarn(planGate({ decisions: [card('D1')].concat(fps(11)) }));
  assert.strictEqual(w.length, 1);
  assert.ok(w[0].startsWith('11 footprint cards (F1, '), w[0]);
});

// The page itself: a DOM run of the rendered HTML.
async function boot(html) {
  const dom = fakeDom(html);
  vm.createContext(dom.ctx);
  [...html.matchAll(/<script(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g)].forEach(m => vm.runInContext(m[1], dom.ctx));
  for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve));
  return dom;
}
const textOf = n => (n.textContent || '') + (n.children || []).map(textOf).join('');
function htmlOf(gate) {
  const f = writeGate(gate);
  const r = render(f);
  assert.strictEqual(r.code, 0, r.stderr);
  return fs.readFileSync(f.replace(/\.gate\.json$/, '.html'), 'utf8');
}

test('on the page: an open section after the story, its class tag, and Accept recommended leaves it open', async () => {
  const dom = await boot(htmlOf(planGate()));
  assert.deepStrictEqual(dom.document.querySelectorAll('.gname').map(textOf), ['Outside the code', 'Minor items']);
  assert.ok(dom.document.querySelectorAll('.sec-hint').map(textOf).some(t => t.startsWith('What this changes beyond the code')));
  assert.ok(textOf(dom.document.getElementById('d-F1')).includes('CI and infrastructure'));
  const recAll = dom.document.getElementById('recAll');
  assert.strictEqual(recAll.disabled, false);
  recAll.click();
  assert.strictEqual(recAll.disabled, true, 'only the footprint card is left: nothing for Accept recommended to take');
  assert.ok(/ 1 of 2$/.test(textOf(dom.document.getElementById('ptxt'))), textOf(dom.document.getElementById('ptxt')));
});

test('French chrome for the section and every class', async () => {
  const dom = await boot(htmlOf(planGate({ lang: 'fr' })));
  assert.deepStrictEqual(dom.document.querySelectorAll('.gname').map(textOf), ['Hors du code', 'Points mineurs']);
  assert.ok(textOf(dom.document.getElementById('d-F1')).includes('CI et infrastructure'));
});

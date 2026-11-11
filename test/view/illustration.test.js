const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');

const { writeGate, render, pageData, fakeDom } = require('./helpers');

// D2 Illustration (warn), step 6: a debate card with nothing drawn warns the writer; the page says nothing (the human's ruling, 2026-11-10).
const ROW = { given: 'a', when: 'b', then: 'c' };
const WARNING = 'D2 is not illustrated: give it examples or a figure, or say why in "unillustrated"';
const SVG = { svg: '<svg viewBox="0 0 10 10"></svg>' };

function gate(d2, overrides) {
  return Object.assign({
    kind: 'debate', title: 'Illustration', lang: 'en',
    decisions: [
      { id: 'D1', title: 'Drawn', examples: [ROW], options: [{ value: 'a', label: 'A', recommended: true }, { value: 'b', label: 'B' }, { value: 'none', label: 'Neither', negative: true }] },
      Object.assign({ id: 'D2', title: 'Bare', options: [{ value: 'a', label: 'A', recommended: true }, { value: 'b', label: 'B' }, { value: 'none', label: 'Neither', negative: true }] }, d2)
    ],
    story: ['D1', 'D2']
  }, overrides || {});
}

function htmlOf(g) {
  const f = writeGate(g);
  const r = render(f);
  assert.strictEqual(r.code, 0, r.stderr);
  return { html: fs.readFileSync(f.replace(/\.gate\.json$/, '.html'), 'utf8'), r };
}
async function boot(html, hash) {
  const dom = fakeDom(html);
  dom.ctx.location.hash = hash || '';
  vm.createContext(dom.ctx);
  [...html.matchAll(/<script(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g)].forEach(m => vm.runInContext(m[1], dom.ctx));
  for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve));
  return dom;
}
const textOf = n => (n.textContent || '') + (n.children || []).map(textOf).join('');
const silent = dom => {
  assert.ok(!/not illustrated|pas encore illustr/i.test(textOf(dom.document.body || dom.document)), 'no mention of illustration on the page');
  assert.strictEqual(dom.document.querySelectorAll('.ill-mark').length + dom.document.querySelectorAll('.ill-count').length, 0);
};
const cardOf = (dom, id) => dom.document.getElementById('d-' + id);

test('D2-1: a bare debate card renders and warns; the page shows no mark and no count', async () => {
  const { html, r } = htmlOf(gate({}));
  assert.ok(r.stderr.includes('warning: ' + WARNING), r.stderr);
  assert.ok(!r.stderr.includes('D1 is not illustrated'), r.stderr);
  assert.ok(!pageData(html).items.some(i => 'notIllustrated' in i));
  silent(await boot(html, '#d-D2'));
});

test('D2-2: with a reason, no warning; the page still shows nothing about it', async () => {
  const { html, r } = htmlOf(gate({ unillustrated: 'a signal to watch' }));
  assert.ok(!r.stderr.includes('warning:'), r.stderr);
  assert.ok(!pageData(html).items.some(i => 'notIllustrated' in i));
  const dom = await boot(html, '#d-D2');
  silent(dom);
  assert.ok(!textOf(dom.document.getElementById('d-D2')).includes('a signal to watch'));
});

test('D2-2: an empty or non-string unillustrated is refused', () => {
  [' ', 3].forEach(v => {
    const r = render(writeGate(gate({ unillustrated: v })));
    assert.strictEqual(r.code, 1, r.stderr);
    assert.ok(r.stderr.includes('decisions[1].unillustrated must be a non-empty string: why this card cannot be drawn'), r.stderr);
  });
});

test('D2-3: an old council gate with no illustration renders as today', () => {
  const f = writeGate(gate({}, { kind: 'council', story: undefined }));
  const r = render(f);
  assert.strictEqual(r.code, 0, r.stderr);
  assert.ok(!r.stderr.includes('not illustrated'), r.stderr);
  const data = pageData(fs.readFileSync(f.replace(/\.gate\.json$/, '.html'), 'utf8'));
  assert.ok(data.items.every(i => !('notIllustrated' in i)));
});

test('a card with only metrics warns', () => {
  const { html, r } = htmlOf(gate({ metrics: [{ label: 'Cost', value: '3 days' }] }));
  assert.ok(r.stderr.includes('warning: ' + WARNING), r.stderr);
  assert.ok(!pageData(html).items.some(i => 'notIllustrated' in i));
});

test('a card named by an outcome `on` draws; an option figure or example does too, no warning', () => {
  // A context row names the outcome entry, so the gate shows it (step 2 of the story-cards plan).
  const g = gate({}, { outcome: [{ view: 'ui', caption: 'After D2', after: SVG, on: { id: 'D2', when: ['a'] } }],
    context: [{ id: 'C1', title: 'After D2', outcome: 0 }], story: ['C1', 'D1', 'D2'] });
  const { html, r } = htmlOf(g);
  assert.ok(!r.stderr.includes('warning:'), r.stderr);
  assert.ok(!pageData(html).items.some(i => 'notIllustrated' in i));
  const viaOption = htmlOf(gate({ options: [{ value: 'a', label: 'A', examples: [ROW] }, { value: 'b', label: 'B' }, { value: 'none', label: 'Neither', negative: true }] }));
  assert.ok(!viaOption.r.stderr.includes('warning:'), viaOption.r.stderr);
});

test('a bare tension warns too, and a gate with every card drawn is silent', async () => {
  const t = { id: 'T1', topic: 'Split?', sides: [{ who: 'A', position: 'Yes.', recommended: true }, { who: 'B', position: 'No.' }] };
  const { r } = htmlOf(gate({ examples: [ROW] }, { tensions: [t], story: undefined }));
  assert.ok(r.stderr.includes('warning: T1 is not illustrated'), r.stderr);
  const clean = htmlOf(gate({ examples: [ROW] }));
  assert.ok(!clean.r.stderr.includes('warning:'), clean.r.stderr);
  const dom = await boot(clean.html);
  silent(dom);
});

// Replaces the old step-flow recap test (story-cards plan, step 3): the recap row of a bare card shows no mark.
test('D2-1: the recap row of a bare card shows no mark', async () => {
  const { html } = htmlOf(gate({}));
  const dom = await boot(html);
  dom.document.getElementById('r-_recap').click();
  assert.strictEqual(dom.document.querySelectorAll('.recap').length, 1);
  silent(dom);
});

test('the debate warning no longer offers an outcome, and says nothing of one', () => {
  const { r } = htmlOf(gate({}));
  assert.ok(r.stderr.includes('warning: D2 is not illustrated: give it examples or a figure, or say why in "unillustrated"'), r.stderr);
  assert.ok(!/is not illustrated[^\n]*outcome/.test(r.stderr), r.stderr);
});

// A4 Kickoff illustrates its scope (step 5): a business-lens kickoff item with nothing drawn warns the writer; nothing else changes.
const OUTCOME = [{ view: 'ui', caption: 'start', after: SVG }];
const OPTS = [{ value: 'a', label: 'A', recommended: true }, { value: 'b', label: 'B' }, { value: 'none', label: 'Neither', negative: true }];
function kickoff(item, extra) {
  return Object.assign({
    kind: 'kickoff', title: 'Kickoff', lang: 'en', outcome: OUTCOME,
    decisions: [Object.assign({ id: 'S1', title: 'Scope item', options: OPTS }, item)]
  }, extra || {});
}
function stderrOf(g) {
  const r = render(writeGate(g));
  assert.strictEqual(r.code, 0, r.stderr);
  return r.stderr;
}

test('A4-1: a business-lens kickoff item with nothing drawn warns, exit 0', () => {
  const err = stderrOf(kickoff({ lens: 'business' }));
  assert.ok(/S1 is not illustrated: /.test(err), err);
});

test('A4-2: unillustrated, an outcome on the item, or option examples silence it', () => {
  assert.ok(!/not illustrated/.test(stderrOf(kickoff({ lens: 'business', unillustrated: 'reason' }))));
  const on = kickoff({ lens: 'business' }, { outcome: [{ view: 'ui', caption: 'c', after: SVG, on: { id: 'S1', when: ['a'] } }] });
  assert.ok(!/not illustrated/.test(stderrOf(on)));
  const ex = kickoff({ lens: 'business', options: [Object.assign({}, OPTS[0], { examples: [ROW] }), OPTS[1]] });
  assert.ok(!/not illustrated/.test(stderrOf(ex)));
});

test('A4-3: plan, refactor, review and council gates with nothing drawn give no warning', () => {
  const bare = { lens: 'business' };
  [['plan', { outcome: OUTCOME }], ['refactor', {}], ['review', {}], ['council', {}]].forEach(([kind, extra]) => {
    const g = Object.assign({ kind, title: 'T', lang: 'en', decisions: [Object.assign({ id: 'S1', title: 'Item', options: OPTS }, bare)] }, extra);
    assert.ok(!/not illustrated/.test(stderrOf(g)), kind);
  });
});

test('A4-4: the team-kickoff skill maps a scope item to an example, a mockup or states', () => {
  const md = fs.readFileSync(require('node:path').join(__dirname, '../../skills/team-kickoff/SKILL.md'), 'utf8');
  assert.ok(md.includes('an example, a mockup or states'));
  assert.ok(md.includes('`unillustrated`'));
});

test('A4-5: a tech-lens kickoff item with nothing drawn gives no warning', () => {
  assert.ok(!/not illustrated/.test(stderrOf(kickoff({ lens: 'tech' }))));
});

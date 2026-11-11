const test = require('node:test');
const assert = require('node:assert');

const { writeGate, writeAcceptance, render, acceptanceGate, argued } = require('./helpers');
const { loadGate } = require('../../skills/team-view/lib/gate');

// The gate contract of story cards (plan 2026-11-10-story-cards, step 2): `story` as an id list, `context` rows,
// key metrics, per-option arguments, and the K12 order rule.
const ROW = { given: 'a', when: 'b', then: 'c' };
const SVG = { svg: '<svg viewBox="0 0 10 10"></svg>' };
const AB = () => [{ value: 'a', label: 'A', recommended: true }, { value: 'b', label: 'B' }, { value: 'none', label: 'Neither', negative: true }];

// C1 draws outcome 0; D3 refines D1; M1 is minor; every card is illustrated, so a clean gate warns nothing.
function gate(overrides) {
  return Object.assign({
    kind: 'debate', title: 'Context', lang: 'en',
    context: [{ id: 'C1', title: 'Where we are', why: 'Exports take a day.', outcome: 0 }],
    decisions: [
      { id: 'D1', title: 'First?', examples: [ROW], options: AB() },
      { id: 'D2', title: 'Second?', examples: [ROW], options: AB() },
      { id: 'D3', title: 'Third?', examples: [ROW], on: { id: 'D1' }, options: AB() },
      { id: 'M1', title: 'Minor', minor: true, default: 'approve', examples: [ROW] }
    ],
    tensions: [{ id: 'T1', topic: 'Split?', examples: [ROW], sides: [{ who: 'A', position: 'Yes.', recommended: true }, { who: 'B', position: 'No.' }] }],
    outcome: [{ view: 'ui', caption: 'The screen', after: SVG }]
  }, overrides || {});
}
const load = g => loadGate(writeGate(g), {});
const refused = (g, text) => {
  const { errors } = load(g);
  assert.ok(errors.includes(text), `expected "${text}" in:\n${errors.join('\n')}`);
};
const warned = (g, text) => {
  const { errors, warnings } = load(g);
  assert.deepStrictEqual(errors, []);
  assert.ok(warnings.includes(text), `expected warning "${text}" in:\n${warnings.join('\n')}`);
};
const clean = g => {
  const { errors, warnings } = load(g);
  assert.deepStrictEqual(errors, []);
  assert.deepStrictEqual(warnings, []);
};
const withDecision = (i, extra, overrides) => {
  const g = gate(overrides);
  Object.assign(g.decisions[i], extra);
  return g;
};

test('the base gate is clean, and the order is cover, context, then the cards, each refinement after its parent', () => {
  const g = gate();
  g.context.push({ id: 'C2', title: 'What the export holds' });
  g.decisions.push({ id: 'D4', title: 'Fourth?', examples: [ROW], on: { id: 'D3' }, options: AB() });
  const r = load(g);
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.warnings, []);
  assert.deepStrictEqual(r.story, ['C1', 'C2', 'D1', 'D3', 'D4', 'D2', 'T1']);
});

test('a valid story is the order, then the unnamed weighty cards in default order, each with a warning', () => {
  const r = load(gate({ story: ['C1', 'T1', 'D1', 'D3'] }));
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.story, ['C1', 'T1', 'D1', 'D3', 'D2']);
  assert.deepStrictEqual(r.warnings, ['D2 is not in "story": it is listed after the story\'s ids']);
});

test('a context row a given story leaves out warns, one per row, and the render exits 0', () => {
  const g = gate({ context: [{ id: 'C1', title: 'One', why: 'a', outcome: 0 }, { id: 'C2', title: 'Two', why: 'b' }, { id: 'C3', title: 'Three', why: 'c' }], story: ['D1', 'D3', 'T1', 'D2'] });
  const r = load(g);
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.warnings, ['context row "C1" is not in "story": it is not shown', 'context row "C2" is not in "story": it is not shown', 'context row "C3" is not in "story": it is not shown']);
  const out = render(writeGate(g));
  assert.strictEqual(out.code, 0, out.stderr);
  assert.ok(out.stderr.includes('warning: context row "C2" is not in "story": it is not shown'), out.stderr);
  assert.deepStrictEqual(load(gate()).warnings, []);
});

test('the warning reaches stderr and the render succeeds', () => {
  const r = render(writeGate(gate({ story: ['C1', 'D1', 'D3', 'T1'] })));
  assert.strictEqual(r.code, 0, r.stderr);
  assert.ok(r.stderr.includes('warning: D2 is not in "story": it is listed after the story\'s ids'), r.stderr);
});

test('story and context are read on every deciding kind; acceptance reads context and refuses story', () => {
  const r = load(gate({ kind: 'refactor', context: undefined, outcome: undefined }));
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.story, ['D1', 'D3', 'D2', 'T1']);
  assert.deepStrictEqual(r.context, []);
  const plan = load(gate({ kind: 'plan', story: ['C1', 'D1', 'D3', 'D2', 'T1'] }));
  assert.deepStrictEqual(plan.errors, []);
  assert.deepStrictEqual(plan.story, ['C1', 'D1', 'D3', 'D2', 'T1']);
  assert.deepStrictEqual(plan.context.map(c => c.id), ['C1']);
  refused(gate({ kind: 'acceptance', story: ['D1'] }), '"story" is not read on acceptance gates');
  const acc = loadGate(writeAcceptance(acceptanceGate()), {});
  assert.deepStrictEqual(acc.errors, []);
  assert.deepStrictEqual(acc.context.map(c => c.id), ['I0']);
  const council = load(gate({ kind: 'council', story: ['C1', 'D1', 'D3', 'D2', 'T1'] }));
  assert.deepStrictEqual(council.errors, []);
  assert.deepStrictEqual(council.story, ['C1', 'D1', 'D3', 'D2', 'T1']);
});

test('story must be a non-empty array of ids', () => {
  refused(gate({ story: [] }), '"story" must be a non-empty array of ids');
  refused(gate({ story: 'D1' }), '"story" must be a non-empty array of ids');
});

test('ST1-2: old story sections are refused with one error', () => {
  const { errors } = load(gate({ story: [{ title: 'Look', show: [{ card: 'D1' }] }, { show: [{ card: 'D2' }] }] }));
  const msg = '"story" is now a list of ids ("C1", "D1", ...): sections { "title", "show" } are no longer read';
  assert.deepStrictEqual(errors.filter(e => e === msg).length, 1, errors.join('\n'));
});

test('a story entry is an id string', () => {
  refused(gate({ story: ['C1', 3] }), 'story[1] must be an id string');
  refused(gate({ story: ['C1', null] }), 'story[1] must be an id string');
});

test('a story id names a context row, a decision or a tension; not a minor item; once', () => {
  refused(gate({ story: ['ZZ'] }), 'story[0] "ZZ" is not a context row, a decision or a tension');
  refused(gate({ story: ['R1'], rejected: [{ id: 'R1', title: 'No', reason: 'x' }] }), 'story[0] "R1" is not a context row, a decision or a tension');
  refused(gate({ story: ['C1', 'M1'] }), 'story[1] "M1" is a minor item: minor items stay in their own section');
  refused(gate({ story: ['C1', 'D2', 'C1'] }), 'story[2] "C1" is named twice');
});

test('ST5-3: a minor card that refines a weighty one is not in the order', () => {
  const g = gate();
  g.decisions.push({ id: 'M2', title: 'Minor refinement', minor: true, default: 'approve', examples: [ROW], on: { id: 'D2' } });
  const r = load(g);
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.story, ['C1', 'D1', 'D3', 'D2', 'T1']);
  refused(Object.assign(g, { story: ['C1', 'D2', 'M2'] }), 'story[2] "M2" is a minor item: minor items stay in their own section');
});

test('K12: a refinement comes right after its parent or its parent\'s earlier refinements', () => {
  refused(gate({ story: ['C1', 'D3', 'D1', 'D2', 'T1'] }), 'D3 refines D1: put it right after D1 in story');
  refused(gate({ story: ['C1', 'D1', 'D2', 'D3', 'T1'] }), 'D3 refines D1: put it right after D1 in story');
  const g = gate({ story: ['C1', 'D1', 'D3', 'D4', 'D5', 'D2', 'T1'] });
  g.decisions.push({ id: 'D4', title: 'Fourth?', examples: [ROW], on: { id: 'D3' }, options: AB() });
  g.decisions.push({ id: 'D5', title: 'Fifth?', examples: [ROW], on: { id: 'D1' }, options: AB() });
  clean(g);
});

test('K12: a card that needs another comes after it', () => {
  refused(withDecision(1, { after: ['D1'] }, { story: ['C1', 'D2', 'D1', 'D3', 'T1'] }), 'D2 needs D1: put D1 before D2 in story');
  clean(withDecision(1, { after: ['D1'] }, { story: ['C1', 'D1', 'D3', 'D2', 'T1'] }));
});

test('K12: the default order is checked too, and refused when a refinement needs a later card', () => {
  const g = gate();
  g.decisions.push({ id: 'D4', title: 'Fourth?', examples: [ROW], on: { id: 'D1' }, options: AB() });
  g.decisions.push({ id: 'D5', title: 'Fifth?', examples: [ROW], on: { id: 'D3' }, after: ['D4'], options: AB() });
  const r = render(writeGate(g));
  assert.strictEqual(r.code, 1, r.stderr);
  // Default order: D1, D3, D5 (D3's refinement), D4: D5 needs D4, placed after it.
  assert.ok(r.stderr.includes('D5 needs D4: put D4 before D5 in story'), r.stderr);
});

test('context must be an array of rows, each with an id and a title and only the known keys', () => {
  refused(gate({ context: { id: 'C1' } }), '"context" must be an array of { "id", "title", "why"?, "detail"?, "outcome"?, "figures"?, "metrics"?, "facts"?, "cases"?, "note"? }');
  refused(gate({ context: [{ id: 'C1' }] }), 'context[0] needs "id" and "title"');
  refused(gate({ context: ['C1'] }), 'context[0] needs "id" and "title"');
  refused(gate({ context: [{ id: 'C1', title: 'x', options: [] }] }), 'context[0] takes no "options": only id, title, why, detail, outcome, figures, metrics, facts, cases, note');
});

test('a context id is unique across the page, and ids starting with "_" are refused (ST1-6)', () => {
  refused(gate({ context: [{ id: 'D1', title: 'x' }] }), 'context[0] id "D1" is already used');
  refused(gate({ context: [{ id: 'C1', title: 'x' }, { id: 'C1', title: 'y' }] }), 'context[1] id "C1" is already used');
  refused(gate({ context: [{ id: '_x', title: 'x' }] }), 'context[0] id "_x" is reserved: ids starting with "_" are the page\'s own');
});

test('a context row\'s outcome is an index into the outcome entries; its metrics an array; its text within limits', () => {
  refused(gate({ context: [{ id: 'C1', title: 'x', outcome: 2 }] }), 'context[0].outcome 2: the gate has 1 outcome entries');
  refused(gate({ context: [{ id: 'C1', title: 'x', outcome: '0' }] }), 'context[0].outcome 0: the gate has 1 outcome entries');
  refused(gate({ context: [{ id: 'C1', title: 'x', outcome: 0, metrics: { label: 'x' } }] }), 'context[0].metrics must be an array');
  refused(gate({ context: [{ id: 'C1', title: 'x', outcome: 0, why: 'w'.repeat(161) }] }), 'context[0].why is 161 characters (max 160) — keep the facts the title lacks, as bullets');
});

test('loadGate returns the validated context rows, figures embedded', () => {
  const r = load(gate({ context: [{ id: 'C1', title: 'x', outcome: 0, figures: [Object.assign({ caption: 'c' }, SVG)], metrics: [{ label: 'Hours', after: 2, key: true }] }] }));
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(r.context.length, 1);
  assert.strictEqual(r.context[0].figures[0].svg, SVG.svg);
  assert.strictEqual(r.context[0].metrics[0].key, true);
});

test('T1-1: a card outcome is refused on every deciding kind', () => {
  const msg = 'decisions[0] ("D1").outcome is not read on a card: put its drawing in the card\'s "figures"';
  refused(withDecision(0, { outcome: 0 }), msg);
  refused(withDecision(0, { outcome: 0 }, { kind: 'council' }), msg);
  refused(withDecision(0, { outcome: 0 }, { kind: 'plan' }), msg);
});

test('a key metric: true or absent, on a card or a context row, never on an option', () => {
  refused(withDecision(0, { metrics: [{ label: 'x', after: 1, key: 'yes' }] }), 'decisions[0].metrics[0].key must be true or absent');
  refused(gate({ context: [{ id: 'C1', title: 'x', outcome: 0, metrics: [{ label: 'x', after: 1, key: false }] }] }), 'context[0].metrics[0].key must be true or absent');
  const g = gate();
  g.decisions[0].options[0].metrics = [{ label: 'x', after: 1, key: true }];
  refused(g, 'decisions[0] ("D1") option "a".metrics[0].key is read on a card or a context row only');
});

test('a key metric with after alone, or a single value, is accepted (D5-3)', () => {
  clean(withDecision(0, { metrics: [{ label: 'Share', before: 40, after: 20, key: true }, { label: 'Hours', after: 2, key: true }, { label: 'Rows', value: 3, unit: 'k' }] }));
  const r = render(writeGate(withDecision(0, { metrics: [{ label: 'Hours', after: 2, key: true }] })));
  assert.strictEqual(r.code, 0, r.stderr);
});

test('ST1-1: more than 3 key metrics warns, on a card and on a context row', () => {
  const five = [1, 2, 3, 4, 5].map(n => ({ label: 'm' + n, after: n, key: true }));
  warned(withDecision(0, { metrics: five }), 'D1 has 5 key metrics: the page shows 3 large, the rest in the evidence');
  warned(gate({ context: [{ id: 'C1', title: 'x', outcome: 0, metrics: five.slice(0, 4) }] }), 'C1 has 4 key metrics: the page shows 3 large, the rest in the evidence');
  clean(withDecision(0, { metrics: five.slice(0, 3) }));
});

test('A9: a summary is refused on every kind, acceptance included', () => {
  const msg = '"summary" is not read: put the page\'s cover in a context row (its why and facts), and an outcome in a context row\'s "outcome"';
  ['debate', 'council', 'plan', 'refactor', 'review', 'kickoff'].forEach(kind => {
    refused(gate({ kind, summary: [{ label: 'Direction', text: 'Do it.' }] }), msg);
  });
  const acc = load(acceptanceGate({ summary: [{ label: 'What the branch brings', text: 'An export.' }] }));
  assert.ok(acc.errors.includes(msg), acc.errors.join('\n'));
  const r = render(writeGate(gate({ summary: ['x'] })));
  assert.notStrictEqual(r.code, 0);
  assert.ok(r.stderr.includes(msg), r.stderr);
});

test('ST1-5: an outcome entry no context row names, and page figures, are not shown on a deciding gate', () => {
  warned(gate({ context: [{ id: 'C1', title: 'x' }] }), 'outcome[0] is not shown: name it in a context row\'s "outcome"');
  warned(gate({ kind: 'plan', context: [{ id: 'C1', title: 'x' }] }), 'outcome[0] is not shown: name it in a context row\'s "outcome"');
  warned(gate({ figures: [SVG] }), '"figures" are not shown on a deciding gate: put each on the card or context row it shows');
  warned(gate({ kind: 'plan', figures: [SVG] }), '"figures" are not shown on a deciding gate: put each on the card or context row it shows');
});

const ARG = [{ who: 'PO', point: 'Faster.' }];
const OWN_MSG = 'D1 has arguments on the question: put each on the option it backs or opposes directly (its "for" or "against"), on several if it applies to several';
const DEFAULT_MSG = 'D1 has arguments on the question: write its options out ("approve" labelled "Approve", and "decline" labelled "Decline" with "negative": true) and put each argument on the option it backs or opposes directly; arguments for approving are Approve\'s "for", against approving Approve\'s "against"';

test('A9: item-level arguments on a decision with its own options are refused, direct, on debate and council', () => {
  refused(withDecision(0, { for: ARG }), OWN_MSG);
  refused(withDecision(0, { against: ARG }), OWN_MSG);
  refused(withDecision(0, { for: ARG }, { kind: 'council' }), OWN_MSG);
  const ok = gate();
  ok.decisions[0].options[0].for = ARG;
  ok.decisions[0].options[1].against = [{ who: 'CTO', point: 'Debt.' }];
  ok.decisions[0].options[2].against = ARG;
  clean(ok);
});

test('A9: a decision with default options and item-level arguments is told to write its options out, with labels, on every kind', () => {
  for (const kind of ['debate', 'council', 'plan', 'kickoff', 'refactor', 'review']) {
    const g = kind === 'debate' || kind === 'council'
      ? withDecision(0, { options: undefined, against: ARG }, { kind })
      : { kind, title: 'G', lang: 'en', decisions: [{ id: 'D1', title: 'Do it', brief: 'Do D1.', against: ARG }] };
    refused(g, DEFAULT_MSG);
  }
});

test('A9: a plan, kickoff, refactor or review decision with its own options and item arguments gets the direct message', () => {
  for (const kind of ['plan', 'kickoff', 'refactor', 'review']) {
    const opts = [{ value: 'a', label: 'A', recommended: true, brief: 'Do a.' }, { value: 'b', label: 'B', brief: 'Do b.' }, { value: 'no', label: 'No', negative: true }];
    refused({ kind, title: 'G', lang: 'en', decisions: [{ id: 'D1', title: 'Do it', options: opts, for: ARG }] }, OWN_MSG);
  }
});

test('A9: a written-out Approve and Decline carries the arguments on every kind, and keeps the built-in labels', () => {
  for (const kind of ['plan', 'kickoff', 'refactor', 'review']) {
    const r = load({ kind, title: 'G', lang: 'en', decisions: [argued({ id: 'S1', title: 'Do it', brief: 'Do S1.', for: [{ who: 'PO', point: 'Faster.', lens: 'business' }], against: [{ who: 'CTO', point: 'Debt.', lens: 'tech' }] })] });
    assert.ok(!r.errors.some(e => e.includes('arguments on the')), kind + ': ' + r.errors.join('\n'));
    const o = r.items[0].options;
    assert.deepStrictEqual(o.map(x => x.value), ['approve', 'decline'], kind);
    assert.strictEqual(o[0].for[0].point, 'Faster.', kind);
    assert.strictEqual(o[0].against[0].point, 'Debt.', kind);
    assert.strictEqual(o[1].for, undefined, kind);
    assert.strictEqual(r.items[0].for, undefined, kind);
  }
});

test('A9: a tension, rejected, settled or question item with item-level arguments is refused, on every kind', () => {
  for (const kind of ['debate', 'plan', 'refactor', 'review', 'kickoff']) {
    const tension = gate({ kind });
    tension.tensions[0].for = ARG;
    refused(tension, 'T1 has arguments on the question: put each on the side it backs (sides[].for / sides[].against)');
    refused({ kind, title: 'G', lang: 'en', rejected: [{ id: 'R1', title: 'Old idea', reason: 'One use', for: ARG }] },
      'R1 has arguments on the item: put each on the option it backs or opposes ("revive" / "keep-rejected" …)');
    refused({ kind, title: 'G', lang: 'en', settled: [{ id: 'X1', title: 'Fixed', answer: 'Yes.', source: 'a.js:1', who: 'Dev', against: ARG }] },
      'X1 has arguments on the item: put each on the option it backs or opposes ("reopen" / "ok" …)');
    refused({ kind, title: 'G', lang: 'en', questions: [{ id: 'Q1', title: 'Why?', source: 'a.js:1', who: 'Dev', for: ARG }] },
      'Q1 has arguments on the item: put each on the option it backs or opposes ("drop" / "ask" …)');
  }
});

test('A1: a debate decision with its own options needs exactly one negative option; default options and other kinds are left alone', () => {
  const none = 'D1 has no negative option: add one with "negative": true and a label that says no to this question';
  refused(withDecision(0, { options: [{ value: 'a', label: 'A', recommended: true }, { value: 'b', label: 'B' }] }), none);
  refused(withDecision(0, { options: [{ value: 'a', label: 'A', recommended: true }, { value: 'b', label: 'B' }] }, { kind: 'council' }), none);
  refused(withDecision(0, { options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B', negative: true }, { value: 'c', label: 'C', negative: true }] }),
    'D1 has 2 negative options: keep exactly one, with "negative": true and a label that says no to this question');
  clean(gate());
  const plan = load(withDecision(0, { options: [{ value: 'a', label: 'A', recommended: true }, { value: 'b', label: 'B' }] }, { kind: 'plan', context: undefined, story: undefined }));
  assert.ok(!plan.errors.includes(none), plan.errors.join('\n'));
});

test('D2: an option\'s for and against are arguments, strings normalized, lens collected', () => {
  const g = withDecision(0, { lens: 'business' });
  g.decisions[0].options[0].for = ['Ships this week', { who: 'CTO', point: 'One module.', lens: 'tech' }];
  const r = load(g);
  assert.deepStrictEqual(r.errors, []);
  const o = r.items.find(it => it.id === 'D1').options[0];
  assert.deepStrictEqual(o.for, [{ point: 'Ships this week', lens: 'business' }, { who: 'CTO', point: 'One module.', lens: 'tech' }]);
  const bad = gate();
  bad.decisions[0].options[0].for = 'x';
  bad.decisions[0].options[1].against = [{ who: 'CTO' }];
  refused(bad, 'decisions[0] ("D1") option "a".for must be an array');
  refused(bad, 'decisions[0] ("D1") option "b".against[0] needs "point"');
  const lens = gate();
  lens.decisions[0].options[0].for = [{ point: 'x', lens: 'ux' }];
  refused(lens, 'decisions[0] option "a".for[0].lens must be one of business, tech');
});

test('SK-1: a tension side\'s for and against reach its option', () => {
  const g = gate();
  g.tensions[0].sides[0].for = [{ who: 'PO', point: 'Clear.' }];
  g.tensions[0].sides[1].against = ['Too slow'];
  const r = load(g);
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.warnings, []);
  const opts = r.items.find(it => it.id === 'T1').options;
  assert.deepStrictEqual(opts[0].for, [{ who: 'PO', point: 'Clear.' }]);
  assert.deepStrictEqual(opts[1].against, [{ point: 'Too slow' }]);
});

test('D6-4: two options of one card showing the same figure warn; an option with no figure fires nothing', () => {
  const g = gate();
  g.decisions[0].options[0].figures = [Object.assign({ caption: 'a' }, SVG)];
  g.decisions[0].options[1].figures = [Object.assign({ caption: 'b' }, SVG)];
  warned(g, 'D1 options "a" and "b" show the same figure: give an option a figure only where it lands differently');
  const plan = gate({ kind: 'plan' });
  plan.decisions[0].options[0].figures = [Object.assign({ caption: 'a' }, SVG)];
  plan.decisions[0].options[1].figures = [Object.assign({ caption: 'b' }, SVG)];
  warned(plan, 'D1 options "a" and "b" show the same figure: give an option a figure only where it lands differently');
  const one = gate();
  one.decisions[0].options[0].figures = [SVG];
  clean(one);
  const differ = gate();
  differ.decisions[0].options[0].figures = [SVG];
  differ.decisions[0].options[1].figures = [{ svg: '<svg viewBox="0 0 20 20"></svg>' }];
  clean(differ);
});

test('a figure drawn on two cards, or on a card and a context row, warns; a card and its own option do not', () => {
  const two = gate();
  two.decisions[0].figures = [Object.assign({ caption: 'flow' }, SVG)];
  two.decisions[1].figures = [Object.assign({ caption: 'flow' }, SVG)];
  warned(two, 'D1, D2 show the same figure: draw it once, on the card it explains; a figure several cards share goes in a context row before them');
  const row = gate({ kind: 'plan' });
  row.context[0].figures = [SVG];
  row.decisions[1].options[0].figures = [SVG];
  warned(row, 'C1, D2 show the same figure: draw it once, on the card it explains; a figure several cards share goes in a context row before them');
  const own = gate();
  own.decisions[0].figures = [SVG];
  own.decisions[0].options[0].figures = [SVG];
  assert.ok(!load(own).warnings.some(w => /show the same figure: draw it once/.test(w)));
});

test('A2-D:a "Drop this question" option marked negative needs no brief beside an item brief', () => {
  const g = withDecision(1, { brief: 'Do D2.', options: [
    { value: 'a', label: 'Build it', recommended: true },
    { value: 'drop', label: 'Drop this question', negative: true, for: [{ who: 'Philosopher', point: 'Nobody asked.' }] }
  ] });
  const r = render(writeGate(g));
  assert.strictEqual(r.code, 0, r.stderr);
  assert.ok(!r.stderr.includes('brief'), r.stderr);
});

test('a deciding card\'s detail may run to 600 characters and a bullet to 200 on every kind', () => {
  const withDetail = (kind, detail) => gate({ kind, decisions: [{ id: 'D1', title: 'First?', examples: [ROW], detail, options: AB() }], context: [], tensions: [], story: undefined });
  for (const kind of ['debate', 'council']) {
    assert.deepStrictEqual(load(withDetail(kind, ['b'.repeat(200)])).errors.filter(e => /bullet|characters/.test(e)), []);
    assert.deepStrictEqual(load(withDetail(kind, ['b'.repeat(200), 'b'.repeat(200), 'b'.repeat(198)])).errors.filter(e => /bullet|characters/.test(e)), []);
  }
  refused(withDetail('debate', ['b'.repeat(201)]), 'decisions[0].detail bullet 1 is 201 characters (max 200)');
  refused(withDetail('debate', ['b'.repeat(200), 'b'.repeat(200), 'b'.repeat(199)]), 'decisions[0].detail is 601 characters (max 600) — keep the facts the title lacks, as bullets');
  refused(withDetail('council', ['b'.repeat(201)]), 'decisions[0].detail bullet 1 is 201 characters (max 200)');
  for (const kind of ['plan', 'refactor']) {
    assert.deepStrictEqual(load(withDetail(kind, ['b'.repeat(200), 'b'.repeat(200), 'b'.repeat(198)])).errors.filter(e => /bullet|characters/.test(e)), []);
    refused(withDetail(kind, ['b'.repeat(201)]), 'decisions[0].detail bullet 1 is 201 characters (max 200)');
    refused(withDetail(kind, ['b'.repeat(200), 'b'.repeat(200), 'b'.repeat(199)]), 'decisions[0].detail is 601 characters (max 600) — keep the facts the title lacks, as bullets');
  }
});

test('a list title over 70 characters warns the writer on every deciding kind', () => {
  const text = (id, n) => `${id} title is ${n} characters: keep a list title under 70`;
  const long = 'x'.repeat(71);
  warned(withDecision(0, { title: long }), text('D1', 71));
  warned(gate({ context: [{ id: 'C1', title: long, why: 'Exports take a day.', outcome: 0 }] }), text('C1', 71));
  warned(withDecision(0, { title: long }, { kind: 'council' }), text('D1', 71));
  const ok = load(withDecision(0, { title: 'x'.repeat(70) }));
  assert.ok(!ok.warnings.some(w => w.includes('list title')));
  const plan = load(withDecision(0, { title: long }, { kind: 'plan', context: undefined }));
  assert.ok(plan.warnings.includes(text('D1', 71)), 'a plan warns too');
  warned(withDecision(0, { title: long }, { kind: 'refactor', context: undefined }), text('D1', 71));
});

test('an option label over 60 characters warns the writer on every deciding kind', () => {
  const text = n => `D1 option "a" label is ${n} characters: keep it to 60 or less; the card's text can carry the rest`;
  const withLabel = (n, extra) => withDecision(0, { options: [{ value: 'a', label: 'x'.repeat(n) }, { value: 'n', label: 'No', negative: true }] }, extra);
  warned(withLabel(61), text(61));
  warned(withLabel(61, { kind: 'council' }), text(61));
  assert.ok(!load(withLabel(60)).warnings.some(w => w.includes('label is')));
  warned(withLabel(61, { kind: 'plan', context: undefined }), text(61));
  warned(withLabel(61, { kind: 'refactor', context: undefined }), text(61));
});

// Context rows: facts, cases and a note (a6).
const rowWith = extra => gate({ context: [Object.assign({ id: 'C1', title: 'Where we are', why: 'Exports take a day.', outcome: 0 }, extra)] });

test('a context row takes facts, cases and a note, and a clean one warns nothing', () => {
  clean(rowWith({
    facts: [{ label: 'Recommendation', text: 'Do **A**.' }, { label: 'Out of scope', text: 'Billing.' }],
    cases: [{ title: 'One', tag: 'Today', figure: SVG, text: 'a' }, { title: 'Two', text: 'b' }],
    note: 'Source: the 2026 audit.'
  }));
});

test('facts are refused when malformed', () => {
  refused(rowWith({ facts: 'x' }), 'context[0].facts must be an array of { "label", "text" }');
  refused(rowWith({ facts: ['x'] }), 'context[0].facts[0] must be an object { "label", "text" }');
  refused(rowWith({ facts: [{ label: 'L' }] }), 'context[0].facts[0].text must be a non-empty string');
  refused(rowWith({ facts: [{ label: ' ', text: 't' }] }), 'context[0].facts[0].label must be a non-empty string');
  refused(rowWith({ facts: [{ label: 'L', text: 't', x: 1 }] }), 'context[0].facts[0] takes no "x": only label, text');
});

test('more than 4 facts warns', () => {
  const facts = [1, 2, 3, 4, 5].map(n => ({ label: 'L' + n, text: 't' }));
  warned(rowWith({ facts }), 'C1 has 5 facts: keep to 4 or fewer');
});

test('cases are refused when malformed', () => {
  const ok = { title: 'T', text: 'x' };
  refused(rowWith({ cases: [] }), 'context[0].cases is empty: leave it out, or give at least 2 cases');
  refused(rowWith({ cases: {} }), 'context[0].cases must be an array of { "title", "tag"?, "figure"?, "text" }');
  refused(rowWith({ cases: [ok, 3] }), 'context[0].cases[1] must be an object { "title", "tag"?, "figure"?, "text" }');
  refused(rowWith({ cases: [ok, { text: 'x' }] }), 'context[0].cases[1].title must be a non-empty string');
  refused(rowWith({ cases: [ok, { title: 'T', text: '' }] }), 'context[0].cases[1].text must be a non-empty string');
  refused(rowWith({ cases: [ok, { title: 'T', text: 'x', tag: '' }] }), 'context[0].cases[1].tag must be a non-empty string');
  refused(rowWith({ cases: [ok, { title: 'T', text: 'x', z: 1 }] }), 'context[0].cases[1] takes no "z": only title, tag, figure, text');
  refused(rowWith({ cases: [ok, { title: 'T', text: 'x', figure: {} }] }), 'context[0].cases[1].figure needs "svg", "html" or "src"');
});

test('a case warns for a long tag, a single case and more than 3 distinct tags', () => {
  const ok = { title: 'T', text: 'x' };
  warned(rowWith({ cases: [ok, { title: 'T', text: 'x', tag: 'x'.repeat(25) }] }), 'C1 case 1 tag is 25 characters: keep a tag to 24 or fewer');
  warned(rowWith({ cases: ['A', 'B', 'C', 'D'].map(tag => ({ title: 'T', text: 'x', tag })) }), 'C1 has 4 distinct case tags: the page has 3 tones, so tags past the third look alike');
  warned(rowWith({ cases: [ok] }), 'C1 has 1 case: cases are parallel situations, give at least 2');
});

test('a note must be a non-empty string', () => {
  refused(rowWith({ note: '' }), 'context[0].note must be a non-empty string');
  refused(rowWith({ note: 4 }), 'context[0].note must be a non-empty string');
});

test("a case's figure.src HTML file is embedded like a figures entry", () => {
  const g = rowWith({ cases: [{ title: 'A', text: 'a', figure: { src: 'mock.html' } }, { title: 'B', text: 'b' }] });
  const file = writeGate(g);
  require('node:fs').writeFileSync(require('node:path').join(require('node:path').dirname(file), 'mock.html'), '<div class="m">hi</div>');
  const r = loadGate(file, {});
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(r.context[0].cases[0].figure.html, '<div class="m">hi</div>');
  assert.strictEqual(r.context[0].cases[0].figure.src, undefined);
});

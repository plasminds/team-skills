const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { composedTemplate, RENDER, writeGate, render, pageData } = require('./helpers');

const SVG = '<svg viewBox="0 0 40 20"><rect width="40" height="20" fill="var(--surface)"/></svg>';
const row = (o) => Object.assign({ given: 'A copy exists', when: 'Click `Copy`', then: 'A **second** copy' }, o);

function gate(over, opt) {
  return Object.assign({
    kind: 'debate', title: 'T', source: '.council/decisions/2026-10-14-x.md',
    decisions: [Object.assign({ id: 'D1', title: 'Copy the thing?', options: [
      Object.assign({ value: 'a', label: 'Copy', recommended: true }, opt || {}),
      { value: 'b', label: 'Link' }, { value: 'none', label: 'Neither', negative: true }] }, over || {})],
    outcome: [{ view: 'ui', caption: 'The screen', after: { svg: SVG } }]
  });
}
function rejects(g, pattern) {
  const r = render(writeGate(g));
  assert.notStrictEqual(r.code, 0, 'should be rejected');
  assert.match(r.stderr + r.stdout, pattern);
}
function ok(g) {
  const file = writeGate(g), r = render(file);
  assert.strictEqual(r.code, 0, r.stderr);
  return pageData(fs.readFileSync(file.replace(/\.gate\.json$/, '.html'), 'utf8'));
}

test('examples: valid item and option rows pass through', () => {
  const d = ok(gate({ examples: [row()] }, { examples: [row({ lens: undefined })] }));
  assert.strictEqual(d.items[0].examples.length, 1);
  assert.strictEqual(d.items[0].options[0].examples.length, 1);
});

test('examples: rejects each malformed shape', () => {
  rejects(gate({ examples: 'x' }), /examples must be an array/);
  rejects(gate({ examples: [row({ given: undefined })] }), /needs "given"/);
  rejects(gate({ examples: [row({ when: '' })] }), /needs "when"/);
  rejects(gate({ examples: [row({ then: 3 })] }), /needs "then"/);
  rejects(gate({ examples: [row({ then: 'a\nb' })] }), /then must be one line/);
  rejects(gate({ examples: [row({ given: 'x'.repeat(121) })] }), /121 characters \(max 120\)/);
  rejects(gate({ examples: Array.from({ length: 9 }, () => row()) }), /9 rows \(max 8\)/);
  rejects(gate({ examples: [row({ lens: 'nope' })] }), /lens must be one of/);
  rejects(gate({}, { examples: [row({ when: '' })] }), /option "a".*needs "when"/);
});

test('examples: a lensed item leaves a row without lens is an error; a row lens or the item lens fills it', () => {
  rejects(Object.assign(gate({ examples: [row({ lens: 'tech' }), row()] }), { kind: 'refactor' }), /has no lens/);
  const d = ok(gate({ lens: 'business', examples: [row()] }));
  assert.strictEqual(d.items[0].examples[0].lens, 'business');
});

test('examples: a tension side passes examples to its option', () => {
  const g = gate();
  Object.assign(g, {
    tensions: [{ topic: 'Split?', sides: [
      { who: 'A', position: 'Split', examples: [row()] }, { who: 'B', position: 'Keep', recommended: true }] }] });
  const d = ok(g);
  assert.ok(d.items.find(i => i.kind === 'tension').options.some(o => o.examples && o.examples.length === 1));
});

test('states: valid entries pass; bad ones are rejected', () => {
  const st = { label: 'Done', svg: SVG, caption: 'Button greyed' };
  const withStates = (states) => { const x = gate(); x.outcome[0].states = states; return x; };
  assert.strictEqual(ok(withStates([st])).outcome[0].states.length, 1);
  rejects(withStates('x'), /states must be an array/);
  rejects(withStates([{ svg: SVG, caption: 'c' }]), /needs "label"/);
  rejects(withStates([{ label: 'L', svg: SVG }]), /needs "caption"/);
  rejects(withStates([{ label: 'L', caption: 'c' }]), /needs "svg", "html" or "src"/);
  rejects(withStates([Object.assign({}, st, { label: 'x'.repeat(41) })]), /41 characters \(max 40\)/);
  rejects(withStates(Array.from({ length: 7 }, () => st)), /7 entries \(max 6\)/);
});

test('the page renders the Examples table, option rows and States row', () => {
  const html = composedTemplate();
  const script = html.match(/<script>([\s\S]*)<\/script>\s*<\/body>/) || html.match(/<script>([\s\S]*?)<\/script>/);
  const src = composedTemplate();
  assert.doesNotThrow(() => { for (const m of src.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(m[1]); });
  assert.match(html, /'ev\.examples': 'Examples', 'ev\.exGiven': 'Before', 'ev\.exWhen': 'What is done', 'ev\.exThen': 'After'/);
  assert.match(html, /'ev\.examples': 'Exemples', 'ev\.exGiven': 'Avant', 'ev\.exWhen': 'Ce que l\\'on fait', 'ev\.exThen': 'Après'/);
  assert.match(html, /'sum\.states': 'States'/);
  assert.match(html, /'sum\.states': 'États'/);
  assert.match(html, /\(o\.examples && o\.examples\.length\)/);
  assert.match(html, /figures\(\[\{ svg: st\.svg, html: st\.html, src: st\.src, caption: st\.caption \}\]\)/);
  assert.ok(script);
  // the rendered page carries the rows for the page JS to draw
  const d = ok(gate({ examples: [row()] }, { examples: [row({ then: 'Option row' })] }));
  assert.strictEqual(d.items[0].options[0].examples[0].then, 'Option row');
});

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { render, pageData } = require('./helpers');

const EX = path.join(__dirname, '..', '..', 'examples');

function copyTo(dir, rel) {
  const to = path.join(dir, path.basename(rel));
  fs.copyFileSync(path.join(EX, rel), to);
  return to;
}

test('the refactor example renders and is not shareable', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ex-'));
  const file = copyTo(dir, 'refactor-gate/invoice.gate.json');
  fs.cpSync(path.join(EX, 'refactor-gate', 'invoice'), path.join(dir, 'invoice'), { recursive: true }); // the figures it references
  assert.strictEqual(render(file).code, 0);
  assert.strictEqual(render(file, '--share').code, 1);
  // Each step carries its Step Card as its brief; the tension's side that keeps the file as it is has none.
  const data = pageData(fs.readFileSync(file.replace(/\.gate\.json$/, '.html'), 'utf8'));
  data.items.filter(it => it.kind === 'decision').forEach(it => assert.match(it.brief || '', /^Do:/m, it.id + ' has no Step Card'));
  const sides = data.items.find(it => it.kind === 'tension').options;
  assert.match(sides.find(o => o.value === 'Responsibilities').brief, /^Commit: refactor\(invoice\)/m);
  assert.strictEqual(sides.find(o => o.value === 'Minimalist + Depth').negative, true);
});

test('the review example renders, shares, and builds a GitHub review that lists the left finding in its body', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ex-'));
  const file = copyTo(dir, 'review-gate/refund.gate.json');
  const diff = path.join(EX, 'review-gate/refund.diff');
  const preset = path.join(EX, 'review-gate/refund.share.txt');
  assert.strictEqual(render(file).code, 0);
  const s = render(file, '--share', '--preset=' + preset);
  assert.strictEqual(s.code, 0, s.stderr);
  assert.strictEqual(pageData(fs.readFileSync(file.replace(/\.gate\.json$/, '.share.html'), 'utf8')).kind, 'review');
  const r = render(file, '--share', '--preset=' + preset, '--review=github', '--head=9b1e4c7a2f3d5e6b8c0a1d2e3f4a5b6c7d8e9f01', '--diff=' + diff);
  assert.strictEqual(r.code, 0, r.stderr);
  const payload = JSON.parse(fs.readFileSync(file.replace(/\.gate\.json$/, '.review.github.json'), 'utf8'));
  const ids = payload.comments.map(c => c.body.match(/^\*\*([A-Z]+-\d+)/)[1]);
  assert.deepStrictEqual(ids.sort(), ['CF-1', 'CR-1', 'CR-2', 'IN-1', 'SE-1']);
  assert.ok(!payload.comments.some(c => c.body.includes('CR-3')));
  assert.match(payload.body, /### Left as is\n- CR-3 — /);
  assert.match(payload.comments.find(c => c.body.startsWith('**CR-1')).body, /```suggestion\n/);
});

test('the debate example shows both lenses, its constraints, and auto-accept lifts nothing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ex-'));
  const file = copyTo(dir, 'debate-gate/export.gate.json');
  assert.strictEqual(render(file).code, 0);
  const data = pageData(fs.readFileSync(file.replace(/\.gate\.json$/, '.html'), 'utf8'));
  const byId = Object.fromEntries(data.items.map(it => [it.id, it]));
  assert.strictEqual(data.constraints, undefined);
  assert.deepStrictEqual(byId.D1.bridge.map(k => k.id), ['K2']);
  assert.deepStrictEqual(byId.D2.bridge.map(k => k.id), ['KS1']);
  assert.deepStrictEqual(byId.D3.bridge.map(k => k.id), ['K1']); // a constraint its option breaks
  assert.strictEqual(byId.D1.lensTabs, true);
  // A one-lens card has no tabs; its header names the lens, and the lens filter can hide it.
  assert.deepStrictEqual(byId.D1.lenses, ['business', 'tech']);
  assert.deepStrictEqual(byId.D2.lenses, ['tech']);
  assert.deepStrictEqual(byId.D3.lenses, ['business']);
  assert.strictEqual(byId.D2.lensTabs, undefined);
  assert.strictEqual(byId.D3.lensTabs, undefined);
  assert.ok(byId.D2.for.concat(byId.D2.against).every(a => a.lens === 'tech'));
  assert.ok(byId.D3.for.concat(byId.D3.against).every(a => a.lens === 'business'));
  assert.strictEqual(byId.D4.lensTabs, undefined);
  const r = render(file, '--accept-recommended');
  assert.strictEqual(r.code, 0, r.stderr);
  assert.match(r.stdout, /^mode: auto-accept$/m);
  assert.doesNotMatch(r.stdout, /lifts/);
});

test('a .ceo.json copy of an example still renders to <name>.html', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ex-'));
  const file = path.join(dir, 'export.ceo.json');
  fs.copyFileSync(path.join(EX, 'debate-gate', 'export.gate.json'), file);
  assert.strictEqual(render(file).code, 0);
  assert.ok(fs.existsSync(path.join(dir, 'export.html')));
});

test('the acceptance example renders, prints its size, and refuses to be served', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ex-'));
  const file = copyTo(dir, 'acceptance/export.acceptance.json');
  fs.cpSync(path.join(EX, 'acceptance', 'export'), path.join(dir, 'export'), { recursive: true });
  const r = render(file);
  assert.strictEqual(r.code, 0, r.stderr);
  assert.match(r.stdout, /\nsize: \d/);
  const data = pageData(fs.readFileSync(file.replace(/\.json$/, '.html'), 'utf8'));
  assert.strictEqual(data.kind, 'acceptance');
  assert.ok(data.items.length >= 2 && data.items.every(it => it.kind === 'case'));
  assert.ok(data.items.some(it => it.unshown), 'the example shows a case that could not be shown');
  assert.notStrictEqual(render(file, '--serve', '--no-open').code, 0);
});

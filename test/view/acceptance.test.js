const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { render, pageData, acceptanceGate, writeAcceptance } = require('./helpers');
const { mentions } = require('../../skills/team-view/lib/files');

const htmlOf = file => fs.readFileSync(file.replace(/\.gate\.json$/, '.html'), 'utf8');
const failsWith = (gate, re, ...flags) => {
  const r = render(writeAcceptance(gate), ...flags);
  assert.notStrictEqual(r.code, 0, 'expected a refusal');
  assert.match(r.stderr, re);
};
const withCase = patch => acceptanceGate({ cases: [Object.assign({}, acceptanceGate().cases[0], patch)] });

test('acceptance: a valid page renders its cases with no options, the branch and commit, and prints its size', () => {
  const file = writeAcceptance(acceptanceGate());
  const r = render(file);
  assert.strictEqual(r.code, 0, r.stderr);
  const [out, size] = r.stdout.trim().split('\n');
  assert.ok(out.endsWith('g.html'));
  assert.match(size, /^size: \d+(\.\d)? (KB|MB)$/);
  const html = htmlOf(file);
  const data = pageData(html);
  assert.strictEqual(data.kind, 'acceptance');
  assert.strictEqual(data.branch, 'feat-export');
  assert.strictEqual(data.commit, '4c3ebf618');
  assert.deepStrictEqual(data.items.map(it => [it.id, it.kind, it.options.length]), [['C1', 'case', 0], ['C2', 'case', 0]]);
  assert.match(data.items[0].figures[0].src, /^data:image\/png;base64,/);
  assert.deepStrictEqual(data.items[1].figures, []);
  assert.ok(html.includes('<title>Recette — export</title>'), 'no " · Gate" suffix on a page that is not a gate');
});

test('acceptance: a case with an empty tech part renders', () => {
  assert.strictEqual(render(writeAcceptance(withCase({ tech: {} }))).code, 0);
});

test('acceptance: page-level refusals', () => {
  failsWith(acceptanceGate({ cases: [] }), /needs "cases"/);
  failsWith(acceptanceGate({ decisions: [{ id: 'D1', title: 'x' }] }), /takes no "decisions"/);
  failsWith(acceptanceGate({ settled: [] }), /takes no "settled"/);
  failsWith(acceptanceGate({ preamble: '# Mission' }), /takes no "preamble"/);
  failsWith(acceptanceGate({ branch: '' }), /needs "branch"/);
  failsWith(acceptanceGate({ commit: 'main' }), /needs "commit"/);
  failsWith(acceptanceGate({ lang: 'de' }), /"lang" must be one of en, fr/);
});

test('acceptance: case refusals', () => {
  failsWith(withCase({ options: [{ value: 'a', label: 'A' }] }), /\("C1"\) has "options": a case takes only/);
  failsWith(withCase({ expect: 'typo' }), /\("C1"\) has "expect"/);
  failsWith(withCase({ steps: [] }), /\("C1"\) needs "steps"/);
  failsWith(withCase({ expected: '' }), /\("C1"\) needs "expected"/);
  failsWith(withCase({ figures: [], unshown: undefined }), /needs "figures" \(its screenshots\) or "unshown"/);
  failsWith(withCase({ figures: [{ src: '/tmp/a.png' }] }), /must be relative to the JSON/);
  failsWith(withCase({ figures: [{ src: 'missing.png' }] }), /not found/);
  failsWith(withCase({ tech: { files: ['/home/me/src/a.js'] } }), /tech\.files\[0\] "\/home\/me\/src\/a\.js" is not a repo-relative path/);
  failsWith(withCase({ tech: { files: ['../a.js'] } }), /is not a repo-relative path/);
  failsWith(withCase({ tech: { lines: 3 } }), /tech has "lines"/);
  const two = acceptanceGate();
  two.cases[1].id = 'C1';
  failsWith(two, /duplicate id "C1"/);
});

test('acceptance: nothing comes back, so no server, no auto-accept, no share', () => {
  failsWith(acceptanceGate(), /--serve and --accept-recommended do not apply/, '--accept-recommended');
  failsWith(acceptanceGate(), /--serve and --accept-recommended do not apply/, '--serve', '--no-open');
  failsWith(acceptanceGate(), /--share needs kind "review"/, '--share');
});

test('acceptance: tech.files count as files the page names', () => {
  const found = mentions({ items: [{ id: 'C1', tech: { files: ['src/export.js'] } }] }).map(m => m.path);
  assert.deepStrictEqual(found, ['src/export.js']);
});

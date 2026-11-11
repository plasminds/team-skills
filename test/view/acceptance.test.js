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

test('acceptance: nothing comes back, so no server and no auto-accept; --share writes it as a file', () => {
  failsWith(acceptanceGate(), /--serve and --accept-recommended do not apply/, '--accept-recommended');
  failsWith(acceptanceGate(), /--serve and --accept-recommended do not apply/, '--serve', '--no-open');
  const file = writeAcceptance(acceptanceGate());
  assert.strictEqual(render(file, '--share').code, 0);
  assert.ok(fs.existsSync(file.replace(/\.gate\.json$/, '.share.html')));
});

test('acceptance: tech.files count as files the page names', () => {
  const found = mentions({ items: [{ id: 'C1', tech: { files: ['src/export.js'] } }] }).map(m => m.path);
  assert.deepStrictEqual(found, ['src/export.js']);
});

// D4: the record's example ids, copied into a top-level "examples" list; a case may cite one.
const EX = (id, n) => ({ id, given: 'Given ' + (n || id), when: 'When ' + (n || id), then: 'Then ' + (n || id) });
const withExamples = (examples, cites) => acceptanceGate(Object.assign({ lang: 'en' }, examples === undefined ? {} : { examples }, {
  cases: acceptanceGate().cases.map((c, i) => (i === 0 && cites ? Object.assign({}, c, { example: cites }) : c))
}));

test('D4-1: a case that cites an example in the list renders, and the page data carries both', () => {
  const file = writeAcceptance(withExamples([EX('E3')], 'E3'));
  const r = render(file);
  assert.strictEqual(r.code, 0, r.stderr);
  const data = pageData(htmlOf(file));
  assert.deepStrictEqual(data.examples, [EX('E3')]);
  assert.strictEqual(data.items[0].example, 'E3');
  assert.strictEqual(data.items[1].example, undefined);
});

test('D4-3: a case that cites an id outside the list is refused, an empty list counts', () => {
  failsWith(withExamples([EX('E3')], 'E9'), /cases\[0\]\.example "E9" is not in "examples"/);
  failsWith(withExamples([], 'E9'), /cases\[0\]\.example "E9" is not in "examples"/);
});

test('D4-4: a case with example and no examples list is refused', () => {
  failsWith(withExamples(undefined, 'E3'), /cases\[0\]\.example needs a top-level "examples" list to check it against/);
});

test('D4: an example id must look like E3', () => {
  ['e3', '3', 'E0', 'E03', 'E'].forEach(bad => failsWith(withExamples([EX('E3')], bad), /example must be an id like "E3"/));
  failsWith(acceptanceGate({ examples: [EX('E3')], cases: [Object.assign({}, acceptanceGate().cases[0], { example: 3 })] }), /example must be an id like "E3"/);
});

test('D4: examples rows are checked: four keys, a valid unique id, three non-empty texts, an array', () => {
  failsWith(withExamples([Object.assign(EX('E1'), { extra: 'x' })]), /examples\[0\] takes only id, given, when, then/);
  failsWith(withExamples([EX('E1'), EX('E1')]), /examples id "E1" is named twice/);
  failsWith(withExamples([EX('x1')]), /examples\[0\]\.id must be an id like "E3"/);
  failsWith(withExamples([Object.assign(EX('E1'), { when: ' ' })]), /examples\[0\]\.when must be a non-empty string/);
  failsWith(withExamples([Object.assign(EX('E1'), { given: undefined })]), /examples\[0\]\.given must be a non-empty string/);
  failsWith(withExamples('E1'), /"examples" must be an array/);
  failsWith(withExamples(['E1']), /examples\[0\] must be an object/);
});

test('D4: a long example text is kept as written, no length cap', () => {
  const long = 'x'.repeat(400);
  const file = writeAcceptance(withExamples([Object.assign(EX('E1'), { given: long })]));
  assert.strictEqual(render(file).code, 0);
  assert.strictEqual(pageData(htmlOf(file)).examples[0].given, long);
});

test('D4-5: examples that no case cites are legal', () => {
  const file = writeAcceptance(withExamples([EX('E1'), EX('E2')]));
  const r = render(file);
  assert.strictEqual(r.code, 0, r.stderr);
  assert.deepStrictEqual(pageData(htmlOf(file)).examples.map(e => e.id), ['E1', 'E2']);
});

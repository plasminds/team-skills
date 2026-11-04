const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { shareGate, writeGate, render, pageData, RENDER } = require('./helpers');

const TEMPLATE = fs.readFileSync(path.join(path.dirname(RENDER), 'template.html'), 'utf8');
const A1 = { id: 'A1', title: 'Is the rate cached?', answer: 'No', source: 'src/rate.js:3', who: 'Recon' };
const A2 = { id: 'A2', title: 'Does the mail retry?', answer: 'No, it is only logged', source: 'src/mail.js:9', who: 'Correctness', unverified: 'run the mail spec' };

// The share page's PROMPT-block functions, run on a rendered gate.
function load(gate) {
  const file = writeGate(gate);
  const r = render(file, '--share');
  assert.strictEqual(r.code, 0, r.stderr);
  const html = fs.readFileSync(file.replace(/\.ceo\.json$/, '.share.html'), 'utf8');
  const src = html.match(/\/\*PROMPT-START\*\/([\s\S]*?)\/\*PROMPT-END\*\//)[1];
  const data = pageData(html);
  const fns = vm.runInNewContext(src + '\n({ buildPrompt: buildPrompt, buildReview: buildReview, leftWithoutNote: leftWithoutNote });');
  return {
    prompt: state => fns.buildPrompt(data, data.items, state),
    review: state => JSON.parse(JSON.stringify(fns.buildReview(data, data.items, state, () => true))),
    leftWithoutNote: state => JSON.parse(JSON.stringify(fns.leftWithoutNote(data.items, state)))
  };
}
const section = (text, heading) => {
  const start = text.indexOf('## ' + heading + '\n');
  if (start < 0) return null;
  const next = text.indexOf('\n## ', start + 1);
  return text.slice(start, next < 0 ? undefined : next);
};

// 1. Unverified settled lines are not "already checked".

test('a settled item takes an "unverified" reason, a non-empty string', () => {
  assert.strictEqual(render(writeGate(shareGate({ settled: [A1, A2] }))).code, 0);
  const r = render(writeGate(shareGate({ settled: [Object.assign({}, A2, { unverified: 3 })] })));
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /settled\[0\] \("A2"\)\.unverified must be a non-empty string/);
});

test('prompt: an unverified settled line is listed to check, not as already checked', () => {
  const p = load(shareGate({ settled: [A1, A2] })).prompt({ A1: { choice: 'ok' }, A2: { choice: 'ok' } });
  assert.match(section(p, 'Already checked'), /- A1 — Is the rate cached\? → No \(Recon\)/);
  assert.doesNotMatch(section(p, 'Already checked'), /A2/);
  assert.match(section(p, 'Not verified'), /^## Not verified\nThe review could not confirm these: check the one you rely on before you rely on it\.\n- A2 — Does the mail retry\? → No, it is only logged \(Correctness\) — unverified: run the mail spec/);
});

test('prompt in French, and a reopened unverified line is an open question only', () => {
  const b = load(shareGate({ lang: 'fr', settled: [A2] }));
  assert.match(section(b.prompt({}), 'Non vérifié'), /La revue n'a pas pu les confirmer : vérifie celui sur lequel tu t'appuies avant de t'appuyer dessus\.\n- A2 — /);
  assert.strictEqual(section(b.prompt({ A2: { choice: 'reopen' } }), 'Non vérifié'), null);
});

test('review: unverified settled lines get their own body section', () => {
  const rv = load(shareGate({ settled: [A1, A2] })).review({ S1: { choice: 'approve' } });
  assert.match(rv.body, /### Settled without a question\n- A1 — Is the rate cached\?: No \(Recon\)/);
  assert.match(rv.body, /### Not verified\n- A2 — Does the mail retry\?: No, it is only logged \(Correctness\) — unverified: run the mail spec/);
  const settled = rv.body.slice(rv.body.indexOf('### Settled without a question')).split('\n### ')[0];
  assert.doesNotMatch(settled, /A2/);
});

test('the page shows why a settled card is unverified', () => {
  assert.match(TEMPLATE, /'Not verified: ' \+ it\.unverified/);
});

// 2. A finding left as is needs a note before it is shared.

test('leftWithoutNote: decisions left with no note, never tensions, settled items or questions', () => {
  const b = load(shareGate({ settled: [A1], questions: [{ id: 'Q9', title: 'Why?', source: 'MR', who: 'Intent' }] }));
  assert.deepStrictEqual(b.leftWithoutNote({ S1: { choice: 'decline' }, F1: { choice: 'ask', note: 'finance said no' }, T1: { choice: 'Minimalist' }, A1: { choice: 'ok' }, Q9: { choice: 'drop' } }), ['S1']);
  assert.deepStrictEqual(b.leftWithoutNote({ S1: { choice: 'decline', note: '  ' } }), ['S1']);
  assert.deepStrictEqual(b.leftWithoutNote({ S1: { choice: 'approve' } }), []);
});

test('the Share button refuses while a finding is left with no note', () => {
  assert.match(TEMPLATE, /var bare = leftWithoutNote\(items, state\);/);
});

function presetFile(text) {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'preset-')), 'block.txt');
  fs.writeFileSync(f, text);
  return f;
}

test('--preset rejects a finding left as is with no note, and takes one with a note', () => {
  const head = 'CEO SHARE — Gate\nas: file\nvia: self\nrecord: .council/refactors/2026-10-14-x.md\n';
  let r = render(writeGate(shareGate()), '--share', '--preset=' + presetFile(head + 'S1 = decline\nT1 = Minimalist\n'));
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /preset: "S1" is left as is with no note — its reader sees it: say why in a note/);
  assert.doesNotMatch(r.stderr, /"T1"/);
  r = render(writeGate(shareGate()), '--share', '--preset=' + presetFile(head + 'S1 = decline | note: already guarded upstream\n'));
  assert.strictEqual(r.code, 0, r.stderr);
});

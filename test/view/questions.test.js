const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { shareGate, writeGate, render, pageData, RENDER } = require('./helpers');

const loadEn = html => require('node:vm').runInNewContext(/\/\*CHROME-START\*\/([\s\S]*?)\/\*CHROME-END\*\//.exec(html)[1] + '\n({ CHROME_TEXT: CHROME_TEXT })').CHROME_TEXT;
const TEMPLATE = fs.readFileSync(path.join(path.dirname(RENDER), 'template.html'), 'utf8');
const Q = { id: 'A11', title: 'Which document is spec 4.5?', source: 'MR !12', who: 'Intent', why: 'The diff cites it.' };

function page(gate, ...flags) {
  const file = writeGate(gate);
  const r = render(file, ...flags);
  const out = flags.includes('--share') ? '.share.html' : '.html';
  const html = r.code === 0 ? fs.readFileSync(file.replace(/\.gate\.json$/, out), 'utf8') : '';
  return { r, data: html ? pageData(html) : null };
}

test('a question becomes an item to ask or drop, asked by default', () => {
  const { r, data } = page(shareGate({ questions: [Q] }));
  assert.strictEqual(r.code, 0, r.stderr);
  const it = data.items.find(i => i.id === 'A11');
  assert.strictEqual(it.kind, 'question');
  assert.strictEqual(it.group, 'Questions for the author');
  assert.strictEqual(it.default, 'ask');
  assert.deepStrictEqual(it.options.map(o => [o.value, !!o.negative]), [['ask', false], ['drop', true]]);
});

test('a question needs id, title, source and who', () => {
  const { r } = page(shareGate({ questions: [{ id: 'A11', title: 'Why?' }] }));
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /questions\[0\] needs "id", "title", "source" and "who"/);
});

test('a question id clashes with any other id', () => {
  const { r } = page(shareGate({ questions: [Object.assign({}, Q, { id: 'S1' })] }));
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /duplicate id "S1" \(ids must be unique across decisions, tensions, questions, settled and rejected\)/);
});

test('--share asks no brief of a question', () => {
  const { r } = page(shareGate({ questions: [Q] }), '--share');
  assert.strictEqual(r.code, 0, r.stderr);
});

test('the page has a Questions for the author section, before Minor items', () => {
  const q = TEMPLATE.indexOf("sectionFor('Questions for the author', true)");
  assert.ok(q > 0);
  assert.ok(q < TEMPLATE.indexOf("sectionFor('Minor items', true)"));
  { const p = loadEn(TEMPLATE);
    assert.strictEqual(p.en['past.ask'], 'To ask');
    assert.strictEqual(p.en['past.drop'], 'Dropped');
    assert.ok(p.fr['past.ask'] && p.fr['past.drop']);
    assert.match(TEMPLATE, /ask: L\('past\.ask'\), drop: L\('past\.drop'\)/); }
  const t = loadEn(TEMPLATE);
  assert.strictEqual(t.en['card.kindQuestion'], 'Question for the author');
  assert.ok(t.fr['card.kindQuestion']);
  assert.match(TEMPLATE, /question: L\('card\.kindQuestion'\)/);
});

const vm = require('node:vm');

// The share page's prompt and review builders, run on a rendered gate.
function builders(gate) {
  const file = writeGate(gate);
  const r = render(file, '--share');
  assert.strictEqual(r.code, 0, r.stderr);
  const html = fs.readFileSync(file.replace(/\.gate\.json$/, '.share.html'), 'utf8');
  const src = html.match(/\/\*PROMPT-START\*\/([\s\S]*?)\/\*PROMPT-END\*\//)[1];
  const data = pageData(html);
  const fns = vm.runInNewContext(src + '\n({ buildPrompt: buildPrompt, buildReview: buildReview });');
  return {
    prompt: state => fns.buildPrompt(data, data.items, state),
    review: state => JSON.parse(JSON.stringify(fns.buildReview(data, data.items, state, () => true)))
  };
}
const section = (text, heading) => {
  const start = text.indexOf('## ' + heading + '\n');
  if (start < 0) return null;
  const next = text.indexOf('\n## ', start + 1);
  return text.slice(start, next < 0 ? undefined : next);
};
const Q2 = { id: 'A12', title: 'Retry the mail?', source: 'src/mail.js:4', who: 'Correctness' };

test('prompt: asked questions come before To do, with the note; a dropped one is nowhere', () => {
  const b = builders(shareGate({ questions: [Q, Q2] }));
  const p = b.prompt({ A11: { choice: 'ask', note: ' see  the ticket ' }, A12: { choice: 'drop', note: 'answered in chat' } });
  const asked = section(p, 'Questions from the reviewer');
  assert.match(asked, /^## Questions from the reviewer\nThe reviewer asks the branch's author these: show them to me before you start, and don't answer them for me\.\n- A11 — Which document is spec 4\.5\? \(MR !12\)\n  What's at stake: The diff cites it\.\n  Reviewer's note: see the ticket\n/);
  assert.ok(p.indexOf('## Questions from the reviewer') < p.indexOf('## To do'));
  assert.doesNotMatch(p, /A12/);
  assert.strictEqual(section(p, 'My notes'), null);
});

test('prompt: an undecided question counts as asked, and French', () => {
  const p = builders(shareGate({ lang: 'fr', questions: [Q] })).prompt({});
  assert.match(section(p, 'Questions du relecteur'), /- A11 — Which document is spec 4\.5\? \(MR !12\)/);
  assert.doesNotMatch(section(p, 'Non tranché — demande-moi d\'abord') || '', /A11/);
});

test('review: asked questions sit in the body right after the summary, never as threads', () => {
  const b = builders(shareGate({ questions: [Q, Q2], summary: [{ label: 'Verdict', text: 'Mergeable' }] }));
  const rv = b.review({ S1: { choice: 'approve' }, A11: { choice: 'ask', note: 'see the ticket' }, A12: { choice: 'drop' } });
  assert.ok(!rv.comments.some(c => /^A1[12]$/.test(c.id)));
  const q = rv.body.indexOf("### Questions for the author\nAnswer them in a reply on the merge/pull request.\n- A11 — Which document is spec 4.5? — `MR !12`\n  What's at stake: The diff cites it.\n  Reviewer's note: see the ticket");
  assert.ok(q >= 0, rv.body);
  assert.ok(q > rv.body.indexOf('**Verdict**: Mergeable'));
  assert.ok(q < rv.body.indexOf('One thread per card.'));
  assert.doesNotMatch(rv.body, /A12/);
  assert.match(rv.body, /Findings posted — major: \d+, minor: \d+\./);
});

test('a question takes no "on", and no card hangs "on" a question', () => {
  let { r } = page(shareGate({ questions: [Object.assign({}, Q, { on: { id: 'S1' } })] }));
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /"A11" is a question item: only decisions and tensions take "on"/);
  const g = shareGate({ questions: [Q] }); g.decisions[1].on = { id: 'A11' };
  ({ r } = page(g));
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /"F1"\.on names question item "A11"/);
});

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');
const { shareGate, writeGate, render, pageData } = require('./helpers');

function load(overrides) {
  const gate = shareGate(overrides);
  gate.decisions[0].at = { path: 'src/x.js', line: 10 };
  gate.decisions[1].at = { path: 'src/x.js', line: 99 };
  const file = writeGate(gate);
  const r = render(file, '--share');
  assert.strictEqual(r.code, 0, r.stderr);
  const html = fs.readFileSync(file.replace(/\.ceo\.json$/, '.share.html'), 'utf8');
  const src = html.match(/\/\*PROMPT-START\*\/([\s\S]*?)\/\*PROMPT-END\*\//)[1];
  const data = pageData(html);
  const fns = vm.runInNewContext(src + '\n({ buildReview: buildReview, buildItemPrompt: buildItemPrompt });');
  const plain = v => JSON.parse(JSON.stringify(v));
  return {
    data,
    review: (state, inDiff) => plain(fns.buildReview(data, data.items, state, inDiff || (() => true))),
    prompt: (id, value) => {
      const it = data.items.find(i => i.id === id);
      return fns.buildItemPrompt(data, data.items, it, it.options.find(o => o.value === value));
    }
  };
}
const state = { S1: { choice: 'approve', note: 'looks right' } };

test('anchored cards become comments; the rest goes in the body', () => {
  const rv = load().review(state);
  assert.deepStrictEqual(rv.comments.map(c => [c.id, c.path, c.line]), [['S1', 'src/x.js', 10], ['F1', 'src/x.js', 99]]);
  const s1 = rv.comments[0].body, f1 = rv.comments[1].body;
  assert.match(s1, /^\*\*S1 — Extract Constant: RATE\*\*/);
  assert.ok(s1.includes("Reviewer's suggestion: Approve — looks right"));
  assert.strictEqual(s1.split('<details>').length - 1, 1);
  assert.strictEqual(f1.split('<details>').length - 1, 2);
  assert.ok(f1.includes('<summary>Correction prompt — Keep floor</summary>'));
  assert.ok(f1.includes('<summary>Correction prompt — Round</summary>'));
  assert.doesNotMatch(f1, /Ask finance<\/summary>/);
  assert.ok(s1.includes('<summary>Correction prompt</summary>'));
  assert.ok(s1.includes('````text\n'));
  assert.ok(s1.includes('Do S1.'));
  assert.ok(rv.body.startsWith('## Gate'));
  assert.ok(rv.body.includes('One thread per card.'));
  const notAnch = rv.body.slice(rv.body.indexOf('### Not anchored in the diff'));
  assert.match(notAnch, /\*\*T1 — Split module\?\*\*/);
  assert.doesNotMatch(rv.body.split('### Considered and rejected')[0], /RS-1/);
  assert.match(rv.body, /### Considered and rejected\n- RS-1 — Strategy per tier \(Rejected because: One use\)/);
  assert.doesNotMatch(rv.body, /S1 — Extract/);
});

test('the prompt fence is longer than any backtick run in the brief', () => {
  const gate = shareGate();
  gate.decisions[0].at = { path: 'src/x.js', line: 10 };
  gate.decisions[0].brief = 'Do S1.\n````js\nx\n````';
  const file = writeGate(gate);
  assert.strictEqual(render(file, '--share').code, 0);
  const html = fs.readFileSync(file.replace(/\.ceo\.json$/, '.share.html'), 'utf8');
  const src = html.match(/\/\*PROMPT-START\*\/([\s\S]*?)\/\*PROMPT-END\*\//)[1];
  const data = pageData(html);
  const fns = vm.runInNewContext(src + '\n({ buildReview: buildReview });');
  const rv = JSON.parse(JSON.stringify(fns.buildReview(data, data.items, state, () => true)));
  assert.ok(rv.comments[0].body.includes('`````text\n'), rv.comments[0].body);
  assert.ok(rv.comments[0].body.includes('\n`````\n'));
});

test('a card whose line is outside the diff moves to the body with its location', () => {
  const rv = load().review(state, (p, l) => l === 10);
  assert.deepStrictEqual(rv.comments.map(c => c.id), ['S1']);
  assert.match(rv.body, /\*\*F1 — Rounding rule\*\*\n`src\/x\.js:99`/);
});

test('a minor card anchored in the diff gets its own comment', () => {
  const gate = shareGate();
  gate.decisions[0].at = { path: 'src/x.js', line: 10 };
  gate.decisions[0].minor = true;
  const file = writeGate(gate);
  assert.strictEqual(render(file, '--share').code, 0);
  const html = fs.readFileSync(file.replace(/\.ceo\.json$/, '.share.html'), 'utf8');
  const src = html.match(/\/\*PROMPT-START\*\/([\s\S]*?)\/\*PROMPT-END\*\//)[1];
  const data = pageData(html);
  const rv = JSON.parse(JSON.stringify(vm.runInNewContext(src + '\n({ buildReview: buildReview });').buildReview(data, data.items, {}, () => true)));
  assert.ok(rv.comments.some(c => c.id === 'S1' && c.path === 'src/x.js' && c.line === 10));
  assert.ok(!/### Minor/.test(rv.body), rv.body);
});

test('a minor card outside the diff stays in the body\'s Minor section, with its location', () => {
  const gate = shareGate();
  gate.decisions[0].at = { path: 'src/x.js', line: 10 };
  gate.decisions[0].minor = true;
  const rv = load({ decisions: gate.decisions }).review(state, () => false);
  assert.ok(!rv.comments.some(c => c.id === 'S1'));
  assert.match(rv.body, /### Minor\n\*\*S1 — [^\n]*\*\*\n`src\/x\.js:10`/);
});

test('buildItemPrompt: preamble, choice, brief, closing line, needs', () => {
  const p = load().prompt('F1', 'round');
  assert.ok(p.startsWith('# Mission: tidy x.js'));
  assert.ok(p.includes('Choice: Round'));
  assert.ok(p.includes('Use Math.round.'));
  assert.ok(p.includes('## To do\n\n### F1 — Rounding rule\nChoice: Round'));
  assert.match(p, /## Finally\nRead the repo's agent instructions[^\n]*$/);
  const g = shareGate(); g.decisions[1].after = ['S1'];
  const q = load({ decisions: g.decisions }).prompt('F1', 'round');
  assert.ok(q.includes('Comes after S1: check it is done; if not, ask me first.'));
});

test('lang fr', () => {
  const rv = load({ lang: 'fr' }).review(state);
  assert.ok(rv.body.includes('Un fil par carte.'));
  assert.ok(rv.comments[0].body.includes('Suggestion du relecteur : Approve'));
});

// --- suggestion blocks ---
function loadSug(mut, platform) {
  const gate = shareGate();
  gate.decisions[0].at = { path: 'src/x.js', line: 10 };
  gate.decisions[1].at = { path: 'src/x.js', line: 99 };
  mut(gate);
  const file = writeGate(gate);
  assert.strictEqual(render(file, '--share').code, 0);
  const html = fs.readFileSync(file.replace(/\.ceo\.json$/, '.share.html'), 'utf8');
  const src = html.match(/\/\*PROMPT-START\*\/([\s\S]*?)\/\*PROMPT-END\*\//)[1];
  const data = pageData(html);
  const fns = vm.runInNewContext(src + '\n({ buildReview: buildReview });');
  return (inDiff, st) => JSON.parse(JSON.stringify(fns.buildReview(data, data.items, st || {}, inDiff || (() => true), platform)));
}

test('suggestion github: one line gives a suggestion block, no startLine', () => {
  const c = loadSug(g => { g.decisions[0].suggestion = { lines: 1, text: 'const RATE = 2;' }; }, 'github')().comments[0];
  assert.ok(c.body.includes('Suggested change (apply in one click):\n\n```suggestion\nconst RATE = 2;\n```'));
  assert.ok(c.body.indexOf('suggestion\n') < c.body.indexOf('<details>'));
  assert.strictEqual('startLine' in c, false);
});

test('suggestion: empty text deletes, the fence closes right after the open line', () => {
  const c = loadSug(g => { g.decisions[0].suggestion = { lines: 2, text: '' }; }, 'github')().comments[0];
  assert.ok(c.body.includes('```suggestion\n```'));
});

test('suggestion: one trailing newline in text adds no blank line', () => {
  const c = loadSug(g => { g.decisions[0].suggestion = { lines: 1, text: 'x\n' }; }, 'github')().comments[0];
  assert.ok(c.body.includes('```suggestion\nx\n```'));
});

test('suggestion github: three lines span the range', () => {
  const c = loadSug(g => { g.decisions[0].suggestion = { lines: 3, text: 'a\nb\nc' }; }, 'github')().comments[0];
  assert.strictEqual(c.startLine, 10);
  assert.strictEqual(c.line, 12);
  assert.ok(c.body.includes('```suggestion\na\nb\nc\n```'));
});

test('suggestion gitlab: -0+N with N = lines - 1', () => {
  const c = loadSug(g => { g.decisions[0].suggestion = { lines: 3, text: 'a\nb\nc' }; }, 'gitlab')().comments[0];
  assert.ok(c.body.includes('```suggestion:-0+2\na\nb\nc\n```'));
  assert.strictEqual(c.startLine, 10);
});

test('suggestion: an option-level one names the option; french label', () => {
  const rv = loadSug(g => { g.lang = 'fr'; g.decisions[1].options[1].suggestion = { lines: 1, text: 'x' }; }, 'github')();
  const c = rv.comments[1];
  assert.ok(c.body.includes('Modification suggérée pour « Round » (applicable en un clic) :\n\n```suggestion\nx\n```'));
  const en = loadSug(g => { g.decisions[1].options[1].suggestion = { lines: 1, text: 'x' }; }, 'github')().comments[1];
  assert.ok(en.body.includes('Suggested change for «Round» (apply in one click):'));
});

test('suggestion: a line outside the diff drops the block, keeps the prompt', () => {
  const rv = loadSug(g => { g.decisions[0].suggestion = { lines: 3, text: 'a\nb\nc' }; }, 'github')((p, l) => l !== 11);
  const c = rv.comments[0];
  assert.doesNotMatch(c.body, /```suggestion/);
  assert.ok(c.body.includes('<details>'));
  assert.strictEqual('startLine' in c, false);
});

test('a finding left as is gets no thread; the body lists it with its stakes and the note', () => {
  const g = shareGate(); g.decisions[1].why = 'Changes invoices.';
  const rv = load({ decisions: g.decisions }).review({ S1: { choice: 'approve' }, F1: { choice: 'ask', note: 'finance said no' } });
  assert.deepStrictEqual(rv.comments.map(c => c.id), ['S1']);
  assert.match(rv.body, /### Left as is\n- F1 — Rounding rule \(Ask finance\) — `src\/x\.js:99`\n  What's at stake: Changes invoices\.\n  Reason: finance said no/);
});

test('a left line names the option taken, unless it is plain leave or decline', () => {
  const rv = load().review({ S1: { choice: 'decline' }, T1: { choice: 'defer' } });
  assert.match(rv.body, /^- T1 — Split module\? \(Defer\)$/m);
  assert.match(rv.body, /^- S1 — Extract Constant: RATE — `src\/x\.js:10`$/m);
});

test('all findings left as is: no comment, no count, the body keeps the summary and lists them', () => {
  const rv = load({ summary: [{ label: 'Verdict', text: 'Mergeable' }] }).review({
    S1: { choice: 'decline' }, F1: { choice: 'ask' }, T1: { choice: 'Minimalist' }
  });
  assert.deepStrictEqual(rv.comments, []);
  assert.match(rv.body, /\*\*Verdict\*\*: Mergeable/);
  assert.match(rv.body, /Findings posted — major: 0, minor: 0\./);
  ['S1', 'F1', 'T1'].forEach(id => assert.match(rv.body, new RegExp('^- ' + id + ' — ', 'm')));
});

test('a minor finding left as is is listed under Left as is, not Minor', () => {
  const g = shareGate();
  const rv = load({ decisions: g.decisions.concat([{ id: 'Q1', title: 'Misleading name', minor: true, default: 'approve', brief: 'Rename it.' }]) })
    .review({ S1: { choice: 'approve' }, Q1: { choice: 'decline' } });
  assert.match(rv.body, /### Left as is\n- Q1 — Misleading name/);
  assert.doesNotMatch(rv.body, /### Minor/);
});

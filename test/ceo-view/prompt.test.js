const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');
const { shareGate, writeGate, render, pageData } = require('./helpers');

// Render a share page and load the buildPrompt it ships, so the test runs the real pipeline.
function load(gate) {
  const file = writeGate(gate);
  const r = render(file, '--share');
  assert.strictEqual(r.code, 0, r.stderr);
  const html = fs.readFileSync(file.replace(/\.ceo\.json$/, '.share.html'), 'utf8');
  const src = html.match(/\/\*PROMPT-START\*\/([\s\S]*?)\/\*PROMPT-END\*\//)[1];
  const data = pageData(html);
  const fns = vm.runInNewContext(src + '\n({ buildPrompt: buildPrompt, buildItemPrompt: buildItemPrompt, missingAfter: missingAfter });');
  const build = state => fns.buildPrompt(data, data.items, state);
  build.missingAfter = (it, state) => fns.missingAfter(it, data.items, state);
  build.item = (id, value) => {
    const it = data.items.find(i => i.id === id);
    return fns.buildItemPrompt(data, data.items, it, it.options.find(o => o.value === value));
  };
  build.items = data.items;
  return build;
}

const section = (text, heading) => {
  const start = text.indexOf('## ' + heading + '\n');
  if (start < 0) return null;
  const next = text.indexOf('\n## ', start + 1);
  return text.slice(start, next < 0 ? undefined : next);
};

test('a full mix of choices lands in the right sections', () => {
  const prompt = load(shareGate())({
    S1: { choice: 'approve' },
    F1: { choice: 'round', note: '  check   old invoices ' },
    T1: { choice: 'Minimalist' },
    'RS-1': { choice: 'revive' }
  });
  assert.ok(prompt.startsWith('# Mission: tidy x.js'));
  assert.match(prompt, /## To do\n\n### S1/);
  const todo = section(prompt, 'To do');
  assert.match(todo, /### S1 — Extract Constant: RATE\n\nDo S1\./);
  assert.doesNotMatch(todo, /### S1[^#]*Choice:/);
  assert.match(todo, /### F1 — Rounding rule\nChoice: Round\n\nUse Math\.round\./);
  assert.ok(todo.indexOf('### S1') < todo.indexOf('### F1'));
  assert.match(section(prompt, 'Left as is'), /- T1 — Split module\? \(Side with Minimalist\)/);
  assert.match(section(prompt, 'Revived — propose first'), /- RS-1 — Strategy per tier \(Rejected because: One use\)/);
  assert.match(section(prompt, 'My notes'), /- F1: check old invoices/);
  assert.strictEqual(section(prompt, 'Undecided — ask me first'), null);
  assert.match(prompt, /## Finally\nRead the repo's agent instructions \(AGENTS\.md, CLAUDE\.md or similar\)/);
});

test('nothing decided: To do says Nothing and every open item is listed', () => {
  const prompt = load(shareGate())({});
  assert.match(section(prompt, 'To do'), /## To do\n\nNothing\./);
  const open = section(prompt, 'Undecided — ask me first');
  ['S1', 'F1', 'T1'].forEach(id => assert.match(open, new RegExp('- ' + id + ' — ')));
  assert.doesNotMatch(open, /RS-1/);
});

test('the option brief wins over the item brief', () => {
  const gate = shareGate(); gate.decisions[1].brief = 'GENERIC';
  const prompt = load(gate)({ F1: { choice: 'keep' } });
  assert.match(section(prompt, 'To do'), /Add a comment\./);
  assert.doesNotMatch(prompt, /GENERIC/);
});

test('the stakes sit under the title, in the full prompt and in a card prompt', () => {
  const gate = shareGate(); gate.decisions[1].why = 'Changes invoices customers already received.';
  const build = load(gate);
  const stakes = /### F1 — Rounding rule\nWhat's at stake: Changes invoices customers already received\.\nChoice: Round\n\nUse Math\.round\./;
  assert.match(section(build({ F1: { choice: 'round' } }), 'To do'), stakes);
  assert.match(build.item('F1', 'round'), stakes);
});

test('stakes as bullets stay bullets, and French', () => {
  const gate = shareGate({ lang: 'fr' }); gate.decisions[0].why = ['Money moves', 'No test covers it'];
  const prompt = load(gate)({ S1: { choice: 'approve' } });
  assert.match(section(prompt, 'À faire'), /### S1 — Extract Constant: RATE\nEnjeu :\n- Money moves\n- No test covers it\n\nDo S1\./);
});

test('a negative choice on an item with a brief does not leak the brief', () => {
  const prompt = load(shareGate())({ S1: { choice: 'decline' } });
  assert.match(section(prompt, 'Left as is'), /- S1 — Extract Constant: RATE \(Decline\)/);
  assert.doesNotMatch(prompt, /Do S1\./);
});

test('a left item carries its stakes and the note as its reason, once', () => {
  const gate = shareGate(); gate.decisions[1].why = 'Changes invoices customers already received.';
  const prompt = load(gate)({ F1: { choice: 'ask', note: ' finance  said no ' } });
  assert.match(section(prompt, 'Left as is'),
    /## Left as is\nReviewed and left on purpose: don't change them in passing\.\n- F1 — Rounding rule \(Ask finance\)\n  What's at stake: Changes invoices customers already received\.\n  Reason: finance said no/);
  assert.strictEqual(section(prompt, 'My notes'), null);
});

test('settled items are listed as already checked, a reopened one is not', () => {
  const gate = shareGate({ lang: 'fr' });
  gate.settled = [
    { id: 'A1', title: 'Is the tier read per invoice?', answer: 'Per invoice', source: 'src/invoice.js:12', who: 'Mechanics' },
    { id: 'A2', title: 'Is the rate cached?', answer: 'No', source: 'src/rate.js:3', who: 'Recon' }
  ];
  const prompt = load(gate)({ A1: { choice: 'ok' }, A2: { choice: 'reopen' } });
  const checked = section(prompt, 'Déjà vérifié');
  assert.match(checked, /Vérifiés pendant la revue : ne les refais pas et ne les rouvre pas, sauf si le code les contredit\.\n- A1 — Is the tier read per invoice\? → Per invoice \(Mechanics\)/);
  assert.doesNotMatch(checked, /A2/);
  assert.match(section(prompt, 'Non tranché — demande-moi d\'abord'), /- A2 — Is the rate cached\? \(No\)/);
  assert.ok(prompt.indexOf('## Déjà vérifié') < prompt.indexOf('## Pour finir'));
});

test('a stale choice counts as undecided', () => {
  const prompt = load(shareGate())({ F1: { choice: 'gone' } });
  assert.match(section(prompt, 'Undecided — ask me first'), /- F1 — Rounding rule/);
  assert.doesNotMatch(section(prompt, 'To do'), /F1/);
});

test('a note on an undecided item still reaches the prompt', () => {
  const prompt = load(shareGate())({ T1: { note: 'talk to Ana' } });
  assert.match(section(prompt, 'My notes'), /- T1: talk to Ana/);
});

test('lang fr switches the headers', () => {
  const prompt = load(shareGate({ lang: 'fr' }))({ S1: { choice: 'approve' }, F1: { choice: 'round' } });
  assert.match(prompt, /## À faire\n/);
  assert.match(prompt, /Choix : Round/);
  assert.match(prompt, /## Pour finir\n/);
  assert.match(prompt, /Lis les instructions pour agents du repo \(AGENTS\.md, CLAUDE\.md ou équivalent\)/);
});

function needsGate(needs) {
  const g = shareGate();
  g.decisions.push({ id: 'F2', title: 'Another rule', brief: 'Do F2.' }); // needs a decision: a tension is linked with "on"
  g.decisions[0].after = needs;
  return load(g);
}

test('needs: a kept item whose prerequisite is not working carries a warning before its brief', () => {
  const warn = 'Comes after F1, which you did not choose: ask me before doing it without it.';
  const build = needsGate(['F1']);
  const declined = section(build({ S1: { choice: 'approve' }, F1: { choice: 'ask' } }), 'To do');
  assert.ok(declined.includes(warn));
  assert.ok(declined.indexOf(warn) < declined.indexOf('Do S1.'));
  assert.doesNotMatch(section(build({ S1: { choice: 'approve' }, F1: { choice: 'round' } }), 'To do'), /Comes after/);
  assert.ok(section(build({ S1: { choice: 'approve' } }), 'To do').includes(warn));
});

test('needs: several missing ids, and French', () => {
  const many = needsGate(['F1', 'F2'])({ S1: { choice: 'approve' } });
  assert.ok(many.includes('Comes after F1, F2, which you did not choose: ask me before doing it without them.'));
  const g = shareGate({ lang: 'fr' });
  g.decisions[0].after = ['F1'];
  const fr = load(g)({ S1: { choice: 'approve' } });
  assert.ok(fr.includes("Vient après F1, que tu n'as pas retenu : demande-moi avant de le faire sans."));
});

test('missingAfter: lists the after ids that are not chosen', () => {
  const g = shareGate();
  g.decisions.push({ id: 'F2', title: 'Another rule', brief: 'Do F2.' });
  g.decisions[0].after = ['F1', 'F2'];
  const build = load(g);
  const s1 = build.items.find(i => i.id === 'S1');
  const miss = state => JSON.parse(JSON.stringify(build.missingAfter(s1, state)));
  assert.deepStrictEqual(miss({ F1: { choice: 'round' }, F2: { choice: 'approve' } }), []);
  assert.deepStrictEqual(miss({ F1: { choice: 'ask' }, F2: { choice: 'approve' } }), ['F1']);
  assert.deepStrictEqual(miss({}), ['F1', 'F2']);
  const rej = JSON.parse(JSON.stringify(build.missingAfter({ after: ['RS-1'] }, {})));
  assert.deepStrictEqual(rej, ['RS-1']);
});

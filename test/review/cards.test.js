const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'skills', 'team-review', 'cards.sh');

// Writes the given seat files into a fresh run folder and runs cards.sh on it.
function run(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cards-'));
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  const r = spawnSync('sh', [SCRIPT, dir], { encoding: 'utf8' });
  const out = path.join(dir, 'cards.md');
  return { code: r.status, out: r.stdout.trim(), cards: fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '' };
}

function card(id, { conf = 'high', fix = true } = {}) {
  return [
    `### ${id}: Defect in src/a.js:3`,
    '- Lens: correctness',
    '- In diff: yes',
    `- Scenario: ${id} input breaks`,
    `- Evidence: ${id} evidence`,
    `- Refutation: ${id} refutation`,
    ...(fix ? [`- Fix: ${id} fix`] : []),
    '- Severity: major',
    `- Confidence: ${conf}`,
    ''
  ].join('\n');
}

const seat = (...cards) => '# Seat\n\n### Finding Cards\n' + cards.join('\n') + '\n### For team-refactor\n- src/b.js:1 — long function\n';

test('keeps the heading, Scenario and Fix of each high or med card, across seat files', () => {
  const r = run({ 'seat-correctness.md': seat(card('CR-1'), card('CR-2', { conf: 'med' })), 'seat-intent.md': seat(card('IN-1')) });
  assert.strictEqual(r.out, 'cards ok: 3');
  assert.strictEqual(r.code, 0);
  for (const id of ['CR-1', 'CR-2', 'IN-1']) {
    assert.match(r.cards, new RegExp(`^### ${id}: Defect`, 'm'));
    assert.match(r.cards, new RegExp(`^- Scenario: ${id} input breaks$`, 'm'));
    assert.match(r.cards, new RegExp(`^- Fix: ${id} fix$`, 'm'));
  }
  assert.doesNotMatch(r.cards, /Evidence|Refutation|Severity|Lens|long function/);
});

test('takes a seat name used as prefix (CRAFT-1)', () => {
  const r = run({ 'seat-craft.md': seat(card('CRAFT-1')) });
  assert.strictEqual(r.out, 'cards ok: 1');
  assert.match(r.cards, /^### CRAFT-1:/m);
});

test('drops low cards', () => {
  const r = run({ 'seat-correctness.md': seat(card('CR-1', { conf: 'low' }), card('CR-2')) });
  assert.strictEqual(r.out, 'cards ok: 1');
  assert.doesNotMatch(r.cards, /CR-1/);
});

test('reads bold field names', () => {
  const text = card('CR-1').replace('- Scenario:', '- **Scenario:**').replace('- Fix:', '- **Fix**:');
  const r = run({ 'seat-correctness.md': seat(text) });
  assert.strictEqual(r.out, 'cards ok: 1');
  assert.match(r.cards, /^- Scenario: CR-1 input breaks$/m);
  assert.match(r.cards, /^- Fix: CR-1 fix$/m);
});

test('ignores a card inside a fenced block', () => {
  const fenced = '```markdown\n' + card('CR-9') + '```\n';
  const r = run({ 'seat-correctness.md': '# Seat\n\n' + fenced + '\n### Finding Cards\n' + card('CR-1') });
  assert.strictEqual(r.out, 'cards ok: 1');
  assert.doesNotMatch(r.cards, /CR-9/);
});

test('a new seat file does not run on into the last card of the previous one', () => {
  const r = run({ 'seat-a.md': '### Finding Cards\n' + card('CR-1').replace(/- Severity[\s\S]*$/, ''), 'seat-b.md': '# Intent seat\nPreamble line\n\n### Finding Cards\n' + card('IN-1') });
  assert.strictEqual(r.out, 'cards ok: 2');
  assert.doesNotMatch(r.cards, /Intent seat|Preamble/);
});

test('reports a card with no Fix', () => {
  const r = run({ 'seat-correctness.md': seat(card('CR-1', { fix: false })) });
  assert.match(r.out, /^MISMATCH: 1 headings, 1 Scenario, 0 Fix$/);
  assert.strictEqual(r.code, 1);
});

test('nothing to verify', () => {
  const r = run({ 'seat-correctness.md': '# Seat\n\n### Finding Cards\nNone.\n\n### Not raised\n- none\n' });
  assert.strictEqual(r.out, 'cards ok: 0');
  assert.strictEqual(r.code, 0);
});

test("an intake's seat-handoff.md is read like a seat file", () => {
  const r = run({ 'seat-handoff.md': seat(card('HO-1'), card('HO-2')) });
  assert.strictEqual(r.out, 'cards ok: 2');
});

test('no SKILL.md holds text that skill argument substitution rewrites', () => {
  const skills = path.join(ROOT, 'skills');
  for (const d of fs.readdirSync(skills)) {
    const f = path.join(skills, d, 'SKILL.md');
    if (!fs.existsSync(f)) continue;
    const hits = fs.readFileSync(f, 'utf8').split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /\$(\d|ARGUMENTS)/.test(l));
    assert.deepStrictEqual(hits.map(([n]) => `${d}/SKILL.md:${n}`), []);
  }
});

const notRaised = (...lines) => '\n### Not raised\n' + lines.map(l => '- ' + l).join('\n') + '\n';

test('settled lines: author choice and answered lines become ST blocks after the cards', () => {
  const r = run({
    'seat-correctness.md': seat(card('CR-1')) + notRaised('author choice: mail failure is only logged — accepts a cancelled flag with no mail', 'pre-existing: x leaks'),
    'seat-intent.md': seat(card('IN-1')) + notRaised('answered: Is Cars.boxType nullable? — yes, since migration 171 — src/m.ts:11')
  });
  assert.strictEqual(r.code, 0);
  assert.strictEqual(r.out, 'cards ok: 2\nsettled lines: 2');
  assert.match(r.cards, /\n## Settled lines\n\n### ST-1: author choice: mail failure is only logged — accepts a cancelled flag with no mail\n- Seat: correctness\n\n### ST-2: answered: Is Cars\.boxType nullable\? — yes, since migration 171 — src\/m\.ts:11\n- Seat: intent\n/);
  assert.ok(r.cards.indexOf('## Settled lines') > r.cards.indexOf('- Fix: IN-1 fix'));
  assert.doesNotMatch(r.cards, /pre-existing/);
});

test('settled lines only: no card, still something to verify', () => {
  const r = run({ 'seat-intent.md': '# Seat\n\n### Finding Cards\n' + notRaised('answered: Q? — A — a.js:1') });
  assert.strictEqual(r.out, 'cards ok: 0\nsettled lines: 1');
  assert.match(r.cards, /^## Settled lines\n\n### ST-1: answered: Q\? — A — a\.js:1\n- Seat: intent$/m);
});

test('a settled line inside a code fence is not taken', () => {
  const r = run({ 'seat-intent.md': seat(card('IN-1')) + '\n```\n- answered: fake — x — y\n```\n' });
  assert.strictEqual(r.out, 'cards ok: 1');
});

test('settled lines: bold, backticked or capitalised labels are taken and written plainly', () => {
  const r = run({ 'seat-intent.md': seat(card('IN-1')) + '\n### Not raised\n- **answered**: B? — b — b.js:2\n- `answered: C? — c — c.js:3`\n- Answered: D? — d — d.js:4\n- **Author choice:** E — e\n' });
  assert.strictEqual(r.out, 'cards ok: 1\nsettled lines: 4');
  assert.match(r.cards, /### ST-1: answered: B\? — b — b\.js:2\n/);
  assert.match(r.cards, /### ST-2: answered: C\? — c — c\.js:3\n/);
  assert.match(r.cards, /### ST-3: answered: D\? — d — d\.js:4\n/);
  assert.match(r.cards, /### ST-4: author choice: E — e\n/);
});

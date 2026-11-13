const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { routable, tokens, ourSkills, router } = require('./routing');
const { companions, cases } = require('./routing-cases.json');

const ours = ourSkills(path.join(__dirname, '..', '..', 'skills'));
const others = Object.entries(companions).filter(([k]) => !k.startsWith('_')).map(([name, description]) => ({ name, description }));
const rank = router([...ours, ...others]);

test('routing: every case ranks its skill first, against ours and the companions', () => {
  const misses = cases.map(c => ({ c, r: rank(c.prompt) })).filter(({ c, r }) => r[0].name !== c.skill)
    .map(({ c, r }) => `"${c.prompt}" → ${r[0].name} (${r[0].score.toFixed(2)}), wanted ${c.skill} (#${r.findIndex(x => x.name === c.skill) + 1}, ${r.find(x => x.name === c.skill).score.toFixed(2)})`);
  assert.deepStrictEqual(misses, []);
});

test('routing: every skill has a case, and every case names a known skill', () => {
  const names = new Set([...ours, ...others].map(s => s.name));
  for (const c of cases) assert.ok(names.has(c.skill), `unknown skill ${c.skill}`);
  // team-protocol is loaded by the other skills, never asked for: it competes in the ranking, needs no case.
  for (const s of ours.filter(s => s.name !== 'team-protocol')) assert.ok(cases.some(c => c.skill === s.name), `${s.name} has no routing case`);
});

test('routing: a "Not for" sentence does not count for its skill', () => {
  assert.strictEqual(routable('Use when deciding. Not for reviewing code: team-review.'), 'Use when deciding.');
  assert.deepStrictEqual(tokens(routable('Use before the first team-debate, when `.council/x.md` or .council/y is missing.')), ['first', 'miss']);
  const r = router([
    { name: 'team-a', description: 'Use when deciding between options. Not for reviewing code: team-b.' },
    { name: 'team-b', description: 'Use when a change needs a check before merge.' },
  ]);
  assert.strictEqual(r('reviewing code')[0].score, 0);
});

test('routing: stems fold plural and -ing forms', () => {
  assert.deepStrictEqual(tokens('reviews reviewing merging merge'), ['review', 'review', 'merg', 'merg']);
});

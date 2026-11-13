const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SKILLS = path.join(__dirname, '..', '..', 'skills');

// After a compaction, Claude Code re-attaches a loaded skill cut at 20,000 bytes: the tail
// (Rationalizations, Red Flags) is lost. Move what only a later phase or an agent reads to templates.md.
const LIMIT = 20000;

test('every SKILL.md stays under the size Claude Code re-attaches whole after a compaction', () => {
  const over = fs.readdirSync(SKILLS)
    .map(d => path.join(SKILLS, d, 'SKILL.md'))
    .filter(fs.existsSync)
    .map(f => [path.relative(SKILLS, f), fs.statSync(f).size])
    .filter(([, size]) => size >= LIMIT);
  assert.deepEqual(over, [], `over ${LIMIT} bytes: ${over.map(([f, s]) => `${f} (${s})`).join(', ')}`);
});

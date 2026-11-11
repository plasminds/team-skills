const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SKILLS = path.join(__dirname, '..', '..', 'skills');
const read = f => fs.readFileSync(path.join(SKILLS, f), 'utf8');

test('D4-6: the debate record format names the Id column and the retire-never-reuse rule', () => {
  const t = read('team-debate/templates.md');
  assert.ok(t.includes('`Id | Given | When | Then`'));
  assert.ok(t.includes('retired, never reused'));
});

test('D4-6: the plan template cites the record id E<n>', () => {
  assert.ok(read('team-plan/templates.md').includes('record id `E<n>`'));
});

test('D4-6: the acceptance template maps cases to ids and copies examples', () => {
  const t = read('team-acceptance/templates.md');
  assert.ok(t.includes('`example`'));
  assert.ok(t.includes('`examples`'));
  assert.ok(t.includes('`E<n>`'));
  assert.ok(read('team-acceptance/SKILL.md').includes('`E<n>`'));
});

test('team-protocol stays under 16,000 bytes', () => {
  assert.ok(fs.statSync(path.join(SKILLS, 'team-protocol', 'SKILL.md')).size < 16000);
});

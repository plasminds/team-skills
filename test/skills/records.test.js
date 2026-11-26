const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(f, 'utf8');

test('E9: the debate record format writes Revisit when: <condition> or none named on accepted trade-offs', () => {
  const text = read(path.join(ROOT, 'skills', 'team-debate', 'templates.md'));
  const line = text.split('\n').find(l => l.startsWith('- **`## Accepted trade-offs`**'));
  assert.ok(line, 'templates.md has no `## Accepted trade-offs` spec line');
  assert.ok(line.includes('Revisit when: <condition>'), line);
  assert.ok(line.includes('Revisit when: none named'), line);
});

const PLAN = read(path.join(ROOT, 'skills', 'team-plan', 'SKILL.md'));
const exec = PLAN.slice(PLAN.indexOf('## Execution'), PLAN.indexOf('## Rationalizations'));
const pre = PLAN.slice(PLAN.indexOf('## Preconditions'), PLAN.indexOf('## Flow'));

test('E6: team-plan writes Implemented by on the decision record when the plan is executed, a kept red rerun included, and replaces a value already there', () => {
  const last = exec.trim().split('\n').pop();
  assert.ok(last.includes('Implemented by: <plan path>'), last);
  assert.ok(last.includes('Status'), last);
  assert.ok(last.includes('final rerun kept red'), last);
  assert.ok(last.includes('replace its value'), last);
  assert.ok(last.includes('never add a second line'), last);
});

test('E7: team-plan writes no Implemented by on a stopped plan', () => {
  const last = exec.trim().split('\n').pop();
  assert.ok(/a plan that stopped[^.]*gets none/.test(last), last);
  assert.ok(last.includes('a drop after a red final rerun'), last);
});

test("E8: team-plan's decision pick says so and asks before planning an implemented decision again, with no Pick another option when none exists", () => {
  const bullet = pre.split('\n').find(l => l.startsWith('- **A resolved decision**'));
  assert.ok(bullet, 'no first Preconditions bullet');
  assert.ok(bullet.includes('already carries Implemented by: <plan path> (read from its header, not checked against the code).'), bullet);
  assert.ok(bullet.includes('AskUserQuestion'), bullet);
  assert.ok(bullet.includes('Plan this decision again?'), bullet);
  for (const o of ['Plan it again', 'Pick another decision', 'Stop']) assert.ok(bullet.includes('`' + o + '`'), o);
  assert.ok(bullet.includes('omitted when no other record exists'), bullet);
  assert.ok(bullet.includes('never refuses'), bullet);
});

test('Implemented by is a header key, never a Status value', () => {
  const text = read(path.join(ROOT, 'skills', 'team-debate', 'templates.md'));
  const line = text.split('\n').find(l => l.includes('Status: decided YYYY-MM-DD'));
  assert.ok(line, 'no header spec line');
  assert.ok(line.includes('Implemented by: <plan path>'), line);
  assert.ok(line.includes('written by team-plan only'), line);
  assert.ok(line.includes('never a `Status:` value'), line);
  assert.ok(line.includes('never renamed'), line);
  const debate = read(path.join(ROOT, 'skills', 'team-debate', 'SKILL.md'));
  const step = debate.split('\n').find(l => l.startsWith('- **Earlier decisions**'));
  assert.ok(step.includes('Implemented by:'), step);
});

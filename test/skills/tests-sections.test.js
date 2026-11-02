const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { listMd } = require('./helpers');

const ROOT = path.join(__dirname, '..', '..');
const SKILLS = path.join(ROOT, 'skills');
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');

// The ## Tests section runs from its heading to the next `## ` heading.
function testsSection(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex(l => l.trimEnd() === '## Tests');
  if (start === -1) return null;
  let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  if (end === -1) end = lines.length;
  return lines.slice(start + 1, end);
}

function checkRole(text) {
  const problems = [];
  const section = testsSection(text);
  if (!section) problems.push('no ## Tests');
  if (/^## Sources/m.test(text)) problems.push('## Sources heading');
  for (const line of section || []) {
    if (line.startsWith('- ') && line.trim() === '-') problems.push(`empty bullet: ${line}`);
    else if (line.startsWith('- **')) problems.push(`bold label: ${line}`);
    else if (line.startsWith('- *')) problems.push(`starts with *: ${line}`);
    if (line.startsWith('- ') && !line.trimEnd().endsWith('?')) problems.push(`not a question: ${line}`);
  }
  return problems;
}

// A council role's ### Evidence placeholder opens with the test it answers.
function checkEvidence(text, name = 'text') {
  const lines = text.split(/\r?\n/);
  const i = lines.findIndex(l => l.trimEnd() === '### Evidence');
  assert.ok(i !== -1, `${name}: no ### Evidence`);
  const first = lines.slice(i + 1).find(l => l.trim()) ?? '';
  assert.ok(first.includes('Open with the test it answers'), `${name}: ${first}`);
}

const roleFiles = fs.readdirSync(SKILLS, { withFileTypes: true })
  .filter(d => d.isDirectory() && fs.existsSync(path.join(SKILLS, d.name, 'roles')))
  .flatMap(d => fs.readdirSync(path.join(SKILLS, d.name, 'roles'))
    .filter(f => /^role-.*\.md$/.test(f))
    .map(f => path.join(SKILLS, d.name, 'roles', f)));

test('role files: 16 found', () => {
  assert.equal(roleFiles.length, 16);
});

test('role Tests sections: no bold label, each a question', () => {
  for (const f of roleFiles) assert.deepEqual(checkRole(read(f)), [], f);
});

test('skills prose: no via line, no Sources heading; the protocol clause', () => {
  for (const f of listMd(SKILLS)) {
    const text = read(f);
    assert.ok(!text.includes('— via'), `${f}: — via`);
    assert.ok(!/^## Sources/m.test(text), `${f}: ## Sources heading`);
  }
  const protocol = read(SKILLS, 'team-protocol', 'SKILL.md');
  assert.ok(protocol.includes('3–5 tests, no names'));
  assert.ok(!protocol.includes('Pick and declare'));
});

test('team-council-plan copy step: leaves the roles/ glob out', () => {
  assert.ok(read(SKILLS, 'team-council-plan', 'SKILL.md').includes('leaves out the `roles/` glob'));
});

test('checkRole rejects the old shape', () => {
  const bullet = '- **John Ousterhout, *A Philosophy of Software Design*** — Is the interface simpler than what it hides?\n';
  const old = checkRole(`## Sources\n${bullet}`);
  assert.ok(old.includes('no ## Tests'));
  assert.ok(old.includes('## Sources heading'));
  const withTests = checkRole(`## Tests\n${bullet}`);
  assert.ok(withTests.some(p => p.startsWith('bold label')));
  assert.ok(checkRole('## Tests\n- Check the interface is simpler.\n').some(p => p.startsWith('not a question')));
});

test('checkRole names an italic-led or empty bullet', () => {
  assert.ok(checkRole('## Tests\n- *Is it deep?*\n').some(p => p.startsWith('starts with *')));
  assert.ok(checkRole('## Tests\n- \n').some(p => p.startsWith('empty bullet')));
});

test('checkRole tolerates CRLF and a trailing space on the heading', () => {
  assert.deepEqual(checkRole('## Tests\r\n- Is it deep?\r\n'), []);
  assert.deepEqual(checkRole('## Tests \n- Is it deep?\n'), []);
});

test('role tables: no Sources column', () => {
  for (const skill of ['team-council', 'team-refactor', 'team-review']) {
    const headers = read(SKILLS, skill, 'SKILL.md').split('\n').filter(l => l.startsWith('| Role |'));
    assert.ok(headers.length > 0, `${skill}: no role table`);
    for (const h of headers) assert.ok(!h.includes('Sources'), `${skill}: ${h}`);
  }
});

test('council roles: the Evidence placeholder opens with its test', () => {
  const files = roleFiles.filter(f => f.includes('/team-council/roles/'));
  assert.equal(files.length, 5);
  for (const f of files) checkEvidence(read(f), f);
});

test('checkEvidence skips a blank line after the heading', () => {
  checkEvidence('### Evidence\n\n[Checkable: … Open with the test it answers …]\n');
});

test('card templates: Principle and Lens lines carry no source names', () => {
  for (const [skill, label] of [['team-refactor', 'Principle'], ['team-review', 'Lens']]) {
    const line = read(SKILLS, skill, 'templates.md').split(/\r?\n/).find(l => l.startsWith(`- ${label}: <`));
    assert.ok(line, `${skill}: no - ${label}: line`);
    const m = line.match(new RegExp(`^- ${label}: <([^>]*)>$`));
    assert.ok(m, `${skill}: ${line}`);
    assert.ok(!m[1].includes('('), `${skill}: ${line}`);
  }
});

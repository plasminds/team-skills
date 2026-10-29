const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const SKILLS = path.join(ROOT, 'skills');
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');

// The three dedicated agents and the tools each one loses (spec D1).
const AGENTS = {
  'team-analyst': { model: 'sonnet', disallowed: ['Edit', 'NotebookEdit', 'Agent'] },
  'team-judge': { model: 'opus', disallowed: ['Edit', 'NotebookEdit', 'Agent'] },
  'team-maker': { model: 'sonnet', disallowed: ['Agent'] },
};
const TYPES = ['analyst', 'judge', 'maker'];
const CALLERS = ['team-council', 'team-council-plan', 'team-review', 'team-refactor'];

// Flat `key: value` frontmatter; surrounding double quotes are dropped.
function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim().replace(/^"(.*)"$/, '$1');
  }
  return out;
}
const list = s => s.split(',').map(t => t.trim());
const cells = line => line.split('|').slice(1, -1).map(c => c.trim());

// Every dispatch table of a file: a header row `| Agent | … | Model | …`, then its rows as cell arrays.
function dispatchTables(text) {
  const lines = text.split('\n');
  const tables = [];
  lines.forEach((line, i) => {
    if (!line.startsWith('| Agent |') || !cells(line).includes('Model')) return;
    const rows = [];
    for (let j = i + 2; j < lines.length && lines[j].startsWith('|'); j++) rows.push(cells(lines[j]));
    tables.push({ line: i + 1, header: cells(line), rows });
  });
  return tables;
}

for (const [name, want] of Object.entries(AGENTS)) {
  test(`${name}: frontmatter`, () => {
    const fm = frontmatter(read(ROOT, 'agents', `${name}.md`));
    assert.ok(fm, 'no frontmatter');
    assert.strictEqual(fm.name, name);
    assert.ok(fm.description && fm.description.length < 160, `description: ${fm.description}`);
    assert.strictEqual(fm.model, want.model);
    assert.deepStrictEqual(list(fm.disallowedTools), want.disallowed);
    assert.strictEqual(fm.tools, undefined, 'a tools allowlist would drop the Skill and MCP tools');
    for (const tool of ['Read', 'Write', 'Bash', 'Skill']) assert.ok(!list(fm.disallowedTools).includes(tool), `disallows ${tool}`);
  });
}

test('agents/ ships only the three agents', () => {
  const files = fs.readdirSync(path.join(ROOT, 'agents')).filter(f => f.endsWith('.md')).sort();
  assert.deepStrictEqual(files, Object.keys(AGENTS).map(n => `${n}.md`).sort());
});

test('team-protocol: the seat agent rule, under 16,000 bytes', () => {
  const file = path.join(SKILLS, 'team-protocol', 'SKILL.md');
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(Buffer.byteLength(text) < 16000, `${Buffer.byteLength(text)} bytes`);
  assert.match(text, /\*\*Seat agent\.\*\*/);
  assert.match(text, /`team-skills:team-<type>` if the session lists it, else `team-<type>`, else `general-purpose`/);
  assert.match(text, /else `general-purpose`, said once in one line before the first dispatch/);
  assert.match(text, /A dispatch without `model`, or as `general-purpose` while its `team-\*` agent is listed/);
});

for (const skill of CALLERS) {
  test(`${skill}: every dispatch table types its agents`, () => {
    const tables = dispatchTables(read(SKILLS, skill, 'SKILL.md'));
    assert.ok(tables.length > 0, 'no dispatch table');
    for (const t of tables) {
      assert.strictEqual(t.header[1], 'Type', `table at line ${t.line}`);
      const model = t.header.indexOf('Model');
      for (const row of t.rows) {
        assert.ok(TYPES.includes(row[1]), `line ${t.line}: ${row[0]} has type "${row[1]}"`);
        // A judge is a read-only seat its table runs on opus; the keystone writer is the one opus maker.
        if (row[0] === 'Keystone writer') assert.strictEqual(row[1], 'maker');
        else assert.strictEqual(row[1] === 'judge', row[model].startsWith('opus'), `${row[0]}: ${row[1]}, ${row[model]}`);
      }
    }
  });
}

test('execution.md types its executors and reviewers', () => {
  const text = read(SKILLS, 'team-protocol', 'execution.md');
  assert.match(text, /\*\*A fresh executor per batch\*\* \(`maker`\)/);
  assert.match(text, /\*\*A final reviewer on opus\*\* \(`judge`\)/);
  assert.match(text, /a fresh opus re-check \(`judge`\)/);
});

test('execution.md bounds the fixup loop at two attempts, halts and offers retry, keep, drop', () => {
  const text = read(SKILLS, 'team-protocol', 'execution.md');
  assert.match(text, /A fixup and its re-check are one attempt/);
  assert.match(text, /second failed re-check of the same finding/);
  assert.match(text, /`Status:` line to `stopped — fixup re-check failed twice` at once/);
  assert.match(text, /halt the whole execution, every parallel run included/);
  assert.match(text, /stopped — fixup re-check failed twice: <the finding, one line>/);
  assert.match(text, /- retry: .*\n.*- keep: .*\n.*- drop: .*under \*Reverted or blocked\*/);
});

test('Recon is dispatched as team-analyst; team-scan leaves the agents out', () => {
  assert.match(read(SKILLS, 'team-protocol', 'scope.md'), /Dispatch it as `team-analyst`/);
  assert.match(read(SKILLS, 'team-scan', 'SKILL.md'), /The `team-\*` skills and agents are not specialists\./);
});

test('team-scan detects a launch command and writes it in Conventions', () => {
  const text = read(SKILLS, 'team-scan', 'SKILL.md');
  assert.match(text, /^- Launch: <command/m);
  assert.match(text, /nothing runs it/);
});

module.exports = { read, frontmatter, cells, dispatchTables, ROOT, SKILLS, TYPES, CALLERS };

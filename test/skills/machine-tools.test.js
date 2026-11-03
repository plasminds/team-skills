const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const PROTOCOL = path.join(ROOT, 'skills', 'team-protocol');
const read = f => fs.readFileSync(f, 'utf8');

const HEADINGS = ['Run-time re-check', 'Read-only runs', 'Run recipes', 'Mode line', 'Leads, not findings'];
// An installer, a package manager or a download-and-run: the recipes never install a tool (K3). Word edges so "adapt" passes.
const INSTALLER = /\b(brew|apt|apt-get|dnf|pacman|scoop|winget|choco|pipx|nix|uv|conda)\b|git clone|curl [^|]*\| *sh|make install|\bnpm (i|install)\b|\b(pip|cargo|go) install\b/i;

test("machine-tools.md is in team-protocol's copy list", () => {
  const lines = read(path.join(PROTOCOL, 'SKILL.md')).split('\n')
    .filter(l => l.includes('Skill files go into the run folder first'));
  assert.equal(lines.length, 1, 'one copy-list bullet');
  const line = lines[0];
  assert.match(line, /`machine-tools\.md`/, 'named in the prose list');
  const braces = [...line.matchAll(/\{([^}]*)\}/g)].map(m => m[1]);
  assert.ok(braces.some(b => b.split(',').includes('machine-tools.md')), 'named in the cp brace group');
});

test('machine-tools.md and team-scan cite the same source for each tool', () => {
  const SOURCE = /^\s*- (crapper|dryer|ast-grep|gitleaks|osv-scanner) — (github\.com\/\S+)/;
  const sources = file => Object.fromEntries(read(file).split('\n')
    .map(l => l.match(SOURCE)).filter(Boolean).map(m => [m[1], m[2]]));
  const protocol = sources(path.join(PROTOCOL, 'machine-tools.md'));
  const scan = sources(path.join(ROOT, 'skills', 'team-scan', 'SKILL.md'));
  assert.deepEqual(Object.keys(protocol).sort(), ['ast-grep', 'crapper', 'dryer', 'gitleaks', 'osv-scanner']);
  assert.deepEqual(scan, protocol);
});

test('machine-tools.md: five headings, --redact, no installer', () => {
  const lines = read(path.join(PROTOCOL, 'machine-tools.md')).split('\n');
  for (const h of HEADINGS) assert.ok(lines.includes(`## ${h}`), `heading: ${h}`);
  const cmds = [...read(path.join(PROTOCOL, 'machine-tools.md')).matchAll(/`(gitleaks (?:git|dir) [^`]*)`/g)].map(m => m[1]);
  assert.ok(cmds.length >= 2, 'both gitleaks git and dir commands exist');
  for (const c of cmds) assert.match(c, /--redact/, `gitleaks command has --redact: ${c}`);
  for (const l of lines) assert.doesNotMatch(l, INSTALLER, `installer in: ${l.slice(0, 80)}`);
});

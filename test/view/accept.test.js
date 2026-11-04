const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { shareGate, writeGate, render } = require('./helpers');

// shareGate plus a minor step whose default is not its recommendation, and a tension with no recommended side.
function gate() {
  const g = shareGate();
  g.decisions.push({ id: 'S2', title: 'Rename grand → total', minor: true, default: 'decline' });
  g.tensions.push({ topic: 'Cache it?', sides: [{ who: 'Depth', position: 'Yes.' }, { who: 'Minimalist', position: 'No.' }] });
  return g;
}

test('--accept-recommended prints and saves the block the page would send after Accept recommended', () => {
  const file = writeGate(gate());
  const r = render(file, '--accept-recommended');
  assert.strictEqual(r.code, 0, r.stderr);
  const block = [
    'GATE DECISIONS — Gate',
    'record: .council/refactors/2026-10-14-x.md',
    'mode: auto-accept',
    'S1 = approve',
    'F1 = keep',
    'S2 = decline',
    'T1 = Minimalist',
    'T2 = UNDECIDED',
    'RS-1 = keep-rejected'
  ].join('\n');
  const [out, ...rest] = r.stdout.trim().split('\n');
  assert.strictEqual(out, file.replace(/\.gate\.json$/, '.html'));
  assert.ok(fs.existsSync(out));
  assert.strictEqual(rest.join('\n'), block);
  assert.strictEqual(fs.readFileSync(file.replace(/\.gate\.json$/, '.decisions.txt'), 'utf8'), block + '\n');
});

test('--accept-recommended excludes --serve and --share', () => {
  assert.strictEqual(render(writeGate(gate()), '--accept-recommended', '--serve').code, 2);
  assert.strictEqual(render(writeGate(gate()), '--accept-recommended', '--share').code, 2);
});

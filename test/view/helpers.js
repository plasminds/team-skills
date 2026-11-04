const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RENDER = path.join(__dirname, '..', '..', 'skills', 'team-view', 'render.js');

// A small review gate that passes --share: one Approve step, one item with per-option briefs,
// one tension whose minimalist side means no work, one rejected idea.
function shareGate(overrides) {
  const gate = {
    kind: 'review',
    title: 'Gate',
    source: '.council/refactors/2026-10-14-x.md',
    lang: 'en',
    preamble: '# Mission: tidy x.js\n\nRepo acme, branch feat-x, reviewed commit 3cc5e54a9f.',
    decisions: [
      { id: 'S1', title: 'Extract Constant: RATE', brief: 'Do S1.' },
      { id: 'F1', title: 'Rounding rule', options: [
        { value: 'keep', label: 'Keep floor', recommended: true, brief: 'Add a comment.' },
        { value: 'round', label: 'Round', brief: 'Use Math.round.' },
        { value: 'ask', label: 'Ask finance', negative: true }
      ] }
    ],
    tensions: [
      { topic: 'Split module?', sides: [
        { who: 'Responsibilities', position: 'Split it.', brief: 'Split into a.js and b.js.' },
        { who: 'Minimalist', position: 'Keep it.', recommended: true, negative: true }
      ] }
    ],
    rejected: [{ id: 'RS-1', title: 'Strategy per tier', reason: 'One use' }]
  };
  return Object.assign(gate, overrides || {});
}

function writeGate(gate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
  const file = path.join(dir, 'g.gate.json');
  fs.writeFileSync(file, JSON.stringify(gate));
  return file;
}

function render(file, ...flags) {
  const r = spawnSync(process.execPath, [RENDER, file, ...flags], { encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

function pageData(html) {
  return JSON.parse(html.match(/<script type="application\/json" id="gate-data">([\s\S]*?)<\/script>/)[1]);
}

module.exports = { RENDER, shareGate, writeGate, render, pageData };

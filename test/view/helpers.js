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

// A valid 1x1 PNG, for gates whose figures must exist on disk.
const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGM4UWEDAAOIAX3sK7CeAAAAAElFTkSuQmCC', 'base64');

// A small acceptance page: one case with a screenshot and a technical part, one that could not be shown.
function acceptanceGate(overrides) {
  return Object.assign({
    kind: 'acceptance', title: 'Recette — export', date: '2026-11-09', lang: 'fr',
    branch: 'feat-export', commit: '4c3ebf618',
    summary: [{ label: 'Ce que la branche apporte', text: 'Un export CSV des factures.' }],
    cases: [
      { id: 'C1', group: 'Exporter', title: 'Exporter les factures', steps: ['Ouvrir Factures', 'Cliquer sur Exporter'],
        expected: 'Un fichier CSV se télécharge.', figures: [{ src: 'shot.png', caption: 'Le bouton Exporter' }],
        tech: { how: 'Un endpoint GET renvoie le CSV.', files: ['src/export.js'], data: 'Trois factures de test.' } },
      { id: 'C2', group: 'Exporter', title: 'Exporter sans facture', steps: ['Filtrer sur une période vide'],
        expected: 'Un message dit qu’il n’y a rien à exporter.', unshown: 'Aucun environnement sans facture.' }
    ]
  }, overrides || {});
}

function writeAcceptance(gate) {
  const file = writeGate(gate);
  fs.writeFileSync(path.join(path.dirname(file), 'shot.png'), TINY_PNG);
  return file;
}

module.exports = { RENDER, shareGate, writeGate, render, pageData, TINY_PNG, acceptanceGate, writeAcceptance };

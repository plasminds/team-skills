// Share presets and the Share dialog's channel availability.
const fs = require('fs');

const CHANNEL_IDS = ['review'];

// usage: the CLI usage text, appended to the argument error.
function parseChannels(text, USAGE) {
  const bad = msg => { console.error('--channels: ' + msg + '\n' + USAGE); process.exit(2); };
  let c;
  try { c = JSON.parse(text); } catch (e) { return bad('not valid JSON (' + e.message + ')'); }
  if (!c || typeof c !== 'object' || Array.isArray(c)) return bad('must be a JSON object');
  Object.keys(c).forEach(id => {
    if (!CHANNEL_IDS.includes(id)) bad(`unknown channel "${id}" (known: ${CHANNEL_IDS.join(', ')})`);
    const v = c[id];
    const isStr = typeof v === 'string' && v !== '';
    const isLabel = v && typeof v === 'object' && !Array.isArray(v) && typeof v.label === 'string' && v.label !== '';
    if (!(v === true || isStr || isLabel)) bad('channel "review" must be true, { "label": "..." } or a non-empty string');
  });
  return c;
}

// A GATE SHARE block from the served page: "ID = value | note: text" per item, after its title line.
// Appends problems to the caller's errors list (it does not throw); returns null when the file is missing.
function readPreset(file, items, errors) {
  if (!fs.existsSync(file)) { errors.push(`--preset file not found: ${file}`); return null; }
  const byId = Object.fromEntries(items.map(it => [it.id, it]));
  const out = {};
  fs.readFileSync(file, 'utf8').split(/\r?\n/).slice(1).forEach(line => {
    if (/^(as|via|to): /.test(line)) return; // what the reader gets and where it goes, not a choice
    // "(lifts K2)" after the value: that option breaks a constraint; the page knows it from the option itself.
    const m = line.match(/^(\S+) = (.*?)(?: \(lifts [^)]*\))?(?: \| note: (.*))?$/);
    if (!m) return; // the "record:" line, blank lines
    const [, id, value, note] = m;
    const it = byId[id];
    if (!it) { errors.push(`preset: unknown id "${id}"`); return; }
    const entry = {};
    if (value !== 'UNDECIDED') {
      if (!it.options.some(o => o.value === value)) { errors.push(`preset: "${id}" has no option "${value}"`); return; }
      entry.choice = value;
    }
    if (note) entry.note = note;
    // A finding left as is reaches the reader: it goes with its reason (the page's Share button asks the same).
    const opt = it.options.find(o => o.value === entry.choice);
    if (it.kind === 'decision' && opt && opt.negative && !(note && note.trim())) {
      errors.push(`preset: "${id}" is left as is with no note — its reader sees it: say why in a note`);
    }
    if (entry.choice || entry.note) out[id] = entry;
  });
  return out;
}

module.exports = { parseChannels, readPreset };

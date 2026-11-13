// Lexical stand-in for skill routing: which description does a prompt match best?
// TF-IDF over the descriptions, cosine against the prompt. It cannot judge meaning;
// it catches a description that lacks the words users say, and one that outranks
// the right skill. A failing case usually means: fix the description.
const fs = require('node:fs');
const path = require('node:path');

const STOP = new Set(('a an and are as at be before but by can do does for from has have how i if in into is it its ' +
  'me my no not of on or our should so that the their them then there these this those to us use used uses using ' +
  'want we what when where which who whose why will with without you your also any each one own than too very').split(' '));

function stem(w) {
  for (const suf of ['ing', 'ed', 'es', 's']) {
    if (w.endsWith(suf) && w.length - suf.length >= 4 && !(suf === 's' && w.endsWith('ss'))) { w = w.slice(0, -suf.length); break; }
  }
  return w.length > 4 && w.endsWith('e') ? w.slice(0, -1) : w;
}

const tokens = text => (text.toLowerCase().match(/[a-zà-ÿ]+/g) || []).filter(w => w.length > 1 && !STOP.has(w)).map(stem);

// What a user might say to ask for this skill. Left out: "Not for X: team-Y." (names the other skill's
// words to send them away), another skill's name (routing on a name is that skill's), and a path
// (where the output goes, not what anyone asks for).
const routable = desc => desc.split(/(?<=[.!?])\s+/).filter(s => !/^Not for\b/.test(s)).join(' ')
  .replace(/`[^`]*`/g, ' ').replace(/\.council\/\S*/g, ' ').replace(/\bteam-[a-z]+/g, ' ');

function frontmatter(file) {
  const m = fs.readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---/);
  const get = k => { const l = m[1].match(new RegExp(`^${k}:\\s*(.*)$`, 'm'))[1].trim(); return /^["']/.test(l) ? l.slice(1, -1) : l; };
  return { name: get('name'), description: get('description') };
}

function ourSkills(skillsDir) {
  return fs.readdirSync(skillsDir).map(d => path.join(skillsDir, d, 'SKILL.md')).filter(fs.existsSync).map(frontmatter);
}

// skills: [{name, description}] → rank(prompt) gives every name, best match first, with its score.
function router(skills) {
  const docs = skills.map(s => {
    const tf = new Map();
    for (const t of [...tokens(routable(s.description)), ...tokens(s.name.replace(/^team-/, ''))]) tf.set(t, (tf.get(t) || 0) + 1);
    return { name: s.name, tf };
  });
  const df = new Map();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) || 0) + 1);
  const idf = t => Math.log((docs.length + 1) / ((df.get(t) || 0) + 1));
  const vec = tf => { const v = new Map(); for (const [t, n] of tf) v.set(t, n * idf(t)); return v; };
  const norm = v => Math.sqrt([...v.values()].reduce((s, x) => s + x * x, 0)) || 1;
  for (const d of docs) { d.v = vec(d.tf); d.n = norm(d.v); }
  return prompt => {
    const tf = new Map();
    for (const t of tokens(prompt)) tf.set(t, (tf.get(t) || 0) + 1);
    const q = vec(tf), qn = norm(q);
    return docs.map(d => {
      let dot = 0;
      for (const [t, x] of q) dot += x * (d.v.get(t) || 0);
      return { name: d.name, score: dot / (qn * d.n) };
    }).sort((a, b) => b.score - a.score);
  };
}

module.exports = { tokens, routable, frontmatter, ourSkills, router };

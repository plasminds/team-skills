const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const SKILLS = path.join(ROOT, 'skills');
const read = f => fs.readFileSync(f, 'utf8');

function listMd(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listMd(p, out);
    else if (p.endsWith('.md')) out.push(p);
  }
  return out;
}
const FILES = listMd(SKILLS);

// A heading's name: `## Gate page (gate writer)` → `Gate page`, `### 5. Approve & write` → `Approve & write`.
const headings = f => read(f).split('\n')
  .filter(l => /^#{1,6} /.test(l))
  .map(l => l.replace(/^#+ /, '').replace(/^\d+[a-z]?\. /, '').replace(/ \([^)]*\)$/, '').replace(/[*`]/g, '').trim());

// Where a `§ *Section*` reference may point, from the file `from` that holds it:
// `team-x` → that skill's SKILL.md; `team-protocol.md` → the run-folder copy of team-protocol's SKILL.md;
// `x.md` → beside `from`, else in its skill, else any skill's (a caller's `templates.md`);
// no file → `from`, then its skill's SKILL.md and templates.md.
function targets(from, ref) {
  const skillDir = path.join(SKILLS, path.relative(SKILLS, from).split(path.sep)[0]);
  let cands;
  if (!ref) cands = [from, path.join(skillDir, 'SKILL.md'), path.join(skillDir, 'templates.md')];
  else if (ref === 'team-protocol.md') cands = [path.join(SKILLS, 'team-protocol', 'SKILL.md')];
  else if (ref.endsWith('.md')) {
    cands = [path.join(path.dirname(from), ref), path.join(skillDir, ref)].filter(fs.existsSync);
    if (!cands.length) cands = FILES.filter(f => path.basename(f) === ref);
  } else cands = [path.join(SKILLS, ref, 'SKILL.md')];
  return cands.filter(fs.existsSync);
}

test('every `file` § *Section* reference in skills/ names an existing heading', () => {
  const RE = /(?:`([\w.-]+)` )?§ \*([^*]+)\*/g;
  const broken = [];
  let count = 0;
  for (const f of FILES) {
    for (const [ref, file, section] of read(f).matchAll(RE)) {
      count++;
      const cands = targets(f, file);
      if (!cands.some(c => headings(c).includes(section))) broken.push(`${path.relative(ROOT, f)}: ${ref}`);
    }
  }
  assert.ok(count > 100, `only ${count} references found: the pattern no longer matches how skills cite sections`);
  assert.deepStrictEqual(broken, []);
});

// GitHub's anchor for a heading: lowercase, punctuation dropped, spaces to hyphens.
const slug = h => h.toLowerCase().replace(/[^\w\- ]/g, '').replace(/ /g, '-');

test('README: every relative link resolves, anchors included', () => {
  const broken = [];
  for (const [, target] of read(path.join(ROOT, 'README.md')).matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^[a-z]+:/.test(target)) continue;
    const [file, anchor] = target.split('#');
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) broken.push(target);
    else if (anchor && !read(full).split('\n').filter(l => /^#{1,6} /.test(l))
      .some(l => slug(l.replace(/^#+ /, '').trim()) === anchor)) broken.push(target);
  }
  assert.deepStrictEqual(broken, []);
});

test('README: the skills table lists every skill', () => {
  const readme = read(path.join(ROOT, 'README.md'));
  const missing = fs.readdirSync(SKILLS).filter(d => !readme.includes(`(skills/${d}/SKILL.md)`));
  assert.deepStrictEqual(missing, []);
});

// The --diff parser and the ready-to-post review (GitHub payload, GitLab notes). Pure except writeReviewFiles.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// buildReview comes from the template, so the page and the review share one source.
function loadReviewBuilder(templateText) {
  const m = String(templateText).match(/\/\*PROMPT-START\*\/([\s\S]*?)\/\*PROMPT-END\*\//);
  if (!m) throw new Error('template has no PROMPT block');
  return vm.runInNewContext(m[1] + '\n({ buildReview: buildReview })').buildReview;
}

// Build the payloads. Pure: no fs, no console, no exit. Throws an Error when a body is over 60000 characters.
// diff: the Map from parseDiff, or null/undefined (everything counts). state: { id: { choice, note } }.
// Returns { platform, github?: object, gitlab?: [{ name, body }] }; gitlab[0] is the review body.
function buildReviewPayloads({ page, state, buildReview, diff, platform, head, refs }) {
  const inDiff = diff ? inDiffFrom(diff) : () => true;
  const rv = JSON.parse(JSON.stringify(buildReview(page, page.items, state || {}, inDiff, platform)));
  const tooLong = [['the review body', rv.body]].concat(rv.comments.map(c => [`the comment on ${c.id}`, c.body])).filter(([, b]) => b.length > 60000);
  if (tooLong.length) {
    throw new Error(tooLong.map(([n, b]) => `${n} is ${b.length} characters (max 60000): shorten the briefs or the text`).join('\n'));
  }
  if (platform === 'github') {
    return {
      platform,
      github: {
        commit_id: head, body: rv.body,
        comments: rv.comments.map(c => Object.assign({ path: c.path, line: c.line, side: 'RIGHT', body: c.body },
          c.startLine ? { start_line: c.startLine, start_side: 'RIGHT' } : {}))
      }
    };
  }
  const [base_sha, start_sha, head_sha] = refs.split(',');
  const gitlab = [{ name: '00-body.json', body: { note: rv.body } }];
  rv.comments.forEach((c, i) => {
    const position = { position_type: 'text', base_sha, start_sha, head_sha, old_path: c.path, new_path: c.path, new_line: c.startLine || c.line };
    const old = inDiff.oldLine ? inDiff.oldLine(c.path, c.startLine || c.line) : null;
    if (old !== null) position.old_line = old; // a context line sits on both sides
    gitlab.push({ name: `${String(i + 1).padStart(2, '0')}-${c.id}.json`, body: { note: c.body, position } });
  });
  return { platform, gitlab };
}

// The only fs writer. outBase: the gate path without .json; returns the path to print.
function writeReviewFiles(outBase, payloads) {
  if (payloads.platform === 'github') {
    const out = outBase + '.review.github.json';
    fs.writeFileSync(out, JSON.stringify(payloads.github, null, 2) + '\n');
    return out;
  }
  const dir = outBase + '.review.gitlab';
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir);
  payloads.gitlab.forEach(f => fs.writeFileSync(path.join(dir, f.name), JSON.stringify(f.body, null, 2) + '\n'));
  return dir;
}

// Unified diff text -> Map<path, Map<newLine, oldLine|null>>: the new-side lines of each hunk, with the old-side
// number of a context line and null for an added one. Pure. Throws an Error when the input is not text.
// Hunks are walked by their counts, so a line inside one is never mistaken for a header.
function parseDiff(text) {
  if (typeof text !== 'string') throw new Error('diff must be text');
  const files = new Map();
  let cur = null, oldN = 0, newN = 0, oldLeft = 0, newLeft = 0;
  text.split(/\r?\n/).forEach(l => {
    if (oldLeft > 0 || newLeft > 0) {
      const c = l[0];
      if (c === '\\') return;
      if (c === '+') { if (cur) cur.set(newN, null); newN++; newLeft--; return; }
      if (c === '-') { oldN++; oldLeft--; return; }
      if (c === ' ' || l === '') { if (cur) cur.set(newN, oldN); newN++; oldN++; newLeft--; oldLeft--; return; }
      oldLeft = newLeft = 0;
    }
    let m = l.match(/^\+\+\+ (.*?)(?:\t.*)?$/);
    if (m) {
      const p = m[1] === '/dev/null' ? null : m[1].replace(/^b\//, '');
      if (p === null) cur = null;
      else { if (!files.has(p)) files.set(p, new Map()); cur = files.get(p); }
      return;
    }
    m = l.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (m) {
      oldN = Number(m[1]); oldLeft = m[2] === undefined ? 1 : Number(m[2]);
      newN = Number(m[3]); newLeft = m[4] === undefined ? 1 : Number(m[4]);
    }
  });
  return files;
}

// inDiff(path, line) from a parseDiff Map. A suggestion range counts when every line is in some hunk; lines between hunks are never in the diff, so only adjacent -U0 hunks could pair up.
// The function has .oldLine(path, line): the old-side number of a context line, null for an added one.
function inDiffFrom(files) {
  const f = (p, line) => files.has(p) && files.get(p).has(line);
  f.oldLine = (p, line) => (files.has(p) && files.get(p).get(line) !== undefined ? files.get(p).get(line) : null);
  return f;
}

module.exports = { parseDiff, inDiffFrom, loadReviewBuilder, buildReviewPayloads, writeReviewFiles };

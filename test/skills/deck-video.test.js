const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const SKILLS = path.join(ROOT, 'skills');
const read = f => fs.readFileSync(f, 'utf8');

// Skills that cite team-scan's Brand line definition; steps 2 and 5 fill it.
const CITERS = ['team-deck', 'team-video'];

// The Run preferences block of team-scan's output format: from its heading to the closing fence.
function runPreferences() {
  const text = read(path.join(SKILLS, 'team-scan', 'SKILL.md'));
  const start = text.indexOf('\n## Run preferences\n');
  assert.ok(start >= 0, 'team-scan has no `## Run preferences` heading');
  const end = text.indexOf('\n```', start);
  assert.ok(end > start, 'the Run preferences block has no closing fence');
  return text.slice(start, end).split('\n');
}

test('team-scan defines the Brand line once, in Run preferences (E6)', () => {
  const brand = runPreferences().filter(l => l.startsWith('- Brand ('));
  assert.strictEqual(brand.length, 1);
  assert.ok(brand[0].includes('default: <repo name>; none; neutral'), brand[0]);
  assert.ok(brand[0].endsWith('the user, <date>[, default taken]'), brand[0]);
  assert.ok(brand[0].includes('<#primary> [<#secondary>] [<#surface>] | neutral'), brand[0]);
});

test('every Brand citer is registered', () => {
  for (const skill of CITERS) {
    assert.ok(fs.existsSync(path.join(SKILLS, skill, 'SKILL.md')), skill);
  }
});

test('team-scan defines <repo name> as the origin URL last path segment', () => {
  const text = read(path.join(SKILLS, 'team-scan', 'SKILL.md'));
  assert.ok(text.includes('`<repo name>` is the last path segment of `git remote get-url origin`'));
});

for (const skill of CITERS) {
  test(`${skill} cites the Brand definition and restates no default (E6, M3)`, () => {
    const text = read(path.join(SKILLS, skill, 'SKILL.md'));
    assert.ok(text.includes('`team-scan` § *Run preferences*'));
    assert.ok(!/repo name/i.test(text), 'restates the repo-name default');
    assert.ok(!/no logo/i.test(text), 'restates the no-logo default');
    for (const phrase of ['default taken', 'one write outside', 'Tested on Linux; macOS and Windows unverified', 'each with 2-4 options, the recommended one first']) {
      assert.ok(text.includes(phrase), phrase);
    }
    const flow0 = text.slice(text.indexOf('### 0.'), text.indexOf('### 1.'));
    assert.ok(flow0.includes('AskUserQuestion'), 'flow 0 asks with AskUserQuestion');
    assert.ok(flow0.includes('file:line'), 'flow 0 offers sources as file:line');
    assert.ok(!flow0.includes('answer "ok"'), 'flow 0 has no free-text block');
    assert.ok(text.includes('"colors"'), 'brand object has colors');
    assert.ok(!/accent/i.test(text), 'no accent left');
  });
}

test('team-deck mentions no ffmpeg (E5)', () => {
  assert.ok(!/ffmpeg/i.test(read(path.join(SKILLS, 'team-deck', 'SKILL.md'))));
});

test('team-deck description routes diaporama and excludes pptx; opener count is a placeholder', () => {
  const text = read(path.join(SKILLS, 'team-deck', 'SKILL.md'));
  const desc = text.match(/^description:\s*(.*)$/m)[1];
  assert.ok(desc.includes('diaporama'));
  assert.ok(desc.includes('Not for a .pptx file'));
});

test('team-video SKILL.md pins the writes yes, the probe order, the music yes and the personal-data decision (E4, M3)', () => {
  const text = read(path.join(SKILLS, 'team-video', 'SKILL.md'));
  assert.ok(text.includes('No yes → no gesture is filmed'));
  const flow = text.slice(text.indexOf('## Flow'));
  const step = n => {
    const start = flow.indexOf(`### ${n}.`);
    assert.ok(start >= 0, `step ${n}`);
    const next = flow.indexOf('\n### ', start + 1);
    return flow.slice(start, next < 0 ? undefined : next);
  };
  const s0 = step(0);
  const probe = s0.indexOf('video.js probe');
  assert.ok(probe >= 0, 'step 0 names probe');
  for (const other of ['video.js check', 'video.js preview', 'video.js render']) {
    const i = s0.indexOf(other);
    assert.ok(i < 0 || i > probe, `${other} before probe`);
  }
  assert.ok(step(5).includes('asks yes or no'));
  assert.ok(step(4).includes('the human, who keeps, blurs or removes'));
});

test('team-video description routes vidéo and excludes the acceptance page', () => {
  const text = read(path.join(SKILLS, 'team-video', 'SKILL.md'));
  const desc = text.match(/^description:\s*(.*)$/m)[1];
  assert.ok(desc.includes('vidéo'));
  assert.ok(desc.includes('Not for the acceptance page itself: team-acceptance'));
});

test('team-video covers the case name, says stale, never repeats a write without a new yes, routes French', () => {
  const text = read(path.join(SKILLS, 'team-video', 'SKILL.md'));
  assert.ok(text.includes('chapter, case, title, text and bullets'));
  assert.ok(text.includes('film de démo'));
  assert.ok(text.includes('new yes'));
  assert.ok(text.includes('re-shoots every shot'));
  const flow = text.slice(text.indexOf('## Flow'));
  const s7 = flow.slice(flow.indexOf('### 7.'));
  assert.ok(s7.includes('stale:'));
});

test('team-video re-run leaves no old frame; a retried shoot never repeats a write', () => {
  const text = read(path.join(SKILLS, 'team-video', 'SKILL.md'));
  const flow = text.slice(text.indexOf('## Flow'));
  const s0 = flow.slice(flow.indexOf('### 0.'), flow.indexOf('### 1.'));
  const s1 = flow.slice(flow.indexOf('### 1.'), flow.indexOf('### 2.'));
  const s2 = flow.slice(flow.indexOf('### 2.'), flow.indexOf('### 3.'));
  assert.ok(s0.includes('a re-run starts by deleting `shots/` (its frames and `manifest.json`), so no frame from before it remains'));
  assert.ok(s1.includes('stills of states the environment already holds, shot in this run, never frames kept from an earlier shoot'));
  assert.ok(s2.includes('a retry never repeats that write without a new yes in flow 1\'s form'));
  assert.ok(s2.includes('every retry, not only flow 0\'s and flow 4\'s'));
});

test('team-video flow 3 passes --from to preview as check and render do', () => {
  const text = read(path.join(SKILLS, 'team-video', 'SKILL.md'));
  assert.ok(text.includes('--slide=<n> --from=<dir>'));
});

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { RENDER, shareGate, writeGate, render, pageData } = require('./helpers');

const shareOf = file => file.replace(/\.gate\.json$/, '.share.html');
const localOf = file => file.replace(/\.gate\.json$/, '.html');

test('--share writes a standalone page with the share data', () => {
  const file = writeGate(shareGate());
  const r = render(file, '--share');
  assert.strictEqual(r.code, 0, r.stderr);
  assert.strictEqual(r.stdout.trim().split('\n')[0], shareOf(file));
  const html = fs.readFileSync(shareOf(file), 'utf8');
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<title>Gate<\/title>/);
  const data = pageData(html);
  assert.strictEqual(data.mode, 'share');
  assert.strictEqual(data.lang, 'en');
  assert.match(data.preamble, /3cc5e54a9f/);
  assert.strictEqual(data.source, undefined);
  const byId = Object.fromEntries(data.items.map(it => [it.id, it]));
  assert.strictEqual(byId.S1.brief, 'Do S1.');
  assert.strictEqual(byId.F1.options.find(o => o.value === 'round').brief, 'Use Math.round.');
  const sides = byId.T1.options;
  assert.strictEqual(sides.find(o => o.value === 'Responsibilities').brief, 'Split into a.js and b.js.');
  assert.strictEqual(sides.find(o => o.value === 'Minimalist').negative, true);
});

test('the local page carries no share fields, but keeps the briefs the human decides on', () => {
  const file = writeGate(shareGate());
  assert.strictEqual(render(file).code, 0);
  const html = fs.readFileSync(localOf(file), 'utf8');
  const data = pageData(html);
  assert.strictEqual(data.mode, undefined);
  assert.strictEqual(data.preamble, undefined);
  assert.strictEqual(data.lang, 'en');
  assert.strictEqual(data.source, '.council/refactors/2026-10-14-x.md');
  const byId = Object.fromEntries(data.items.map(it => [it.id, it]));
  assert.strictEqual(byId.S1.brief, 'Do S1.');
  assert.strictEqual(byId.F1.options.find(o => o.value === 'round').brief, 'Use Math.round.');
  assert.strictEqual(byId.T1.options.find(o => o.value === 'Responsibilities').brief, 'Split into a.js and b.js.');
  // The evidence pane shows the shown option's brief, folded, under "How it gets done".
  const chrome = require('node:vm').runInNewContext(/\/\*CHROME-START\*\/([\s\S]*?)\/\*CHROME-END\*\//.exec(html)[1] + '\n({ CHROME_TEXT: CHROME_TEXT })').CHROME_TEXT;
  assert.strictEqual(chrome.en['ev.howDone'], 'How it gets done');
  assert.ok(chrome.fr['ev.howDone']);
  assert.ok(html.includes("evGroup(L('ev.howDone')"));
});

test('lang reaches every page: en when the gate has none, fr when it says so', () => {
  const none = writeGate(shareGate({ lang: undefined }));
  assert.strictEqual(render(none).code, 0);
  assert.strictEqual(pageData(fs.readFileSync(localOf(none), 'utf8')).lang, 'en');
  const fr = writeGate(shareGate({ lang: 'fr' }));
  assert.strictEqual(render(fr).code, 0);
  assert.strictEqual(pageData(fs.readFileSync(localOf(fr), 'utf8')).lang, 'fr');
});

test('the local render ignores missing share fields', () => {
  const gate = shareGate();
  delete gate.preamble;
  delete gate.decisions[0].brief;
  assert.strictEqual(render(writeGate(gate)).code, 0);
});

test('--share and --serve are exclusive', () => {
  assert.strictEqual(render(writeGate(shareGate()), '--share', '--serve').code, 2);
});

function rejects(gate, pattern) {
  const r = render(writeGate(gate), '--share');
  assert.strictEqual(r.code, 1, 'expected a rejection');
  assert.match(r.stderr, pattern);
}

test('--share needs a preamble', () => {
  const gate = shareGate(); delete gate.preamble;
  rejects(gate, /needs "preamble"/);
});

test('--share needs a commit SHA in the preamble', () => {
  rejects(shareGate({ preamble: 'Repo acme, branch feat-x, reviewed on 20261014.' }), /names no commit SHA/);
});

test('--share rejects a gate that is not a review', () => {
  const file = writeGate(shareGate({ kind: 'refactor' }));
  const r = render(file, '--share');
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /--share needs kind "review": only a team-review gate is shared with the branch owner/);
  assert.ok(!fs.existsSync(file.replace(/\.gate\.json$/, '.share.html')));
});

test('an option that leads to work needs a brief', () => {
  const gate = shareGate(); delete gate.decisions[0].brief;
  rejects(gate, /"S1" option "approve" leads to work but has no brief/);
});

test('several work options cannot share the item brief: the prompt would pair one choice with another fix', () => {
  const gate = shareGate(); gate.decisions[1].brief = 'Add a comment.';
  delete gate.decisions[1].options[0].brief; delete gate.decisions[1].options[1].brief;
  rejects(gate, /"F1" option "keep" has no brief of its own/);
  rejects(gate, /"F1" option "round" has no brief of its own/);
  // The local page shows the brief too, so a refactor gate is held to the same rule.
  const local = render(writeGate(Object.assign(gate, { kind: 'refactor' })));
  assert.strictEqual(local.code, 1);
  assert.match(local.stderr, /"F1" option "keep" has no brief of its own/);
});

test('a "change nothing" tension side without negative is rejected by name', () => {
  const gate = shareGate(); delete gate.tensions[0].sides[1].negative;
  rejects(gate, /"T1" option "Minimalist" leads to work but has no brief/);
});

test('absolute local paths and .council/ are rejected', () => {
  const home = shareGate(); home.decisions[0].brief = 'Edit /home/thomas/x.js';
  rejects(home, /S1\.brief holds "\/home\/", a path the reader doesn't have/);
  const council = shareGate({ preamble: 'Commit 3cc5e54a9f. Never commit .council/ files.' });
  rejects(council, /preamble holds "\.council\/"/);
  const win = shareGate(); win.decisions[1].options[1].brief = 'See C:\\Users\\me\\x.js';
  rejects(win, /F1\.options\[round\]\.brief holds/);
});

test('repo-relative paths containing tmp/ are accepted', () => {
  const gate = shareGate(); gate.decisions[0].brief = 'Move `src/tmp/cache.js` next to `lib/tmp/`.';
  assert.strictEqual(render(writeGate(gate), '--share').code, 0);
});

test('lang must be en or fr', () => {
  rejects(shareGate({ lang: 'de' }), /"lang" must be one of en, fr/);
});

test('a brief holding </script> survives the page', () => {
  const gate = shareGate(); gate.decisions[0].brief = 'Keep the `</script>` tag escaped.';
  const file = writeGate(gate);
  assert.strictEqual(render(file, '--share').code, 0);
  const data = pageData(fs.readFileSync(shareOf(file), 'utf8'));
  assert.strictEqual(data.items.find(it => it.id === 'S1').brief, 'Keep the `</script>` tag escaped.');
});

test('$ replacement patterns in a brief or title survive both pages', () => {
  const brief = 'Run `echo $&-$\'-$$` here.';
  const title = 'Cost $& and $$ gate';
  const gate = shareGate({ title }); gate.decisions[0].brief = brief;
  const file = writeGate(gate);
  assert.strictEqual(render(file, '--share').code, 0);
  const share = fs.readFileSync(shareOf(file), 'utf8');
  const data = pageData(share);
  assert.strictEqual(data.items.find(it => it.id === 'S1').brief, brief);
  assert.ok(share.includes('<title>' + title.replace(/&/g, '&amp;') + '</title>'));
  assert.strictEqual(render(file).code, 0);
  assert.strictEqual(pageData(fs.readFileSync(localOf(file), 'utf8')).title, title);
});

test('--share --artifact writes the Artifact shape', () => {
  const file = writeGate(shareGate());
  const r = render(file, '--share', '--artifact');
  assert.strictEqual(r.code, 0, r.stderr);
  const out = file.replace(/\.gate\.json$/, '.share.artifact.html');
  assert.strictEqual(r.stdout.trim().split('\n')[0], out);
  const html = fs.readFileSync(out, 'utf8');
  assert.doesNotMatch(html, /<!doctype/i);
  assert.doesNotMatch(html, /<\/?(html|head|body)\b/i);
  assert.match(html, /<title>Gate<\/title>/);
  assert.strictEqual(pageData(html).mode, 'share');
});

test('--artifact and --preset need --share', () => {
  const file = writeGate(shareGate());
  assert.strictEqual(render(file, '--artifact').code, 2);
  assert.strictEqual(render(file, '--preset=x.txt').code, 2);
});

function presetFile(text) {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gate-preset-')), 'g.share.txt');
  fs.writeFileSync(f, text);
  return f;
}

test("--preset carries the sharer's choices and notes into the share page", () => {
  const file = writeGate(shareGate());
  const block = presetFile('GATE SHARE — Gate\nrecord: .council/refactors/2026-10-14-x.md\nS1 = approve\nF1 = round | note: check old invoices\nT1 = UNDECIDED\nRS-1 = keep-rejected\n');
  const r = render(file, '--share', '--preset=' + block);
  assert.strictEqual(r.code, 0, r.stderr);
  const data = pageData(fs.readFileSync(shareOf(file), 'utf8'));
  assert.deepStrictEqual(data.preset, {
    S1: { choice: 'approve' },
    F1: { choice: 'round', note: 'check old invoices' },
    'RS-1': { choice: 'keep-rejected' }
  });
});

test('--preset reads a CRLF file like an LF one', () => {
  const file = writeGate(shareGate());
  const text = 'GATE SHARE — Gate\nrecord: .council/refactors/2026-10-14-x.md\nS1 = approve\nF1 = round | note: check old invoices\nT1 = UNDECIDED\nRS-1 = keep-rejected\n';
  assert.strictEqual(render(file, '--share', '--preset=' + presetFile(text.replace(/\n/g, '\r\n'))).code, 0);
  assert.deepStrictEqual(pageData(fs.readFileSync(shareOf(file), 'utf8')).preset, {
    S1: { choice: 'approve' },
    F1: { choice: 'round', note: 'check old invoices' },
    'RS-1': { choice: 'keep-rejected' }
  });
});

test('a bare --preset is rejected and the preset file is left alone', () => {
  const file = writeGate(shareGate());
  const block = presetFile('GATE SHARE — Gate\nS1 = approve\n');
  const r = render(file, '--share', '--preset', block);
  assert.strictEqual(r.code, 2);
  assert.match(r.stderr, /--preset takes a file: --preset=<block\.txt>/);
  assert.strictEqual(fs.readFileSync(block, 'utf8'), 'GATE SHARE — Gate\nS1 = approve\n');
});

test('--preset keeps a note on an undecided item and a side whose name has spaces', () => {
  const gate = shareGate(); gate.tensions[0].sides[1].who = 'Minimalist + Depth';
  const file = writeGate(gate);
  const block = presetFile('GATE SHARE — Gate\nS1 = UNDECIDED | note: ask Ana\nT1 = Minimalist + Depth\n');
  assert.strictEqual(render(file, '--share', '--preset=' + block).code, 0);
  assert.deepStrictEqual(pageData(fs.readFileSync(shareOf(file), 'utf8')).preset, {
    S1: { note: 'ask Ana' },
    T1: { choice: 'Minimalist + Depth' }
  });
});

test('--preset rejects an unknown id, an unknown option and a missing file', () => {
  const rejectsWith = (flag, pattern) => {
    const r = render(writeGate(shareGate()), '--share', flag);
    assert.strictEqual(r.code, 1, r.stderr);
    assert.match(r.stderr, pattern);
  };
  rejectsWith('--preset=' + presetFile('GATE SHARE — Gate\nS9 = approve\n'), /preset: unknown id "S9"/);
  rejectsWith('--preset=' + presetFile('GATE SHARE — Gate\nF1 = nope\n'), /preset: "F1" has no option "nope"/);
  rejectsWith('--preset=' + path.join(os.tmpdir(), 'gate-no-such-dir', 'g.share.txt'), /--preset file not found/);
});

test('needs stays on share items and on the local page', () => {
  const file = writeGate(shareGate({ decisions: [{ id: 'S1', title: 'Extract Constant: RATE', brief: 'Do S1.', after: ['F1'] }, shareGate().decisions[1]] }));
  assert.strictEqual(render(file, '--share').code, 0);
  assert.deepStrictEqual(pageData(fs.readFileSync(shareOf(file), 'utf8')).items.find(i => i.id === 'S1').after, ['F1']);
  assert.strictEqual(render(file).code, 0);
  assert.deepStrictEqual(pageData(fs.readFileSync(localOf(file), 'utf8')).items.find(i => i.id === 'S1').after, ['F1']);
});

test('needs rejects unknown ids, itself and non-arrays', () => {
  const bad = needs => {
    const g = shareGate(); g.decisions[0].after = needs;
    return render(writeGate(g));
  };
  let r = bad(['ZZ']);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /"S1"\.after names unknown id "ZZ"/);
  r = bad(['S1']);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /"S1"\.after names itself/);
  r = bad('F1');
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /"S1"\.after must be an array of ids/);
});

test('--channels needs --serve', () => {
  const r = render(writeGate(shareGate()), '--channels={}');
  assert.strictEqual(r.code, 2);
  assert.match(r.stderr, /--channels needs --serve/);
});

test('--channels rejects bad JSON, unknown ids and bad values before anything is written', () => {
  const cases = [
    ['{nope', /not valid JSON/], ['[]', /object/], ['null', /object/], ['{"slack":true}', /slack/],
    ['{"link":{}}', /link/], ['{"link":3}', /link/], ['{"review":{}}', /review/], ['{"review":""}', /review/]
  ];
  cases.forEach(([json, re]) => {
    const file = writeGate(shareGate());
    const r = spawnSync(process.execPath, [RENDER, file, '--serve', '--no-open', '--channels=' + json], { encoding: 'utf8', timeout: 5000 });
    assert.strictEqual(r.status, 2, json);
    assert.match(r.stderr, re, json);
    assert.strictEqual(fs.existsSync(localOf(file)), false, json);
  });
});

test('--preset ignores the as, via and to lines of a GATE SHARE block', () => {
  const file = writeGate(shareGate());
  const body = 'S1 = approve\nF1 = round | note: check old invoices\n';
  render(file, '--share', '--preset=' + presetFile('GATE SHARE — Gate\n' + body));
  const plain = pageData(fs.readFileSync(shareOf(file), 'utf8')).preset;
  const r = render(file, '--share', '--preset=' + presetFile('GATE SHARE — Gate\nas: file\nvia: mail\nto: marc@example.com\n' + body));
  assert.strictEqual(r.code, 0, r.stderr);
  assert.deepStrictEqual(pageData(fs.readFileSync(shareOf(file), 'utf8')).preset, plain);
});

test('a bare --channels is rejected and its JSON is not taken for the output path', () => {
  const file = writeGate(shareGate());
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-channels-'));
  const r = spawnSync(process.execPath, [RENDER, file, '--serve', '--channels', '{}'], { encoding: 'utf8', timeout: 5000, cwd });
  assert.strictEqual(r.status, 2);
  assert.match(r.stderr, /--channels takes JSON: --channels='<json>'/);
  assert.ok(!fs.existsSync(path.join(cwd, '{}')));
});

// --- at and --review ---
const reviewGate = () => {
  const g = shareGate();
  g.decisions[0].at = { path: 'src/x.js', line: 10 };
  g.decisions[1].at = { path: 'src/x.js', line: 99 };
  return g;
};
const HEAD = 'abc1234def5678';

test('at: a valid at is kept in the share page', () => {
  const file = writeGate(reviewGate());
  assert.strictEqual(render(file, '--share').code, 0);
  const d = pageData(fs.readFileSync(shareOf(file), 'utf8'));
  assert.deepStrictEqual(d.items.find(i => i.id === 'S1').at, { path: 'src/x.js', line: 10 });
});

test('at: invalid forms are rejected in a plain render', () => {
  const bads = [
    ['src/x.js', /"S1"\.at must be \{ "path", "line" \}/],
    [{ line: 3 }, /"S1"\.at must be/],
    [{ path: 'a.js', line: 0 }, /"S1"\.at must be/],
    [{ path: 'a.js', line: 1.5 }, /"S1"\.at must be/],
    [{ path: 'a.js', line: '3' }, /"S1"\.at must be/],
    [{ path: '/home/me/a.js', line: 3 }, /"S1"\.at\.path "\/home\/me\/a\.js" is not repo-relative/],
    [{ path: '/etc/a.js', line: 3 }, /is not repo-relative/],
    [{ path: '.council/x.md', line: 3 }, /is not repo-relative/]
  ];
  bads.forEach(([at, re]) => {
    const g = shareGate(); g.decisions[0].at = at;
    const r = render(writeGate(g));
    assert.strictEqual(r.code, 1, JSON.stringify(at));
    assert.match(r.stderr, re);
  });
});

test('--review=github writes a pending review payload', () => {
  const file = writeGate(reviewGate());
  const r = render(file, '--share', '--review=github', '--head=' + HEAD);
  assert.strictEqual(r.code, 0, r.stderr);
  const out = file.replace(/\.gate\.json$/, '.review.github.json');
  assert.strictEqual(r.stdout.trim(), out);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.strictEqual(j.commit_id, HEAD);
  assert.strictEqual('event' in j, false);
  assert.ok(j.body.startsWith('## Gate'));
  assert.strictEqual(j.comments.length, 2);
  assert.deepStrictEqual(Object.keys(j.comments[0]).sort(), ['body', 'line', 'path', 'side']);
  assert.strictEqual(j.comments[0].side, 'RIGHT');
  assert.strictEqual(fs.existsSync(shareOf(file)), false);
});

test('--review=gitlab writes a folder of notes with positions', () => {
  const file = writeGate(reviewGate());
  const refs = 'aaaaaaa,bbbbbbb,ccccccc';
  const r = render(file, '--share', '--review=gitlab', '--refs=' + refs);
  assert.strictEqual(r.code, 0, r.stderr);
  const dir = file.replace(/\.gate\.json$/, '.review.gitlab');
  assert.strictEqual(r.stdout.trim(), dir);
  assert.deepStrictEqual(fs.readdirSync(dir).sort(), ['00-body.json', '01-S1.json', '02-F1.json']);
  assert.ok(JSON.parse(fs.readFileSync(dir + '/00-body.json', 'utf8')).note.startsWith('## Gate'));
  const n = JSON.parse(fs.readFileSync(dir + '/01-S1.json', 'utf8'));
  assert.deepStrictEqual(n.position, { position_type: 'text', base_sha: 'aaaaaaa', start_sha: 'bbbbbbb', head_sha: 'ccccccc', old_path: 'src/x.js', new_path: 'src/x.js', new_line: 10 });
  assert.match(n.note, /^\*\*S1/);
  fs.writeFileSync(dir + '/stale.json', '{}');
  assert.strictEqual(render(file, '--share', '--review=gitlab', '--refs=' + refs).code, 0);
  assert.strictEqual(fs.existsSync(dir + '/stale.json'), false);
});

test('--review=gitlab --diff: context lines carry old_line, added lines do not; "+++ x" content is not a header', () => {
  const file = writeGate(reviewGate());
  const diff = path.join(path.dirname(file), 'd2.diff');
  fs.writeFileSync(diff, 'diff --git a/src/x.js b/src/x.js\n--- a/src/x.js\n+++ b/src/x.js\n@@ -8,2 +8,3 @@ fn\n a\n+++ x\n c\n@@ -90 +99,2 @@\n+q\n p\n');
  const r = render(file, '--share', '--review=gitlab', '--refs=aaaaaaa,bbbbbbb,ccccccc', '--diff=' + diff);
  assert.strictEqual(r.code, 0, r.stderr);
  const dir = file.replace(/\.gate\.json$/, '.review.gitlab');
  assert.deepStrictEqual(fs.readdirSync(dir).sort(), ['00-body.json', '01-S1.json', '02-F1.json']);
  const ctx = JSON.parse(fs.readFileSync(dir + '/01-S1.json', 'utf8')).position;
  const added = JSON.parse(fs.readFileSync(dir + '/02-F1.json', 'utf8')).position;
  assert.strictEqual(ctx.new_line, 10);
  assert.strictEqual(ctx.old_line, 9);
  assert.strictEqual(added.new_line, 99);
  assert.strictEqual('old_line' in added, false);
});

test('--review --diff moves an out-of-hunk card to the body', () => {
  const file = writeGate(reviewGate());
  const diff = path.join(path.dirname(file), 'd.diff');
  fs.writeFileSync(diff, 'diff --git a/src/x.js b/src/x.js\n--- a/src/x.js\n+++ b/src/x.js\n@@ -8,2 +8,4 @@ fn\n a\n+b\n c\n+d\n@@ -50 +60,0 @@\n-gone\n');
  const r = render(file, '--share', '--review=github', '--head=' + HEAD, '--diff=' + diff);
  assert.strictEqual(r.code, 0, r.stderr);
  const j = JSON.parse(fs.readFileSync(file.replace(/\.gate\.json$/, '.review.github.json'), 'utf8'));
  assert.deepStrictEqual(j.comments.map(c => c.line), [10]);
  assert.ok(j.body.includes('`src/x.js:99`'));
});

test('--review argument errors exit 2 before writing', () => {
  const file = writeGate(reviewGate());
  const bad = (...a) => { const r = render(file, ...a); assert.strictEqual(r.code, 2, a.join(' ') + r.stderr); };
  bad('--share', '--review=github');
  bad('--share', '--review=github', '--head=zz');
  bad('--share', '--review=gitlab', '--refs=aaaaaaa,bbbbbbb');
  bad('--share', '--artifact', '--review=github', '--head=' + HEAD);
  bad('--review=github', '--head=' + HEAD);
  bad('--share', '--review=svn', '--head=' + HEAD);
  bad('--share', '--review', '--head=' + HEAD);
  bad('--share', '--review=github', '--head');
  bad('--share', '--review=gitlab', '--refs');
  bad('--share', '--review=github', '--head=' + HEAD, '--diff');
  assert.strictEqual(fs.existsSync(file.replace(/\.gate\.json$/, '.review.github.json')), false);
});

test('--review: a body over 60000 characters is an error', () => {
  const g = reviewGate();
  g.decisions[0].brief = 'x'.repeat(60001);
  const r = render(writeGate(g), '--share', '--review=github', '--head=' + HEAD);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /60000/);
});

// --- suggestion ---
test('suggestion: invalid forms are rejected', () => {
  const cases = [
    [g => { g.decisions[0].suggestion = { lines: 1, text: 'x' }; delete g.decisions[0].at; }, /"S1"\.suggestion needs "at"/],
    [g => { g.decisions[0].suggestion = { lines: 0, text: 'x' }; }, /"S1"\.suggestion must be \{ "lines", "text" \}/],
    [g => { g.decisions[0].suggestion = { lines: 1.5, text: 'x' }; }, /"S1"\.suggestion must be/],
    [g => { g.decisions[0].suggestion = { lines: 1 }; }, /"S1"\.suggestion must be/],
    [g => { g.decisions[0].suggestion = 'x'; }, /"S1"\.suggestion must be/],
    [g => { g.decisions[1].suggestion = { lines: 1, text: 'a' }; g.decisions[1].options[0].suggestion = { lines: 1, text: 'b' }; }, /"F1" has more than one suggestion/],
    [g => { g.decisions[1].options[0].suggestion = { lines: 1, text: 'a' }; g.decisions[1].options[1].suggestion = { lines: 1, text: 'b' }; }, /"F1" has more than one suggestion/],
    [g => { g.decisions[0].suggestion = { lines: 1, text: 'a\n```\nb' }; }, /"S1"\.suggestion\.text cannot contain a code fence/],
    [g => { g.decisions[1].options[0].suggestion = { lines: 1, text: '  ````  ' }; }, /"F1"\.suggestion\.text cannot contain a code fence/]
  ];
  cases.forEach(([mut, re], i) => {
    const g = reviewGate(); mut(g);
    const r = render(writeGate(g));
    assert.strictEqual(r.code, 1, 'case ' + i + ': ' + r.stderr);
    assert.match(r.stderr, re, 'case ' + i);
  });
});

test('suggestion: valid item-level and option-level pass; empty text deletes', () => {
  const g = reviewGate();
  g.decisions[0].suggestion = { lines: 2, text: '' };
  g.decisions[1].options[1].suggestion = { lines: 1, text: 'const r = Math.round(x);' };
  const file = writeGate(g);
  assert.strictEqual(render(file, '--share').code, 0);
  const d = pageData(fs.readFileSync(shareOf(file), 'utf8'));
  assert.deepStrictEqual(d.items.find(i => i.id === 'S1').suggestion, { lines: 2, text: '' });
  assert.strictEqual(d.items.find(i => i.id === 'F1').options[1].suggestion.lines, 1);
});

test('--review=github: a multi-line suggestion sets start_line and start_side', () => {
  const g = reviewGate();
  g.decisions[0].suggestion = { lines: 3, text: 'a\nb\nc' };
  const file = writeGate(g);
  const r = render(file, '--share', '--review=github', '--head=' + HEAD);
  assert.strictEqual(r.code, 0, r.stderr);
  const j = JSON.parse(fs.readFileSync(file.replace(/\.gate\.json$/, '.review.github.json'), 'utf8'));
  const c = j.comments[0];
  assert.strictEqual(c.start_line, 10);
  assert.strictEqual(c.start_side, 'RIGHT');
  assert.strictEqual(c.line, 12);
  assert.ok(c.body.includes('```suggestion\na\nb\nc\n```'));
  assert.strictEqual('start_line' in j.comments[1], false);
});

test('--review=gitlab: suggestion fence uses -0+N', () => {
  const g = reviewGate();
  g.decisions[0].suggestion = { lines: 3, text: 'a\nb\nc' };
  const file = writeGate(g);
  assert.strictEqual(render(file, '--share', '--review=gitlab', '--refs=aaaaaaa,bbbbbbb,ccccccc').code, 0);
  const dir = file.replace(/\.gate\.json$/, '.review.gitlab');
  const n = JSON.parse(fs.readFileSync(path.join(dir, '01-S1.json'), 'utf8'));
  assert.ok(n.note.includes('```suggestion:-0+2\na\nb\nc\n```'));
  assert.strictEqual(n.position.new_line, 10);
});

test('--preset gives the same page for a CEO SHARE block as for a GATE SHARE block', () => {
  const file = writeGate(shareGate());
  const body = 'S1 = approve\nF1 = round | note: check old invoices\n';
  render(file, '--share', '--preset=' + presetFile('CEO SHARE — Gate\n' + body));
  const old = pageData(fs.readFileSync(shareOf(file), 'utf8'));
  render(file, '--share', '--preset=' + presetFile('GATE SHARE — Gate\n' + body));
  assert.deepStrictEqual(pageData(fs.readFileSync(shareOf(file), 'utf8')), old);
  assert.ok(old.preset);
});

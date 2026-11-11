const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn, execFileSync } = require('node:child_process');
const { composedTemplate, RENDER, shareGate, render, pageData, cover, tmpDir } = require('./helpers');
const { mentions, projectFiles, trackedFiles, blobPrefix, forgeOf, repoOf, editorFor, editorArgs } = require('../../skills/team-view/lib/files');


test('mentions reads backticked paths, path:line, at and the record, and skips code that is not a path', () => {
  const page = {
    source: '.council/reviews/r.md',
    ...cover([{ label: 'Scope', text: '`src/a.js` and `test/a.test.js:12`' }]),
    items: [{ id: 'X', at: { path: 'src/b.js', line: 4 }, detail: ['`res.status(200).json({ ok: true })`', '`/etc/passwd`', '`../up.js`', '`src/c.js:3-9`'] }]
  };
  assert.deepStrictEqual(mentions(page).map(m => m.path).sort(), ['.council/reviews/r.md', 'src/a.js', 'src/b.js', 'src/c.js', 'test/a.test.js']);
});

test('projectFiles keeps the mentions that are files of the repo, sorted and once each', () => {
  const root = tmpDir('gate-files-');
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src', 'a.js'), '');
  const page = { items: [{ id: 'X', detail: ['`src/a.js:3`', '`src/a.js`', '`src/gone.js`', '`src`'] }] };
  assert.deepStrictEqual(projectFiles(page, root), ['src/a.js']);
});

test('blobPrefix turns an origin URL into a web prefix for GitHub and GitLab', () => {
  assert.strictEqual(blobPrefix('git@github.com:acme/shop.git', 'abc123'), 'https://github.com/acme/shop/blob/abc123/');
  assert.strictEqual(blobPrefix('https://github.com/acme/shop', 'main'), 'https://github.com/acme/shop/blob/main/');
  assert.strictEqual(blobPrefix('ssh://git@gitlab.acme.io:2222/team/sub/shop.git', 'feat/x'), 'https://gitlab.acme.io/team/sub/shop/-/blob/feat/x/');
  assert.strictEqual(blobPrefix('https://user:token@gitlab.com/acme/shop.git', 'abc'), 'https://gitlab.com/acme/shop/-/blob/abc/');
  assert.strictEqual(blobPrefix('/srv/git/shop.git', 'abc'), null);
});

function gitRepo() {
  const root = tmpDir('gate-repo-');
  const git = (...a) => execFileSync('git', ['-C', root, ...a], { encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'feat');
  git('config', 'user.email', 't@t'); git('config', 'user.name', 't'); git('config', 'commit.gpgsign', 'false');
  git('remote', 'add', 'origin', 'git@github.com:acme/shop.git');
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src', 'a.js'), 'one\n');
  git('add', '.'); git('commit', '-q', '-m', 'one');
  return { root, git };
}

test('repoOf links the pushed commit, else the pushed branch, else nothing', () => {
  const { root, git } = gitRepo();
  const sub = path.join(root, 'src');
  assert.deepStrictEqual(repoOf(sub), { root: fs.realpathSync(root), blob: null, forge: 'github' });
  git('update-ref', 'refs/remotes/origin/feat', 'HEAD');
  const sha = git('rev-parse', 'HEAD');
  assert.strictEqual(repoOf(sub).blob, `https://github.com/acme/shop/blob/${sha}/`);
  fs.writeFileSync(path.join(root, 'src', 'a.js'), 'two\n');
  git('commit', '-q', '-am', 'two');
  assert.strictEqual(repoOf(sub).blob, 'https://github.com/acme/shop/blob/feat/');
});

test('trackedFiles keeps the files git tracks: an ignored or new file has nothing on the remote', () => {
  const { root } = gitRepo();
  fs.writeFileSync(path.join(root, '.gitignore'), '.council/\n');
  fs.mkdirSync(path.join(root, '.council'));
  fs.writeFileSync(path.join(root, '.council', 'r.md'), '');
  fs.writeFileSync(path.join(root, 'src', 'new.js'), '');
  assert.deepStrictEqual(trackedFiles(root, ['.council/r.md', 'src/a.js', 'src/new.js']), ['src/a.js']);
  assert.deepStrictEqual(trackedFiles(root, []), []);
});

test('forgeOf names GitHub for github.com and GitLab for any other host, whose URLs it takes', () => {
  assert.strictEqual(forgeOf('git@github.com:acme/shop.git'), 'github');
  assert.strictEqual(forgeOf('https://gitlab.com/acme/shop.git'), 'gitlab');
  assert.strictEqual(forgeOf('git@git.acme.io:acme/shop.git'), 'gitlab');
  assert.strictEqual(forgeOf('/srv/git/shop.git'), null);
});

test('repoOf is null outside a git repo', () => {
  assert.strictEqual(repoOf(tmpDir('gate-nogit-')), null);
});

test('editorFor takes TEAM_VIEW_EDITOR, then the IDE Claude runs in, then code or idea on the PATH', () => {
  const all = () => true, none = () => false, only = c => x => x === c;
  assert.strictEqual(editorFor({ TEAM_VIEW_EDITOR: '/opt/idea/bin/idea.sh', VSCODE_PID: '1' }, none), '/opt/idea/bin/idea.sh');
  assert.strictEqual(editorFor({ VSCODE_PID: '1' }, all), 'code');
  assert.strictEqual(editorFor({ TERMINAL_EMULATOR: 'JetBrains-JediTerm' }, all), 'idea');
  assert.strictEqual(editorFor({ TERMINAL_EMULATOR: 'JetBrains-JediTerm' }, only('code')), 'code');
  assert.strictEqual(editorFor({}, only('idea')), 'idea');
  assert.strictEqual(editorFor({}, none), null);
});

test('editorArgs speaks the VS Code and JetBrains command lines', () => {
  assert.deepStrictEqual(editorArgs('code', '/r/src/a.js', 12), ['-g', '/r/src/a.js:12']);
  assert.deepStrictEqual(editorArgs('/usr/bin/cursor', '/r/src/a.js', null), ['-g', '/r/src/a.js']);
  assert.deepStrictEqual(editorArgs('idea', '/r/src/a.js', 12), ['--line', '12', '/r/src/a.js']);
  assert.deepStrictEqual(editorArgs('webstorm.sh', '/r/src/a.js', null), ['/r/src/a.js']);
});

function repoGate() {
  const { root, git } = gitRepo();
  git('update-ref', 'refs/remotes/origin/feat', 'HEAD');
  fs.mkdirSync(path.join(root, '.council', 'gates'), { recursive: true });
  const file = path.join(root, '.council', 'gates', 'g.gate.json');
  const gate = shareGate();
  gate.decisions[1].detail = ['`src/a.js:1` floors the rate', '`src/missing.js` is gone', '`src/new.js` is not committed'];
  fs.writeFileSync(path.join(root, 'src', 'new.js'), '');
  fs.writeFileSync(file, JSON.stringify(gate));
  return { root, git, file };
}

test('the page lists the project files it names and the remote prefix, without changing _rev', () => {
  const { file, git } = repoGate();
  const local = pageData(fs.readFileSync(render(file).stdout.trim(), 'utf8'));
  assert.deepStrictEqual(local.files, ['src/a.js', 'src/new.js']);
  assert.deepStrictEqual(local.repo, { blob: `https://github.com/acme/shop/blob/${git('rev-parse', 'HEAD')}/`, forge: 'github', files: ['src/a.js'] });
  const shared = fs.readFileSync(render(file, '--share').stdout.trim(), 'utf8');
  assert.deepStrictEqual(pageData(shared).files, ['src/a.js', 'src/new.js']);
  assert.doesNotMatch(shared, new RegExp(os.tmpdir().replace(/[/\\]/g, '.')));
  const outside = writeOutside(file);
  assert.strictEqual(pageData(fs.readFileSync(render(outside).stdout.trim(), 'utf8'))._rev, local._rev);
});

function writeOutside(file) {
  const dir = tmpDir('gate-out-');
  const out = path.join(dir, 'g.gate.json');
  fs.copyFileSync(file, out);
  return out;
}

function post(url, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => {
      let text = ''; res.on('data', c => { text += c; }); res.on('end', () => resolve({ status: res.statusCode, text }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

function serveRepoGate(t, env) {
  const { root, file } = repoGate();
  const child = spawn(process.execPath, [RENDER, file, '--serve', '--no-open'], { stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, env) });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  let out = '';
  const url = new Promise((resolve, reject) => {
    child.stdout.on('data', c => { out += c; const m = out.match(/serving (http:\/\/\S+)/); if (m) resolve(m[1]); });
    child.on('close', code => reject(new Error('server exited early: ' + code)));
  });
  return { root, url, child };
}

function fakeEditor(name) {
  const dir = tmpDir('gate-ed-');
  const bin = path.join(dir, name), log = path.join(dir, 'args');
  fs.writeFileSync(bin, `#!/bin/sh\necho "$@" > '${log}'\n`, { mode: 0o755 });
  return { bin, log };
}

async function until(check) {
  for (let i = 0; i < 100 && !check(); i++) await new Promise(r => setTimeout(r, 20));
}

test('the server opens a file the page names in the editor and keeps serving', async t => {
  const ed = fakeEditor('idea');
  const s = serveRepoGate(t, { TEAM_VIEW_EDITOR: ed.bin });
  const res = await post((await s.url) + 'open', JSON.stringify({ path: 'src/a.js', line: 1 }));
  assert.strictEqual(res.status, 204);
  await until(() => fs.existsSync(ed.log));
  assert.strictEqual(fs.readFileSync(ed.log, 'utf8').trim(), `--line 1 ${path.join(fs.realpathSync(s.root), 'src', 'a.js')}`);
  assert.strictEqual(s.child.exitCode, null);
});

test('the server refuses to open a path the page does not name', async t => {
  const ed = fakeEditor('code');
  const s = serveRepoGate(t, { TEAM_VIEW_EDITOR: ed.bin });
  for (const p of ['src/missing.js', '../../etc/passwd', '/etc/passwd']) {
    const res = await post((await s.url) + 'open', JSON.stringify({ path: p }));
    assert.strictEqual(res.status, 404, p);
  }
  assert.strictEqual(fs.existsSync(ed.log), false);
});

test('the server says when no editor can be found', async t => {
  const s = serveRepoGate(t, { TEAM_VIEW_EDITOR: '/nonexistent/editor' });
  const res = await post((await s.url) + 'open', JSON.stringify({ path: 'src/a.js' }));
  assert.strictEqual(res.status, 500);
  assert.match(res.text, /TEAM_VIEW_EDITOR/);
});

test('the template links the files it names: the IDE when served, the remote repo otherwise', () => {
  const html = composedTemplate();
  assert.match(html, /function fileRef\(/);
  assert.match(html, /fetch\('open', \{ method: 'POST'/);
  assert.match(html, /data\.repo && data\.repo\.files\.indexOf\(p\) >= 0/);
  assert.match(html, /FORGES\[data\.repo\.forge\]/);
  assert.match(html, /github: \{ name: 'GitHub', d: 'M12 \.297c/);
  assert.match(html, /gitlab: \{ name: 'GitLab', d: 'm23\.6004 9\.5927/);
  assert.ok(!html.includes('↗'), 'the remote link is a logo, not an arrow');
  assert.match(html, /s\.appendChild\(codeOrFile\(data\.source\)\)/);
  assert.match(html, /rel = 'noopener'/);
  assert.match(html, /inline\(el\('span', 'rti'\), it\.title, true\)/);
  assert.match(html, /fileRef\(at\.path, at\.line, at\.path\)/);
  assert.match(html, /atNode\(el\('div', 'ebox loc'\), it\.at\)/);
});

test('editorFor still reads the old CEO_VIEW_EDITOR, and TEAM_VIEW_EDITOR wins over it', () => {
  const none = () => false;
  assert.strictEqual(editorFor({ CEO_VIEW_EDITOR: '/old/ed' }, none), '/old/ed');
  assert.strictEqual(editorFor({ TEAM_VIEW_EDITOR: '/new/ed', CEO_VIEW_EDITOR: '/old/ed' }, none), '/new/ed');
});

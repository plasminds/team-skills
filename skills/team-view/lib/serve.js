// The one-shot local server.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { editorFor, editorArgs } = require('./files');

function readBody(req, max, done) {
  let body = '';
  req.setEncoding('utf8');
  req.on('data', chunk => { body += chunk; if (body.length > max) req.destroy(); });
  req.on('end', () => done(body));
}

// POST open { path, line }: opens a file the page names (files.list, repo-relative) in the editor. Never any other path.
function openFile(req, res, files) {
  readBody(req, 1e4, body => {
    const reply = (status, text) => { res.writeHead(status, { 'Content-Type': 'text/plain' }); res.end(text); };
    let ask;
    try { ask = JSON.parse(body); } catch (e) { return reply(400, 'not JSON'); }
    if (!files || !ask || !files.list.includes(ask.path)) return reply(404, 'Not a file this page names.');
    const cmd = editorFor(process.env);
    if (!cmd) return reply(500, 'No editor found: set TEAM_VIEW_EDITOR to its command (code, idea…) and render again.');
    const line = Number.isInteger(ask.line) && ask.line > 0 ? ask.line : null;
    const child = spawn(cmd, editorArgs(cmd, path.join(files.root, ask.path), line), { stdio: 'ignore', detached: true });
    child.on('spawn', () => { child.unref(); res.writeHead(204); res.end(); });
    child.on('error', e => reply(500, `Could not run ${cmd} (${e.code}): set TEAM_VIEW_EDITOR to your editor's command and render again.`));
  });
}

// One page, one answer: the server lives until the first decisions block arrives.
// The random path keeps other local pages from posting to it.
// files: { root, list } of the project files the page names, or null.
function serve(page, decisionsFile, shareFile, { open, files }) {
  const http = require('http');
  const token = require('crypto').randomBytes(12).toString('hex');
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === `/${token}/`) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(page);
    }
    if (req.method === 'POST' && req.url === `/${token}/open`) return openFile(req, res, files);
    if (req.method === 'POST' && req.url === `/${token}/decisions`) {
      readBody(req, 1e6, body => {
        const share = /^(GATE|CEO) SHARE/.test(body);
        if (!share && !/^(GATE|CEO) DECISIONS/.test(body)) { res.writeHead(400); return res.end('not a decisions block'); }
        // A share hands the gate to someone else: its choices so far become the share page's --preset.
        fs.writeFileSync(share ? shareFile : decisionsFile, body + '\n');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok', () => {
          console.log(share ? `share requested, choices saved to ${shareFile}\n\n${body}` : `decisions saved to ${decisionsFile}\n\n${body}`);
          server.close();
          server.closeAllConnections?.();
        });
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(0, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${server.address().port}/${token}/`;
    console.log(`serving ${url} (waiting for Send to Claude)`);
    if (!open) return;
    const [cmd, cmdArgs] = process.platform === 'darwin' ? ['open', [url]]
      : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
      : ['xdg-open', [url]];
    spawn(cmd, cmdArgs, { stdio: 'ignore', detached: true })
      .on('error', () => console.log('could not open a browser: open the URL above'))
      .unref();
  });
}

module.exports = { serve };

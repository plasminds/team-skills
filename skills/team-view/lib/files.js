// Project files a gate names: the served page opens them in the IDE, any page links them on the remote repo.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// A repo-relative path in backticks, with an optional :line or :line-line. No absolute path, no "." or ".." segment.
const MENTION = /^((?!\.{1,2}\/)[\w.@+-]+(?:\/(?!\.{1,2}(?:\/|$))[\w.@+-]+)*)(?::(\d+)(?:-\d+)?)?$/;

function strings(v, out) {
  if (typeof v === 'string') out.push(v);
  else if (v && typeof v === 'object') Object.values(v).forEach(x => strings(x, out));
  return out;
}

// Every `path` or `path:line` the page's text names, each card's "at", and the record. Pure.
function mentions(page) {
  const found = typeof page.source === 'string' ? [{ path: page.source, line: null }] : [];
  strings(page, []).forEach(s => (s.match(/`[^`\n]+`/g) || []).forEach(code => {
    const m = MENTION.exec(code.slice(1, -1));
    if (m && m[1] !== '..' && m[1] !== '.') found.push({ path: m[1], line: m[2] ? Number(m[2]) : null });
  }));
  (page.items || []).forEach(it => { if (it.at && typeof it.at.path === 'string') found.push({ path: it.at.path, line: it.at.line || null }); });
  // An acceptance case's technical part lists its files as plain paths.
  (page.items || []).forEach(it => { if (it.tech && Array.isArray(it.tech.files)) it.tech.files.forEach(f => { if (typeof f === 'string') found.push({ path: f, line: null }); }); });
  return found;
}

// The mentions that are files under root, sorted, once each.
function projectFiles(page, root) {
  const isFile = p => { try { return fs.statSync(path.join(root, p)).isFile(); } catch (e) { return false; } };
  return [...new Set(mentions(page).map(m => m.path))].filter(isFile).sort();
}

// origin (scp-like or URL) -> { host, repo } on the web, or null for a local remote.
function webRepo(origin) {
  let host, repo;
  const scp = /^[\w.-]+@([^:/]+):(.+)$/.exec(origin);
  if (scp) [host, repo] = [scp[1], scp[2]];
  else {
    let u;
    try { u = new URL(origin); } catch (e) { return null; }
    if (!/^(https?|ssh|git):$/.test(u.protocol)) return null;
    host = /^https?:$/.test(u.protocol) ? u.host : u.hostname; // an ssh port is not the web's
    repo = u.pathname;
  }
  return { host, repo: repo.replace(/^\/+|\/+$/g, '').replace(/\.git$/, '') };
}

// GitHub on github.com; any other host is taken as a GitLab, whose URLs blobPrefix writes.
function forgeOf(origin) {
  const w = webRepo(origin);
  return w ? (w.host === 'github.com' ? 'github' : 'gitlab') : null;
}

// origin -> the web prefix of a file at ref: GitHub's /blob/, GitLab's /-/blob/. null for a local remote.
function blobPrefix(origin, ref) {
  const w = ref && webRepo(origin);
  if (!w) return null;
  const refPath = ref.split('/').map(encodeURIComponent).join('/');
  return `https://${w.host}/${w.repo}/${forgeOf(origin) === 'github' ? 'blob' : '-/blob'}/${refPath}/`;
}

function git(dir, args) {
  try { return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) { return null; }
}

// The files of list that git tracks: an ignored or uncommitted one has no remote page.
function trackedFiles(root, list) {
  if (!list.length) return [];
  const out = git(root, ['ls-files', '-z', '--', ...list.map(p => ':(literal)' + p)]);
  const tracked = new Set((out || '').split('\0'));
  return list.filter(p => tracked.has(p));
}

// The ref the remote has: HEAD once an origin branch contains it, else the current branch if origin has it, else null.
function remoteRef(dir) {
  if (git(dir, ['branch', '-r', '--contains', 'HEAD', '--list', 'origin/*'])) return git(dir, ['rev-parse', 'HEAD']);
  const branch = git(dir, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  return branch && git(dir, ['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/' + branch]) ? branch : null;
}

// { root, blob, forge } for the repo holding dir (blob null when origin has nothing to link), or null outside a repo.
function repoOf(dir) {
  const root = git(dir, ['rev-parse', '--show-toplevel']);
  if (!root) return null;
  const origin = git(dir, ['remote', 'get-url', 'origin']);
  return { root, blob: origin ? blobPrefix(origin, remoteRef(dir)) : null, forge: origin ? forgeOf(origin) : null };
}

function onPathIn(env) {
  return cmd => (env.PATH || '').split(path.delimiter).some(d => {
    try { fs.accessSync(path.join(d, cmd), fs.constants.X_OK); return true; } catch (e) { return false; }
  });
}

// The editor command: TEAM_VIEW_EDITOR (or the old CEO_VIEW_EDITOR), else the IDE Claude runs in, else code or idea, whichever is on the PATH.
function editorFor(env, onPath = onPathIn(env)) {
  if (env.TEAM_VIEW_EDITOR || env.CEO_VIEW_EDITOR) return env.TEAM_VIEW_EDITOR || env.CEO_VIEW_EDITOR;
  const host = env.TERM_PROGRAM === 'vscode' || env.VSCODE_PID ? 'code'
    : /^JetBrains/.test(env.TERMINAL_EMULATOR || '') ? 'idea' : null;
  return [host, 'code', 'idea'].find(c => c && onPath(c)) || null;
}

// VS Code and its forks take -g file:line; JetBrains launchers take --line n file.
function editorArgs(cmd, file, line) {
  if (/^(code|code-insiders|codium|vscodium|cursor|windsurf)(\.\w+)?$/i.test(path.basename(cmd))) return ['-g', line ? `${file}:${line}` : file];
  return line ? ['--line', String(line), file] : [file];
}

module.exports = { mentions, projectFiles, trackedFiles, blobPrefix, forgeOf, repoOf, editorFor, editorArgs };

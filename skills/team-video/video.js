#!/usr/bin/env node
'use strict';
// Usage: node video.js probe [--music] | check <slides.json> [--from=<dir>] | preview <slides.json> --slide=<n> [--from=<dir>] | render <slides.json> [--from=<dir>]
// The CLI of team-video: every read, write and command but the browser capture (lib/render.js); the logic is in lib/core.js.
// probe: ffmpeg's encoders and filters (libx264, xfade, acrossfade; loudnorm and aac with --music); missing → exit 1.
// check: the stale lines first (they need only the slides file's commit, so an old file that no longer validates is
//   still reported stale), then validate (exit 1), each slide's reading time and its warnings (pace never blocks),
//   the personal-data record (rewritten), and the project's Playwright (none → exit 1).
// preview: one slide as PNG stills in work/, shown in this session only (K7: not leaving the folder, no record needed).
// render: validate, the record (any unchecked item → exit 1 before Playwright or ffmpeg), probe, Playwright, the
//   segments, the chapters, the mux to <topic>.mp4, credits.txt with music; work/ deleted after a zero exit.
// --from=<dir>: the folder Playwright is resolved from, upward (default: the project root, git rev-parse --show-toplevel).
// Exit 1 on invalid input or a failed check, 2 on a wrong call; paths on stdout.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const core = require('./lib/core');
const { resolvePlaywright, renderSegments, captureStills } = require('./lib/render');

const USAGE = 'usage: node video.js probe [--music] | check <slides.json> [--from=<dir>] | preview <slides.json> --slide=<n> [--from=<dir>] | render <slides.json> [--from=<dir>]';
const FLAGS = { probe: ['--music'], check: ['--from'], preview: ['--slide', '--from'], render: ['--from'] };
const FPS = 25, WORKERS = 4;
const SHA = /^[0-9a-f]{7,40}$/;
const LOGO_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml' };

// A stop with its message for stderr and exit 1: invalid input or a failed check.
class Fail extends Error {}

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const nn = i => String(i + 1).padStart(2, '0');

// parseArgs(argv) → { command, file, flags } or { error } (a wrong call: exit 2).
function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!Object.prototype.hasOwnProperty.call(FLAGS, command)) return { error: USAGE };
  const files = [], flags = {};
  for (const a of rest) {
    if (!a.startsWith('--')) { files.push(a); continue; }
    const eq = a.indexOf('=');
    const name = eq < 0 ? a : a.slice(0, eq);
    if (!FLAGS[command].includes(name)) return { error: `${name} does not apply to ${command}\n${USAGE}` };
    if (name === '--music') {
      if (eq >= 0) return { error: `--music takes no value\n${USAGE}` };
      flags.music = true;
      continue;
    }
    const value = eq < 0 ? '' : a.slice(eq + 1);
    if (!value) return { error: `${name} takes a value: ${name}=<...>\n${USAGE}` };
    flags[name.slice(2)] = value;
  }
  if (command === 'probe' ? files.length !== 0 : files.length !== 1) return { error: USAGE };
  if (command === 'preview' && !/^[1-9]\d*$/.test(flags.slide || '')) return { error: `preview needs --slide=<n>, a slide number from 1\n${USAGE}` };
  return { command, file: files[0], flags };
}

// ---------- ffmpeg ----------

// ffmpegProbe({ music }) → { ok, text }: the stop text (not found, or the missing names) or `ffmpeg ok: <names>`.
function ffmpegProbe({ music = false } = {}) {
  const list = flag => spawnSync('ffmpeg', ['-hide_banner', flag], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const enc = list('-encoders');
  if (enc.error && enc.error.code === 'ENOENT') return { ok: false, text: `ffmpeg not found on PATH\n${core.installHint([])}` };
  const fil = enc.error ? enc : list('-filters');
  if (fil.error) return { ok: false, text: `ffmpeg could not run: ${fil.error.message}\n${core.installHint([])}` };
  const missing = core.probeMissing(enc.stdout, fil.stdout, { music });
  if (missing.length) return { ok: false, text: core.installHint(missing) };
  return { ok: true, text: `ffmpeg ok: ${['libx264', 'xfade', 'acrossfade'].concat(music ? ['loudnorm', 'aac'] : []).join(', ')}` };
}

// ---------- the project ----------

// A JSON file parsed, or undefined when it is missing or does not parse (the callers fail closed on undefined).
function readJson(file) {
  if (!fs.existsSync(file)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return undefined;
  }
}

// The slides file, its video folder, the project root and the topic (`<topic>.slides.json`, else the folder's name).
function loadProject(file) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) throw new Fail(`${file} not found`);
  const dir = path.dirname(abs);
  const g = spawnSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  if (g.status !== 0) throw new Fail(`${dir} is not in a git repository; run team-video inside the project`);
  const name = path.basename(abs);
  const topic = name.endsWith('.slides.json') ? name.slice(0, -'.slides.json'.length) : path.basename(dir);
  let doc, parseError = null;
  try {
    doc = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (e) {
    parseError = e.message;
  }
  return { file: abs, dir, root: g.stdout.trim(), topic, doc, parseError };
}

// The stale lines, from the slides file's commit alone (so a file that no longer validates is still reported) and the
// acceptance JSON's commit. Code changed = `git diff --quiet <stamp> HEAD` outside .council/: exit 1 → true,
// 0 → false, anything else (128: a stamp git does not know) → null. A malformed stamp never reaches git.
function staleLines(p) {
  const stamp = isObj(p.doc) ? p.doc.commit : undefined;
  const acc = readJson(path.join(p.root, '.council', 'acceptance', p.topic, `${p.topic}.acceptance.json`));
  let codeChanged = null;
  if (typeof stamp === 'string' && SHA.test(stamp)) {
    const r = spawnSync('git', ['-C', p.root, 'diff', '--quiet', stamp, 'HEAD', '--', '.', ':(exclude).council'], { stdio: 'ignore' });
    codeChanged = r.status === 1 ? true : r.status === 0 ? false : null;
  }
  return core.staleness({ stamp, acceptanceCommit: isObj(acc) ? acc.commit : undefined, codeChanged });
}

// validate, then the files the render reads beyond the shots: the logo (a path from the root) and the music track
// (a path in the video folder). → { errors, manifest }.
function validateDoc(p) {
  if (p.parseError !== null) return { errors: [`${path.basename(p.file)} is not JSON: ${p.parseError}; fix the slides file`], manifest: null };
  const errors = [];
  const mfile = path.join(p.dir, 'shots', 'manifest.json');
  let manifest = null;
  if (fs.existsSync(mfile)) {
    manifest = readJson(mfile);
    if (manifest === undefined) { errors.push('shots/manifest.json is not JSON; re-run the shoot'); manifest = null; }
  }
  errors.push(...core.validate(p.doc, manifest, rel => fs.existsSync(path.join(p.dir, rel))));
  if (errors.length) return { errors, manifest };
  const logo = p.doc.brand.logo;
  if (logo !== null && (!LOGO_TYPES[path.extname(logo).toLowerCase()] || !fs.existsSync(path.resolve(p.root, logo)))) {
    errors.push(`brand.logo: ${logo} not found from the project root; use a .png, .jpg or .svg path from the root, or null`);
  }
  if (p.doc.music && !fs.existsSync(path.resolve(p.dir, p.doc.music.file))) {
    errors.push(`music.file: ${p.doc.music.file} not found in ${p.dir}; download the agreed track into music/, or set music to null`);
  }
  return { errors, manifest };
}

function validOrFail(p) {
  const v = validateDoc(p);
  if (v.errors.length) throw new Fail('invalid slides file:\n- ' + v.errors.join('\n- '));
  return v.manifest;
}

// The personal-data record: every used shot read and hashed, every slide text hashed, the record rewritten.
function checkRecord(p) {
  const hashes = {};
  core.usedShots(p.doc.slides).forEach(rel => { hashes[rel] = core.hash16(fs.readFileSync(path.join(p.dir, rel))); });
  const items = core.recordItems(p.doc.slides, hashes);
  const file = path.join(p.dir, 'personal-data.md');
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const { unchecked, text } = core.recordStatus(before, items, { topic: p.doc.topic });
  if (text !== before) fs.writeFileSync(file, text);
  return { file, items, unchecked };
}

function playwrightPath(p, from) {
  try {
    return resolvePlaywright(from ? path.resolve(from) : p.root);
  } catch (e) {
    throw new Fail(e.message);
  }
}

// The repo name the bar shows, by team-scan's rule for <repo name>: the last path segment of origin's URL, `.git`
// stripped; with no origin, the folder holding the git common dir (the parent of .git or .bare). A git failure → null.
function repoName(dir) {
  const o = spawnSync('git', ['-C', dir, 'remote', 'get-url', 'origin'], { encoding: 'utf8' });
  const url = o.status === 0 ? o.stdout.trim().replace(/\/+$/, '') : '';
  const last = url.split(/[/:]/).pop().replace(/\.git$/, '');
  if (last) return last;
  const c = spawnSync('git', ['-C', dir, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' });
  const common = c.status === 0 ? c.stdout.trim() : '';
  return common ? path.basename(path.dirname(common)) || null : null;
}

// Each slide's page in work/slide<NN>.html (the logo read here, as a data: URI; the repo name once). → the pages' paths.
function writePages(p, manifest, sched, work, only) {
  const { brand, commit, music, slides } = p.doc;
  const repo = repoName(p.root);
  const logoDataUri = brand.logo === null ? null
    : `data:${LOGO_TYPES[path.extname(brand.logo).toLowerCase()]};base64,${fs.readFileSync(path.resolve(p.root, brand.logo)).toString('base64')}`;
  fs.mkdirSync(work, { recursive: true });
  return slides.map((s, i) => {
    if (only !== undefined && i !== only) return null;
    const html = path.join(work, `slide${nn(i)}.html`);
    fs.writeFileSync(html, core.slideHtml(s, i, { brand, logoDataUri, repo, commit, music, total: slides.length, duration: sched.durations[i], manifest }));
    return html;
  });
}

const musicCredit = (doc) => `${/^fr/i.test(doc.brand.lang) ? 'Musique : ' : 'Music: '}${doc.music.title} — ${doc.music.author} (${doc.music.licence})`;
const size = bytes => (bytes < 1048576 ? Math.ceil(bytes / 1024) + ' KB' : (bytes / 1048576).toFixed(1) + ' MB');

// ---------- commands ----------

function check(p, from) {
  staleLines(p).forEach(l => console.log(l));
  validOrFail(p);
  const slides = p.doc.slides;
  const sched = core.schedule(slides);
  slides.forEach((s, i) => console.log(`${i + 1} ${s.chapter} — ${s.title} — ${sched.durations[i]} s`));
  console.log(`reading time ${sched.total} s for ${slides.length} slides (an estimate)`);
  sched.warnings.forEach(w => console.log('warning: ' + w));
  const rec = checkRecord(p);
  console.log(`record: ${rec.file}`);
  console.log(`items: ${rec.items.length - rec.unchecked.length} checked, ${rec.unchecked.length} unchecked`);
  if (rec.unchecked.length) console.log('Run the personal-data pass (flow 4) before render.');
  console.log(`playwright: ${playwrightPath(p, from)}`);
  return 0;
}

async function preview(p, from, n) {
  const manifest = validOrFail(p);
  const slides = p.doc.slides;
  if (n > slides.length) throw new Fail(`--slide=${n}: the slides file has ${slides.length} slides`);
  const playwright = require(playwrightPath(p, from));
  const sched = core.schedule(slides);
  const i = n - 1, d = sched.durations[i], s = slides[i];
  const work = path.join(p.dir, 'work');
  const html = writePages(p, manifest, sched, work, i)[i];
  // A screen slide: one still at the end of each frame's window (its ring and the cursor at its target); else its end.
  const stills = s.kind === 'screen'
    ? s.frames.map((_, k) => ({ at: Math.max((k + 1) * d / s.frames.length - 0.04, 0), out: path.join(work, `slide${nn(i)}-frame${k + 1}.png`) }))
    : [{ at: Math.max(d - 0.04, 0), out: path.join(work, `slide${nn(i)}.png`) }];
  await captureStills(playwright, html, stills);
  stills.forEach(st => console.log(st.out));
  return 0;
}

async function render(p, from) {
  const manifest = validOrFail(p);
  const rec = checkRecord(p);
  if (rec.unchecked.length) {
    const more = rec.unchecked.length > 5 ? `, +${rec.unchecked.length - 5} more` : '';
    throw new Fail(`unchecked frames (personal-data pass first): ${rec.unchecked.slice(0, 5).join(', ')}${more}\nRun the personal-data pass (flow 4), then render again.`);
  }
  const doc = p.doc;
  const probe = ffmpegProbe({ music: doc.music !== null });
  if (!probe.ok) throw new Fail(probe.text);
  const playwright = require(playwrightPath(p, from));
  const sched = core.schedule(doc.slides);
  sched.warnings.forEach(w => console.log('warning: ' + w));

  const work = path.join(p.dir, 'work');
  fs.rmSync(work, { recursive: true, force: true });
  const pages = writePages(p, manifest, sched, work);
  const segments = pages.map((_, i) => path.join(work, `seg${nn(i)}.mkv`));
  await renderSegments(playwright, pages.map((html, i) => ({ html, duration: sched.durations[i], out: segments[i] })), { fps: FPS, workers: WORKERS });

  const chaptersFile = path.join(work, 'chapters.txt');
  const comment = doc.music ? `${doc.commit} · ${musicCredit(doc)} ${doc.music.url}` : doc.commit;
  fs.writeFileSync(chaptersFile, core.chapters(doc.slides, sched, { title: doc.slides[0].title, artist: doc.brand.name, comment }));
  const out = path.join(p.dir, `${p.topic}.mp4`);
  const music = doc.music ? path.resolve(p.dir, doc.music.file) : null;
  const mux = spawnSync('ffmpeg', core.muxArgs({ segments, sched, slides: doc.slides, music, chapters: chaptersFile, out, fade: sched.fade }),
    { stdio: ['ignore', 'inherit', 'inherit'] });
  if (mux.status !== 0) throw new Fail(`ffmpeg mux failed (${mux.error ? mux.error.message : mux.signal || 'exit ' + mux.status}); work/ kept: ${work}`);

  const credits = path.join(p.dir, 'credits.txt');
  if (doc.music) fs.writeFileSync(credits, `${musicCredit(doc)}\n${doc.music.url}\n`);
  else fs.rmSync(credits, { force: true }); // an earlier render's track is no longer in the video
  fs.rmSync(work, { recursive: true, force: true });
  console.log(out);
  console.log(`size: ${size(fs.statSync(out).size)}`);
  console.log(`duration: ${sched.total} s`);
  return 0;
}

async function main(argv) {
  const a = parseArgs(argv);
  if (a.error) { console.error(a.error); return 2; }
  try {
    if (a.command === 'probe') {
      const r = ffmpegProbe({ music: a.flags.music === true });
      (r.ok ? console.log : console.error)(r.text);
      return r.ok ? 0 : 1;
    }
    const p = loadProject(a.file);
    if (a.command === 'check') return check(p, a.flags.from);
    if (a.command === 'preview') return await preview(p, a.flags.from, Number(a.flags.slide));
    return await render(p, a.flags.from);
  } catch (e) {
    if (!(e instanceof Fail)) throw e;
    console.error(e.message);
    return 1;
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }, e => { console.error(e && e.stack ? e.stack : String(e)); process.exitCode = 1; });
}

module.exports = { main, parseArgs, USAGE, repoName, loadProject, writePages };

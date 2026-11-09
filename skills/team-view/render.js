#!/usr/bin/env node
// Usage: node render.js <gate.json> [out.html] [--serve [--no-open] [--channels=<json>] | --accept-recommended | --share [--preset=<block.txt>]]
// Validates a gate JSON, normalizes decisions, tensions and rejected items into one list of
// decidable items, embeds images, and injects the result into template.html.
// Output defaults to <gate>.html next to the JSON, <gate>.share.html with --share.
// --serve: also serve the page on 127.0.0.1 and open it; when the human clicks "Send to Claude",
// save the block to <gate>.decisions.txt, print it, and exit; "Share" saves its block (the choices so far)
// to <gate>.share.txt instead. --no-open skips opening the browser.
// --accept-recommended: an auto-accept run. No server: every card takes its default, else its recommended option, and the
// block (with a "mode: auto-accept" line) is saved to <gate>.decisions.txt and printed after the page path.
// --channels=<json> (with --serve): availability of the Share dialog's choices, detected by Claude:
// { review?: true | { label } | 'why not and how to fix' }.
// --share: a review gate (kind "review") as a page the branch owner acts on alone; it needs "preamble" and briefs (contract.md, Share fields).
// A standalone document, to send as a file.
// --preset=<file>: a GATE SHARE block whose choices and notes the share page starts from.
// --review=github --head=<sha> | --review=gitlab --refs=<base>,<start>,<head> (with --share):
// instead of the page, write a ready-to-post review: <gate>.review.github.json, or the folder <gate>.review.gitlab/.
// --page-url=<https link | /uploads/... path> (with --review): the review body links the shared page, uploaded first.
// kind "acceptance" (team-acceptance): a page that presents a branch; rendered only (no --serve, --accept-recommended, --share), it prints its size after its path.
// Cards with "at" inside the diff become comments; --diff=<unified diff file> says which lines are in it (default: all).
// Internals live in lib/: gate.js (validation), page.js (page + HTML), share.js (presets, channels), review.js (--diff, review payloads), serve.js (local server), accept.js (--accept-recommended), files.js (project files the page names: IDE and remote links).
const fs = require('fs');
const path = require('path');
const { loadGate } = require('./lib/gate');
const { buildPage, renderHtml } = require('./lib/page');
const { acceptedBlock } = require('./lib/accept');
const { parseChannels } = require('./lib/share');
const { parseDiff, loadReviewBuilder, buildReviewPayloads, writeReviewFiles } = require('./lib/review');
const { serve } = require('./lib/serve');
const { repoOf, projectFiles, trackedFiles } = require('./lib/files');

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--')));
const [src, outArg] = args.filter(a => !a.startsWith('--'));
const USAGE = 'usage: node render.js <gate.json> [out.html] [--serve [--no-open] [--channels=<json>] | --accept-recommended | --share [--preset=<block.txt>] [--review=github --head=<sha> | --review=gitlab --refs=<base>,<start>,<head>] [--diff=<file>] [--page-url=<link>]]';
if (args.includes('--preset')) { console.error('--preset takes a file: --preset=<block.txt>\n' + USAGE); process.exit(2); }
if (args.includes('--channels')) { console.error("--channels takes JSON: --channels='<json>'\n" + USAGE); process.exit(2); }
['--review', '--head', '--refs', '--diff', '--page-url'].forEach(f => {
  if (args.includes(f)) { console.error(`${f} takes a value: ${f}=<...>\n` + USAGE); process.exit(2); }
});
if (!src) { console.error(USAGE); process.exit(2); }
const SHARE = flags.has('--share');
const PRESET = (args.find(a => a.startsWith('--preset=')) || '').slice('--preset='.length);
if (SHARE && flags.has('--serve')) { console.error('--share and --serve are exclusive\n' + USAGE); process.exit(2); }
const ACCEPT = flags.has('--accept-recommended');
if (ACCEPT && (SHARE || flags.has('--serve'))) { console.error('--accept-recommended excludes --serve and --share\n' + USAGE); process.exit(2); }
const argOf = name => { const a = args.find(x => x.startsWith(name + '=')); return a === undefined ? undefined : a.slice(name.length + 1); };
const REVIEW = argOf('--review'), HEAD = argOf('--head'), REFS = argOf('--refs'), DIFF = argOf('--diff'), PAGE_URL = argOf('--page-url');
if (REVIEW !== undefined) {
  const bad = msg => { console.error('--review: ' + msg + '\n' + USAGE); process.exit(2); };
  if (!['github', 'gitlab'].includes(REVIEW)) bad('must be github or gitlab');
  if (!SHARE) bad('needs --share');
  if (REVIEW === 'github' && !/^[0-9a-f]{7,40}$/i.test(HEAD || '')) bad('github needs --head=<sha> (7-40 hex characters)');
  if (REVIEW === 'gitlab' && !/^[0-9a-f]{7,40}(,[0-9a-f]{7,40}){2}$/i.test(REFS || '')) bad('gitlab needs --refs=<base>,<start>,<head> (three commit shas)');
  if (PAGE_URL !== undefined && !/^(https:\/\/|\/uploads\/)[^\s()<>\[\]]+$/.test(PAGE_URL)) bad('--page-url must be an https:// link or a GitLab /uploads/... path');
} else if (HEAD !== undefined || REFS !== undefined || DIFF !== undefined || PAGE_URL !== undefined) {
  console.error('--head, --refs, --diff and --page-url need --review\n' + USAGE); process.exit(2);
}
if (PRESET && !SHARE) { console.error('--preset needs --share\n' + USAGE); process.exit(2); }


const CHANNELS_ARG = args.find(a => a.startsWith('--channels='));
let channels = null;
if (CHANNELS_ARG !== undefined) {
  if (!flags.has('--serve')) { console.error('--channels needs --serve\n' + USAGE); process.exit(2); }
  channels = parseChannels(CHANNELS_ARG.slice('--channels='.length), USAGE);
}

const { data, items, outcome, errors, preset } = loadGate(src, { share: SHARE, preset: PRESET });
if (data.kind === 'acceptance' && (flags.has('--serve') || ACCEPT)) errors.push('kind "acceptance" is a page to read, not a gate: --serve and --accept-recommended do not apply (nothing comes back from it)');
if (errors.length) { console.error('invalid gate JSON:\n- ' + errors.join('\n- ')); process.exit(1); }

const page = buildPage({ data, items, outcome, preset, channels, share: SHARE });
// After _rev, like channels: pushing the branch must not reset saved choices.
const repo = repoOf(path.dirname(path.resolve(src)));
const files = repo ? projectFiles(page, repo.root) : [];
if (files.length) {
  page.files = files;
  if (repo.blob) page.repo = { blob: repo.blob, forge: repo.forge, files: trackedFiles(repo.root, files) };
}
let template = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
if (!template.includes('/*TOKENS*/')) { console.error('template.html has no /*TOKENS*/ marker'); process.exit(1); }
template = template.replace('/*TOKENS*/', () => fs.readFileSync(path.join(__dirname, 'tokens.css'), 'utf8').replace(/\n$/, ''));
if (REVIEW) {
  let diff = null;
  if (DIFF) {
    if (!fs.existsSync(DIFF)) { console.error(`--diff file not found: ${DIFF}`); process.exit(2); }
    diff = parseDiff(fs.readFileSync(DIFF, 'utf8'));
  }
  let payloads;
  try {
    payloads = buildReviewPayloads({ page: PAGE_URL ? Object.assign({}, page, { pageUrl: PAGE_URL }) : page, state: preset || {}, buildReview: loadReviewBuilder(template), diff, platform: REVIEW, head: HEAD, refs: REFS });
  } catch (e) { console.error(e.message); process.exit(1); }
  console.log(writeReviewFiles(src.replace(/(\.(ceo|gate))?\.json$/, ''), payloads));
  process.exit(0);
}
const html = renderHtml(page, template, { share: SHARE, title: data.title });

const out = outArg || src.replace(/(\.(ceo|gate))?\.json$/, '') + (SHARE ? '.share.html' : '.html');
fs.writeFileSync(out, html);
console.log(out);
// An acceptance page embeds its screenshots: its size says whether it goes as an attachment.
if (data.kind === 'acceptance') {
  const bytes = Buffer.byteLength(html);
  console.log('size: ' + (bytes < 1048576 ? Math.ceil(bytes / 1024) + ' KB' : (bytes / 1048576).toFixed(1) + ' MB'));
}

if (ACCEPT) {
  const block = acceptedBlock(page, template);
  fs.writeFileSync(out.replace(/\.html$/, '') + '.decisions.txt', block + '\n');
  console.log(block);
}
if (flags.has('--serve')) {
  const base = out.replace(/\.html$/, '');
  serve(html, base + '.decisions.txt', base + '.share.txt', { open: !flags.has('--no-open'), files: files.length ? { root: repo.root, list: files } : null });
}

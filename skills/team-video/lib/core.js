'use strict';
// The pure core of team-video: the slides-file contract (validate), the pace (schedule), the chapters,
// the personal-data record, staleness, the ffmpeg probe, the mux argv and each slide's HTML.
// No export reads or writes a file, runs a command or prints: video.js does the I/O and passes the results in.
// The slides-file field names and the record's line format are one-way: fields are added, never renamed.
const crypto = require('node:crypto');

// ---------- slides file ----------

const TOP = ['version', 'topic', 'commit', 'brand', 'music', 'slides'];
const BRAND = ['name', 'logo', 'colors', 'lang'];
const COLORS = ['primary', 'secondary', 'surface'];
const MUSIC = ['file', 'title', 'author', 'licence', 'url'];
const KINDS = {
  title: ['kind', 'chapter', 'title', 'text'],
  text: ['kind', 'chapter', 'title', 'bullets'],
  image: ['kind', 'chapter', 'title', 'case', 'text', 'images'],
  screen: ['kind', 'chapter', 'title', 'case', 'text', 'frames', 'cursor'],
};
const SHOT = ['shot', 'hl'];
const CURSOR = ['frame', 'to', 'click'];
const SHA = /^[0-9a-f]{7,40}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const LICENCE = /^(CC0( 1\.0)?|CC BY( \d+(\.\d+)?)?)$/;
const SHOT_NAME = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;
const RESHOOT = 're-run the shoot or change the slide';

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const filled = v => typeof v === 'string' && v.trim() !== '';
const show = v => (v === undefined ? 'missing' : JSON.stringify(v));
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// The path of a shot's file, relative to the video folder: what `exists` is asked about and the record's key.
const shotPath = name => `shots/${name}.png`;

function unknownFields(obj, allowed, at, errors) {
  Object.keys(obj).filter(k => !allowed.includes(k))
    .forEach(k => errors.push(`${at}unknown field "${k}"; remove it (fields: ${allowed.join(', ')})`));
}

// Checks one { shot, hl? } entry: the shot in the manifest and on disk, its mark key in that shot's boxes.
function checkShot(entry, at, n, manifest, exists, errors) {
  if (!isObj(entry)) { errors.push(`slide ${n}: ${at} must be { "shot", "hl"? }; name a shot from shots/manifest.json`); return; }
  unknownFields(entry, SHOT, `slide ${n}: ${at}: `, errors);
  if (!filled(entry.shot)) { errors.push(`slide ${n}: ${at}.shot is ${show(entry.shot)}; name a shot from shots/manifest.json`); return; }
  if (!SHOT_NAME.test(entry.shot)) { errors.push(`slide ${n}: shot "${entry.shot}" must be a file name (letters, digits, ".", "_", "-"); rename it in the shoot`); return; }
  const shot = shotEntry(manifest, entry.shot, n, exists, errors);
  if (has(entry, 'hl')) {
    if (!filled(entry.hl)) errors.push(`slide ${n}: ${at}.hl must be a mark key string from shots/manifest.json, never a position; use a key of shot ${entry.shot}'s boxes`);
    else if (shot) checkMark(shot, entry.shot, entry.hl, `mark ${entry.hl}`, n, errors);
  }
}

function shotEntry(manifest, name, n, exists, errors) {
  const entry = isObj(manifest) && has(manifest, name) ? manifest[name] : null;
  if (!entry) errors.push(`slide ${n}: shot ${name} is not in shots/manifest.json; ${RESHOOT}`);
  if (!exists(shotPath(name))) errors.push(`slide ${n}: shot ${name}: ${shotPath(name)} is missing; ${RESHOOT}`);
  return entry;
}

function checkMark(entry, name, key, what, n, errors) {
  const box = isObj(entry.boxes) && has(entry.boxes, key) ? entry.boxes[key] : undefined;
  if (box === undefined) { errors.push(`slide ${n}: ${what} is not in the boxes of shot ${name}; ${RESHOOT}`); return; }
  if (!Array.isArray(box) || box.length !== 4 || !box.every(Number.isFinite)) {
    errors.push(`slide ${n}: ${what} of shot ${name} is not [x0, y0, x1, y1] in shots/manifest.json; ${RESHOOT}`);
  }
}

function checkSlide(slide, n, manifest, exists, errors) {
  if (!isObj(slide)) { errors.push(`slide ${n}: not an object; write it as one of the kinds title, text, image or screen`); return; }
  if (!has(KINDS, slide.kind)) { errors.push(`slide ${n}: unknown kind ${show(slide.kind)}; use title, text, image or screen`); return; }
  unknownFields(slide, KINDS[slide.kind], `slide ${n}: `, errors);
  if (!filled(slide.chapter)) errors.push(`slide ${n}: chapter is empty; give the case's group, or the heading the acceptance page shows for ungrouped cases`);
  if (!filled(slide.title)) errors.push(`slide ${n}: title is empty; write the slide's claim as a sentence`);
  if (slide.kind === 'title' && has(slide, 'text') && typeof slide.text !== 'string') errors.push(`slide ${n}: text must be a string; write it as one line or remove it`);
  if (slide.kind === 'text') {
    const b = slide.bullets;
    if (!Array.isArray(b) || b.length < 1 || b.length > 6) errors.push(`slide ${n}: bullets needs 1 to 6 lines (the band holds six two-line bullets); split the slide or shorten it`);
    else if (!b.every(filled)) errors.push(`slide ${n}: bullets must be non-empty strings; remove the empty one`);
  }
  if (slide.kind === 'image' || slide.kind === 'screen') {
    if (has(slide, 'case') && typeof slide.case !== 'string') errors.push(`slide ${n}: case must be a string; give the acceptance case's title`);
    if (!filled(slide.text)) errors.push(`slide ${n}: text is empty; write the caption from the case's steps or expected result`);
  }
  if (slide.kind === 'image') {
    const im = slide.images;
    if (!Array.isArray(im) || im.length < 1 || im.length > 2) errors.push(`slide ${n}: images needs 1 or 2 shots; split the slide or use a screen slide`);
    else im.forEach((e, k) => checkShot(e, `images[${k}]`, n, manifest, exists, errors));
  }
  if (slide.kind === 'screen') {
    const fr = slide.frames;
    if (!Array.isArray(fr) || fr.length < 2) { errors.push(`slide ${n}: frames needs at least 2 shots; use an image slide for one`); return; }
    fr.forEach((e, k) => checkShot(e, `frames[${k}]`, n, manifest, exists, errors));
    if (has(slide, 'cursor')) checkCursor(slide.cursor, fr, n, manifest, errors);
  }
}

function checkCursor(c, frames, n, manifest, errors) {
  if (!isObj(c)) { errors.push(`slide ${n}: cursor must be { "frame", "to", "click"? }; fix it or remove it`); return; }
  unknownFields(c, CURSOR, `slide ${n}: cursor: `, errors);
  if (has(c, 'click') && typeof c.click !== 'boolean') errors.push(`slide ${n}: cursor.click must be true or false`);
  if (!Number.isInteger(c.frame) || c.frame < 0 || c.frame >= frames.length) {
    errors.push(`slide ${n}: cursor.frame must be the 0-based index of one of its frames (0 to ${frames.length - 1}); fix it`);
    return;
  }
  if (!filled(c.to)) { errors.push(`slide ${n}: cursor.to must be a mark key string from shots/manifest.json, never a position`); return; }
  const name = isObj(frames[c.frame]) ? frames[c.frame].shot : undefined;
  const entry = filled(name) && isObj(manifest) && has(manifest, name) ? manifest[name] : null;
  if (entry) checkMark(entry, name, c.to, `cursor.to ${c.to}`, n, errors);
}

// validate(doc, manifest, exists) → error strings, each naming the slide (1-based) or the field, and the fix.
// manifest: shots/manifest.json parsed (or null); exists(relPath): whether shots/<name>.png is on disk.
function validate(doc, manifest, exists) {
  const errors = [];
  if (!isObj(doc)) return ['the slides file is not a JSON object; write it as § Slides file says'];
  unknownFields(doc, TOP, '', errors);
  if (doc.version !== 1) errors.push(`version: ${show(doc.version)}; set "version": 1`);
  if (!filled(doc.topic)) errors.push(`topic: ${show(doc.topic)}; set it to the acceptance topic`);
  if (typeof doc.commit !== 'string' || !SHA.test(doc.commit)) errors.push(`commit: ${show(doc.commit)} is not 7 to 40 hex digits; copy the acceptance JSON's commit`);
  const b = doc.brand;
  if (!isObj(b)) errors.push(`brand: ${show(b)}; write { "name", "logo", "colors", "lang" } from the profile's Brand line`);
  else {
    unknownFields(b, BRAND, 'brand: ', errors);
    if (!filled(b.name)) errors.push(`brand.name: ${show(b.name)}; copy the Brand line's name`);
    if (b.logo !== null && !filled(b.logo)) errors.push(`brand.logo: ${show(b.logo)}; null for none, else the logo's path`);
    const c = b.colors;
    if (isObj(c)) {
      unknownFields(c, COLORS, 'brand.colors: ', errors);
      COLORS.filter(k => k === 'primary' || has(c, k)).filter(k => !(typeof c[k] === 'string' && HEX.test(c[k])))
        .forEach(k => errors.push(`brand.colors.${k}: ${show(c[k])}; use "#rrggbb"${k === 'primary' ? '' : ', or leave it out'}`));
    } else if (c !== 'neutral') errors.push(`brand.colors: ${show(c)}; use "neutral" or { "primary": "#rrggbb", "secondary"?, "surface"? } from the Brand line`);
    if (!filled(b.lang)) errors.push(`brand.lang: ${show(b.lang)}; copy the Brand line's language, else the acceptance page's`);
  }
  if (!has(doc, 'music')) errors.push('music: missing; set null for no music, or { "file", "title", "author", "licence", "url" }');
  else if (doc.music !== null) {
    const m = doc.music;
    if (!isObj(m)) errors.push(`music: ${show(m)}; set null for no music, or { "file", "title", "author", "licence", "url" }`);
    else {
      unknownFields(m, MUSIC, 'music: ', errors);
      MUSIC.filter(k => !filled(m[k])).forEach(k => errors.push(`music.${k}: ${show(m[k])}; copy it from the track's page`));
      if (filled(m.licence) && !LICENCE.test(m.licence)) errors.push(`music.licence: ${m.licence} is not CC0 or CC BY (with an optional version only); choose a CC0 or CC BY track, or set music to null`);
    }
  }
  if (!Array.isArray(doc.slides) || doc.slides.length < 2) errors.push('slides: needs at least 2 slides; add a title slide and one slide per case');
  if (Array.isArray(doc.slides)) doc.slides.forEach((s, i) => checkSlide(s, i + 1, manifest, exists || (() => false), errors));
  return [...new Set(errors)];
}

// ---------- pace ----------

const round1 = x => Math.round(x * 10) / 10;
const round3 = x => Math.round(x * 1000) / 1000;
const words = s => (typeof s === 'string' ? s.split(/\s+/).filter(Boolean).length : 0);
const READABLE = [3, 11];

// Reading time: 1.5 + 0.25 × words + 1.0 × (frames − 1) + (two images ? 0.5 : 0) s, rounded to 0.1 s, so never under
// 0.22 s a word. Fitted on a first real video against a hand-made one of the same feature (116 s); the 3-11 s range
// warns on a 40-word caption, not on a 12-word one. Never clamped, never scaled.
function readingTime(slide) {
  const w = words(slide.title) + words(slide.text) + (Array.isArray(slide.bullets) ? slide.bullets.reduce((t, b) => t + words(b), 0) : 0);
  const frames = Array.isArray(slide.frames) ? slide.frames.length : 1;
  const two = Array.isArray(slide.images) && slide.images.length === 2 ? 1 : 0;
  return round1(1.5 + 0.25 * w + 1.0 * Math.max(frames - 1, 0) + 0.5 * two);
}

// schedule(slides, { fade }) → { durations, offsets, total, warnings, fade }. Each slide's segment lasts its duration;
// consecutive segments overlap by `fade`: offsets[i] = Σ d<i − i × fade, total = Σ d − (n − 1) × fade.
function schedule(slides, { fade = 0.5 } = {}) {
  const durations = slides.map(readingTime);
  const offsets = [];
  let sum = 0;
  durations.forEach((d, i) => { offsets.push(round3(sum - i * fade)); sum += d; });
  const total = durations.length ? round3(sum - (durations.length - 1) * fade) : 0;
  const warnings = [];
  durations.forEach((d, i) => {
    if (d >= READABLE[0] && d <= READABLE[1]) return;
    const fix = d > READABLE[1] ? 'split the case or shorten the caption' : 'it may pass too fast: add a line or merge it';
    warnings.push(`slide ${i + 1}: ${d} s of reading time is outside the readable range ${READABLE[0]}-${READABLE[1]} s (an estimate, not a limit); ${fix}`);
  });
  return { durations, offsets, total, warnings, fade };
}

// ---------- chapters ----------

const metaEsc = s => String(s).replace(/[=;#\\\n]/g, c => '\\' + c);
const ms = s => Math.round(s * 1000);

// chapters(slides, sched, { title, artist, comment }) → FFMETADATA text. Consecutive slides of one chapter make
// one chapter; it starts at its first slide's offset + fade/2 (the middle of the cross-fade), the first at 0.
function chapters(slides, sched, meta = {}) {
  const fade = sched.fade != null ? sched.fade : 0.5;
  const runs = [];
  slides.forEach((s, i) => {
    if (i > 0 && s.chapter === slides[i - 1].chapter) return;
    runs.push({ title: s.chapter, start: i === 0 ? 0 : sched.offsets[i] + fade / 2 });
  });
  const lines = [';FFMETADATA1'];
  ['title', 'artist', 'comment'].forEach(k => { if (meta[k] != null && meta[k] !== '') lines.push(`${k}=${metaEsc(meta[k])}`); });
  runs.forEach((r, k) => {
    const end = k + 1 < runs.length ? runs[k + 1].start : sched.total;
    lines.push('', '[CHAPTER]', 'TIMEBASE=1/1000', `START=${ms(r.start)}`, `END=${ms(end)}`, `title=${metaEsc(r.title)}`);
  });
  return lines.join('\n') + '\n';
}

// ---------- personal-data record ----------

const LOOKED_FOR = 'Looked for: names, e-mail addresses, phone numbers, postal addresses, bank or card numbers, identity numbers, faces, free-text notes';
const SEP = ' — ';

// The first 16 hex digits of the sha256 of a file's bytes (read by the caller) or of a string.
const hash16 = data => crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);

// A slide's text as the record hashes it: chapter, case, title, text, then each bullet, one per line;
// a missing field is an empty line (no bullets: one empty line).
function slideText(slide) {
  const line = v => (v == null ? '' : String(v));
  const bullets = Array.isArray(slide.bullets) && slide.bullets.length ? slide.bullets.map(line) : [''];
  return [slide.chapter, slide.case, slide.title, slide.text].map(line).concat(bullets).join('\n');
}

const shotsOf = slide => [].concat(Array.isArray(slide.images) ? slide.images : [], Array.isArray(slide.frames) ? slide.frames : [])
  .filter(e => isObj(e) && filled(e.shot)).map(e => shotPath(e.shot));

// The shot files the render reads, each once, in order of first use.
function usedShots(slides) {
  return [...new Set(slides.flatMap(shotsOf))];
}

// The record's items in order: per slide, its frames not yet listed, then `slide<n> text`.
// shotHashes: { 'shots/<name>.png': hash16(bytes) } for every used shot (read by the caller).
function recordItems(slides, shotHashes) {
  const seen = new Set(), items = [];
  slides.forEach((s, i) => {
    shotsOf(s).forEach(p => {
      if (seen.has(p)) return;
      seen.add(p);
      if (!shotHashes || !filled(shotHashes[p])) throw new Error(`no hash for ${p}`);
      items.push({ key: p, hash: shotHashes[p] });
    });
    items.push({ key: `slide${i + 1} text`, hash: hash16(slideText(s)) });
  });
  return items;
}

// `- <key> — <hash> — <verdict>[ — <seat>, <date>]` → { key, hash, verdict } (verdict: the third field).
// Trailing whitespace on the line is ignored.
function parseLine(raw) {
  const line = raw.replace(/\s+$/, '');
  if (!line.startsWith('- ')) return null;
  const parts = line.slice(2).split(SEP);
  if (parts.length < 3) return null;
  return { key: parts[0], hash: parts[1], verdict: parts[2] };
}
// Verdicts are exact: clear; blurred: <what>; kept: <what> (the human), each <what> non-empty.
const isChecked = verdict => verdict === 'clear' || /^blurred: .*\S/.test(verdict) || /^kept: .*\S.* \(the human\)$/.test(verdict);
const uncheckedLine = it => `- ${it.key}${SEP}${it.hash}${SEP}unchecked`;

// recordStatus(text, items, { topic }) → { unchecked, text }. An item is checked when its line carries its current hash
// and a verdict of clear, blurred: or kept:. A line with an old hash is rewritten unchecked; an item with no line is
// appended unchecked; when an item has several lines, the last one stands and the earlier ones are dropped.
// Lines of items no longer used (a removed frame) and any other line are kept as they are.
function recordStatus(text, items, { topic } = {}) {
  const lines = String(text || '').split(/\r?\n/);
  if (lines[lines.length - 1] === '') lines.pop();
  if (!lines.some(l => l.startsWith('# Personal data'))) lines.unshift(`# Personal data — ${topic || ''}`.trimEnd(), LOOKED_FOR);
  const byKey = new Map(items.map(it => [it.key, it]));
  const lastLine = new Map();
  lines.forEach((l, idx) => { const p = parseLine(l); if (p && byKey.has(p.key)) lastLine.set(p.key, idx); });
  const checked = new Map(), out = [];
  lines.forEach((l, idx) => {
    const p = parseLine(l);
    if (!p || !byKey.has(p.key)) { out.push(l); return; }
    if (lastLine.get(p.key) !== idx) return;
    const it = byKey.get(p.key);
    if (p.hash !== it.hash) { out.push(uncheckedLine(it)); checked.set(it.key, false); return; }
    out.push(l);
    checked.set(it.key, isChecked(p.verdict));
  });
  items.forEach(it => { if (!checked.has(it.key)) { out.push(uncheckedLine(it)); checked.set(it.key, false); } });
  return { unchecked: items.filter(it => !checked.get(it.key)).map(it => it.key), text: out.join('\n') + '\n' };
}

// ---------- staleness ----------

const RERUN = ' a re-shoot is needed. Say "re-run" to start one.';
const isSha = v => typeof v === 'string' && SHA.test(v);
const samePrefix = (a, b) => a.startsWith(b) || b.startsWith(a);

// staleness({ stamp, acceptanceCommit, codeChanged }) → `stale:` lines, none only when the video matches.
// stamp: the slides file's commit; codeChanged: true, false, or null when git does not know the stamp.
// Fails closed: a missing or malformed stamp is "not in this repository"; a missing or malformed acceptance commit is "unknown";
// only a strict false codeChanged is "unchanged", any value but false or null is "the code changed".
function staleness({ stamp, acceptanceCommit, codeChanged } = {}) {
  if (!isSha(stamp)) return [`stale: ${stamp == null || stamp === '' ? 'none' : stamp} is not in this repository (rebased or squashed?);${RERUN}`];
  const out = [];
  if (!isSha(acceptanceCommit)) out.push(`stale: the video was shot at ${stamp} and the acceptance page is at unknown;${RERUN}`);
  else if (!samePrefix(stamp, acceptanceCommit)) out.push(`stale: the video was shot at ${stamp} and the acceptance page is at ${acceptanceCommit};${RERUN}`);
  if (codeChanged === null) out.push(`stale: ${stamp} is not in this repository (rebased or squashed?);${RERUN}`);
  else if (codeChanged !== false) out.push(`stale: the code changed since the video was shot at ${stamp};${RERUN}`);
  return out;
}

// ---------- ffmpeg probe ----------

// The names in the name column (the second field) of `ffmpeg -encoders` or `-filters` output.
function listedNames(output) {
  const names = new Set();
  String(output || '').split(/\r?\n/).forEach(l => { const m = /^\s*\S+\s+(\S+)/.exec(l); if (m) names.add(m[1]); });
  return names;
}

// probeMissing(encoders, filters, { music }) → the names missing: libx264, xfade, acrossfade, and loudnorm, aac with music.
function probeMissing(encoders, filters, { music = false } = {}) {
  const enc = listedNames(encoders), fil = listedNames(filters);
  const want = [['libx264', enc], ['xfade', fil], ['acrossfade', fil]];
  if (music) want.push(['loudnorm', fil], ['aac', enc]);
  return want.filter(([name, set]) => !set.has(name)).map(([name]) => name);
}

// installHint(missing) → the stop text; with no name (no ffmpeg at all) the install lines only.
function installHint(missing = []) {
  const lines = missing.length ? [`ffmpeg lacks: ${missing.join(', ')}`] : [];
  lines.push(
    "Linux: your distribution's ffmpeg package (Debian, Ubuntu: sudo apt install ffmpeg; Fedora: from RPM Fusion, its ffmpeg-free lacks libx264)",
    'macOS: brew install ffmpeg',
    'Windows: unverified',
    'Install it, then run team-video again.');
  return lines.join('\n');
}

// ---------- mux ----------

const num = x => String(round3(x));

// muxArgs({ segments, sched, slides, music, chapters, out, fade }) → the ffmpeg argv (without "ffmpeg").
// segments: one video file per slide; music: the track's path or null; chapters: the FFMETADATA file or null.
// Within a chapter the cross-fade is `fade`, across chapters `smoothleft`. A track shorter than the video loops
// (-stream_loop -1) and fades out over the last 2 s; with no music there is no audio input, filter or codec.
function muxArgs({ segments, sched, slides, music = null, chapters: meta = null, out, fade }) {
  const f = fade != null ? fade : (sched.fade != null ? sched.fade : 0.5);
  const args = ['-y', '-hide_banner', '-loglevel', 'error'];
  segments.forEach(s => args.push('-i', s));
  let next = segments.length;
  const audio = music ? next++ : -1;
  if (music) args.push('-stream_loop', '-1', '-i', music);
  const metaIn = meta ? next++ : -1;
  if (meta) args.push('-i', meta);
  const graph = [];
  if (segments.length === 1) graph.push('[0:v]null[v]');
  let prev = '[0:v]';
  for (let i = 1; i < segments.length; i++) {
    const transition = slides[i].chapter === slides[i - 1].chapter ? 'fade' : 'smoothleft';
    const label = i === segments.length - 1 ? '[v]' : `[x${i}]`;
    graph.push(`${prev}[${i}:v]xfade=transition=${transition}:duration=${num(f)}:offset=${num(sched.offsets[i])}${label}`);
    prev = label;
  }
  if (music) graph.push(`[${audio}:a]loudnorm=I=-20:TP=-2,aresample=48000,afade=t=in:d=0.3,afade=t=out:st=${num(Math.max(sched.total - 2, 0))}:d=2[a]`);
  args.push('-filter_complex', graph.join(';'), '-map', '[v]');
  if (music) args.push('-map', '[a]');
  if (meta) args.push('-map_metadata', String(metaIn), '-map_chapters', String(metaIn));
  if (music) args.push('-c:a', 'aac', '-b:a', '192k');
  args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-t', num(sched.total), out);
  return args;
}

// ---------- slide HTML ----------

const NEUTRAL = '#4a5568';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = v => `${Math.round(v * 100000) / 1000}%`;
const sec = v => `${round3(v)}s`;
const RING_DELAY = 1.2, CURSOR_MOVE = 1.0, CLICK_BEFORE = 0.2;

// ---------- brand colours (WCAG 2 relative luminance and contrast) ----------

const rgb = hex => [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16));
const hexOf = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
// mix(a, b, t): t of colour b into colour a.
const mix = (a, b, t) => { const y = rgb(b); return hexOf(rgb(a).map((v, k) => v * (1 - t) + y[k] * t)); };
function luminance(hex) {
  const [r, g, b] = rgb(hex).map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
// contrast(a, b) → the WCAG ratio, 1 to 21.
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const ON_DARK = '#fafafa', ON_LIGHT = '#111111', BAR_MIN = 4.5;
// barColors(primary) → { text, muted } for the top bar: near-white on a dark primary, near-black on a light one, pure
// white or black where the near one falls under 4.5:1 (a mid-grey primary); muted is text with some primary mixed in,
// as much as keeps 4.5:1.
function barColors(accent) {
  let text = contrast(ON_DARK, accent) >= contrast(ON_LIGHT, accent) ? ON_DARK : ON_LIGHT;
  if (contrast(text, accent) < BAR_MIN) text = contrast('#ffffff', accent) >= contrast('#000000', accent) ? '#ffffff' : '#000000';
  const muted = [0.3, 0.25, 0.2, 0.15, 0.1, 0.05].map(t => mix(text, accent, t)).find(m => contrast(m, accent) >= BAR_MIN) || text;
  return { text, muted };
}
// pageTint(colour) → the default page background: 8 % of the colour into white.
const pageTint = colour => mix('#ffffff', colour, 0.08);
const DETAIL_MIN = 3;
// brandColors(colors) → { primary, secondary, surface } from the brand's colour set, lower-cased: a missing secondary
// takes the primary, a missing surface the primary's page tint; "neutral" (or no valid primary) → the neutral set.
function brandColors(colors) {
  const ok = v => typeof v === 'string' && HEX.test(v);
  const primary = isObj(colors) && ok(colors.primary) ? colors.primary.toLowerCase() : NEUTRAL;
  const own = k => (isObj(colors) && ok(colors.primary) && ok(colors[k]) ? colors[k].toLowerCase() : null);
  return { primary, secondary: own('secondary') || primary, surface: own('surface') || pageTint(primary) };
}
// detailColor(secondary, primary, background) → the secondary where it keeps 3:1 on the background, else the primary.
const detailColor = (secondary, primary, background) => (contrast(secondary, background) >= DETAIL_MIN ? secondary : primary);

const CSS = `
:root { --ink: #1c1c1a; --muted: #5c5c58; --primary: ${NEUTRAL}; --detail: ${NEUTRAL}; --on: ${ON_DARK}; --on-muted: ${ON_DARK}; --rule: ${ON_DARK}; --page: #fff; --sans: ${SANS}; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1920px; height: 1080px; overflow: hidden; background: var(--page); color: var(--ink); font-family: var(--sans); }
.page { width: 1920px; height: 1080px; display: grid; grid-template-rows: 120px auto minmax(0, 1fr) auto; padding-inline: 120px; }
.bar { height: 120px; margin-inline: -120px; padding-inline: 120px; position: relative; background: var(--primary); color: var(--on); display: flex; align-items: center; gap: 40px; min-width: 0; }
.logo { height: 56px; width: auto; max-width: 480px; object-fit: contain; flex: none; }
.brand { font-size: 36px; font-weight: 700; flex: none; }
.chapter { font-size: 32px; line-height: 1.2; font-weight: 500; min-width: 0; padding-left: 40px; border-left: 2px solid var(--rule); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.repo { margin-left: auto; font-size: 28px; color: var(--on-muted); flex: none; white-space: nowrap; }
.title { padding-top: 36px; }
.title:empty { padding-top: 0; }
h1 { font-size: 56px; line-height: 1.15; font-weight: 700; }
main { min-height: 0; padding-block: 24px; }
.center { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; gap: 32px; }
.big { font-size: 96px; line-height: 1.1; font-weight: 700; }
.big::after { content: ""; display: block; width: 160px; height: 10px; margin: 40px auto 0; border-radius: 5px; background: var(--detail); }
.sub { font-size: 44px; line-height: 1.25; color: var(--muted); }
.bullets { font-size: 48px; line-height: 1.25; display: grid; gap: 24px; align-content: center; height: 100%; padding-left: 1.2em; }
.bullets li::marker { color: var(--detail); }
.shots { display: grid; gap: 24px; height: 100%; }
.cell { position: relative; container-type: size; min-height: 0; min-width: 0; padding: 20px; display: flex; align-items: center; justify-content: center; }
.frame { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0; animation-name: on; animation-timing-function: linear; }
.shot { position: relative; }
.shot img { display: block; width: 100%; height: 100%; object-fit: contain; background: #fff; border-radius: 6px; box-shadow: 0 0 0 12px #fff, 0 14px 36px 12px rgba(17, 24, 39, 0.14); }
.ring { position: absolute; box-sizing: content-box; margin: -12px; padding: 6px; border: 6px solid #1c1c1a; border-radius: 14px; box-shadow: 0 0 0 3px #fff, inset 0 0 0 3px #fff; animation: ring 0.3s ease-out both; }
.cursor { position: absolute; z-index: 2; width: 48px; height: 48px; animation: move ${CURSOR_MOVE}s ease-in-out both; }
.cursor svg { display: block; margin: -4px 0 0 -6px; }
.click { position: absolute; z-index: 1; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%; border: 6px solid #1c1c1a; box-shadow: 0 0 0 3px #fff, inset 0 0 0 3px #fff; opacity: 0; animation: click 0.5s ease-out forwards; }
footer { min-height: 150px; display: grid; grid-template-rows: 1fr 40px; }
.caption { font-size: 40px; line-height: 1.25; align-self: center; }
.credit { height: 40px; font-size: 28px; line-height: 40px; color: var(--muted); display: flex; justify-content: space-between; gap: 32px; }
@keyframes on { from, to { opacity: 1; } }
@keyframes ring { from { opacity: 0; transform: scale(1.15); } to { opacity: 1; transform: none; } }
@keyframes move { from { left: 50%; top: 50%; } to { left: var(--tx); top: var(--ty); } }
@keyframes click { from { opacity: 1; transform: scale(0.4); } to { opacity: 0; transform: scale(1.2); } }
`;

const CURSOR_SVG = '<svg viewBox="0 0 24 24" width="48" height="48" aria-hidden="true"><path d="M3 2l15 10-6.5 1.2L15 21l-3 1.3-3.5-7.7L3 19z" fill="#fff" stroke="#1c1c1a" stroke-width="1.6" stroke-linejoin="round"/></svg>';

const centre = box => [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
const boxOf = (ctx, name, key) => {
  const e = ctx.manifest && ctx.manifest[name];
  return e && e.boxes && Array.isArray(e.boxes[key]) ? e.boxes[key] : null;
};

// One shot fitted inside its cell at its own ratio, so a mark's box in % of the shot is in % of the box drawn.
// `appear`: when the shot shows, in s from the slide's start; `cursor`: { to, click, from, until } in this shot.
function shotHtml(ctx, entry, appear, cursor) {
  const e = ctx.manifest && ctx.manifest[entry.shot];
  const ratio = e && e.w > 0 && e.h > 0 ? e.w / e.h : 1.6;
  const src = `${ctx.shotBase != null ? ctx.shotBase : '../shots/'}${entry.shot}.png`;
  let marks = '';
  const box = entry.hl ? boxOf(ctx, entry.shot, entry.hl) : null;
  if (box) marks += `<span class="ring" style="left: ${pct(box[0])}; top: ${pct(box[1])}; width: ${pct(box[2] - box[0])}; height: ${pct(box[3] - box[1])}; animation-delay: ${sec(appear + RING_DELAY)}"></span>`;
  const to = cursor ? boxOf(ctx, entry.shot, cursor.to) : null;
  if (to) {
    const [x, y] = centre(to);
    const start = Math.max(cursor.from, cursor.until - CURSOR_MOVE);
    marks += `<span class="cursor" style="--tx: ${pct(x)}; --ty: ${pct(y)}; animation-duration: ${sec(cursor.until - start)}; animation-delay: ${sec(start)}">${CURSOR_SVG}</span>`;
    if (cursor.click) marks += `<span class="click" style="left: ${pct(x)}; top: ${pct(y)}; animation-delay: ${sec(Math.max(cursor.until - CLICK_BEFORE, cursor.from))}"></span>`;
  }
  return `<div class="shot" style="aspect-ratio: ${round3(ratio)}; width: min(100cqw, ${round3(100 * ratio)}cqh)"><img src="${esc(src)}" alt="">${marks}</div>`;
}

function mainHtml(slide, ctx) {
  if (slide.kind === 'title') {
    return `<main class="center"><p class="big">${esc(slide.title)}</p>${filled(slide.text) ? `<p class="sub">${esc(slide.text)}</p>` : ''}</main>`;
  }
  if (slide.kind === 'text') {
    return `<main><ul class="bullets">${(slide.bullets || []).map(b => `<li>${esc(b)}</li>`).join('')}</ul></main>`;
  }
  if (slide.kind === 'image') {
    const im = slide.images || [];
    return `<main class="shots" style="grid-template-columns: repeat(${im.length || 1}, minmax(0, 1fr))">`
      + im.map(e => `<div class="cell">${shotHtml(ctx, e, 0, null)}</div>`).join('') + '</main>';
  }
  const fr = slide.frames || [];
  const d = ctx.duration || 0, n = fr.length || 1;
  const c = slide.cursor;
  const frames = fr.map((e, k) => {
    const from = k * d / n, until = (k + 1) * d / n;
    const fill = k === n - 1 ? 'forwards' : 'none';
    const cursor = c && c.frame === k ? { to: c.to, click: c.click === true, from, until } : null;
    return `<div class="frame" style="animation-delay: ${sec(from)}; animation-duration: ${sec(until - from)}; animation-fill-mode: ${fill}">${shotHtml(ctx, e, from, cursor)}</div>`;
  }).join('');
  return `<main class="shots"><div class="cell">${frames}</div></main>`;
}

// slideHtml(slide, i, ctx) → the frame's HTML: a fixed 1920×1080 page on the brand's surface, under a 120 px bar filled
// with its primary; the title rule and bullet markers take its secondary (detailColor); i is the 0-based slide index.
// ctx = { brand, logoDataUri, repo (null: none shown), commit, music, total (slides), duration (this slide, s), manifest,
// shotBase? ('../shots/') }.
function slideHtml(slide, i, ctx) {
  const brand = ctx.brand || {};
  const fr = /^fr/i.test(brand.lang || '');
  const { primary, secondary, surface } = brandColors(brand.colors);
  const eyebrow = (slide.kind === 'image' || slide.kind === 'screen') && filled(slide.case)
    ? `${esc(slide.chapter)} · ${esc(slide.case)}` : esc(slide.chapter);
  const lead = ctx.logoDataUri ? `<img class="logo" src="${esc(ctx.logoDataUri)}" alt="">` : `<p class="brand">${esc(brand.name)}</p>`;
  const repo = filled(ctx.repo) ? `<p class="repo">${esc(ctx.repo)}</p>` : '';
  const bar = `<header class="bar">${lead}<p class="chapter">${eyebrow}</p>${repo}</header>`;
  const title = slide.kind === 'title' ? '<div class="title"></div>' : `<div class="title"><h1>${esc(slide.title)}</h1></div>`;
  const on = barColors(primary);
  // On the bar the secondary draws a 6 px stripe along its bottom edge and the divider, where it keeps 3:1 on the primary (no stripe otherwise; the divider keeps the muted text colour).
  const onBar = contrast(secondary, primary) >= DETAIL_MIN;
  const stripe = onBar ? ' .bar::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 6px; background: var(--secondary); }' : '';
  const caption = slide.kind === 'image' || slide.kind === 'screen' ? `<p class="caption">${esc(slide.text)}</p>` : '<span></span>';
  const last = i === ctx.total - 1;
  const m = ctx.music;
  const credit = last
    ? `<span>${m ? `${fr ? 'Musique : ' : 'Music: '}${esc(m.title)} — ${esc(m.author)} (${esc(m.licence)})` : ''}</span><span class="sha">${esc(String(ctx.commit || '').slice(0, 7))}</span>`
    : '';
  return `<!doctype html>
<html lang="${esc(brand.lang)}">
<head>
<meta charset="utf-8">
<title>${esc(slide.title)}</title>
<style>${CSS}:root { --primary: ${primary}; --detail: ${detailColor(secondary, primary, surface)}; --on: ${on.text}; --on-muted: ${on.muted}; --rule: ${onBar ? secondary : on.muted}; --secondary: ${secondary}; --page: ${surface}; }${stripe}
</style>
</head>
<body>
<div class="page">
${bar}
${title}
${mainHtml(slide, ctx)}
<footer>${caption}<div class="credit">${credit}</div></footer>
</div>
</body>
</html>
`;
}

module.exports = {
  validate, schedule, chapters, recordStatus, recordItems, usedShots, slideText, hash16, shotPath,
  staleness, probeMissing, installHint, muxArgs, slideHtml, contrast, barColors, pageTint, brandColors, detailColor, LOOKED_FOR,
};

'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const CORE = path.join(__dirname, '..', '..', 'skills', 'team-video', 'lib', 'core.js');
const core = require(CORE);
const { validate, schedule, chapters, recordStatus, recordItems, usedShots, slideText, hash16, staleness, probeMissing, installHint, muxArgs, slideHtml, contrast, barColors, pageTint, brandColors, detailColor } = core;

// Invoice fixtures: a list shot with its export button, the export screen with its download link.
const manifest = () => ({
  'invoice-list': { w: 6400, h: 4000, boxes: { 'export-button': [0.8, 0.05, 0.9, 0.09], 'first-row': [0.05, 0.2, 0.95, 0.25] } },
  'invoice-export': { w: 6400, h: 4000, boxes: { 'download-link': [0.4, 0.5, 0.6, 0.55] } },
});
const ON_DISK = ['shots/invoice-list.png', 'shots/invoice-export.png'];
const exists = p => ON_DISK.includes(p);
const brand = (over = {}) => ({ name: 'Acme Invoicing', logo: null, colors: 'neutral', lang: 'en', ...over });
const slides = () => [
  { kind: 'title', chapter: 'Invoice export', title: 'Export invoices to CSV', text: 'What the branch changes' },
  { kind: 'image', chapter: 'Invoice export', case: 'Export from the list', title: 'The list has an export button',
    text: 'The invoice list shows an export button.', images: [{ shot: 'invoice-list', hl: 'export-button' }] },
  { kind: 'screen', chapter: 'Download', case: 'Download the file', title: 'The export downloads a CSV',
    text: 'A click on export opens the download.', frames: [{ shot: 'invoice-list' }, { shot: 'invoice-export', hl: 'download-link' }],
    cursor: { frame: 0, to: 'export-button', click: true } },
  { kind: 'text', chapter: 'Download', title: 'What it leaves out', bullets: ['Credit notes are not exported', 'One file per month'] },
];
const doc = (over = {}) => ({ version: 1, topic: 'invoice-export', commit: 'a1b2c3d', brand: brand(), music: null, slides: slides(), ...over });
const MUSIC = { file: 'music/calm.mp3', title: 'Calm Morning', author: 'A. Composer', licence: 'CC BY 4.0', url: 'https://example.org/calm' };
const words = n => Array.from({ length: n }, (_, i) => 'w' + i).join(' ');

test('requiring core.js prints nothing and starts nothing; it imports no I/O module', () => {
  const r = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(CORE)})`], { encoding: 'utf8', timeout: 10000 });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(r.stdout, '');
  assert.strictEqual(r.stderr, '');
  const src = fs.readFileSync(CORE, 'utf8');
  assert.doesNotMatch(src, /require\(['"](node:)?(fs|child_process|http|https|net|os)['"]\)/);
  assert.doesNotMatch(src, /process\.(exit|argv|stdout|stderr)|console\./);
});

test('validate: a well-formed invoice slides file has no error', () => {
  assert.deepStrictEqual(validate(doc(), manifest(), exists), []);
  assert.deepStrictEqual(validate(doc({ music: MUSIC, brand: brand({ colors: { primary: '#1a7f5a' }, logo: 'docs/logo.png', lang: 'fr' }) }), manifest(), exists), []);
});

test('validate: an unknown field and an unknown kind are refused, naming the slide', () => {
  const d = doc();
  d.slides[1].zoom = 2;
  d.slides[3].kind = 'video';
  d.extra = true;
  const errs = validate(d, manifest(), exists);
  assert.ok(errs.some(e => /^slide 2: unknown field "zoom"/.test(e)), errs.join('\n'));
  assert.ok(errs.some(e => /^slide 4: unknown kind "video"; use title, text, image or screen/.test(e)), errs.join('\n'));
  assert.ok(errs.some(e => /^unknown field "extra"/.test(e)), errs.join('\n'));
  const noCamera = doc();
  noCamera.slides[2].camera = { frame: 0, to: 'first-row' };
  assert.ok(validate(noCamera, manifest(), exists).some(e => /^slide 3: unknown field "camera"/.test(e)));
});

test('validate: a mark key missing from a re-shot manifest is named with its shot', () => {
  const m = manifest();
  m['invoice-list'] = { w: 6400, h: 4000, boxes: { 'first-row': [0.05, 0.2, 0.95, 0.25] } }; // the re-shoot replaced the entry
  const errs = validate(doc(), m, exists);
  assert.ok(errs.includes('slide 2: mark export-button is not in the boxes of shot invoice-list; re-run the shoot or change the slide'), errs.join('\n'));
  assert.ok(errs.some(e => /^slide 3: cursor\.to export-button is not in the boxes of shot invoice-list/.test(e)), errs.join('\n'));
});

test('validate: a shot not in the manifest, or not on disk, is named', () => {
  const m = manifest();
  delete m['invoice-export'];
  assert.ok(validate(doc(), m, exists).includes('slide 3: shot invoice-export is not in shots/manifest.json; re-run the shoot or change the slide'));
  const errs = validate(doc(), manifest(), p => p === 'shots/invoice-list.png');
  assert.ok(errs.some(e => /^slide 3: shot invoice-export: shots\/invoice-export\.png is missing/.test(e)), errs.join('\n'));
});

test('validate: an empty chapter is refused, naming the slide (Review Focus 1)', () => {
  const d = doc();
  d.slides[1].chapter = '';
  const errs = validate(d, manifest(), exists);
  assert.ok(errs.some(e => /^slide 2: chapter is empty/.test(e)), errs.join('\n'));
});

test('validate: CC BY-NC 4.0 is refused; CC0 and CC BY with a version pass', () => {
  const errs = validate(doc({ music: { ...MUSIC, licence: 'CC BY-NC 4.0' } }), manifest(), exists);
  assert.ok(errs.some(e => /^music\.licence: CC BY-NC 4\.0 /.test(e)), errs.join('\n'));
  for (const licence of ['CC0', 'CC0 1.0', 'CC BY', 'CC BY 3.0']) assert.deepStrictEqual(validate(doc({ music: { ...MUSIC, licence } }), manifest(), exists), [], licence);
  assert.ok(validate(doc({ music: { ...MUSIC, licence: 'CC BY-SA 4.0' } }), manifest(), exists).length);
});

test('validate: CC0 only as CC0 or CC0 1.0; anything after it is refused with the licence error', () => {
  for (const licence of ['CC0 NC', 'CC0-ND', 'CC0 1.0 SA']) {
    const errs = validate(doc({ music: { ...MUSIC, licence } }), manifest(), exists);
    assert.ok(errs.some(e => e.startsWith(`music.licence: ${licence} is not CC0 or CC BY`)), `${licence}: ${errs.join('\n')}`);
  }
});

test('validate: field types and counts', () => {
  const bad = (mutate, re) => {
    const d = doc(); mutate(d);
    const errs = validate(d, manifest(), exists);
    assert.ok(errs.some(e => re.test(e)), `${re} not in:\n${errs.join('\n')}`);
  };
  bad(d => { d.version = 2; }, /^version: /);
  bad(d => { d.commit = 'HEAD'; }, /^commit: /);
  bad(d => { d.brand.colors = 'blue'; }, /^brand\.colors: "blue"; use "neutral" or \{ "primary"/);
  bad(d => { d.brand.accent = '#1a7f5a'; }, /^brand: unknown field "accent"; remove it \(fields: name, logo, colors, lang\)/);
  bad(d => { d.brand.colors = { primary: '#1a7f5a', secondary: 'green' }; }, /^brand\.colors\.secondary: "green"; use "#rrggbb", or leave it out/);
  bad(d => { d.brand.colors = { primary: '1a7f5a' }; }, /^brand\.colors\.primary: "1a7f5a"; use "#rrggbb"$/);
  bad(d => { d.brand.colors = { secondary: '#1a7f5a' }; }, /^brand\.colors\.primary: missing; use "#rrggbb"$/);
  bad(d => { d.brand.colors = { primary: '#1a7f5a', tertiary: '#ffffff' }; }, /^brand\.colors: unknown field "tertiary"/);
  bad(d => { delete d.music; }, /^music: /);
  bad(d => { d.slides = d.slides.slice(0, 1); }, /^slides: /);
  bad(d => { d.slides[3].bullets = Array(7).fill('Line'); }, /^slide 4: bullets /);
  bad(d => { d.slides[1].images = []; }, /^slide 2: images /);
  bad(d => { d.slides[2].frames = d.slides[2].frames.slice(0, 1); }, /^slide 3: frames /);
  bad(d => { d.slides[2].cursor.frame = 2; }, /^slide 3: cursor\.frame /);
  bad(d => { d.slides[2].cursor.click = 'yes'; }, /^slide 3: cursor\.click /);
  bad(d => { d.slides[1].images[0].hl = [0.1, 0.1, 0.2, 0.2]; }, /^slide 2: images\[0\]\.hl /);
  bad(d => { d.slides[1].case = 3; }, /^slide 2: case /);
});

test('schedule: a long caption gets more time than a short one; 40 words warn, 12 do not (Review Focus 2)', () => {
  const s = [
    { kind: 'image', chapter: 'Invoices', title: 'Due date', text: words(12), images: [{ shot: 'invoice-list' }] },
    { kind: 'image', chapter: 'Invoices', title: 'Due date', text: words(40), images: [{ shot: 'invoice-list' }] },
  ];
  const r = schedule(s);
  assert.ok(r.durations[1] > r.durations[0]);
  assert.strictEqual(r.durations[0], 5); // 1.5 + 0.25 × 14
  assert.strictEqual(r.durations[1], 12); // 1.5 + 0.25 × 42, never clamped
  assert.deepStrictEqual(r.warnings, ['slide 2: 12 s of reading time is outside the readable range 3-11 s (an estimate, not a limit); split the case or shorten the caption']);
  assert.deepStrictEqual(r.offsets, [0, 4.5]);
  assert.strictEqual(r.total, 16.5);
});

test('schedule: frames, two images and bullets add time; a short slide warns it may pass too fast', () => {
  const r = schedule(slides(), { fade: 0.5 });
  // title 4 + text 4 words; image 6 + 7; screen 5 + 7 and one more frame; text 4 + 5 + 4 words
  assert.deepStrictEqual(r.durations, [3.5, 4.8, 5.5, 4.8]);
  const two = schedule([{ kind: 'image', chapter: 'A', title: 'x', text: 'y', images: [{ shot: 'a' }, { shot: 'b' }] }, { kind: 'title', chapter: 'A', title: 'Hi' }]);
  assert.deepStrictEqual(two.durations, [2.5, 1.8]);
  assert.match(two.warnings[1], /^slide 2: 1\.8 s .* it may pass too fast: add a line or merge it$/);
});

test('schedule: never under 0.22 s a word, so a long slide still gets its reading time', () => {
  const long = schedule([{ kind: 'text', chapter: 'Orders', title: words(4), bullets: [words(30), words(30)] }]);
  assert.ok(long.durations[0] >= 0.22 * 64, String(long.durations[0]));
});

test('chapters: consecutive equal chapters merge; each starts at its offset + fade/2, the first at 0', () => {
  const s = slides();
  const sched = schedule(s);
  const text = chapters(s, sched, { title: 'Invoice export', artist: 'Acme Invoicing', comment: 'a1b2c3d' });
  assert.match(text, /^;FFMETADATA1\ntitle=Invoice export\nartist=Acme Invoicing\ncomment=a1b2c3d\n/);
  const blocks = text.split('[CHAPTER]').slice(1);
  assert.strictEqual(blocks.length, 2);
  assert.match(blocks[0], /START=0\n/);
  assert.match(blocks[0], /title=Invoice export/);
  const start2 = Math.round((sched.offsets[2] + 0.25) * 1000);
  assert.match(blocks[0], new RegExp(`END=${start2}\\n`));
  assert.match(blocks[1], new RegExp(`START=${start2}\\n`));
  assert.match(blocks[1], new RegExp(`END=${Math.round(sched.total * 1000)}\\n`));
  assert.match(blocks[1], /title=Download/);
  assert.match(chapters([{ kind: 'title', chapter: 'Q&A; #1', title: 'x' }, { kind: 'title', chapter: 'b', title: 'y' }], schedule([{ title: 'x' }, { title: 'y' }]), {}), /title=Q&A\\; \\#1/);
});

// The record, as video.js check writes it: one line per used frame and per slide text.
const itemsOf = (s, shotHashes) => recordItems(s, shotHashes);
const H = { 'shots/invoice-list.png': 'aaaaaaaaaaaaaaaa', 'shots/invoice-export.png': 'bbbbbbbbbbbbbbbb' };
const clearRecord = items => ['# Personal data — invoice-export',
  'Looked for: names, e-mail addresses, phone numbers, postal addresses, bank or card numbers, identity numbers, faces, free-text notes',
  ...items.map(it => `- ${it.key} — ${it.hash} — clear — personal data, 2026-11-18`)].join('\n') + '\n';

test('record items: each used frame once, then each slide text; the text hash covers chapter, case, title, text and bullets', () => {
  assert.deepStrictEqual(usedShots(slides()), ['shots/invoice-list.png', 'shots/invoice-export.png']);
  const items = itemsOf(slides(), H);
  assert.deepStrictEqual(items.map(i => i.key), ['slide1 text', 'shots/invoice-list.png', 'slide2 text', 'shots/invoice-export.png', 'slide3 text', 'slide4 text']);
  assert.strictEqual(slideText(slides()[1]), 'Invoice export\nExport from the list\nThe list has an export button\nThe invoice list shows an export button.\n');
  assert.strictEqual(slideText(slides()[3]), 'Download\n\nWhat it leaves out\n\nCredit notes are not exported\nOne file per month');
  assert.strictEqual(items[2].hash, crypto.createHash('sha256').update(slideText(slides()[1])).digest('hex').slice(0, 16));
  assert.strictEqual(hash16(Buffer.from('x')), crypto.createHash('sha256').update('x').digest('hex').slice(0, 16));
  const s = slides(); s[1].case = 'Export from the detail';
  assert.notStrictEqual(itemsOf(s, H)[2].hash, items[2].hash);
});

test('recordStatus: a fresh record is created with every item unchecked', () => {
  const items = itemsOf(slides(), H);
  const r = recordStatus('', items, { topic: 'invoice-export' });
  assert.deepStrictEqual(r.unchecked, items.map(i => i.key));
  assert.ok(r.text.startsWith('# Personal data — invoice-export\nLooked for: names, e-mail addresses, phone numbers, postal addresses, bank or card numbers, identity numbers, faces, free-text notes\n'));
  assert.ok(r.text.includes('- shots/invoice-list.png — aaaaaaaaaaaaaaaa — unchecked\n'));
  const all = recordStatus(clearRecord(items), items);
  assert.deepStrictEqual(all.unchecked, []);
  assert.strictEqual(all.text, clearRecord(items));
});

test('recordStatus E2: a re-shot frame and an edited caption come back unchecked with their new hash', () => {
  const before = itemsOf(slides(), H);
  const record = clearRecord(before);
  const s = slides(); s[1].text = 'The invoice list shows an export checkbox.';
  const after = itemsOf(s, { ...H, 'shots/invoice-list.png': 'cccccccccccccccc' });
  const r = recordStatus(record, after);
  assert.deepStrictEqual(r.unchecked, ['shots/invoice-list.png', 'slide2 text']);
  assert.ok(r.text.includes('- shots/invoice-list.png — cccccccccccccccc — unchecked\n'));
  assert.ok(!r.text.includes('aaaaaaaaaaaaaaaa'));
  assert.ok(r.text.includes(`- slide2 text — ${after[2].hash} — unchecked\n`));
  assert.ok(r.text.includes('- shots/invoice-export.png — bbbbbbbbbbbbbbbb — clear — personal data, 2026-11-18\n'));
  // A slide added later is appended unchecked.
  const more = after.concat({ key: 'slide5 text', hash: '0123456789abcdef' });
  assert.ok(recordStatus(r.text, more).text.endsWith('- slide5 text — 0123456789abcdef — unchecked\n'));
});

test('recordStatus E3: blur: is pending; blurred: counts only on the re-shot file\'s hash; kept: counts', () => {
  const items = itemsOf(slides(), H);
  const flagged = clearRecord(items).replace('- shots/invoice-list.png — aaaaaaaaaaaaaaaa — clear', '- shots/invoice-list.png — aaaaaaaaaaaaaaaa — blur: customer name');
  assert.deepStrictEqual(recordStatus(flagged, items).unchecked, ['shots/invoice-list.png']);
  const reshot = itemsOf(slides(), { ...H, 'shots/invoice-list.png': 'dddddddddddddddd' });
  const rewritten = recordStatus(flagged, reshot);
  assert.deepStrictEqual(rewritten.unchecked, ['shots/invoice-list.png']);
  const blurred = rewritten.text.replace('- shots/invoice-list.png — dddddddddddddddd — unchecked', '- shots/invoice-list.png — dddddddddddddddd — blurred: customer name — personal data, 2026-11-18');
  assert.deepStrictEqual(recordStatus(blurred, reshot).unchecked, []);
  // blurred: written on the old hash does not count
  const early = clearRecord(items).replace('aaaaaaaaaaaaaaaa — clear', 'aaaaaaaaaaaaaaaa — blurred: customer name');
  assert.deepStrictEqual(recordStatus(early, reshot).unchecked, ['shots/invoice-list.png']);
  const kept = clearRecord(items).replace('aaaaaaaaaaaaaaaa — clear', 'aaaaaaaaaaaaaaaa — kept: demo company name (the human)');
  assert.deepStrictEqual(recordStatus(kept, items).unchecked, []);
  const removed = clearRecord(items).replace('aaaaaaaaaaaaaaaa — clear', 'aaaaaaaaaaaaaaaa — removed: customer name');
  assert.deepStrictEqual(recordStatus(removed, items).unchecked, ['shots/invoice-list.png']);
});

test('recordStatus: verdicts are exact; an empty or wrongly signed kept:/blurred: stays unchecked', () => {
  const items = itemsOf(slides(), H);
  const withVerdict = v => clearRecord(items).replace('aaaaaaaaaaaaaaaa — clear', `aaaaaaaaaaaaaaaa — ${v}`);
  for (const v of ['kept:', 'kept: x', 'kept: x (an agent)', 'kept:  (the human)', 'blurred:', 'blurred:   ']) {
    assert.deepStrictEqual(recordStatus(withVerdict(v), items).unchecked, ['shots/invoice-list.png'], v);
  }
  for (const v of ['kept: customer name (the human)', 'blurred: customer name']) {
    assert.deepStrictEqual(recordStatus(withVerdict(v), items).unchecked, [], v);
  }
});

test('recordStatus: trailing whitespace on a record line reads the same as without it', () => {
  const items = itemsOf(slides(), H);
  const line = rest => clearRecord(items).replace('aaaaaaaaaaaaaaaa — clear — personal data, 2026-11-18', `aaaaaaaaaaaaaaaa — ${rest}`);
  for (const rest of ['clear ', 'clear\t', 'kept: customer name (the human) ', 'clear — personal data, 2026-11-18 ']) {
    const r = recordStatus(line(rest), items);
    assert.deepStrictEqual(r.unchecked, [], JSON.stringify(rest));
    assert.ok(r.text.includes('- shots/invoice-list.png — aaaaaaaaaaaaaaaa — '), JSON.stringify(rest));
  }
  for (const rest of ['kept: x ', 'blurred:  \t', 'unchecked ']) {
    assert.deepStrictEqual(recordStatus(line(rest), items).unchecked, ['shots/invoice-list.png'], JSON.stringify(rest));
  }
});

test('staleness fails closed: a missing or malformed stamp or acceptance commit is never current', () => {
  const full = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
  const stale = r => assert.ok(r.length > 0 && r.every(l => l.startsWith('stale: ')), JSON.stringify(r));
  stale(staleness({ stamp: 'a1b2c3d', codeChanged: false }));
  stale(staleness({ stamp: 'a1b2c3d', acceptanceCommit: 'HEAD', codeChanged: false }));
  stale(staleness({ stamp: 'a1b2c3d', acceptanceCommit: 'A1B2C3D', codeChanged: false }));
  assert.deepStrictEqual(staleness({ stamp: 'a1b2c3d', acceptanceCommit: '', codeChanged: false }),
    ['stale: the video was shot at a1b2c3d and the acceptance page is at unknown; a re-shoot is needed. Say "re-run" to start one.']);
  stale(staleness({ acceptanceCommit: full, codeChanged: false }));
  stale(staleness({ stamp: 'HEAD', acceptanceCommit: full, codeChanged: false }));
  stale(staleness({ stamp: 'abc', acceptanceCommit: full, codeChanged: false }));
  assert.deepStrictEqual(staleness({ acceptanceCommit: full, codeChanged: false }),
    ['stale: none is not in this repository (rebased or squashed?); a re-shoot is needed. Say "re-run" to start one.']);
  assert.deepStrictEqual(staleness({ stamp: 'HEAD', acceptanceCommit: full, codeChanged: false }),
    ['stale: HEAD is not in this repository (rebased or squashed?); a re-shoot is needed. Say "re-run" to start one.']);
  stale(staleness());
});

test('staleness fails closed on codeChanged: only a strict false means unchanged', () => {
  const full = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
  const changed = ['stale: the code changed since the video was shot at a1b2c3d; a re-shoot is needed. Say "re-run" to start one.'];
  assert.deepStrictEqual(staleness({ stamp: 'a1b2c3d', acceptanceCommit: full }), changed);
  for (const codeChanged of [undefined, 0, 'false', 'true', 1]) {
    assert.deepStrictEqual(staleness({ stamp: 'a1b2c3d', acceptanceCommit: full, codeChanged }), changed, JSON.stringify(codeChanged));
  }
  assert.deepStrictEqual(staleness({ stamp: 'a1b2c3d', acceptanceCommit: full, codeChanged: false }), []);
});

test('staleness E7: commits compare by prefix; code changes and unknown stamps are named; never "current"', () => {
  const full = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
  assert.deepStrictEqual(staleness({ stamp: 'a1b2c3d', acceptanceCommit: full, codeChanged: false }), []);
  assert.deepStrictEqual(staleness({ stamp: full, acceptanceCommit: 'a1b2c3d', codeChanged: false }), []);
  assert.deepStrictEqual(staleness({ stamp: 'a1b2c3d', acceptanceCommit: '9f8e7d6', codeChanged: false }),
    ['stale: the video was shot at a1b2c3d and the acceptance page is at 9f8e7d6; a re-shoot is needed. Say "re-run" to start one.']);
  assert.deepStrictEqual(staleness({ stamp: 'a1b2c3d', acceptanceCommit: full, codeChanged: true }),
    ['stale: the code changed since the video was shot at a1b2c3d; a re-shoot is needed. Say "re-run" to start one.']);
  assert.deepStrictEqual(staleness({ stamp: 'a1b2c3d', acceptanceCommit: full, codeChanged: null }),
    ['stale: a1b2c3d is not in this repository (rebased or squashed?); a re-shoot is needed. Say "re-run" to start one.']);
  const both = staleness({ stamp: 'a1b2c3d', acceptanceCommit: '9f8e7d6', codeChanged: true });
  assert.strictEqual(both.length, 2);
  assert.ok(both.every(l => l.startsWith('stale: ') && !/current/i.test(l)));
});

const ENCODERS = `Encoders:
 V..... = Video
 A..... = Audio
 ------
 V....D libx264rgb           libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 RGB (codec h264)
 V....D libopenh264          OpenH264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)
 A....D aac                  AAC (Advanced Audio Coding)
`;
const FILTERS = `Filters:
  T.. = Timeline support
  | = Source or sink filter
 ... acrossfade        AA->A      Cross fade two input audio streams.
 ... xfade_opencl      VV->V      Cross fade one video with another video.
 T.C loudnorm          A->A       EBU R128 loudness normalization
 T.. afade             A->A       Fade in/out input audio.
`;

test('probeMissing: whole names in the name column only; xfade_opencl and libx264rgb do not count', () => {
  assert.deepStrictEqual(probeMissing(ENCODERS, FILTERS), ['libx264', 'xfade']);
  assert.deepStrictEqual(probeMissing(ENCODERS, FILTERS, { music: true }), ['libx264', 'xfade']);
  const enc = ENCODERS + ' V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)\n';
  const fil = FILTERS + ' TSC xfade             VV->V      Cross fade one video with another video.\n';
  assert.deepStrictEqual(probeMissing(enc, fil, { music: true }), []);
  assert.deepStrictEqual(probeMissing(enc.replace(/^ A\.\.\.\.D aac .*\n/m, ''), fil.replace(/^ T\.C loudnorm .*\n/m, ''), { music: true }), ['loudnorm', 'aac']);
  assert.deepStrictEqual(probeMissing(enc.replace(/^ A\.\.\.\.D aac .*\n/m, ''), fil), []);
});

test('installHint: the missing names, the install lines and the closing line', () => {
  const t = installHint(['xfade']);
  assert.match(t, /xfade/);
  assert.match(t, /^Linux: your distribution's ffmpeg package \(Debian, Ubuntu: sudo apt install ffmpeg; Fedora: from RPM Fusion, its ffmpeg-free lacks libx264\)$/m);
  assert.match(t, /^macOS: brew install ffmpeg$/m);
  assert.match(t, /^Windows: unverified$/m);
  assert.match(t, /Install it, then run team-video again\.$/);
  assert.match(installHint([]), /^Linux: /);
});

test('muxArgs: music loops and fades out at total − 2; no music means no audio input, codec or loudnorm (Review Focus 3)', () => {
  const s = slides();
  const sched = schedule(s);
  const segments = s.map((_, i) => `work/seg0${i + 1}.mkv`);
  const base = { segments, sched, slides: s, chapters: 'work/chapters.txt', out: 'invoice-export.mp4', fade: 0.5 };
  const withMusic = muxArgs({ ...base, music: 'music/calm.mp3' });
  const mi = withMusic.indexOf('music/calm.mp3');
  assert.deepStrictEqual(withMusic.slice(mi - 3, mi + 1), ['-stream_loop', '-1', '-i', 'music/calm.mp3']);
  const graph = withMusic[withMusic.indexOf('-filter_complex') + 1];
  const end = Math.round((sched.total - 2) * 1000) / 1000;
  assert.ok(graph.includes(`afade=t=in:d=0.3`), graph);
  assert.ok(graph.includes(`afade=t=out:st=${end}:d=2`), graph);
  assert.ok(graph.includes('loudnorm=I=-20:TP=-2'), graph);
  assert.ok(graph.includes(`xfade=transition=fade:duration=0.5:offset=${sched.offsets[1]}`), graph); // same chapter
  assert.ok(graph.includes(`xfade=transition=smoothleft:duration=0.5:offset=${sched.offsets[2]}`), graph); // across chapters
  assert.ok(graph.includes(`xfade=transition=fade:duration=0.5:offset=${sched.offsets[3]}`), graph);
  const joined = withMusic.join(' ');
  assert.ok(joined.includes('-c:a aac -b:a 192k'));
  assert.ok(joined.includes('-c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart'));
  assert.ok(joined.includes(`-t ${sched.total}`));
  assert.strictEqual(withMusic[withMusic.length - 1], 'invoice-export.mp4');
  segments.forEach(seg => assert.strictEqual(withMusic[withMusic.indexOf(seg) - 1], '-i'));

  const silent = muxArgs({ ...base, music: null });
  const sj = silent.join(' ');
  assert.ok(!silent.includes('music/calm.mp3'));
  assert.ok(!silent.includes('-c:a'));
  assert.ok(!silent.includes('-stream_loop'));
  assert.doesNotMatch(sj, /loudnorm|afade|\[a\]/);
  assert.ok(sj.includes('-c:v libx264'));
  assert.ok(silent.includes('-map_chapters'));
});

const ctxOf = (over = {}) => ({ brand: brand(), logoDataUri: null, commit: 'a1b2c3d4e5f6', music: null, total: 4, duration: 8, manifest: manifest(), ...over });

test('slideHtml: lang from the brand, the sha in the last footer only, the music credit only with music', () => {
  const s = slides();
  const first = slideHtml(s[0], 0, ctxOf());
  const last = slideHtml(s[3], 3, ctxOf());
  assert.match(first, /<html lang="en">/);
  assert.match(slideHtml(s[0], 0, ctxOf({ brand: brand({ lang: 'fr' }) })), /<html lang="fr">/);
  assert.ok(!first.includes('a1b2c3d'));
  assert.match(last, /<footer[\s\S]*a1b2c3d[\s\S]*<\/footer>/);
  assert.ok(!last.includes('a1b2c3d4'));
  assert.doesNotMatch(last, /Music/);
  const withMusic = slideHtml(s[3], 3, ctxOf({ music: MUSIC }));
  assert.ok(withMusic.includes('Music: Calm Morning — A. Composer (CC BY 4.0)'));
  assert.ok(!slideHtml(s[1], 1, ctxOf({ music: MUSIC })).includes('Calm Morning'));
  assert.ok(slideHtml(s[3], 3, ctxOf({ music: MUSIC, brand: brand({ lang: 'fr' }) })).includes('Musique : Calm Morning'));
});

test('slideHtml: a 1920×1080 page on a 120px auto 1fr auto grid, caption at 40 px, a two-tone ring, escaped text', () => {
  const s = slides();
  const img = slideHtml(s[1], 1, ctxOf());
  assert.match(img, /width:\s*1920px/);
  assert.match(img, /height:\s*1080px/);
  assert.match(img, /grid-template-rows:\s*120px auto minmax\(0, 1fr\) auto/);
  assert.match(img, /\.caption\s*\{[^}]*font-size:\s*40px/);
  assert.match(img, /<p class="caption">The invoice list shows an export button\.<\/p>/);
  assert.match(img, /Invoice export · Export from the list/);
  assert.match(img, /\.ring\s*\{[^}]*border:\s*6px solid #1c1c1a[^}]*box-shadow:\s*0 0 0 3px #fff, inset 0 0 0 3px #fff/);
  assert.match(img, /class="ring" style="left: 80%; top: 5%; width: 10%; height: 4%; animation-delay: 1\.2s"/);
  assert.match(img, /src="\.\.\/shots\/invoice-list\.png"/);
  assert.doesNotMatch(img, /@font-face|https?:\/\//);
  const screen = slideHtml(s[2], 2, ctxOf({ duration: 8 }));
  assert.match(screen, /class="cursor"/);
  assert.match(screen, /class="click"/);
  assert.match(screen, /animation-delay: 5\.2s/); // frame 1 appears at 4 s, its ring 1.2 s later
  const x = slideHtml({ kind: 'title', chapter: 'Q&A', title: '"Paid" <now>' }, 0, ctxOf());
  assert.ok(x.includes('&quot;Paid&quot; &lt;now&gt;') && x.includes('Q&amp;A'));
  assert.doesNotMatch(slideHtml(s[0], 0, ctxOf()), /<img/);
});

test('slideHtml: one filled top bar on every kind: the logo (else the brand name), the chapter, the repo at the right', () => {
  const s = slides();
  const eyebrows = ['Invoice export', 'Invoice export · Export from the list', 'Download · Download the file', 'Download'];
  for (const k of [0, 1, 2, 3]) {
    const withLogo = slideHtml(s[k], k, ctxOf({ logoDataUri: 'data:image/png;base64,AAAA', repo: 'invoice-tools' }));
    assert.ok(withLogo.includes(`<header class="bar"><img class="logo" src="data:image/png;base64,AAAA" alt=""><p class="chapter">${eyebrows[k]}</p><p class="repo">invoice-tools</p></header>`), `kind ${s[k].kind}`);
    assert.doesNotMatch(withLogo.match(/<header[\s\S]*<\/header>/)[0], /Acme Invoicing/, 'the brand name only without a logo');
    const plain = slideHtml(s[k], k, ctxOf());
    assert.ok(plain.includes(`<header class="bar"><p class="brand">Acme Invoicing</p><p class="chapter">${eyebrows[k]}</p></header>`), `kind ${s[k].kind}`);
    assert.doesNotMatch(plain, /class="repo"/, 'no repo, none shown');
    assert.match(plain, /\.bar\s*\{[^}]*height:\s*120px[^}]*background:\s*var\(--primary\)/);
    assert.doesNotMatch(plain, /border-left:\s*12px/, 'the vertical strip is gone');
  }
  // The slide title sits under the bar, in ink; a title slide has its big title in main instead.
  assert.ok(slideHtml(s[1], 1, ctxOf()).includes('</header>\n<div class="title"><h1>The list has an export button</h1></div>'));
  assert.ok(slideHtml(s[0], 0, ctxOf()).includes('</header>\n<div class="title"></div>'));
  const logo = slideHtml(s[0], 0, ctxOf({ logoDataUri: 'data:image/png;base64,AAAA' }));
  assert.match(logo, /\.logo\s*\{[^}]*height:\s*56px/);
  assert.doesNotMatch(logo, /alt="Acme Invoicing"/);
  assert.match(logo, /\.repo\s*\{[^}]*margin-left:\s*auto/);
});

test('validate: the colour set: "neutral", a one-colour set and a full set are accepted', () => {
  for (const colors of ['neutral', { primary: '#1a7f5a' }, { primary: '#1a7f5a', secondary: '#B45309', surface: '#f7f7f5' }]) {
    assert.deepStrictEqual(validate(doc({ brand: brand({ colors }) }), manifest(), exists), [], JSON.stringify(colors));
  }
});

test('slideHtml: the brand colours: primary fills the bar, secondary the title rule and bullet markers, surface the page; neutral is #4a5568', () => {
  const s = slides();
  const full = { primary: '#1a7f5a', secondary: '#b45309', surface: '#f7f7f5' };
  const c = barColors('#1a7f5a');
  for (const k of [0, 3]) {
    const html = slideHtml(s[k], k, ctxOf({ brand: brand({ colors: full }) }));
    assert.ok(html.includes(`:root { --primary: #1a7f5a; --detail: #b45309; --on: ${c.text}; --on-muted: ${c.muted}; --rule: ${c.muted}; --secondary: #b45309; --page: #f7f7f5; }`), html.match(/:root \{ --primary[^}]*\}/g).pop());
    assert.match(html, /html, body \{[^}]*background:\s*var\(--page\)/);
    assert.match(html, /\.big::after \{[^}]*background:\s*var\(--detail\)/);
    assert.match(html, /\.bullets li::marker \{ color: var\(--detail\); \}/);
  }
  // A one-colour set: the secondary takes the primary, the surface the primary's 8 % tint.
  const one = slideHtml(s[1], 1, ctxOf({ brand: brand({ colors: { primary: '#1A7F5A' } }) }));
  assert.ok(one.includes(`:root { --primary: #1a7f5a; --detail: #1a7f5a; --on: ${c.text}; --on-muted: ${c.muted}; --rule: ${c.muted}; --secondary: #1a7f5a; --page: #edf5f2; }`), one.match(/:root \{ --primary[^}]*\}/g).pop());
  assert.match(one, /\.shot img \{[^}]*background:\s*#fff[^}]*border-radius:[^}]*box-shadow:/);
  assert.match(slideHtml(s[1], 1, ctxOf()), /:root \{ --primary: #4a5568; --detail: #4a5568; --on: [^}]*--page: #f1f1f3; \}/);
});

test('slideHtml: a secondary that reaches 3:1 on the primary draws the bar stripe and divider; a close one or a one-colour set draws no stripe', () => {
  const navy = '#1d214e', green = '2edc76';
  assert.ok(contrast('#' + green, navy) >= 3);
  const full = slideHtml(slides()[3], 3, ctxOf({ brand: brand({ colors: { primary: '#1D214E', secondary: '#2EDC76', surface: '#f5f5f5' } }) }));
  assert.match(full, /--rule: #2edc76; --secondary: #2edc76;/);
  assert.match(full, /\.bar::after \{[^}]*bottom: 0; height: 6px; background: var\(--secondary\)/);
  assert.match(full, /--detail: #1d214e;/, 'the title rule and bullet markers stay navy');
  assert.match(full, /\.chapter \{[^}]*border-left: 2px solid var\(--rule\)/);
  assert.match(full, /\.bar \{[^}]*height: 120px[^}]*position: relative/);
  for (const colors of [{ primary: '#1d214e', secondary: '#262b5c' }, { primary: '#1d214e' }, 'neutral']) {
    const html = slideHtml(slides()[3], 3, ctxOf({ brand: brand({ colors }) }));
    assert.doesNotMatch(html, /\.bar::after/, JSON.stringify(colors));
    assert.match(html, /--rule: #[0-9a-f]{6}; --secondary/);
  }
});

test('slideHtml: a secondary under 3:1 on the surface falls back to the primary for its details', () => {
  assert.ok(contrast('#f5c400', '#f7f7f5') < 3);
  const pale = slideHtml(slides()[3], 3, ctxOf({ brand: brand({ colors: { primary: '#1a7f5a', secondary: '#f5c400', surface: '#f7f7f5' } }) }));
  assert.match(pale, /:root \{ --primary: #1a7f5a; --detail: #1a7f5a; --on: [^}]*--page: #f7f7f5; \}/);
  assert.strictEqual(detailColor('#f5c400', '#1a7f5a', '#f7f7f5'), '#1a7f5a');
  assert.strictEqual(detailColor('#b45309', '#1a7f5a', '#f7f7f5'), '#b45309');
  assert.ok(contrast('#b45309', '#f7f7f5') >= 3);
});

test('brandColors: the fallbacks, pure', () => {
  assert.deepStrictEqual(brandColors('neutral'), { primary: '#4a5568', secondary: '#4a5568', surface: pageTint('#4a5568') });
  assert.deepStrictEqual(brandColors({ primary: '#1A7F5A' }), { primary: '#1a7f5a', secondary: '#1a7f5a', surface: '#edf5f2' });
  assert.deepStrictEqual(brandColors({ primary: '#1a7f5a', secondary: '#b45309' }), { primary: '#1a7f5a', secondary: '#b45309', surface: '#edf5f2' });
  assert.deepStrictEqual(brandColors({ primary: '#1a7f5a', surface: '#F7F7F5' }), { primary: '#1a7f5a', secondary: '#1a7f5a', surface: '#f7f7f5' });
});

test('barColors: near-white on a dark accent, near-black on a light one, every bar text at 4.5:1; the page tint keeps ink at 7:1', () => {
  assert.strictEqual(contrast('#ffffff', '#000000'), 21);
  assert.strictEqual(contrast('#777777', '#777777'), 1);
  assert.strictEqual(barColors('#1d214e').text, '#fafafa');
  assert.strictEqual(barColors('#f5c400').text, '#111111');
  for (const a of ['#1d214e', '#4a5568', '#1a7f5a', '#f5c400', '#e11d48', '#777777', '#7a7a7a', '#808080', '#ffffff', '#000000', '#00ffff']) {
    const { text, muted } = barColors(a);
    assert.ok(contrast(text, a) >= 4.5, `${a}: text ${text}`);
    assert.ok(contrast(muted, a) >= 4.5, `${a}: muted ${muted}`);
    assert.ok(contrast('#1c1c1a', pageTint(a)) >= 7, `${a}: ink on ${pageTint(a)}`);
  }
  assert.strictEqual(pageTint('#1a7f5a'), '#edf5f2'); // 8 % of the accent into white
  assert.strictEqual(pageTint('#000000'), '#ebebeb');
});

// ---------- step 7: the CLI (video.js) and the render driver (lib/render.js) ----------
// No browser and no real ffmpeg: a fake ffmpeg shell script on PATH, fake Playwright module layouts, temp git repos.

const { tmpDir } = require('../view/helpers');
const VIDEO = path.join(__dirname, '..', '..', 'skills', 'team-video', 'video.js');
const RENDER_LIB = path.join(__dirname, '..', '..', 'skills', 'team-video', 'lib', 'render.js');

const put = (file, content) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const git = (cwd, ...a) => {
  const r = spawnSync('git', ['-C', cwd, '-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', '-c', 'init.defaultBranch=main', ...a], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  return r.stdout.trim();
};
const video = (args, env = {}) => spawnSync(process.execPath, [VIDEO, ...args], { encoding: 'utf8', timeout: 30000, env: { ...process.env, NODE_PATH: '', ...env } });
const out = r => r.stdout + r.stderr;
// A module folder Node resolves: package.json with its main, and that file.
const fakeModule = (dir, name) => {
  put(path.join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0', main: 'index.js' }));
  put(path.join(dir, 'index.js'), 'module.exports = { fake: true };\n');
};

// A project: its code committed, then its acceptance page and video folder stamped at that commit (a .council/-only commit).
// The fake Playwright sits in the root's node_modules, untracked, as an installed dependency is.
function project({ playwright = true, mutate } = {}) {
  const root = tmpDir('video-');
  git(root, 'init', '-q');
  put(path.join(root, 'src', 'invoice.js'), 'module.exports = { total: 1 };\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'invoice code');
  const stamp = git(root, 'rev-parse', '--short=7', 'HEAD');
  const acceptance = path.join(root, '.council', 'acceptance', 'invoice-export', 'invoice-export.acceptance.json');
  put(acceptance, JSON.stringify({ title: 'Invoice export', commit: stamp, cases: [] }));
  const dir = path.join(root, '.council', 'video', 'invoice-export');
  put(path.join(dir, 'shots', 'manifest.json'), JSON.stringify(manifest()));
  put(path.join(dir, 'shots', 'invoice-list.png'), 'invoice list, first shoot');
  put(path.join(dir, 'shots', 'invoice-export.png'), 'invoice export, first shoot');
  const d = doc({ commit: stamp });
  if (mutate) mutate(d);
  const file = path.join(dir, 'invoice-export.slides.json');
  put(file, JSON.stringify(d, null, 2));
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'acceptance page and video');
  if (playwright) fakeModule(path.join(root, 'node_modules', 'playwright'), 'playwright');
  return { root, dir, file, stamp, acceptance, record: path.join(dir, 'personal-data.md') };
}

// A fake ffmpeg: prints the given -encoders and -filters lists, and touches `called` beside itself on any other call.
function fakeFfmpeg({ encoders = ENCODERS + ' V....D libx264              libx264 H.264\n', filters = FILTERS + ' TSC xfade             VV->V      Cross fade.\n' } = {}) {
  const bin = tmpDir('ffmpeg-');
  put(path.join(bin, 'enc.txt'), encoders);
  put(path.join(bin, 'fil.txt'), filters);
  put(path.join(bin, 'ffmpeg'), `#!/bin/sh\ncase "$*" in\n  *-encoders*) cat "${bin}/enc.txt" ;;\n  *-filters*) cat "${bin}/fil.txt" ;;\n  *) touch "${bin}/called"; exit 1 ;;\nesac\n`);
  fs.chmodSync(path.join(bin, 'ffmpeg'), 0o755);
  return bin;
}

test('requiring video.js or lib/render.js prints nothing and starts nothing', () => {
  for (const file of [VIDEO, RENDER_LIB]) {
    const r = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(file)})`], { encoding: 'utf8', timeout: 10000 });
    assert.strictEqual(r.status, 0, r.stderr);
    assert.strictEqual(r.stdout + r.stderr, '', file);
  }
});

test('video.js: a wrong call prints the usage and exits 2', () => {
  for (const args of [[], ['film'], ['check'], ['preview', 'x.slides.json'], ['render', 'x.slides.json', '--from'], ['check', 'x.slides.json', '--slide=1']]) {
    const r = video(args);
    assert.strictEqual(r.status, 2, `${args.join(' ')}: ${out(r)}`);
    assert.match(r.stderr, /usage: node video\.js/);
  }
});

test('probe E5: an ffmpeg lacking xfade stops naming it and the install lines; none on PATH says not found', () => {
  const lacking = fakeFfmpeg({ filters: FILTERS });
  const r = video(['probe'], { PATH: `${lacking}:/usr/bin:/bin` });
  assert.strictEqual(r.status, 1, out(r));
  for (const s of ['xfade', 'Linux:', 'macOS:', 'Windows: unverified', 'Install it, then run team-video again.']) assert.ok(r.stderr.includes(s), `${s} not in:\n${r.stderr}`);
  assert.doesNotMatch(r.stderr, /libx264,|acrossfade/);
  const none = video(['probe'], { PATH: tmpDir('empty-') });
  assert.strictEqual(none.status, 1, out(none));
  assert.match(none.stderr, /^ffmpeg not found on PATH\nLinux: /);
  assert.match(none.stderr, /Install it, then run team-video again\.\n$/);
});

test('probe: a complete ffmpeg prints what it found; --music asks for loudnorm and aac too', () => {
  const full = fakeFfmpeg();
  const r = video(['probe'], { PATH: `${full}:/usr/bin:/bin` });
  assert.strictEqual(r.status, 0, out(r));
  assert.strictEqual(r.stdout, 'ffmpeg ok: libx264, xfade, acrossfade\n');
  const m = video(['probe', '--music'], { PATH: `${full}:/usr/bin:/bin` });
  assert.strictEqual(m.stdout, 'ffmpeg ok: libx264, xfade, acrossfade, loudnorm, aac\n');
  const noAac = fakeFfmpeg({ encoders: ' V....D libx264              libx264 H.264\n' });
  const n = video(['probe', '--music'], { PATH: `${noAac}:/usr/bin:/bin` });
  assert.strictEqual(n.status, 1);
  assert.match(n.stderr, /^ffmpeg lacks: aac$/m);
});

test('check: the per-slide list, the reading time and the record; a .council/-only commit is not stale', () => {
  const p = project();
  const r = video(['check', p.file]);
  assert.strictEqual(r.status, 0, out(r));
  assert.doesNotMatch(out(r), /stale:|current/i);
  assert.match(r.stdout, /^1 Invoice export — Export invoices to CSV — 3\.5 s$/m);
  assert.match(r.stdout, /^3 Download — The export downloads a CSV — 5\.5 s$/m);
  assert.match(r.stdout, /^reading time 17\.1 s for 4 slides \(an estimate\)$/m);
  assert.match(r.stdout, /^items: 0 checked, 6 unchecked$/m);
  assert.match(r.stdout, /^Run the personal-data pass \(flow 4\) before render\.$/m);
  const record = fs.readFileSync(p.record, 'utf8');
  assert.ok(record.startsWith('# Personal data — invoice-export\nLooked for: '), record);
  assert.ok(record.includes(`- shots/invoice-list.png — ${hash16(fs.readFileSync(path.join(p.dir, 'shots', 'invoice-list.png')))} — unchecked\n`), record);
  // One more commit touching only .council/ (the record): still not stale.
  git(p.root, 'add', '.council');
  git(p.root, 'commit', '-q', '-m', 'record');
  assert.doesNotMatch(video(['check', p.file]).stdout, /stale:/);
});

test('check E7: an acceptance commit that differs, or a code change, prints stale: and never "current"', () => {
  const p = project();
  put(p.acceptance, JSON.stringify({ title: 'Invoice export', commit: '9f8e7d6', cases: [] }));
  const r = video(['check', p.file]);
  assert.strictEqual(r.status, 0, out(r));
  assert.ok(r.stdout.includes(`stale: the video was shot at ${p.stamp} and the acceptance page is at 9f8e7d6; a re-shoot is needed. Say "re-run" to start one.\n`), r.stdout);
  assert.doesNotMatch(out(r), /current/i);
  const q = project();
  put(path.join(q.root, 'src', 'invoice.js'), 'module.exports = { total: 2 };\n');
  git(q.root, 'add', '-A');
  git(q.root, 'commit', '-q', '-m', 'invoice total');
  const c = video(['check', q.file]);
  assert.ok(c.stdout.includes(`stale: the code changed since the video was shot at ${q.stamp}; a re-shoot is needed. Say "re-run" to start one.\n`), c.stdout);
  assert.doesNotMatch(out(c), /current/i);
});

test('check: the stale lines come before validate, so an old slides file that no longer validates is still reported stale', () => {
  const p = project({ mutate: d => { d.version = 2; } });
  put(p.acceptance, JSON.stringify({ title: 'Invoice export', commit: '9f8e7d6', cases: [] }));
  const r = video(['check', p.file]);
  assert.strictEqual(r.status, 1, out(r));
  assert.match(r.stdout, /^stale: the video was shot at [0-9a-f]{7} and the acceptance page is at 9f8e7d6;/m);
  assert.match(r.stderr, /version: 2; set "version": 1/);
  assert.doesNotMatch(r.stdout, /reading time|items:/);
  put(p.file, '{ "commit": ');
  const broken = video(['check', p.file]);
  assert.strictEqual(broken.status, 1, out(broken));
  assert.ok(broken.stdout.includes('stale: none is not in this repository (rebased or squashed?); a re-shoot is needed. Say "re-run" to start one.\n'), broken.stdout);
  assert.match(broken.stderr, /invoice-export\.slides\.json is not JSON/);
});

test('check E2: a re-shot frame comes back unchecked with its new hash; render then refuses before Playwright or ffmpeg', () => {
  const p = project();
  const ffmpeg = fakeFfmpeg();
  const env = { PATH: `${ffmpeg}:/usr/bin:/bin` };
  // A render before any pass lists the first five unchecked items.
  const early = video(['render', p.file], env);
  assert.strictEqual(early.status, 1, out(early));
  assert.strictEqual(early.stderr, 'unchecked frames (personal-data pass first): slide1 text, shots/invoice-list.png, slide2 text, shots/invoice-export.png, slide3 text, +1 more\nRun the personal-data pass (flow 4), then render again.\n');
  // The seat's pass: every line clear.
  fs.writeFileSync(p.record, fs.readFileSync(p.record, 'utf8').replace(/ — unchecked$/gm, ' — clear — personal data, 2026-11-18'));
  assert.match(video(['check', p.file]).stdout, /^items: 6 checked, 0 unchecked$/m);
  const reshot = 'invoice list, re-shot with the checkbox';
  fs.writeFileSync(path.join(p.dir, 'shots', 'invoice-list.png'), reshot);
  const r = video(['check', p.file]);
  assert.strictEqual(r.status, 0, out(r));
  assert.match(r.stdout, /^items: 5 checked, 1 unchecked$/m);
  const record = fs.readFileSync(p.record, 'utf8');
  assert.ok(record.includes(`- shots/invoice-list.png — ${hash16(Buffer.from(reshot))} — unchecked\n`), record);
  assert.ok(record.includes('- shots/invoice-export.png — '), record);
  const refused = video(['render', p.file], env);
  assert.strictEqual(refused.status, 1, out(refused));
  assert.strictEqual(refused.stderr, 'unchecked frames (personal-data pass first): shots/invoice-list.png\nRun the personal-data pass (flow 4), then render again.\n');
  assert.ok(!fs.existsSync(path.join(p.dir, 'work')));
  assert.ok(!fs.existsSync(path.join(p.dir, 'invoice-export.mp4')));
  assert.ok(!fs.existsSync(path.join(ffmpeg, 'called')));
});

test('check Review Focus 2: a 40-word caption warns and exits 0; no Playwright exits 1 with the message; --from finds a subfolder\'s', () => {
  const p = project({ mutate: d => { d.slides[1].text = words(40); } });
  const r = video(['check', p.file]);
  assert.strictEqual(r.status, 0, out(r));
  assert.match(r.stdout, /^warning: slide 2: [\d.]+ s of reading time is outside the readable range 3-11 s/m);
  assert.match(r.stdout, /^reading time [\d.]+ s for 4 slides \(an estimate\)$/m);
  const q = project({ playwright: false });
  const none = video(['check', q.file]);
  assert.strictEqual(none.status, 1, out(none));
  assert.ok(none.stderr.includes(`no Playwright found from ${fs.realpathSync(q.root)}; pass --from=<folder holding node_modules>`), none.stderr);
  assert.match(none.stdout, /^reading time /m); // the checks before it ran
  fakeModule(path.join(q.root, 'frontend', 'node_modules', 'playwright'), 'playwright');
  assert.strictEqual(video(['check', q.file]).status, 1);
  const from = video(['check', q.file, `--from=${path.join(q.root, 'frontend')}`]);
  assert.strictEqual(from.status, 0, out(from));
});

test('resolvePlaywright: plain, pnpm through @playwright/test, none, and a subfolder that needs --from', () => {
  const { resolvePlaywright } = require(RENDER_LIB);
  const plain = tmpDir('pw-plain-');
  fakeModule(path.join(plain, 'node_modules', 'playwright'), 'playwright');
  assert.strictEqual(resolvePlaywright(plain), fs.realpathSync(path.join(plain, 'node_modules', 'playwright', 'index.js')));

  const pnpm = tmpDir('pw-pnpm-');
  const store = path.join(pnpm, 'node_modules', '.pnpm', '@playwright+test@1.0.0', 'node_modules');
  fakeModule(path.join(store, '@playwright', 'test'), '@playwright/test');
  fakeModule(path.join(store, 'playwright'), 'playwright');
  fs.mkdirSync(path.join(pnpm, 'node_modules', '@playwright'), { recursive: true });
  fs.symlinkSync(path.join(store, '@playwright', 'test'), path.join(pnpm, 'node_modules', '@playwright', 'test'), 'dir');
  assert.ok(!fs.existsSync(path.join(pnpm, 'node_modules', 'playwright')));
  assert.strictEqual(resolvePlaywright(pnpm), fs.realpathSync(path.join(store, 'playwright', 'index.js')));

  const none = tmpDir('pw-none-');
  assert.throws(() => resolvePlaywright(none), { message: `no Playwright found from ${none}; pass --from=<folder holding node_modules>` });

  const sub = tmpDir('pw-sub-');
  fakeModule(path.join(sub, 'frontend', 'node_modules', 'playwright'), 'playwright');
  assert.throws(() => resolvePlaywright(sub), /no Playwright found from/);
  assert.strictEqual(resolvePlaywright(path.join(sub, 'frontend')), fs.realpathSync(path.join(sub, 'frontend', 'node_modules', 'playwright', 'index.js')));
});

test('repoName: origin\'s last path segment without .git, else the folder holding the git dir, else none; writePages passes it on', () => {
  const { repoName, loadProject, writePages } = require(VIDEO);
  const p = project();
  assert.strictEqual(repoName(p.root), path.basename(fs.realpathSync(p.root)), 'no origin: the folder holding .git');
  git(p.root, 'remote', 'add', 'origin', 'git@example.org:acme/invoice-tools.git');
  assert.strictEqual(repoName(p.dir), 'invoice-tools');
  git(p.root, 'remote', 'set-url', 'origin', 'https://example.org/acme/orders-api/');
  assert.strictEqual(repoName(p.root), 'orders-api');
  assert.strictEqual(repoName(tmpDir('no-git-')), null, 'a git failure shows no repo');
  const work = path.join(p.dir, 'work');
  const pages = writePages(loadProject(p.file), manifest(), schedule(slides()), work, 1);
  assert.ok(fs.readFileSync(pages[1], 'utf8').includes('<p class="repo">orders-api</p>'));
});

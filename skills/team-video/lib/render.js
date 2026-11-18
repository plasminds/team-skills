'use strict';
// The render driver of team-video: the project's own Playwright (resolved from a folder, never a hard-coded path: K8),
// each slide page captured frame by frame in Chromium, and each frame stream encoded by ffmpeg into one segment.
// video.js does every other read, write and command. No test reaches the capture (it needs a browser and ffmpeg):
// the human's run on a real project checks it. Requiring this file starts nothing.
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const WIDTH = 1920, HEIGHT = 1080;

// require.resolve from one folder, or null when the module is not found there; any other error is thrown.
function tryResolve(request, from) {
  try {
    return require.resolve(request, { paths: [from] });
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') return null;
    throw e;
  }
}

// resolvePlaywright(dir) → the path of the `playwright` module the project uses, searched from `dir` upward:
// `playwright` itself, else the `playwright` beside the real path of `@playwright/test` (a pnpm layout, where
// `playwright` is not linked at the top of node_modules). Upward only: a project keeping Playwright in a subfolder
// (frontend/node_modules) is found only with that subfolder as `dir` (--from).
function resolvePlaywright(dir) {
  const from = path.resolve(dir);
  const direct = tryResolve('playwright', from);
  if (direct) return direct;
  const testPkg = tryResolve('@playwright/test/package.json', from);
  if (testPkg) {
    const beside = tryResolve('playwright', path.dirname(fs.realpathSync(testPkg)));
    if (beside) return beside;
  }
  throw new Error(`no Playwright found from ${from}; pass --from=<folder holding node_modules>`);
}

// ffmpeg argv for one segment: PNG frames on stdin, encoded losslessly (libx264 qp 0, 4:4:4) so the mux's encode
// is the only lossy step.
function segmentArgs(out, fps) {
  return ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '0', '-pix_fmt', 'yuv444p', '-r', String(fps), out];
}

// Opens a slide page at 1920×1080, waits for its fonts and shots, and pauses every animation: time is then set by seek().
async function openSlide(browser, html) {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });
  await page.evaluate(async () => {
    if (document.fonts) await document.fonts.ready;
    const broken = [...document.querySelectorAll('.shot img')].filter(img => !img.complete || img.naturalWidth === 0);
    if (broken.length) throw new Error('shot not loaded: ' + broken.map(img => img.getAttribute('src')).join(', '));
    document.getAnimations().forEach(a => a.pause());
  });
  return page;
}

// Every animation of the page at `ms` from the slide's start (the pages' animations all start at load, delays included).
function seek(page, ms) {
  return page.evaluate(t => { document.getAnimations().forEach(a => { a.pause(); a.currentTime = t; }); }, ms);
}

// One segment: round(duration × fps) frames, each a CDP screenshot piped to ffmpeg.
async function captureSegment(browser, { html, duration, out }, { fps, ffmpeg }) {
  const page = await openSlide(browser, html);
  const enc = spawn(ffmpeg, segmentArgs(out, fps), { stdio: ['pipe', 'ignore', 'pipe'] });
  let errText = '', pipeError = null, ended = false;
  enc.stderr.on('data', d => { errText += d; });
  enc.stdin.on('error', e => { pipeError = pipeError || e; });
  const closed = new Promise(resolve => {
    enc.once('error', error => resolve({ error }));
    enc.once('close', (code, signal) => resolve({ code, signal }));
  }).then(r => { ended = true; return r; });
  try {
    const cdp = await page.context().newCDPSession(page);
    const frames = Math.round(duration * fps);
    for (let f = 0; f < frames && !ended && !pipeError; f++) {
      await seek(page, f * 1000 / fps);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      if (!enc.stdin.write(Buffer.from(data, 'base64'))) await Promise.race([new Promise(r => enc.stdin.once('drain', r)), closed]);
    }
    enc.stdin.end();
  } catch (e) {
    enc.kill('SIGKILL');
    await closed;
    throw e;
  } finally {
    await page.close();
  }
  const r = await closed;
  const name = path.basename(out);
  if (r.error) throw new Error(`ffmpeg could not run for ${name}: ${r.error.message}`);
  if (r.code !== 0) throw new Error(`ffmpeg failed on ${name} (${r.signal || 'exit ' + r.code})${errText.trim() ? ': ' + errText.trim() : ''}`);
  if (pipeError) throw new Error(`ffmpeg stopped reading frames for ${name}: ${pipeError.message}`);
}

// renderSegments(playwright, jobs[{ html, duration, out }], { fps, workers, ffmpeg }): the segments, `workers` pages at
// a time in one Chromium. The first failure stops the queue and is thrown once the browser is closed.
async function renderSegments(playwright, jobs, { fps = 25, workers = 4, ffmpeg = 'ffmpeg' } = {}) {
  const browser = await playwright.chromium.launch();
  let next = 0, failure = null;
  const worker = async () => {
    while (!failure && next < jobs.length) {
      const job = jobs[next++];
      try {
        await captureSegment(browser, job, { fps, ffmpeg });
      } catch (e) {
        failure = failure || e;
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(workers, jobs.length) }, worker));
  } finally {
    await browser.close();
  }
  if (failure) throw failure;
}

// captureStills(playwright, html, shots[{ at (s), out }]): PNG stills of one slide page at the given moments.
async function captureStills(playwright, html, shots) {
  const browser = await playwright.chromium.launch();
  try {
    const page = await openSlide(browser, html);
    for (const s of shots) {
      await seek(page, s.at * 1000);
      await page.screenshot({ path: s.out });
    }
  } finally {
    await browser.close();
  }
}

module.exports = { resolvePlaywright, segmentArgs, renderSegments, captureStills };

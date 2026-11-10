const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { RENDER, writeGate, render, pageData } = require('./helpers');

const TEMPLATE = path.join(path.dirname(RENDER), 'template.html');
const HTML = '<style>.a{display:grid}</style><div class="a" style="background:var(--surface)">Screen</div>';

function gate(after, extra) {
  return Object.assign({
    kind: 'debate', title: 'T', source: '.council/decisions/2026-10-14-x.md',
    decisions: [{ id: 'D1', title: 'Copy the thing?', options: [
      { value: 'a', label: 'Copy', recommended: true }, { value: 'b', label: 'Link' }] }],
    outcome: [{ view: 'ui', caption: 'The screen', after }]
  }, extra || {});
}
function rejects(g, pattern) {
  const r = render(writeGate(g));
  assert.notStrictEqual(r.code, 0, 'should be rejected');
  const out = r.stderr + r.stdout;
  assert.match(out, pattern);
  assert.match(out, /a screen mockup is static: no script, form or external resource/);
}
function ok(g) {
  const file = writeGate(g), r = render(file);
  assert.strictEqual(r.code, 0, r.stderr);
  return pageData(fs.readFileSync(file.replace(/\.gate\.json$/, '.html'), 'utf8'));
}

const BAD = [
  ['<script>', '<div></div><SCRIPT>x()</SCRIPT>', /outcome\[0\]\.after\.html contains a <script> tag/],
  ['inline handler', '<div onclick="x()">a</div>', /inline event handler/],
  ['javascript:', '<a href="JavaScript:x()">a</a>', /javascript: URL/],
  ['<link', '<link rel="stylesheet" href="a.css">', /<link> tag/],
  ['@import', '<style>@import "a.css";</style><div>a</div>', /@import/],
  ['<iframe', '<iframe src="a.html"></iframe>', /<iframe>/],
  ['<object', '<object data="a"></object>', /<object>/],
  ['<embed', '<embed src="a">', /<embed>/],
  ['<form', '<form><input></form>', /<form>/],
  ['http://', '<img src="http://x.test/a.png">', /http\(s\) URL/],
  ['https:// in css', '<div style="background:url(https://x.test/a.png)">a</div>', /http\(s\) URL/],
  ['protocol-relative', '<img src="//x.test/a.png">', /protocol-relative URL/],
  ['protocol-relative in css', '<div style="background:url(//x.test/a.png)">a</div>', /protocol-relative URL/]
];
for (const [name, html, re] of BAD) {
  test(`html figure rejects ${name}`, () => rejects(gate({ html }), re));
}

test('html figure rejects more than 60 KB', () => {
  rejects(gate({ html: '<div>' + 'a'.repeat(60 * 1024) + '</div>' }), /larger than 60 KB/);
});

test('html figure must be a non-empty string', () => {
  for (const html of ['', 42]) {
    const r = render(writeGate(gate({ html })));
    assert.notStrictEqual(r.code, 0);
    assert.match(r.stderr + r.stdout, /html must be a non-empty string/);
  }
});

test('html figure is accepted in item figures, outcome after and states', () => {
  const g = gate({ html: HTML }, {});
  g.decisions[0].figures = [{ html: HTML, caption: 'c' }];
  g.outcome[0].states = [{ label: 'Empty', caption: 'nothing', html: HTML }];
  const d = ok(g);
  assert.strictEqual(d.items[0].figures[0].html, HTML);
  assert.strictEqual(d.outcome[0].after.html, HTML);
  assert.strictEqual(d.outcome[0].states[0].html, HTML);
});

test('a .html src is inlined into html', () => {
  const g = gate({ src: 'screen.html' });
  const file = writeGate(g);
  fs.writeFileSync(path.join(path.dirname(file), 'screen.html'), HTML);
  const r = render(file);
  assert.strictEqual(r.code, 0, r.stderr);
  const d = pageData(fs.readFileSync(file.replace(/\.gate\.json$/, '.html'), 'utf8'));
  assert.strictEqual(d.outcome[0].after.html, HTML);
  assert.strictEqual(d.outcome[0].after.src, undefined);
});

test('an inlined .html src is validated too', () => {
  const file = writeGate(gate({ src: 'bad.html' }));
  fs.writeFileSync(path.join(path.dirname(file), 'bad.html'), '<script>x()</script>');
  const r = render(file);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.stderr + r.stdout, /<script> tag/);
});

test('template renders html figures in a shadow root', () => {
  const t = fs.readFileSync(TEMPLATE, 'utf8');
  assert.match(t, /attachShadow\(\{ mode: 'open' \}\)/);
});

// Pins the DOM the page script builds for every kind but debate, so the story-card steps cannot shift their markup.
// MARKUP_UPDATE=1 rewrites the fixtures in test/view/markup/.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const { fakeDom, render, domText, cover, tmpDir } = require('./helpers');

const EXAMPLES = path.join(__dirname, '..', '..', 'examples');
const FIXTURES = path.join(__dirname, 'markup');

async function boot(html) {
  const dom = fakeDom(html);
  dom.copied = [];
  vm.createContext(dom.ctx);
  [...html.matchAll(/<script(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g)].forEach(m => vm.runInContext(m[1], dom.ctx));
  for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve));
  return dom;
}

// Renders a gate file from a copy of its folder (no repo around it), boots the page, returns the booted dom.
async function bootFrom(dir, name) {
  const tmp = tmpDir('markup-');
  fs.cpSync(dir, tmp, { recursive: true });
  const file = path.join(tmp, name);
  const r = render(file);
  assert.strictEqual(r.code, 0, r.stderr);
  const html = fs.readFileSync(file.replace(/\.json$/, '.html').replace(/\.gate\.html$/, '.html'), 'utf8');
  return boot(html);
}

function twoDecisions(kind) {
  return {
    kind, title: kind + ' page', lang: 'en',
    ...cover([{ label: 'Direction', text: 'Do it.' }], { outcome: 0 }),
    decisions: [
      { id: 'D1', title: 'Build or buy?', options: [{ value: 'build', label: 'Build', recommended: true }, { value: 'buy', label: 'Buy' }] },
      { id: 'D2', title: 'Where?', options: [{ value: 'a', label: 'Here', recommended: true }, { value: 'b', label: 'There', negative: true }] }
    ],
    outcome: [{ view: 'ui', caption: 'The screen', after: { svg: '<svg viewBox="0 0 10 10"></svg>' } }]
  };
}

function gateInTmp(gate) {
  const tmp = tmpDir('markup-');
  fs.writeFileSync(path.join(tmp, 'g.gate.json'), JSON.stringify(gate));
  return tmp;
}

function compare(name, actual) {
  const file = path.join(FIXTURES, name + '.txt');
  if (process.env.MARKUP_UPDATE) { fs.mkdirSync(FIXTURES, { recursive: true }); fs.writeFileSync(file, actual); return; }
  const want = fs.readFileSync(file, 'utf8');
  if (want === actual) return;
  const a = want.split('\n'), b = actual.split('\n');
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const around = (ls) => ls.slice(Math.max(0, i - 3), i + 4).map((l, k) => (Math.max(0, i - 3) + k + 1) + ': ' + l).join('\n');
  assert.fail(name + ': markup differs at line ' + (i + 1) + '\n--- expected\n' + around(a) + '\n--- actual\n' + around(b));
}

const pages = {
  refactor: () => bootFrom(path.join(EXAMPLES, 'refactor-gate'), 'invoice.gate.json'),
  review: () => bootFrom(path.join(EXAMPLES, 'review-gate'), 'refund.gate.json'),
  acceptance: () => bootFrom(path.join(EXAMPLES, 'acceptance'), 'export.acceptance.json'),
  plan: () => bootFrom(gateInTmp(twoDecisions('plan')), 'g.gate.json'),
  kickoff: () => bootFrom(gateInTmp(twoDecisions('kickoff')), 'g.gate.json')
};

// The page script builds into the nodes it looks up by id or selector, not only under body: dump every top root.
function dump(dom) {
  const roots = dom.roots(), inner = new Set();
  const mark = n => (Array.isArray(n.children) ? n.children : []).forEach(c => { if (!inner.has(c)) { inner.add(c); mark(c); } });
  roots.forEach(mark);
  return [...new Set(roots)].filter(r => !inner.has(r)).map((r, i) => '== root ' + i + '\n' + domText(r)).join('');
}

Object.keys(pages).forEach(kind => {
  test('the ' + kind + ' page builds the same markup', async () => {
    const dom = await pages[kind]();
    compare(kind, dump(dom));
  });
});

test('domText sees className, dataset and disabled changes', async () => {
  const dom = await pages.plan();
  assert.strictEqual(dump(dom), dump(dom));
  const nodes = [];
  (function walk(n) { nodes.push(n); (Array.isArray(n.children) ? n.children : []).forEach(walk); })({ children: dom.roots() });
  const target = nodes.find(n => n.tagName === 'BUTTON') || nodes[nodes.length - 1];
  const change = {
    className: () => { target.className += ' zz'; },
    dataset: () => { target.dataset.zz = '1'; },
    disabled: () => { target.disabled = true; }
  };
  Object.keys(change).forEach(k => {
    const was = dump(dom);
    change[k]();
    assert.notStrictEqual(dump(dom), was, k + ' must change the dump');
  });
});

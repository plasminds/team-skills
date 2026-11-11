const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');
const { composedTemplate, fakeDom, writeGate, render, shareGate } = require('./helpers');

const TEMPLATE = composedTemplate();
const chrome = vm.runInNewContext(TEMPLATE.match(/\/\*CHROME-START\*\/([\s\S]*?)\/\*CHROME-END\*\//)[1] + '\n({ makeL: makeL })');
const prompt = vm.runInNewContext(TEMPLATE.match(/\/\*PROMPT-START\*\/([\s\S]*?)\/\*PROMPT-END\*\//)[1]
  + '\n({ sayWith: sayWith, plainSentences: plainSentences, decisionsBlock: decisionsBlock })');

const KEYS = ['copy.sentence', 'copy.sentenceUndecided', 'copy.sentenceMoot', 'copy.sentenceNote'];
// The page's own hand-off: the chrome strings as they are, filled by plainSentences.
const say = lang => { const L = chrome.makeL(lang).L, tr = prompt.sayWith(Object.fromEntries(KEYS.map(k => [k, L(k)]))); const f = (k, v) => (KEYS.includes(k) ? tr(k, v) : L(k, v)); return f; };

const items = [
  { kind: 'decision', id: 'D1', title: 'Build or buy?', options: [{ value: 'a', label: 'Build' }, { value: 'b', label: 'Buy' }] },
  { kind: 'decision', id: 'D2', title: 'Where?', options: [{ value: 'a', label: 'Here' }, { value: 'b', label: 'There' }] },
  { kind: 'decision', id: 'D3', title: 'Charge?', on: { id: 'D2', when: ['a'] }, options: [{ value: 'yes', label: 'Yes' }] },
  { kind: 'decision', id: 'D4', title: 'Later?', options: [{ value: 'yes', label: 'Yes' }] }
];

test('plainSentences: one line per decision, in block order, never the option code or an author', () => {
  const L = say('en');
  const state = { D1: { choice: 'b', note: 'cheaper  now' }, D2: { choice: 'b' } };
  assert.deepStrictEqual(prompt.plainSentences(items, state, L).split('\n'), [
    'D1. Build or buy? Answer: Buy',
    'Note: cheaper now',
    'D2. Where? Answer: There',
    'D3. Charge? Does not apply: D2 is "There".',
    'D4. Later? Not decided yet.'
  ]);
  assert.match(prompt.plainSentences(items, { D2: { choice: 'a' } }, say('fr')), /D2\. Where\? Réponse : Here/);
});

test('C6-1: two sentences, a blank line, the intro, then the block', () => {
  const L = say('en');
  const two = items.slice(0, 2), state = { D1: { choice: 'b' }, D2: { choice: 'a' } };
  const data = { title: 'T', kind: 'debate' };
  const text = prompt.plainSentences(two, state, L) + '\n\n' + L('copy.blockIntro') + '\n' + prompt.decisionsBlock(data, two, state);
  assert.strictEqual(text, 'D1. Build or buy? Answer: Buy\nD2. Where? Answer: Here\n\nSame answers in the form Claude reads:\nGATE DECISIONS — T\nD1 = b\nD2 = a');
});

const gate = kind => ({
  kind, title: 'Copy gate', lang: 'en',
  decisions: [
    { id: 'D1', title: 'Build or buy?', options: [{ value: 'a', label: 'Build' }, { value: 'b', label: 'Buy' }, { value: 'none', label: 'Neither', negative: true }] },
    { id: 'D2', title: 'Where?', options: [{ value: 'a', label: 'Here' }, { value: 'b', label: 'There' }, { value: 'none', label: 'Neither', negative: true }] }
  ]
});
async function boot(g, served) {
  const f = writeGate(g);
  const r = render(f);
  assert.strictEqual(r.code, 0, r.stderr);
  const html = fs.readFileSync(f.replace(/\.gate\.json$/, '.html'), 'utf8');
  const dom = fakeDom(html);
  dom.copied = []; dom.posts = [];
  dom.ctx.navigator.clipboard.writeText = t => { dom.copied.push(t); return Promise.resolve(); };
  dom.ctx.confirm = () => true;
  if (served) {
    dom.ctx.location.protocol = 'http:';
    dom.ctx.fetch = (u, o) => { dom.posts.push(o.body); return Promise.resolve({ ok: true }); };
  }
  vm.createContext(dom.ctx);
  [...html.matchAll(/<script(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g)].forEach(m => vm.runInContext(m[1], dom.ctx));
  for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve));
  return dom;
}
const opts = (dom, id) => dom.document.getElementById('d-' + id).querySelectorAll('.opt');
const choose = (dom, id, i) => opts(dom, id)[i].click();
const settle = () => new Promise(resolve => setImmediate(resolve));

test('a debate page opened from a file copies the sentences, the intro, then the block', async () => {
  const dom = await boot(gate('debate'));
  choose(dom, 'D1', 1); choose(dom, 'D2', 0);
  dom.document.getElementById('copy').click();
  await settle();
  assert.strictEqual(dom.copied.length, 1);
  const [sentences, rest] = dom.copied[0].split('\n\nSame answers in the form Claude reads:\n');
  assert.strictEqual(sentences, 'D1. Build or buy? Answer: Buy\nD2. Where? Answer: Here');
  assert.ok(rest.startsWith('GATE DECISIONS — Copy gate'), rest);
  assert.ok(rest.includes('\nD1 = b\nD2 = a'));
  assert.strictEqual(dom.document.getElementById('toast').textContent, 'Copied. Paste it into your reply.');
});

test('a council page copies the sentences too', async () => {
  const dom = await boot(gate('council'));
  choose(dom, 'D1', 0);
  dom.document.getElementById('copy').click();
  await settle();
  assert.ok(dom.copied[0].startsWith('D1. Build or buy? Answer: Build'), dom.copied[0]);
});

test('a served page posts the block alone, with no sentence', async () => {
  const dom = await boot(gate('debate'), true);
  choose(dom, 'D1', 1); choose(dom, 'D2', 0);
  dom.document.getElementById('send').click();
  await settle();
  assert.strictEqual(dom.posts.length, 1);
  assert.ok(dom.posts[0].startsWith('GATE DECISIONS'), dom.posts[0]);
  assert.ok(!dom.posts[0].includes('Answer:'));
});

// A9: every deciding kind copies as a debate page does; a review share keeps its agent prompt (share tests).
test('a review page opened from a file copies the sentences, the intro, then the block, as a debate page', async () => {
  const dom = await boot(shareGate({ lang: 'en' }));
  dom.document.getElementById('copy').click();
  await settle();
  const [sentences, rest] = dom.copied[0].split('\n\nSame answers in the form Claude reads:\n');
  assert.ok(sentences.startsWith('S1. Extract Constant: RATE Not decided yet.'), dom.copied[0]);
  assert.ok(rest.startsWith('GATE DECISIONS'), rest);
  assert.strictEqual(dom.document.getElementById('toast').textContent, 'Copied. Paste it into your reply.');
});

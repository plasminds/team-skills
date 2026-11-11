const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { composedTemplate, RENDER, shareGate, writeGate, render, pageData, fakeDom } = require('./helpers');

// The shared page shows the reviewer's picks, never the agents' recommendation. These tests run the page's script on a fake DOM.

const storeKey = data => 'team-view:' + (data.source || data.title) + ':' + (data._rev || '');
const settleDom = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
const scriptsOf = html => [...html.matchAll(/<script(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
// F1's option buttons: its options group is labelled with its id.
const f1Buttons = made => made.filter(n => n.className === 'options' && /\bF1\b/.test(n.attrs['aria-label'] || ''))[0].children;

function shareHtml(preset) {
  const file = writeGate(shareGate());
  const args = ['--share'];
  if (preset) {
    const p = file.replace(/\.gate\.json$/, '.share.txt');
    fs.writeFileSync(p, preset);
    args.push('--preset=' + p);
  }
  assert.strictEqual(render(file, ...args).code, 0);
  return { file, html: fs.readFileSync(file.replace(/\.gate\.json$/, '.share.html'), 'utf8') };
}

// Runs the page, collecting every element it creates.
async function run(html) {
  const dom = fakeDom(html), made = [], orig = dom.ctx.document.createElement;
  dom.ctx.document.createElement = tag => { const n = orig(tag); made.push(n); return n; };
  dom.ctx.location.hash = '#d-F1'; // a card, not the summary, so options are drawn
  vm.createContext(dom.ctx);
  scriptsOf(html).forEach(s => vm.runInContext(s, dom.ctx));
  await settleDom();
  return { dom, made };
}

test('a shared page without a pick shows no suggestion and no amber mark, though the agents recommended an option', async () => {
  const { html } = shareHtml();
  assert.ok(pageData(html).items.find(i => i.id === 'F1').options.some(o => o.recommended));
  const { made } = await run(html);
  assert.strictEqual(f1Buttons(made).filter(n => n.children.some(c => c.className === 'rectag sug')).length, 0);
  assert.strictEqual(f1Buttons(made).filter(n => n.children.some(c => /rectag/.test(c.className))).length, 0);
  assert.strictEqual(f1Buttons(made).filter(n => /\bis-rec\b/.test(n.className)).length, 0);
});

test('a shared page tags the reviewer\'s pick as Suggested, and only that option', async () => {
  const file = writeGate(shareGate());
  const f1 = JSON.parse(fs.readFileSync(file, 'utf8')).decisions.find(d => d.id === 'F1');
  const pick = f1.options.find(o => !o.recommended && !o.negative) || f1.options.find(o => !o.recommended);
  const { html } = shareHtml('GATE SHARE\nF1 = ' + pick.value + ' | note: Cheaper, same outcome\n');
  const { made } = await run(html);
  const tagged = f1Buttons(made).filter(n => n.children.some(c => c.className === 'rectag sug'));
  assert.deepStrictEqual(tagged.map(b => b.dataset.value), [pick.value]);
  assert.strictEqual(tagged[0].children.find(c => c.className === 'rectag sug').textContent, 'Suggested');
  assert.deepStrictEqual(f1Buttons(made).filter(n => /\bis-rec\b/.test(n.className)).map(b => b.dataset.value), [pick.value]);
});

test('A9: a shared review card\'s option rows tag the reviewer\'s pick as Suggested, none Recommended, and its pane opens on the pick', async () => {
  const { html } = shareHtml('GATE SHARE\nF1 = round\n');
  const { dom } = await run(html);
  const card = dom.ctx.document.getElementById('d-F1');
  const rows = card.querySelectorAll('.orow'), valueOf = r => r.querySelectorAll('.opick')[0].dataset.value;
  assert.deepStrictEqual(rows.map(valueOf), ['keep', 'round', 'ask']);
  const tagged = rows.filter(r => r.querySelectorAll('.rectag').length);
  assert.deepStrictEqual(tagged.map(valueOf), ['round'], 'only the pick is tagged, not the agents\' recommendation');
  assert.strictEqual(tagged[0].querySelectorAll('.rectag')[0].className, 'rectag sug');
  assert.strictEqual(tagged[0].querySelectorAll('.rectag')[0].textContent, 'Suggested');
  assert.deepStrictEqual(rows.filter(r => /\bis-rec\b/.test(r.className)).map(valueOf), ['round']);
  const shown = card.querySelectorAll('.osec').filter(s => !s.hidden).map(s => s.getAttribute('aria-label'));
  assert.deepStrictEqual(shown, ['Round']);
});

test('clicking an option on a share card records the choice', async () => {
  const { html } = shareHtml();
  const { dom } = await run(html);
  const all = n => [n].concat(...(Array.isArray(n.children) ? n.children : []).map(all));
  const opt = all(dom.ctx.document.getElementById('app')).find(n => /\bopt\b/.test(n.className) && (n.listeners.click || []).length);
  assert.ok(opt, 'a card shows its options');
  assert.doesNotThrow(() => opt.listeners.click.forEach(f => f({})));
  const stored = JSON.parse(dom.store.get(storeKey(pageData(html))) || '{}');
  assert.ok(Object.values(stored).some(s => s && s.choice), JSON.stringify(stored));
});

test('a shared page\'s r key, help lines, evidence pane and accepts footer follow the reviewer\'s pick', () => {
  const html = composedTemplate();
  assert.match(html, /var rv = reviewShare \? reviewerSuggests\(data, c\.it\) : /);
  assert.match(html, /\['<kbd>r<\/kbd>', reviewShare \? L\('help\.sug'\) : L\('help\.rec'\)\]/);
  assert.match(html, /\['<kbd>a<\/kbd>', reviewShare \? L\('help\.acceptSug'\) : L\('help\.acceptAll'\)\]/);
  assert.match(html, /return reviewShare \? o\.value === sugFirst : o\.recommended;/);
});

test('a shared page\'s Accept takes the reviewer\'s picks only', () => {
  const html = composedTemplate();
  const src = html.slice(html.indexOf('function acceptRecommended'), html.indexOf('function decisionsBlock'));
  const { acceptRecommended } = vm.runInNewContext('function mootBy() { return false; }\n' + src + '\n({ acceptRecommended: acceptRecommended })');
  const items = [{ id: 'A', options: [{ value: 'x', recommended: true }, { value: 'y' }] }, { id: 'B', options: [{ value: 'x', recommended: true }, { value: 'y' }] }];
  const state = {};
  assert.strictEqual(acceptRecommended(items, state, it => (it.id === 'A' ? 'y' : null)), 1);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(state)), { A: { choice: 'y' } });
});

test('A9: on a review share the card\'s accepts sits in the trade-off of the reviewer\'s suggested option, not the recommended one', async () => {
  const file = writeGate(shareGate());
  const g = JSON.parse(fs.readFileSync(file, 'utf8'));
  g.decisions.find(d => d.id === 'F1').accepts = 'Cents round up.';
  const gf = writeGate(g), p = gf.replace(/\.gate\.json$/, '.share.txt');
  fs.writeFileSync(p, 'GATE SHARE\nF1 = round\n');
  assert.strictEqual(render(gf, '--share', '--preset=' + p).code, 0);
  const { dom } = await run(fs.readFileSync(gf.replace(/\.gate\.json$/, '.share.html'), 'utf8'));
  const all = n => [n].concat(...(Array.isArray(n.children) ? n.children : []).map(all));
  const secs = dom.ctx.document.getElementById('d-F1').querySelectorAll('.osec');
  const accepts = label => secs.filter(s => s.getAttribute('aria-label') === label).map(s => s.querySelectorAll('.tv').map(n => all(n).map(x => x.textContent || '').join(''))).flat();
  assert.deepStrictEqual(accepts('Round'), ['Cents round up.']);
  assert.deepStrictEqual(accepts('Keep floor'), [], 'the agents\' recommended option does not carry it');
});

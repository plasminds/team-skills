const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { render, acceptanceGate, writeAcceptance } = require('./helpers');

const TEMPLATE = fs.readFileSync(path.join(__dirname, '..', '..', 'skills', 'team-view', 'template.html'), 'utf8');
const region = (name, expose) => vm.runInNewContext(new RegExp('/\\*' + name + '-START\\*/([\\s\\S]*?)/\\*' + name + '-END\\*/').exec(TEMPLATE)[1] + '\n(' + expose + ')');

test('pageMode: an acceptance page decides nothing and opens on the business lens; other kinds are unchanged', () => {
  const pageMode = region('MODE', 'pageMode');
  const a = pageMode('acceptance');
  assert.strictEqual(a.decide, false);
  assert.strictEqual(a.lens, 'business');
  ['1', '9', 'Tab', 'Enter', 'u', 'r', 'n', 'a', 'c', 's'].forEach(k => assert.ok(a.blocked.includes(k), k + ' should do nothing'));
  ['l', 'b', 't', 'z', 'd', '/', '[', '?', 'ArrowDown'].forEach(k => assert.ok(!a.blocked.includes(k), k + ' should still work'));
  ['review', 'refactor', 'debate', 'plan', 'kickoff', 'decision', undefined].forEach(k => {
    assert.deepStrictEqual(JSON.parse(JSON.stringify(pageMode(k))), { decide: true, lens: 'both', blocked: [] });
  });
});

test('chrome: the acceptance labels exist in English and French', () => {
  const chrome = region('CHROME', '{ makeL: makeL }');
  const en = chrome.makeL('en'), fr = chrome.makeL('fr');
  const keys = ['kind.acceptance', 'list.cases', 'section.cases', 'meta.branch', 'card.kindCase', 'case.steps', 'case.expected', 'case.screens', 'case.unshown', 'case.how', 'case.files', 'case.data'];
  keys.forEach(k => { assert.notStrictEqual(en.L(k), k, 'en ' + k); assert.notStrictEqual(fr.L(k), k, 'fr ' + k); });
  assert.strictEqual(fr.L('kind.acceptance'), 'Recette');
  assert.strictEqual(fr.L('case.steps'), 'Ce qu\'on fait');
  assert.strictEqual(en.Lp('list.caseCount', 2), '2 cases');
  assert.strictEqual(fr.Lp('list.caseCount', 2), '2 cas');
});

test('the rendered acceptance page carries the mode, the case card and hides the decision chrome', () => {
  const file = writeAcceptance(acceptanceGate());
  assert.strictEqual(render(file).code, 0);
  const html = fs.readFileSync(file.replace(/\.gate\.json$/, '.html'), 'utf8');
  assert.ok(html.includes('.acceptance-mode .progress'));
  assert.ok(html.includes('function caseCard(it)'));
  assert.ok(html.includes("if (it.kind === 'case') return caseCard(it);"));
  assert.ok(html.includes("classList.add('acceptance-mode')"));
});

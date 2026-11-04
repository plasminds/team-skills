const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { RENDER } = require('./helpers');

const html = fs.readFileSync(path.join(path.dirname(RENDER), 'template.html'), 'utf8');
const src = html.slice(html.indexOf('/*SHARE-START*/'), html.indexOf('/*SHARE-END*/'));
const { shareChoices, shareBlock, shareDefault } = vm.runInNewContext(src + '\n({ shareChoices: shareChoices, shareBlock: shareBlock, shareDefault: shareDefault })');
const all = g => { const c = shareChoices(g); return Object.fromEntries(c.what.concat(c.where).map(x => [x.id, x])); };

test('shareChoices: link and review are unavailable until detected', () => {
  const c = all({});
  ['file', 'self', 'mail', 'slack'].forEach(id => assert.strictEqual(c[id].available, true, id));
  assert.strictEqual(c.link.available, false);
  assert.match(c.link.reason, /Artifact tool/);
  assert.strictEqual(c.review.available, false);
  assert.match(c.review.reason, /glab, gh/);
});

test('shareChoices: detection sets availability, label and reason', () => {
  let c = all({ review: { label: 'MR !12 (GitLab)' }, link: 'No Artifact tool in this session' });
  assert.strictEqual(c.review.available, true);
  assert.strictEqual(c.review.label, 'MR !12 (GitLab)');
  assert.strictEqual(c.link.available, false);
  assert.strictEqual(c.link.reason, 'No Artifact tool in this session');
  c = all({ link: true, review: 'gh is not logged in: run gh auth login' });
  assert.strictEqual(c.link.available, true);
  assert.strictEqual(c.review.available, false);
  assert.strictEqual(c.review.reason, 'gh is not logged in: run gh auth login');
  c = all({ mail: 'x' });
  ['file', 'self', 'mail', 'slack'].forEach(id => assert.strictEqual(c[id].available, true, id));
});

test('shareBlock retitles the block and adds as, via and to after the title', () => {
  const d = 'CEO DECISIONS — T\nrecord: x\nS1 = approve';
  assert.strictEqual(shareBlock(d, 'file', 'mail', '  marc@example.com \n '), 'CEO SHARE — T\nas: file\nvia: mail\nto: marc@example.com\nrecord: x\nS1 = approve');
  assert.strictEqual(shareBlock(d, 'link', 'slack', ''), 'CEO SHARE — T\nas: link\nvia: slack\nrecord: x\nS1 = approve');
  assert.strictEqual(shareBlock(d, 'file', 'self', 'marc'), 'CEO SHARE — T\nas: file\nvia: self\nrecord: x\nS1 = approve');
});

test('shareDefault: a review on the merge/pull request when it is available, else the file sent by hand', () => {
  assert.deepStrictEqual({ ...shareDefault(shareChoices({ review: { label: 'MR !12 (GitLab)' } })) }, { as: 'review', via: 'review' });
  assert.deepStrictEqual({ ...shareDefault(shareChoices({ review: 'gh is not logged in' })) }, { as: 'file', via: 'self' });
  assert.deepStrictEqual({ ...shareDefault(shareChoices({})) }, { as: 'file', via: 'self' });
});

test('shareChoices: the review share form follows the review route', () => {
  const on = shareChoices({ review: { label: 'MR !12 (GitLab)' } }).what.find(x => x.id === 'review');
  assert.strictEqual(on.available, true);
  assert.match(on.label, /MR !12 \(GitLab\)/);
  const off = shareChoices({}).what.find(x => x.id === 'review');
  assert.strictEqual(off.available, false);
  assert.match(off.reason, /glab, gh/);
  assert.match(shareChoices({ review: 'gh is not logged in' }).what.find(x => x.id === 'review').reason, /not logged in/);
});

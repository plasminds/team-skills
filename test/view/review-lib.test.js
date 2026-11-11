const test = require('node:test');
const { composedTemplate } = require('./helpers');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseDiff, loadReviewBuilder, buildReviewPayloads } = require('../../skills/team-view/lib/review');

const DIFF = [
  '--- a/src/a.js', '+++ b/src/a.js', '@@ -1,3 +1,4 @@', ' ctx', '+added', ' ctx2', ' ctx3',
  '--- a/src/b.js', '+++ b/src/b.js', '@@ -5,1 +5,1 @@', '-old', '+new', ''
].join('\n');

test('parseDiff maps new lines to old lines, null for added', () => {
  const d = parseDiff(DIFF);
  assert.deepStrictEqual([...d.keys()], ['src/a.js', 'src/b.js']);
  assert.deepStrictEqual([...d.get('src/a.js')], [[1, 1], [2, null], [3, 2], [4, 3]]);
  assert.deepStrictEqual([...d.get('src/b.js')], [[5, null]]);
});

test('parseDiff rejects non-text input', () => {
  assert.throws(() => parseDiff(undefined), /diff must be text/);
});

test('buildReviewPayloads (github) is pure and returns commit_id and comments', () => {
  const page = { items: [{ id: 'F1' }] };
  const buildReview = (p, items, state, inDiff, platform) => {
    assert.strictEqual(platform, 'github');
    return { body: 'body', comments: [{ id: 'F1', path: 'src/a.js', line: 2, body: 'c' }, { id: 'F2', path: 'src/a.js', line: 3, startLine: 2, body: 'd' }] };
  };
  const before = fs.readdirSync(process.cwd()).length;
  const r = buildReviewPayloads({ page, state: {}, buildReview, diff: parseDiff(DIFF), platform: 'github', head: 'abc1234' });
  assert.strictEqual(fs.readdirSync(process.cwd()).length, before);
  assert.strictEqual(r.github.commit_id, 'abc1234');
  assert.strictEqual(r.github.comments.length, 2);
  assert.deepStrictEqual(r.github.comments[1], { path: 'src/a.js', line: 3, side: 'RIGHT', body: 'd', start_line: 2, start_side: 'RIGHT' });
});

test('buildReviewPayloads throws on an over-long body; loadReviewBuilder needs a PROMPT block', () => {
  const buildReview = () => ({ body: 'x'.repeat(60001), comments: [] });
  assert.throws(() => buildReviewPayloads({ page: { items: [] }, buildReview, platform: 'github', head: 'abc1234' }), /the review body is 60001 characters/);
  assert.throws(() => loadReviewBuilder('<html></html>'), /PROMPT/);
  const tpl = composedTemplate();
  assert.strictEqual(typeof loadReviewBuilder(tpl), 'function');
});

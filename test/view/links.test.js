const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { writeGate, render, pageData } = require('./helpers');

const htmlOf = file => file.replace(/\.gate\.json$/, '.html');
const gate = (decisions, extra) => Object.assign({ kind: 'debate', title: 'G', decisions }, extra || {});
function ok(g) {
  const f = writeGate(g); const r = render(f);
  assert.strictEqual(r.code, 0, r.stderr);
  return pageData(fs.readFileSync(htmlOf(f), 'utf8'));
}
function fails(g, re) { const r = render(writeGate(g)); assert.notStrictEqual(r.code, 0); assert.match(r.stderr, re); }
const ids = data => data.items.map(it => it.id);
const byId = data => Object.fromEntries(data.items.map(it => [it.id, it]));

test('a card with "on" renders right after its root, a chain flat under the root', () => {
  const data = ok(gate([
    { id: 'D3', title: 'Transport' }, { id: 'X', title: 'Other' },
    { id: 'N7', title: 'Port too', on: { id: 'N6' } },
    { id: 'N6', title: 'Gate read once', on: { id: 'D3' } }
  ]));
  assert.deepStrictEqual(ids(data), ['D3', 'N6', 'N7', 'X']);
  assert.strictEqual(byId(data).N6.block, 'D3');
  assert.strictEqual(byId(data).N7.block, 'D3');
  assert.strictEqual(byId(data).D3.block, undefined);
});

test('a card never renders before what it comes after; otherwise the stakes order is kept', () => {
  const data = ok(gate([{ id: 'S2', title: 'Two', after: ['S1'] }, { id: 'S1', title: 'One' }, { id: 'S3', title: 'Three' }]));
  assert.deepStrictEqual(ids(data), ['S1', 'S2', 'S3']);
});

test('a gate without links keeps its order', () => {
  const data = ok(gate([{ id: 'B', title: 'b' }, { id: 'A', title: 'a' }], { tensions: [{ topic: 'T?', sides: [{ who: 'x', position: 'p' }, { who: 'y', position: 'q' }] }] }));
  assert.deepStrictEqual(ids(data), ['B', 'A', 'T1']);
});

test('a loop through after or on is rejected', () => {
  fails(gate([{ id: 'A', title: 'a', after: ['B'] }, { id: 'B', title: 'b', after: ['A'] }]), /loop/);
  fails(gate([{ id: 'A', title: 'a', on: { id: 'B' } }, { id: 'B', title: 'b', on: { id: 'A' } }]), /loop/);
});

test('"on" takes a known decision or tension and another id; a "rel" key is rejected', () => {
  fails(gate([{ id: 'A', title: 'a', on: 'B' }, { id: 'B', title: 'b' }]), /"A"\.on must be \{ "id", "when"\? \}/);
  fails(gate([{ id: 'A', title: 'a', on: { id: 'B', rel: 'likes' } }, { id: 'B', title: 'b' }]),
    /"A"\.on takes \{ "id", "when"\? \}: there is one relation — a card whose options the target's answer removes or forces is the same question: merge them into one card of coherent combinations/);
  fails(gate([{ id: 'A', title: 'a', on: { id: 'Z' } }]), /unknown id "Z"/);
  fails(gate([{ id: 'A', title: 'a', on: { id: 'A' } }]), /names itself/);
  fails(gate([{ id: 'A', title: 'a', on: { id: 'R1' } }], { rejected: [{ id: 'R1', title: 'r', reason: 'no' }] }), /rejected item "R1"/);
});

test('a minor card may sit in a weighty block; a minor root is rejected', () => {
  const data = ok(gate([{ id: 'D1', title: 'd' }, { id: 'M1', title: 'm', minor: true, default: 'approve', on: { id: 'D1' } }]));
  assert.strictEqual(byId(data).M1.block, 'D1');
  fails(gate([{ id: 'M0', title: 'm', minor: true, default: 'approve' }, { id: 'D1', title: 'd', on: { id: 'M0' } }]), /root is a weighty decision or a tension/);
});

test('a weighty card after a minor one is rejected', () => {
  fails(gate([{ id: 'S0', title: 't', minor: true, default: 'approve' }, { id: 'S1', title: 's', after: ['S0'] }]), /comes after minor "S0"/);
});

test('a decision after a tension is pointed to "on"', () => {
  fails(gate([{ id: 'D1', title: 'd', after: ['T1'] }], { tensions: [{ topic: 'T?', sides: [{ who: 'x', position: 'p' }, { who: 'y', position: 'q' }] }] }),
    /comes after tension \"T1\": put it in the tension's block with "on": \{ "id": "T1" \}/);
});

test('a needed card in a later decision group is rejected', () => {
  fails(gate([{ id: 'A1', title: 'a', group: 'First' }, { id: 'A2', title: 'b', group: 'First', after: ['B1'] }, { id: 'B1', title: 'c', group: 'Second' }]),
    /comes after "B1", which renders below it/);
});

test('settled items are pre-applied OK and reopenable', () => {
  const data = ok(gate([{ id: 'D1', title: 'd' }], { settled: [{ id: 'A1', title: 'Is the gate read per call?', answer: 'Per call', source: 'bridge.ts:40', who: 'Evidence' }] }));
  const a = byId(data).A1;
  assert.strictEqual(a.kind, 'settled');
  assert.strictEqual(a.default, 'ok');
  assert.deepStrictEqual(a.options.map(o => o.value), ['ok', 'reopen']);
  fails(gate([{ id: 'D1', title: 'd' }], { settled: [{ id: 'A1', title: 'q' }] }), /"answer", "source" and "who"/);
});

test('settled items take ok under --accept-recommended', () => {
  const f = writeGate(gate([{ id: 'D1', title: 'd' }], { settled: [{ id: 'A1', title: 'q', answer: 'a', source: 's', who: 'w' }] }));
  const r = render(f, '--accept-recommended');
  assert.strictEqual(r.code, 0, r.stderr);
  assert.match(r.stdout, /^A1 = ok$/m);
});

test('page-level constraints are rejected; item constraints bind their options', () => {
  const k = { id: 'K1', lens: 'tech', text: 'No new DB', source: 'CLAUDE.md:3', status: 'confirmed' };
  fails(gate([{ id: 'D1', title: 'd' }], { constraints: [k] }), /page-level "constraints" are not supported/);
  const data = ok(gate([{ id: 'D1', title: 'd', constraints: [k], options: [{ value: 'a', label: 'Keep', recommended: true }, { value: 'b', label: 'Add a DB', violates: ['K1'] }] }]));
  assert.strictEqual(data.constraints, undefined);
  assert.deepStrictEqual(byId(data).D1.bridge.map(x => x.id), ['K1']);
});

test('one constraint may be copied onto every card it binds; an option on either may violate it', () => {
  const k = { id: 'K1', lens: 'tech', text: 'No new DB', source: 'ADR-3', status: 'confirmed' };
  const opts = v => [{ value: 'a', label: 'Keep', recommended: true }, { value: 'b', label: 'Add a DB', violates: v }];
  const data = ok(gate([
    { id: 'D1', title: 'one', constraints: [k], options: opts(['K1']) },
    { id: 'D2', title: 'two', constraints: [Object.assign({}, k)], options: opts(['K1']) }
  ]));
  ['D1', 'D2'].forEach(id => assert.ok(JSON.stringify(byId(data)[id].bridge).includes('No new DB'), id));
});

test('copies of one constraint id that differ are rejected', () => {
  const k = { id: 'K1', lens: 'tech', text: 'No new DB', source: 'ADR-3', status: 'confirmed' };
  const two = other => gate([{ id: 'D1', title: 'one', constraints: [k] }, { id: 'D2', title: 'two', constraints: [Object.assign({}, k, other)] }]);
  fails(two({ text: 'No new queue' }), /"K1" differs/);
  fails(two({ status: 'assumed' }), /"K1" differs/);
  fails(two({ lens: 'business' }), /"K1" differs/);
});

test('the old name "needs" is read as "after"; both on one item is rejected', () => {
  const data = ok(gate([{ id: 'S2', title: 'Two', needs: ['S1'] }, { id: 'S1', title: 'One' }]));
  assert.deepStrictEqual(byId(data).S2.after, ['S1']);
  assert.strictEqual(byId(data).S2.needs, undefined);
  fails(gate([{ id: 'S2', title: 'Two', needs: ['S1'], after: ['S1'] }, { id: 'S1', title: 'One' }]),
    /"S2" has both "after" and its old name "needs" — keep "after"/);
});

test('"on.when" names options of the target; a valid one stays on the item', () => {
  const opts = [{ value: 'ws', label: 'WS' }, { value: 'hand', label: 'Hand' }];
  fails(gate([{ id: 'D1', title: 'd', options: opts }, { id: 'M3', title: 'm', on: { id: 'D1', when: ['zip'] } }]),
    /"M3"\.on\.when names "zip", not an option of "D1"/);
  const data = ok(gate([{ id: 'D1', title: 'd', options: opts }, { id: 'M3', title: 'm', on: { id: 'D1', when: ['ws'] } }]));
  assert.deepStrictEqual(byId(data).M3.on.when, ['ws']);
});

const errCount = (g, re) => { const r = render(writeGate(g)); assert.notStrictEqual(r.code, 0); return r.stderr.split('\n').filter(l => re.test(l)).length; };
const TENSION = { topic: 'T?', sides: [{ who: 'x', position: 'p' }, { who: 'y', position: 'q' }] };

test('a two-card "on" loop is reported once', () => {
  assert.strictEqual(errCount(gate([{ id: 'D1', title: 'a', on: { id: 'D2' } }, { id: 'D2', title: 'b', on: { id: 'D1' } }]), /point to each other/), 1);
});

test('a decision after a tension yields one error, the "on" one', () => {
  const g = gate([{ id: 'D1', title: 'd', after: ['T1'] }], { tensions: [TENSION] });
  assert.strictEqual(errCount(g, /^- /), 1);
  fails(g, /put it in the tension's block/);
});

test('a weighty card after a settled item names the fixed-section fix', () => {
  fails(gate([{ id: 'D1', title: 'd', after: ['A1'] }], { settled: [{ id: 'A1', title: 'q', answer: 'a', source: 's', who: 'w' }] }),
    /renders below it \(section "Settled without you"\): drop "minor" or "settled" on the card that others rely on/);
});

test('a constraint listed twice on one card is rejected', () => {
  const k = { id: 'K1', lens: 'tech', text: 'No new DB', source: 'CLAUDE.md:3', status: 'confirmed' };
  fails(gate([{ id: 'D1', title: 'd', constraints: [k, Object.assign({}, k)] }]), /constraint "K1" is listed twice on this card/);
});

test('an empty page-level constraints array binds nothing and is ignored', () => {
  ok(gate([{ id: 'D1', title: 'd' }], { constraints: [] }));
});

test('kind "council" still loads and is read as "debate"', () => {
  const data = ok(gate([{ id: 'D1', title: 'Transport' }], { kind: 'council' }));
  assert.strictEqual(data.kind, 'debate');
});

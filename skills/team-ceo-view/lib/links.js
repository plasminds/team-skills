// Linked cards. "on" puts a card in the block of the card it only makes sense within (one relation);
// "after" and "on" set the answering order: no card renders before what it relies on.
const UNLINKABLE = ['rejected', 'settled', 'question'];

// Stable topological order: each step takes the first id whose deps are all placed. A loop leaves ids unplaced.
function order(ids, depsOf) {
  const placed = new Set(), out = [], left = ids.slice();
  while (left.length) {
    const i = left.findIndex(id => depsOf(id).every(d => placed.has(d) || !ids.includes(d)));
    if (i < 0) return { order: out.concat(left), loop: left };
    placed.add(left[i]); out.push(left[i]); left.splice(i, 1);
  }
  return { order: out, loop: null };
}

// The section a card renders in, as template.html builds them: decision groups, then tensions, questions, minor, settled, rejected.
function sectionOf(it) {
  if (it.kind === 'tension') return 'Tensions';
  if (it.kind === 'question') return 'Questions for the author';
  if (it.kind === 'settled') return 'Settled without you';
  if (it.kind === 'rejected') return 'Considered and rejected';
  return it.minor ? 'Minor items' : 'group:' + (it.group || 'Decisions');
}
const FIXED = ['Tensions', 'Questions for the author', 'Minor items', 'Settled without you', 'Considered and rejected'];

// Validates "on", sets it.block (the root's id) on each linked card, and returns the items in answering order.
function linkItems(items, errors) {
  const byId = new Map(items.map(it => [it.id, it]));
  items.forEach(it => {
    if (it.on == null) return;
    const o = it.on;
    const bad = msg => { errors.push(msg); delete it.on; };
    if (o && typeof o === 'object' && 'rel' in o) return bad(`"${it.id}".on takes { "id", "when"? }: there is one relation — a card whose options the target's answer removes or forces is the same question: merge them into one card of coherent combinations`);
    if (!o || typeof o !== 'object' || Array.isArray(o) || typeof o.id !== 'string') return bad(`"${it.id}".on must be { "id", "when"? }`);
    if (UNLINKABLE.includes(it.kind)) return bad(`"${it.id}" is a ${it.kind} item: only decisions and tensions take "on"`);
    if (o.id === it.id) return bad(`"${it.id}".on names itself`);
    const target = byId.get(o.id);
    if (!target) return bad(`"${it.id}".on names unknown id "${o.id}"`);
    if (UNLINKABLE.includes(target.kind)) return bad(`"${it.id}".on names ${target.kind} item "${o.id}": a card is about a decision or a tension`);
    if (o.when != null) {
      const vals = (target.options || []).map(x => x.value);
      const w = Array.isArray(o.when) ? o.when : [o.when];
      const unknown = w.find(v => !vals.includes(v));
      if (unknown !== undefined) return bad(`"${it.id}".on.when names "${unknown}", not an option of "${o.id}"`);
    }
  });
  // A block's root: follow "on" to a card without one. A loop is reported once, not per member.
  const loops = new Set();
  items.forEach(it => {
    if (!it.on) return;
    const seen = new Set([it.id]);
    let cur = byId.get(it.on.id);
    while (cur.on && !seen.has(cur.id)) { seen.add(cur.id); cur = byId.get(cur.on.id); }
    if (cur.on) { const key = [...seen].sort().join(', '); if (!loops.has(key)) { loops.add(key); errors.push(`"${it.id}".on: cards ${[...seen].join(', ')} point to each other in a loop`); } return; }
    if (cur.minor) { errors.push(`"${it.id}".on leads to minor "${cur.id}": a block's root is a weighty decision or a tension`); return; }
    it.block = cur.id;
  });
  const reported = new Set();
  items.forEach(it => {
    (Array.isArray(it.after) ? it.after : []).forEach(n => {
      const dep = byId.get(n);
      if (!dep) return; // unknown ids: gate.js reports them
      if (it.kind !== 'rejected' && !it.minor && dep.minor) { errors.push(`"${it.id}" is weighty but comes after minor "${n}": a card others rely on is not minor — drop "minor" on "${n}"`); reported.add(it.id + '>' + n); }
      if (it.kind === 'decision' && dep.kind === 'tension') { errors.push(`decision "${it.id}" comes after tension "${n}": put it in the tension's block with "on": { "id": "${n}" }`); reported.add(it.id + '>' + n); }
    });
  });

  // What a card relies on, for ordering. A rejected item is never waited for: it renders last, revived or not.
  const depsOf = it => (Array.isArray(it.after) ? it.after : []).concat(it.on ? [it.on.id] : [])
    .filter(d => byId.has(d) && byId.get(d).kind !== 'rejected');
  const unitOf = id => byId.get(id).block || id;
  const roots = items.filter(it => !it.block).map(it => it.id);
  const members = root => [root].concat(items.filter(it => it.block === root).map(it => it.id));
  const units = order(roots, root => [...new Set([].concat(...members(root).map(id => depsOf(byId.get(id)).map(unitOf))))].filter(u => u !== root));
  if (units.loop) { errors.push(`cards ${units.loop.join(', ')} rely on each other in a loop (through "after" or "on"): the page cannot order them`); return items; }
  const sorted = [];
  for (const root of units.order) {
    const ids = members(root);
    const inner = order(ids, id => depsOf(byId.get(id)));
    if (inner.loop) { errors.push(`cards ${inner.loop.join(', ')} rely on each other in a loop (through "after" or "on"): the page cannot order them`); return items; }
    inner.order.forEach(id => sorted.push(byId.get(id)));
  }

  // Sections render in a fixed order, so a card it comes after, in a later section, would still show after it.
  const home = it => (it.block ? byId.get(it.block) : it);
  const groups = [];
  sorted.forEach(it => { const s = sectionOf(home(it)); if (!FIXED.includes(s) && !groups.includes(s)) groups.push(s); });
  const sectionRank = it => { const s = sectionOf(home(it)); return FIXED.includes(s) ? groups.length + FIXED.indexOf(s) : groups.indexOf(s); };
  sorted.forEach(it => {
    depsOf(it).forEach(d => {
      if (reported.has(it.id + '>' + d)) return;
      const dep = byId.get(d);
      if (sectionRank(dep) > sectionRank(it)) errors.push(`"${it.id}" comes after "${d}", which renders below it (section "${sectionOf(home(dep)).replace(/^group:/, '')}"): ${FIXED.includes(sectionOf(home(it))) || FIXED.includes(sectionOf(home(dep))) ? 'drop "minor" or "settled" on the card that others rely on' : 'put them in one group, or link them with "on"'}`);
    });
  });
  return sorted;
}

module.exports = { linkItems };

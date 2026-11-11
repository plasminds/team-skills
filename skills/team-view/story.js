/*STORY-START*/
  // The story on a debate page: the list's headless first section (context rows and weighty cards, in the order loadGate
  // computed), the context cards, and the recap the page appends. It shares the main script's closure. storyRows,
  // recapRows and storyView are pure and run alone in the tests, through these region markers.
  // One row per story id, depth from the "on" chain inside the order; a minor card that refines a card of the story
  // follows that card's named refinements, nested under it (minor: true, not a story id).
  function storyRows(data, items) {
    var byId = {}; items.forEach(function (it) { byId[it.id] = it; });
    var ctx = {}; (data.context || []).forEach(function (c) { ctx[c.id] = true; });
    var ids = data.story || (data.context || []).map(function (c) { return c.id; }).concat(items.filter(function (it) {
      return (it.kind === 'decision' && !it.minor) || it.kind === 'tension';
    }).map(function (it) { return it.id; }));
    var rows = [], at = {};
    // The row a card hangs under: follow "on" to the first card already in the list.
    function parentOf(it) {
      var seen = {}, p = it.on && byId[it.on.id]; seen[it.id] = true;
      while (p && !at[p.id] && p.on && !seen[p.id]) { seen[p.id] = true; p = byId[p.on.id]; }
      return p && at[p.id] ? p.id : null;
    }
    function descends(r, root) { for (var p = r.parent; p; p = at[p].parent) if (p === root) return true; return false; }
    // A card with no "on" hangs, dashed, under the first id of its "after" already in the list, when every row
    // between that parent and it descends from the parent; else it stays put and keeps its "Needs X first" word.
    function afterParent(it) {
      if (!it || it.on) return null;
      var a = (it.after || []).filter(function (x) { return at[x]; })[0];
      if (!a) return null;
      for (var i = rows.indexOf(at[a]) + 1; i < rows.length; i++) if (!descends(rows[i], a)) return null;
      return a;
    }
    ids.forEach(function (id) {
      var it = byId[id], parent = it ? parentOf(it) : null, kind = parent ? 'on' : null;
      if (!parent) { parent = afterParent(it); if (parent) kind = 'after'; }
      var row = { id: id, context: !it && !!ctx[id], depth: parent ? at[parent].depth + 1 : 0, parent: parent, kind: kind };
      rows.push(row); at[id] = row;
    });
    function hang(pid) {
      items.filter(function (it) { return it.kind === 'decision' && it.minor && it.on && it.on.id === pid && !at[it.id]; }).forEach(function (it) {
        var i = rows.indexOf(at[pid]) + 1;
        while (i < rows.length && descends(rows[i], pid)) i++;
        var row = { id: it.id, context: false, depth: at[pid].depth + 1, parent: pid, kind: 'on', minor: true };
        rows.splice(i, 0, row); at[it.id] = row;
        hang(it.id);
      });
    }
    ids.forEach(function (id) { if (at[id] && !at[id].context) hang(id); });
    return rows;
  }
  // One row per decision and tension, in the order given: its question, the recommended label, the chosen label.
  // suggests(it), when given (a review share), names the suggested option's value: it stands for the recommended one.
  function recapRows(items, state, mootBy, suggests) {
    return items.filter(function (it) { return it.kind === 'decision' || it.kind === 'tension'; }).map(function (it) {
      var opts = it.options || [], v = state[it.id] && state[it.id].choice, moot = mootBy(it, items, state), sv = suggests ? suggests(it) : null;
      var rec = opts.filter(function (o) { return suggests ? sv != null && o.value === sv : o.recommended; })[0], ch = opts.filter(function (o) { return o.value === v; })[0];
      return { id: it.id, title: it.title, rec: rec ? rec.label : null, choice: ch && !moot ? ch.label : null, status: moot ? 'moot' : ch ? 'decided' : 'open' };
    });
  }

  // The story block's view-model, for a card or a context row: up to 3 key numbers, one drawing (a context row's outcome
  // entry before its first figure), and one option row per option: its cost line (its cost, else a tension side's
  // position) and its Breaks badges (the card's constraints the option lifts).
  function storyView(it) {
    var bridge = it.bridge || [], sides = it.sides || [];
    return {
      keys: (it.metrics || []).filter(function (m) { return m.key; }).slice(0, 3),
      drawing: it.outcome != null ? { outcome: it.outcome } : (it.figures && it.figures[0]) || null,
      rows: (it.options || []).map(function (o) {
        var t = o.tradeoff || {};
        // A tension side's option takes the side's who as its value (gate.js).
        var side = it.kind === 'tension' ? sides.filter(function (s, j) { return String(s.who || 'side ' + (j + 1)).replace(/\|/g, '/') === o.value; })[0] : null;
        return {
          o: o, line: t.business || t.tech || (side && side.position) || null,
          breaks: (o.violates || []).map(function (id) { var k = bridge.filter(function (b) { return b.id === id; })[0]; return { id: id, text: k ? k.text : '' }; })
        };
      })
    };
  }

  // A card whose options are only labels: no option has a cost line, a Breaks badge, or anything of its own for the
  // evidence pane. It shows no option rows and no picker; the decide bar's own option buttons stay, as on the other page kinds.
  function bareOptions(it) {
    if (!(it.options || []).length) return false;
    var sv = storyView(it), fo = foldsOf(it).options;
    return sv.rows.every(function (r, i) { return !r.line && !r.breaks.length && !fo[i]; });
  }

  // What a card shows in its evidence pane: { card: whether it has anything for "The whole question" (the comparison
  // table when an option has a cost, numbers or a broken constraint, sides, numbers not shown large, figures past the
  // drawing, examples, code, brief, location, suggestion, accepts, constraints: a card with nothing else still has its pane),
  // options: one flag per option, whether it has anything of its own (an argument, a trade-off, numbers, examples, code,
  // figures, brief, accepts) }. A context row shows its numbers not shown large and figures not drawn; nothing more: the pane says so.
  function foldsOf(it) {
    function n(list) { return (list || []).length; }
    var rest = n(it.metrics) - storyView(it).keys.length;
    if (!it.options) return { card: rest > 0 || n(it.figures) > (it.outcome != null ? 0 : 1), options: [] };
    var code = !!(it.code && (it.code.before || it.code.after));
    return {
      card: !!(n(it.sides) || it.brief || (it.at && it.at.path) || it.suggestion || it.accepts || n(it.examples) || code ||
        rest > 0 || n(it.figures) > 1 || n(it.bridge) ||
        it.options.some(function (o) { return o.tradeoff || n(o.metrics) || n(o.violates); })),
      options: it.options.map(function (o) {
        var t = o.tradeoff || {};
        return !!(n(o.for) || n(o.against) || t.business || t.tech || n(o.examples) || o.code || n(o.metrics) ||
          n(o.figures) || (o.brief && !o.negative) || o.accepts);
      })
    };
  }

  // The evidence pane of a debate card, context row or recap: a labelled region, always shown, as on the other kinds.
  // Headed "Evidence" when no option picker heads it. Its scroll area is where the card puts its evidence.
  function evPane(id, head) {
    var ev = el('section', 'c-ev panel'), evb = el('div', 'ev-scroll scroll');
    ev.id = 'ev-' + id; ev.setAttribute('role', 'region'); ev.setAttribute('aria-label', L('card.evidenceFor', { id: id }));
    // The close control sits in the header, or in the picker's row when the picker heads the pane; closed, the pane is a
    // rail on the right whose one button reopens it (both are shown by the CSS only on a desktop debate page).
    var close = el('button', 'icon-btn evclose'); close.type = 'button'; close.title = L('ev.close'); close.setAttribute('aria-label', L('ev.close'));
    close.appendChild(icon('panel'));
    var rail = el('button', 'evrail'); rail.type = 'button'; rail.title = L('ev.open'); rail.setAttribute('aria-label', L('ev.open'));
    rail.appendChild(icon('panel')); rail.appendChild(el('span', null, L('ev.title')));
    close.addEventListener('click', function () { setEv('closed'); }); rail.addEventListener('click', function () { setEv('open'); });
    ev.appendChild(rail);
    if (head) { var eh = el('div', 'phead'); eh.appendChild(el('h2', null, L('ev.title'))); eh.appendChild(close); ev.appendChild(eh); }
    ev.appendChild(evb);
    return { ev: ev, evb: evb, close: close };
  }
  // The page part. A context card: its title, then the story block (why, detail, key numbers, drawing); its pane holds the
  // numbers not shown large and the figures not drawn, else one line. Nothing on it is decided: cards[id].it is null.
  function contextCard(row) {
    var c = el('article', 'card ctxcard scard'), main = el('section', 'c-main panel'), body = el('div', 'c-scroll scroll');
    c.id = 'd-' + row.id; main.setAttribute('role', 'region'); main.setAttribute('aria-labelledby', 'h-' + row.id);
    var h = el('div', 'ch'), ctitle = inline(el('h2', 'ctitle'), row.title); ctitle.id = 'h-' + row.id;
    ctitle.setAttribute('tabindex', '-1'); h.appendChild(ctitle);
    body.appendChild(h);
    var sv = storyView(row), pane = evPane(row.id, true);
    var head = storyHead(sv, row.why, row.detail);
    body.appendChild(head);
    if ((row.cases || []).length) {
      var cs = el('div', 'cases'), tones = [];
      row.cases.forEach(function (k) {
        var cd = el('div', 'case'), hd = el('div', 'case-hd');
        hd.appendChild(inline(el('h3'), k.title));
        if (k.tag) {
          var ti = tones.indexOf(k.tag); if (ti < 0) { tones.push(k.tag); ti = tones.length - 1; }
          hd.appendChild(el('span', 'ctag t' + Math.min(ti, 2), k.tag));
        }
        cd.appendChild(hd);
        if (k.figure) cd.appendChild(figures([k.figure]));
        cd.appendChild(inline(el('p'), k.text));
        cs.appendChild(cd);
      });
      head.appendChild(cs);
    }
    if ((row.facts || []).length) {
      var fs = el('div', 'facts');
      row.facts.forEach(function (f) {
        var fe = el('div', 'fact'); fe.appendChild(el('b', 'flabel', f.label)); fe.appendChild(inline(el('span', 'ftext'), f.text)); fs.appendChild(fe);
      });
      head.appendChild(fs);
    }
    // On an acceptance page the cover row holds the examples no case covers, after its facts.
    if (data.kind === 'acceptance' && data.context && row === data.context[0]) { var nrb = notReplayedBlock(); if (nrb) head.appendChild(nrb); }
    if (row.note) head.appendChild(inline(el('p', 'ctxnote'), row.note));
    if (foldsOf(row).card) {
      var rest = (row.metrics || []).filter(function (m) { return sv.keys.indexOf(m) < 0; });
      if (rest.length) { var mb = blk(pane.evb, null); rest.forEach(function (m) { mb.appendChild(metricRow(m)); }); }
      var extra = (row.figures || []).slice(row.outcome != null ? 0 : 1);
      if (extra.length) blk(pane.evb, null).appendChild(figures(extra));
    }
    var empty = !pane.evb.childNodes.length;
    if (empty) pane.evb.appendChild(el('p', 'ev-empty', L('ev.nothing')));
    main.appendChild(body); c.appendChild(main); c.appendChild(pane.ev);
    cards[row.id] = { it: null, card: c, buttons: [], note: null, ctitle: ctitle, body: body, ev: pane.ev, noEv: empty };
    return c;
  }
  // The recap card, the list's last row: one line per decision and tension in list order, refreshed by recapPaint();
  // each question title opens its card. Then Copy decisions.
  var recapLines = [];
  function recapItems() { var out = []; sections.forEach(function (sec) { out = out.concat(sec.items); }); return out; }
  function recapCard() {
    var c = el('article', 'card recapcard'), main = el('section', 'c-main panel'), body = el('div', 'c-scroll scroll');
    c.id = 'd-' + RECAP; main.setAttribute('role', 'region'); main.setAttribute('aria-labelledby', 'h-' + RECAP);
    var h = el('div', 'ch'), ctitle = el('h2', 'ctitle', L('story.recap')); ctitle.id = 'h-' + RECAP;
    h.appendChild(ctitle); body.appendChild(h);
    var wrap = el('div', 'tbox'), t = el('table', 'btable recap'), th = el('thead'), hr = el('tr'), tb = el('tbody');
    // A review share's recap names the reviewer's suggestion, as its option rows do.
    var colRec = reviewShare ? L('card.suggested') : L('story.colRec'), sug = reviewShare ? function (it) { return reviewerSuggests(data, it); } : null;
    ['', L('story.colQuestion'), colRec, L('story.colChoice')].forEach(function (x) { var cl = el('th', null, x); cl.setAttribute('scope', 'col'); hr.appendChild(cl); });
    th.appendChild(hr); t.appendChild(th);
    recapRows(recapItems(), state, mootBy, sug).forEach(function (r) {
      var tr = el('tr'), tq = el('td'), b = inline(el('button', 'recap-q'), r.title); b.type = 'button';
      b.setAttribute('aria-label', L('story.openAria', { id: r.id, title: plainTitle(r.id) }));
      b.addEventListener('click', function () { pick(r.id); });
      tq.appendChild(b);
      var trc = r.rec != null ? inline(el('td'), r.rec) : el('td', 'muted', '—'), tch = el('td');
      tq.setAttribute('data-l', L('story.colQuestion')); trc.setAttribute('data-l', colRec);
      tr.appendChild(el('td', 'rid', r.id)); tr.appendChild(tq); tr.appendChild(trc); tr.appendChild(tch); tb.appendChild(tr);
      recapLines.push({ id: r.id, tr: tr, td: tch });
    });
    t.appendChild(tb); wrap.appendChild(t); body.appendChild(wrap);
    var copy = el('button', 'btn primary story-copy', L('bar.copy')); copy.type = 'button';
    copy.addEventListener('click', function () { document.getElementById('copy').click(); });
    body.appendChild(copy);
    var pane = evPane(RECAP, true);
    pane.evb.appendChild(el('p', 'ev-empty', L('ev.nothing')));
    main.appendChild(body); c.appendChild(main); c.appendChild(pane.ev);
    cards[RECAP] = { it: null, card: c, buttons: [], note: null, ctitle: ctitle, ev: pane.ev, noEv: true };
    return c;
  }
  // Called by render(): the recap follows every choice.
  function recapPaint() {
    var byId = {};
    recapRows(recapItems(), state, mootBy).forEach(function (r) { byId[r.id] = r; });
    recapLines.forEach(function (x) {
      var r = byId[x.id], td = r.choice != null ? inline(el('td', 'story-ch'), r.choice) : el('td', 'story-ch ' + (r.status === 'moot' ? 'moot' : 'todo'), r.status === 'moot' ? L('row.notNeeded') : L('row.toDecide'));
      td.setAttribute('data-l', L('story.colChoice'));
      x.tr.insertBefore(td, x.td); x.tr.removeChild(x.td); x.td = td;
    });
  }
/*STORY-END*/

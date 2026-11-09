// Building the page object and injecting it into template.html.
const crypto = require('crypto');

// Both pages keep the briefs: the evidence pane shows how each option gets done, which weighs on the choice.
function buildPage({ data, items, outcome, preset, channels, share: SHARE }) {
  // lang drives every page's chrome and prompt text, local gates too.
  const page = { kind: data.kind === 'council' ? 'debate' : data.kind, title: data.title, date: data.date, source: data.source, summary: data.summary, outcome, figures: data.figures || [], items, lang: data.lang || 'en' };
  // An acceptance page names what it presents: the branch and its head.
  if (page.kind === 'acceptance') Object.assign(page, { branch: data.branch, commit: data.commit });
  if (SHARE) {
    Object.assign(page, { mode: 'share', preamble: data.preamble }, preset ? { preset } : {});
    delete page.source; // a path in the sharer's repo
  }
  // Content hash: saved browser state is keyed by it, so an edited gate starts with fresh decisions.
  page._rev = crypto.createHash('sha1').update(JSON.stringify(page)).digest('hex').slice(0, 12);
  if (channels) page.channels = channels; // after _rev: channel detection must not reset saved choices
  return page;
}

function renderHtml(page, template, { share: SHARE, title }) {
  // Escape "<" so "</script>" or "<!--" inside the data cannot break out of the script element.
  const json = JSON.stringify(page).replace(/</g, '\\u003c');
  let html = template.replace('<!--GATE_DATA-->', () => `<script type="application/json" id="gate-data">${json}</script>`);
  // <html lang> and <title> at render time.
  // The chrome is English unless the gate says fr; the " · Gate" suffix is the same word in both languages.
  html = html.replace(/<html lang="[^"]*">/, () => `<html lang="${page.lang === 'fr' ? 'fr' : 'en'}">`);
  // A shared page and an acceptance page are documents, not gates: no " · Gate" suffix.
  return titled(html, SHARE || page.kind === 'acceptance' ? title : title + ' · Gate');
}

// The page names the gate in its <title>: the reader's tab shows it.
function titled(html, title) {
  const esc = String(title).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return html.replace(/<title>[^<]*<\/title>/, () => `<title>${esc}</title>`);
}

module.exports = { buildPage, renderHtml };

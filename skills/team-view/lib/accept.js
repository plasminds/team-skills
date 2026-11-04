// --accept-recommended: the decisions block the page would send after "Accept recommended", built without a browser.
// Runs the page's own acceptRecommended and decisionsBlock (template.html, PROMPT block) so the two cannot drift.
const vm = require('vm');

function acceptedBlock(page, templateText) {
  const m = String(templateText).match(/\/\*PROMPT-START\*\/([\s\S]*?)\/\*PROMPT-END\*\//);
  if (!m) throw new Error('template has no PROMPT block');
  const fns = vm.runInNewContext(m[1] + '\n({ acceptRecommended: acceptRecommended, decisionsBlock: decisionsBlock })');
  const state = {};
  fns.acceptRecommended(page.items, state);
  return fns.decisionsBlock(page, page.items, state, 'auto-accept');
}

module.exports = { acceptedBlock };

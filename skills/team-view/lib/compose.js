'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Composes the gate page text: template.html with its style, tokens, chrome and story inlined through
// /*NAME*/ markers. Each file goes in minus one trailing newline.
function composeTemplate(dir) {
  let template = fs.readFileSync(path.join(dir, 'template.html'), 'utf8');
  for (const [marker, file] of [['STYLE', 'style.css'], ['TOKENS', 'tokens.css'], ['CHROME', 'chrome.js'], ['STORY', 'story.js']]) {
    if (!template.includes('/*' + marker + '*/')) throw new Error('template.html has no /*' + marker + '*/ marker');
    template = template.replace('/*' + marker + '*/', () => fs.readFileSync(path.join(dir, file), 'utf8').replace(/\n$/, ''));
  }
  return template;
}

module.exports = { composeTemplate };

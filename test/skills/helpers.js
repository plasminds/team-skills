const fs = require('node:fs');
const path = require('node:path');

function listMd(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listMd(p, out);
    else if (p.endsWith('.md')) out.push(p);
  }
  return out;
}

module.exports = { listMd };

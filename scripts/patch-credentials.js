const fs = require('fs');
const p = require('path').join(__dirname, '../src/lib/db.client.ts');
let c = fs.readFileSync(p, 'utf8');
c = c.replace(/await fetch\(([\s\S]*?)\{(\s*)method:/g, (m, a, sp) => {
  if (m.includes('credentials')) return m;
  return `await fetch(${a}{${sp}credentials: 'include',${sp}method:`;
});
c = c.replace(
  /fetch\(\s*`([^`]+)`\s*,\s*\{\s*method:\s*'DELETE'\s*\}\s*\)/g,
  "fetch(`$1`, { method: 'DELETE', credentials: 'include' })"
);
c = c.replace(
  /fetch\(\s*'(\/api\/[^']+)'\s*,\s*\{\s*method:\s*'DELETE'\s*\}\s*\)/g,
  "fetch('$1', { method: 'DELETE', credentials: 'include' })"
);
c = c.replace(
  /const res = await fetch\(\s*`(\/api\/favorites[^`]*)`\s*\);/g,
  "const res = await fetch(`$1`, { credentials: 'include' });"
);
fs.writeFileSync(p, c);
console.log('credentials count', (c.match(/credentials: 'include'/g) || []).length);

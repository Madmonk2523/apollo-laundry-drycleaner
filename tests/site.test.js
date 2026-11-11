const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
test('every document ID is unique', () => {
 const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
 assert.equal(new Set(ids).size, ids.length);
});
test('local navigation anchors resolve', () => {
 for (const [,id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(html.includes(`id="${id}"`), id);
});
test('request-flow DOM hooks remain available', () => {
 for (const [,id] of js.matchAll(/\$\('#([a-zA-Z][\w-]*)'\)/g)) {
  if(id === 'heroRotate') continue; // Optional old animated headline.
  assert.ok(html.includes(`id="${id}"`), `Missing ${id}`);
 }
});
test('Google links preserve supplied destination with safe new tabs', () => {
 const links = [...html.matchAll(/<a[^>]*href="https:\/\/share.google\/LdoeEbqq3bSOVXh8D"[^>]*>/g)];
 assert.ok(links.length >= 2);
 links.forEach(([a]) => { assert.match(a, /rel="noopener noreferrer"/); assert.match(a, /target="_blank"/); });
});
test('verified Google details are present without fabricated structured ratings or images', () => {
 assert.match(html, /137 Franklin/);
 assert.match(html, /tel:\+19292646070/);
 assert.doesNotMatch(html, /4\.8|rating-summary|12 Google reviews|aggregateRating|reviewRating/);
 assert.match(html, /Albert Diaz/);
 assert.match(html, /Madeline Landon/);
 assert.match(html, /Two complete customer reviews/);
 assert.match(html, /class="machine-drum"/);
 assert.match(html, /class="ticker-track"/);
 assert.doesNotMatch(html, /aggregateRating|reviewRating/);
 assert.doesNotMatch(html, /<img\b/);
 assert.doesNotMatch(html, /—/);
});

test('restored animation and responsive rules remain intact', () => {
 const css = fs.readFileSync(path.join(__dirname, '../styles.css'), 'utf8');
 for (const name of ['machineFloat','drumRotate','ticker']) assert.ok(css.includes('@keyframes '+name));
 assert.match(css, /prefers-reduced-motion:reduce/);
 assert.match(css, /animation-duration:\.01ms!important/);
 assert.match(css, /@media\(max-width:700px\)/);
 assert.match(css, /review-grid-public\{grid-template-columns:1fr/);
 assert.doesNotMatch(css, /Editorial refresh/);
});

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
test('no invented ratings, testimonials, photos or unsupported local claims', () => {
 assert.doesNotMatch(html, /aggregateRating|reviewRating|137 Franklin|929.264.6070|4\.8|12 reviews/);
 assert.doesNotMatch(html, /<img\b/);
 assert.doesNotMatch(html, /—/);
});

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
test('Maps, directions and reviews link to the exact Apollo location', () => {
 const links = [...html.matchAll(/<a[^>]* href="([^"]+)"[^>]*>[^<]*(?:Maps|reviews|review)<\/a>/gi)]
  .filter(([,url]) => url.startsWith('https://'));
 assert.ok(links.length >= 4);
 assert.doesNotMatch(html, /share\.google/);
 for (const [tag,href] of links) {
  const url = new URL(href.replaceAll('&amp;','&'));
  assert.ok(['www.google.com','search.google.com'].includes(url.hostname));
  assert.match(url.search, /(?:query_place_id|destination_place_id|placeid)=ChIJeR9JFABZwokRPAYUQ04H4ao/);
  assert.match(tag, /rel="noopener noreferrer"/);
 }
 assert.match(html, /\/maps\/dir\/\?api=1/);
 assert.match(html, /\/local\/writereview\?placeid=/);
});

test('page displays Google review snapshot without marking up its own reviews', () => {
 assert.match(html, /4\.8 out of 5/);
 assert.match(html, /12 Google reviews/);
 assert.match(html, /Allan Sachs-Ambia, Google review excerpt/);
 assert.match(html, /You will have sparkling clean laundry\./);
 assert.doesNotMatch(html, /aggregateRating|reviewRating|review-carousel/);
 assert.match(html, /class="machine-drum"/);
 assert.match(html, /class="ticker-track"/);
});

test('LocalBusiness facts and raster social preview are consistent', () => {
 const jsonld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
 assert.equal(jsonld['@type'], 'LocalBusiness');
 assert.equal(jsonld.address.streetAddress, '137 Franklin Street');
 assert.equal(jsonld.telephone, '+1-929-264-6070');
 assert.equal(jsonld.openingHoursSpecification.dayOfWeek.length, 7);
 assert.equal(jsonld.openingHoursSpecification.opens, '07:00');
 assert.equal(jsonld.openingHoursSpecification.closes, '22:00');
 const url = new URL(html.match(/property="og:image" content="([^"]+)"/)[1]);
 assert.equal(jsonld.image, url.href);
 assert.equal(url.pathname, '/assets/social-preview.jpg');
 const jpeg = fs.readFileSync(path.join(__dirname, '..', url.pathname));
 assert.deepEqual([...jpeg.subarray(0, 3)], [255, 216, 255]);
});

test('published price describes only regular laundry', () => {
 assert.match(html, /\$1\.50 per pound/);
 assert.doesNotMatch(html, /\$15\b|free local pickup/i);
});

test('restored animation and responsive rules remain intact', () => {
 const css = fs.readFileSync(path.join(__dirname, '../styles.css'), 'utf8');
 for (const name of ['machineFloat','drumRotate','ticker']) assert.ok(css.includes('@keyframes '+name));
 assert.match(css, /prefers-reduced-motion:reduce/);
 assert.match(css, /animation-duration:\.01ms!important/);
 assert.match(css, /@media\(max-width:700px\)/);
 assert.match(css, /google-reviews\{grid-template-columns:1fr/);
 assert.doesNotMatch(css, /Editorial refresh/);
});

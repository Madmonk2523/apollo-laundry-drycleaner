const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = filename => fs.readFileSync(path.resolve(__dirname, '..', filename), 'utf8');

test('deprecated service wording is absent from public copy and code', () => {
  for (const filename of ['index.html','app.js','api/request.js','README.md']) {
    assert.doesNotMatch(read(filename), /wash\s*(?:&|and)\s*fold/i, filename);
  }
});

test('pickup form options match API supported values', () => {
  const html = read('index.html');
  const api = read('api/request.js');
  assert.doesNotMatch(html,/value="(?:Not sure yet|Everyday laundry)"/);
  for (const label of ['Laundry', 'Dry cleaning','Laundry and dry cleaning']) {
    assert.ok(html.includes('value="' + label + '"'), 'missing form label: ' + label);
    assert.ok(api.includes("'" + label + "'"), 'missing server service: ' + label);
  }
});

test('rotating headline preserves accessible text and respects reduced-motion preference', () => {
  const html = read('index.html');
  const js = read('app.js');
  const css = read('styles.css');
  assert.match(html, /id="heroRotate"[^>]+aria-hidden="true"/);
  assert.match(html, /<span class="sr-only">Laundry and dry cleaning\.<\/span>/);
  assert.match(js, /if \(rotatingHeadline && motionOK\)/);
  for(const term of ['Laundry care.','Dry cleaning.','Garment care.'])assert.ok(js.includes(term));
  assert.match(css, /hero-rotating-text\.is-exiting/);
});

test('request form asks for required email and phone without retired questions', () => {
 const html = read('index.html');
 const js = read('app.js');
 assert.doesNotMatch(html, /name="(?:quantity|contactMethod)"|HOW MUCH LAUNDRY|HOW SHOULD WE CONTACT YOU/i);
 assert.doesNotMatch(js, /'quantity'|'contactMethod'/);
 assert.match(html, /id="email"[^>]*type="email"[^>]*aria-describedby="replyByEmail"[^>]* required/);
 assert.match(html, /id="phone"[^>]*type="tel"[^>]* required/);
 const details = html.split('data-step="1"')[1];
 assert.ok(details.indexOf('tel:+19292646070') < details.indexOf('id="firstName"'));
 assert.match(details, /follow up by email/);
});

test('the published page and client present address eligibility without distance details', () => {
 for (const filename of ['index.html','app.js']) {
  assert.doesNotMatch(read(filename), /\b3[ -]mile|straight[ -]line|how far|too far|distance calculations|location tracking/i);
 }
 assert.match(read('index.html'), /Choose a matching street address to check availability\./);
 assert.match(read('index.html'), /call \(929\) 264-6070/i);
});

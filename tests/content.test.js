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
  for (const label of ['Everyday laundry', 'Dry cleaning','Laundry and dry cleaning','Not sure yet']) {
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

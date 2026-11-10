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

test('static headline is visible and no automatic headline timer runs', () => {
  const html = read('index.html'); const js = read('app.js');
  assert.match(html, /<h1 id="heroTitle">Laundry, taken/);
  assert.doesNotMatch(html, /id="heroRotate"/);
  assert.doesNotMatch(js, /window.setInterval/);
});

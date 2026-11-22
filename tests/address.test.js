const test = require('node:test');
const assert = require('node:assert/strict');
const { directory,makeDirectory,miles,OUTSIDE } = require('../lib/service-area');
const handler = require('../api/address');

test('three straight-line miles are inclusive without a rounded-distance display', () => {
  const at = 180 / Math.PI * 3 * 1609.344 / 6371008.8;
  const service = makeDirectory({shopPointId:100,rows:[
    [100,'1','TEST ST','11222',3,0,0],
    [101,'2','TEST ST','11222',3,at - .0000001,0],
    [102,'3','TEST ST','11222',3,at,0],
    [103,'4','TEST ST','11222',3,at + .0000001,0]
  ]});
  assert.equal(miles([0,0],[at,0]),3);
  assert.equal(service.resolve('101').eligible,true);
  assert.equal(service.resolve('102').eligible,true);
  assert.equal(service.resolve('103').eligible,false);
});
test('believable but ambiguous duplicate building locations are unresolved', () => {
  const service = makeDirectory({shopPointId:100,rows:[
    [100,'1','TEST ST','11222',3,0,0],
    [101,'2','TEST ST','11222',3,0,.01],
    [102,'2','TEST ST','11222',3,0,.1],
  ]});
  assert.equal(service.resolve('101'),null);
  assert.equal(service.resolve('102'),null);
  assert.deepEqual(service.suggest('2 Test'),[]);
});
test('NYC snapshot matches exact street with city and ZIP, and separates same names', () => {
  const d = directory();
  assert.deepEqual(d.storefront,[40.730974293023,-73.957917984047]);
  const all = d.suggest('137 Franklin St');
  assert.ok(all.length >= 2);
  assert.ok(all.some(a => a.city === 'Brooklyn'));
  assert.ok(all.some(a => a.city === 'Manhattan'));
  assert.deepEqual(d.suggest('137 Franklin Street Apt 2B, Brooklyn, NY 11222'), [{id:'1232477',street:'137 Franklin St',city:'Brooklyn',zip:'11222'}]);
  assert.deepEqual(d.suggest('137 Franklin Street, Brooklyn, NY 10013'), []);
  assert.deepEqual(d.suggest('137 Franklin St, Jersey City, NJ 07302'), []);
  assert.equal(d.suggest('11–21 46th Avenue Queens')[0]?.zip,'11101');
  assert.equal(d.resolve('9999999999'),null);
});
async function invoke(body,method='POST',headers={'content-type':'application/json'}) {
  const res = {setHeader(){}, status(n){this.code=n;return this;},json(payload){this.payload=payload;return this;}};
  await handler({body,method,headers},res);
  return res;
}
test('address transport distinguishes outside, unknown, malformed, and eligible without email', async () => {
  const outside = await invoke({id:'1598365'});
  assert.equal(outside.code,422);
  assert.equal(outside.payload.error,OUTSIDE);
  const invalid = await invoke({id:'000'});
  assert.equal(invalid.code,422);
  assert.match(invalid.payload.error,/couldn’t verify/);
  const allowed = await invoke({id:'1232477'});
  assert.equal(allowed.code,200);
  assert.equal(allowed.payload.address.eligible,true);
  const suggestions = await invoke({query:'10 E 95th St, Manhattan'});
  assert.equal(suggestions.code,200);
  assert.equal(suggestions.payload.suggestions[0].id,'1598365');
  assert.equal('eligible' in suggestions.payload.suggestions[0],false);
  assert.equal((await invoke({id:'1232477',query:'both'})).code,400);
  assert.equal((await invoke({},'GET')).code,405);
  assert.equal((await invoke({},'POST',{})).code,415);
  assert.equal((await invoke({},'POST',{'content-type':'application/json','content-length':'4096'})).code,413);
});

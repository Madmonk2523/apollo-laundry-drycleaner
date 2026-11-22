const {JSDOM} = require('jsdom');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const addressApi = require('../api/address');
const root = path.resolve(__dirname, '..');
const dom = new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{
  url:'https://apollo-test.invalid/',runScripts:'outside-only',pretendToBeVisual:true
});
const w = dom.window, d = w.document;
w.matchMedia = () => ({matches:true});
w.HTMLElement.prototype.scrollTo = function(){};
w.HTMLElement.prototype.scrollIntoView = function(){};
w.HTMLElement.prototype.getClientRects = function(){return this.closest('.hidden') || this.hidden ? [] : [{}];};
const $ = s => d.querySelector(s);
const click = s => $(s).click();
const focus = s => $(s).focus();
const key = (s,key,opts={}) => $(s).dispatchEvent(new w.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...opts}));
function fill(s,value) {
  $(s).value = value;
  $(s).dispatchEvent(new w.Event('input',{bubbles:true}));
  $(s).dispatchEvent(new w.Event('change',{bubbles:true}));
}
const delay = (ms=8) => new Promise(r => setTimeout(r,ms));
const requests = [];
let requestReply = {success:true,reference:'TEST-001'};
let requestStatus = 200;
let addressOverride;
w.fetch = async (url,init) => {
  const body = JSON.parse(init.body);
  if (url === '/api/address') {
    if (addressOverride) return addressOverride(body);
    const res = {setHeader(){},status(n){this.n=n;return this;},json(data){this.data=data;return this;}};
    await addressApi({method:'POST',headers:{'content-type':'application/json'},body},res);
    return {ok:res.n === 200,status:res.n,json:async()=>res.data};
  }
  assert.equal(url,'/api/request');
  requests.push(body);
  return {ok:requestStatus === 200,status:requestStatus,json:async()=>requestReply};
};
w.eval(fs.readFileSync(path.join(root,'app.js'),'utf8'));

const open = (type='pickup') => click(`.hero-buttons [data-type="${type}"]`);
const close = () => click('#modalClose');
const currentStep = () => Number($('.form-step:not(.hidden)').dataset.step);
const fillDetails = () => {
  fill('#requestedDate',$('#requestedDate').min);
  fill('#timeWindow','Morning');
  fill('#firstName','Test');
  fill('#lastName','User');
  fill('#email','test@example.invalid');
  fill('#phone','2025550101');
  $('#contactConsent').checked = true;
};
async function typedSearch(query) {
  focus('#address'); fill('#address',query);
  await delay(305);
}
async function selectWithPointer(query,index=0) {
  await typedSearch(query);
  click(`#address-option-${index}`);
  click('#formNext');
  await delay();
}

(async () => {
  open();
  assert.equal(currentStep(),0);
  click('#formNext');
  assert.match($('#formError').textContent,/street address/);
  assert.equal(d.activeElement.id,'address');
  await typedSearch('137 Franklin St Apt 2B, Brooklyn, NY 11222');
  assert.equal($('#address').getAttribute('aria-expanded'),'true');
  assert.equal($('#addressOptions').children.length,1);
  key('#address','ArrowDown');
  assert.equal($('#address').getAttribute('aria-activedescendant'),'address-option-0');
  key('#address','Escape');
  assert.equal($('#address').getAttribute('aria-expanded'),'false');
  assert.equal($('#requestModal').getAttribute('aria-hidden'),'false');
  key('#address','Enter'); await delay();
  key('#address','ArrowDown'); key('#address','Enter');
  assert.equal($('#unit').value,'2B');
  key('#address','Enter'); await delay();
  assert.equal(currentStep(),1);
  assert.match($('#verifiedAddress').textContent,/2B/);
  assert.equal(d.activeElement.id,'modalTitle');
  click('#formSubmit');
  assert.match($('#formError').textContent,/cleaning service/);
  fill('#service','Laundry'); fillDetails();
  assert.match($('#requestSummary').textContent,/Follow-up emailtest@example\.invalid/);
  assert.equal($('#quantity'),null);
  assert.equal($('#contactMethod'),null);
  assert.match($('#replyByEmail').textContent,/follow up by email/);
  assert.ok($('.form-step[data-step="1"] .address-fallback a').href.startsWith('tel:'));
  click('#formSubmit'); await delay();
  assert.equal(requests.length,1);
  assert.equal(requests[0].addressId,'1232477');
  assert.equal(requests[0].service,'Laundry');
  assert.equal(requests[0].unit,'2B');
  assert.equal('quantity' in requests[0],false);
  assert.equal('contactMethod' in requests[0],false);
  assert.equal($('#successReference').textContent,'TEST-001');
  click('#successClose');

  open('delivery');
  assert.equal($('#service').required,false);
  await selectWithPointer('10 E 95th St, Manhattan');
  assert.equal(currentStep(),0);
  assert.equal($('#formError').textContent,'You are too far from our location to do Pickup or Delivery.');
  assert.equal(requests.length,1);
  await typedSearch('9999999 Phony Street');
  assert.match($('#addressStatus').textContent,/No matching address/);
  assert.equal($('#formError').hidden,true);
  assert.ok($('.address-fallback a').href.startsWith('tel:'));
  await selectWithPointer('137 Franklin St, Brooklyn');
  assert.equal(currentStep(),1);
  fillDetails();
  click('#formBack');
  assert.equal(currentStep(),0);
  assert.match($('#address').value,/Brooklyn/);
  fill('#unit','5-A');
  // A different address invalidates the selection, while details and unit can still be edited.
  await typedSearch('100 Broadway, Manhattan');
  click('#formNext'); await delay();
  assert.equal(currentStep(),0);
  assert.equal(requests.length,1);
  key('#address','Enter'); click('#formNext'); await delay();
  assert.match($('#formError').textContent,/too far/);
  await selectWithPointer('100 Broadway, Brooklyn');
  assert.equal(currentStep(),1);
  assert.equal($('#firstName').value,'Test');
  assert.match($('#verifiedAddress').textContent,/5-A/);
  click('#formSubmit'); await delay();
  assert.equal(requests.length,2);
  assert.equal(requests[1].requestType,'delivery');
  assert.equal(requests[1].orderNumber,'');
  assert.equal(requests[1].unit,'5-A');
  click('#successClose');

  // Late replies must never restore obsolete suggestions or advance a changed or closed form.
  open();
  let complete;
  addressOverride = body => new Promise(resolve => { complete = resolve; });
  await typedSearch('137 Franklin St');
  fill('#address','');
  complete({ok:true,json:async()=>({suggestions:[{id:'1232477',street:'137 Franklin St',city:'Brooklyn',zip:'11222'}]})});
  await delay();
  assert.equal($('#addressOptions').hidden,true);
  addressOverride = undefined;
  await typedSearch('137 Franklin St, Brooklyn');
  click('#address-option-0');
  addressOverride = () => new Promise(resolve => { complete = resolve; });
  click('#formNext');
  close(); open();
  complete({ok:true,json:async()=>({address:{id:'1232477',street:'137 Franklin St',city:'Brooklyn',zip:'11222',eligible:true}})});
  await delay();
  assert.equal(currentStep(),0);
  assert.equal($('#address').value,'');
  assert.equal($('#unit').value,'');
  assert.equal($('#formNext').disabled,false);
  addressOverride = async () => ({ok:false,status:503,json:async()=>({})});
  await typedSearch('137 Franklin St');
  assert.match($('#addressStatus').textContent,/couldn’t verify/);
  addressOverride = undefined;
  await selectWithPointer('137 Franklin St, Brooklyn');
  fill('#service','Dry cleaning'); fillDetails();
  requestStatus = 503; requestReply = {};
  click('#formSubmit'); await delay();
  assert.match($('#formError').textContent,/not active yet/);
  assert.equal($('#formError a').href,'tel:+19292646070');
  assert.equal($('#formSubmit').disabled,false);
  requestStatus = 422; requestReply = {code:'address_unknown',error:'Choose and check your current street address again.'};
  click('#formSubmit'); await delay();
  assert.equal(currentStep(),0);
  assert.match($('#formError').textContent,/current street address/);
  key('#address','Escape');
  assert.equal($('#requestModal').getAttribute('aria-hidden'),'true');

  click('#menuToggle'); assert.equal($('#menuToggle').getAttribute('aria-expanded'),'true');
  click('#navLinks a'); assert.equal($('#menuToggle').getAttribute('aria-expanded'),'false');
  const slides = [...d.querySelectorAll('.review-slide')];
  assert.equal(slides.length,5);
  assert.equal(slides[0].hidden,false);
  click('#reviewNext'); assert.equal(slides[1].hidden,false);
  for(let i=0;i<4;i++) click('#reviewNext');
  assert.equal(slides[0].hidden,false);
  click('#reviewPrevious'); assert.equal(slides[4].hidden,false);
  console.log('PASS: keyboard/pointer address selection, Escape dismissal, unit paste, outside/unknown/down, stale replies, back/edit/reopen, pickup/delivery, server rejection, retry, menu and reviews. Existing email transport mocked.');
  w.close();
})().catch(error => { console.error(error); w.close(); process.exitCode = 1; });

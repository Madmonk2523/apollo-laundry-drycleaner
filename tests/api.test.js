const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/request');
const originalFetch = global.fetch;
const originalEnv = {
 RESEND_API_KEY: process.env.RESEND_API_KEY,
 APOLLO_REQUEST_EMAIL: process.env.APOLLO_REQUEST_EMAIL,
 APOLLO_FROM_EMAIL: process.env.APOLLO_FROM_EMAIL,
 APOLLO_SEND_CUSTOMER_CONFIRMATION: process.env.APOLLO_SEND_CUSTOMER_CONFIRMATION
};
after(() => {
 global.fetch = originalFetch;
 for (const [key, value] of Object.entries(originalEnv)) value === undefined ? delete process.env[key] : process.env[key] = value;
});
const good = {
 requestType:'pickup', service:'Wash & fold', quantity:'1 bag', items:'Please use the back entrance',
 orderNumber:'', address:'10 Example Lane', unit:'2A', city:'Sampletown', zip:'11747',
 requestedDate:new Date(Date.now()+14*86400000).toISOString().slice(0,10), timeWindow:'Afternoon', firstName:'Jamie', lastName:'Example',
 email:'jamie@example.com',phone:'6315550199',contactMethod:'Email',contactConsent:'on',website:''
};
async function invoke(body = good, method='POST', headers={ 'content-type':'application/json' }) {
 const response = {statusCode:200, headers:{}, setHeader(k,v){this.headers[k]=v;return this;},status(code){this.statusCode=code;return this;},json(data){this.body=data;return this;}};
 await handler({ body,method,headers },response);
 return response;
}
test('rejects GET without sending email', async () => {
 const res = await invoke(good,'GET');
 assert.equal(res.statusCode,405);
 assert.equal(res.body.success,false);
});
test('validates missing contact info', async () => {
 const res = await invoke({...good,email:'bad'});
 assert.equal(res.statusCode,400);
 assert.match(res.body.error,/email/i);
});
test('validates ZIP', async () => {
 const res = await invoke({...good,zip:'xxx'});
 assert.equal(res.statusCode,400);
});
test('rejects pickup with unexpected service', async () => {
 const res = await invoke({...good,service:'Free unlimited cleaning'});
 assert.equal(res.statusCode,400);
});
test('does not claim success if email service is unconfigured', async () => {
 delete process.env.RESEND_API_KEY;
 delete process.env.APOLLO_FROM_EMAIL;
 delete process.env.APOLLO_REQUEST_EMAIL;
 const res = await invoke();
 assert.equal(res.statusCode,503);
 assert.equal(res.body.success,false);
});
test('sends pickup email to owner and optional acknowledgment to customer', async () => {
 process.env.RESEND_API_KEY='test_key';
 process.env.APOLLO_REQUEST_EMAIL='owner@business.example';
 process.env.APOLLO_FROM_EMAIL='Apollo <requests@business.example>';
 process.env.APOLLO_SEND_CUSTOMER_CONFIRMATION='true';
 const sent = [];
 global.fetch = async (url,opts) => {
  assert.equal(url,'https://api.resend.com/emails');
  assert.equal(opts.headers.Authorization,'Bearer test_key');
  sent.push(JSON.parse(opts.body));
  return {ok:true,json:async()=>({id:'email_123'})};
 };
 const res = await invoke();
 assert.equal(res.statusCode,200);
 assert.match(res.body.reference,/^AP-[0-9A-F]{8}$/);
 assert.equal(sent.length,2);
 assert.equal(sent[0].to[0],'owner@business.example');
 assert.equal(sent[0].reply_to,'jamie@example.com');
 assert.equal(sent[1].to[0],'jamie@example.com');
 assert.match(sent[1].html,/not a confirmed appointment yet/i);
 assert.match(sent[0].html,/1 bag/);
 assert.match(sent[0].html,/Preferred contact/);
});
test('delivery form accepts an optional order reference', async () => {
 const sent=[];
 global.fetch=async (_url, opts)=>{sent.push(JSON.parse(opts.body));return {ok:true,json:async()=>({})};};
 process.env.APOLLO_SEND_CUSTOMER_CONFIRMATION='false';
 const res=await invoke({...good,requestType:'delivery',service:'',orderNumber:'AP-1283'});
 assert.equal(res.statusCode,200);
 assert.equal(sent.length,1);
 assert.match(sent[0].html,/AP-1283/);
});
test('escapes HTML in customer notes', async () => {
 const sent=[];
 global.fetch=async (_url,opts)=>{sent.push(JSON.parse(opts.body));return {ok:true,json:async()=>({})};};
 const res=await invoke({...good,items:'<script>alert(1)</script>'});
 assert.equal(res.statusCode,200);
 assert.match(sent[0].html,/&lt;script&gt;/);
 assert.doesNotMatch(sent[0].html,/<script>/);
});
test('silently drops bot honeypot submissions without notifying owner', async () => {
 let called=false;
 global.fetch=async()=>{called=true;throw Error('Should not send');};
 const res=await invoke({...good,website:'https://spammer.example'});
 assert.equal(res.statusCode,200);
 assert.equal(called,false);
});

test('rejects missing or unrecognized preferred contact method', async () => {
 const missing = await invoke({...good,contactMethod:''});
 assert.equal(missing.statusCode,400);
 const invalid = await invoke({...good,contactMethod:'Text me'});
 assert.equal(invalid.statusCode,400);
});
test('rejects a past preferred date', async () => {
 const res=await invoke({...good,requestedDate:'2020-01-01'});
 assert.equal(res.statusCode,400);
 assert.match(res.body.error,/180 days/i);
});
test('rejects a date more than 180 days away', async () => {
 const res=await invoke({...good,requestedDate:'2029-01-01'});
 assert.equal(res.statusCode,400);
});
test('rejects unexpected pickup amount', async () => {
 const res=await invoke({...good,quantity:'100 free bags'});
 assert.equal(res.statusCode,400);
});
test('allows delivery with no order reference', async () => {
 const sent=[];
 global.fetch=async (_url,opts)=>{sent.push(JSON.parse(opts.body));return {ok:true,json:async()=>({})};};
 process.env.APOLLO_SEND_CUSTOMER_CONFIRMATION='false';
 const res=await invoke({...good,requestType:'delivery',service:'',quantity:'',orderNumber:''});
 assert.equal(res.statusCode,200);
 assert.equal(sent.length,1);
 assert.match(sent[0].html,/Not supplied/);
});

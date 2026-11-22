'use strict';
// Local visual review only. No network calls, messages, or stored submissions.
const {createServer} = require('node:http');
const {readFileSync} = require('node:fs');
const {resolve} = require('node:path');
const handleAddress = require('../api/address');
const localFiles = {
  '/':['index.html','text/html'],
  '/styles.css':['styles.css','text/css'],
  '/app.js':['app.js','text/javascript'],
  '/assets/favicon.svg':['assets/favicon.svg','image/svg+xml'],
  '/assets/og-image.svg':['assets/og-image.svg','image/svg+xml']
};
const root = resolve(__dirname, '..');
const server = createServer(async (req,res) => {
  const url = req.url?.split('?')[0];
  res.setHeader('Cache-Control','no-store');
  if (req.method === 'GET' && Object.hasOwn(localFiles,url)) {
    const [filename,type] = localFiles[url];
    res.setHeader('Content-Type',type+'; charset=utf-8');
    res.end(readFileSync(resolve(root,filename)));
    return;
  }
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.status = n => { res.statusCode=n;return res; };
  res.json = body => res.end(JSON.stringify(body));
  if (req.method !== 'POST' || !['/api/address','/api/request'].includes(url)) return res.status(404).json({});
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 4096) return res.status(413).json({error:'Request too large'});
  }
  if (url === '/api/request') return res.json({success:true,reference:'PREVIEW-ONLY'});
  req.body = body;
  await handleAddress(req,res);
});
server.listen(Number(process.env.PORT) || 4173,'127.0.0.1',()=>console.log('Local review (no emails): http://127.0.0.1:'+server.address().port));

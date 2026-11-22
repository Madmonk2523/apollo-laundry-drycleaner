'use strict';
const {cpSync,mkdirSync} = require('node:fs');
const {join} = require('node:path');
const root = join(__dirname,'..');
const dist = join(root,'dist');
mkdirSync(dist,{recursive:true});
for (const name of ['index.html','app.js','styles.css','assets']) {
  cpSync(join(root,name),join(dist,name),{recursive:true});
}

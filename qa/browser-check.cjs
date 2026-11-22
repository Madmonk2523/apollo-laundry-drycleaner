'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const addressApi = require('../api/address');
const OUT = process.env.APOLLO_SCREENSHOT_DIR || '/tmp';
const ROOT = resolve(__dirname,'..');
const inApp = 'https://apollo-qa.invalid';
const mime = { '/':'text/html', '/styles.css':'text/css', '/app.js':'text/javascript', '/assets/favicon.svg':'image/svg+xml' };
const relevant = [375,390,768,1440];
const appErrors = [];
let lastRequest, outsideCode, browser;

async function run() {
  browser = await chromium.launch({
    executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']
  });
  try {
    for (const width of relevant) {
      const phone = width <= 390;
      const page = await browser.newPage({viewport:{width,height:phone?844:950},hasTouch:phone,isMobile:phone,deviceScaleFactor:1,reducedMotion:'reduce'});
      page.on('pageerror', err => appErrors.push(err.message));
      await page.route('**/*',async route => {
        const url = new URL(route.request().url());
        if (url.origin !== inApp) return route.abort();
        if (url.pathname === '/api/address') {
          const result = {setHeader(){},status(n){this.code=n;return this;},json(payload){this.body=payload;}};
          await addressApi({method:'POST',headers:{'content-type':'application/json'},body:route.request().postDataJSON()},result);
          if (result.body.code === 'address_outside') outsideCode = result.code;
          return route.fulfill({status:result.code,json:result.body});
        }
        if (url.pathname === '/api/request') {
          lastRequest = route.request().postDataJSON();
          return route.fulfill({status:200,json:{success:true,reference:'LOCAL-QA'}});
        }
        if (mime[url.pathname]) return route.fulfill({
          status:200,contentType:mime[url.pathname],
          body:readFileSync(resolve(ROOT,url.pathname === '/' ? 'index.html' : url.pathname.slice(1)))
        });
        return route.abort();
      });
      await page.goto(inApp);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true,`${width}: page overflows`);
      if (width === 1440) await page.screenshot({path:resolve(OUT,'apollo-desktop-review.png')});
      await page.locator('.hero-buttons [data-type="pickup"]').click();
      assert.equal(await page.getByRole('dialog').isVisible(),true);
      const address = page.getByRole('combobox',{name:'Street address'});
      await address.fill('10 E 95th Street, Manhattan');
      const denied = page.getByRole('option',{name:/10 E 95/});
      await denied.waitFor();
      if (phone) await denied.tap(); else {await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');}
      await page.getByRole('button',{name:'Check address'}).click();
      const error = page.getByRole('alert');
      await error.waitFor({state:'visible'});
      assert.match(await error.innerText(),/Pickup and delivery aren’t available at this address\./);
      assert.equal(outsideCode,422);
      await address.fill('137 Franklin Street Apt 5, Brooklyn NY 11222');
      const allowed = page.getByRole('option',{name:/137 Franklin St, Brooklyn/});
      await allowed.waitFor();
      if (width === 390) await page.screenshot({path:resolve(OUT,'apollo-mobile-address-review.png')});
      const size = await allowed.boundingBox();
      assert.ok(size.height >= 44,`${width}: touch target too small`);
      if (phone) await allowed.tap(); else {await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');}
      await page.getByRole('button',{name:'Check address'}).click();
      await page.locator('#verifiedAddress').waitFor();
      assert.match(await page.locator('#verifiedAddress').innerText(),/137 Franklin St, 5, Brooklyn, NY 11222/);
      const modal = page.getByRole('dialog');
      assert.equal(await modal.evaluate(el=>el.scrollWidth <= el.clientWidth+1),true,`${width}: modal overflows`);
      await page.locator('#service').selectOption('Laundry');
      await page.locator('#requestedDate').fill(await page.locator('#requestedDate').getAttribute('min'));
      await page.locator('#timeWindow').selectOption('Morning');
      await page.locator('#firstName').fill('Test');
      await page.locator('#lastName').fill('Customer');
      await page.locator('#email').fill('test@example.invalid');
      await page.locator('#phone').fill('2025550199');
      await page.locator('#contactConsent').check();
      await page.getByRole('button',{name:'Send request'}).click();
      await page.getByText('LOCAL-QA').waitFor();
      assert.equal(lastRequest.unit,'5');
      assert.equal(lastRequest.addressId,'1232477');
      await page.locator('#successClose').click();
      assert.equal(await modal.isVisible(),false);
      await page.close();
    }
    assert.deepEqual(appErrors,[]);
    console.log('PASS chromium 375/390/768/1440: viewport overflow, touch targets, pointer and keyboard options, denied outside, unit, mock submit.');
  } finally {await browser.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});

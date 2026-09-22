import { chromium } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
const root=new URL('../evidence/',import.meta.url).pathname;
const browser=await chromium.launch();
const runs=[];
for(const width of [390,1440]) for(let run=1;run<=3;run++){
 const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage();
 await page.addInitScript(()=>{window.lab={lcp:0,cls:0};new PerformanceObserver(list=>{for(const e of list.getEntries())window.lab.lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.lab.cls+=e.value}).observe({type:'layout-shift',buffered:true});});
 await page.goto('http://localhost:3000');await page.waitForTimeout(2000);
 runs.push({width,run,...await page.evaluate(()=>({...window.lab,resources:performance.getEntriesByType('resource').filter(e=>e.initiatorType==='script').map(e=>({url:e.name.split('/').pop(),bytes:e.transferSize}))}))});await context.close();
}
fs.writeFileSync(root+'performance-lab.json',JSON.stringify({date:new Date().toISOString(),browser:browser.version(),machine:{platform:os.platform(),arch:os.arch(),cpus:os.cpus()[0].model},profile:'Unthrottled localhost production server, fresh context per run, reduced motion, 2 second observation; lab values, no field INP',runs},null,2));
const page=await browser.newPage();
for(const width of [360,1440])for(const theme of ['light','dark']){
 await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});await page.goto('http://localhost:3000/photography/sample-wild-places');await page.screenshot({path:root+`album-${width}-${theme}.png`,fullPage:true});await page.locator('[data-photo-link]').first().click();await page.screenshot({path:root+`viewer-${width}-${theme}.png`});
}
await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({colorScheme:'light',reducedMotion:'reduce'});await page.goto('http://localhost:3000/software');await page.getByTestId('signature-icon-cloud').scrollIntoViewIfNeeded();await page.waitForTimeout(500);await page.screenshot({path:root+'toolkit-preview.png'});
await browser.close();console.log(runs.map(({width,run,lcp,cls})=>({width,run,lcp,cls})));

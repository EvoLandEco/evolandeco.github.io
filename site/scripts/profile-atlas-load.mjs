import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
const runs=[];
try {
for(let i=0;i<3;i++){
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce',permissions:['local-network-access']});
 if(process.env.ATLAS_PROFILE_ASSET_ORIGIN) await page.route((process.env.ATLAS_PROFILE_BASE_URL ?? 'http://127.0.0.1:3000')+'/**',async route=>{
  const url=new URL(route.request().url());
  const response=await route.fetch({url:process.env.ATLAS_PROFILE_ASSET_ORIGIN+url.pathname+url.search});
  await route.fulfill({response});
 });
 await page.addInitScript(()=>{
  window.audit={parses:[],long:[],ready:0};
  const observer=new MutationObserver(()=>{if(document.querySelector('.atlas-page[data-ready="true"]')){window.audit.ready=performance.now();observer.disconnect();}});
  observer.observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['data-ready']});
  const parse=JSON.parse;JSON.parse=function(...args){const start=performance.now();const v=parse.apply(this,args);if(args[0]?.length>1e6)window.audit.parses.push({bytes:args[0].length,start,ms:performance.now()-start});return v;};
  new PerformanceObserver(list=>window.audit.long.push(...list.getEntries().map(e=>({start:e.startTime,ms:e.duration})))).observe({type:'longtask',buffered:true});
 });
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.ATLAS_PROFILE_BASE_URL ?? 'http://127.0.0.1:3000') + '/atlas/');
 await page.locator('.atlas-page[data-ready="true"]').waitFor({timeout:90000});
 const ready=await page.evaluate(()=>window.audit.ready);
 const switches=[];
 for(const name of ['One Health','Reports','Source coverage','Trends']){
  const t=performance.now();await page.getByRole('tab',{name,exact:name==='One Health'||name==='Trends'}).click();
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  switches.push({name,ms:performance.now()-t});
 }
 runs.push({ready,switches,errors,...await page.evaluate(()=>({...window.audit,resources:performance.getEntriesByType('resource').filter(r=>r.name.includes('.json')).map(r=>({name:r.name,start:r.startTime,end:r.responseEnd,duration:r.duration,encoded:r.encodedBodySize,decoded:r.decodedBodySize}))}))});
 await page.close();
}
} finally { await browser.close(); }
await writeFile(process.argv[2] ?? '/tmp/atlas-load-profile.json',JSON.stringify(runs,null,2));console.log(runs.map(r=>({ready:r.ready,switches:r.switches,parses:r.parses,long:r.long.sort((a,b)=>b.ms-a.ms).slice(0,5),errors:r.errors})));

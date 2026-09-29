import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390,1280]) test(`Partial One Health candidate ${width}`,async({page})=>{
 test.skip(!process.env.ATLAS_HEALTH_PARTIAL,'Requires the private partial candidate');
 await page.setViewportSize({width,height:950});await page.emulateMedia({reducedMotion:'reduce'});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/atlas/');
 if(width===1280){await page.getByRole('button',{name:'Click to enter full screen'}).focus();await page.keyboard.press('Enter');}
 await page.getByRole('tab',{name:'One Health',exact:true}).click();
 const view=page.getByRole('region',{name:'One Health evidence'});
 await view.locator('summary[aria-label="One Health report"]').click();
 await view.getByRole('searchbox').fill('Madagascar mpox spreads across seven regions');
 await view.getByRole('option',{name:/Madagascar mpox spreads across seven regions/}).click();
 const choose=async(name:string)=>{await view.locator('summary[aria-label="One Health view"]').click();await view.getByRole('option',{name,exact:true}).click();};
 await choose('Sampling');await expect(view.getByRole('table',{name:'Reviewed sampling and positivity'})).toBeVisible();
 await expect(view.getByRole('complementary')).toContainText('Source evidence');
 await choose('Timeline');await expect(view.getByRole('heading',{name:'Aligned evidence timeline'})).toBeVisible();
 expect(await view.locator('.atlas-oh-time-point,.atlas-oh-time-list button').count()).toBeGreaterThan(0);
 await choose('Environment');await expect(view.getByRole('heading',{name:'Environment & interventions'})).toBeVisible();
 expect((await new AxeBuilder({page}).include('.atlas-one-health').analyze()).violations).toEqual([]);
 await page.screenshot({path:`/tmp/atlas-real-partial-${width}.png`});
 const start=page.getByRole('slider',{name:'Window start'});await start.press('End');for(let i=0;i<24;i++)await start.press('ArrowLeft');
 await choose('Timeline');
 await expect(view).toContainText('No reviewed panel statements are exported');
 await expect(view).toContainText('This is not evidence');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(width===1280)expect(await page.locator('.atlas-workspace-scroll').evaluate(e=>e.scrollHeight<=e.clientHeight+1)).toBe(true);
 expect(errors).toEqual([]);
});

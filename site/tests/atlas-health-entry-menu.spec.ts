import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for(const width of [390,1280])test(`One Health entry discovery ${width}`,async({page})=>{
 test.skip(!process.env.ATLAS_HEALTH_PARTIAL,'Requires the partial local candidate');
 await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce',colorScheme:width===390?'dark':'light'});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/atlas/');
 if(width===1280){await page.getByRole('button',{name:'Click to enter full screen'}).focus();await page.keyboard.press('Enter');}
 await page.getByRole('tab',{name:'One Health',exact:true}).click();
 const view=page.getByRole('region',{name:'One Health evidence'});
 await expect(view).not.toContainText('inspected');
 await expect(page.locator('.atlas-workspace-footer').getByRole('button',{name:'About One Health',exact:true})).toBeVisible();
 await view.locator('summary[aria-label="One Health view"]').click();
 const option=view.getByRole('option',{name:'Sampling',exact:true});await expect(option).toContainText('entries available');await expect(option).toContainText('in this entry');
 await page.screenshot({path:`/tmp/atlas-health-view-menu-${width}.png`});await option.click();
 const filters=view.locator('.atlas-oh-entry-filters');await filters.locator('summary').click();
 await filters.getByRole('checkbox',{name:'Sampling',exact:true}).check();
 await filters.getByRole('checkbox',{name:'Reviewed sample fraction',exact:true}).check();
 await expect(view.getByRole('table',{name:'Reviewed sampling and positivity'})).toBeVisible();
 await page.screenshot({path:`/tmp/atlas-health-entry-filters-${width}.png`});
 expect((await new AxeBuilder({page}).include('.atlas-one-health').analyze()).violations).toEqual([]);
 await filters.getByRole('checkbox',{name:'Reviewed sample fraction',exact:true}).press('Escape');await expect(filters).not.toHaveAttribute('open','');
 const report=view.locator('summary[aria-label="One Health report"]');await report.click();
 const options=view.getByRole('listbox',{name:'One Health report'}).getByRole('option');
 expect(await options.count()).toBeGreaterThan(0);
 for(const item of await options.all()){
  await expect(item.locator('[data-kind="sampling"]')).not.toHaveAttribute('data-empty','true');
  for(const name of ['network','evidence','timeline','sampling','environment'])await expect(item.locator(`[data-kind="${name}"]`)).toBeVisible();
 }
 await page.screenshot({path:`/tmp/atlas-health-report-menu-${width}.png`});
 await view.getByRole('searchbox').press('Escape');
 await filters.locator('summary').click();await filters.getByRole('checkbox',{name:'Food & commodities',exact:true}).check();
 await expect(view).toContainText('No entries match these filters.');
 await filters.getByRole('button',{name:'Clear',exact:true}).click();
 await expect(filters.getByRole('checkbox',{name:'Sampling',exact:true})).not.toBeChecked();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);
});

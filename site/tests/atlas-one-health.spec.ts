import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import fixture from './atlas-fixture.json';
import AxeBuilder from '@axe-core/playwright';

for (const {width,height,workspace} of [{width:390,height:950,workspace:false},{width:1280,height:950,workspace:true},{width:1280,height:720,workspace:true},{width:1280,height:950,workspace:false}]) test(`Private One Health evidence at ${width}×${height}, workspace ${workspace}`,async({page})=>{
 test.skip(!process.env.ATLAS_ONE_HEALTH_CANDIDATE,'Use the private One Health preview');
 await page.setViewportSize({width,height});
 await page.emulateMedia({reducedMotion:'reduce',colorScheme:width===390?'dark':'light'});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/atlas/');
 if(workspace){const entrance=page.getByRole('button',{name:'Click to enter full screen'});await entrance.focus();await entrance.press('Enter');}
 await page.getByRole('tab',{name:'One Health',exact:true}).click();
 const view=page.getByRole('region',{name:'One Health evidence'});
 if(workspace) expect(await page.locator('.atlas-workspace-scroll').evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
 const select=view.locator('summary[aria-label="One Health report"]');
 await select.click();await view.getByRole('option',{name:/alfalfa sprouted seeds/}).click();
 await expect(view.locator('.atlas-oh-edge[data-kind="genomic_association"]')).toHaveCount(1);
 const scope=view.getByRole('button',{name:/^Review scope for/});
 expect(await scope.evaluate(el=>{
  const button=el.getBoundingClientRect(),header=el.closest('header')!.getBoundingClientRect();
  return button.left>=header.left && button.right<=header.right && button.top>=header.top && button.bottom<=header.bottom;
 })).toBe(true);
 await scope.click();await expect(view.getByRole('dialog',{name:/^Review scope for/})).toBeVisible();
 await view.getByRole('button',{name:'Close review scope',exact:true}).click();
 expect(await view.locator('.atlas-oh-network svg').evaluate(el=>{
  const svg=el as SVGSVGElement;
  return [...svg.querySelectorAll('foreignObject')].every(label=>Number(label.getAttribute('y'))+Number(label.getAttribute('height'))<=svg.viewBox.baseVal.height);
 })).toBe(true);
 expect(await view.locator('.atlas-oh-node-label').evaluateAll(labels => labels.every(label => label.scrollHeight <= 108))).toBe(true);
 expect(await view.locator('.atlas-oh-network').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 const paths = await view.locator('.atlas-oh-edge-line').evaluateAll(lines => lines.map(line => line.getAttribute('d')!));
 expect(paths).toHaveLength(2);
 expect(paths.every(path => !path.includes('Q'))).toBe(true);
 const node = view.locator('.atlas-oh-node').first();
 await node.hover();
 await expect(page.getByRole('tooltip')).toContainText('Interviewed cases reporting sprout consumption');
 const card = await page.locator('.atlas-figure-infocard').boundingBox();
 expect(await page.locator('.atlas-figure-infocard').evaluate(el => { const r=el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); })).toBe(true);
 expect(card!.x).toBeGreaterThanOrEqual(0);
 expect(card!.x + card!.width).toBeLessThanOrEqual(width);
 await page.keyboard.press('Escape');
 await expect(page.getByRole('tooltip')).toHaveCount(0);
 await node.focus();
 await expect(page.getByRole('tooltip')).toBeVisible();
 await page.keyboard.press('Escape');
 await view.locator('.atlas-oh-edge[data-kind="genomic_association"]').focus();await page.keyboard.press('Enter');
 await expect(view.getByRole('complementary')).toContainText('genomic association');
 await expect(view.getByRole('complementary').locator('blockquote')).not.toHaveCount(0);
 await expect(view.locator('.atlas-oh-controls')).toHaveCount(0);
 await expect(view.getByRole('checkbox')).toHaveCount(0);
 await select.click();await view.getByRole('option',{name:/Week 4: 19 to 25 January/}).click();
 await expect(view).toContainText('Not detected in sampled material');
 await expect(view.locator('.atlas-oh-edge')).toHaveCount(0);
 await select.click();await view.getByRole('option',{name:/Week 30: 20 to 26 July/}).click();
 await expect(view.locator('.atlas-oh-edge[data-basis="source_hypothesis"]')).toHaveCount(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const accessibility=await new AxeBuilder({page}).include('.atlas-one-health').analyze();
 expect(accessibility.violations).toEqual([]);
 await select.click();await view.getByRole('option',{name:/alfalfa sprouted seeds/}).click();
 await view.locator('.atlas-oh-figure > header').scrollIntoViewIfNeeded();
 await view.locator('.atlas-oh-figure').screenshot({path:`/tmp/atlas-oh-figure-${width}-${height}-${workspace?"workspace":"page"}.png`});
 await node.hover();
 await expect(page.getByRole('tooltip')).toBeVisible();
 await page.screenshot({path:`/tmp/atlas-oh-hover-${width}-${height}-${workspace?"workspace":"page"}.png`,fullPage:false});
 await page.keyboard.press('Escape');
 await page.screenshot({path:`/tmp/atlas-one-health-${width}-${height}-${workspace?"workspace":"page"}.png`,fullPage:false});
 expect(errors).toEqual([]);
});


test('Legacy dataset keeps its existing evidence views', async({page})=>{
 await page.route(/\/(?:current\.json|releases\/)/,route=>{
  const name=new URL(route.request().url()).pathname.split('/').at(-1)!;
  return name==='current.json'?route.fulfill({json:fixture.release}):route.fulfill({contentType:'application/json',body:readFileSync(`.cache/atlas-fixture/${name}`)});
 });
 await page.goto('/atlas/');
 await expect(page.locator('.atlas-page')).toHaveAttribute('data-ready','true');
 await expect(page.getByRole('tab',{name:'One Health',exact:true})).toHaveCount(0);
 await expect(page.getByRole('tab',{name:'Trends',exact:true})).toHaveAttribute('aria-selected','true');
 await page.getByRole('tab',{name:'Reports',exact:true}).click();
 await expect(page.locator('.atlas-report').first()).toBeVisible();
});


test('Published 1.2 journeys remain compatible', async({page})=>{
 await page.route('http://localhost:3004/**',async route=>{
  const response=await route.fetch({url:'https://qtj-atlas.evolandeco-github-io.workers.dev'+new URL(route.request().url()).pathname});
  await route.fulfill({response});
 });
 await page.goto('/atlas/');
 await expect(page.locator('.atlas-page')).toHaveAttribute('data-ready','true');
 await expect(page.getByRole('tab',{name:'One Health',exact:true})).toHaveCount(0);
 await expect(page.locator('.atlas-chain-figure')).toBeVisible();
 await page.locator('summary[aria-label="Reviewed chain"]').click();
 await expect(page.locator('.atlas-chain-section').getByRole('option')).toHaveCount(7);
});

for (const width of [390,1280]) test(`One Health evidence, overview and literature at ${width}`,async({page})=>{
 test.skip(!process.env.ATLAS_ONE_HEALTH_CANDIDATE,'Use the private One Health preview');
 await page.setViewportSize({width,height:850});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/atlas/');
 if(width===1280){await page.getByRole('button',{name:'Click to enter full screen'}).focus();await page.keyboard.press('Enter');}
 await page.getByRole('tab',{name:'One Health',exact:true}).click();
 const view=page.getByRole('region',{name:'One Health evidence'});
 await view.locator('summary[aria-label="One Health report"]').click();
 await view.getByRole('option',{name:/alfalfa sprouted seeds/}).click();
 await view.getByRole('button',{name:'Evidence',exact:true}).click();
 const matrix=view.getByRole('table',{name:'Relationship evidence types'});
 await expect(matrix.getByRole('row')).toHaveCount(3);
 await matrix.getByRole('button',{name:/Genomics cited for/}).click();
 await expect(view.getByRole('complementary')).toContainText('does not assign individual passages to evidence types');
 await expect(matrix.getByLabel('Evidence type not recorded').first()).toBeVisible();
 const methods=view.getByRole('button',{name:/Figure methods & references for/});
 expect(await methods.evaluate(el=>{const a=el.getBoundingClientRect(),b=el.closest('.atlas-oh-tools')!.getBoundingClientRect();return a.left>=b.left && a.right<=b.right && a.top>=b.top && a.bottom<=b.bottom;})).toBe(true);
 await methods.click();
 const modal=view.getByRole('dialog',{name:/Figure methods & references for/});
 for(const doi of ['10.1038/nrmicro.2017.45','10.1038/s41586-024-07849-4','10.1038/s41576-023-00649-y','10.1016/j.onehlt.2023.100617','10.2903/j.efsa.2025.9759']) await expect(modal.locator(`li a[href="https://doi.org/${doi}"]`)).toHaveCount(1);
 await expect(modal).toContainText('The papers do not validate this interface or its records');
 await page.keyboard.press('Escape');
 await view.getByRole('button',{name:'Overview',exact:true}).click();
 const overview=view.getByRole('table',{name:'Report entries by One Health domain'});
 await expect(overview.getByRole('row')).toHaveCount(21);
 await expect(view.locator('.atlas-oh-review-state').getByText('Unreviewed',{exact:true}).first()).toBeVisible();
 await view.getByRole('button',{name:'Next',exact:true}).click();
 await expect(view.getByRole('navigation',{name:'One Health overview pages'})).toContainText('2 /');
 await view.getByRole('searchbox',{name:'Search One Health report entries'}).fill('alfalfa');
 await expect(overview.getByRole('row')).toHaveCount(3);
 await expect(overview.getByRole('row').filter({hasText:'Unreviewed'}).getByRole('cell')).toHaveCount(4);
 await expect(overview.getByLabel('No domain observation recorded')).toHaveCount(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(width===1280)expect(await page.locator('.atlas-workspace-scroll').evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
 expect(await overview.locator('td button').evaluateAll(buttons=>buttons.every(button=>button.scrollWidth<=button.clientWidth+1))).toBe(true);
 await page.screenshot({path:`/tmp/atlas-oh-overview-${width}.png`});
 expect((await new AxeBuilder({page}).include('.atlas-one-health').analyze()).violations).toEqual([]);
 await overview.getByRole('button',{name:/Open People observations/}).click();
 await expect(view.getByRole('button',{name:'Network',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(view.locator('.atlas-oh-node')).toHaveCount(6);
 await view.getByRole('button',{name:'Evidence',exact:true}).click();
 await page.screenshot({path:`/tmp/atlas-oh-matrix-${width}.png`});
 expect((await new AxeBuilder({page}).include('.atlas-one-health').analyze()).violations).toEqual([]);
});

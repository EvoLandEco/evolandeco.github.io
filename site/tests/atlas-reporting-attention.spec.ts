import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const [width, height, workspace] of [[390,950,false], [1280,950,false], [1280,720,true]] as const) {
  test(`Reporting attention infocards at ${width}×${height}, workspace ${workspace}`, async ({page}) => {
    test.skip(!process.env.ATLAS_ONE_HEALTH_CANDIDATE && !process.env.ATLAS_HEALTH_PARTIAL, 'Requires the private preview');
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({width,height});
    await page.emulateMedia({reducedMotion:width===390?'reduce':'no-preference',colorScheme:width===390?'dark':'light'});
    await page.goto('/atlas/');
    await expect(page.locator('.atlas-page')).toHaveAttribute('data-ready','true');
    if (workspace) {
      const entrance = page.getByRole('button',{name:'Click to enter full screen'});
      await entrance.focus(); await entrance.press('Enter');
    }
    const ring = page.locator('.atlas-disease-ring');
    await expect(ring).toBeVisible();
    await expect(page.locator('.atlas-trend-coverage > header > svg')).toBeVisible();
    expect(await page.locator('.atlas-trend-coverage > header > svg').evaluate(el=>el.getBoundingClientRect().width)).toBe(17);
    await expect(page.getByText('Subjects & coverage',{exact:true})).toHaveCount(0);
    const segments = ring.getByRole('button');
    expect(await segments.count()).toBeGreaterThan(1);
    await ring.evaluate(el => el.scrollIntoView({ block: 'center' }));
    for (let i=0; i<await segments.count(); i++) {
      const segment = segments.nth(i);
      const label = (await segment.getAttribute('aria-label'))!.split(':')[0];
      const point = await segment.locator('.atlas-disease-arc').evaluate(el => {
        const path = el as SVGPathElement;
        const p = path.getPointAtLength(path.getTotalLength()/2);
        const screen = new DOMPoint(p.x,p.y).matrixTransform(path.getScreenCTM()!);
        return {x:screen.x,y:screen.y};
      });
      await expect(segment.locator('.atlas-disease-arc')).toHaveCSS('stroke-linecap','round');
      await page.mouse.move(point.x,point.y);
      await expect(page.getByRole('tooltip')).toContainText(label);
      await expect.poll(() => segment.locator('.atlas-disease-arc').evaluate(el => {
        const matrix = new DOMMatrix(getComputedStyle(el).transform);
        return Math.round(Math.hypot(matrix.e,matrix.f));
      })).toBe(width===390?0:5);
      await expect(segments.nth((i+1)%await segments.count()).locator('.atlas-disease-arc')).toHaveCSS('opacity','0.5');
      expect(await page.locator('.atlas-disease-infocard').evaluate(el => {
        const r=el.getBoundingClientRect();
        return r.left>=0 && r.right<=innerWidth && r.top>=0 && el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
      })).toBe(true);
    }
    await page.screenshot({path:`/tmp/atlas-reporting-attention-${width}-${height}.png`});
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await segments.first().focus();
    await expect(page.getByRole('tooltip')).toBeVisible();
    expect((await new AxeBuilder({page}).include('.atlas-trend-coverage').analyze()).violations).toEqual([]);
    await segments.first().press('Enter');
    await expect(page.getByRole('tab',{name:'Reports',exact:true})).toHaveAttribute('aria-selected','true');
    expect(errors).toEqual([]);
  });
}

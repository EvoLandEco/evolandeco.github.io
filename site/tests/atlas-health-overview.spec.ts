import { test, expect } from '@playwright/test';

for (const height of [720, 950, 1400]) test(`One Health overview fills workspace at ${height}px`, async ({ page }) => {
  test.skip(!process.env.ATLAS_HEALTH_PARTIAL, 'Requires the partial One Health dataset');
  await page.setViewportSize({ width: 1440, height });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/atlas/');
  await page.locator('.atlas-page[data-ready="true"]').waitFor();
  await page.getByRole('button', { name: 'Click to enter full screen' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('tab', { name: 'One Health', exact: true }).click();
  await page.locator('summary[aria-label="One Health view"]').click();
  await page.getByRole('option', { name: /^Overview/ }).click();
  const overview = page.locator('.atlas-oh-overview');
  const pages = page.getByRole('navigation', { name: 'One Health overview pages, bottom' });
  const footer = page.locator('.atlas-workspace-footer');
  const checkBottom = async () => {
    const controls = (await pages.boundingBox())!;
    const boundary = (await footer.boundingBox())!;
    expect(controls.y).toBeGreaterThanOrEqual(boundary.y);
    expect(controls.y + controls.height).toBeLessThanOrEqual(boundary.y + boundary.height);
    await expect(footer.getByRole('navigation')).toHaveCount(1);
  };
  await checkBottom();
  const evidenceHeader=page.getByRole('columnheader',{name:'Evidence',exact:true});
  await expect(evidenceHeader).toHaveAttribute('aria-sort','descending');
  const firstId=await overview.locator('tbody tr').first().getAttribute('data-record-id');
  await pages.getByRole('button',{name:'Next one health overview page',exact:true}).click();
  await expect(overview.locator('tbody tr').first()).not.toHaveAttribute('data-record-id',firstId!);
  for(const header of await overview.locator('thead th').all()) {
    const before=await header.getAttribute('aria-sort');
    await header.getByRole('button').click();
    const direction=await header.getAttribute('aria-sort');
    expect(direction).not.toBe('none');
    expect(direction).not.toBe(before);
    await header.getByRole('button').click();
    await expect(header).toHaveAttribute('aria-sort',direction==='ascending'?'descending':'ascending');
  }
  await overview.getByRole('button',{name:'Reset sort',exact:true}).click();
  await expect(evidenceHeader).toHaveAttribute('aria-sort','descending');
  expect(await overview.locator('.atlas-oh-overview-scroll').evaluate(el=>el.scrollLeft)).toBe(0);
  await expect(overview.locator('tbody tr').first()).toHaveAttribute('data-record-id',firstId!);
  await expect(pages.getByRole('button',{name:'Previous one health overview page',exact:true})).toBeDisabled();
  const checkTextAlignment = async () => {
    const offsets = await overview.locator('tbody :is(th, td)').evaluateAll(cells => cells.flatMap(cell => {
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
      const rects: DOMRect[] = [];
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        if (!text.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(text);
        rects.push(...Array.from(range.getClientRects()).filter(rect => rect.width > 0));
      }
      const lines: { left: number; top: number; bottom: number }[] = [];
      for (const rect of rects.sort((a, b) => a.top - b.top)) {
        const line = lines.at(-1);
        if (line && rect.top < line.bottom - 2) {
          line.left = Math.min(line.left, rect.left);
          line.bottom = Math.max(line.bottom, rect.bottom);
        } else lines.push({ left: rect.left, top: rect.top, bottom: rect.bottom });
      }
      const left = cell.getBoundingClientRect().left + parseFloat(getComputedStyle(cell).paddingLeft);
      return lines.map(line => ({ text: cell.textContent, offset: line.left - left }));
    }));
    for (const line of offsets) expect(Math.abs(line.offset), line.text ?? '').toBeLessThan(1);
  };
  await checkTextAlignment();
  const help=overview.getByRole('button',{name:'Overview ordering and scope for Evidence coverage',exact:true});
  expect(await help.evaluate(el=>getComputedStyle(el).position)).toBe('static');
  for(const header of await overview.locator('thead th').all()) {
    expect(await header.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  }
  await help.click();
  await expect(page.getByRole('dialog',{name:'Overview ordering and scope for Evidence coverage'})).toContainText('not a confidence score');
  await page.keyboard.press('Escape');
  await page.screenshot({path:`/tmp/atlas-overview-${height}.png`});
  expect(await page.locator('.atlas-oh-overview-scroll').evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  if (height === 1400) expect((await overview.boundingBox())!.height).toBeGreaterThan(760);
  await page.getByRole('searchbox', { name: 'Search One Health report entries' }).fill('zzzz-no-matching-entry');
  await expect(overview).toContainText('No matching report entries');
  await checkBottom();
  await page.getByRole('button',{name:'Exit full screen',exact:true}).click();
  await checkBottom();
  await page.getByRole('searchbox',{name:'Search One Health report entries'}).fill('');
  await page.setViewportSize({width:390,height:844});
  await expect(footer.getByRole('navigation')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await checkTextAlignment();
  await page.locator('.atlas-oh-overview-tools').scrollIntoViewIfNeeded();
  await page.screenshot({path:`/tmp/atlas-overview-mobile-${height}.png`});
});

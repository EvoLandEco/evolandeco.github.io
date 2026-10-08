import { expect, type Locator, type Page } from '@playwright/test';

export function atlasSelect(scope: Page | Locator, label: string) {
  return scope.locator(`.atlas-select:has(> summary[aria-label=${JSON.stringify(label)}])`);
}

export async function selectAtlasOption(scope: Page | Locator, label: string, choice: string | { label: string } | { index: number }) {
  const menu = atlasSelect(scope, label);
  await menu.locator(':scope > summary').click();
  const options = menu.getByRole('option');
  const option = typeof choice === 'string' ? options.and(menu.locator(`button[value=${JSON.stringify(choice)}]`))
    : 'label' in choice ? menu.getByRole('option', { name: choice.label, exact: true }) : options.nth(choice.index);
  await option.click();
}

export async function selectedAtlasValue(scope: Page | Locator, label: string) {
  const menu = atlasSelect(scope, label);
  await menu.locator(':scope > summary').click();
  const selected = menu.getByRole('option', { selected: true });
  await expect(selected).toBeVisible();
  const value = await selected.getAttribute('value');
  await menu.press('Escape');
  return value!;
}

import {expect, test} from '@playwright/test';
import {installManualInjection} from '../../scripts/manual-browser.mjs';

test('manual injector loads the bundle after SDK readiness and restores it after refresh', async ({page, browser}) => {
  // Remove the fixture's automatic bundle so the manual injector is responsible.
  await page.route('**/mock-wme-sdk.html', async route => {
    const response = await route.fetch();
    const html = (await response.text()).replace('<script src="/dist/wme-speed-plate-overlay.user.js"></script>','');
    await route.fulfill({response,body:html});
  });
  const messages = [];
  const stop = await installManualInjection(browser, {
    matches: url => url === 'http://127.0.0.1:8765/mock-wme-sdk.html',
    log: message => messages.push(message),
  });
  try {
    await page.goto('/mock-wme-sdk.html');
    await page.locator('.spo-language').selectOption('en');
    await page.getByLabel('Government CSV').setInputFiles({name:'manual.csv',mimeType:'text/csv',buffer:Buffer.from('longitude,latitude,speed,direction\n121.5,25,50,順向')});
    await expect(page.locator('.spo-status')).toContainText('manual.csv: 1 plates');
    await page.reload();
    await expect(page.locator('.spo-status')).toContainText('manual.csv: 1 plates');
    await expect(page.locator('.spo-panel')).toHaveCount(1);
    await expect(page.locator('.plate')).toHaveCount(1);
    await expect.poll(() => messages.filter(message => message.startsWith('Built userscript loaded.')).length).toBe(2);
  } finally { stop(); }
});

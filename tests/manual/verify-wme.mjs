import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9224');
try {
  const pages = browser.contexts().flatMap(context => context.pages());
  const page = pages.find(page => /^https:\/\/www\.waze\.com\/(?:[^/]+\/)?editor(?:[/?]|$)/.test(page.url()));
  if (!page) console.log('Open tab URLs:',pages.map(page => page.url()));
  if (!page) throw new Error('Open WME in the test browser.');
  const ready = await page.evaluate(async () => !!window.getWmeSdk && await window.getWmeSdk({scriptId:'spo-smoke-readiness',scriptName:'Speed Plate Readiness',mode:'async'}).State.isReady());
  if (!ready) throw new Error('Please log in and wait for the WME map to load.');
  if (process.env.WME_RELOAD === '1') {
    const unsaved = await page.evaluate(async()=>await window.getWmeSdk({scriptId:'spo-before-reload',scriptName:'Speed Plate Reload Check',mode:'async'}).Editing.getUnsavedChangesCount());
    if (unsaved !== 0) throw new Error('Test reload skipped: WME has unsaved edits.');
    await page.reload();
    await page.waitForFunction(()=>!!window.getWmeSdk);
    await page.evaluate(async()=>{await window.SDK_INITIALIZED;const sdk=window.getWmeSdk({scriptId:'spo-reload-ready',scriptName:'Speed Plate Ready',mode:'async'});if (!await sdk.State.isReady()) await sdk.Events.once({eventName:'wme-ready'});});
  }
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') console.log('Browser error:',message.text()); });
  await page.addScriptTag({content:await readFile(new URL('../../dist/wme-speed-plate-overlay.user.js',import.meta.url),'utf8')});
  await page.waitForSelector('.spo-file',{state:'attached',timeout:30000});
  if (!await page.locator('.spo-tab-label').isVisible()) await page.locator('#drawer').getByText('Scripts',{exact:true}).click();
  await page.locator('.spo-tab-label').click();
  await page.locator('.spo-language').selectOption('en');
  await page.locator('.spo-file').setInputFiles(new URL('../../input/plate-data-20261114.csv',import.meta.url).pathname);
  await page.waitForFunction(()=>document.querySelector('.spo-status')?.textContent?.includes('plates;'));
  console.log(await page.locator('.spo-status').textContent());
  const sidebar = page.locator('.spo-panel');
  const floating = page.locator('.spo-floating');
  await sidebar.getByLabel('Show floating controls').check();
  if (!await sidebar.getByLabel('Badge position').isVisible()) await sidebar.getByText('Plate appearance',{exact:true}).click();
  await sidebar.getByLabel('Badge position').selectOption('bottom-right');
  await sidebar.getByRole('button',{name:'Reset sizes',exact:true}).click();
  const thumbPositions=await sidebar.locator('.spo-plate-size,.spo-text-size').evaluateAll(inputs=>inputs.map(input=>{
    const rect=input.getBoundingClientRect();return rect.x+rect.width*(Number(input.value)-Number(input.min))/(Number(input.max)-Number(input.min));
  }));
  if (Math.abs(thumbPositions[0]-thumbPositions[1])>.5) throw new Error('Default size sliders do not align.');
  for (const [label,color] of [['Clockwise badge color','#34c759'],['Counter-clockwise badge color','#ff9500']]) {
    await sidebar.getByLabel(label,{exact:true}).evaluate((input,color)=>{input.value=color;input.dispatchEvent(new Event('input',{bubbles:true}));},color);
  }
  console.log('Aligned default slider positions:',thumbPositions);
  for (const [label,value] of [['Floating opacity','75']]) {
    await sidebar.getByLabel(label).evaluate((input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));},value);
  }
  const appearance=await floating.evaluate(panel=>({width:panel.getBoundingClientRect().width,height:panel.getBoundingClientRect().height,opacity:getComputedStyle(panel).opacity}));
  console.log('Floating control appearance:',appearance);
  if (appearance.width!==110 || appearance.height>50 || appearance.opacity!=='0.75') throw new Error('Floating control size or opacity is incorrect.');
  const startingBox=await floating.boundingBox();
  const grip=await floating.getByRole('button',{name:'Move floating controls',exact:true}).boundingBox();
  await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2); await page.mouse.down();
  await page.mouse.move(grip.x+grip.width/2+100,grip.y+grip.height/2-80,{steps:8}); await page.mouse.up();
  if (Math.round((await floating.boundingBox()).x-startingBox.x)!==100) throw new Error('Panel did not drag.');
  await floating.getByRole('button',{name:'Hide floating controls'}).click(); await sidebar.getByLabel('Show floating controls').check();
  if (Math.round((await floating.boundingBox()).x)!==Math.round(startingBox.x)) throw new Error('Closing the panel did not reset its position.');
  await floating.waitFor({state:'visible'});
  await floating.getByRole('button',{name:'Hide floating controls'}).click();
  if (await sidebar.getByLabel('Show floating controls').isChecked()) throw new Error('Floating controls did not synchronize.');
  await sidebar.getByLabel('Show floating controls').check();
  if (await floating.getByRole('button',{name:'Force on top'}).getAttribute('aria-pressed') !== 'true') await floating.getByRole('button',{name:'Force on top'}).click();
  await page.waitForFunction(()=>document.querySelector('.spo-top')?.getAttribute('aria-pressed')==='true');
  const handle = await page.evaluateHandle(async () => {
    const sdk = window.getWmeSdk({scriptId:'spo-smoke-inspection',scriptName:'Speed Plate Inspection',mode:'async'});
    const first = await sdk.Map.getFeatureDomElement({layerName:'Taiwan government speed plates',featureId:'sp-2'});
    for (let parent = first?.parentElement; parent; parent = parent.parentElement) { parent.scrollTop = 0; parent.scrollLeft = 0; }
    for (let row = 2; row < 22; row++) {
      const element = await sdk.Map.getFeatureDomElement({layerName:'Taiwan government speed plates',featureId:`sp-${row}`});
      const rect = element?.getBoundingClientRect();
      if (rect && rect.width < 200 && rect.width > 0 && rect.x > 420 && rect.y > 100 && rect.right < innerWidth-30 && rect.bottom < innerHeight-30) return element;
    }
    return null;
  });
  const element = handle.asElement();
  if (!element) throw new Error('The sample plate DOM element is not visible at this map position.');
  const box = await element.boundingBox();
  if (!box) throw new Error('Plate has no visible bounds.');
  console.log('Default marker dimensions:',box.width,box.height);
  if (Math.abs(box.width-56)>2 || Math.abs(box.height-56)>2) throw new Error('Default marker dimensions are incorrect.');
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  await page.waitForSelector('.spo-popup');
  console.log('Popup:',await page.locator('.spo-popup').innerText());
  if (await sidebar.locator('.spo-columns').isVisible()) await sidebar.getByRole('heading',{name:'台灣速限標牌疊圖'}).click();
  else await page.getByText('Popup columns',{exact:true}).click();
  if (await page.locator('.spo-popup').count()) throw new Error('Outside click did not close the popup.');
  await page.getByLabel('備註',{exact:true}).check();
  const rows=page.locator('.spo-column-row');
  await rows.nth(3).scrollIntoViewIfNeeded();
  const firstName=await rows.first().locator('label span').textContent();
  await page.getByRole('button',{name:`Reorder ${firstName}`,exact:true}).dragTo(rows.nth(2),{targetPosition:{x:60,y:2}});
  if (await rows.first().locator('label span').textContent()===firstName) throw new Error('The right-hand field grip did not reorder the list.');
  const expectedColumns = await page.locator('.spo-column-row').evaluateAll(rows=>rows.filter(row=>row.querySelector('input')?.checked).map(row=>row.querySelector('label span').textContent));
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  await page.waitForFunction(()=>document.querySelector('.spo-popup')?.textContent?.includes('備註'));
  const actualColumns = await page.locator('.spo-popup dt').allTextContents();
  if (JSON.stringify(actualColumns)!==JSON.stringify(expectedColumns)) throw new Error('Popup did not follow the configured field order.');
  console.log('Popup field order:',actualColumns);
  // Only plugin controls are clicked; no road selection or edit API is used.
  console.log('Sidebar:',await page.locator('.spo-panel').evaluate(el=>({width:el.getBoundingClientRect().width,text:el.textContent})));
  console.log('Page errors:',errors);
  await mkdir(new URL('../../test-results/',import.meta.url),{recursive:true});
  await page.screenshot({path:new URL('../../test-results/real-wme.png',import.meta.url).pathname});
  await page.getByRole('heading',{name:'台灣速限標牌疊圖'}).click();
  if (await page.locator('.spo-popup').count()) throw new Error('Outside sidebar click did not dismiss the popup.');
  console.log('Floating hide/restore, top control, popup columns and outside-click dismissal passed.');
  await page.locator('.spo-language').selectOption('zh-TW');
  await sidebar.getByRole('button',{name:'使用條款',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'使用條款'});
  await dialog.waitFor();
  if (!(await dialog.innerText()).includes('不會修改或儲存 WME 道路資料')) throw new Error('Localized terms missing.');
  await page.screenshot({path:new URL('../../test-results/real-wme-terms.png',import.meta.url).pathname});
  await page.keyboard.press('Escape');
  if (await dialog.count()) throw new Error('Terms Escape dismissal failed.');
  console.log('Traditional Chinese interface and terms verified in WME.');
} finally { await browser.close(); }

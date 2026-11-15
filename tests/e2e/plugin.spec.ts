import { expect, test } from '@playwright/test';
test.beforeEach(async ({page}) => {
  await page.goto('/mock-wme-sdk.html');
  await page.locator('.spo-language').selectOption('en');
});
const csv = 'longitude,latitude,speed,direction,note\n121.5,25,50,順向,<script>alert(1)</script>\n121.51,25.01,30,逆向,hello';
test('optional circular arrows persist and facing-direction guidance switches between both languages', async ({page}) => {
  const style = page.getByLabel('Arrow style',{exact:true});
  await expect(style).toHaveValue('four-direction');
  const help = page.locator('.spo-appearance-card #spo-arrow-help');
  await expect(style).toHaveAttribute('aria-describedby','spo-arrow-help');
  await expect(help.locator('.spo-four-direction-help')).toBeVisible();
  await expect(help.locator('.spo-four-direction-help')).toContainText('↑ means this plate applies to northbound traffic');
  await expect(help.locator('.spo-circular-help')).toBeHidden();
  await expect(page.locator('.spo-card').filter({has:page.getByLabel('Show speed plates')})).not.toContainText('northbound');
  await page.getByLabel('Government CSV').setInputFiles({name:'optional.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await style.selectOption('circular');
  await expect(help.locator('.spo-four-direction-help')).toBeHidden();
  await expect(help.locator('.spo-circular-help')).toBeVisible();
  await expect(help.locator('.spo-circular-help')).toContainText('may face south, so its speed limit applies to northbound traffic');
  const first = page.getByRole('button',{name:'50',exact:true});
  const second = page.getByRole('button',{name:'30',exact:true});
  await expect.poll(async()=>decodeURIComponent((await first.locator('img').getAttribute('src'))!)).toContain('M18 14 A7 7');
  await expect.poll(async()=>decodeURIComponent((await second.locator('img').getAttribute('src'))!)).toContain('scale(-1 1)');
  await first.click();
  await expect(page.locator('.spo-popup strong')).toContainText('↻ 順向');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(style).toHaveValue('circular');
  await expect(page.locator('.plate')).toHaveCount(2);
  await second.click();
  await expect(page.locator('.spo-popup strong')).toContainText('↺ 逆向');
  await page.keyboard.press('Escape');
  await page.locator('.spo-language').selectOption('zh-TW');
  await expect(page.getByLabel('箭頭樣式',{exact:true})).toHaveValue('circular');
  await expect(page.getByRole('option',{name:'四方向（預設）',exact:true})).toHaveCount(1);
  await expect(page.getByRole('option',{name:'順時針／逆時針',exact:true})).toHaveCount(1);
  await expect(help.locator('.spo-circular-help')).toContainText('順時針面向的標牌可能朝南，因此其速限適用於北向車流');
  await page.getByLabel('箭頭樣式',{exact:true}).selectOption('four-direction');
  await expect(help.locator('.spo-four-direction-help')).toBeVisible();
  await expect(help.locator('.spo-four-direction-help')).toContainText('↑ 表示此標牌的速限適用於北向車流');
  await expect(help.locator('.spo-circular-help')).toBeHidden();
  await page.getByLabel('箭頭樣式',{exact:true}).selectOption('circular');
  await page.locator('.spo-language').selectOption('en');
  await style.selectOption('four-direction');
  await expect.poll(async()=>decodeURIComponent((await first.locator('img').getAttribute('src'))!)).toContain('>?</text>');
  await page.reload();
  await expect(style).toHaveValue('four-direction');
});
test('road numbers drive four arrow directions and custom colors update stroke contrast', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const roads = 'longitude,latitude,speed,direction,公路編號\n121.5,25,50,順向,台2\n121.51,25.01,60,逆向,台2甲\n121.52,25.02,70,順向,台1\n121.53,25.03,80,逆向,台3';
  await page.getByLabel('Government CSV').setInputFiles({name:'directions.csv',mimeType:'text/csv',buffer:Buffer.from(roads)});
  for (const [speed,rotation,symbol] of [['50',0,'→'],['60',180,'←'],['70',90,'↓'],['80',270,'↑']] as const) {
    const marker = page.getByRole('button',{name:speed,exact:true});
    await expect.poll(async()=>decodeURIComponent((await marker.locator('img').getAttribute('src'))!)).toContain(`rotate(${rotation} 10 10)`);
    await expect.poll(()=>marker.locator('img').evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBe(56);
    await marker.click();
    await expect(page.locator('.spo-popup strong')).toContainText(`${speed} km/h · ${symbol}`);
    await page.keyboard.press('Escape');
  }
  for (const [label,speeds] of [['Clockwise badge color',['50','70']],['Counter-clockwise badge color',['60','80']]] as const) {
    for (const [color,ink] of [['#123456','#ffffff'],['#abcdef','#000000']] as const) {
      await page.getByLabel(label,{exact:true}).evaluate((input:HTMLInputElement,color)=>{
        input.value=color; input.dispatchEvent(new Event('input',{bubbles:true}));
      },color);
      for (const speed of speeds) {
        const image = page.getByRole('button',{name:speed,exact:true}).locator('img');
        await expect.poll(async()=>decodeURIComponent((await image.getAttribute('src'))!)).toContain(`stroke="${ink}" stroke-width="2.5"`);
      }
    }
  }
  await page.screenshot({path:'test-results/fixture-four-directions.png'});
  expect(errors).toEqual([]);
});
test('automatically remembers a CSV, preserves it on invalid replacement and clears it across refresh', async ({page}) => {
  const input = page.getByLabel('Government CSV');
  await input.setInputFiles({name:'remembered.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await expect(page.locator('.spo-status')).toContainText('remembered.csv: 2 plates');
  await page.reload();
  await expect(page.locator('.plate')).toHaveCount(2);
  await expect(page.locator('.spo-status')).toContainText('remembered.csv: 2 plates');
  await input.setInputFiles({name:'bad.csv',mimeType:'text/csv',buffer:Buffer.from('broken')});
  await expect(page.locator('.spo-status')).toContainText('Missing required');
  await page.reload(); await expect(page.locator('.plate')).toHaveCount(2);
  await page.getByRole('button',{name:'Clear saved CSV',exact:true}).click();
  await expect(page.locator('.spo-status')).toHaveText('Choose a government CSV to begin.');
  await expect(page.locator('.plate')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.spo-status')).toHaveText('Choose a government CSV to begin.');
  await expect(page.getByLabel('Show speed plates')).toBeDisabled();
});

test('storage failure reports a warning while the imported overlay remains usable', async ({page}) => {
  await page.addInitScript(() => { Object.defineProperty(window,'indexedDB',{get() { throw new Error('Storage unavailable'); }}); });
  await page.reload();
  await expect(page.locator('.spo-status')).toContainText('could not be restored');
  await page.getByLabel('Government CSV').setInputFiles({name:'local.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await expect(page.locator('.spo-status')).toContainText('could not be saved');
  await expect(page.locator('.plate')).toHaveCount(2);
});
test('built userscript imports local CSV, toggles layer, selects popup columns and restores settings', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/mock-wme-sdk.html');
  await expect(page.getByRole('heading', { name: '台灣速限標牌疊圖' })).toBeVisible();
  await expect(page.getByLabel('Badge position')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Popup columns',exact:true})).toBeVisible();
  await expect(page.locator('.spo-panel details,.spo-panel summary')).toHaveCount(0);
  for (const card of ['.spo-appearance-card','.spo-columns-card']) {
    await expect(page.locator(card+' .spo-card-header button')).toBeVisible();
    await expect(page.locator(card+' .spo-card-header')).toHaveCSS('margin-bottom','10px');
  }
  await expect(page.locator('.spo-version')).toHaveText(/^v\d+\.\d+\.\d+$/);
  await expect(page.locator('.spo-version')).toHaveAttribute('href', /releases\/tag\/v\d+\.\d+\.\d+$/);
  await page.getByLabel('Government CSV').setInputFiles({ name: 'sample.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByRole('button', { name: '50', exact: true })).toBeVisible();
  await page.locator('.spo-panel').getByRole('button', { name: 'Force on top' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as {fixture:{zIndex:number}}).fixture.zIndex)).toBe(10000);
  await page.getByText('Popup columns', { exact: true }).click();
  await page.getByLabel('note', { exact: true }).check();
  await page.getByRole('button', { name: '50', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Speed plate details' })).toContainText('<script>alert(1)</script>');
  await page.keyboard.press('Escape'); await expect(page.locator('.spo-popup')).toHaveCount(0);
  await page.evaluate(() => (window as unknown as {fixture:{emit:(name:string,payload:unknown)=>void}}).fixture.emit('wme-map-mouse-click',{lon:121.5,lat:25,x:400,y:180}));
  await expect(page.getByRole('region',{name:'Speed plate details'})).toContainText('50 km/h');
  await page.keyboard.press('Escape');
  await page.getByLabel('Show speed plates').uncheck(); await expect(page.locator('.plate')).toHaveCount(0);
  await page.reload(); await expect(page.locator('.spo-panel').getByRole('button', { name: 'Force on top' })).toHaveAttribute('aria-pressed','true');
  await page.evaluate(() => document.documentElement.setAttribute('wz-theme','dark'));
  await expect(page.locator('.spo-panel')).toBeVisible(); expect(errors).toEqual([]);
});

test('appearance and opacity controls persist, and reordered columns determine popup order', async ({ page }) => {
  await page.goto('/mock-wme-sdk.html');
  const sidebar = page.locator('.spo-panel');
  await expect(page.locator('.spo-floating')).toHaveCSS('width','200px');
  await expect(page.locator('.spo-floating')).toHaveCSS('font-size','13px');
  await expect(page.locator('.spo-floating')).toHaveCSS('border-radius','10px');
  await expect(page.locator('.spo-floating-header')).toHaveCSS('border-bottom-width','1px');
  await expect(page.locator('.spo-floating-header')).toHaveCSS('padding','2px 12px');
  await expect(page.locator('.spo-floating-rows')).toHaveCSS('padding','6px 8px');
  await expect(page.locator('.spo-floating-row')).toHaveCSS('padding','5px 4px');
  const close=page.locator('.spo-floating .spo-close');
  await expect(close).toHaveCSS('width','22px'); await expect(close).toHaveCSS('height','22px');
  await expect(close).toHaveCSS('border-top-style','none');
  await expect(close).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await expect(close.locator('svg')).toHaveAttribute('aria-hidden','true');
  const opacity = page.getByLabel('Floating opacity');
  await opacity.focus(); await opacity.press('End');
  for (let i=0;i<5;i++) await opacity.press('ArrowLeft');
  await expect(page.locator('.spo-floating')).toHaveCSS('opacity','0.75');
  await expect(page.getByLabel('Badge position')).toBeVisible();
  await expect(page.getByLabel('Badge position')).toHaveValue('bottom-right');
  await page.getByLabel('Government CSV').setInputFiles({name:'sample.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  const marker=page.getByRole('button',{name:'50',exact:true});
  for (const [position,x,y] of [['top-left',12,12],['top-right',44,12],['bottom-left',12,44],['bottom-right',44,44]] as const) {
    await page.getByLabel('Badge position').selectOption(position);
    await expect.poll(async()=>decodeURIComponent((await marker.locator('img').getAttribute('src'))!)).toContain(`cx="${x}" cy="${y}" r="10"`);
    await page.evaluate(({x,y}) => (window as unknown as {fixture:{emit:(name:string,payload:unknown)=>void}}).fixture.emit('wme-map-mouse-click',{lon:121.5,lat:25,x:400+x-28,y:180+y-28}),{x,y});
    await expect(page.locator('.spo-popup')).toContainText('50 km/h'); await page.keyboard.press('Escape');
  }
  const size=page.getByLabel('Plate size');
  await size.evaluate((input:HTMLInputElement)=>{input.value='150';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await expect(marker.locator('img')).toHaveCSS('width','140px');
  await expect(size).toHaveAttribute('aria-valuetext','250%');
  await page.evaluate(() => (window as unknown as {fixture:{emit:(name:string,payload:unknown)=>void}}).fixture.emit('wme-map-mouse-click',{lon:121.5,lat:25,x:440,y:220}));
  await expect(page.locator('.spo-popup')).toContainText('50 km/h'); await page.keyboard.press('Escape');
  const text=page.getByLabel('Speed value size'); await text.focus(); await text.press('End');
  await expect.poll(async()=>decodeURIComponent((await marker.locator('img').getAttribute('src'))!)).toContain('font-size="42"');
  await page.getByText('Popup columns',{exact:true}).click();
  await page.getByLabel('longitude',{exact:true}).check(); await page.getByLabel('speed',{exact:true}).check();
  await page.locator('.spo-column-row').nth(3).scrollIntoViewIfNeeded();
  await page.getByRole('button',{name:'Reorder speed',exact:true}).dragTo(page.locator('.spo-column-row').filter({has:page.getByLabel('longitude',{exact:true})}),{targetPosition:{x:50,y:2}});
  await marker.click();
  await expect(page.locator('.spo-popup dt')).toHaveText(['speed','longitude']);
  await page.screenshot({path:'test-results/fixture-appearance.png'});
  await page.reload(); await expect(page.getByLabel('Badge position')).toBeVisible();
  await expect(page.getByLabel('Plate size')).toHaveValue('150');
  await expect(page.getByLabel('Speed value size')).toHaveValue('200');
  await expect(page.getByLabel('Badge position')).toHaveValue('bottom-right');
  await expect(page.locator('.spo-floating')).toHaveCSS('opacity','0.75');
  await page.getByLabel('Government CSV').setInputFiles({name:'again.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await marker.click(); await expect(page.locator('.spo-popup dt')).toHaveText(['speed','longitude']);
  await page.getByText('Popup columns',{exact:true}).click();
  await page.getByRole('button',{name:'Reset order',exact:true}).click();
  await marker.click(); await expect(page.locator('.spo-popup dt')).toHaveText(['longitude','speed']);
  await expect(page.getByLabel('speed',{exact:true})).toBeChecked();
  await page.getByRole('button',{name:'Reset sizes',exact:true}).click();
  await expect(page.getByLabel('Plate size')).toHaveValue('100');
  await expect(page.getByLabel('Speed value size')).toHaveValue('100');
  await expect.poll(async()=>decodeURIComponent((await marker.locator('img').getAttribute('src'))!)).toContain('font-size="21"');
  await expect(sidebar).toBeVisible();
});

test('default sliders align, right-hand NLSC grips work, and per-direction badge colors persist', async ({page}) => {
  await page.goto('/mock-wme-sdk.html');
  await expect(page.getByLabel('Badge position')).toBeVisible();
  const plate=page.getByLabel('Plate size'), value=page.getByLabel('Speed value size');
  await expect(plate).toHaveValue('100'); await expect(value).toHaveValue('100');
  const sliderPosition = (input:HTMLInputElement) => {
    const rect=input.getBoundingClientRect(); return rect.x+rect.width*(Number(input.value)-Number(input.min))/(Number(input.max)-Number(input.min));
  };
  expect(await plate.evaluate(sliderPosition)).toBeCloseTo(await value.evaluate(sliderPosition),1);
  await expect(plate).toHaveAttribute('aria-valuetext','100%'); await expect(value).toHaveAttribute('aria-valuetext','100%');
  const clockwise=page.getByLabel('Clockwise badge color',{exact:true});
  const counterclockwise=page.getByLabel('Counter-clockwise badge color',{exact:true});
  await expect(clockwise).toHaveValue('#34c759'); await expect(counterclockwise).toHaveValue('#ff9500');
  await page.getByLabel('Government CSV').setInputFiles({name:'sample.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  const first=page.getByRole('button',{name:'50',exact:true}).locator('img');
  const second=page.getByRole('button',{name:'30',exact:true}).locator('img');
  await expect.poll(async()=>decodeURIComponent((await first.getAttribute('src'))!)).toContain('r="10" fill="#34c759"');
  await expect.poll(async()=>decodeURIComponent((await second.getAttribute('src'))!)).toContain('r="10" fill="#ff9500"');
  await clockwise.evaluate((input:HTMLInputElement)=>{input.value='#123456';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await counterclockwise.evaluate((input:HTMLInputElement)=>{input.value='#abcdef';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await expect.poll(async()=>decodeURIComponent((await first.getAttribute('src'))!)).toContain('r="10" fill="#123456"');
  await expect.poll(async()=>decodeURIComponent((await second.getAttribute('src'))!)).toContain('r="10" fill="#abcdef"');
  await page.getByText('Popup columns',{exact:true}).click();
  const row=page.locator('.spo-column-row').first(), label=(await row.locator('label').boundingBox())!, grip=(await row.locator('.spo-drag-handle').boundingBox())!;
  expect(grip.x).toBeGreaterThanOrEqual(label.x+label.width);
  await expect(row.locator('.spo-drag-handle')).toHaveText('⋮⋮');
  await expect(row.locator('.spo-drag-handle')).toHaveCSS('border-top-style','none');
  await expect(page.locator('#spo-order-help')).toHaveText('Select fields to display. Drag the right-hand grips to set their order.');
  await page.screenshot({path:'test-results/fixture-nlsc-style.png'});
  await page.reload(); await expect(page.getByLabel('Badge position')).toBeVisible();
  await expect(clockwise).toHaveValue('#123456'); await expect(counterclockwise).toHaveValue('#abcdef');
});

test('floating panel drags, clamps and resets on close, while popup width follows its content', async ({page}) => {
  await page.goto('/mock-wme-sdk.html');
  const panel=page.locator('.spo-floating'), grip=page.getByRole('button',{name:'Move floating controls',exact:true});
  const initial=(await panel.boundingBox())!, handle=(await grip.boundingBox())!;
  await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2); await page.mouse.down();
  await page.mouse.move(handle.x+handle.width/2+160,handle.y+handle.height/2-120,{steps:8}); await page.mouse.up();
  await expect.poll(async()=>Math.round((await panel.boundingBox())!.x-initial.x)).toBe(160);
  await expect.poll(async()=>Math.round((await panel.boundingBox())!.y-initial.y)).toBe(-120);
  const opacity=page.getByLabel('Floating opacity'); await opacity.focus(); await opacity.press('ArrowLeft');
  expect(Math.round((await panel.boundingBox())!.x-initial.x)).toBe(160);
  await panel.getByRole('button',{name:'Hide floating controls'}).click();
  await page.getByLabel('Show floating controls').check();
  expect(Math.round((await panel.boundingBox())!.x)).toBe(Math.round(initial.x));
  expect(Math.round((await panel.boundingBox())!.y)).toBe(Math.round(initial.y));
  await grip.focus(); await grip.press('ArrowRight');
  expect(Math.round((await panel.boundingBox())!.x-initial.x)).toBe(10);
  await grip.press('Home'); expect(Math.round((await panel.boundingBox())!.x)).toBe(Math.round(initial.x));
  await page.getByLabel('Government CSV').setInputFiles({name:'sample.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await page.getByText('Popup columns',{exact:true}).click(); await page.getByLabel('speed',{exact:true}).check();
  const marker=page.getByRole('button',{name:'50',exact:true}); await marker.click();
  const popup=page.locator('.spo-popup'); await expect(popup).toBeVisible();
  expect((await popup.boundingBox())!.width).toBeLessThan(280);
  await page.keyboard.press('Escape');
  await page.getByLabel('Government CSV').setInputFiles({name:'long.csv',mimeType:'text/csv',buffer:Buffer.from('longitude,latitude,speed,direction,note\n121.5,25,50,順向,'+'long-value'.repeat(70))});
  await page.getByLabel('note',{exact:true}).check();
  await page.setViewportSize({width:500,height:650});
  await expect.poll(async()=>{const box=(await panel.boundingBox())!;return box.x+box.width;}).toBeLessThanOrEqual(488);
  await marker.click(); await expect(popup).toBeVisible();
  const bounds=(await popup.boundingBox())!;
  expect(bounds.width).toBeLessThanOrEqual(360); expect(bounds.x+bounds.width).toBeLessThanOrEqual(488);
  expect(await popup.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
  await page.screenshot({path:'test-results/fixture-drag-and-popup.png'});
});

test('failed replacement keeps the valid overlay and a narrow dark sidebar stays usable', async ({ page }) => {
  await page.setViewportSize({width:800,height:650});
  await page.goto('/mock-wme-sdk.html');
  await page.evaluate(() => document.documentElement.setAttribute('wz-theme','dark'));
  const input = page.getByLabel('Government CSV');
  await input.setInputFiles({name:'valid.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await expect(page.locator('.plate')).toHaveCount(2);
  await input.setInputFiles({name:'invalid.csv',mimeType:'text/csv',buffer:Buffer.from('broken')});
  await expect(page.locator('.spo-status')).toContainText('Missing required');
  await expect(page.locator('.plate')).toHaveCount(2);
  await page.locator('.spo-panel').getByRole('button',{name:'Force on top'}).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.spo-panel').getByRole('button',{name:'Force on top'})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.spo-floating')).toHaveCSS('background-color','rgb(31, 32, 36)');
  await expect(page.locator('.spo-floating-header')).toHaveCSS('background-color','rgba(255, 255, 255, 0.05)');
  await page.screenshot({path:'test-results/fixture-dark.png'});
});

test('floating controls synchronize, hide and restore; popup dismisses only on outside clicks', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/mock-wme-sdk.html');
  const floating = page.getByRole('region', {name:'Speed plate layer controls'});
  const sidebar = page.locator('.spo-panel');
  await expect(floating).toBeVisible();
  for (const view of [sidebar,floating]) {
    const button=view.getByRole('button',{name:'Force on top'});
    await expect(button).toHaveCSS('width','26px'); await expect(button).toHaveCSS('height','22px');
    await expect(button.locator('svg')).toHaveAttribute('aria-hidden','true');
    await expect(button).toHaveAttribute('aria-pressed','false');
  }
  await floating.getByRole('button',{name:'Force on top'}).click();
  await expect(sidebar.getByRole('button',{name:'Force on top'})).toHaveAttribute('aria-pressed','true');
  await expect(floating.getByRole('button',{name:'Force on top'})).toHaveCSS('background-color','rgb(255, 149, 0)');
  await page.screenshot({path:'test-results/fixture-top-button.png'});
  await floating.getByRole('button',{name:'Hide floating controls'}).click();
  await expect(floating).toBeHidden();
  await expect(page.getByLabel('Show floating controls')).not.toBeChecked();
  await page.reload(); await expect(page.locator('.spo-floating')).toBeHidden();
  await page.getByLabel('Show floating controls').check(); await expect(floating).toBeVisible();
  await sidebar.getByRole('button',{name:'Force on top'}).click();
  await expect(floating.getByRole('button',{name:'Force on top'})).toHaveAttribute('aria-pressed','false');
  await page.getByLabel('Government CSV').setInputFiles({name:'sample.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await page.getByText('Popup columns',{exact:true}).click();
  await expect(sidebar.locator('.spo-columns label').first()).toHaveCSS('column-gap','8px');
  const marker = page.getByRole('button',{name:'50',exact:true});
  await expect.poll(()=>marker.locator('img').evaluate((image: HTMLImageElement)=>image.naturalWidth)).toBe(56);
  const svg = await marker.locator('img').getAttribute('src');
  expect(decodeURIComponent(svg!)).toContain('>50</text>');
  expect(decodeURIComponent(svg!)).not.toContain('↻');
  await marker.click();
  const popup = page.getByRole('region',{name:'Speed plate details'});
  await popup.locator('strong').click(); await expect(popup).toBeVisible();
  await expect(popup.getByRole('button',{name:'Close details'})).toHaveCSS('border-radius','8px');
  await page.screenshot({path:'test-results/fixture-improvements.png'});
  await page.getByRole('heading',{name:'台灣速限標牌疊圖'}).click();
  await expect(popup).toHaveCount(0);
  await marker.click(); await expect(popup).toBeVisible();
  await page.getByRole('heading',{name:'Deterministic map fixture'}).click();
  await expect(popup).toHaveCount(0);
  await marker.click(); await popup.getByRole('button',{name:'Close details'}).click();
  await expect(popup).toHaveCount(0); expect(errors).toEqual([]);
});


test('Traditional Chinese defaults, language switching preserves imported data, and terms are accessible', async ({page}) => {
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await expect(page.locator('.spo-language')).toHaveValue('zh-TW');
  await expect(page.getByRole('heading',{name:'台灣速限標牌疊圖'})).toBeVisible();
  await page.getByLabel('資料 CSV').setInputFiles({name:'sample.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await page.getByText('資訊泡泡欄位',{exact:true}).click();
  await page.getByLabel('note',{exact:true}).check();
  await page.locator('.spo-floating .spo-top').click();
  await page.locator('.spo-language').selectOption('en');
  await expect(page.locator('.plate')).toHaveCount(2);
  await expect(page.locator('.spo-panel .spo-top')).toHaveAttribute('aria-pressed','true');
  await expect(page.getByLabel('note',{exact:true})).toBeChecked();
  await page.getByRole('button',{name:'50',exact:true}).click();
  await expect(page.getByRole('region',{name:'Speed plate details'})).toContainText('<script>alert(1)</script>');
  await page.locator('.spo-language').selectOption('zh-TW');
  await expect(page.locator('.spo-floating')).toHaveAttribute('aria-label','速限標牌圖層控制');
  const terms=page.getByRole('button',{name:'使用條款',exact:true}); await terms.click();
  const dialog=page.getByRole('dialog',{name:'使用條款'}); await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('不會修改或儲存 WME 道路資料');
  await expect(dialog.getByRole('button',{name:'關閉',exact:true})).toBeFocused();
  await page.keyboard.press('Tab'); await expect(dialog.locator('.spo-modal-body')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(dialog.getByRole('button',{name:'關閉',exact:true})).toBeFocused();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(terms).toBeFocused();
  await terms.click(); await dialog.getByRole('heading',{name:'工具性質與獨立性'}).click(); await expect(dialog).toBeVisible();
  await page.locator('.spo-modal-backdrop').click({position:{x:3,y:3}}); await expect(dialog).toHaveCount(0);
  await page.locator('.spo-language').selectOption('en'); await page.getByRole('button',{name:'Usage terms'}).click();
  await expect(page.getByRole('dialog',{name:'Usage terms'})).toContainText('does not establish permission to import it into Waze');
  await page.keyboard.press('Escape'); await page.reload();
  await expect(page.locator('.spo-language')).toHaveValue('en');
  await expect(page.locator('.spo-panel .spo-top')).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('heading',{name:'台灣速限標牌疊圖'})).toBeVisible();
});

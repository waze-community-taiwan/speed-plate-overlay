import { version as scriptVersion } from '../package.json';
import { localize, t, importStatus, type Language } from './i18n';
import { openTermsDialog } from './terms';
import { orderedColumns, type Controller } from './controller';
import type { BadgePosition } from './types';
import { scaleToSlider, sliderToScale } from './size-scale';
import { TOP_LAYER_BUTTON } from './top-button';
export function mountSidebar(root: HTMLElement, controller: Controller) {
  root.classList.add('spo-panel');
  root.innerHTML = `<h4>台灣速限標牌疊圖</h4>
    <label class="spo-appearance-label">Language <select class="spo-language" aria-label="Language"><option value="zh-TW">繁體中文</option><option value="en">English</option></select></label>
    <div class="spo-card"><label>Government CSV (UTF-8)<input class="spo-file" type="file" accept=".csv,text/csv"></label>
    <p class="spo-status" role="status" aria-live="polite"></p><button class="spo-clear-file" type="button">Clear saved CSV</button></div>
    <div class="spo-card"><label class="spo-row">Show speed plates <span class="spo-switch"><input class="spo-enabled" type="checkbox"><span></span></span></label>
    <div class="spo-row spo-top-row"><span>Force on top</span>${TOP_LAYER_BUTTON}</div>
    <label class="spo-row spo-floating-setting">Show floating controls <input class="spo-floating-enabled" type="checkbox"></label>
    <label class="spo-range-label">Floating opacity <span class="spo-range"><input class="spo-opacity" type="range" min="10" max="100" step="5"><output class="spo-opacity-value"></output></span></label>
    <p>↻ 順向 · ↺ 逆向 · ? unknown<br>Direction follows the source road reference, not a compass bearing.</p></div>
    <section class="spo-card spo-appearance-card"><div class="spo-card-header"><h5>Plate appearance</h5><button class="spo-reset-size" type="button">Reset sizes</button></div>
    <label class="spo-appearance-label">Badge position <select class="spo-badge-position"><option value="top-left">Top left</option><option value="top-right">Top right</option><option value="bottom-left">Bottom left</option><option value="bottom-right">Bottom right</option></select></label>
    <label class="spo-row spo-color-row">Clockwise badge color <input class="spo-clockwise-color" type="color"></label>
    <label class="spo-row spo-color-row">Counter-clockwise badge color <input class="spo-counterclockwise-color" type="color"></label>
    <label class="spo-range-label">Plate size <span class="spo-range"><input class="spo-plate-size" type="range" min="0" max="200" step="any"><output class="spo-plate-size-value"></output></span></label>
    <label class="spo-range-label">Speed value size <span class="spo-range"><input class="spo-text-size" type="range" min="0" max="200" step="any"><output class="spo-text-size-value"></output></span></label>
    <p>100% uses the standard plate and larger speed value. Long values are fitted inside the circle.</p></section>
    <section class="spo-card spo-columns-card"><div class="spo-card-header"><h5>Popup columns</h5><button class="spo-reset-order" type="button">Reset order</button></div><p id="spo-order-help">Select fields to display. Drag the right-hand grips to set their order.</p><div class="spo-columns"></div><span class="spo-order-status" role="status" aria-live="polite"></span></section>
    <p>CSV files are saved automatically in this browser and restored after refresh. Clear saved CSV removes the saved copy and overlay.</p><footer class="spo-terms-footer"><button type="button" class="spo-terms-link">Usage terms</button><a class="spo-version" href="https://github.com/waze-community-taiwan/speed-plate-overlay/releases/tag/v${scriptVersion}" target="_blank" rel="noopener noreferrer">v${scriptVersion}</a></footer>`;
  const language = root.querySelector<HTMLSelectElement>('.spo-language')!;
  language.onchange = () => controller.settings({language: language.value as Language});
  root.querySelector<HTMLButtonElement>('.spo-terms-link')!.onclick = () => openTermsDialog(controller);
  const file = root.querySelector<HTMLInputElement>('.spo-file')!;
  const clearFile = root.querySelector<HTMLButtonElement>('.spo-clear-file')!;
  clearFile.onclick = () => { file.value = ''; void controller.clearFile(); };
  const enabled = root.querySelector<HTMLInputElement>('.spo-enabled')!;
  const top = root.querySelector<HTMLButtonElement>('.spo-top')!;
  const floating = root.querySelector<HTMLInputElement>('.spo-floating-enabled')!;
  const opacity = root.querySelector<HTMLInputElement>('.spo-opacity')!;
  const plateSize = root.querySelector<HTMLInputElement>('.spo-plate-size')!;
  const textSize = root.querySelector<HTMLInputElement>('.spo-text-size')!;
  const badgePosition = root.querySelector<HTMLSelectElement>('.spo-badge-position')!;
  const clockwiseColor = root.querySelector<HTMLInputElement>('.spo-clockwise-color')!;
  const counterclockwiseColor = root.querySelector<HTMLInputElement>('.spo-counterclockwise-color')!;
  clockwiseColor.oninput = () => controller.settings({clockwiseColor:clockwiseColor.value});
  counterclockwiseColor.oninput = () => controller.settings({counterclockwiseColor:counterclockwiseColor.value});
  opacity.oninput = () => controller.settings({ floatingOpacity: Number(opacity.value)/100 });
  plateSize.oninput = () => controller.settings({ plateScale: sliderToScale(Number(plateSize.value),4) });
  textSize.oninput = () => controller.settings({ speedTextScale: sliderToScale(Number(textSize.value),2) });
  badgePosition.onchange = () => controller.settings({ badgePosition: badgePosition.value as BadgePosition });
  root.querySelector<HTMLButtonElement>('.spo-reset-size')!.onclick = () => controller.settings({plateScale:1,speedTextScale:1});
  root.querySelector<HTMLButtonElement>('.spo-reset-order')!.onclick = () => {
    controller.resetColumnOrder(); root.querySelector('.spo-order-status')!.textContent = t(controller.state.language, 'Order reset to the CSV column order.');
  };
  floating.onchange = () => controller.settings({ floatingControls: floating.checked });
  file.onchange = () => { if (file.files?.[0]) void controller.importFile(file.files[0]); };
  enabled.onchange = () => controller.settings({ enabled: enabled.checked });
  top.onclick = () => controller.settings({ forceOnTop: !controller.state.forceOnTop });
  let previousOrder = '';
  let previousLanguage = controller.state.language;
  let draggedColumn: string | null = null;
  const clearDrag = () => {
    draggedColumn = null;
    root.querySelectorAll<HTMLElement>('.spo-column-row').forEach(row => {
      row.draggable = false; row.classList.remove('spo-dragging','spo-drop-before','spo-drop-after');
    });
  };
  const announceMove = (header: string) => {
    const order = orderedColumns(controller.state);
    root.querySelector('.spo-order-status')!.textContent = controller.state.language === 'en' ? `${header}: position ${order.indexOf(header)+1} of ${order.length}` : `${header}：第 ${order.indexOf(header)+1}／${order.length} 項`;
  };
  return controller.subscribe(() => {
    const state = controller.state;
    if (previousLanguage !== state.language) root.querySelector('.spo-order-status')!.textContent = '';
    previousLanguage = state.language;
    language.value = state.language; localize(root, state.language);
    clearFile.disabled = state.loading;
    enabled.checked = state.enabled; enabled.disabled = !state.records.length;
    top.setAttribute('aria-pressed', String(state.forceOnTop));
    floating.checked = state.floatingControls;
    root.querySelector<HTMLButtonElement>('.spo-reset-order')!.disabled = !state.headers.length;
    badgePosition.value = state.badgePosition;
    clockwiseColor.value = state.clockwiseColor; counterclockwiseColor.value = state.counterclockwiseColor;
    for (const [input, output, value, maximum] of [
      [opacity, '.spo-opacity-value', state.floatingOpacity, null],
      [plateSize, '.spo-plate-size-value', state.plateScale, 4],
      [textSize, '.spo-text-size-value', state.speedTextScale, 2],
    ] as const) {
      input.value = String(maximum === null ? Math.round(value*100) : scaleToSlider(value,maximum));
      input.setAttribute('aria-valuetext',`${Math.round(value*100)}%`);
      root.querySelector(output)!.textContent = `${Math.round(value*100)}%`;
    }
    root.querySelector('.spo-status')!.textContent = state.loading ? t(state.language,'Reading CSV…') : state.error ? t(state.language,state.error) : state.fileName ? importStatus(state.language,state.fileName,state.records.length,state.rejectedRows) : t(state.language,'Choose a government CSV to begin.');
    const order = orderedColumns(state), orderKey = JSON.stringify([state.language,order]);
    if (previousOrder !== orderKey) {
      previousOrder = orderKey;
      const focused = document.activeElement?.getAttribute('aria-label');
      const columns = root.querySelector('.spo-columns')!; columns.replaceChildren();
      for (const header of order) {
        const row = document.createElement('div'); row.className = 'spo-column-row';
        row.dataset.column = header;
        const grip = document.createElement('span'); grip.className = 'spo-drag-handle'; grip.textContent = '⋮⋮';
        grip.setAttribute('role','button'); grip.tabIndex = 0;
        grip.draggable = true;
        grip.onmousedown = () => { row.draggable = true; };
        grip.setAttribute('aria-label', state.language === 'en' ? `Reorder ${header}` : `調整順序：${header}`); grip.setAttribute('aria-describedby','spo-order-help');
        grip.title = state.language === 'en' ? `Drag ${header} to reorder. Keyboard: Alt + Arrow Up / Arrow Down.` : `拖曳 ${header} 調整順序；鍵盤：Alt + 上／下方向鍵。`;
        grip.setAttribute('aria-keyshortcuts','Alt+ArrowUp Alt+ArrowDown');
        row.onpointerdown = event => { row.draggable = event.target instanceof Element && !!event.target.closest('.spo-drag-handle'); };
        row.onpointerup = () => { if (!draggedColumn) row.draggable = false; };
        row.ondragstart = event => {
          if (!row.draggable) { event.preventDefault(); return; }
          draggedColumn = header; row.classList.add('spo-dragging');
          if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain',header); }
        };
        row.ondragover = event => {
          if (!draggedColumn || draggedColumn === header) return;
          event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
          root.querySelectorAll('.spo-drop-before,.spo-drop-after').forEach(element => element.classList.remove('spo-drop-before','spo-drop-after'));
          const rect = row.getBoundingClientRect(); row.classList.add(event.clientY > rect.top+rect.height/2 ? 'spo-drop-after' : 'spo-drop-before');
        };
        row.ondrop = event => {
          if (!draggedColumn) return;
          event.preventDefault(); const source = draggedColumn, rect = row.getBoundingClientRect();
          clearDrag(); controller.reorderColumn(source,header,event.clientY > rect.top+rect.height/2); announceMove(source);
        };
        row.ondragend = clearDrag;
        grip.onkeydown = event => {
          if (!event.altKey || !['ArrowUp','ArrowDown'].includes(event.key)) return;
          event.preventDefault(); controller.moveColumn(header,event.key === 'ArrowUp' ? -1 : 1); announceMove(header);
        };
        const label = document.createElement('label'); const input = document.createElement('input');
        const name = document.createElement('span'); name.textContent = header;
        input.type = 'checkbox'; input.checked = state.visibleColumns.includes(header);
        input.onchange = () => controller.settings({ visibleColumns: input.checked ? [...controller.state.visibleColumns, header] : controller.state.visibleColumns.filter(c => c !== header) });
        label.append(input, name); row.append(label,grip);
        columns.append(row);
      }
      if (focused) {
        Array.from(columns.querySelectorAll<HTMLElement>('.spo-drag-handle')).find(grip => grip.getAttribute('aria-label') === focused)?.focus();
      }
    }
    root.querySelectorAll<HTMLInputElement>('.spo-columns input').forEach((input, index) => { input.checked = state.visibleColumns.includes(order[index]!); });
  });
}

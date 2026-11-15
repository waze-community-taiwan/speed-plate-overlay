import type { Controller } from './controller';
import { t, type Language } from './i18n';

const sections: Record<Language, readonly (readonly [string, string])[]> = {
  'zh-TW': [
    ['工具性質與獨立性', 'Taiwan Speed Plate Overlay 為社群維護的 WME 參考工具，並非 Waze 或任何政府機關的官方產品，亦不表示獲得其背書。本工具僅顯示疊圖，不會修改或儲存 WME 道路資料。'],
    ['資料來源與使用權限', '請僅匯入您有權使用的 CSV，並自行確認各資料集的授權條件、來源機關、版本與更新日期。政府公開資料不代表可不受限制地使用；應依來源條件保留出處、授權與其他必要標示。本工具不授予資料的著作權，也不代表資料已獲准匯入 Waze。'],
    ['編輯與安全使用', '疊圖僅供查核參考，並非導航或法律上的速限依據。座標、速限、方向與現況可能有錯誤或過時；順向與逆向依原始資料的道路參考方向，並非羅盤方位。進行任何人工編輯前，請獨立查證並遵守 Waze 條款、編輯政策與在地社群規範。行車時請依現場標誌與適用規定。'],
    ['本機檔案與隱私', '本工具在瀏覽器內讀取您選取的 CSV，不會將檔案上傳至本專案的伺服器。成功匯入的 CSV 會自動儲存於此瀏覽器的 IndexedDB，重新載入後自動還原。可使用「清除已儲存 CSV」移除副本與疊圖；清除 Waze 網站資料也會移除副本。語言、外觀、欄位與圖層偏好會儲存於瀏覽器。WME 與其他擴充功能的資料處理仍依各自政策。請勿匯入未經授權的個人或機密資料。'],
    ['提供方式與責任', '本工具依現狀提供，不保證可用性、資料正確性、完整性或持續維護。您應自行評估資料與編輯決定。於適用法律允許的範圍內，維護者不對因使用本工具所生的損失負責；本說明不排除依法不得排除的權利或責任。'],
  ],
  en: [
    ['Purpose and independence', 'Taiwan Speed Plate Overlay is a community-maintained reference tool for WME. It is not an official product of, or endorsed by, Waze or any government agency. It displays an overlay only and does not modify or save WME road data.'],
    ['Data sources and permissions', 'Import only CSV files you are authorized to use. Check each dataset’s license, publishing agency, version, and update date. Public availability does not mean unrestricted use. Retain attribution, license notices, and other markings required by the source. This tool grants no rights to the data and does not establish permission to import it into Waze.'],
    ['Editing and safe use', 'The overlay is a reference for verification, not navigation or an authoritative statement of legal speed limits. Coordinates, speed values, direction, and status may be inaccurate or outdated. Forward and reverse follow the source road reference, not compass bearings. Independently verify information before any manual edit and follow Waze terms, editing policies, and local community rules. When driving, follow on-site signs and applicable rules.'],
    ['Local files and privacy', 'The tool reads your selected CSV in the browser and does not upload it to project servers. Successfully imported CSV files are saved automatically in this browser’s IndexedDB and restored after refresh. Use Clear saved CSV to remove the copy and overlay; clearing Waze site data also removes the copy. Language, appearance, column, and layer preferences are stored in your browser. WME and other extensions handle data under their own policies. Do not import unauthorized personal or confidential information.'],
    ['Availability and responsibility', 'The tool is provided as is, without guarantees of availability, accuracy, completeness, or continued maintenance. You are responsible for evaluating data and editing decisions. To the extent permitted by applicable law, maintainers are not liable for losses arising from its use. This notice does not exclude rights or responsibilities that cannot legally be excluded.'],
  ],
};
let dismiss: (() => void) | undefined;
export function openTermsDialog(controller: Controller) {
  if (dismiss) return;
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const backdrop = document.createElement('div'); backdrop.className = 'spo-modal-backdrop';
  const modal = document.createElement('section'); modal.className = 'spo-modal';
  modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true'); modal.setAttribute('aria-labelledby','spo-terms-title');
  const header = document.createElement('header');
  const title = document.createElement('h2'); title.id = 'spo-terms-title';
  const closeButton = document.createElement('button'); closeButton.type = 'button'; closeButton.className = 'spo-close'; closeButton.textContent = '×';
  const body = document.createElement('div'); body.className = 'spo-modal-body'; body.tabIndex = 0;
  header.append(title,closeButton); modal.append(header,body); backdrop.append(modal);
  const unsubscribe = controller.subscribe(() => {
    const language = controller.state.language; modal.lang = language;
    title.textContent = t(language,'Usage terms');
    closeButton.title = t(language,'Close'); closeButton.setAttribute('aria-label',t(language,'Close'));
    body.replaceChildren();
    for (const [heading, text] of sections[language]) {
      const h = document.createElement('h3'); h.textContent = heading;
      const p = document.createElement('p'); p.textContent = text; body.append(h,p);
    }
    const date = document.createElement('p'); date.className = 'spo-terms-meta';
    date.textContent = language === 'en' ? 'Updated: 2026-11-15' : '更新日期：2026-11-15'; body.append(date);
  });
  const close = () => { unsubscribe(); backdrop.remove(); document.removeEventListener('keydown',onKey,true); dismiss = undefined; if (opener?.isConnected) opener.focus(); };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
    if (event.key === 'Tab') {
      event.preventDefault(); (document.activeElement === closeButton ? body : closeButton).focus();
    }
  };
  dismiss = close; closeButton.onclick = close;
  backdrop.onclick = event => { if (event.target === backdrop) close(); };
  document.addEventListener('keydown',onKey,true); document.body.append(backdrop); closeButton.focus();
}

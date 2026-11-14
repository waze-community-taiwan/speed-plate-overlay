export type Language = 'zh-TW' | 'en';

const zh: Record<string, string> = {
  'Language': '語言', 'Government CSV (UTF-8)': '政府資料 CSV（UTF-8）',
  'Show speed plates': '顯示速限標牌', 'Force on top': '強制置頂',
  'Force speed plates above other map layers': '將速限標牌置於其他圖層上方',
  'Show floating controls': '顯示浮動控制面板', 'Floating opacity': '浮動面板不透明度',
  '↻ 順向 · ↺ 逆向 · ? unknown': '↻ 順向 · ↺ 逆向 · ? 未知',
  'Direction follows the source road reference, not a compass bearing.': '方向依原始資料的道路參考方向，並非羅盤方位。',
  'Plate appearance': '標牌外觀', 'Badge position': '方向徽章位置',
  'Top left': '左上', 'Top right': '右上', 'Bottom left': '左下', 'Bottom right': '右下',
  'Clockwise badge color': '順向徽章顏色', 'Counter-clockwise badge color': '逆向徽章顏色',
  'Plate size': '標牌大小', 'Speed value size': '速限數字大小', 'Reset sizes': '重設大小',
  '100% uses the standard plate and larger speed value. Long values are fitted inside the circle.': '100% 為標準標牌與放大的速限數字；較長的數值會自動縮放至圓框內。',
  'Popup columns': '資訊泡泡欄位',
  'Select fields to display. Drag the right-hand grips to set their order.': '勾選要顯示的欄位，拖曳右側握柄調整顯示順序。',
  'Reset order': '重設順序', 'Order reset to the CSV column order.': '已重設為 CSV 原始欄位順序。',
  'Files stay in this browser session. Reload and choose the file again. Column and layer preferences are saved.': '檔案僅保留於本次瀏覽器工作階段，重新載入後須再次選取。欄位與圖層偏好設定會自動儲存。',
  'Reading CSV…': '正在讀取 CSV…', 'Choose a government CSV to begin.': '請選取政府 CSV 資料開始使用。',
  'Speed plate layer controls': '速限標牌圖層控制', 'Move floating controls': '移動浮動控制面板',
  'Drag to move. Arrow keys move; Home resets position.': '拖曳或使用方向鍵移動；Home 鍵重設位置。',
  'Speed Plates': '速限標牌', 'Hide floating controls': '隱藏浮動控制面板', 'On top': '置頂',
  'Speed plate details': '速限標牌詳細資訊', 'Close details': '關閉詳細資訊',
  'Select columns in the Speed Plates sidebar.': '請於側邊欄勾選要顯示的資訊欄位。',
  'Usage terms': '使用條款', 'Close': '關閉',
  'Settings could not be saved in this browser.': '此瀏覽器無法儲存設定。',
  'Choose a CSV smaller than 30 MB.': '請選取小於 30 MB 的 CSV。',
  'CSV contains an unclosed quoted field.': 'CSV 含有未閉合的引號欄位。',
  'CSV is empty.': 'CSV 為空白。', 'CSV contains duplicate column names.': 'CSV 含有重複的欄位名稱。',
  'CSV contains no rows with valid WGS84 coordinates.': 'CSV 沒有包含有效 WGS84 座標的資料列。',
};
export function t(language: Language, text: string): string {
  if (language === 'en') return text;
  if (zh[text]) return zh[text];
  if (text.startsWith('Missing required column(s): ')) return text.replace('Missing required column(s): ', '缺少必要欄位：');
  if (text.startsWith('Map overlay: ')) return text.replace('Map overlay: ', '地圖疊圖：');
  return text;
}

// Remember original strings so language changes update existing controls without
// replacing file inputs, open sections, drag handlers, or the floating position.
const originals = new WeakMap<Node, string>();
const attributes = new WeakMap<Element, Map<string, string>>();
export function localize(root: HTMLElement, language: Language) {
  root.lang = language;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if ((node.parentElement?.closest('.spo-columns,.spo-status,.spo-order-status'))) continue;
    if (!originals.has(node)) originals.set(node, node.textContent ?? '');
    const source = originals.get(node)!;
    node.textContent = source.replace(source.trim(), t(language, source.trim()));
  }
  for (const element of [root, ...root.querySelectorAll('*')]) {
    if (element.closest('.spo-columns')) continue;
    let source = attributes.get(element);
    if (!source) { source = new Map(); attributes.set(element, source); }
    for (const key of ['aria-label', 'title']) {
      if (!source.has(key) && element.hasAttribute(key)) source.set(key, element.getAttribute(key)!);
      if (source.has(key)) element.setAttribute(key, t(language, source.get(key)!));
    }
  }
}
export function importStatus(language: Language, file: string, count: number, rejected: number) {
  return language === 'en' ? `${file}: ${count} plates; ${rejected} invalid rows skipped.` : `${file}：${count} 面標牌；略過 ${rejected} 列無效資料。`;
}

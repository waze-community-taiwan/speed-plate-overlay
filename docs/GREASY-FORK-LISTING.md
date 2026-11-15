# Taiwan Speed Plate Overlay

Display government speed-limit plates as a **read-only layer in Waze Map Editor**. Import your own compatible UTF-8 CSV locally; the script does not edit or save road segments.

## Use

1. Install with Tampermonkey, open production WME, and sign in.
2. Open **Scripts → 台灣速限標牌疊圖**. Choose your government CSV.
3. Toggle the layer and use the stacked-layer button to force it on top.
4. Click a plate for original data. Choose and drag the popup fields into your preferred order.

Traditional Chinese is the default interface language; select English in the sidebar. Adjust plate and speed-value sizes, badge corner and direction colors. A draggable floating panel provides quick access to the layer-order button, with adjustable opacity. Settings survive reload; select the CSV again after reloading.

## Compatible data

CSV requires WGS84 longitude, latitude, speed, and direction fields. Supported government headers include **坐標-E-WGS84**, **坐標-N-WGS84**, **牌面內容**, and **牌面方向**. English aliases include `longitude`, `latitude`, `speed`, and `direction`. Maximum file size: 30 MB.

Green ↻ and orange ↺ badges distinguish **順向 / 逆向** according to the source road reference. They are not compass bearings. Other direction values show a gray question mark.

## Privacy and usage

Selected CSV records stay in the current browser session; this script does not upload them to project servers. Preferences are stored locally. Check the source dataset’s license and attribution requirements. Independently verify data and follow Waze editing policies before any manual edits. This community tool is not an official Waze or government product. Full usage terms are available in the sidebar.

[Source, documentation, and issue reporting](https://github.com/waze-community-taiwan/speed-plate-overlay). Source code is MIT licensed; CSV datasets retain their own licenses.

---

繁體中文：本套件在 WME 顯示唯讀速限標牌疊圖。於「台灣速限標牌疊圖」側邊欄選取 CSV，點擊標牌查看原始資料，並自訂欄位、順序、大小與方向徽章。資料僅供查核參考，使用前請確認來源授權，人工編輯前須獨立查證。本套件不會修改或儲存道路資料。

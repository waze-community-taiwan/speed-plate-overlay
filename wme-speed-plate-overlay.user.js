// ==UserScript==
// @name         Taiwan Speed Plate Overlay
// @namespace    https://github.com/waze-community-taiwan
// @version      0.1.4
// @description  Display government speed-limit plates as a read-only WME map layer.
// @description:zh-TW 在 Waze 地圖編輯器中，以唯讀疊圖顯示 CSV 速限標牌。
// @author       Waze Community Taiwan
// @license      MIT
// @homepageURL  https://github.com/waze-community-taiwan/speed-plate-overlay
// @supportURL   https://github.com/waze-community-taiwan/speed-plate-overlay/issues
// @match        https://www.waze.com/editor*
// @match        https://www.waze.com/*/editor*
// @exclude      https://www.waze.com/editor/sdk/*
// @exclude      https://www.waze.com/editor/profile*
// @exclude      https://www.waze.com/*/editor/sdk/*
// @exclude      https://www.waze.com/*/editor/profile*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
"use strict";
(() => {
  // src/constants.ts
  var SCRIPT_ID = "wme-tw-speed-plate-overlay";
  var SCRIPT_NAME = "Taiwan Speed Plate Overlay";
  var LAYER_NAME = "Taiwan government speed plates";
  var STORAGE_KEY = `${SCRIPT_ID}:settings:v1`;
  var DEFAULT_COLUMNS = ["\u516C\u8DEF\u7DE8\u865F", "\u96B8\u5C6C\u7E23\u5E02", "\u8A2D\u7F6E\u4F4D\u7F6E", "\u7DE8\u865F", "\u724C\u9762\u5167\u5BB9", "\u73FE\u6CC1", "\u724C\u9762\u65B9\u5411"];
  var TOP_Z_INDEX = 1e4;

  // src/csv.ts
  var REQUIRED_COLUMNS = {
    longitude: ["\u5750\u6A19-E-WGS84", "\u7D93\u5EA6", "longitude", "lon", "lng"],
    latitude: ["\u5750\u6A19-N-WGS84", "\u7DEF\u5EA6", "latitude", "lat"],
    speed: ["\u724C\u9762\u5167\u5BB9", "\u901F\u9650", "speed", "speed_limit"],
    direction: ["\u724C\u9762\u65B9\u5411", "\u65B9\u5411", "direction"]
  };
  function parseCsvRows(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (quoted) {
        if (char === '"' && text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          field += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field.replace(/\r$/, ""));
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }
    if (quoted) throw new Error("CSV contains an unclosed quoted field.");
    if (field.length > 0 || row.length > 0) {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
    }
    return rows;
  }
  function findHeader(headers, aliases) {
    const normalized = new Map(headers.map((header) => [header.trim().toLowerCase(), header]));
    return aliases.map((alias) => normalized.get(alias.toLowerCase())).find(Boolean);
  }
  function parseSpeedPlateCsv(text) {
    const rows = parseCsvRows(text.replace(/^\uFEFF/, ""));
    const rawHeaders = rows.shift();
    if (!rawHeaders?.length) throw new Error("CSV is empty.");
    const headers = rawHeaders.map((header) => header.trim());
    if (new Set(headers).size !== headers.length) throw new Error("CSV contains duplicate column names.");
    const longitudeHeader = findHeader(headers, REQUIRED_COLUMNS.longitude);
    const latitudeHeader = findHeader(headers, REQUIRED_COLUMNS.latitude);
    const speedHeader = findHeader(headers, REQUIRED_COLUMNS.speed);
    const directionHeader = findHeader(headers, REQUIRED_COLUMNS.direction);
    const missing = [
      [longitudeHeader, "WGS84 longitude"],
      [latitudeHeader, "WGS84 latitude"],
      [speedHeader, "speed"],
      [directionHeader, "direction"]
    ].filter(([header]) => !header).map(([, label]) => label);
    if (missing.length) throw new Error(`Missing required column(s): ${missing.join(", ")}.`);
    const records = [];
    let rejectedRows = 0;
    rows.forEach((cells, rowIndex) => {
      if (cells.every((cell) => cell.trim() === "")) return;
      const values = Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ""]));
      const longitude = Number(values[longitudeHeader]);
      const latitude = Number(values[latitudeHeader]);
      if (cells.length !== headers.length || !values[longitudeHeader]?.trim() || !values[latitudeHeader]?.trim() || !Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
        rejectedRows += 1;
        return;
      }
      records.push({
        id: `sp-${rowIndex + 2}`,
        longitude,
        latitude,
        speed: values[speedHeader] ?? "",
        direction: values[directionHeader] ?? "",
        values
      });
    });
    if (!records.length) throw new Error("CSV contains no rows with valid WGS84 coordinates.");
    return { headers, records, rejectedRows };
  }

  // src/state.ts
  var DEFAULT_SETTINGS = {
    language: "zh-TW",
    sizeVersion: 2,
    enabled: false,
    forceOnTop: false,
    floatingControls: true,
    floatingOpacity: 1,
    badgePosition: "bottom-right",
    clockwiseColor: "#34c759",
    counterclockwiseColor: "#ff9500",
    plateScale: 1,
    speedTextScale: 1,
    columnOrder: [],
    visibleColumns: DEFAULT_COLUMNS
  };
  var clamp = (value, min, max, fallback) => typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  var strings = (value, fallback) => Array.isArray(value) ? [...new Set(value.filter((column) => typeof column === "string"))] : [...fallback];
  var normalizeBadgeColor = (value, fallback) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
  function normalizeSettings(value) {
    return {
      language: value?.language === "en" ? "en" : "zh-TW",
      sizeVersion: 2,
      enabled: typeof value?.enabled === "boolean" ? value.enabled : DEFAULT_SETTINGS.enabled,
      forceOnTop: typeof value?.forceOnTop === "boolean" ? value.forceOnTop : DEFAULT_SETTINGS.forceOnTop,
      floatingControls: typeof value?.floatingControls === "boolean" ? value.floatingControls : true,
      floatingOpacity: clamp(value?.floatingOpacity, 0.1, 1, 1),
      badgePosition: ["top-left", "top-right", "bottom-left", "bottom-right"].includes(value?.badgePosition ?? "") ? value.badgePosition : "bottom-right",
      clockwiseColor: normalizeBadgeColor(value?.clockwiseColor, DEFAULT_SETTINGS.clockwiseColor),
      counterclockwiseColor: normalizeBadgeColor(value?.counterclockwiseColor, DEFAULT_SETTINGS.counterclockwiseColor),
      plateScale: clamp(value?.plateScale, 0.25, 4, 1),
      speedTextScale: clamp(value?.speedTextScale, 0.25, 2, 1),
      columnOrder: strings(value?.columnOrder, []),
      visibleColumns: strings(value?.visibleColumns, DEFAULT_SETTINGS.visibleColumns)
    };
  }
  function loadSettings(storage = localStorage) {
    try {
      const saved = JSON.parse(storage.getItem(STORAGE_KEY) ?? "null");
      return normalizeSettings(saved?.sizeVersion === 2 ? saved : { ...saved, plateScale: 1, speedTextScale: 1 });
    } catch {
      return normalizeSettings(null);
    }
  }
  function saveSettings(settings, storage = localStorage) {
    storage.setItem(STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
  }

  // src/dataset-storage.ts
  var MAX_CSV_BYTES = 30 * 1024 * 1024;
  async function transaction(mode, action) {
    const db = await new Promise((resolve, reject) => {
      let blocked = false;
      const request = indexedDB.open(`${SCRIPT_ID}:datasets`, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("datasets");
      request.onsuccess = () => {
        if (blocked) request.result.close();
        else resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        blocked = true;
        reject(new Error("Dataset storage is blocked by another tab."));
      };
    });
    db.onversionchange = () => db.close();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("datasets", mode);
        const request = action(tx.objectStore("datasets"));
        tx.oncomplete = () => resolve(request.result);
        tx.onabort = () => reject(tx.error ?? new Error("Dataset storage transaction aborted."));
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }
  var datasetStorage = {
    async load() {
      const saved = await transaction("readonly", (store) => store.get("current"));
      if (saved === void 0) return void 0;
      const value = saved;
      if (!value || value.version !== 1 || typeof value.fileName !== "string" || typeof value.text !== "string" || typeof value.importedAt !== "number" || !Number.isFinite(value.importedAt) || new Blob([value.text]).size > MAX_CSV_BYTES) throw new Error("Invalid saved CSV.");
      return value;
    },
    async save(dataset) {
      await transaction("readwrite", (store) => store.put(dataset, "current"));
    },
    async clear() {
      await transaction("readwrite", (store) => store.delete("current"));
    }
  };

  // src/controller.ts
  function orderedColumns(state) {
    return [.../* @__PURE__ */ new Set([...state.columnOrder, ...state.visibleColumns, ...state.headers])].filter((column) => state.headers.includes(column));
  }
  var Controller = class {
    constructor(datasets = datasetStorage) {
      this.datasets = datasets;
    }
    datasets;
    state = { ...loadSettings(), headers: [], records: [], fileName: null, rejectedRows: 0, loading: false, error: null };
    listeners = /* @__PURE__ */ new Set();
    revision = 0;
    storageQueue = Promise.resolve();
    persist(action) {
      const job = this.storageQueue.then(action);
      this.storageQueue = job.catch(() => {
      });
      return job;
    }
    async restoreFile() {
      const revision = this.revision;
      this.state.loading = true;
      this.emit();
      try {
        const saved = await this.datasets.load();
        if (!saved || revision !== this.revision) return;
        const parsed = parseSpeedPlateCsv(saved.text);
        const columnOrder = [.../* @__PURE__ */ new Set([...this.state.columnOrder, ...this.state.visibleColumns, ...parsed.headers])];
        Object.assign(this.state, parsed, { fileName: saved.fileName, columnOrder });
      } catch {
        if (revision === this.revision) this.state.error = "Saved CSV could not be restored. Choose the file again.";
      } finally {
        if (revision === this.revision) {
          this.state.loading = false;
          this.emit();
        }
      }
    }
    async clearFile() {
      const revision = ++this.revision;
      this.state.loading = true;
      this.state.error = null;
      this.emit();
      try {
        await this.persist(() => this.datasets.clear());
        if (revision !== this.revision) return;
        Object.assign(this.state, { headers: [], records: [], fileName: null, rejectedRows: 0 });
        this.settings({ enabled: false });
      } catch {
        if (revision === this.revision) this.state.error = "Saved CSV could not be cleared. Try again.";
      } finally {
        if (revision === this.revision) {
          this.state.loading = false;
          this.emit();
        }
      }
    }
    subscribe(fn) {
      this.listeners.add(fn);
      fn();
      return () => this.listeners.delete(fn);
    }
    emit() {
      this.listeners.forEach((fn) => fn());
    }
    settings(change) {
      Object.assign(this.state, normalizeSettings({ ...this.state, ...change }));
      try {
        saveSettings(this.state);
      } catch {
        this.state.error = "Settings could not be saved in this browser.";
      }
      this.emit();
    }
    moveColumn(column, direction) {
      const order = orderedColumns(this.state);
      const index = order.indexOf(column), target = index + direction;
      if (index < 0 || target < 0 || target >= order.length) return;
      [order[index], order[target]] = [order[target], order[index]];
      this.settings({ columnOrder: [...order, ...this.state.columnOrder.filter((c) => !order.includes(c))] });
    }
    reorderColumn(column, target, after) {
      const order = orderedColumns(this.state);
      if (column === target || !order.includes(column) || !order.includes(target)) return;
      order.splice(order.indexOf(column), 1);
      order.splice(order.indexOf(target) + Number(after), 0, column);
      this.settings({ columnOrder: [...order, ...this.state.columnOrder.filter((c) => !order.includes(c))] });
    }
    resetColumnOrder() {
      this.settings({ columnOrder: [...this.state.headers, ...this.state.columnOrder.filter((c) => !this.state.headers.includes(c))] });
    }
    async importFile(file) {
      const revision = ++this.revision;
      this.state.loading = true;
      this.state.error = null;
      this.emit();
      try {
        if (file.size > MAX_CSV_BYTES) throw new Error("Choose a CSV smaller than 30 MB.");
        const text = await file.text();
        const parsed = parseSpeedPlateCsv(text);
        if (revision !== this.revision) return;
        const columnOrder = [.../* @__PURE__ */ new Set([...this.state.columnOrder, ...this.state.visibleColumns, ...parsed.headers])];
        Object.assign(this.state, parsed, { fileName: file.name, enabled: true, columnOrder });
        this.settings({ enabled: true });
        try {
          await this.persist(() => this.datasets.save({ version: 1, fileName: file.name, text, importedAt: Date.now() }));
        } catch {
          if (revision === this.revision) this.state.error = "CSV loaded, but could not be saved in this browser. Select it again after refresh.";
        }
      } catch (error) {
        if (revision === this.revision) this.state.error = String(error instanceof Error ? error.message : error);
      } finally {
        if (revision === this.revision) {
          this.state.loading = false;
          this.emit();
        }
      }
    }
  };

  // src/i18n.ts
  var zh = {
    "Language": "\u8A9E\u8A00",
    "Government CSV (UTF-8)": "\u8CC7\u6599 CSV\uFF08UTF-8\uFF09",
    "Show speed plates": "\u986F\u793A\u901F\u9650\u6A19\u724C",
    "Force on top": "\u5F37\u5236\u7F6E\u9802",
    "Force speed plates above other map layers": "\u5C07\u901F\u9650\u6A19\u724C\u7F6E\u65BC\u5176\u4ED6\u5716\u5C64\u4E0A\u65B9",
    "Show floating controls": "\u986F\u793A\u6D6E\u52D5\u63A7\u5236\u9762\u677F",
    "Floating opacity": "\u6D6E\u52D5\u9762\u677F\u4E0D\u900F\u660E\u5EA6",
    "\u21BB \u9806\u5411 \xB7 \u21BA \u9006\u5411 \xB7 ? unknown": "\u21BB \u9806\u5411 \xB7 \u21BA \u9006\u5411 \xB7 ? \u672A\u77E5",
    "Direction follows the source road reference, not a compass bearing.": "\u65B9\u5411\u4F9D\u539F\u59CB\u8CC7\u6599\u7684\u9053\u8DEF\u53C3\u8003\u65B9\u5411\uFF0C\u4E26\u975E\u7F85\u76E4\u65B9\u4F4D\u3002",
    "Plate appearance": "\u6A19\u724C\u5916\u89C0",
    "Badge position": "\u65B9\u5411\u5FBD\u7AE0\u4F4D\u7F6E",
    "Top left": "\u5DE6\u4E0A",
    "Top right": "\u53F3\u4E0A",
    "Bottom left": "\u5DE6\u4E0B",
    "Bottom right": "\u53F3\u4E0B",
    "Clockwise badge color": "\u9806\u5411\u5FBD\u7AE0\u984F\u8272",
    "Counter-clockwise badge color": "\u9006\u5411\u5FBD\u7AE0\u984F\u8272",
    "Plate size": "\u6A19\u724C\u5927\u5C0F",
    "Speed value size": "\u901F\u9650\u6578\u5B57\u5927\u5C0F",
    "Reset sizes": "\u91CD\u8A2D\u5927\u5C0F",
    "100% uses the standard plate and larger speed value. Long values are fitted inside the circle.": "100% \u70BA\u6A19\u6E96\u6A19\u724C\u8207\u653E\u5927\u7684\u901F\u9650\u6578\u5B57\uFF1B\u8F03\u9577\u7684\u6578\u503C\u6703\u81EA\u52D5\u7E2E\u653E\u81F3\u5713\u6846\u5167\u3002",
    "Popup columns": "\u8CC7\u8A0A\u6CE1\u6CE1\u6B04\u4F4D",
    "Select fields to display. Drag the right-hand grips to set their order.": "\u52FE\u9078\u8981\u986F\u793A\u7684\u6B04\u4F4D\uFF0C\u62D6\u66F3\u53F3\u5074\u63E1\u67C4\u8ABF\u6574\u986F\u793A\u9806\u5E8F\u3002",
    "Reset order": "\u91CD\u8A2D\u9806\u5E8F",
    "Order reset to the CSV column order.": "\u5DF2\u91CD\u8A2D\u70BA CSV \u539F\u59CB\u6B04\u4F4D\u9806\u5E8F\u3002",
    "CSV files are saved automatically in this browser and restored after refresh. Clear saved CSV removes the saved copy and overlay.": "CSV \u6703\u81EA\u52D5\u5132\u5B58\u65BC\u6B64\u700F\u89BD\u5668\uFF0C\u91CD\u65B0\u8F09\u5165\u5F8C\u6703\u81EA\u52D5\u9084\u539F\u3002\u300C\u6E05\u9664\u5DF2\u5132\u5B58 CSV\u300D\u6703\u79FB\u9664\u5132\u5B58\u7684\u526F\u672C\u8207\u758A\u5716\u3002",
    "Clear saved CSV": "\u6E05\u9664\u5DF2\u5132\u5B58 CSV",
    "Saved CSV could not be restored. Choose the file again.": "\u7121\u6CD5\u9084\u539F\u5DF2\u5132\u5B58\u7684 CSV\uFF0C\u8ACB\u91CD\u65B0\u9078\u53D6\u6A94\u6848\u3002",
    "Saved CSV could not be cleared. Try again.": "\u7121\u6CD5\u6E05\u9664\u5DF2\u5132\u5B58\u7684 CSV\uFF0C\u8ACB\u91CD\u8A66\u3002",
    "CSV loaded, but could not be saved in this browser. Select it again after refresh.": "CSV \u5DF2\u8F09\u5165\uFF0C\u4F46\u7121\u6CD5\u5132\u5B58\u65BC\u6B64\u700F\u89BD\u5668\uFF0C\u91CD\u65B0\u8F09\u5165\u5F8C\u8ACB\u518D\u6B21\u9078\u53D6\u3002",
    "Reading CSV\u2026": "\u6B63\u5728\u8B80\u53D6 CSV\u2026",
    "Choose a government CSV to begin.": "\u8ACB\u9078\u53D6 CSV \u8CC7\u6599\u958B\u59CB\u4F7F\u7528\u3002",
    "Speed plate layer controls": "\u901F\u9650\u6A19\u724C\u5716\u5C64\u63A7\u5236",
    "Move floating controls": "\u79FB\u52D5\u6D6E\u52D5\u63A7\u5236\u9762\u677F",
    "Drag to move. Arrow keys move; Home resets position.": "\u62D6\u66F3\u6216\u4F7F\u7528\u65B9\u5411\u9375\u79FB\u52D5\uFF1BHome \u9375\u91CD\u8A2D\u4F4D\u7F6E\u3002",
    "Speed Plates": "\u901F\u9650\u6A19\u724C",
    "Hide floating controls": "\u96B1\u85CF\u6D6E\u52D5\u63A7\u5236\u9762\u677F",
    "On top": "\u7F6E\u9802",
    "Speed plate details": "\u901F\u9650\u6A19\u724C\u8A73\u7D30\u8CC7\u8A0A",
    "Close details": "\u95DC\u9589\u8A73\u7D30\u8CC7\u8A0A",
    "Select columns in the Speed Plates sidebar.": "\u8ACB\u65BC\u5074\u908A\u6B04\u52FE\u9078\u8981\u986F\u793A\u7684\u8CC7\u8A0A\u6B04\u4F4D\u3002",
    "Usage terms": "\u4F7F\u7528\u689D\u6B3E",
    "Close": "\u95DC\u9589",
    "Settings could not be saved in this browser.": "\u6B64\u700F\u89BD\u5668\u7121\u6CD5\u5132\u5B58\u8A2D\u5B9A\u3002",
    "Choose a CSV smaller than 30 MB.": "\u8ACB\u9078\u53D6\u5C0F\u65BC 30 MB \u7684 CSV\u3002",
    "CSV contains an unclosed quoted field.": "CSV \u542B\u6709\u672A\u9589\u5408\u7684\u5F15\u865F\u6B04\u4F4D\u3002",
    "CSV is empty.": "CSV \u70BA\u7A7A\u767D\u3002",
    "CSV contains duplicate column names.": "CSV \u542B\u6709\u91CD\u8907\u7684\u6B04\u4F4D\u540D\u7A31\u3002",
    "CSV contains no rows with valid WGS84 coordinates.": "CSV \u6C92\u6709\u5305\u542B\u6709\u6548 WGS84 \u5EA7\u6A19\u7684\u8CC7\u6599\u5217\u3002"
  };
  function t(language, text) {
    if (language === "en") return text;
    if (zh[text]) return zh[text];
    if (text.startsWith("Missing required column(s): ")) return text.replace("Missing required column(s): ", "\u7F3A\u5C11\u5FC5\u8981\u6B04\u4F4D\uFF1A");
    if (text.startsWith("Map overlay: ")) return text.replace("Map overlay: ", "\u5730\u5716\u758A\u5716\uFF1A");
    return text;
  }
  var originals = /* @__PURE__ */ new WeakMap();
  var attributes = /* @__PURE__ */ new WeakMap();
  function localize(root, language) {
    root.lang = language;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement?.closest(".spo-columns,.spo-status,.spo-order-status")) continue;
      if (!originals.has(node)) originals.set(node, node.textContent ?? "");
      const source = originals.get(node);
      node.textContent = source.replace(source.trim(), t(language, source.trim()));
    }
    for (const element of [root, ...root.querySelectorAll("*")]) {
      if (element.closest(".spo-columns")) continue;
      let source = attributes.get(element);
      if (!source) {
        source = /* @__PURE__ */ new Map();
        attributes.set(element, source);
      }
      for (const key of ["aria-label", "title"]) {
        if (!source.has(key) && element.hasAttribute(key)) source.set(key, element.getAttribute(key));
        if (source.has(key)) element.setAttribute(key, t(language, source.get(key)));
      }
    }
  }
  function importStatus(language, file, count, rejected) {
    return language === "en" ? `${file}: ${count} plates; ${rejected} invalid rows skipped.` : `${file}\uFF1A${count} \u9762\u6A19\u724C\uFF1B\u7565\u904E ${rejected} \u5217\u7121\u6548\u8CC7\u6599\u3002`;
  }

  // src/marker.ts
  var graphics = /* @__PURE__ */ new Map();
  var escapeXml = (value) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
  function badgeOffset(position) {
    return { x: position.endsWith("right") ? 16 : -16, y: position.startsWith("bottom") ? 16 : -16 };
  }
  function plateGraphic(speed, direction, settings = DEFAULT_SETTINGS) {
    const clockwise = normalizeBadgeColor(settings.clockwiseColor, DEFAULT_SETTINGS.clockwiseColor);
    const counterclockwise = normalizeBadgeColor(settings.counterclockwiseColor, DEFAULT_SETTINGS.counterclockwiseColor);
    const key = JSON.stringify([speed, direction, settings.badgePosition, settings.speedTextScale, clockwise, counterclockwise]);
    const cached = graphics.get(key);
    if (cached) return cached;
    const known = direction === "\u9806\u5411" || direction === "\u9006\u5411";
    const background = direction === "\u9806\u5411" ? clockwise : direction === "\u9006\u5411" ? counterclockwise : "#626772";
    const channels = [1, 3, 5].map((index) => parseInt(background.slice(index, index + 2), 16) / 255).map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    const ink = luminance > 0.2 ? "#161616" : "#ffffff";
    const arrow = `<g transform="${direction === "\u9006\u5411" ? "translate(20 0) scale(-1 1)" : ""}" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 14 A7 7 0 1 1 17 7 M17 2 V7 H12"/></g>`;
    const offset = badgeOffset(settings.badgePosition), x = 28 + offset.x, y = 28 + offset.y;
    const fontSize = (speed.length > 3 ? 15 : 21) * settings.speedTextScale;
    const fit = speed.length * fontSize * 0.6 > 30 ? 'textLength="30" lengthAdjust="spacingAndGlyphs"' : "";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
    <circle cx="28" cy="28" r="18" fill="white" stroke="#df3030" stroke-width="3"/>
    <text x="28" y="28" dy=".35em" text-anchor="middle" font-family="Arial,sans-serif" font-size="${fontSize}" ${fit} font-weight="700" fill="#161616">${escapeXml(speed)}</text>
    <circle cx="${x}" cy="${y}" r="10" fill="${background}" stroke="white" stroke-width="1.5"/>
    <g transform="translate(${x - 8} ${y - 8}) scale(.8)">${known ? arrow : '<text x="10" y="15" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="white">?</text>'}</g>
  </svg>`;
    const graphic = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    if (graphics.size >= 512) graphics.clear();
    graphics.set(key, graphic);
    return graphic;
  }

  // src/adapter.ts
  function directionSymbol(direction) {
    return direction === "\u9806\u5411" ? "\u21BB" : direction === "\u9006\u5411" ? "\u21BA" : "?";
  }
  async function bindMap(sdk, controller) {
    await sdk.Map.addLayer({ layerName: LAYER_NAME, styleContext: {
      plateGraphic: ({ feature }) => plateGraphic(String(feature?.properties.label ?? ""), String(feature?.properties.direction ?? ""), controller.state),
      markerSize: () => 56 * controller.state.plateScale
    }, styleRules: [{ style: {
      externalGraphic: "${plateGraphic}",
      graphicWidth: "${markerSize}",
      graphicHeight: "${markerSize}",
      graphicOpacity: 1,
      cursor: "pointer"
    } }] });
    const normalZ = await sdk.Map.getLayerZIndex({ layerName: LAYER_NAME });
    sdk.Events.trackLayerEvents({ layerName: LAYER_NAME });
    let records;
    let markerStyle = "";
    let selected;
    let popup;
    let generation = 0;
    const close = () => {
      generation++;
      popup?.remove();
      popup = void 0;
      selected = void 0;
    };
    const show = async (record) => {
      close();
      selected = record;
      const token = generation;
      const pixel = await sdk.Map.getPixelFromLonLat({ lonLat: { lon: record.longitude, lat: record.latitude } });
      if (token !== generation) return;
      popup = document.createElement("section");
      popup.className = "spo-popup";
      popup.setAttribute("role", "region");
      popup.setAttribute("aria-label", t(controller.state.language, "Speed plate details"));
      const button = document.createElement("button");
      button.className = "spo-close";
      button.textContent = "\xD7";
      button.type = "button";
      button.title = t(controller.state.language, "Close details");
      button.setAttribute("aria-label", t(controller.state.language, "Close details"));
      button.onclick = close;
      const title = document.createElement("strong");
      title.textContent = `${record.speed} km/h \xB7 ${directionSymbol(record.direction)} ${record.direction}`;
      const list = document.createElement("dl");
      for (const column of orderedColumns(controller.state).filter((c) => controller.state.visibleColumns.includes(c))) {
        const term = document.createElement("dt");
        term.textContent = column;
        const value = document.createElement("dd");
        value.textContent = record.values[column] ?? "";
        list.append(term, value);
      }
      if (!list.children.length) list.textContent = t(controller.state.language, "Select columns in the Speed Plates sidebar.");
      const header = document.createElement("header");
      header.className = "spo-popup-header";
      header.append(title, button);
      popup.append(header, list);
      document.body.append(popup);
      const bounds = popup.getBoundingClientRect();
      popup.style.left = `${Math.max(12, Math.min(pixel.x + 20 * controller.state.plateScale + 12, innerWidth - bounds.width - 12))}px`;
      popup.style.top = `${Math.max(12, Math.min(pixel.y, innerHeight - bounds.height - 12))}px`;
      button.focus();
    };
    let queue = Promise.resolve();
    const unsubscribe = controller.subscribe(() => {
      queue = queue.then(async () => {
        const state = controller.state;
        if (records !== state.records) {
          close();
          await sdk.Map.removeAllFeaturesFromLayer({ layerName: LAYER_NAME });
          if (state.records.length) await sdk.Map.addFeaturesToLayer({ layerName: LAYER_NAME, features: state.records.map((record) => ({
            type: "Feature",
            id: record.id,
            geometry: { type: "Point", coordinates: [record.longitude, record.latitude] },
            properties: { label: record.speed, direction: record.direction }
          })) });
          records = state.records;
        }
        const nextStyle = JSON.stringify([state.badgePosition, state.plateScale, state.speedTextScale, state.clockwiseColor, state.counterclockwiseColor]);
        if (markerStyle !== nextStyle) {
          await sdk.Map.redrawLayer({ layerName: LAYER_NAME });
          markerStyle = nextStyle;
        }
        await sdk.Map.setLayerZIndex({ layerName: LAYER_NAME, zIndex: state.forceOnTop ? TOP_Z_INDEX : normalZ });
        await sdk.Map.setLayerVisibility({ layerName: LAYER_NAME, visibility: state.enabled && !!state.records.length });
        if (!state.enabled) close();
        else if (selected) await show(selected);
      }).catch((error) => {
        const message = `Map overlay: ${String(error)}`;
        if (controller.state.error !== message) {
          controller.state.error = message;
          controller.emit();
        }
        console.error(error);
      });
    });
    const cleanups = [
      sdk.Events.on({ eventName: "wme-layer-feature-clicked", eventHandler: ({ layerName, featureId }) => {
        if (layerName !== LAYER_NAME || !controller.state.enabled) return;
        const record = controller.state.records.find((r) => r.id === String(featureId));
        if (record) void show(record).catch(console.error);
      } }),
      // WME's transparent interaction layer can receive the pointer above SDK
      // features. Use its public map-click event for geographic hit testing too.
      sdk.Events.on({ eventName: "wme-map-mouse-click", eventHandler: (event) => {
        if (!controller.state.enabled) return;
        const clickGeneration = generation;
        const candidates = controller.state.records.map((record) => ({
          record,
          distance: ((record.longitude - event.lon) * Math.cos(event.lat * Math.PI / 180)) ** 2 + (record.latitude - event.lat) ** 2
        })).sort((a, b) => a.distance - b.distance).slice(0, 4);
        void (async () => {
          for (const { record } of candidates) {
            const pixel = await sdk.Map.getMapPixelFromLonLat({ lonLat: { lon: record.longitude, lat: record.latitude } });
            if (clickGeneration !== generation) return;
            const dx = event.x - pixel.x, dy = event.y - pixel.y;
            const scale = controller.state.plateScale, badge = badgeOffset(controller.state.badgePosition);
            if (Math.hypot(dx, dy) <= 20 * scale || Math.hypot(dx - badge.x * scale, dy - badge.y * scale) <= 11 * scale) {
              await show(record);
              break;
            }
          }
        })().catch(console.error);
      } }),
      sdk.Events.on({ eventName: "wme-map-move", eventHandler: close }),
      sdk.Events.on({ eventName: "wme-logged-out", eventHandler: () => controller.settings({ enabled: false }) })
    ];
    const escape = (event) => {
      if (event.key === "Escape") close();
    };
    const outside = (event) => {
      if (!popup || !event.composedPath().includes(popup)) close();
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("click", outside, true);
    return async () => {
      unsubscribe();
      cleanups.forEach((fn) => fn());
      close();
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("click", outside, true);
      await queue;
      close();
      sdk.Events.stopLayerEventsTracking({ layerName: LAYER_NAME });
      await sdk.Map.removeLayer({ layerName: LAYER_NAME });
    };
  }

  // package.json
  var version = "0.1.4";

  // src/terms.ts
  var sections = {
    "zh-TW": [
      ["\u5DE5\u5177\u6027\u8CEA\u8207\u7368\u7ACB\u6027", "Taiwan Speed Plate Overlay \u70BA\u793E\u7FA4\u7DAD\u8B77\u7684 WME \u53C3\u8003\u5DE5\u5177\uFF0C\u4E26\u975E Waze \u6216\u4EFB\u4F55\u653F\u5E9C\u6A5F\u95DC\u7684\u5B98\u65B9\u7522\u54C1\uFF0C\u4EA6\u4E0D\u8868\u793A\u7372\u5F97\u5176\u80CC\u66F8\u3002\u672C\u5DE5\u5177\u50C5\u986F\u793A\u758A\u5716\uFF0C\u4E0D\u6703\u4FEE\u6539\u6216\u5132\u5B58 WME \u9053\u8DEF\u8CC7\u6599\u3002"],
      ["\u8CC7\u6599\u4F86\u6E90\u8207\u4F7F\u7528\u6B0A\u9650", "\u8ACB\u50C5\u532F\u5165\u60A8\u6709\u6B0A\u4F7F\u7528\u7684 CSV\uFF0C\u4E26\u81EA\u884C\u78BA\u8A8D\u5404\u8CC7\u6599\u96C6\u7684\u6388\u6B0A\u689D\u4EF6\u3001\u4F86\u6E90\u6A5F\u95DC\u3001\u7248\u672C\u8207\u66F4\u65B0\u65E5\u671F\u3002\u653F\u5E9C\u516C\u958B\u8CC7\u6599\u4E0D\u4EE3\u8868\u53EF\u4E0D\u53D7\u9650\u5236\u5730\u4F7F\u7528\uFF1B\u61C9\u4F9D\u4F86\u6E90\u689D\u4EF6\u4FDD\u7559\u51FA\u8655\u3001\u6388\u6B0A\u8207\u5176\u4ED6\u5FC5\u8981\u6A19\u793A\u3002\u672C\u5DE5\u5177\u4E0D\u6388\u4E88\u8CC7\u6599\u7684\u8457\u4F5C\u6B0A\uFF0C\u4E5F\u4E0D\u4EE3\u8868\u8CC7\u6599\u5DF2\u7372\u51C6\u532F\u5165 Waze\u3002"],
      ["\u7DE8\u8F2F\u8207\u5B89\u5168\u4F7F\u7528", "\u758A\u5716\u50C5\u4F9B\u67E5\u6838\u53C3\u8003\uFF0C\u4E26\u975E\u5C0E\u822A\u6216\u6CD5\u5F8B\u4E0A\u7684\u901F\u9650\u4F9D\u64DA\u3002\u5EA7\u6A19\u3001\u901F\u9650\u3001\u65B9\u5411\u8207\u73FE\u6CC1\u53EF\u80FD\u6709\u932F\u8AA4\u6216\u904E\u6642\uFF1B\u9806\u5411\u8207\u9006\u5411\u4F9D\u539F\u59CB\u8CC7\u6599\u7684\u9053\u8DEF\u53C3\u8003\u65B9\u5411\uFF0C\u4E26\u975E\u7F85\u76E4\u65B9\u4F4D\u3002\u9032\u884C\u4EFB\u4F55\u4EBA\u5DE5\u7DE8\u8F2F\u524D\uFF0C\u8ACB\u7368\u7ACB\u67E5\u8B49\u4E26\u9075\u5B88 Waze \u689D\u6B3E\u3001\u7DE8\u8F2F\u653F\u7B56\u8207\u5728\u5730\u793E\u7FA4\u898F\u7BC4\u3002\u884C\u8ECA\u6642\u8ACB\u4F9D\u73FE\u5834\u6A19\u8A8C\u8207\u9069\u7528\u898F\u5B9A\u3002"],
      ["\u672C\u6A5F\u6A94\u6848\u8207\u96B1\u79C1", "\u672C\u5DE5\u5177\u5728\u700F\u89BD\u5668\u5167\u8B80\u53D6\u60A8\u9078\u53D6\u7684 CSV\uFF0C\u4E0D\u6703\u5C07\u6A94\u6848\u4E0A\u50B3\u81F3\u672C\u5C08\u6848\u7684\u4F3A\u670D\u5668\u3002\u6210\u529F\u532F\u5165\u7684 CSV \u6703\u81EA\u52D5\u5132\u5B58\u65BC\u6B64\u700F\u89BD\u5668\u7684 IndexedDB\uFF0C\u91CD\u65B0\u8F09\u5165\u5F8C\u81EA\u52D5\u9084\u539F\u3002\u53EF\u4F7F\u7528\u300C\u6E05\u9664\u5DF2\u5132\u5B58 CSV\u300D\u79FB\u9664\u526F\u672C\u8207\u758A\u5716\uFF1B\u6E05\u9664 Waze \u7DB2\u7AD9\u8CC7\u6599\u4E5F\u6703\u79FB\u9664\u526F\u672C\u3002\u8A9E\u8A00\u3001\u5916\u89C0\u3001\u6B04\u4F4D\u8207\u5716\u5C64\u504F\u597D\u6703\u5132\u5B58\u65BC\u700F\u89BD\u5668\u3002WME \u8207\u5176\u4ED6\u64F4\u5145\u529F\u80FD\u7684\u8CC7\u6599\u8655\u7406\u4ECD\u4F9D\u5404\u81EA\u653F\u7B56\u3002\u8ACB\u52FF\u532F\u5165\u672A\u7D93\u6388\u6B0A\u7684\u500B\u4EBA\u6216\u6A5F\u5BC6\u8CC7\u6599\u3002"],
      ["\u63D0\u4F9B\u65B9\u5F0F\u8207\u8CAC\u4EFB", "\u672C\u5DE5\u5177\u4F9D\u73FE\u72C0\u63D0\u4F9B\uFF0C\u4E0D\u4FDD\u8B49\u53EF\u7528\u6027\u3001\u8CC7\u6599\u6B63\u78BA\u6027\u3001\u5B8C\u6574\u6027\u6216\u6301\u7E8C\u7DAD\u8B77\u3002\u60A8\u61C9\u81EA\u884C\u8A55\u4F30\u8CC7\u6599\u8207\u7DE8\u8F2F\u6C7A\u5B9A\u3002\u65BC\u9069\u7528\u6CD5\u5F8B\u5141\u8A31\u7684\u7BC4\u570D\u5167\uFF0C\u7DAD\u8B77\u8005\u4E0D\u5C0D\u56E0\u4F7F\u7528\u672C\u5DE5\u5177\u6240\u751F\u7684\u640D\u5931\u8CA0\u8CAC\uFF1B\u672C\u8AAA\u660E\u4E0D\u6392\u9664\u4F9D\u6CD5\u4E0D\u5F97\u6392\u9664\u7684\u6B0A\u5229\u6216\u8CAC\u4EFB\u3002"]
    ],
    en: [
      ["Purpose and independence", "Taiwan Speed Plate Overlay is a community-maintained reference tool for WME. It is not an official product of, or endorsed by, Waze or any government agency. It displays an overlay only and does not modify or save WME road data."],
      ["Data sources and permissions", "Import only CSV files you are authorized to use. Check each dataset\u2019s license, publishing agency, version, and update date. Public availability does not mean unrestricted use. Retain attribution, license notices, and other markings required by the source. This tool grants no rights to the data and does not establish permission to import it into Waze."],
      ["Editing and safe use", "The overlay is a reference for verification, not navigation or an authoritative statement of legal speed limits. Coordinates, speed values, direction, and status may be inaccurate or outdated. Forward and reverse follow the source road reference, not compass bearings. Independently verify information before any manual edit and follow Waze terms, editing policies, and local community rules. When driving, follow on-site signs and applicable rules."],
      ["Local files and privacy", "The tool reads your selected CSV in the browser and does not upload it to project servers. Successfully imported CSV files are saved automatically in this browser\u2019s IndexedDB and restored after refresh. Use Clear saved CSV to remove the copy and overlay; clearing Waze site data also removes the copy. Language, appearance, column, and layer preferences are stored in your browser. WME and other extensions handle data under their own policies. Do not import unauthorized personal or confidential information."],
      ["Availability and responsibility", "The tool is provided as is, without guarantees of availability, accuracy, completeness, or continued maintenance. You are responsible for evaluating data and editing decisions. To the extent permitted by applicable law, maintainers are not liable for losses arising from its use. This notice does not exclude rights or responsibilities that cannot legally be excluded."]
    ]
  };
  var dismiss;
  function openTermsDialog(controller) {
    if (dismiss) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const backdrop = document.createElement("div");
    backdrop.className = "spo-modal-backdrop";
    const modal = document.createElement("section");
    modal.className = "spo-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "spo-terms-title");
    const header = document.createElement("header");
    const title = document.createElement("h2");
    title.id = "spo-terms-title";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "spo-close";
    closeButton.textContent = "\xD7";
    const body = document.createElement("div");
    body.className = "spo-modal-body";
    body.tabIndex = 0;
    header.append(title, closeButton);
    modal.append(header, body);
    backdrop.append(modal);
    const unsubscribe = controller.subscribe(() => {
      const language = controller.state.language;
      modal.lang = language;
      title.textContent = t(language, "Usage terms");
      closeButton.title = t(language, "Close");
      closeButton.setAttribute("aria-label", t(language, "Close"));
      body.replaceChildren();
      for (const [heading, text] of sections[language]) {
        const h = document.createElement("h3");
        h.textContent = heading;
        const p = document.createElement("p");
        p.textContent = text;
        body.append(h, p);
      }
      const date = document.createElement("p");
      date.className = "spo-terms-meta";
      date.textContent = language === "en" ? "Updated: 2026-11-15" : "\u66F4\u65B0\u65E5\u671F\uFF1A2026-11-15";
      body.append(date);
    });
    const close = () => {
      unsubscribe();
      backdrop.remove();
      document.removeEventListener("keydown", onKey, true);
      dismiss = void 0;
      if (opener?.isConnected) opener.focus();
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
      }
      if (event.key === "Tab") {
        event.preventDefault();
        (document.activeElement === closeButton ? body : closeButton).focus();
      }
    };
    dismiss = close;
    closeButton.onclick = close;
    backdrop.onclick = (event) => {
      if (event.target === backdrop) close();
    };
    document.addEventListener("keydown", onKey, true);
    document.body.append(backdrop);
    closeButton.focus();
  }

  // src/size-scale.ts
  function sliderToScale(position, maximum) {
    const value = Math.max(0, Math.min(200, position));
    return value <= 100 ? 0.25 + 0.75 * value / 100 : 1 + (maximum - 1) * (value - 100) / 100;
  }
  function scaleToSlider(scale, maximum) {
    return scale <= 1 ? (scale - 0.25) / 0.75 * 100 : 100 + (scale - 1) / (maximum - 1) * 100;
  }

  // src/top-button.ts
  var TOP_LAYER_BUTTON = `<button class="spo-top" type="button" aria-label="Force on top" title="Force speed plates above other map layers" aria-pressed="false">
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <rect x="2" y="5.5" width="7.5" height="7.5" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.55"/>
    <rect x="6.5" y="2" width="7.5" height="7.5" rx="1.4" fill="currentColor"/>
  </svg>
</button>`;

  // src/sidebar.ts
  function mountSidebar(root, controller) {
    root.classList.add("spo-panel");
    root.innerHTML = `<h4>\u53F0\u7063\u901F\u9650\u6A19\u724C\u758A\u5716</h4>
    <label class="spo-appearance-label">Language <select class="spo-language" aria-label="Language"><option value="zh-TW">\u7E41\u9AD4\u4E2D\u6587</option><option value="en">English</option></select></label>
    <div class="spo-card"><label>Government CSV (UTF-8)<input class="spo-file" type="file" accept=".csv,text/csv"></label>
    <p class="spo-status" role="status" aria-live="polite"></p><button class="spo-clear-file" type="button">Clear saved CSV</button></div>
    <div class="spo-card"><label class="spo-row">Show speed plates <span class="spo-switch"><input class="spo-enabled" type="checkbox"><span></span></span></label>
    <div class="spo-row spo-top-row"><span>Force on top</span>${TOP_LAYER_BUTTON}</div>
    <label class="spo-row spo-floating-setting">Show floating controls <input class="spo-floating-enabled" type="checkbox"></label>
    <label class="spo-range-label">Floating opacity <span class="spo-range"><input class="spo-opacity" type="range" min="10" max="100" step="5"><output class="spo-opacity-value"></output></span></label>
    <p>\u21BB \u9806\u5411 \xB7 \u21BA \u9006\u5411 \xB7 ? unknown<br>Direction follows the source road reference, not a compass bearing.</p></div>
    <section class="spo-card spo-appearance-card"><div class="spo-card-header"><h5>Plate appearance</h5><button class="spo-reset-size" type="button">Reset sizes</button></div>
    <label class="spo-appearance-label">Badge position <select class="spo-badge-position"><option value="top-left">Top left</option><option value="top-right">Top right</option><option value="bottom-left">Bottom left</option><option value="bottom-right">Bottom right</option></select></label>
    <label class="spo-row spo-color-row">Clockwise badge color <input class="spo-clockwise-color" type="color"></label>
    <label class="spo-row spo-color-row">Counter-clockwise badge color <input class="spo-counterclockwise-color" type="color"></label>
    <label class="spo-range-label">Plate size <span class="spo-range"><input class="spo-plate-size" type="range" min="0" max="200" step="any"><output class="spo-plate-size-value"></output></span></label>
    <label class="spo-range-label">Speed value size <span class="spo-range"><input class="spo-text-size" type="range" min="0" max="200" step="any"><output class="spo-text-size-value"></output></span></label>
    <p>100% uses the standard plate and larger speed value. Long values are fitted inside the circle.</p></section>
    <section class="spo-card spo-columns-card"><div class="spo-card-header"><h5>Popup columns</h5><button class="spo-reset-order" type="button">Reset order</button></div><p id="spo-order-help">Select fields to display. Drag the right-hand grips to set their order.</p><div class="spo-columns"></div><span class="spo-order-status" role="status" aria-live="polite"></span></section>
    <p>CSV files are saved automatically in this browser and restored after refresh. Clear saved CSV removes the saved copy and overlay.</p><footer class="spo-terms-footer"><button type="button" class="spo-terms-link">Usage terms</button><a class="spo-version" href="https://github.com/waze-community-taiwan/speed-plate-overlay/releases/tag/v${version}" target="_blank" rel="noopener noreferrer">v${version}</a></footer>`;
    const language = root.querySelector(".spo-language");
    language.onchange = () => controller.settings({ language: language.value });
    root.querySelector(".spo-terms-link").onclick = () => openTermsDialog(controller);
    const file = root.querySelector(".spo-file");
    const clearFile = root.querySelector(".spo-clear-file");
    clearFile.onclick = () => {
      file.value = "";
      void controller.clearFile();
    };
    const enabled = root.querySelector(".spo-enabled");
    const top = root.querySelector(".spo-top");
    const floating = root.querySelector(".spo-floating-enabled");
    const opacity = root.querySelector(".spo-opacity");
    const plateSize = root.querySelector(".spo-plate-size");
    const textSize = root.querySelector(".spo-text-size");
    const badgePosition = root.querySelector(".spo-badge-position");
    const clockwiseColor = root.querySelector(".spo-clockwise-color");
    const counterclockwiseColor = root.querySelector(".spo-counterclockwise-color");
    clockwiseColor.oninput = () => controller.settings({ clockwiseColor: clockwiseColor.value });
    counterclockwiseColor.oninput = () => controller.settings({ counterclockwiseColor: counterclockwiseColor.value });
    opacity.oninput = () => controller.settings({ floatingOpacity: Number(opacity.value) / 100 });
    plateSize.oninput = () => controller.settings({ plateScale: sliderToScale(Number(plateSize.value), 4) });
    textSize.oninput = () => controller.settings({ speedTextScale: sliderToScale(Number(textSize.value), 2) });
    badgePosition.onchange = () => controller.settings({ badgePosition: badgePosition.value });
    root.querySelector(".spo-reset-size").onclick = () => controller.settings({ plateScale: 1, speedTextScale: 1 });
    root.querySelector(".spo-reset-order").onclick = () => {
      controller.resetColumnOrder();
      root.querySelector(".spo-order-status").textContent = t(controller.state.language, "Order reset to the CSV column order.");
    };
    floating.onchange = () => controller.settings({ floatingControls: floating.checked });
    file.onchange = () => {
      if (file.files?.[0]) void controller.importFile(file.files[0]);
    };
    enabled.onchange = () => controller.settings({ enabled: enabled.checked });
    top.onclick = () => controller.settings({ forceOnTop: !controller.state.forceOnTop });
    let previousOrder = "";
    let previousLanguage = controller.state.language;
    let draggedColumn = null;
    const clearDrag = () => {
      draggedColumn = null;
      root.querySelectorAll(".spo-column-row").forEach((row) => {
        row.draggable = false;
        row.classList.remove("spo-dragging", "spo-drop-before", "spo-drop-after");
      });
    };
    const announceMove = (header) => {
      const order = orderedColumns(controller.state);
      root.querySelector(".spo-order-status").textContent = controller.state.language === "en" ? `${header}: position ${order.indexOf(header) + 1} of ${order.length}` : `${header}\uFF1A\u7B2C ${order.indexOf(header) + 1}\uFF0F${order.length} \u9805`;
    };
    return controller.subscribe(() => {
      const state = controller.state;
      if (previousLanguage !== state.language) root.querySelector(".spo-order-status").textContent = "";
      previousLanguage = state.language;
      language.value = state.language;
      localize(root, state.language);
      clearFile.disabled = state.loading;
      enabled.checked = state.enabled;
      enabled.disabled = !state.records.length;
      top.setAttribute("aria-pressed", String(state.forceOnTop));
      floating.checked = state.floatingControls;
      root.querySelector(".spo-reset-order").disabled = !state.headers.length;
      badgePosition.value = state.badgePosition;
      clockwiseColor.value = state.clockwiseColor;
      counterclockwiseColor.value = state.counterclockwiseColor;
      for (const [input, output, value, maximum] of [
        [opacity, ".spo-opacity-value", state.floatingOpacity, null],
        [plateSize, ".spo-plate-size-value", state.plateScale, 4],
        [textSize, ".spo-text-size-value", state.speedTextScale, 2]
      ]) {
        input.value = String(maximum === null ? Math.round(value * 100) : scaleToSlider(value, maximum));
        input.setAttribute("aria-valuetext", `${Math.round(value * 100)}%`);
        root.querySelector(output).textContent = `${Math.round(value * 100)}%`;
      }
      root.querySelector(".spo-status").textContent = state.loading ? t(state.language, "Reading CSV\u2026") : state.error ? t(state.language, state.error) : state.fileName ? importStatus(state.language, state.fileName, state.records.length, state.rejectedRows) : t(state.language, "Choose a government CSV to begin.");
      const order = orderedColumns(state), orderKey = JSON.stringify([state.language, order]);
      if (previousOrder !== orderKey) {
        previousOrder = orderKey;
        const focused = document.activeElement?.getAttribute("aria-label");
        const columns = root.querySelector(".spo-columns");
        columns.replaceChildren();
        for (const header of order) {
          const row = document.createElement("div");
          row.className = "spo-column-row";
          row.dataset.column = header;
          const grip = document.createElement("span");
          grip.className = "spo-drag-handle";
          grip.textContent = "\u22EE\u22EE";
          grip.setAttribute("role", "button");
          grip.tabIndex = 0;
          grip.draggable = true;
          grip.onmousedown = () => {
            row.draggable = true;
          };
          grip.setAttribute("aria-label", state.language === "en" ? `Reorder ${header}` : `\u8ABF\u6574\u9806\u5E8F\uFF1A${header}`);
          grip.setAttribute("aria-describedby", "spo-order-help");
          grip.title = state.language === "en" ? `Drag ${header} to reorder. Keyboard: Alt + Arrow Up / Arrow Down.` : `\u62D6\u66F3 ${header} \u8ABF\u6574\u9806\u5E8F\uFF1B\u9375\u76E4\uFF1AAlt + \u4E0A\uFF0F\u4E0B\u65B9\u5411\u9375\u3002`;
          grip.setAttribute("aria-keyshortcuts", "Alt+ArrowUp Alt+ArrowDown");
          row.onpointerdown = (event) => {
            row.draggable = event.target instanceof Element && !!event.target.closest(".spo-drag-handle");
          };
          row.onpointerup = () => {
            if (!draggedColumn) row.draggable = false;
          };
          row.ondragstart = (event) => {
            if (!row.draggable) {
              event.preventDefault();
              return;
            }
            draggedColumn = header;
            row.classList.add("spo-dragging");
            if (event.dataTransfer) {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", header);
            }
          };
          row.ondragover = (event) => {
            if (!draggedColumn || draggedColumn === header) return;
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
            root.querySelectorAll(".spo-drop-before,.spo-drop-after").forEach((element) => element.classList.remove("spo-drop-before", "spo-drop-after"));
            const rect = row.getBoundingClientRect();
            row.classList.add(event.clientY > rect.top + rect.height / 2 ? "spo-drop-after" : "spo-drop-before");
          };
          row.ondrop = (event) => {
            if (!draggedColumn) return;
            event.preventDefault();
            const source = draggedColumn, rect = row.getBoundingClientRect();
            clearDrag();
            controller.reorderColumn(source, header, event.clientY > rect.top + rect.height / 2);
            announceMove(source);
          };
          row.ondragend = clearDrag;
          grip.onkeydown = (event) => {
            if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
            event.preventDefault();
            controller.moveColumn(header, event.key === "ArrowUp" ? -1 : 1);
            announceMove(header);
          };
          const label = document.createElement("label");
          const input = document.createElement("input");
          const name = document.createElement("span");
          name.textContent = header;
          input.type = "checkbox";
          input.checked = state.visibleColumns.includes(header);
          input.onchange = () => controller.settings({ visibleColumns: input.checked ? [...controller.state.visibleColumns, header] : controller.state.visibleColumns.filter((c) => c !== header) });
          label.append(input, name);
          row.append(label, grip);
          columns.append(row);
        }
        if (focused) {
          Array.from(columns.querySelectorAll(".spo-drag-handle")).find((grip) => grip.getAttribute("aria-label") === focused)?.focus();
        }
      }
      root.querySelectorAll(".spo-columns input").forEach((input, index) => {
        input.checked = state.visibleColumns.includes(order[index]);
      });
    });
  }

  // src/styles.ts
  function injectStyles() {
    if (document.getElementById("spo-styles")) return;
    const style = document.createElement("style");
    style.id = "spo-styles";
    style.textContent = `
  .spo-panel {padding:0 12px;font-size:13px;color:inherit}
  .spo-panel h4 {font-size:14px;margin:8px 0 12px;font-weight:600}
  .spo-card {border:1px solid var(--hairline, #aaa6);border-radius:10px;padding:10px 12px;margin:6px 0}
  .spo-panel p {font-size:11px;line-height:1.6;overflow-wrap:anywhere}
  .spo-file {display:block;width:100%;margin-top:8px;font:inherit}
  .spo-row {display:flex;align-items:center;justify-content:space-between;gap:10px}
  .spo-switch {position:relative;display:inline-block;width:38px;height:22px;flex-shrink:0}
  .spo-switch input {position:absolute;opacity:0;width:100%;height:100%;margin:0}
  .spo-switch span {display:block;border-radius:22px;background:rgba(120,120,128,.32);height:22px;pointer-events:none}
  .spo-switch span:after {content:'';position:absolute;left:2px;top:2px;width:18px;height:18px;background:white;border-radius:50%;box-shadow:0 1px 3px #0004;transition:transform 200ms}
  .spo-switch input:checked + span {background:#34c759}
  .spo-switch input:checked + span:after {transform:translateX(16px)}
  .spo-switch input:focus-visible + span {outline:3px solid #34c75966}
  .spo-top-row {margin-top:10px}
  .spo-top {display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;box-sizing:border-box;width:26px;height:22px;min-height:22px;padding:0;border:1px solid rgba(128,128,128,.35);border-radius:6px;background:transparent;color:inherit;cursor:pointer;opacity:.6;transition:opacity 150ms,background-color 150ms,color 150ms,border-color 150ms,transform 50ms}
  .spo-top:hover {opacity:1}
  .spo-top:active {transform:scale(.94)}
  .spo-top[aria-pressed=true] {background:#ff9500;color:white;border-color:#ff9500;opacity:1}
  .spo-panel .spo-top:focus-visible,.spo-floating .spo-top:focus-visible {outline:none;box-shadow:0 0 0 3px rgba(255,149,0,.35)}
  .spo-top svg {width:14px;height:14px;display:block;pointer-events:none}
  .spo-columns label {display:flex;align-items:flex-start;gap:8px;margin:6px 0;overflow-wrap:anywhere}
  .spo-columns input {flex-shrink:0;margin:2px 0 0}
  .spo-column-row {display:flex;align-items:center;gap:4px}
  .spo-column-row label {flex:1;min-width:0}
  .spo-column-row label span {overflow-wrap:anywhere;min-width:0}
  .spo-drag-handle {display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;box-sizing:border-box;width:22px;height:22px;border:0;border-radius:6px;background:transparent;color:inherit;cursor:grab;padding:0 2px;opacity:.45;font-size:16px;line-height:1;letter-spacing:-3px;user-select:none}
  .spo-drag-handle:hover {opacity:.85}
  .spo-drag-handle:active {cursor:grabbing}
  .spo-dragging {opacity:.45}
  .spo-drop-before {box-shadow:inset 0 3px #2d6cdf}
  .spo-drop-after {box-shadow:inset 0 -3px #2d6cdf}
  .spo-card-header {display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
  .spo-card-header h5 {margin:0;min-width:0;font-size:13px;font-weight:600;line-height:1.4}
  .spo-appearance-card > p {margin:12px 0 0}
  .spo-columns-card > p {margin:0 0 10px}
  .spo-reset-order,.spo-reset-size {margin:0;flex-shrink:0;white-space:nowrap;border-radius:6px;border:1px solid var(--hairline,#aaa6);background:transparent;color:inherit;font:inherit;padding:3px 8px;cursor:pointer}
  .spo-reset-order:disabled {opacity:.4;cursor:default}
  .spo-clear-file {border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;padding:3px 8px;cursor:pointer}
  .spo-clear-file:hover:not(:disabled) {color:#ff3b30;background:rgba(255,59,48,.12)}
  .spo-clear-file:disabled {opacity:.4;cursor:default}
  .spo-order-status {display:block;font-size:11px;opacity:.75}
  .spo-range-label,.spo-appearance-label {display:block;margin-top:12px;font-weight:400}
  .spo-range {display:flex;align-items:center;gap:10px;margin-top:8px}
  .spo-range input {flex:1;min-width:0;margin:0;-webkit-appearance:none;appearance:none;height:4px;background:rgba(120,120,128,.3);border-radius:2px;outline:none}
  .spo-range input::-webkit-slider-thumb {-webkit-appearance:none;appearance:none;width:18px;height:18px;border-radius:50%;background:#fff;border:1px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.25);cursor:pointer}
  .spo-range input::-moz-range-thumb {width:18px;height:18px;border-radius:50%;background:#fff;border:1px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.25);cursor:pointer}
  .spo-range input:focus-visible::-webkit-slider-thumb {box-shadow:0 0 0 3px rgba(45,108,223,.3)}
  .spo-color-row {margin-top:10px;font-weight:400}
  .spo-color-row input {width:28px;height:22px;flex-shrink:0;border:1px solid rgba(128,128,128,.35);border-radius:4px;padding:0;background:transparent;cursor:pointer}
  .spo-range output {font-size:12px;min-width:38px;text-align:right;font-variant-numeric:tabular-nums}
  .spo-appearance-label select {display:block;width:100%;margin-top:6px;padding:6px 10px;border:1px solid var(--hairline,#aaa6);border-radius:8px;background:var(--background_default,#fff);color:inherit;font:inherit}
  .spo-floating-setting {margin-top:12px}
  .spo-panel :focus-visible,.spo-popup :focus-visible,.spo-floating :focus-visible {outline:3px solid #2d6cdf88;outline-offset:2px}
  .spo-popup {position:fixed;z-index:10001;box-sizing:border-box;width:max-content;max-width:min(360px,calc(100vw - 24px));max-height:55vh;overflow:auto;background:var(--background_default,#fff);color:inherit;border:1px solid var(--hairline,#aaa6);border-radius:10px;padding:12px;box-shadow:0 6px 20px #0003;font-size:13px}
  .spo-popup-header {display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
  .spo-popup-header strong {min-width:0;overflow-wrap:anywhere}
  .spo-popup-header .spo-close {flex-shrink:0;float:none}
  [wz-theme=dark] .spo-popup,[wz-theme=dark] .spo-floating,[wz-theme=dark] .spo-appearance-label select {background:var(--background_default,#1f2024)}
  .spo-popup dt {font-weight:600;margin-top:6px;overflow-wrap:anywhere}.spo-popup dd {margin:0;overflow-wrap:anywhere;white-space:pre-wrap}
  .spo-close {display:inline-flex;align-items:center;justify-content:center;float:right;width:26px;height:26px;padding:0;border-radius:8px;background:rgba(120,120,128,.12);border:1px solid var(--hairline,#aaa6);color:inherit;font:inherit;font-size:20px;line-height:1;cursor:pointer;transition:background 150ms,color 150ms}.spo-close:hover {color:#ff3b30;background:#ff3b301f}
  .spo-floating {position:fixed;z-index:10000;box-sizing:border-box;width:200px;max-width:calc(100vw - 24px);border:1px solid var(--hairline,rgba(128,128,128,.3));border-radius:10px;background:var(--background_default,#fff);color:inherit;box-shadow:0 6px 24px rgba(0,0,0,.28);font:inherit;font-size:13px;overflow:hidden}
  .spo-floating[hidden] {display:none}
  .spo-floating-header {display:flex;align-items:center;gap:8px;padding:2px 12px;border-bottom:1px solid var(--hairline,rgba(128,128,128,.2));background:rgba(128,128,128,.08);cursor:move;touch-action:none;user-select:none}
  .spo-floating-header strong {flex:1;min-width:0;font-weight:600;letter-spacing:.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .spo-floating-dragging .spo-floating-header {cursor:move}
  .spo-floating .spo-close {box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;float:none;flex-shrink:0;width:22px;height:22px;border-radius:6px;border:0;background:transparent;color:inherit;padding:0;opacity:.6;transition:opacity 150ms,background-color 150ms,transform 50ms}
  .spo-floating .spo-close:hover {opacity:1;background:rgba(128,128,128,.18)}
  .spo-floating .spo-close:active {transform:scale(.92)}
  .spo-floating .spo-close:focus-visible {outline:none;box-shadow:0 0 0 3px rgba(255,149,0,.35)}
  .spo-floating .spo-close svg {width:13px;height:13px;display:block;pointer-events:none}
  .spo-floating-rows {padding:6px 8px;max-height:320px;overflow-y:auto}
  .spo-floating-row {display:flex;align-items:center;gap:8px;padding:5px 4px;border-radius:6px}
  .spo-floating-label {flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  [wz-theme=dark] .spo-floating {background:#1f2024;border-color:rgba(255,255,255,.12)}
  [wz-theme=dark] .spo-floating-header {border-bottom-color:rgba(255,255,255,.1);background:rgba(255,255,255,.05)}
  .spo-terms-footer {margin-top:16px;padding-top:10px;border-top:1px solid var(--hairline,#aaa6);text-align:center;display:flex;justify-content:center;align-items:center;gap:8px;flex-wrap:wrap}
  .spo-version {color:inherit;opacity:.65;font-size:11px;border:1px solid var(--hairline,#aaa6);border-radius:6px;padding:1px 5px;text-decoration:none;font-variant-numeric:tabular-nums}
  .spo-version:hover {opacity:1}
  .spo-terms-link {border:0;background:none;color:#2d6cdf;font:inherit;font-size:12px;cursor:pointer;text-decoration:underline;text-underline-offset:2px;padding:2px 6px}
  .spo-modal-backdrop {position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.45)}
  .spo-modal {display:flex;flex-direction:column;width:100%;max-width:720px;max-height:100%;background:var(--background_default,#fff);color:inherit;border-radius:12px;box-shadow:0 16px 48px #0005;font-size:13px}
  .spo-modal header {display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--hairline,#aaa6)}
  .spo-modal h2 {flex:1;font-size:15px;font-weight:600;margin:0}
  .spo-modal-body {overflow:auto;padding:14px 18px 18px;line-height:1.65}
  .spo-modal h3 {font-size:13.5px;margin:16px 0 6px;font-weight:600}
  .spo-modal h3:first-child {margin-top:0}.spo-modal p {margin:0 0 8px}
  .spo-terms-meta {border-top:1px solid var(--hairline,#aaa6);padding-top:12px;opacity:.7;font-size:11.5px}
  .spo-modal :focus-visible {outline:3px solid #2d6cdf88;outline-offset:2px}
  [wz-theme=dark] .spo-modal {background:var(--background_default,#1f2024)}
  @media(prefers-reduced-motion:reduce){.spo-switch span:after,.spo-top,.spo-floating .spo-close {transition:none}.spo-top:active,.spo-floating .spo-close:active {transform:none}}`;
    document.head.append(style);
  }

  // src/floating-panel.ts
  function mountFloatingPanel(controller, viewport) {
    document.querySelector(".spo-floating")?.remove();
    const panel = document.createElement("section");
    panel.className = "spo-floating";
    panel.setAttribute("aria-label", "Speed plate layer controls");
    panel.innerHTML = `<header class="spo-floating-header"><strong role="button" tabindex="0" aria-label="Move floating controls" title="Drag to move. Arrow keys move; Home resets position.">Speed Plates</strong><button class="spo-close" type="button" title="Hide floating controls" aria-label="Hide floating controls"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button></header>
    <div class="spo-floating-rows"><div class="spo-floating-row"><span class="spo-floating-label">On top</span>${TOP_LAYER_BUTTON}</div></div>`;
    document.body.append(panel);
    panel.querySelector(".spo-close").onclick = () => controller.settings({ floatingControls: false });
    const top = panel.querySelector(".spo-top");
    top.onclick = () => controller.settings({ forceOnTop: !controller.state.forceOnTop });
    let customPosition = null;
    let drag = null;
    const header = panel.querySelector("header");
    const position = () => {
      if (panel.hidden) return;
      const rect = viewport.getBoundingClientRect();
      const minX = Math.min(Math.max(12, innerWidth - panel.offsetWidth - 12), Math.max(12, rect.left + 12));
      const minY = Math.min(Math.max(12, innerHeight - panel.offsetHeight - 12), Math.max(12, rect.top + 12));
      const maxX = Math.max(minX, Math.min(rect.right, innerWidth) - panel.offsetWidth - 12);
      const maxY = Math.max(minY, Math.min(rect.bottom, innerHeight) - panel.offsetHeight - 12);
      const x = Math.max(minX, Math.min(customPosition?.x ?? minX, maxX));
      const y = Math.max(minY, Math.min(customPosition?.y ?? rect.bottom - panel.offsetHeight - 64, maxY));
      if (customPosition) customPosition = { x, y };
      panel.style.left = `${x}px`;
      panel.style.top = `${y}px`;
    };
    const stopDrag = () => {
      drag = null;
      panel.classList.remove("spo-floating-dragging");
    };
    header.onpointerdown = (event) => {
      if (event.button !== 0 || event.target instanceof Element && event.target.closest("button")) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = panel.getBoundingClientRect();
      drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: rect.left, y: rect.top };
      header.setPointerCapture(event.pointerId);
      panel.classList.add("spo-floating-dragging");
    };
    header.onpointermove = (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      customPosition = { x: drag.x + event.clientX - drag.startX, y: drag.y + event.clientY - drag.startY };
      position();
    };
    header.onpointerup = (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.stopPropagation();
      stopDrag();
      if (header.hasPointerCapture(event.pointerId)) header.releasePointerCapture(event.pointerId);
    };
    header.onpointercancel = stopDrag;
    header.onlostpointercapture = stopDrag;
    header.querySelector("strong").onkeydown = (event) => {
      if (event.key === "Home") {
        event.preventDefault();
        customPosition = null;
        position();
        return;
      }
      const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const direction = directions[event.key];
      if (!direction) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = panel.getBoundingClientRect(), step = event.shiftKey ? 1 : 10;
      customPosition = { x: rect.left + direction[0] * step, y: rect.top + direction[1] * step };
      position();
    };
    const unsubscribe = controller.subscribe(() => {
      localize(panel, controller.state.language);
      if (!controller.state.floatingControls) {
        customPosition = null;
        stopDrag();
      }
      panel.hidden = !controller.state.floatingControls;
      panel.style.opacity = String(controller.state.floatingOpacity);
      top.setAttribute("aria-pressed", String(controller.state.forceOnTop));
      position();
    });
    const observer = new ResizeObserver(position);
    observer.observe(viewport);
    window.addEventListener("resize", position);
    return () => {
      unsubscribe();
      observer.disconnect();
      window.removeEventListener("resize", position);
      panel.remove();
    };
  }

  // src/index.ts
  async function main() {
    const page = window.unsafeWindow ?? window;
    if (page.spoMounted) return;
    page.spoMounted = true;
    try {
      await page.SDK_INITIALIZED;
      const getSdk = page.getWmeSdk;
      if (!getSdk) throw new Error("WME SDK is unavailable.");
      const sdk = getSdk({ scriptId: SCRIPT_ID, scriptName: SCRIPT_NAME, mode: "async" });
      if (!await sdk.State.isReady()) await sdk.Events.once({ eventName: "wme-ready" });
      injectStyles();
      const controller = new Controller();
      await bindMap(sdk, controller);
      const { tabLabel, tabPane } = await sdk.Sidebar.registerScriptTab();
      tabLabel.textContent = "\u53F0\u7063\u901F\u9650\u6A19\u724C\u758A\u5716";
      tabLabel.classList.add("spo-tab-label");
      mountSidebar(tabPane, controller);
      mountFloatingPanel(controller, await sdk.Map.getMapViewportElement());
      void controller.restoreFile();
    } catch (error) {
      page.spoMounted = false;
      console.error(`[${SCRIPT_ID}]`, error);
    }
  }
  void main();
})();

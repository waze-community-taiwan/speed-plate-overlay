import { DEFAULT_COLUMNS, STORAGE_KEY } from "./constants";
import type { Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  language: 'zh-TW',
  sizeVersion: 2,
  enabled: false,
  forceOnTop: false,
  floatingControls: true,
  floatingOpacity: 1,
  badgePosition: 'bottom-right',
  arrowStyle: 'four-direction',
  clockwiseColor: '#34c759',
  counterclockwiseColor: '#ff9500',
  plateScale: 1,
  speedTextScale: 1,
  columnOrder: [],
  visibleColumns: DEFAULT_COLUMNS,
};

const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const strings = (value: unknown, fallback: string[]) => Array.isArray(value)
  ? [...new Set(value.filter((column): column is string => typeof column === 'string'))] : [...fallback];

export const normalizeBadgeColor = (value: unknown, fallback: string): string =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;

export function normalizeSettings(value: Partial<Settings> | null): Settings {
    return {
      language: value?.language === 'en' ? 'en' : 'zh-TW',
      sizeVersion: 2,
      enabled: typeof value?.enabled === "boolean" ? value.enabled : DEFAULT_SETTINGS.enabled,
      forceOnTop: typeof value?.forceOnTop === "boolean" ? value.forceOnTop : DEFAULT_SETTINGS.forceOnTop,
      floatingControls: typeof value?.floatingControls === "boolean" ? value.floatingControls : true,
      floatingOpacity: clamp(value?.floatingOpacity, .1, 1, 1),
      badgePosition: ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(value?.badgePosition ?? '') ? value!.badgePosition! : 'bottom-right',
      arrowStyle: value?.arrowStyle === 'circular' ? 'circular' : 'four-direction',
      clockwiseColor: normalizeBadgeColor(value?.clockwiseColor,DEFAULT_SETTINGS.clockwiseColor),
      counterclockwiseColor: normalizeBadgeColor(value?.counterclockwiseColor,DEFAULT_SETTINGS.counterclockwiseColor),
      plateScale: clamp(value?.plateScale, .25, 4, 1),
      speedTextScale: clamp(value?.speedTextScale, .25, 2, 1),
      columnOrder: strings(value?.columnOrder, []),
      visibleColumns: strings(value?.visibleColumns, DEFAULT_SETTINGS.visibleColumns),
    };
}

export function loadSettings(storage: Storage = localStorage): Settings {
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null') as Partial<Settings> | null;
    // Rebase the previous 100% plate / 150% text appearance to the new 100%.
    return normalizeSettings(saved?.sizeVersion === 2 ? saved : { ...saved, plateScale: 1, speedTextScale: 1 });
  } catch {
    return normalizeSettings(null);
  }
}

export function saveSettings(settings: Settings, storage: Storage = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
}

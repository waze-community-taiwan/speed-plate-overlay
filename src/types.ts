export interface SpeedPlateRecord {
  id: string;
  longitude: number;
  latitude: number;
  speed: string;
  direction: string;
  values: Record<string, string>;
}

export interface ParsedPlateFile {
  headers: string[];
  records: SpeedPlateRecord[];
  rejectedRows: number;
}

export type ArrowStyle = 'four-direction' | 'circular';

export type BadgePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface Settings {
  language: import('./i18n').Language;
  sizeVersion: 2;
  enabled: boolean;
  forceOnTop: boolean;
  floatingControls: boolean;
  floatingOpacity: number;
  badgePosition: BadgePosition;
  arrowStyle: ArrowStyle;
  clockwiseColor: string;
  counterclockwiseColor: string;
  plateScale: number;
  speedTextScale: number;
  columnOrder: string[];
  visibleColumns: string[];
}

export interface AppState extends Settings {
  headers: string[];
  records: SpeedPlateRecord[];
  fileName: string | null;
  rejectedRows: number;
  loading: boolean;
  error: string | null;
}

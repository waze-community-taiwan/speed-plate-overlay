import type { ParsedPlateFile, SpeedPlateRecord } from "./types";

const REQUIRED_COLUMNS = {
  longitude: ["坐標-E-WGS84", "經度", "longitude", "lon", "lng"],
  latitude: ["坐標-N-WGS84", "緯度", "latitude", "lat"],
  speed: ["牌面內容", "速限", "speed", "speed_limit"],
  direction: ["牌面方向", "方向", "direction"],
} as const;

export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
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

function findHeader(headers: string[], aliases: readonly string[]): string | undefined {
  const normalized = new Map(headers.map((header) => [header.trim().toLowerCase(), header]));
  return aliases.map((alias) => normalized.get(alias.toLowerCase())).find(Boolean);
}

export function parseSpeedPlateCsv(text: string): ParsedPlateFile {
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
    [directionHeader, "direction"],
  ].filter(([header]) => !header).map(([, label]) => label);
  if (missing.length) throw new Error(`Missing required column(s): ${missing.join(", ")}.`);

  const records: SpeedPlateRecord[] = [];
  let rejectedRows = 0;
  rows.forEach((cells, rowIndex) => {
    if (cells.every((cell) => cell.trim() === "")) return;
    const values = Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ""]));
    const longitude = Number(values[longitudeHeader!]);
    const latitude = Number(values[latitudeHeader!]);
    if (cells.length !== headers.length || !values[longitudeHeader!]?.trim() || !values[latitudeHeader!]?.trim() || !Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      rejectedRows += 1;
      return;
    }
    records.push({
      id: `sp-${rowIndex + 2}`,
      longitude,
      latitude,
      speed: values[speedHeader!] ?? "",
      direction: values[directionHeader!] ?? "",
      values,
    });
  });
  if (!records.length) throw new Error("CSV contains no rows with valid WGS84 coordinates.");
  return { headers, records, rejectedRows };
}

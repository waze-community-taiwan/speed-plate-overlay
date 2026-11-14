import { beforeEach, expect, it } from 'vitest';
import { parseSpeedPlateCsv } from '../../src/csv';
import { Controller, orderedColumns } from '../../src/controller';
import { mountSidebar } from '../../src/sidebar';
import { STORAGE_KEY } from '../../src/constants';
import { loadSettings, normalizeSettings } from '../../src/state';
const csv = 'longitude,latitude,speed,direction,note\n121.5,25,50,順向,"one, two"\n,25,30,逆向,bad';
beforeEach(() => { localStorage.clear(); document.body.replaceChildren(); });
it('parses quoted CSV and rejects blank coordinates', () => {
  const parsed = parseSpeedPlateCsv('\uFEFF' + csv);
  expect(parsed.records).toHaveLength(1); expect(parsed.rejectedRows).toBe(1);
  expect(parsed.records[0]?.values.note).toBe('one, two');
  expect(() => parseSpeedPlateCsv('lon,lat,speed,direction\n"oops')).toThrow();
});
it('preserves the previous file after a failed replacement and persists only preferences', async () => {
  const controller = new Controller();
  await controller.importFile({ name: 'valid.csv', size: 100, text: async () => csv } as File);
  await controller.importFile({ name: 'bad.csv', size: 1, text: async () => 'bad' } as File);
  expect(controller.state.fileName).toBe('valid.csv'); expect(controller.state.error).toContain('Missing');
  controller.settings({ forceOnTop: true });
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(normalizeSettings(controller.state));
  expect(localStorage.getItem(STORAGE_KEY)).not.toContain('records');
});
it('renders controller state and selectable source columns safely', async () => {
  const controller = new Controller(); const root = document.createElement('div'); document.body.append(root);
  mountSidebar(root, controller);
  expect(root.querySelector<HTMLInputElement>('.spo-enabled')!.disabled).toBe(true);
  await controller.importFile({ name: '<img>.csv', size: 1, text: async () => csv } as File);
  expect(root.querySelector('img')).toBeNull();
  root.querySelector<HTMLButtonElement>('.spo-top')!.click();
  expect(controller.state.forceOnTop).toBe(true);
  root.querySelector<HTMLInputElement>('.spo-columns input')!.click();
  expect(controller.state.visibleColumns).toContain('longitude');
});
it('recovers from invalid settings', () => {
  localStorage.setItem(STORAGE_KEY, '{broken'); expect(loadSettings().enabled).toBe(false);
});

it('keeps popup order independent of selection and persists keyboard reordering', async () => {
  const controller = new Controller(); const root = document.createElement('div'); document.body.append(root);
  mountSidebar(root,controller);
  await controller.importFile({name:'columns.csv',size:1,text:async()=>csv} as File);
  controller.settings({visibleColumns:['longitude','speed']});
  controller.settings({language:'en'});
  const move = root.querySelector<HTMLElement>('[aria-label="Reorder speed"]')!;
  move.focus(); move.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',altKey:true,bubbles:true}));
  expect(orderedColumns(controller.state)).toEqual(['longitude','speed','latitude','direction','note']);
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Reorder speed');
  root.querySelector<HTMLInputElement>('.spo-columns input')!.click();
  root.querySelector<HTMLInputElement>('.spo-columns input')!.click();
  expect(orderedColumns(controller.state).filter(c=>controller.state.visibleColumns.includes(c))).toEqual(['longitude','speed']);
  expect(loadSettings().columnOrder.slice(0,3)).toEqual(['longitude','speed','latitude']);
  root.querySelector<HTMLButtonElement>('.spo-reset-order')!.click();
  expect(orderedColumns(controller.state)).toEqual(controller.state.headers);
  expect(controller.state.visibleColumns).toEqual(['speed','longitude']);
  expect(loadSettings().columnOrder.slice(0,controller.state.headers.length)).toEqual(controller.state.headers);
});

it('defaults to Traditional Chinese and migrates language without discarding existing preferences', () => {
  const {language: _language, ...previous} = normalizeSettings(null);
  const saved = {...previous,forceOnTop:true,plateScale:2,columnOrder:['note','speed']};
  localStorage.setItem(STORAGE_KEY,JSON.stringify(saved));
  expect(loadSettings()).toMatchObject({language:'zh-TW',forceOnTop:true,plateScale:2,columnOrder:['note','speed']});
  const controller = new Controller(); controller.settings({language:'en'});
  expect(loadSettings()).toMatchObject({language:'en',forceOnTop:true,plateScale:2,columnOrder:['note','speed']});
});

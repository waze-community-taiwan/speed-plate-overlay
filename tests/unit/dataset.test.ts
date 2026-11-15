import { beforeEach, expect, it, vi } from 'vitest';
import { Controller } from '../../src/controller';
import type { DatasetStorage, SavedDataset } from '../../src/dataset-storage';

const csv = 'longitude,latitude,speed,direction\n121.5,25,50,順向';
const file = (name = 'plates.csv', text = csv) => ({ name, size: text.length, text: async () => text }) as File;
function storage() {
  let saved: SavedDataset | undefined;
  return {
    load: vi.fn(async () => saved),
    save: vi.fn(async (value: SavedDataset) => { saved = value; }),
    clear: vi.fn(async () => { saved = undefined; }),
  } satisfies DatasetStorage;
}
beforeEach(() => localStorage.clear());

it('saves by default, restores records and respects hidden layer preferences', async () => {
  const db = storage(), first = new Controller(db);
  await first.importFile(file());
  expect(db.save).toHaveBeenCalledOnce();
  const restored = new Controller(db); await restored.restoreFile();
  expect(restored.state).toMatchObject({fileName:'plates.csv', enabled:true, error:null});
  expect(restored.state.records).toEqual(first.state.records);
  restored.settings({enabled:false});
  const hidden = new Controller(db); await hidden.restoreFile();
  expect(hidden.state.enabled).toBe(false); expect(hidden.state.records).toHaveLength(1);
});

it('keeps both the saved and active dataset on invalid replacement, then clears both', async () => {
  const db = storage(), controller = new Controller(db);
  await controller.importFile(file()); await controller.importFile(file('bad.csv','broken'));
  expect(db.save).toHaveBeenCalledOnce(); expect(controller.state.fileName).toBe('plates.csv');
  await controller.clearFile();
  expect(controller.state).toMatchObject({fileName:null,records:[],enabled:false,error:null});
  const restored = new Controller(db); await restored.restoreFile();
  expect(restored.state.records).toEqual([]);
});

it('keeps an imported overlay usable when saving fails and recovers from restore errors', async () => {
  const db = storage(); db.save.mockRejectedValueOnce(new Error('quota'));
  const controller = new Controller(db); await controller.importFile(file());
  expect(controller.state.records).toHaveLength(1);
  expect(controller.state.error).toContain('could not be saved');
  db.load.mockRejectedValueOnce(new Error('unavailable'));
  const restored = new Controller(db); await restored.restoreFile();
  expect(restored.state.loading).toBe(false); expect(restored.state.error).toContain('could not be restored');
  await restored.importFile(file()); expect(restored.state.error).toBeNull();
});

it('does not let a delayed restore overwrite a newly imported file', async () => {
  const db = storage(); let finish!: (value: SavedDataset) => void;
  db.load.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const controller = new Controller(db), restore = controller.restoreFile();
  await controller.importFile(file('new.csv'));
  finish({version:1,fileName:'old.csv',text:csv,importedAt:1}); await restore;
  expect(controller.state.fileName).toBe('new.csv');
});

it('preserves the overlay if deleting storage fails', async () => {
  const db = storage(), controller = new Controller(db); await controller.importFile(file());
  db.clear.mockRejectedValueOnce(new Error('blocked')); await controller.clearFile();
  expect(controller.state.records).toHaveLength(1); expect(controller.state.error).toContain('could not be cleared');
});

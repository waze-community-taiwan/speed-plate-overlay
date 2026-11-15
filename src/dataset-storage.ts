import { SCRIPT_ID } from './constants';

export const MAX_CSV_BYTES = 30 * 1024 * 1024;
export interface SavedDataset { version: 1; fileName: string; text: string; importedAt: number }
export interface DatasetStorage {
  load(): Promise<SavedDataset | undefined>;
  save(dataset: SavedDataset): Promise<void>;
  clear(): Promise<void>;
}

// Wait for transaction completion, not just request success, before reporting a save.
async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open(`${SCRIPT_ID}:datasets`, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('datasets');
    request.onsuccess = () => { if (blocked) request.result.close(); else resolve(request.result); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => { blocked = true; reject(new Error('Dataset storage is blocked by another tab.')); };
  });
  db.onversionchange = () => db.close();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction('datasets', mode);
      const request = action(tx.objectStore('datasets'));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error ?? new Error('Dataset storage transaction aborted.'));
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export const datasetStorage: DatasetStorage = {
  async load() {
    const saved: unknown = await transaction('readonly', store => store.get('current'));
    if (saved === undefined) return undefined;
    const value = saved as Partial<SavedDataset> | null;
    if (!value || value.version !== 1 || typeof value.fileName !== 'string' || typeof value.text !== 'string'
      || typeof value.importedAt !== 'number' || !Number.isFinite(value.importedAt)
      || new Blob([value.text]).size > MAX_CSV_BYTES) throw new Error('Invalid saved CSV.');
    return value as SavedDataset;
  },
  async save(dataset) { await transaction('readwrite', store => store.put(dataset, 'current')); },
  async clear() { await transaction('readwrite', store => store.delete('current')); },
};

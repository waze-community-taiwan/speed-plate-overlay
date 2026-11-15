import { parseSpeedPlateCsv } from './csv';
import { loadSettings, normalizeSettings, saveSettings } from './state';
import type { AppState, Settings } from './types';
import { datasetStorage, MAX_CSV_BYTES, type DatasetStorage } from './dataset-storage';

export function orderedColumns(state: Pick<AppState, 'headers' | 'columnOrder' | 'visibleColumns'>): string[] {
  return [...new Set([...state.columnOrder, ...state.visibleColumns, ...state.headers])].filter(column => state.headers.includes(column));
}

export class Controller {
  state: AppState = { ...loadSettings(), headers: [], records: [], fileName: null, rejectedRows: 0, loading: false, error: null };
  private listeners = new Set<() => void>();
  private revision = 0;
  private storageQueue = Promise.resolve();
  constructor(private readonly datasets: DatasetStorage = datasetStorage) {}
  private persist(action: () => Promise<void>) {
    const job = this.storageQueue.then(action);
    this.storageQueue = job.catch(() => {});
    return job;
  }
  async restoreFile() {
    const revision = this.revision;
    this.state.loading = true; this.emit();
    try {
      const saved = await this.datasets.load();
      if (!saved || revision !== this.revision) return;
      const parsed = parseSpeedPlateCsv(saved.text);
      const columnOrder = [...new Set([...this.state.columnOrder, ...this.state.visibleColumns, ...parsed.headers])];
      Object.assign(this.state, parsed, { fileName: saved.fileName, columnOrder });
    } catch {
      if (revision === this.revision) this.state.error = 'Saved CSV could not be restored. Choose the file again.';
    } finally {
      if (revision === this.revision) { this.state.loading = false; this.emit(); }
    }
  }
  async clearFile() {
    const revision = ++this.revision;
    this.state.loading = true; this.state.error = null; this.emit();
    try {
      await this.persist(() => this.datasets.clear());
      if (revision !== this.revision) return;
      Object.assign(this.state, { headers: [], records: [], fileName: null, rejectedRows: 0 });
      this.settings({ enabled: false });
    } catch {
      if (revision === this.revision) this.state.error = 'Saved CSV could not be cleared. Try again.';
    } finally {
      if (revision === this.revision) { this.state.loading = false; this.emit(); }
    }
  }
  subscribe(fn: () => void) { this.listeners.add(fn); fn(); return () => this.listeners.delete(fn); }
  emit() { this.listeners.forEach(fn => fn()); }
  settings(change: Partial<Settings>) {
    Object.assign(this.state, normalizeSettings({ ...this.state, ...change }));
    try { saveSettings(this.state); } catch { this.state.error = 'Settings could not be saved in this browser.'; }
    this.emit();
  }
  moveColumn(column: string, direction: -1 | 1) {
    const order = orderedColumns(this.state);
    const index = order.indexOf(column), target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target]!, order[index]!];
    this.settings({ columnOrder: [...order, ...this.state.columnOrder.filter(c => !order.includes(c))] });
  }
  reorderColumn(column: string, target: string, after: boolean) {
    const order = orderedColumns(this.state);
    if (column === target || !order.includes(column) || !order.includes(target)) return;
    order.splice(order.indexOf(column), 1);
    order.splice(order.indexOf(target) + Number(after), 0, column);
    this.settings({ columnOrder: [...order, ...this.state.columnOrder.filter(c => !order.includes(c))] });
  }
  resetColumnOrder() {
    this.settings({ columnOrder: [...this.state.headers, ...this.state.columnOrder.filter(c => !this.state.headers.includes(c))] });
  }
  async importFile(file: File) {
    const revision = ++this.revision;
    this.state.loading = true; this.state.error = null; this.emit();
    try {
      if (file.size > MAX_CSV_BYTES) throw new Error('Choose a CSV smaller than 30 MB.');
      const text = await file.text();
      const parsed = parseSpeedPlateCsv(text);
      if (revision !== this.revision) return;
      const columnOrder = [...new Set([...this.state.columnOrder, ...this.state.visibleColumns, ...parsed.headers])];
      Object.assign(this.state, parsed, { fileName: file.name, enabled: true, columnOrder });
      this.settings({ enabled: true });
      try {
        await this.persist(() => this.datasets.save({ version: 1, fileName: file.name, text, importedAt: Date.now() }));
      } catch {
        if (revision === this.revision) this.state.error = 'CSV loaded, but could not be saved in this browser. Select it again after refresh.';
      }
    } catch (error) {
      if (revision === this.revision) this.state.error = String(error instanceof Error ? error.message : error);
    } finally {
      if (revision === this.revision) { this.state.loading = false; this.emit(); }
    }
  }
}

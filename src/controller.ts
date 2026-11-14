import { parseSpeedPlateCsv } from './csv';
import { loadSettings, normalizeSettings, saveSettings } from './state';
import type { AppState, Settings } from './types';

export function orderedColumns(state: Pick<AppState, 'headers' | 'columnOrder' | 'visibleColumns'>): string[] {
  return [...new Set([...state.columnOrder, ...state.visibleColumns, ...state.headers])].filter(column => state.headers.includes(column));
}

export class Controller {
  state: AppState = { ...loadSettings(), headers: [], records: [], fileName: null, rejectedRows: 0, loading: false, error: null };
  private listeners = new Set<() => void>();
  private revision = 0;
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
      if (file.size > 30 * 1024 * 1024) throw new Error('Choose a CSV smaller than 30 MB.');
      const parsed = parseSpeedPlateCsv(await file.text());
      if (revision !== this.revision) return;
      const columnOrder = [...new Set([...this.state.columnOrder, ...this.state.visibleColumns, ...parsed.headers])];
      Object.assign(this.state, parsed, { fileName: file.name, enabled: true, columnOrder });
    } catch (error) {
      if (revision === this.revision) this.state.error = String(error instanceof Error ? error.message : error);
    } finally {
      if (revision === this.revision) { this.state.loading = false; this.emit(); }
    }
  }
}

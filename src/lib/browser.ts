import type { Row } from './types';

const CHECKINS_KEY = 'kyn:checkins:v1';
const THEME_KEY = 'kyn:theme';

export function loadCheckins(): Row[] {
  try {
    const raw = window.localStorage.getItem(CHECKINS_KEY);
    const rows = raw ? (JSON.parse(raw) as Row[]) : [];
    return Array.isArray(rows) ? rows.map((r) => ({ ...r, source: 'checkin' as const })) : [];
  } catch {
    return [];
  }
}

export function saveCheckins(rows: Row[]): boolean {
  try {
    window.localStorage.setItem(CHECKINS_KEY, JSON.stringify(rows));
    return true;
  } catch {
    return false;
  }
}

export function clearCheckins(): void {
  try { window.localStorage.removeItem(CHECKINS_KEY); } catch { /* storage unavailable */ }
}

export function loadTheme(): 'light' | 'dark' {
  try {
    const t = window.localStorage.getItem(THEME_KEY);
    if (t === 'light' || t === 'dark') return t;
  } catch { /* storage unavailable */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function saveTheme(t: 'light' | 'dark'): void {
  try { window.localStorage.setItem(THEME_KEY, t); } catch { /* storage unavailable */ }
}

// ---- Downloads -------------------------------------------------------------
// On its own page the app downloads files directly. Inside the claude.ai artifact
// frame, direct downloads are blocked, so it asks the host's `downloads` capability
// (the viewer confirms each save) and otherwise shows a copy-to-clipboard dialog.

type SaveFn = (req: { filename: string; data: string }) => Promise<{ status: 'saved' | 'delivered' }>;
let downloadsNs: { save: SaveFn } | null = null;

export const isFramed = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();

export function initHostCapabilities(): void {
  const host = (window as unknown as { claude?: { use?: (name: string) => Promise<unknown> } }).claude;
  if (!host?.use) return;
  host.use('downloads')
    .then((ns) => { downloadsNs = (ns as { save: SaveFn } | null) ?? null; })
    .catch(() => { downloadsNs = null; });
}

const notify = (message: string) => window.dispatchEvent(new CustomEvent('kyn:toast', { detail: message }));

export async function downloadText(filename: string, text: string, mime = 'text/plain'): Promise<void> {
  if (!isFramed) {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  if (downloadsNs) {
    try {
      await downloadsNs.save({ filename, data: text });
      notify(`Saved ${filename}.`);
      return;
    } catch (err) {
      if ((err as { code?: string })?.code === 'declined') { notify('Download cancelled.'); return; }
    }
  }
  window.dispatchEvent(new CustomEvent('kyn:export-fallback', { detail: { filename, text } }));
}

/** Records -> CSV text (quotes cells that need it). */
export function toCsv(records: Record<string, string | number | boolean | null | undefined>[]): string {
  if (!records.length) return '';
  const cols = Object.keys(records[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...records.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
}

export function downloadCsv(filename: string, records: Record<string, string | number | boolean | null | undefined>[]): void {
  void downloadText(filename, toCsv(records), 'text/csv');
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

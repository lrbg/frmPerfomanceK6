import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Raiz del proyecto (un nivel arriba de /src)
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPORTS_DIR = path.join(ROOT, 'reports');

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function round(n) {
  return n == null ? null : Math.round(n * 100) / 100;
}

// Percentil sobre un arreglo YA ordenado ascendentemente.
export function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(i, sorted.length - 1))];
}

// Marca de tiempo apta para nombre de carpeta: 2026-07-11T21-05-30
export function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Escapa texto para insertarlo en HTML sin romper el markup.
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

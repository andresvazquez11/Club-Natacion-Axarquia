/* Banco de pruebas: carga los JS de la web (scripts planos que comparten un global) en un contexto vm.
   Lo declarado con const/function de primer nivel se lee con evalIn(ctx, 'nombre'). */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export function cargar(archivos, data, { ls = new Map() } = {}) {
  const localStorage = ls === null
    ? { getItem() { throw new Error('localStorage no disponible'); },
        setItem() { throw new Error('localStorage no disponible'); },
        removeItem() { throw new Error('localStorage no disponible'); } }
    : { getItem: k => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => { ls.set(k, String(v)); }, removeItem: k => { ls.delete(k); } };
  const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {},
    setAttribute() {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] });
  const document = { ...el(), body: el(), documentElement: el(), getElementById: () => null, createElement: el };
  const location = { search: '', hash: '', reload() {} };
  const window = { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
  const ctx = vm.createContext({ DATA: data, window, document, location, localStorage, console, URLSearchParams });
  for (const f of archivos) vm.runInContext(fs.readFileSync(path.join(WEB, f), 'utf8'), ctx, { filename: f });
  return ctx;
}

export const evalIn = (ctx, expr) => vm.runInContext(expr, ctx);

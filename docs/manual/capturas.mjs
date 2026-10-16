/* Capturas del manual (móvil de 390 px) y PDF final.
   Uso: node docs/manual/capturas.mjs <carpeta de trabajo> [URL base]
   Por defecto usa la página publicada. Necesita playwright (en Node). Deja z/*.jpg y manual.pdf en la carpeta de trabajo. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(process.argv[2] || 'manual_out');
const BASE = process.argv[3] || 'https://andresvazquez11.github.io/Club-Natacion-Axarquia/';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const BEN = '6200218';
fs.mkdirSync(path.join(OUT, 'z'), { recursive: true });
fs.copyFileSync(path.join(AQUI, 'manual.html'), path.join(OUT, 'manual.html'));

const br = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const MOV = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

/* Abre una pantalla y guarda lo que se ve en el móvil. sel: elemento que se lleva arriba (bajo la cabecera). */
async function shot(nombre, url, { sel, modo, antes, espera = 1500, clip, alto } = {}) {
  const ctx = await br.newContext(MOV);
  if (modo) await ctx.addInitScript(m => { try { localStorage.setItem('cna_modo', m); } catch (e) {} }, modo);
  const p = await ctx.newPage();
  await p.goto(BASE + url, { waitUntil: 'networkidle', timeout: 120000 }); await p.waitForTimeout(espera);
  if (antes) { await antes(p); await p.waitForTimeout(800); }
  if (sel) await p.evaluate(s => { const el = document.querySelector(s); if (el) window.scrollTo(0, scrollY + el.getBoundingClientRect().top - 66); }, sel);
  await p.waitForTimeout(500);
  const opts = { path: path.join(OUT, 'z', nombre + '.jpg'), type: 'jpeg', quality: 72 };
  if (clip) opts.clip = clip;
  if (alto) { await p.setViewportSize({ width: 390, height: alto }); await p.waitForTimeout(300); }
  await p.screenshot(opts); console.log('ok', nombre);
  await ctx.close();
}

const T = 'temporada.html', C = 'club.html';
await shot('portada', `${T}#mi`);
await shot('cab', `${T}#club`, { clip: { x: 0, y: 0, width: 390, height: 60 } });
await shot('nav', `${T}#mi`, { clip: { x: 0, y: 774, width: 390, height: 70 } });
await shot('acuatico', `${C}#club`, { modo: 'acuatico' });
await shot('elegir', `${C}#mi`, { antes: p => p.fill('#q-est', 'Vaz') });
await shot('mi_top', `${T}#mi`, { alto: 1100 });
await shot('mi_acc', `${T}#mi`, { sel: '.accesos', alto: 1000 });
await shot('marcas', `${T}#mi/marcas`, { antes: p => p.click('[data-pr] >> nth=0'), alto: 1100 });
await shot('evolucion', `${T}#mi/evolucion`, { espera: 4000, alto: 1100 });
await shot('ranking', `${T}#mi/ranking`, { espera: 4000, alto: 1100 });
await shot('espana', `${T}#mi/espana`, { alto: 1100 });
await shot('relevos', `${T}#mi/relevos`, { alto: 1000 });
await shot('club_lista', `${T}#mi/club`, { alto: 900 });
await shot('club_det', `${T}#mi/club`, { antes: p => p.click('a.club-e >> nth=0'), alto: 1500 });
await shot('comparar', `${T}#comparar?ids=${BEN}`, { espera: 9000, alto: 1100 });
await shot('club', `${C}#club`, { alto: 1100 });
await shot('club_nad', `${T}#club/ALE/nadadores`, { alto: 1000 });
await shot('club_rel', `${T}#club/ALE/relevos`, { sel: '.card.rel', alto: 1100 });
await shot('historia', `${T}#club/ALE/historia`, { sel: 'h2.st', alto: 1000 });
await shot('cptos', `${T}#campeonatos`, { alto: 1100 });
await shot('rankings', `${T}#rankings`, { alto: 1000 });

/* PDF A4 con pie de página */
const p = await (await br.newContext()).newPage();
await p.goto('file://' + path.join(OUT, 'manual.html')); await p.waitForTimeout(1500);
await p.pdf({ path: path.join(OUT, 'manual.pdf'), format: 'A4', printBackground: true,
  margin: { top: '13mm', bottom: '15mm', left: '14mm', right: '14mm' }, displayHeaderFooter: true, headerTemplate: '<span></span>',
  footerTemplate: '<div style="font-size:8px;color:#888;width:100%;text-align:center">Manual de uso · Estadísticas C.N. Axarquía · <span class="pageNumber"></span>/<span class="totalPages"></span></div>' });
console.log('PDF', path.join(OUT, 'manual.pdf'));
await br.close();

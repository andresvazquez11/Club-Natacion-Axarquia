"""Capturas para el manual: recortes de zonas concretas de la página en un móvil de 390 px."""
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:8792/'
OUT = sys.argv[1]
BEN = '6200218'
MOV = dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
ESC = dict(viewport={'width': 1366, 'height': 860}, device_scale_factor=1.5)
OCULTAR = ('.nav{display:none!important} html,body{background:#0353a4!important;background-attachment:scroll!important}'
           ' .tabs{position:static!important}')

JS_RECT = """([txt, sel]) => {
  const all = [...document.querySelectorAll(sel)];
  const m = all.filter(e => e.offsetParent !== null && e.textContent.includes(txt));
  if (!m.length) return null;
  m.sort((a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height);
  const r = m[0].getBoundingClientRect();
  return {y: r.top + scrollY, h: r.height};
}"""
SEL = '.card, .kpis, .hero, .seg, .hd, .note, .tw, .sw, .pr, .tabs, .ini-top, .flt, .bar-row, .prs, table, details, .sem-mio'


def nueva(br, url, espera=1800, ocultar=True, antes=None):
    ctx = br.new_context(**MOV); p = ctx.new_page()
    if antes: p.add_init_script(antes)
    p.goto(BASE + url); p.wait_for_timeout(espera)
    if ocultar: p.add_style_tag(content=OCULTAR); p.wait_for_timeout(300)
    return ctx, p


def y_de(p, v, fin):
    if isinstance(v, (int, float)): return v
    txt, sel = (v, SEL) if isinstance(v, str) else v
    r = p.evaluate(JS_RECT, [txt, sel])
    if not r: print('  ✗ no encontrado:', txt); return None
    return r['y'] + (r['h'] if fin else 0)


def zona(p, name, desde, hasta=None, pad=8, maxh=1100, alto=None):
    y0 = y_de(p, desde, False)
    y1 = (y0 + alto) if (alto and y0 is not None) else y_de(p, hasta if hasta is not None else desde, True)
    if y0 is None or y1 is None: return
    y0 = max(0, y0 - pad); y1 = min(y1 + pad, y0 + maxh)
    p.screenshot(path=f'{OUT}/{name}.png', full_page=True, clip={'x': 0, 'y': y0, 'width': 390, 'height': y1 - y0})
    print('ok', name, int(y1 - y0))


def vista(p, name):
    p.screenshot(path=f'{OUT}/{name}.png'); print('ok', name)


with sync_playwright() as pw:
    br = pw.chromium.launch()

    # barra de navegación
    ctx, p = nueva(br, 'temporada.html#inicio', ocultar=False)
    p.screenshot(path=f'{OUT}/nav.png', clip={'x': 0, 'y': 844 - 76, 'width': 390, 'height': 76}); ctx.close()

    # ── club.html: elegir nadador ──
    ctx, p = nueva(br, 'club.html#inicio', ocultar=False)
    vista(p, 'c_inicio')
    p.add_style_tag(content=OCULTAR)
    zona(p, 'c_elige', ['Elige a tu hijo', 'a.card'])
    p.goto(BASE + 'club.html#benicio'); p.wait_for_timeout(1200)
    p.fill('#q-est', 'Vazquez'); p.wait_for_timeout(500); vista(p, 'c_busca')
    p.click(f'[data-est="{BEN}"]'); p.wait_for_timeout(2000); vista(p, 'c_elegido')
    ctx.close()
    ctx, p = nueva(br, 'club.html#inicio')
    jid = p.evaluate("DATA.swimmers.find(s => s.n.startsWith('Jose Conejero')).id")
    p.goto(BASE + f'club.html#nadador/{jid}/resumen'); p.wait_for_timeout(1500); p.add_style_tag(content=OCULTAR)
    zona(p, 'c_marcar', 0, ['Comparar con otros', '.hero'], pad=0)
    ctx.close()

    # ── Inicio ──
    ctx, p = nueva(br, 'temporada.html#inicio')
    zona(p, 'i_top', 0, ['podios en Campeonatos', '.kpis'])
    p.fill('#q-ini', 'anaya'); p.wait_for_timeout(400)
    zona(p, 'i_busca', 0, 330)
    p.fill('#q-ini', ''); p.wait_for_timeout(200)
    zona(p, 'i_ben', ['Ver su ficha', 'a.card'])
    zona(p, 'i_top10', ['Últimos top-10', '.card'])
    zona(p, 'i_cmp', ['El club frente a los demás', '.card'])
    zona(p, 'i_cat', ['Nadadores por categoría', '.card'])
    ctx.close()
    # «Esta semana» con una semana que sí tuvo competiciones (fin de julio)
    ctx, p = nueva(br, 'temporada.html#inicio', antes="window.addEventListener('DOMContentLoaded',()=>{})")
    p.evaluate("DATA.fecha='26/07/2026'; route()"); p.wait_for_timeout(500); p.add_style_tag(content=OCULTAR)
    zona(p, 'i_sem', ['Esta semana', '.card'])
    ctx.close()

    # ── Club ──
    ctx, p = nueva(br, 'temporada.html#club/ALE')
    zona(p, 'cl_top', 0, ['Ordenar por', '.flt'])
    zona(p, 'cl_ben', ['Benicio Vazquez Altamirano', '.sw'])
    ctx.close()
    ctx, p = nueva(br, 'temporada.html#club/ALE/relevos')
    zona(p, 'r_top', 0, ['Málaga', '.bar-row'])
    p.evaluate("document.querySelectorAll('.card.rel')[0].querySelectorAll('details').forEach(d => d.open = true)"); p.wait_for_timeout(300)
    zona(p, 'r_card', ['4x100 Libre', '.card.rel'], maxh=1150)
    p.evaluate("[...document.querySelectorAll('.card.rel')].find(c => c.textContent.includes('4x200 Libre')).querySelectorAll('details').forEach(d => d.open = d.textContent.includes('Quién'))"); p.wait_for_timeout(300)
    zona(p, 'r_falta', ['Quién puede entrar', 'details'], maxh=900)
    ctx.close()
    ctx, p = nueva(br, 'temporada.html#club/ALE/records')
    zona(p, 'rec', 0, 1000)
    ctx.close()

    # ── Campeonatos ──
    ctx, p = nueva(br, 'temporada.html#campeonatos')
    zona(p, 'cto', 0, ['Medallero del club', '.card'], maxh=1150)
    ctx.close()

    # ── Ficha ──
    ctx, p = nueva(br, 'temporada.html#benicio/resumen', 2500)
    zona(p, 'f_hero', 0, ['Resumen', '.tabs'])
    zona(p, 'f_obj', ['Próximos objetivos', '.card'])
    p.evaluate("[...document.querySelectorAll('.badge')].find(b => !b.classList.contains('on')).click()"); p.wait_for_timeout(200)
    zona(p, 'f_ins', ['Insignias', '.card'])
    zona(p, 'f_an', ['Puntos fuertes', '.card'], maxh=900)
    zona(p, 'f_evo', ['Su evolución', '.card'], maxh=700)
    p.evaluate("document.querySelector('details.comp').open = true"); p.wait_for_timeout(200)
    zona(p, 'f_comp', ['pulsa una para ver sus pruebas', '.card'], maxh=760)
    ctx.close()
    ctx, p = nueva(br, 'temporada.html#benicio/pruebas')
    zona(p, 'p_lista', ['De su mejor a su peor', '.bar-row'], alto=760)
    ctx.close()
    ctx, p = nueva(br, 'temporada.html#benicio/pruebas?ev=100%20Mariposa')
    zona(p, 'p_abierta', ['100 Mariposa', '.pr'], maxh=1050)
    ctx.close()
    ctx, p = nueva(br, 'temporada.html#benicio/historial', 3000)
    zona(p, 'e_nivel', ['Nivel por temporada', '.card'])
    zona(p, 'e_graf', ['Por prueba', '.bar-row'], ['mejor marca de cada temporada', '.card'], maxh=1100)
    zona(p, 'e_tabla', ['temporada a temporada', '.card'], maxh=800)
    zona(p, 'e_mapa', ['Todas sus pruebas, temporada a temporada', '.card'], maxh=900)
    ctx.close()
    ctx, p = nueva(br, 'temporada.html#benicio/ranking', 3000)
    zona(p, 'k_hoy', ['Comparando con', '.bar-row'], ['Ver los 10 primeros', 'details'])
    zona(p, 'k_graf', ['Temporada (oficial)', '.bar-row'], ['ranking de los últimos 12 meses', '.card'], maxh=1150)
    ctx.close()
    ctx, p = nueva(br, 'temporada.html#benicio/objetivos', 3000)
    zona(p, 'o_and', ['Alevín de invierno', '.card'], maxh=1000)
    zona(p, 'o_min', ['Mínimas del Campeonato de España', 'h2'], ['mínimas conseguidas', '.kpis'])
    zona(p, 'o_rel', ['Relevos del club', 'h2'], alto=900)
    ctx.close()

    # ── Comparar (desde la ficha) ──
    ctx, p = nueva(br, f'temporada.html#comparar?ids={BEN},6310112,5507029,5038493', 4000)
    zona(p, 'cmp_top', 0, ['Nadadores elegidos', '.card'])
    zona(p, 'cmp_graf', ['mejor marca de cada temporada', '.card'])
    ctx.close()

    # ── Rankings ──
    ctx, p = nueva(br, 'temporada.html#rankings')
    zona(p, 'rk', 0, 1000)
    ctx.close()

    # ── Ventanas ──
    ctx, p = nueva(br, 'temporada.html#inicio', ocultar=False)
    p.locator('.kpi[data-stat]').nth(1).click(); p.wait_for_timeout(900); vista(p, 'v_stat')
    ctx.close()

    # ── Ordenador ──
    ctx = br.new_context(**ESC); p = ctx.new_page()
    p.goto(BASE + 'temporada.html#inicio'); p.wait_for_timeout(2500)
    p.screenshot(path=f'{OUT}/d_inicio.png'); print('ok d_inicio')
    ctx.close()
    br.close()

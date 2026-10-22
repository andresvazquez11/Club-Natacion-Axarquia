"""Vuelve a montar temporada.html y club.html con la plantilla actual (pipeline/web) y los MISMOS datos que ya llevan,
sin descargar nada de la RFEN. Útil tras cambiar el diseño o el JS de la web.
Uso: python pipeline/rehacer_html.py"""
import json, os, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, 'pipeline'))
import generar as G

plantilla = G.montar_html()
for nombre in ('temporada.html', 'club.html'):
    ruta = os.path.join(RAIZ, nombre)
    html = open(ruta, encoding='utf-8').read()
    i = html.index('const DATA = ') + len('const DATA = ')
    data, _ = json.JSONDecoder().raw_decode(html, i)
    with open(ruta, 'w', encoding='utf-8') as f:
        f.write(plantilla.replace('/*__DATA__*/null', json.dumps(data, ensure_ascii=False, separators=(',', ':'))))
    print(f'{nombre}: rehecha con la plantilla actual (datos del {data.get("fecha", "?")})')

#!/usr/bin/env python3
"""
Precalcula, en local, lo que no cambia:
  · las temporadas cerradas 21-22 a 24-25 de los nadadores del club → pipeline/historial_base.json.gz
  · las fotos semanales del ranking desde el inicio de la 25-26 → historico_ranking.json (raíz del repo)

Uso:
  python3 pipeline/construir_historial.py <carpeta con RAW_2122…RAW_2425, RAW_2526(_v2), RAW_2627> [temporada.html]

Vuelve a ejecutarlo si entran nadadores nuevos en el club (el historial solo se guarda de los del club).
"""
import sys, os, json, gzip, re
from datetime import date
import historial as H

BASE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(BASE)


def club_actual(html):
    """{pid: (sexo, año)} de los nadadores que aparecen en temporada.html."""
    data = json.loads(re.search(r'const DATA = (\{.*?\});\n', open(html, encoding='utf-8').read(), re.S).group(1))
    return {s['id']: (s['g'], s['y']) for s in data['swimmers']}


def raw(carpeta, t):
    for n in (f'RAW_{t}_v2', f'RAW_{t}'):
        p = os.path.join(carpeta, n)
        if os.path.isdir(p):
            return p
    return None


def main():
    carpeta = sys.argv[1]
    html = sys.argv[2] if len(sys.argv) > 2 else os.path.join(REPO, 'temporada.html')
    club = club_actual(html)
    print(f'{len(club)} nadadores del club')

    temps = {}
    for t in ('2122', '2223', '2324', '2425'):
        p = raw(carpeta, t)
        if not p:
            print(f'  ⚠ falta RAW_{t}'); continue
        temps[t] = {str(k): v for k, v in H.resumen_temporada(H.cargar(p), club).items()}
        print(f'  {H.etiqueta(t)}: {len(temps[t])} nadadores del club con marcas')
    with gzip.open(os.path.join(BASE, 'historial_base.json.gz'), 'wt', 9, encoding='utf-8') as f:
        json.dump({'club': list(club), 'temps': temps}, f, ensure_ascii=False, separators=(',', ':'))

    # fotos semanales desde el 1 de septiembre de 2025 (el modo 12 meses usa también la 24-25)
    filas = [H.cargar(raw(carpeta, t)) for t in ('2425', '2526', '2627') if raw(carpeta, t)]
    marcas, prov = H.preparar_marcas(filas, club)
    semanas = H.domingos(date(2025, 9, 1), date.today())
    fotos = H.fotos(marcas, prov, club, semanas)
    ruta = os.path.join(REPO, 'historico_ranking.json')
    guardadas = json.load(open(ruta)) if os.path.exists(ruta) else {}
    fotos = H.fusionar_fotos(guardadas, fotos)
    with open(ruta, 'w', encoding='utf-8') as f:
        json.dump(fotos, f, ensure_ascii=False, separators=(',', ':'))
    print(f'  {len(fotos)} semanas de ranking guardadas → {ruta} ({os.path.getsize(ruta) / 1e6:.1f} MB)')


if __name__ == '__main__':
    main()

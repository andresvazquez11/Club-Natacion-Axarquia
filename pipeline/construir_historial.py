#!/usr/bin/env python3
"""
Precalcula, en local, lo que no cambia:
  · las temporadas cerradas 10-11 a 25-26 de los nadadores del club y el nivel de todos los nadadores de
    sus mismos ámbitos (para comparar) → pipeline/historial_base.json.gz
  · las marcas de la 25-26 de esos ámbitos → pipeline/marcas_2526.json.gz
  · las fotos semanales del ranking desde octubre de 2025 → historico_ranking.json.gz (raíz del repo)
  · los nadadores comparables (club + Málaga + 30 mejores de Andalucía y España) → pipeline/comparables_base.json.gz

Uso:
  python3 pipeline/construir_historial.py <carpeta con RAW_1011…RAW_2425, RAW_2526(_v2), RAW_2627> [temporada.html]

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

    # nadadores comparables (sección «Comparar»): club + provincia de Málaga + 30 mejores de Andalucía y de España
    bolsa = H.bolsa_comparables(H.cargar(raw(carpeta, '2526')), club)
    print(f'  {len(bolsa)} nadadores comparables')
    temps, coh, comp_t, comp_d = {}, {}, {}, {}
    for t in H.TEMPORADAS[:-1]:            # todas las cerradas (10-11 … 25-26)
        p = raw(carpeta, t)
        if not p:
            print(f'  ⚠ falta RAW_{t}'); continue
        filas = H.cargar(p)
        out, niv = H.resumen_temporada(filas, club, cohorte=True)
        temps[t] = {str(k): v for k, v in out.items()}
        coh[t] = {amb: {str(k): v for k, v in d.items()} for amb, d in niv.items()}
        ct, cd = H.resumen_comparables(filas, bolsa)
        comp_t[t] = {str(k): v for k, v in ct.items()}
        comp_d.update({str(k): v for k, v in cd.items()})      # gana la temporada más reciente
        print(f'  {H.etiqueta(t)}: {len(temps[t])} nadadores del club con marcas · {len(ct)} comparables')
    with gzip.open(os.path.join(BASE, 'comparables_base.json.gz'), 'wt', 9, encoding='utf-8') as f:
        json.dump({'bolsa': sorted(bolsa), 't': comp_t, 'd': comp_d}, f, ensure_ascii=False, separators=(',', ':'))
    print(f'  comparables guardados ({os.path.getsize(os.path.join(BASE, "comparables_base.json.gz")) / 1e6:.1f} MB)')
    # récords del club: todas las marcas hechas con el club en las temporadas cerradas, también de quien ya no está
    recs = H.marcas_club_records({t: H.cargar(raw(carpeta, t)) for t in H.TEMPORADAS[:-1] if raw(carpeta, t)})
    with gzip.open(os.path.join(BASE, 'records_base.json.gz'), 'wt', 9, encoding='utf-8') as f:
        json.dump(recs, f, ensure_ascii=False, separators=(',', ':'))
    print(f'  récords del club: {len(recs)} pruebas/categorías guardadas')
    with gzip.open(os.path.join(BASE, 'historial_base.json.gz'), 'wt', 9, encoding='utf-8') as f:
        json.dump({'club': list(club), 'temps': temps, 'coh': coh}, f, ensure_ascii=False, separators=(',', ':'))

    # la 25-26 ya está cerrada: sus marcas (de los ámbitos del club) se guardan para el ranking de 12 meses
    # y la clasificación al Campeonato de Andalucía, así la nube no tiene que volver a descargarla
    filas = {t: H.cargar(raw(carpeta, t)) for t in ('2425', '2526', '2627') if raw(carpeta, t)}
    m26, i26 = H.preparar_marcas({'2526': filas['2526']}, club)
    H.guardar_marcas(os.path.join(BASE, 'marcas_2526.json.gz'), m26, i26)
    print(f'  marcas 25-26 guardadas ({os.path.getsize(os.path.join(BASE, "marcas_2526.json.gz")) / 1e6:.1f} MB)')

    # fotos semanales del ranking desde el inicio de la 25-26 (el modo 12 meses usa también la 24-25)
    marcas, info = H.preparar_marcas(filas, club)
    semanas = H.domingos(date(2025, 10, 1), date.today())
    fotos = H.fotos(marcas, info, club, semanas)
    ruta = os.path.join(REPO, 'historico_ranking.json.gz')
    with gzip.open(ruta, 'wt', 9, encoding='utf-8') as f:
        json.dump(H.fusionar_fotos({}, fotos), f, ensure_ascii=False, separators=(',', ':'))
    print(f'  {len(fotos)} semanas de ranking reconstruidas → {ruta} ({os.path.getsize(ruta) / 1e6:.1f} MB)')


if __name__ == '__main__':
    main()

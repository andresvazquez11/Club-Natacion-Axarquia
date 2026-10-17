#!/usr/bin/env python3
"""
Precalcula, en local, lo que no cambia:
  · las temporadas cerradas 13-14 a 25-26 de los nadadores del club y el nivel de todos los nadadores de
    sus mismos ámbitos (para comparar) → pipeline/historial_base.json.gz
  · las marcas de la 25-26 de esos ámbitos → pipeline/marcas_2526.json.gz
  · las fotos semanales del ranking desde octubre de 2025 → historico_ranking.json.gz (raíz del repo)
  · los nadadores comparables (club + Málaga + 30 mejores de Andalucía y España) → pipeline/comparables_base.json.gz

  · todas las marcas hechas con el club en las temporadas cerradas → pipeline/club_historico.json.gz (≈1 MB, va en
    GitHub) y, a partir de ellas, los récords del club (top-10) → records_base.json.gz y la mejor marca de cada
    nadador del club por edad, prueba y piscina → edades_base.json.gz

Uso:
  python3 pipeline/construir_historial.py <carpeta con RAW_1011…RAW_2425, RAW_2526(_v2), RAW_2627> [temporada.html]
  python3 pipeline/construir_historial.py <carpeta> --solo-club       (extracto del club + récords + base por edad)
  python3 pipeline/construir_historial.py --desde-extracto            (récords + base por edad desde el extracto,
                                                                        sin carpetas RAW: sirve en GitHub)

Vuelve a ejecutarlo si entran nadadores nuevos en el club (el historial solo se guarda de los del club).
"""
import sys, os, json, gzip, re
from datetime import date
import historial as H

BASE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(BASE)
EXTRACTO = os.path.join(BASE, 'club_historico.json.gz')
RECORDS_TOP = 10           # récords del club: los 10 mejores de cada prueba (en la web, 3 a la vista y 10 al desplegar)


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


def solo_club(filas, club_match='AXARQ'):
    """Las filas (marcas RFEN) hechas con el club."""
    return [r for r in filas if club_match in str(r.get('club') or '').upper()]


def _guardar(nombre, datos):
    ruta = os.path.join(BASE, nombre)
    with gzip.open(ruta, 'wt', 9, encoding='utf-8') as f:
        json.dump(datos, f, ensure_ascii=False, separators=(',', ':'))
    return os.path.getsize(ruta) / 1e6


def guardar_extracto(carpeta):
    """{temporada: [filas del club]} de las temporadas cerradas → club_historico.json.gz. Devuelve ese dict."""
    ext = {t: solo_club(H.cargar(raw(carpeta, t))) for t in H.TEMPORADAS[:-1] if raw(carpeta, t)}
    mb = _guardar('club_historico.json.gz', ext)
    print(f'  extracto del club: {sum(map(len, ext.values())):,} marcas ({mb:.2f} MB)')
    return ext


def guardar_bases_club(ext):
    """Récords del club (top-10) y mejor marca por edad, desde las marcas del club → records_base y edades_base."""
    recs = H.marcas_club_records(ext, top=RECORDS_TOP)
    print(f'  récords del club: {len(recs)} pruebas/categorías ({_guardar("records_base.json.gz", recs):.2f} MB)')
    ed = H.marcas_club_edades(ext)
    print(f'  base por edad: {len(ed)} claves ({_guardar("edades_base.json.gz", ed):.2f} MB)')


def main():
    if '--desde-extracto' in sys.argv:
        guardar_bases_club(H.cargar(EXTRACTO))
        return
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    carpeta = args[0]
    if '--solo-club' in sys.argv or '--solo-edades' in sys.argv:      # --solo-edades: nombre antiguo
        guardar_bases_club(guardar_extracto(carpeta))
        return
    html = args[1] if len(args) > 1 else os.path.join(REPO, 'temporada.html')
    club = club_actual(html)
    print(f'{len(club)} nadadores del club')

    # nadadores comparables (sección «Comparar»): club + provincia de Málaga + 30 mejores de Andalucía y de España
    bolsa = H.bolsa_comparables(H.cargar(raw(carpeta, '2526')), club)
    print(f'  {len(bolsa)} nadadores comparables')
    temps, coh, comp_t, comp_d = {}, {}, {}, {}
    for t in H.TEMPORADAS[:-1]:            # todas las cerradas (13-14 … 25-26)
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
    # historia del club temporada a temporada (Club → Historia)
    historia = {}
    for t in H.TEMPORADAS[:-1]:
        if raw(carpeta, t):
            h = H.historia_temporada(H.cargar(raw(carpeta, t)), t)
            if h: historia[t] = h
    with gzip.open(os.path.join(BASE, 'historia_base.json.gz'), 'wt', 9, encoding='utf-8') as f:
        json.dump(historia, f, ensure_ascii=False, separators=(',', ':'))
    print(f'  historia del club: {len(historia)} temporadas')
    # marcas hechas con el club en las temporadas cerradas (también de quien ya no está): extracto, récords y base por edad
    guardar_bases_club(guardar_extracto(carpeta))
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

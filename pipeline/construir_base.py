#!/usr/bin/env python3
"""
Construye pipeline/base_2526.json.gz a partir de la descarga completa de la 25-26
(carpeta RAW, ~370 MB) para que GitHub Actions no tenga que volver a bajarla.

Guarda:
  · la mejor marca de cada nadador por prueba y piscina (rankings y referencias)
  · la marca más reciente de cada nadador (para saber su club actual)
  · TODAS las marcas de los nadadores del C.N. Axarquía, con su puesto en la
    competición ya calculado (cpos / cn), porque el resto de nadadores de esas
    competiciones no se guarda.

Uso: python3 construir_base.py <carpeta_RAW_2526> [salida.json.gz]
"""
import sys, os, json, glob, gzip
from collections import defaultdict

CLUB_MATCH = 'AXARQ'


def iso(d):
    p = (d or '').split('/')
    return f'{p[2]}-{p[1]}-{p[0]}' if len(p) == 3 else (d or '')


def main():
    raw = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'base_2526.json.gz')
    rows = [r for f in glob.glob(os.path.join(raw, '*.json')) for r in json.load(open(f, encoding='utf-8'))
            if r.get('valor_original') and r.get('profile_id') and not r.get('parcial')]   # sin parciales

    # Puesto en cada competición (misma lógica que generar.py → puesto())
    comp_best = defaultdict(dict)
    for r in rows:
        if r.get('id_competicion') and not r.get('parcial'):
            g = comp_best[(r['id_competicion'], r['estilo'], r['id_tipo_piscina'], r['genero'], r['fecha_nacimiento'])]
            if r['profile_id'] not in g or r['valor_original'] < g[r['profile_id']]:
                g[r['profile_id']] = r['valor_original']

    best, latest, club = {}, {}, []
    for r in rows:
        if CLUB_MATCH in (r['club'] or '').upper():
            r = dict(r)
            g = None if r.get('parcial') or not r.get('id_competicion') else \
                comp_best.get((r['id_competicion'], r['estilo'], r['id_tipo_piscina'], r['genero'], r['fecha_nacimiento']))
            if g and g.get(r['profile_id']) == r['valor_original']:
                r['cpos'] = 1 + sum(1 for p, v in g.items() if v < r['valor_original'] and p != r['profile_id'])
                r['cn'] = len(g)
            else:
                r['cpos'], r['cn'] = None, None
            club.append(r)
            continue
        k = (r['profile_id'], r['estilo'], r['id_tipo_piscina'])
        if k not in best or r['valor_original'] < best[k]['valor_original']:
            best[k] = r
        lk = (iso(r['date']), ' '.join((r['club'] or '').split()))
        if r['profile_id'] not in latest or latest[r['profile_id']][0] <= lk:
            latest[r['profile_id']] = (lk, r)

    keep = {id(r): r for r in best.values()}
    for _, r in latest.values():
        keep[id(r)] = r
    compact = []
    for r in keep.values():
        r = {k: v for k, v in r.items() if k not in ('competition_name', 'location', 'id_tipo_crono', 'parcial',
                                                    'id_federacion', 'id_competicion', 'posicion')}
        compact.append(r)
    compact += club
    with gzip.open(out, 'wt', 9, encoding='utf-8') as f:
        json.dump(compact, f, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(compact):,} filas ({len(club):,} del club) → {out} ({os.path.getsize(out)/1e6:.1f} MB)')


if __name__ == '__main__':
    main()

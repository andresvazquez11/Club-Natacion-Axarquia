#!/usr/bin/env python3
"""
generar_temporada_2627.py
=========================
Informe de ARRANQUE de la temporada 26-27 del C.N. Axarquía.
Parte de las mejores marcas de la temporada 25-26 (RAW_2526, descargado con
descargar_2526_completo.py) y recoloca a cada nadador en su categoría 26-27.

Para cada nadador y prueba calcula su posición y rivales en 3 niveles:
  · España    (todos los nadadores RFEN)
  · Andalucía (clubes de las 8 provincias andaluzas)
  · Málaga    (clubes de la provincia de Málaga)
y en 2 ámbitos: mismo año de nacimiento, y categoría 26-27 completa.

Salida: ~/Desktop/CNA_Temporada_26-27.html
"""
import os, json, glob
from collections import defaultdict
from datetime import date, datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Rutas configurables por variables de entorno (las usa GitHub Actions)
RAW_DIR  = os.environ.get('CNA_BASE', os.path.join(BASE_DIR, 'RAW_2526'))   # carpeta o .json.gz
RAW_NEW  = os.environ.get('CNA_NEW', os.path.join(BASE_DIR, 'RAW_2627'))
HTML_OUT = os.environ.get('CNA_OUT', os.path.expanduser('~/Desktop/CNA_Temporada_26-27.html'))
TPL      = os.path.join(BASE_DIR, 'temporada_2627_template.html')

CLUB_MATCH = 'AXARQ'
ANDALUCIA  = {'ALMERIA', 'CADIZ', 'CORDOBA', 'GRANADA', 'HUELVA', 'JAEN', 'MALAGA', 'SEVILLA'}
TOP_N      = 20     # tamaño de las listas de cada nivel
NB         = 2      # rivales por delante / por detrás

# Categorías 26-27: iguales para chicos y chicas (referencia: Alevín = 2014-2015)
_CATS = [('PRE', 'Prebenjamín', [2018, 2019]), ('BEN', 'Benjamín', [2016, 2017]),
         ('ALE', 'Alevín', [2014, 2015]), ('INF', 'Infantil', [2012, 2013]),
         ('JUN', 'Junior', [2010, 2011])]
CATEGORIAS = {'M': _CATS, 'F': _CATS}
# Pruebas que deciden la clasificación a la Copa de Andalucía de Benicio
CLAVES_BENICIO = ['100 Libre', '100 Braza', '100 Mariposa', '100 Espalda']
REF_POS = [1, 3, 8, 16, 24]
PRUEBA_ORDER = ['50 Libre', '100 Libre', '200 Libre', '400 Libre', '800 Libre', '1500 Libre',
                '50 Espalda', '100 Espalda', '200 Espalda', '50 Braza', '100 Braza', '200 Braza',
                '50 Mariposa', '100 Mariposa', '200 Mariposa', '100 Estilos', '200 Estilos', '400 Estilos']


def norm(s):
    return ' '.join(str(s or '').split())


def tc(s):
    return norm(s).title().replace(' De ', ' de ').replace(' Del ', ' del ')


def strip_acc(s):
    return (norm(s).upper().replace('Á', 'A').replace('É', 'E').replace('Í', 'I')
            .replace('Ó', 'O').replace('Ú', 'U'))


def cat_of(g, year):
    for k, lbl, yrs in CATEGORIAS[g]:
        if year in yrs:
            return k, lbl, max(yrs) - year + 1, yrs   # 1er año = el más joven
    return None, None, None, None


def fina(rm, cs):
    try:
        rm, cs = float(rm), float(cs)
        return round(1000 * (rm / cs) ** 3) if rm > 0 and cs > 0 else 0
    except (TypeError, ValueError):
        return 0


def iso(d):
    try:
        return datetime.strptime(d, '%d/%m/%Y').strftime('%Y-%m-%d')
    except Exception:
        return d or ''


def load(raw_dir):
    if raw_dir.endswith('.gz'):
        import gzip
        with gzip.open(raw_dir, 'rt', encoding='utf-8') as fh:
            return json.load(fh)
    rows = []
    for f in glob.glob(os.path.join(raw_dir, '*.json')):
        with open(f, encoding='utf-8') as fh:
            rows.extend(json.load(fh))
    return rows


def main():
    rows = [dict(r, _ss='25-26') for r in load(RAW_DIR)]
    rows_new = [dict(r, _ss='26-27') for r in load(RAW_NEW)] if os.path.exists(RAW_NEW) else []
    rows += rows_new
    print(f'{len(rows):,} marcas cargadas ({len(rows_new):,} de la 26-27)')

    # ── Mejor marca por nadador+prueba e historial ─────────────────────────────
    best, hist, info = {}, defaultdict(list), {}
    best_pool = {}   # (pid, prueba, piscina) -> cs
    for r in rows:
        if not r.get('valor_original') or not r.get('profile_id'):
            continue
        pid, ev, cs = r['profile_id'], r['estilo'], int(r['valor_original'])
        if ev not in PRUEBA_ORDER:
            continue
        prov = strip_acc(r.get('provincia'))
        # Club/provincia = los de su marca más reciente (por si cambió de club)
        dkey = (iso(r['date']), norm(r['club']))
        if pid not in info or info[pid]['_d'] <= dkey:
            info[pid] = {'_d': dkey, 'n': tc(r['nombre']), 'c': norm(r['club']), 'p': prov.title(),
                         'y': int(r['fecha_nacimiento']), 'g': r['genero'],
                         'and': prov in ANDALUCIA, 'mal': prov == 'MALAGA',
                         'ax': CLUB_MATCH in norm(r['club']).upper()}
        hist[(pid, ev)].append((iso(r['date']), cs, r['id_tipo_piscina']))
        kp = (pid, ev, r['id_tipo_piscina'])
        if kp not in best_pool or cs < best_pool[kp]:
            best_pool[kp] = cs
        cur = best.get((pid, ev))
        if cur is None or cs < cur['cs']:
            best[(pid, ev)] = {'cs': cs, 'm': r['value'], 'pts': fina(r['record_mundo'], cs),
                               'pool': r['id_tipo_piscina'], 'comp': norm(r.get('competition_name')).title(),
                               'loc': norm(r.get('location')).title(), 'date': iso(r['date']),
                               'ss': r['_ss']}

    # ── Agrupar por ámbito: año de nacimiento y categoría 26-27 ───────────────
    scopes = defaultdict(lambda: defaultdict(list))   # scope -> prueba -> [(cs,pid)]
    for (pid, ev), b in best.items():
        i = info[pid]
        scopes[f"{i['g']}|{i['y']}"][ev].append((b['cs'], pid))
        ck = cat_of(i['g'], i['y'])[0]
        if ck:
            scopes[f"{i['g']}|{ck}"][ev].append((b['cs'], pid))
    for sc in scopes.values():
        for ev in sc:
            sc[ev].sort()

    LEVELS = {'es': lambda i: True, 'an': lambda i: i['and'], 'ma': lambda i: i['mal']}

    def level_list(scope, ev, lv):
        return [(cs, pid) for cs, pid in scopes[scope][ev] if LEVELS[lv](info[pid])]

    def entry(pos, cs, pid):
        i, b = info[pid], best[(pid, ev_cur[0])]
        return [i['n'], i['c'], i['p'], cs, b['pts'], pos, i['y'], 1 if i['ax'] else 0]

    ev_cur = [None]
    club_ids = sorted({pid for pid, i in info.items() if i['ax']}, key=lambda p: info[p]['n'])
    club_scopes = set()
    for pid in club_ids:
        i = info[pid]
        club_scopes.add(f"{i['g']}|{i['y']}")
        ck = cat_of(i['g'], i['y'])[0]
        if ck:
            club_scopes.add(f"{i['g']}|{ck}")

    # ── Listas de cada prueba y nivel (solo ámbitos con nadadores del club) ──
    lists = {}
    for scope in sorted(club_scopes):
        for ev in PRUEBA_ORDER:
            if ev not in scopes[scope]:
                continue
            ev_cur[0] = ev
            obj = {}
            for lv in LEVELS:
                ll = level_list(scope, ev, lv)
                out = [entry(k + 1, cs, pid) for k, (cs, pid) in enumerate(ll) if k < TOP_N]
                out += [entry(k + 1, cs, pid) for k, (cs, pid) in enumerate(ll)
                        if k >= TOP_N and info[pid]['ax']]
                obj[lv] = out
                obj['t' + lv] = len(ll)
            lists[f'{scope}|{ev}'] = obj

    # ── Ficha de cada nadador del club ────────────────────────────────────────
    swimmers = []
    for pid in club_ids:
        i = info[pid]
        ck, clbl, cyear, cyrs = cat_of(i['g'], i['y'])
        events = []
        for ev in PRUEBA_ORDER:
            b = best.get((pid, ev))
            if not b:
                continue
            ev_cur[0] = ev
            rk, nb = {}, {}
            for skey, scope in (('y', f"{i['g']}|{i['y']}"), ('c', f"{i['g']}|{ck}")):
                if not ck and skey == 'c':
                    continue
                rk[skey], nb[skey] = {}, {}
                for lv in LEVELS:
                    ll = level_list(scope, ev, lv)
                    if not LEVELS[lv](i):
                        continue
                    pos = next(k for k, (_, p) in enumerate(ll) if p == pid)
                    lead = ll[0][0]
                    rk[skey][lv] = [pos + 1, len(ll), b['cs'] - lead]
                    lo, hi = max(0, pos - NB), min(len(ll), pos + NB + 1)
                    nb[skey][lv] = [entry(k + 1, ll[k][0], ll[k][1]) for k in range(lo, hi)]
            # Evolución solo en la piscina de su mejor marca (25 m y 50 m no son comparables)
            h = sorted(x for x in hist[(pid, ev)] if x[2] == b['pool'])
            first = h[0][1] if h else b['cs']
            events.append({'e': ev, 'm': b['m'], 'cs': b['cs'], 'pts': b['pts'], 'pool': b['pool'],
                           'comp': b['comp'], 'loc': b['loc'], 'date': b['date'], 'ss': b['ss'],
                           'h': [[d, cs, pl] for d, cs, pl in h], 'first': first,
                           'rk': rk, 'nb': nb})
        events.sort(key=lambda e: -e['pts'])
        pts = [e['pts'] for e in events]
        swimmers.append({
            'id': pid, 'n': i['n'], 'y': i['y'], 'g': i['g'], 'cat': ck, 'catl': clbl, 'cy': cyear,
            'ev': events, 'best': max(pts, default=0), 'top3': sum(sorted(pts, reverse=True)[:3]),
            'np': len(events),
            'last': max((d for e in events for d, _, _ in e['h']), default=''),
            'benicio': 'BENICIO VAZQUEZ' in i['n'].upper(),
        })

    # ── Clubes rivales: presencias en top-8 por categoría y nivel ───────────
    rivals = {}
    for g, cats in CATEGORIAS.items():
        for ck, _, _ in cats:
            scope = f'{g}|{ck}'
            if scope not in club_scopes:
                continue
            rivals[scope] = {}
            for lv in ('an', 'ma', 'es'):
                cnt = defaultdict(lambda: [0, 0, 0])   # top8, oros, pts
                for ev in scopes[scope]:
                    for k, (cs, pid) in enumerate(level_list(scope, ev, lv)[:8]):
                        c = cnt[info[pid]['c']]
                        c[0] += 1
                        c[1] += 1 if k == 0 else 0
                        c[2] += best[(pid, ev)]['pts']
                rivals[scope][lv] = sorted([[c] + v for c, v in cnt.items()],
                                           key=lambda x: (-x[1], -x[3]))[:12]

    # ── Pruebas clave de Benicio: marcas de referencia por nivel y piscina ────
    claves = None
    ben = next((s for s in swimmers if s['benicio']), None)
    if ben:
        bid, by = ben['id'], ben['y']
        in_scope = {'y': lambda i: i['y'] == by,
                    'c': lambda i: cat_of(i['g'], i['y'])[0] == ben['cat']}
        claves = {'events': []}
        for ev in CLAVES_BENICIO:
            eo = {'e': ev, 'sc': {}}
            for skey, fn in in_scope.items():
                eo['sc'][skey] = {}
                for lv in LEVELS:
                    eo['sc'][skey][lv] = {}
                    for pool in ('all', '25m', '50m'):
                        if pool == 'all':
                            ll = [(b['cs'], pid) for (pid, e2), b in best.items() if e2 == ev]
                        else:
                            ll = [(cs, pid) for (pid, e2, pl), cs in best_pool.items() if e2 == ev and pl == pool]
                        ll = sorted((cs, pid) for cs, pid in ll
                                    if info[pid]['g'] == ben['g'] and fn(info[pid]) and LEVELS[lv](info[pid]))
                        me = (best[(bid, ev)]['cs'] if pool == 'all' else best_pool.get((bid, ev, pool))) \
                            if (bid, ev) in best else None
                        eo['sc'][skey][lv][pool] = {
                            't': len(ll),
                            'refs': [[p, ll[p - 1][0], info[ll[p - 1][1]]['n'], info[ll[p - 1][1]]['c']]
                                     for p in REF_POS if p <= len(ll)],
                            'med': ll[len(ll) // 2][0] if ll else None,
                            'me': me,
                            'mp': (sum(1 for cs, p in ll if cs < me and p != bid) + 1) if me else None,
                        }
            claves['events'].append(eo)

    cats_out = []
    for g, cats in CATEGORIAS.items():
        for ck, lbl, yrs in cats:
            ids = [s['id'] for s in swimmers if s['g'] == g and s['cat'] == ck]
            if ids:
                cats_out.append({'key': f'{g}|{ck}', 'g': g, 'cat': ck, 'label': lbl, 'yrs': yrs, 'ids': ids})

    new_marks = len(rows_new)
    data = {'fecha': date.today().strftime('%d/%m/%Y'), 'cats': cats_out, 'swimmers': swimmers,
            'lists': lists, 'rivals': rivals, 'new_marks': new_marks, 'claves': claves}

    with open(TPL, encoding='utf-8') as f:
        html = f.read()
    html = html.replace('/*__DATA__*/null', json.dumps(data, ensure_ascii=False, separators=(',', ':')))
    with open(HTML_OUT, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'{len(swimmers)} nadadores del club · {len(lists)} listas · {os.path.getsize(HTML_OUT)/1e6:.1f} MB')
    print('→', HTML_OUT)


if __name__ == '__main__':
    main()

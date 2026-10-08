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
import os, json, glob, re
from collections import defaultdict
from datetime import date, datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Rutas configurables por variables de entorno (las usa GitHub Actions)
RAW_DIR  = os.environ.get('CNA_BASE', os.path.join(BASE_DIR, 'RAW_2526'))   # carpeta o .json.gz
RAW_NEW  = os.environ.get('CNA_NEW', os.path.join(BASE_DIR, 'RAW_2627'))
HTML_OUT = os.environ.get('CNA_OUT', os.path.expanduser('~/Desktop/CNA_Temporada_26-27.html'))
WEB_DIR  = os.path.join(BASE_DIR, 'web')   # plantilla, estilos y JS de la página

CLUB_MATCH = 'AXARQ'
ANDALUCIA  = {'ALMERIA', 'CADIZ', 'CORDOBA', 'GRANADA', 'HUELVA', 'JAEN', 'MALAGA', 'SEVILLA'}
TOP_N      = 20     # tamaño de las listas de cada nivel
NB         = 2      # rivales por delante / por detrás

# Categorías 26-27: iguales para chicos y chicas (referencia: Alevín = 2014-2015)
_CATS = [('PRE', 'Prebenjamín', [2018, 2019]), ('BEN', 'Benjamín', [2016, 2017]),
         ('ALE', 'Alevín', [2014, 2015]), ('INF', 'Infantil', [2012, 2013]),
         ('JUN', 'Junior', [2010, 2011])]
CATEGORIAS = {'M': _CATS, 'F': _CATS}
# Pruebas que deciden la clasificación a la Campeonato de Andalucía de Benicio
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

    # ── Puesto en cada competición ─────────────────────────────────────────────
    # El campo 'posicion' de la RFEN es el puesto en la SERIE, no en la competición.
    # Calculamos el puesto real: entre los nadadores del mismo año de nacimiento,
    # misma prueba, piscina y sexo de esa competición (sin contar parciales).
    comp_best = defaultdict(dict)
    for r in rows:
        if r.get('id_competicion') and not r.get('parcial') and r.get('valor_original') and r.get('profile_id'):
            g = comp_best[(r['id_competicion'], r['estilo'], r['id_tipo_piscina'], r['genero'], r['fecha_nacimiento'])]
            if r['profile_id'] not in g or r['valor_original'] < g[r['profile_id']]:
                g[r['profile_id']] = r['valor_original']

    def puesto(r):
        if 'cpos' in r:                       # precalculado en base_2526.json.gz
            return r['cpos'], r['cn']
        if r.get('parcial') or not r.get('id_competicion'):
            return None, None
        g = comp_best.get((r['id_competicion'], r['estilo'], r['id_tipo_piscina'], r['genero'], r['fecha_nacimiento']))
        if not g or g.get(r['profile_id']) != r['valor_original']:
            return None, None                 # no es su mejor tiempo en esa competición
        return 1 + sum(1 for p, v in g.items() if v < r['valor_original'] and p != r['profile_id']), len(g)

    # ── Mejor marca por nadador+prueba e historial ─────────────────────────────
    best, hist, info = {}, defaultdict(list), {}
    best_pool = {}   # (pid, prueba, piscina) -> (cs, fecha)
    for r in rows:
        if not r.get('valor_original') or not r.get('profile_id'):
            continue
        if r.get('parcial'):   # tiempo de paso dentro de una prueba más larga: no es una carrera de esa distancia
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
        if CLUB_MATCH in norm(r['club']).upper():   # historial completo de las marcas con el club
            cpos, cn = puesto(r)
            hist[(pid, ev)].append((iso(r['date']), cs, r['id_tipo_piscina'],
                                    norm(r.get('competition_name')).title(), norm(r.get('location')).title(),
                                    fina(r['record_mundo'], cs), cpos, cn, 1 if r.get('parcial') else 0))
        kp = (pid, ev, r['id_tipo_piscina'])
        if kp not in best_pool or cs < best_pool[kp][0]:
            best_pool[kp] = (cs, iso(r['date']))
        cur = best.get((pid, ev))
        if cur is None or cs < cur['cs']:
            best[(pid, ev)] = {'cs': cs, 'm': r['value'], 'pts': fina(r['record_mundo'], cs),
                               'pool': r['id_tipo_piscina'], 'comp': norm(r.get('competition_name')).title(),
                               'loc': norm(r.get('location')).title(), 'date': iso(r['date']),
                               'ss': r['_ss'], 'cpos': puesto(r) if CLUB_MATCH in norm(r['club']).upper() else None}

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
        return [i['n'], i['c'], i['p'], cs, b['pts'], pos, i['y'], 1 if i['ax'] else 0, b['date'], b['pool']]

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
            # Un registro por día y piscina: si nadó dos veces (eliminatoria y final, o dos
            # jornadas el mismo día) se queda el mejor tiempo y el otro va como nota.
            por_dia = defaultdict(list)
            for x in set(hist[(pid, ev)]):
                por_dia[(x[0], x[2])].append(x)
            h = []
            for k, xs in por_dia.items():
                xs.sort(key=lambda x: x[1])
                h.append(xs[0] + ([[x[1], x[3]] for x in xs[1:]],))
            h.sort()
            hp = [x for x in h if x[2] == b['pool']]
            first = hp[0][1] if hp else b['cs']
            events.append({'e': ev, 'm': b['m'], 'cs': b['cs'], 'pts': b['pts'], 'pool': b['pool'],
                           'comp': b['comp'], 'loc': b['loc'], 'date': b['date'], 'ss': b['ss'],
                           'cpos': list(b['cpos']) if b.get('cpos') and b['cpos'][0] else None,
                           'h': [list(x) for x in h], 'first': first,
                           'rk': rk, 'nb': nb})
        # De mejor a peor: puesto relativo en España entre los de su año (desempate: puntos)
        events.sort(key=lambda e: (e['rk']['y']['es'][0] / e['rk']['y']['es'][1], -e['pts']))
        pts = [e['pts'] for e in events]
        swimmers.append({
            'id': pid, 'n': i['n'], 'y': i['y'], 'g': i['g'], 'cat': ck, 'catl': clbl, 'cy': cyear,
            'ev': events, 'best': max(pts, default=0), 'top3': sum(sorted(pts, reverse=True)[:3]),
            'np': len(events),
            'last': max((x[0] for e in events for x in e['h']), default=''),
            'benicio': 'BENICIO VAZQUEZ' in i['n'].upper(),
        })

    # ── El club frente a los demás clubes (Málaga, Andalucía, España) ────────
    # Las mismas cuentas que los KPIs de la cabecera (puesto entre los nacidos en el
    # mismo año), hechas para TODOS los clubes, para saber en qué puesto queda el club.
    # Se calcula para el club entero y para cada categoría (sexo + categoría 26-27).
    def ckey(i):
        return 'AXARQ' if i['ax'] else i['c']

    def comparar(sel, kpi=False):
        """sel(i) → el nadador cuenta. Devuelve los rankings de clubes de los 3 niveles."""
        cl = defaultdict(lambda: {'n': defaultdict(int), 'p': defaultdict(int), 'sw': set(), 'pts': {},
                                  't10': 0, 'pod': 0, 'oro': 0,
                                  't8': {'ma': 0, 'an': 0, 'es': 0}, 'n1': {'ma': 0, 'an': 0, 'es': 0}})
        for pid, i in info.items():
            if sel(i):
                c = cl[ckey(i)]
                c['n'][i['c']] += 1
                c['p'][i['p']] += 1
                c['sw'].add(pid)
        for (pid, ev), b in best.items():
            c = cl.get(ckey(info[pid]))
            if c is not None and pid in c['sw']:
                c['pts'][pid] = max(c['pts'].get(pid, 0), b['pts'])
        for sk, sc in scopes.items():
            g, y = sk.split('|')
            if not y.isdigit() or not sel({'g': g, 'y': int(y)}):   # solo ámbitos por año de nacimiento
                continue
            for ev in sc:
                for lv in LEVELS:
                    for k, (cs, pid) in enumerate(level_list(sk, ev, lv)[:10]):
                        c = cl[ckey(info[pid])]
                        if k < 8:
                            c['t8'][lv] += 1
                        if k == 0:
                            c['n1'][lv] += 1
                        if lv == 'es':
                            c['t10'] += 1
                        elif lv == 'an' and k < 3:
                            c['pod'] += 1
                        elif lv == 'ma' and k == 0:
                            c['oro'] += 1
        clubes = []
        for key, c in cl.items():
            if not c['sw']:
                continue
            prov = max(c['p'], key=c['p'].get)
            p = strip_acc(prov)
            pts = c['pts'].values()
            clubes.append({'k': key, 'n': max(c['n'], key=c['n'].get), 'p': prov,
                           'lv': {'es': True, 'an': p in ANDALUCIA, 'ma': p == 'MALAGA'},
                           'sw': len(c['sw']), 't10': c['t10'], 'pod': c['pod'], 'oro': c['oro'],
                           't8': c['t8'], 'n1': c['n1'], 'avg': round(sum(pts) / len(pts)) if pts else 0})
        ax = next((c for c in clubes if c['k'] == 'AXARQ'), None)
        if not ax:
            return None

        def rango(lv, val):
            """[puesto, nº de clubes, valor del líder] del club en el nivel lv (empates comparten puesto)."""
            cs = [c for c in clubes if c['lv'][lv]]
            return [1 + sum(1 for c in cs if val(c) > val(ax)), len(cs), max(val(c) for c in cs)]
        out = {'lv': {}}
        if kpi:
            out['kpi'] = {
                'sw':  {lv: rango(lv, lambda c: c['sw']) for lv in LEVELS},
                't10': {lv: rango(lv, lambda c: c['t10']) for lv in LEVELS},
                'pod': {lv: rango(lv, lambda c: c['pod']) for lv in ('ma', 'an')},
                'oro': {lv: rango(lv, lambda c: c['oro']) for lv in ('ma',)},
            }
        for lv in LEVELS:
            cs = sorted((c for c in clubes if c['lv'][lv]),
                        key=lambda c: (-c['t8'][lv], -c['n1'][lv], -c['avg'], c['n']))
            pos = next(k for k, c in enumerate(cs) if c['k'] == 'AXARQ')
            keep = set(range(min(15, len(cs)))) | set(range(max(0, pos - 2), min(len(cs), pos + 3)))
            out['lv'][lv] = {
                'pos': pos + 1, 't': len(cs),
                'r': {m: rango(lv, f) for m, f in (('t8', lambda c: c['t8'][lv]), ('n1', lambda c: c['n1'][lv]),
                                                   ('sw', lambda c: c['sw']), ('avg', lambda c: c['avg']))},
                'rows': [[k + 1, cs[k]['n'], cs[k]['p'], cs[k]['sw'], cs[k]['t8'][lv], cs[k]['n1'][lv],
                          cs[k]['avg'], 1 if cs[k]['k'] == 'AXARQ' else 0] for k in sorted(keep)],
            }
        return out

    comparativa = comparar(lambda i: bool(cat_of(i['g'], i['y'])[0]), kpi=True)
    if comparativa:
        comparativa['cat'] = {}
        for g, cats in CATEGORIAS.items():
            for ck, _, yrs in cats:
                if f'{g}|{ck}' in club_scopes:
                    comparativa['cat'][f'{g}|{ck}'] = comparar(lambda i, g=g, yrs=yrs: i['g'] == g and i['y'] in yrs)
        # La misma categoría con los dos sexos juntos (clave sin sexo: 'ALE')
        for ck, _, yrs in _CATS:
            if any(f'{g}|{ck}' in comparativa['cat'] for g in CATEGORIAS):
                comparativa['cat'][ck] = comparar(lambda i, yrs=yrs: i['y'] in yrs)

    # ── Pruebas clave de Benicio: marcas de referencia por nivel y piscina ────
    claves = None

    def fecha_de(pid, ev, pool):
        return best[(pid, ev)]['date'] if pool == 'all' else best_pool[(pid, ev, pool)][1]
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
                            ll = [(v[0], pid) for (pid, e2, pl), v in best_pool.items() if e2 == ev and pl == pool]
                        ll = sorted((cs, pid) for cs, pid in ll
                                    if info[pid]['g'] == ben['g'] and fn(info[pid]) and LEVELS[lv](info[pid]))
                        me = (best[(bid, ev)]['cs'] if pool == 'all' else best_pool.get((bid, ev, pool), (None,))[0]) \
                            if (bid, ev) in best else None
                        eo['sc'][skey][lv][pool] = {
                            't': len(ll),
                            'refs': [[p, ll[p - 1][0], info[ll[p - 1][1]]['n'], info[ll[p - 1][1]]['c'],
                                       fecha_de(ll[p - 1][1], ev, pool)]
                                     for p in REF_POS if p <= len(ll)],
                            'med': ll[len(ll) // 2][0] if ll else None,
                            'me': me,
                            'mp': (sum(1 for cs, p in ll if cs < me and p != bid) + 1) if me else None,
                        }
            claves['events'].append(eo)

    # ── Top-10 en Campeonatos de Andalucía y de España ───────────────────────
    destacados = []
    for s_ in swimmers:
        for e in s_['ev']:
            for x in e['h']:
                d, cs, pool, comp, loc, pts, cpos, cn, parc, otros = x
                if parc or not cpos or cpos > 10:
                    continue
                cu = strip_acc(comp)
                if not re.search(r'CAMPEONATO|\bCTO\b', cu):
                    continue
                if 'CLUBES' in cu:          # jornadas de liga de clubes, no son campeonatos individuales
                    continue
                nivel = 'es' if re.search(r'ESPANA|ESPAÑA', cu) else \
                        'an' if ('ANDALUC' in cu or re.search(r'\bFAN\b', cu)) else None
                if nivel:
                    destacados.append({'id': s_['id'], 'n': s_['n'], 'y': s_['y'], 'g': s_['g'], 'cat': s_['cat'],
                                       'ev': e['e'], 'cs': cs, 'pool': pool, 'comp': comp, 'date': d,
                                       'pos': cpos, 'of': cn, 'lv': nivel})
    destacados.sort(key=lambda x: (x['lv'] != 'es', x['pos'], x['date']))

    # Categorías con los dos sexos juntos (los rankings siguen siendo por sexo)
    cats_out = []
    for ck, lbl, yrs in _CATS:
        ids = [s['id'] for s in swimmers if s['cat'] == ck]
        if ids:
            cats_out.append({'key': ck, 'label': lbl, 'yrs': yrs, 'ids': ids})

    new_marks = len(rows_new)
    data = {'fecha': date.today().strftime('%d/%m/%Y'), 'cats': cats_out, 'swimmers': swimmers,
            'lists': lists, 'comparativa': comparativa, 'new_marks': new_marks, 'claves': claves, 'destacados': destacados}

    html = montar_html().replace('/*__DATA__*/null', json.dumps(data, ensure_ascii=False, separators=(',', ':')))
    with open(HTML_OUT, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'{len(swimmers)} nadadores del club · {len(lists)} listas · {os.path.getsize(HTML_OUT)/1e6:.1f} MB')
    if os.environ.get('CNA_SUMMARY'):
        escribir_resumen(os.environ['CNA_SUMMARY'], swimmers, rows_new, claves)


JS_ORDEN = ['comunes.js', 'graficos.js', 'vistas/comparativa.js', 'vistas/inicio.js', 'vistas/club.js', 'vistas/campeonatos.js',
            'vistas/ficha.js', 'vistas/rankings.js', 'app.js']


def montar_html():
    """Une plantilla + estilos + JS en un único HTML (sirve también abierto desde el disco)."""
    leer = lambda n: open(os.path.join(WEB_DIR, n), encoding='utf-8').read()
    js = '\n'.join(f'/* ── {n} ── */\n' + leer(n) for n in JS_ORDEN)
    # Protección: nunca publicar una página con restos de un conflicto de git
    for n in JS_ORDEN + ['estilos.css', 'plantilla.html']:
        if re.search(r'^(<<<<<<<|>>>>>>>) ', leer(n), re.M):
            raise SystemExit(f'ERROR: {n} tiene marcas de conflicto de git sin resolver; no se genera la página.')
    return leer('plantilla.html').replace('/*__CSS__*/', leer('estilos.css')).replace('/*__JS__*/', js)


def fmt_cs(cs):
    m, s, c = cs // 6000, cs % 6000 // 100, cs % 100
    return f'{m}:{s:02d}.{c:02d}' if m else f'{s}.{c:02d}'


def escribir_resumen(ruta, swimmers, rows_new, claves):
    """Texto plano para el correo semanal."""
    hace8 = (datetime.now().date().toordinal() - 8)
    L = ['Informe C.N. Axarquía · Temporada 26-27',
         'https://andresvazquez11.github.io/Club-Natacion-Axarquia/temporada.html', '',
         f'Marcas de la temporada 26-27 en la RFEN (todos los clubes): {len(rows_new):,}'.replace(',', '.')]
    nuevas, todas = [], 0
    for s in swimmers:
        for e in s['ev']:
            if e['ss'] != '26-27':
                continue
            todas += 1
            try:
                reciente = datetime.strptime(e['date'], '%Y-%m-%d').date().toordinal() >= hace8
            except ValueError:
                reciente = False
            if reciente:
                r = e['rk'].get('c') or e['rk']['y']
                nuevas.append(f"  · {s['n']} ({s['catl']}) — {e['e']}: {e['m'].lstrip('0:')} ({e['pool']}) · "
                              f"{r['ma'][0]}º Málaga · {r['an'][0]}º Andalucía · {r['es'][0]}º España")
    L.append(f'Mejores marcas del club que ya son de la 26-27: {todas}')
    L += ['', 'NUEVAS MEJORES MARCAS DEL CLUB (últimos 8 días):']
    L += nuevas or ['  (ninguna esta semana)']
    if claves:
        ben = next(s for s in swimmers if s['benicio'])
        L += ['', f"BENICIO · pruebas clave Campeonato de Andalucía (nacidos en {ben['y']}, todas las piscinas):"]
        for ev in claves['events']:
            sc = ev['sc']['y']
            me = sc['es']['all']['me']
            if not me:
                ref = {r[0]: r[1] for r in sc['an']['all']['refs']}
                L.append(f"  · {ev['e']}: sin marca · 8º de Andalucía: {fmt_cs(ref[8]) if 8 in ref else '—'}")
                continue
            partes = []
            for lv, nom in (('ma', 'Málaga'), ('an', 'Andalucía'), ('es', 'España')):
                d = sc[lv]['all']
                partes.append(f"{d['mp']}º/{d['t']} {nom}")
            L.append(f"  · {ev['e']}: {fmt_cs(me)} · " + ' · '.join(partes))
    with open(ruta, 'w', encoding='utf-8') as f:
        f.write('\n'.join(L) + '\n')
    print('→', HTML_OUT)


if __name__ == '__main__':
    main()

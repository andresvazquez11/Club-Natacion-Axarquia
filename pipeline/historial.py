#!/usr/bin/env python3
"""
historial.py — historial de 6 temporadas y fotos semanales del ranking.

Lo usan:
  · construir_historial.py (local, una vez): precalcula las temporadas cerradas 21-22…24-25
    y reconstruye las fotos semanales del ranking de la 25-26.
  · generar.py (cada semana): añade 25-26 y 26-27, la foto de la semana actual y escribe
    historial.json, que la página carga al abrir las pestañas «Historial» y «Ranking».

Formato de las marcas de entrada: las filas de la API de la RFEN (las mismas que usa generar.py).
"""
import bisect, glob, gzip, html, json, os
from collections import defaultdict
from datetime import date, datetime, timedelta

TEMPORADAS = ['2122', '2223', '2324', '2425', '2526', '2627']
ANDALUCIA = {'ALMERIA', 'CADIZ', 'CORDOBA', 'GRANADA', 'HUELVA', 'JAEN', 'MALAGA', 'SEVILLA'}
PRUEBAS = ['50 Libre', '100 Libre', '200 Libre', '400 Libre', '800 Libre', '1500 Libre',
           '50 Espalda', '100 Espalda', '200 Espalda', '50 Braza', '100 Braza', '200 Braza',
           '50 Mariposa', '100 Mariposa', '200 Mariposa', '100 Estilos', '200 Estilos', '400 Estilos']
NIVELES = ('es', 'an', 'ma')


def etiqueta(t):
    return f'{t[:2]}-{t[2:]}'


def inicio_temporada(t):
    return date(2000 + int(t[:2]), 10, 1)


def temporada_de(d):
    """Temporada RFEN (p. ej. '2526') de una fecha: de octubre a septiembre
    (la 25-26 tiene marcas hasta el 26/09/2026 y la 26-27 empieza el 03/10/2026)."""
    y = d.year if d.month >= 10 else d.year - 1
    return f'{y % 100:02d}{(y + 1) % 100:02d}'


def _acc(s):
    s = ' '.join(str(s or '').split()).upper()
    for a, b in zip('ÁÉÍÓÚ', 'AEIOU'):
        s = s.replace(a, b)
    return s


def _fecha(s):
    try:
        return datetime.strptime(s, '%d/%m/%Y').date()
    except (TypeError, ValueError):
        return None


def _fina(rm, cs):
    try:
        rm, cs = float(rm), float(cs)
        return round(1000 * (rm / cs) ** 3) if rm > 0 and cs > 0 else 0
    except (TypeError, ValueError):
        return 0


def cargar(ruta):
    """Filas de una carpeta RAW (*.json) o de un .json.gz."""
    if not ruta or not os.path.exists(ruta):
        return []
    if ruta.endswith('.gz'):
        with gzip.open(ruta, 'rt', encoding='utf-8') as f:
            return json.load(f)
    filas = []
    for p in glob.glob(os.path.join(ruta, '*.json')):
        with open(p, encoding='utf-8') as f:
            filas.extend(json.load(f))
    return filas


def limpiar(filas):
    """Marcas válidas: con nadador y tiempo, prueba conocida y sin tiempos parciales."""
    for r in filas:
        if r.get('parcial') or not r.get('valor_original') or not r.get('profile_id'):
            continue
        if r.get('estilo') not in PRUEBAS:
            continue
        d = _fecha(r.get('date'))
        if d:
            yield r, d


# ═══════════════════════════════════════════════════════════════════════════
# 1. Resumen de una temporada para los nadadores del club
# ═══════════════════════════════════════════════════════════════════════════
def resumen_temporada(filas, club, cohorte=False):
    """club = {pid: (sexo, año)}. Devuelve {pid: datos de la temporada} con puestos ya calculados.
    Con cohorte=True devuelve también el nivel de TODOS los nadadores de los mismos ámbitos (sexo|año):
    {'M|2015': {pid: nivel}} para comparar al nadador con el resto de España."""
    info, mejor, mejor_pl, comps = {}, {}, {}, defaultdict(dict)
    for r, d in limpiar(filas):
        pid, ev, cs, pl = r['profile_id'], r['estilo'], int(r['valor_original']), r.get('id_tipo_piscina')
        prov = _acc(r.get('provincia'))
        if pid not in info or info[pid][0] <= d:
            info[pid] = (d, r['genero'], int(r['fecha_nacimiento']), prov in ANDALUCIA, prov == 'MALAGA',
                         ' '.join(str(r.get('club') or '').split()))
        k = (pid, ev)
        if k not in mejor or cs < mejor[k][0]:
            mejor[k] = (cs, pl, d.isoformat(), _fina(r.get('record_mundo'), cs),
                        ' '.join(str(r.get('competition_name') or '').split()).title())
        kp = (pid, ev, pl)
        if kp not in mejor_pl or cs < mejor_pl[kp]:
            mejor_pl[kp] = cs
        if pid in club:
            c = comps[pid].setdefault((d.isoformat(), r.get('competition_name')), [0])
            c[0] += 1

    # listas ordenadas por ámbito (sexo, año), prueba y nivel
    listas = defaultdict(lambda: {lv: [] for lv in NIVELES})
    for (pid, ev), b in mejor.items():
        _, g, y, an, ma, _ = info[pid]
        L = listas[(g, y, ev)]
        L['es'].append(b[0])
        if an:
            L['an'].append(b[0])
        if ma:
            L['ma'].append(b[0])
    for L in listas.values():
        for lv in NIVELES:
            L[lv].sort()

    out = {}
    for pid in club:
        if pid not in info:
            continue
        _, g, y, an, ma, clubn = info[pid]
        evs = {}
        for ev in PRUEBAS:
            b = mejor.get((pid, ev))
            if not b:
                continue
            L = listas[(g, y, ev)]
            rk = {}
            for lv, dentro in (('es', True), ('an', an), ('ma', ma)):
                if dentro:
                    rk[lv] = [bisect.bisect_left(L[lv], b[0]) + 1, len(L[lv])]
            evs[ev] = {'cs': b[0], 'pool': b[1], 'date': b[2], 'pts': b[3], 'comp': b[4], 'rk': rk,
                       'pl': {pl: mejor_pl[(pid, ev, pl)] for pl in ('25m', '50m') if (pid, ev, pl) in mejor_pl}}
        lista_c = sorted(([dd, (c or '').title(), n[0]] for (dd, c), n in comps[pid].items()), reverse=True)
        out[pid] = {'club': clubn, 'ev': evs, 'nc': len(lista_c), 'np': sum(x[2] for x in lista_c), 'comps': lista_c}
    if not cohorte:
        return out
    ambitos = {(g, y) for g, y in club.values()}
    pts = defaultdict(list)
    for (pid, ev), b in mejor.items():
        _, g, y, *_ = info[pid]
        if (g, y) in ambitos:
            pts[pid].append(b[3])
    niv = defaultdict(dict)
    for pid, p in pts.items():
        _, g, y, *_ = info[pid]
        p = sorted(p, reverse=True)[:3]
        niv[f'{g}|{y}'][pid] = round(sum(p) / len(p))
    return out, dict(niv)


# ═══════════════════════════════════════════════════════════════════════════
# 2. Análisis automático de la evolución de un nadador
# ═══════════════════════════════════════════════════════════════════════════
def _nivel(evs):
    """Nivel de una temporada: media de puntos de sus 3 mejores pruebas."""
    p = sorted((e['pts'] for e in evs.values()), reverse=True)[:3]
    return round(sum(p) / len(p)) if p else 0


def _estilo_principal(evs):
    """Estilo de su prueba con mejor puesto relativo en el ranking de España de su año
    (si no hay ranking, la de más puntos)."""
    def clave(item):
        e = item[1]
        r = e['rk'].get('es')
        return (r[0] / r[1]) if r else 2 - e['pts'] / 1000
    if not evs:
        return None
    ev, _ = min(evs.items(), key=clave)
    return ev.split(' ', 1)[1]


def _pct(lista, v):
    """Porcentaje de valores de la lista que quedan por debajo de v."""
    return round(100 * sum(1 for x in lista if x < v) / len(lista)) if lista else None


def analisis(temps, pid=None, ambito=None, coh=None, club_niv=None):
    """Análisis automático de la evolución de un nadador.
    temps = {temporada: datos}; coh = {temporada: {pid: nivel}} de todos los nadadores de España de su sexo y año;
    club_niv = {temporada: {pid: nivel}} de sus compañeros del club de su sexo y año.
    Devuelve {'evo': […], 'bueno': […], 'malo': […], 'comp': […]} con [icono, texto] en cada lista."""
    R = {'evo': [], 'bueno': [], 'malo': [], 'comp': []}
    ts = [t for t in TEMPORADAS if t in temps and temps[t]['ev']]
    if not ts:
        return R
    E, B, M, C = R['evo'], R['bueno'], R['malo'], R['comp']
    actual = TEMPORADAS[-1]
    cerradas = [t for t in ts if t != actual]
    E.append(['📅', f'Tiene marcas en <b>{len(ts)} temporada{"s" if len(ts) > 1 else ""}</b> ({etiqueta(ts[0])} a {etiqueta(ts[-1])}).'])
    otros = [c for c in dict.fromkeys(temps[t]['club'] for t in ts) if 'AXARQ' not in c.upper()]
    if otros:
        E.append(['🔁', f'Antes nadó en <b>{html.escape(", ".join(otros))}</b>; el historial incluye esas marcas.'])

    niveles = [(t, _nivel(temps[t]['ev'])) for t in ts]
    if len(niveles) > 1:
        E.append(['📊', 'Nivel medio (3 mejores pruebas, pts World Aquatics): ' +
                  ' → '.join(f'{etiqueta(t)} <b>{n}</b>' for t, n in niveles) + '.'])
        saltos = [(niveles[i][1] - niveles[i - 1][1], niveles[i][0]) for i in range(1, len(niveles))]
        d, t = max(saltos)
        if d > 0:
            B.append(['🚀', f'Su <b>mayor salto</b> fue en la <b>{etiqueta(t)}</b>: +{d} pts de nivel medio.'])
        bajadas = [(d, t) for d, t in saltos if d < 0]
        if bajadas:
            d, t = min(bajadas)
            M.append(['📉', f'En la {etiqueta(t)} bajó su nivel medio ({d} pts respecto a la temporada anterior).'])

    mejoras = []
    for i in range(1, len(ts)):
        a, b = temps[ts[i - 1]]['ev'], temps[ts[i]]['ev']
        for ev in set(a) & set(b):
            for pl in ('25m', '50m'):
                x, y = a[ev]['pl'].get(pl), b[ev]['pl'].get(pl)
                if x and y and y < x:
                    mejoras.append(((x - y) / x, ev, pl, x, y, ts[i]))
    if mejoras:
        p, ev, pl, x, y, t = max(mejoras)
        B.append(['⏱️', f'Mayor mejora en una prueba: <b>{ev}</b> ({pl}) en la {etiqueta(t)}, de {_fmt(x)} a <b>{_fmt(y)}</b> '
                       f'(−{(x - y) / 100:.2f} s, {p * 100:.1f}%).'])

    estilos = [(t, _estilo_principal(temps[t]['ev'])) for t in ts]
    cambios = [estilos[0]] + [estilos[i] for i in range(1, len(estilos)) if estilos[i][1] != estilos[i - 1][1]]
    if len(cambios) > 1:
        E.append(['🔄', 'Cambio de estilo principal (el de su mejor puesto en España): ' +
                  ' → '.join(f'<b>{st}</b> ({etiqueta(t)})' for t, st in cambios) + '.'])
    elif estilos[0][1]:
        E.append(['🎯', f'Su estilo principal siempre ha sido <b>{estilos[0][1]}</b>.'])
    dist = [(t, max(int(ev.split()[0]) for ev in temps[t]['ev'])) for t in ts]
    if dist[-1][1] > dist[0][1]:
        E.append(['📏', f'Ha ido a pruebas más largas: de {dist[0][1]} m ({etiqueta(dist[0][0])}) a <b>{dist[-1][1]} m</b> ({etiqueta(dist[-1][0])}).'])

    # ranking de España en su prueba fuerte de la última temporada con marcas
    ult = ts[-1]
    cand = [(e['rk']['es'][0] / e['rk']['es'][1], ev) for ev, e in temps[ult]['ev'].items() if 'es' in e['rk']]
    if cand:
        _, ev = min(cand)
        serie = [(t, temps[t]['ev'][ev]['rk']['es']) for t in ts if ev in temps[t]['ev'] and 'es' in temps[t]['ev'][ev]['rk']]
        if len(serie) > 1:
            E.append(['🇪🇸', f'Ranking de España en <b>{ev}</b> (entre los de su año): ' +
                      ' → '.join(f'{etiqueta(t)} <b>{r[0]}º</b>/{r[1]}' for t, r in serie) + '.'])
            p0, p1 = serie[0][1][0] / serie[0][1][1], serie[-1][1][0] / serie[-1][1][1]
            (B if p1 < p0 else M).append(['🏅' if p1 < p0 else '⬇️',
                f'En {ev} ha {"subido" if p1 < p0 else "bajado"} en el ranking de España: del top {max(1, round(p0 * 100))}% '
                f'al <b>top {max(1, round(p1 * 100))}%</b>.'])

    # última temporada cerrada frente a la anterior
    if len(cerradas) >= 2:
        a, b = temps[cerradas[-2]]['ev'], temps[cerradas[-1]]['ev']
        comunes = sorted(set(a) & set(b))
        mejor = [ev for ev in comunes if b[ev]['pts'] > a[ev]['pts']]
        peor = [ev for ev in comunes if b[ev]['pts'] < a[ev]['pts']]
        if mejor:
            B.append(['📈', f'En la {etiqueta(cerradas[-1])} mejoró <b>{len(mejor)} de {len(comunes)}</b> pruebas que ya nadaba.'])
        if peor:
            M.append(['🔻', f'En la {etiqueta(cerradas[-1])} empeoró en: {", ".join(peor)}.'])
        dejadas = sorted(set(a) - set(b))
        if dejadas:
            M.append(['💤', f'Pruebas que nadaba en la {etiqueta(cerradas[-2])} y no nadó en la {etiqueta(cerradas[-1])}: {", ".join(dejadas)}.'])
        nuevas = sorted(set(b) - set(a))
        if nuevas:
            B.append(['🆕', f'Pruebas nuevas en la {etiqueta(cerradas[-1])}: {", ".join(nuevas)}.'])
    if ult == actual and len(ts) > 1:
        prev = temps[ts[-2]]['ev']
        ya = [ev for ev, e in temps[ult]['ev'].items() if ev in prev and e['pts'] > prev[ev]['pts']]
        if ya:
            B.append(['🔥', f'En la {etiqueta(ult)} ya ha superado su nivel de la {etiqueta(ts[-2])} en: {", ".join(ya)}.'])

    # comparación con España (mismo sexo y año) y con sus compañeros del club
    if coh and pid is not None:
        ref = cerradas[-1] if cerradas else ult
        mio = coh.get(ref, {}).get(pid)
        lista = list(coh.get(ref, {}).values())
        if mio is not None and lista:
            pc = _pct(lista, mio)
            med = sorted(lista)[len(lista) // 2]
            C.append(['🇪🇸', f'En la {etiqueta(ref)} su nivel ({mio} pts) supera al <b>{pc}%</b> de los nadadores de España '
                            f'de su año ({len(lista)}); la mediana es {med} pts.'])
            (B if pc >= 75 else M if pc < 40 else C).append(
                ['⭐' if pc >= 75 else '📌', f'Está en el <b>{"top " + str(100 - pc) + "%" if pc >= 50 else str(pc) + "% inferior"}</b> de España de su año por nivel.'])
        prev = [t for t in TEMPORADAS if t in coh and TEMPORADAS.index(t) == TEMPORADAS.index(ref) - 1]
        if prev and mio is not None and pid in coh[prev[0]]:
            t0 = prev[0]
            deltas = sorted(coh[ref][p] - coh[t0][p] for p in coh[ref] if p in coh[t0])
            if deltas:
                mi = mio - coh[t0][pid]
                md = deltas[len(deltas) // 2]
                pc = _pct(deltas, mi)
                C.append(['📈', f'De la {etiqueta(t0)} a la {etiqueta(ref)} mejoró <b>{mi:+d} pts</b>; la mediana de los de su año '
                                f'en España fue {md:+d} pts (progresó más que el {pc}%).'])
                if pc >= 70:
                    B.append(['🚀', f'Progresa más rápido que la mayoría de los de su año en España (más que el {pc}%).'])
                elif pc < 35:
                    M.append(['🐢', f'Progresa más despacio que la mayoría de los de su año en España (solo más que el {pc}%).'])
    if club_niv and pid is not None:
        ref = cerradas[-1] if cerradas else ult
        cn = club_niv.get(ref, {})
        if pid in cn and len(cn) > 1:
            orden = sorted(cn.values(), reverse=True)
            pos = orden.index(cn[pid]) + 1
            media = round(sum(orden) / len(orden))
            C.append(['👥', f'Entre sus <b>{len(orden)}</b> compañeros del club de su sexo y año es el <b>{pos}º</b> por nivel '
                            f'en la {etiqueta(ref)} (media del grupo: {media} pts).'])
    return R


def _fmt(cs):
    m, s, c = cs // 6000, cs % 6000 // 100, cs % 100
    return f'{m}:{s:02d}.{c:02d}' if m else f'{s}.{c:02d}'


# ═══════════════════════════════════════════════════════════════════════════
# 3. Fotos semanales del ranking (modo T = temporada, modo A = últimos 12 meses)
# ═══════════════════════════════════════════════════════════════════════════
def domingos(desde, hasta):
    d = desde + timedelta(days=(6 - desde.weekday()) % 7)
    out = []
    while d <= hasta:
        out.append(d)
        d += timedelta(days=7)
    return out


def preparar_marcas(filas_por_temporada, club):
    """filas_por_temporada = {temporada: filas}. Marcas por (sexo, año, prueba), solo de los ámbitos con
    nadadores del club: (fecha, cs, pid, temporada, piscina, pts). Y datos de cada nadador: pid → (andaluz, malagueño, nombre, club)."""
    ambitos = {(g, y) for g, y in club.values()}
    marcas = defaultdict(list)
    info = {}
    for t, filas in filas_por_temporada.items():
        for r, d in limpiar(filas):
            g, y = r['genero'], int(r['fecha_nacimiento'])
            if (g, y) not in ambitos:
                continue
            pid = r['profile_id']
            p = _acc(r.get('provincia'))
            if pid not in info or info[pid][0] <= d:
                info[pid] = (d, p in ANDALUCIA, p == 'MALAGA', ' '.join(str(r.get('nombre') or '').split()).title(),
                             ' '.join(str(r.get('club') or '').split()))
            cs = int(r['valor_original'])
            marcas[(g, y, r['estilo'])].append((d, cs, pid, t, r.get('id_tipo_piscina'), _fina(r.get('record_mundo'), cs)))
    for v in marcas.values():
        v.sort()
    return marcas, {pid: v[1:] for pid, v in info.items()}


def guardar_marcas(ruta, marcas, info):
    """Guarda marcas e info en un .json.gz compacto (fecha como ordinal)."""
    out = {'m': {f'{g}|{y}|{ev}': [[d.toordinal(), cs, pid, t, pl, pts] for d, cs, pid, t, pl, pts in M]
                 for (g, y, ev), M in marcas.items()},
           'i': {str(pid): list(v) for pid, v in info.items()}}
    with gzip.open(ruta, 'wt', 9, encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))


def cargar_marcas(ruta):
    with gzip.open(ruta, 'rt', encoding='utf-8') as f:
        d = json.load(f)
    marcas = {}
    for k, M in d['m'].items():
        g, y, ev = k.split('|')
        marcas[(g, int(y), ev)] = [(date.fromordinal(o), cs, pid, t, pl, pts) for o, cs, pid, t, pl, pts in M]
    return marcas, {int(pid): tuple(v) for pid, v in d['i'].items()}


def unir_marcas(*pares):
    """Une varios (marcas, info) en uno."""
    marcas, info = defaultdict(list), {}
    for m, i in pares:
        for k, v in m.items():
            marcas[k].extend(v)
        info.update(i)
    for v in marcas.values():
        v.sort()
    return marcas, info


# ── Clasificación para el Campeonato de Andalucía Alevín (circulares FAN NAT.10-26 y NAT.13-26) ──
CLASIFICACION = {
    'inv': {'nombre': 'Campeonato de Andalucía Alevín de invierno', 'circular': 'NAT.10/26',
            'pruebas': ['100 Mariposa', '100 Espalda', '100 Braza', '100 Libre'],
            'desde': date(2026, 1, 1), 'años': (2014, 2015), 'corte': 120},
    'ver': {'nombre': 'Campeonato de Andalucía Alevín de verano', 'circular': 'NAT.13/26',
            'pruebas': ['100 Mariposa', '100 Espalda', '100 Braza', '200 Libre'],
            'desde': date(2026, 9, 1), 'años': (2015,), 'corte': 120},
}


def clasificacion_andalucia(marcas, info, club):
    """Ranking territorial (solo nadadores andaluces) de la suma de puntos AQUA en las 4 pruebas de cada
    campeonato, por sexo y año de nacimiento. Devuelve, por campeonato y ámbito, el corte (puesto 120),
    los 10 primeros y el detalle de los nadadores del club."""
    out = {}
    for k, C in CLASIFICACION.items():
        out[k] = {'nombre': C['nombre'], 'circular': C['circular'], 'pruebas': C['pruebas'],
                  'desde': C['desde'].isoformat(), 'corte': C['corte'], 'amb': {}}
        for g in ('M', 'F'):
            for y in C['años']:
                mejor = defaultdict(dict)   # pid → prueba → mejores pts
                for ev in C['pruebas']:
                    for d, cs, pid, t, pl, pts in marcas.get((g, y, ev), []):
                        if d < C['desde'] or not info.get(pid, (False,))[0]:
                            continue
                        if pts > mejor[pid].get(ev, 0):
                            mejor[pid][ev] = pts
                if not mejor:
                    continue
                filas = sorted(((sum(v.values()), pid) for pid, v in mejor.items()), reverse=True)
                sumas = [x for x, _ in filas]
                corte = sumas[C['corte'] - 1] if len(sumas) >= C['corte'] else None
                nuestros = {}
                for pos, (tot, pid) in enumerate(filas, 1):
                    if pid in club:
                        nuestros[str(pid)] = {'pos': 1 + sum(1 for x in sumas if x > tot), 'pts': tot,
                                              'ev': [mejor[pid].get(ev, 0) for ev in C['pruebas']]}
                top = [[1 + sum(1 for x in sumas if x > tot), info[pid][2], info[pid][3], tot,
                        [mejor[pid].get(ev, 0) for ev in C['pruebas']]] for tot, pid in filas[:10]]
                out[k]['amb'][f'{g}|{y}'] = {'n': len(filas), 'corte': corte, 'top': top, 'club': nuestros}
    return out


COLS = [('T', 'es'), ('T', 'an'), ('T', 'ma'), ('A', 'es'), ('A', 'an'), ('A', 'ma')]   # orden de las 6 cifras


def fotos(marcas, prov, club, semanas):
    """Foto de cada semana W (formato compacto, para guardar muchas semanas):
         {W: {'p': {pid: {prueba: [6 puestos]}}, 't': {'M|2015|50 Mariposa': [6 totales]}}}
       Orden de las 6 cifras: COLS (temporada España/Andalucía/Málaga, 12 meses España/Andalucía/Málaga).
       0 = sin marca en ese modo o nivel."""
    res = {}
    club_por_ambito = defaultdict(set)
    for pid, (g, y) in club.items():
        club_por_ambito[(g, y)].add(pid)
    for (g, y, ev), M in marcas.items():
        nuestros = club_por_ambito[(g, y)]
        if not any(m[2] in nuestros for m in M):
            continue
        fechas = [m[0] for m in M]
        clave = f'{g}|{y}|{ev}'
        for W in semanas:
            fin = bisect.bisect_right(fechas, W)
            tw = temporada_de(W)
            pos, tot = defaultdict(lambda: [0] * 6), [0] * 6
            for k, modo in enumerate(('T', 'A')):
                best = {}
                if modo == 'T':      # todas las marcas de la temporada RFEN de esa semana, hasta W
                    sel = (m for m in M[:fin] if m[3] == tw)
                else:                # mejor marca de los últimos 365 días
                    sel = M[bisect.bisect_right(fechas, W - timedelta(days=365)):fin]
                for d, cs, pid, *_ in sel:
                    if pid not in best or cs < best[pid]:
                        best[pid] = cs
                if not any(p in best for p in nuestros):
                    continue
                vals = {lv: [] for lv in NIVELES}
                for pid, cs in best.items():
                    a, m = prov.get(pid, (False, False))[:2]
                    vals['es'].append(cs)
                    if a:
                        vals['an'].append(cs)
                    if m:
                        vals['ma'].append(cs)
                for j, lv in enumerate(NIVELES):
                    vals[lv].sort()
                    tot[k * 3 + j] = len(vals[lv])
                for pid in nuestros:
                    if pid not in best:
                        continue
                    a, m = prov.get(pid, (False, False))[:2]
                    for j, (lv, dentro) in enumerate((('es', True), ('an', a), ('ma', m))):
                        if dentro:
                            pos[pid][k * 3 + j] = bisect.bisect_left(vals[lv], best[pid]) + 1
            if pos:
                wk = res.setdefault(W.isoformat(), {'p': {}, 't': {}})
                wk['t'][clave] = tot
                for pid, v in pos.items():
                    wk['p'].setdefault(str(pid), {})[ev] = v
    return res


def fusionar_fotos(guardadas, nuevas, sobrescribir=()):
    """Las semanas ya guardadas no se tocan (salvo las de `sobrescribir`, p. ej. la semana en curso)."""
    out = dict(guardadas)
    for wk, v in nuevas.items():
        if wk not in out or wk in sobrescribir:
            out[wk] = v
    return dict(sorted(out.items()))


def para_pagina(fotos_guardadas, club):
    """Para la página: {'s': [semanas], 'p': {pid: {prueba: [[6 puestos]|0 por semana]}}, 't': {ámbito|prueba: [[6 totales] por semana]}}."""
    semanas = sorted(fotos_guardadas)
    ids = {str(k) for k in club}
    P, T = {}, {}
    for i, wk in enumerate(semanas):
        F = fotos_guardadas[wk]
        for pid, evs in F['p'].items():
            if pid not in ids:
                continue
            for ev, v in evs.items():
                P.setdefault(pid, {}).setdefault(ev, [0] * len(semanas))[i] = v
        for k, v in F['t'].items():
            T.setdefault(k, [0] * len(semanas))[i] = v
    return {'s': semanas, 'cols': [f'{m}{lv}' for m, lv in COLS], 'p': P, 't': T}

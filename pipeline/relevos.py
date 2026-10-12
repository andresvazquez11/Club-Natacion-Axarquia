"""Relevos teóricos del club por categoría (regla «suma de tiempos» de la RFEN y la FAN).

Cada equipo = suma de las mejores marcas individuales de 4 relevistas en los últimos 14 meses
(25 m y 50 m por separado). Se calcula el mejor equipo posible de TODOS los clubes para saber en
qué puesto quedaría el del club en Málaga, Andalucía y España, y qué le falta a cada nadador del
club para entrar en cada relevo.
"""
from collections import defaultdict
from datetime import timedelta
from itertools import combinations

VENTANA_DIAS = 426          # 14 meses (circular FAN NAT.01/26: marcas válidas desde 14 meses antes)
POOLS = ('50m', '25m')
EST = ['Espalda', 'Braza', 'Mariposa', 'Libre']     # orden oficial del relevo de estilos

# Pruebas de relevos de cada categoría 26-27 (programas FAN NAT.09/10/13/14/16/17-26 y RFEN 26-406/407)
# tipo: L = libre (4 veces la misma prueba), E = estilos; sexo: M, F o X (mixto: 2 chicos y 2 chicas)
RELEVOS = {
    'BEN': [('4x50 Libre', 'L', 50), ('4x50 Estilos', 'E', 50), ('4x100 Libre', 'L', 100), ('4x100 Estilos', 'E', 100)],
    'ALE': [('4x100 Libre', 'L', 100), ('4x200 Libre', 'L', 200), ('4x100 Estilos', 'E', 100), ('4x100 Estilos mixto', 'E', 100)],
    'INF': [('4x100 Libre', 'L', 100), ('4x200 Libre', 'L', 200), ('4x100 Estilos', 'E', 100), ('4x100 Estilos mixto', 'E', 100)],
    'JUN': [('4x100 Libre', 'L', 100), ('4x200 Libre', 'L', 200), ('4x100 Estilos', 'E', 100),
            ('4x50 Libre mixto', 'L', 50), ('4x50 Estilos mixto', 'E', 50), ('4x100 Estilos mixto', 'E', 100)],
}
# Mínimas «suma de tiempos» del Campeonato de España 2026 (centésimas): {(cat, relevo, sexo): {piscina: cs}}
def _t(s):
    m, r = s.split(':'); sg, c = r.split(',')
    return int(m) * 6000 + int(sg) * 100 + int(c)
MINIMAS = {
    ('ALE', '4x100 Libre', 'M'): {'50m': _t('04:18,40'), '25m': _t('04:09,90')},
    ('ALE', '4x100 Libre', 'F'): {'50m': _t('04:24,50'), '25m': _t('04:17,20')},
    ('ALE', '4x200 Libre', 'M'): {'50m': _t('09:24,90'), '25m': _t('09:06,30')},
    ('ALE', '4x200 Libre', 'F'): {'50m': _t('09:35,50'), '25m': _t('09:25,80')},
    ('ALE', '4x100 Estilos', 'M'): {'50m': _t('04:55,30'), '25m': _t('04:43,70')},
    ('ALE', '4x100 Estilos', 'F'): {'50m': _t('05:01,25'), '25m': _t('04:57,95')},
    ('ALE', '4x100 Estilos mixto', 'X'): {'50m': _t('04:58,30'), '25m': _t('04:50,85')},
    ('INF', '4x100 Libre', 'M'): {'50m': _t('03:54,20'), '25m': _t('03:46,50')},
    ('INF', '4x100 Libre', 'F'): {'50m': _t('04:08,20'), '25m': _t('04:01,30')},
    ('INF', '4x200 Libre', 'M'): {'50m': _t('08:33,50'), '25m': _t('08:16,60')},
    ('INF', '4x200 Libre', 'F'): {'50m': _t('08:59,30'), '25m': _t('08:50,30')},
    ('INF', '4x100 Estilos', 'M'): {'50m': _t('04:24,65'), '25m': _t('04:14,20')},
    ('INF', '4x100 Estilos', 'F'): {'50m': _t('04:41,35'), '25m': _t('04:30,50')},
    ('INF', '4x100 Estilos mixto', 'X'): {'50m': _t('04:33,00'), '25m': _t('04:22,35')},
}
MIN_FUENTE = {'ALE': 'Cto. de España Alevín 2026 (normativa RFEN 26-406)',
              'INF': 'Cto. de España Infantil 2026 (normativa RFEN 26-407)'}
TOPK = 4                    # con los 4 mejores de cada posta basta para encontrar el equipo óptimo


def _patas(tipo, dist, sexo):
    """Lista de postas [(prueba, sexo o None)] y, para los mixtos, todas las combinaciones de sexos."""
    evs = [f'{dist} Libre'] * 4 if tipo == 'L' else [f'{dist} {e}' for e in EST]
    if sexo != 'X':
        return [[(ev, sexo) for ev in evs]]
    if tipo == 'L':
        return [[(evs[0], 'M'), (evs[0], 'M'), (evs[0], 'F'), (evs[0], 'F')]]
    return [[(ev, 'M' if k in ms else 'F') for k, ev in enumerate(evs)] for ms in combinations(range(4), 2)]


def _resolver(patas, cand):
    """Mejor equipo: cand[(prueba, sexo)] = [(cs, pid)] ordenada.
    Devuelve (total, [(pid, cs)] por posta) o None si no hay 4 relevistas distintos."""
    mejor = [None]

    def rec(k, usados, tot, eq):
        if mejor[0] and tot >= mejor[0][0]:
            return
        if k == 4:
            mejor[0] = (tot, list(eq))
            return
        for cs, pid in [x for x in cand.get(patas[k], []) if x[1] not in usados][:TOPK]:
            eq.append((pid, cs))
            rec(k + 1, usados | {pid}, tot + cs, eq)
            eq.pop()
    rec(0, frozenset(), 0, [])
    return mejor[0]


def _resolver_forzado(patas, cand, k, pid):
    """Mejor total de las otras 3 postas con pid obligado en la posta k (sin contar su tiempo)."""
    best = None
    otros = [i for i in range(4) if i != k]

    def rec(j, usados, tot):
        nonlocal best
        if best is not None and tot >= best:
            return
        if j == 3:
            best = tot
            return
        for cs, p in [x for x in cand.get(patas[otros[j]], []) if x[1] not in usados][:TOPK]:
            rec(j + 1, usados | {p}, tot + cs)
    rec(0, frozenset([pid]), 0)
    return best


def calcular(marcas, info, club_ids, cats, hoy, es_club):
    """marcas: {(g, año, prueba): [(fecha, cs, pid, temporada, piscina, pts)]} · info: pid → (andaluz, malagueño, nombre, club).
    club_ids: {pid: (g, año)} del club · cats: [(clave, etiqueta, años)] · es_club(nombre_club) → bool."""
    desde = hoy - timedelta(days=VENTANA_DIAS)
    mejor = {}                                   # (pid, prueba, piscina) → (cs, fecha)
    for (g, y, ev), M in marcas.items():
        for d, cs, pid, t, pl, pts in M:
            if d < desde or pl not in POOLS:
                continue
            k = (pid, ev, pl)
            if k not in mejor or cs < mejor[k][0]:
                mejor[k] = (cs, d)
    # club de cada nadador y nivel del club (por mayoría de sus nadadores)
    def cclave(pid):
        c = info.get(pid, (0, 0, '', ''))[3]
        return 'AXARQ' if es_club(c) else c
    votos = defaultdict(lambda: [0, 0, 0])
    nom_club = {}
    for pid, v in info.items():
        k = cclave(pid)
        votos[k][0] += 1; votos[k][1] += 1 if v[0] else 0; votos[k][2] += 1 if v[1] else 0
        nom_club.setdefault(k, v[3])
    nivel = {k: {'es': True, 'an': v[1] * 2 > v[0], 'ma': v[2] * 2 > v[0]} for k, v in votos.items()}
    sexo_anyo = {}
    for (g, y, ev), M in marcas.items():
        for d, cs, pid, t, pl, pts in M:
            sexo_anyo[pid] = (g, y)

    out = []
    for ck, lbl, yrs in cats:
        if ck not in RELEVOS:
            continue
        rel_out = []
        for nombre, tipo, dist in RELEVOS[ck]:
            sexos = ['X'] if 'mixto' in nombre else ['M', 'F']
            for sx in sexos:
                variantes = _patas(tipo, dist, sx)
                por_piscina = {}
                for pl in POOLS:
                    # candidatos por club y posta
                    cand_club = defaultdict(lambda: defaultdict(list))
                    pruebas = {ev for pat in variantes for ev, _ in pat}
                    for (pid, ev, p2), (cs, d) in mejor.items():
                        if p2 != pl or ev not in pruebas or pid not in sexo_anyo:
                            continue
                        g, y = sexo_anyo[pid]
                        if y not in yrs:
                            continue
                        cand_club[cclave(pid)][(ev, g)].append((cs, pid))
                    equipos = []
                    for club, cand in cand_club.items():
                        for v in cand.values():
                            v.sort()
                        res = None
                        for pat in variantes:
                            r = _resolver(pat, cand)
                            if r and (res is None or r[0] < res[0][0]):
                                res = (r, pat)
                        if res:
                            equipos.append((res[0][0], club, res))
                    equipos.sort(key=lambda x: x[0])
                    mio = next((e for e in equipos if e[1] == 'AXARQ'), None)
                    niveles = {}
                    for lv in ('ma', 'an', 'es'):
                        ll = [e for e in equipos if nivel.get(e[1], {}).get(lv)]
                        pos = next((k for k, e in enumerate(ll) if e[1] == 'AXARQ'), None)
                        filas = [[k + 1, nom_club.get(e[1], e[1]), e[0], 1 if e[1] == 'AXARQ' else 0]
                                 for k, e in enumerate(ll) if k < 10 or e[1] == 'AXARQ']
                        niveles[lv] = {'pos': pos + 1 if pos is not None else None, 't': len(ll), 'rows': filas}
                    cand = cand_club.get('AXARQ', {})
                    equipo, faltan = [], []
                    if mio:
                        (tot, eq), pat = mio[2]
                        equipo = [[pid, info[pid][2], pat[k][0], cs, mejor[(pid, pat[k][0], pl)][1].isoformat()]
                                  for k, (pid, cs) in enumerate(eq)]
                    else:   # equipo incompleto: los que hay (mejor posta de cada uno, sin repetir)
                        usados = set()
                        for k in range(4):
                            pat = variantes[0]
                            for cs, pid in cand.get(pat[k], []):
                                if pid not in usados:
                                    usados.add(pid)
                                    equipo.append([pid, info[pid][2], pat[k][0], cs, mejor[(pid, pat[k][0], pl)][1].isoformat()])
                                    break
                    # qué le falta a cada nadador del club de esa categoría y sexo
                    en_equipo = {x[0] for x in equipo}
                    for pid, (g, y) in club_ids.items():
                        if y not in yrs or (sx != 'X' and g != sx) or pid in en_equipo:
                            continue
                        opciones = []
                        for pat in variantes:
                            for k, (ev, gs) in enumerate(pat):
                                if gs != g:
                                    continue
                                suyo = mejor.get((pid, ev, pl), (None,))[0]
                                if mio:
                                    resto = _resolver_forzado(pat, cand, k, pid)
                                    if resto is None:
                                        continue
                                    need = mio[0] - resto        # con menos que esto, el equipo con él es mejor
                                else:
                                    need = None                  # equipo incompleto: entra con cualquier marca
                                gap = (suyo - need) if (suyo is not None and need is not None) else None
                                opciones.append((gap if gap is not None else (0 if need is None and suyo else 10 ** 7), ev, suyo, need, gap))
                        if not opciones:
                            continue
                        opciones.sort(key=lambda o: o[0])
                        _, ev, suyo, need, gap = opciones[0]
                        faltan.append([pid, ev, suyo, need, gap])
                    faltan.sort(key=lambda f: (f[4] is None, f[4] if f[4] is not None else 0, f[2] is None))
                    por_piscina[pl] = {'tot': mio[0] if mio else None, 'eq': equipo, 'lv': niveles, 'falta': faltan[:12],
                                       'min': MINIMAS.get((ck, nombre, sx), {}).get(pl)}
                rel_out.append({'n': nombre, 'g': sx, 'd': dist, 'tipo': tipo, 'p': por_piscina})
        out.append({'key': ck, 'label': lbl, 'yrs': list(yrs), 'rel': rel_out, 'fuente': MIN_FUENTE.get(ck)})
    return {'desde': desde.isoformat(), 'cats': out}

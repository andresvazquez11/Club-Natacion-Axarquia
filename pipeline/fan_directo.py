"""Directo de la Federación Andaluza de Natación (FAN) → directo.json (lo lee la web, sección «Directo»).

1. Calendario: las páginas de eventos de la FAN (campeonatos de Andalucía y Delegación de Málaga) dicen qué
   competiciones hay, sus fechas, sus documentos (series, horario, resultados en PDF) y su «web campeonato».
2. Resultados: cada «web campeonato» es la página que publica SPLASH Meet Manager durante la competición; junto a ella
   está results.lxf (formato Lenex: XML comprimido) con las pruebas, series, calles, tiempos y puestos. Se va
   actualizando mientras se nada.
3. Se marca a los nadadores del C.N. Axarquía (nombre + año de nacimiento → su licencia en la web).

Se ejecuta desde .github/workflows/directo-fan.yml: el calendario cada día y los resultados cada pocos minutos los días
de competición. Solo se reescribe directo.json si algo cambió (para no publicar la web sin motivo).
Uso: python pipeline/fan_directo.py [--salida directo.json] [--nadadores cronometro/nadadores.json]
"""
import argparse, html, io, json, os, re, sys, time, unicodedata, urllib.request, zipfile
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta

FAN = 'https://www.fan.es'
CALENDARIOS = [   # (ruta, categoría de JEvents, ámbito)
    ('/index.php/natacion/ctos-andalucia', 66, 'Andalucía'),
    ('/index.php/natacion/eventos-provinciales/calendario-malaga', 77, 'Málaga'),
]
CLUB = 'AXARQ'          # así aparece el club en las inscripciones («C.N. Axarquia»)
ANTES, DESPUES = 10, 60  # días: competiciones de los últimos 10 días y de los próximos 60
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'es-ES,es;q=0.9'}
MESES = {m: i + 1 for i, m in enumerate(['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
                                         'septiembre', 'octubre', 'noviembre', 'diciembre'])}
ESTILO = {'FREE': 'Libre', 'BACK': 'Espalda', 'BREAST': 'Braza', 'FLY': 'Mariposa', 'MEDLEY': 'Estilos'}

_galleta = ''


def obtener(url, binario=False, intentos=3):
    """Descarga una página. La web de la FAN pide una galleta que pone con JavaScript y recarga a los 3 s: se imita."""
    global _galleta
    ultimo = None
    for _ in range(intentos + 1):
        h = dict(UA)
        if _galleta and 'fan.es' in url:
            h['Cookie'] = _galleta
        try:
            datos = urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=30).read()
        except Exception as e:      # red caída o servidor lento: se reintenta
            ultimo = e
            time.sleep(2)
            continue
        txt = datos[:4000].decode('utf-8', 'replace') if binario else datos.decode('utf-8', 'replace')
        m = re.search(r"document\.cookie\s*=\s*'([^';]+)", txt)
        if m and len(datos) < 4000:
            _galleta = m.group(1)
            time.sleep(3.2)
            continue
        return datos if binario else txt
    raise RuntimeError(f'No se pudo descargar {url}: {ultimo}')


def fecha_es(txt):
    """'Sábado, 24 Octubre 2026' → date (la primera fecha del texto) o None"""
    m = re.search(r'(\d{1,2})\s+([A-Za-zé]+)\s+(\d{4})', txt or '')
    if not m or m.group(2).lower() not in MESES:
        return None
    return date(int(m.group(3)), MESES[m.group(2).lower()], int(m.group(1)))


def eventos_calendario(html_txt, cat, ambito):
    """Lista anual de JEvents → [{id, titulo, desde, hasta, url, ambito}]"""
    out = []
    for li in re.findall(r"<li class='ev_td_li'[^>]*>(.*?)</li>", html_txt, re.S):
        a = re.search(r'href="([^"]*eventodetalle/(\d+)/\d+/[^"]*)"[^>]*>\s*([^<]+)<', li)
        if not a:
            continue
        txt = re.sub(r'<[^>]+>', ' ', li.split('<a', 1)[0])
        fechas = [fecha_es(x) for x in re.split(r'\s-\s', txt)]
        fechas = [f for f in fechas if f]
        if not fechas:
            continue
        out.append({'id': int(a.group(2)), 'titulo': html.unescape(a.group(3)).strip().rstrip('.'), 'ambito': ambito,
                    'desde': fechas[0].isoformat(), 'hasta': fechas[-1].isoformat(), 'url': FAN + a.group(1)})
    return out


def carpeta_web(w):
    """Enlace a una web de resultados → su carpeta, terminada en «/» (si enlaza a un archivo, la carpeta de ese archivo)"""
    return w if w.endswith('/') else w.rsplit('/', 1)[0] + '/' if w.rsplit('/', 1)[-1].count('.') else w + '/'


def etiqueta_web(w):
    """…/1_LIGA_PBA/FAN_1/ → «FAN 1»; …/IMPULSO/ → «Impulso» (nombre del grupo cuando una jornada tiene varias webs)"""
    f = w.rstrip('/').rsplit('/', 1)[-1].replace('_', ' ').strip()
    return f if any(ch.isdigit() for ch in f) else f.title()


def documentos(html_txt):
    """Página de un evento → ([webs de resultados], [{t, url}] documentos: series, horario, resultados…).
    Una jornada puede tener varias webs (grupos: …/FAN_1/, …/FAN_2/, …/IMPULSO/): se devuelven todas, en orden."""
    webs = []
    for u in re.findall(r'href="(https?://(?:www\.)?fanatacion\.es/resultados/[^"]+)"', html_txt):
        u = carpeta_web(html.unescape(u))
        if u not in webs:
            webs.append(u)
    docs = []
    for url, t in re.findall(r'href="([^"]*phocadownload[^"]*download=[^"]+)"[^>]*>\s*([^<]{2,80})<', html_txt):
        url = html.unescape(url)
        url = url if url.startswith('http') else FAN + (url if url.startswith('/') else '/' + url)
        if re.match(r'https://(www\.)?fan\.es/', url):        # solo enlaces de la propia federación
            docs.append({'t': html.unescape(t).strip().rstrip('.')[:80], 'url': url})
    return webs, docs


def norm(s):
    s = unicodedata.normalize('NFD', str(s or '')).encode('ascii', 'ignore').decode().lower()
    return ' '.join(re.sub(r'[^a-z ]', ' ', s).split())


def cs_de(t):
    """'00:01:05.32' → 6532 centésimas; vacío o 0 → None"""
    m = re.match(r'(\d+):(\d+):(\d+)\.(\d+)', t or '')
    if not m:
        return None
    h, mi, s, c = (int(x) for x in m.groups())
    v = ((h * 60 + mi) * 60 + s) * 100 + int(str(c)[:2].ljust(2, '0'))
    return v or None


def leer_lenex(datos, nuestros):
    """results.lxf (zip con un .lef XML) → competición compacta para la web.
    nuestros: {(nombre normalizado, año): licencia RFEN} de los nadadores del club."""
    z = zipfile.ZipFile(io.BytesIO(datos))
    xml = z.read(z.namelist()[0])
    # Un Lenex nunca trae DOCTYPE ni entidades: si los trae, se rechaza (evita bombas XML / entidades externas)
    if re.search(rb'<!(DOCTYPE|ENTITY)', xml[:4000], re.I) or len(xml) > 60e6:
        raise ValueError('Lenex no válido')
    root = ET.fromstring(xml)
    meet = root.find('.//MEET')
    eventos, sesiones = {}, []
    for ses in root.iter('SESSION'):
        sesiones.append({'n': ses.get('number'), 'fecha': ses.get('date'), 'nombre': ses.get('name') or ''})
        for ev in ses.iter('EVENT'):
            st = ev.find('SWIMSTYLE')
            dist, rel = (st.get('distance'), int(st.get('relaycount') or 1)) if st is not None else ('?', 1)
            nombre = f"{rel}x{dist} {ESTILO.get(st.get('stroke'), st.get('stroke') or '')}" if rel > 1 else f"{dist} {ESTILO.get(st.get('stroke') if st is not None else '', '')}"
            heats = {h.get('heatid'): int(h.get('number') or 0) for h in ev.iter('HEAT')}
            cats = {}
            for ag in ev.iter('AGEGROUP'):
                lo, hi = ag.get('agemin'), ag.get('agemax')
                etiqueta = (f'{lo}-{hi} años' if lo != hi else f'{lo} años') if lo not in (None, '-1') else 'Absoluto'
                for rk in ag.iter('RANKING'):
                    lugar = int(rk.get('place') or 0)
                    cats[rk.get('resultid')] = (etiqueta, lugar if lugar > 0 else None)   # -1 = sin puesto (baja, descalificado…)
            eventos[ev.get('eventid')] = {'id': ev.get('eventid'), 'num': int(ev.get('number') or 0), 'nombre': nombre.strip(),
                                          'sexo': ev.get('gender') or '', 'hora': ev.get('daytime') or '', 'sesion': ses.get('number'),
                                          'fecha': ses.get('date'), 'estado': ev.get('status') or '', '_heats': heats, '_cats': cats, 'filas': []}

    def fila(res, nombre, club, nac, licencia, rfen):
        ev = eventos.get(res.get('eventid'))
        if not ev:
            return
        cat, puesto = ev['_cats'].get(res.get('resultid'), ('', None))
        ev['filas'].append({'serie': ev['_heats'].get(res.get('heatid'), 0), 'calle': int(res.get('lane') or 0), 'n': nombre, 'club': club,
                            'nac': nac, 't': cs_de(res.get('swimtime')), 'ins': cs_de(res.get('entrytime')), 'puesto': puesto, 'cat': cat,
                            'estado': res.get('status') or '', 'rfen': rfen,
                            'parc': [cs_de(sp.get('swimtime')) for sp in res.iter('SPLIT')] or None})

    for club in root.iter('CLUB'):
        nombre_club = club.get('name') or ''
        es_nuestro = CLUB in nombre_club.upper()
        for a in club.iter('ATHLETE'):
            nombre = f"{a.get('firstname', '')} {a.get('lastname', '')}".strip()
            nac = int((a.get('birthdate') or '0')[:4] or 0) or None
            rfen = nuestros.get((norm(nombre), nac)) if es_nuestro else None
            if es_nuestro and not rfen:
                rfen = '?'        # del club pero no emparejado con la web
            for res in a.iter('RESULT'):
                fila(res, nombre, nombre_club, nac, a.get('license'), rfen)
            for en in a.iter('ENTRY'):      # inscripciones (lista de salida antes de nadar)
                if not any(r.get('eventid') == en.get('eventid') for r in a.iter('RESULT')):
                    fila(en, nombre, nombre_club, nac, a.get('license'), rfen)
        for rl in club.iter('RELAY'):
            for res in rl.iter('RESULT'):
                fila(res, f"{nombre_club} (relevo)", nombre_club, None, None, 'club' if es_nuestro else None)

    pruebas = []
    for ev in sorted(eventos.values(), key=lambda e: (e['fecha'] or '', e['num'])):
        filas = sorted(ev.pop('filas'), key=lambda f: (f['serie'], f['calle']))
        ev.pop('_heats'); ev.pop('_cats')
        if not filas:
            continue
        ev['filas'] = filas
        ev['nadadas'] = sum(1 for f in filas if f['t'] or f['estado'])
        pruebas.append(ev)
    return {'nombre': meet.get('name') if meet is not None else '', 'lugar': meet.get('city') if meet is not None else '',
            'piscina': {'SCM': '25 m', 'LCM': '50 m'}.get(meet.get('course') if meet is not None else '', ''),
            'sesiones': sesiones, 'pruebas': pruebas}


# ── Series en PDF (lista de salida de SPLASH), para cuando aún no hay web de la competición ──
# Cada prueba empieza con «Prueba 17 Fem., 50m Libre Benjamin 2017» y «24/10/2026 - 9:52 Lista de salida»; luego
# «Serie 2 de 3» y una línea por calle: «4 LASIERRA FERNANDEZ, Ana Lourdes 17 C.N. Axarquia 1:03.33 25m».
SEXO_PDF = {'fem': 'F', 'masc': 'M', 'mixto': 'X'}
RE_PRUEBA = re.compile(r'^Prueba (\d+),? (Fem|Masc|Mixto)\.?,? (\d+(?:\s*x\s*\d+)?)m ([A-Za-zÁÉÍÓÚáéíóúÑñ]+)', re.I)
RE_HORA = re.compile(r'^(\d{2})/(\d{2})/(\d{4}) - (\d{1,2}):(\d{2})\b')
RE_SERIE = re.compile(r'^Serie (\d+) de (\d+)')
RE_TIEMPO = r'(NT|\d{1,2}:\d{2}\.\d{2}|\d{1,2}\.\d{2})'
RE_NADADOR = re.compile(r'^(\d{1,2}) ([^,]+), (.+?) ?(\d{2}) (.+?) ' + RE_TIEMPO + r'(?: (25m|50m))?\s*$')
RE_EQUIPO = re.compile(r'^(\d{1,2}) (.+?) ' + RE_TIEMPO + r'(?: (25m|50m))?\s*$')


def cs_texto(t):
    """'1:03.33' → 6333; '49.88' → 4988; 'NT' → None"""
    m = re.match(r'(?:(\d+):)?(\d+)\.(\d{2})$', t or '')
    return (int(m.group(1) or 0) * 60 + int(m.group(2))) * 100 + int(m.group(3)) if m else None


def leer_series_texto(texto, grupo, nuestros):
    """Texto de un PDF de series → [pruebas] con la misma forma que leer_lenex (sin tiempos todavía)"""
    pruebas, actual, serie = {}, None, 0
    for linea in (l.strip() for l in texto.splitlines()):
        m = RE_PRUEBA.match(linea)
        if m:
            num = int(m.group(1))
            estilo = m.group(4).capitalize()
            dist = re.sub(r'\s*x\s*', 'x', m.group(3).lower())
            nombre = f'{dist} {estilo}'
            actual = pruebas.setdefault(num, {'id': f'{grupo}-{num}', 'num': num, 'nombre': nombre, 'sexo': SEXO_PDF.get(m.group(2).lower(), ''),
                                              'hora': '', 'fecha': '', 'sesion': grupo, 'estado': '', 'filas': []})
            serie = 0
            continue
        if actual is None:
            continue
        m = RE_HORA.match(linea)
        if m:
            actual['fecha'], actual['hora'] = f'{m.group(3)}-{m.group(2)}-{m.group(1)}', f'{int(m.group(4)):02d}:{m.group(5)}'
            continue
        m = RE_SERIE.match(linea)
        if m:
            serie = int(m.group(1))
            continue
        if not serie:
            continue
        m = RE_NADADOR.match(linea)
        if m and 'x' not in actual['nombre']:
            nombre = f'{m.group(3).strip()} {m.group(2).strip().title()}'
            nac = 2000 + int(m.group(4)) if int(m.group(4)) < 50 else 1900 + int(m.group(4))
            club = m.group(5).strip()
            rfen = (nuestros.get((norm(nombre), nac)) or '?') if CLUB in club.upper() else None
            actual['filas'].append({'serie': serie, 'calle': int(m.group(1)), 'n': nombre, 'club': club, 'nac': nac, 't': None,
                                    'ins': cs_texto(m.group(6)), 'puesto': None, 'cat': '', 'estado': '', 'rfen': rfen, 'parc': None})
            continue
        m = RE_EQUIPO.match(linea)
        if m and 'x' in actual['nombre']:      # relevos: una línea por equipo
            club = m.group(2).strip()
            dup = re.match(r'^(.+?) \d+ \1$', club)      # «C.N. Mijas 10 C.N. Mijas» → «C.N. Mijas»
            club = dup.group(1) if dup else club
            actual['filas'].append({'serie': serie, 'calle': int(m.group(1)), 'n': f'{club} (relevo)', 'club': club, 'nac': None, 't': None,
                                    'ins': cs_texto(m.group(3)), 'puesto': None, 'cat': '', 'estado': '', 'rfen': 'club' if CLUB in club.upper() else None, 'parc': None})
    for p in pruebas.values():
        p['filas'].sort(key=lambda f: (f['serie'], f['calle']))
        p['nadadas'] = 0
    return [p for p in pruebas.values() if p['filas']]


def leer_series_pdf(docs, nuestros):
    """Documentos «Series…» de una competición (PDF) → lenex de series, o None si no hay o no se pueden leer"""
    try:
        from pypdf import PdfReader
    except ImportError:
        print('Aviso: falta pypdf para leer las series en PDF', file=sys.stderr)
        return None
    pruebas = []
    for d in docs:
        if not re.match(r'series', d.get('t', ''), re.I):
            continue
        try:
            pdf = PdfReader(io.BytesIO(obtener(d['url'], binario=True)))
            texto = '\n'.join(pag.extract_text() or '' for pag in pdf.pages)
        except Exception as e:
            print('Aviso: no se pudo leer', d.get('t'), e, file=sys.stderr)
            continue
        grupo = re.sub(r'^series\.?\s*', '', d['t'], flags=re.I).strip() or 'Series'
        pruebas += leer_series_texto(texto, grupo, nuestros)
    if not pruebas:
        return None
    pruebas.sort(key=lambda p: (p['fecha'], p['hora'], p['num']))
    return {'nombre': '', 'lugar': '', 'piscina': '', 'sesiones': [], 'pruebas': pruebas, 'origen': 'pdf'}


# ── Web de la competición sin results.lxf: SPLASH publica un PDF por prueba ──
# La página (index) enlaza «StartList_N.pdf» (lista de salida) y, cuando la prueba ya se ha nadado, «ResultList_N.pdf»:
#   «Prueba 16 Masc., 200m Estilos Alevín» · «24/10/2026 - 9:49 Resultados» · «1. CAPELLI, Thomas 14 C.N. Axarquia 2:43.87 19,00 -»
#   y debajo los parciales «50m: 34.38 34.38 100m: 1:16.95 42.57 …» (acumulado y del tramo).
RE_RES = re.compile(r'^(\d+)\. ([^,]+), (.+?) (\d{2}) (.+?) ' + RE_TIEMPO + r'(?: [\d.,]+)?(?: .*)?$')
RE_RES_EQ = re.compile(r'^(\d+)\. (.+?) ' + RE_TIEMPO + r'(?: [\d.,]+)?(?: .*)?$')
RE_SIN = re.compile(r'^(?:\d+\.\s*)?([^,\d][^,]*), (.+?) (\d{2}) (.+?) (DSQ|DNS|DNF|BAJA|Baja|NP|Desc\w*|Desca\w*)\b', re.I)
RE_PARC = re.compile(r'(\d+)m: ' + RE_TIEMPO)
ESTADO_TXT = {'dsq': 'DSQ', 'dns': 'DNS', 'dnf': 'DNF', 'baja': 'SICK', 'np': 'DNS'}


def leer_resultados_texto(texto, grupo, nuestros):
    """Texto de un ResultList de SPLASH → [pruebas] como leer_lenex (con tiempo, puesto y parciales; sin serie ni calle)"""
    pruebas, actual, ultima = {}, None, None
    for linea in (l.strip() for l in texto.splitlines()):
        m = RE_PRUEBA.match(linea)
        if m:
            num = int(m.group(1))
            dist = re.sub(r'\s*x\s*', 'x', m.group(3).lower())
            actual = pruebas.setdefault(num, {'id': f'{grupo}-{num}', 'num': num, 'nombre': f'{dist} {m.group(4).capitalize()}',
                                              'sexo': SEXO_PDF.get(m.group(2).lower(), ''), 'hora': '', 'fecha': '', 'sesion': grupo,
                                              'estado': '', 'filas': [], 'src': 'res'})
            ultima = None
            continue
        if actual is None:
            continue
        m = RE_HORA.match(linea)
        if m:
            actual['fecha'], actual['hora'] = f'{m.group(3)}-{m.group(2)}-{m.group(1)}', f'{int(m.group(4)):02d}:{m.group(5)}'
            continue
        if RE_PARC.match(linea) and ultima is not None:          # parciales del último nadador (acumulados)
            ultima['parc'] = [cs_texto(t) for _, t in re.findall(r'(\d+)m: ' + RE_TIEMPO, linea)] or None
            continue
        relevo = 'x' in actual['nombre']
        m = None if relevo else RE_RES.match(linea)
        if m:
            nombre, nac, club = f'{m.group(3).strip()} {m.group(2).strip().title()}', 2000 + int(m.group(4)) if int(m.group(4)) < 50 else 1900 + int(m.group(4)), m.group(5).strip()
            ultima = {'serie': 0, 'calle': 0, 'n': nombre, 'club': club, 'nac': nac, 't': cs_texto(m.group(6)), 'ins': None,
                      'puesto': int(m.group(1)), 'cat': '', 'estado': '', 'rfen': (nuestros.get((norm(nombre), nac)) or '?') if CLUB in club.upper() else None, 'parc': None}
            actual['filas'].append(ultima)
            continue
        m = RE_RES_EQ.match(linea) if relevo else None
        if m:
            club = m.group(2).strip()
            ultima = {'serie': 0, 'calle': 0, 'n': f'{club} (relevo)', 'club': club, 'nac': None, 't': cs_texto(m.group(3)), 'ins': None,
                      'puesto': int(m.group(1)), 'cat': '', 'estado': '', 'rfen': 'club' if CLUB in club.upper() else None, 'parc': None}
            actual['filas'].append(ultima)
            continue
        m = RE_SIN.match(linea)
        if m:
            nombre, nac, club = f'{m.group(2).strip()} {m.group(1).strip().title()}', 2000 + int(m.group(3)) if int(m.group(3)) < 50 else 1900 + int(m.group(3)), m.group(4).strip()
            est = m.group(5).lower()
            ultima = {'serie': 0, 'calle': 0, 'n': nombre, 'club': club, 'nac': nac, 't': None, 'ins': None, 'puesto': None, 'cat': '',
                      'estado': ESTADO_TXT.get(est[:4] if est.startswith('baja') else est[:3] if est in ('dsq', 'dns', 'dnf') else est, 'DSQ' if est.startswith('desc') else est.upper()),
                      'rfen': (nuestros.get((norm(nombre), nac)) or '?') if CLUB in club.upper() else None, 'parc': None}
            actual['filas'].append(ultima)
    for p in pruebas.values():
        p['nadadas'] = sum(1 for f in p['filas'] if f['t'] or f['estado'])
    return [p for p in pruebas.values() if p['filas']]


def cabecera_web(html_txt):
    """Índice de SPLASH → (lugar, fecha) para distinguir sedes («TORRE DEL MAR (ESP) 24/10/2026»)"""
    t = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', re.sub(r'<(style|script).*?</\1>', '', html_txt, flags=re.S)))
    m = re.search(r'\(25m\)|\(50m\)', t)
    m2 = re.search(r'([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ .\-]+?) \([A-Z]{3}\) (\d{2}/\d{2}/\d{4})', t)
    piscina = '25 m' if m and '25' in m.group(0) else '50 m' if m else ''
    return (m2.group(1).strip().title() if m2 else ''), (m2.group(2) if m2 else ''), piscina


def leer_web_pdf(webs, nuestros, previo=None):
    """Webs de la competición (las que enlaza la FAN; una por grupo) → lenex con los ResultList (resultados) y, en las
    pruebas aún sin nadar, los StartList (series y calles). Con varias webs, cada una es un grupo («FAN 1», «Impulso»…).
    previo: lenex anterior de esta competición, para no volver a descargar las listas de salida ya leídas."""
    from pypdf import PdfReader
    webs = [webs] if isinstance(webs, str) else list(webs)
    ya = {p['id']: p for p in (previo or {}).get('pruebas', []) if p.get('src') == 'series'}
    pruebas, lugares, piscina = [], [], ''
    for w in webs:
        try:
            idx = obtener(w)
        except Exception as e:
            print('Aviso web', w, e, file=sys.stderr)
            continue
        lugar, fecha, pisc = cabecera_web(idx)
        piscina = piscina or pisc
        if lugar and lugar not in lugares:
            lugares.append(lugar)
        grupo = etiqueta_web(w) if len(webs) > 1 else (lugar or etiqueta_web(w))
        res = sorted({int(n) for n in re.findall(r'href="ResultList_(\d+)\.pdf"', idx)})
        sal = sorted({int(n) for n in re.findall(r'href="StartList_(\d+)\.pdf"', idx)} - set(res))
        for tipo, nums in (('ResultList', res), ('StartList', sal)):
            for n in nums:
                pid = f'{grupo}-{n}'
                if tipo == 'StartList' and pid in ya:
                    pruebas.append(ya[pid])
                    continue
                try:
                    pdf = PdfReader(io.BytesIO(obtener(f'{w}{tipo}_{n}.pdf', binario=True)))
                    texto = '\n'.join(pag.extract_text() or '' for pag in pdf.pages)
                except Exception as e:
                    print('Aviso', tipo, n, e, file=sys.stderr)
                    continue
                if tipo == 'ResultList':
                    pruebas += leer_resultados_texto(texto, grupo, nuestros)
                else:
                    for p in leer_series_texto(texto, grupo, nuestros):
                        p['src'] = 'series'
                        pruebas.append(p)
                time.sleep(0.2)
    if not pruebas:
        return None
    pruebas.sort(key=lambda p: (p['fecha'], p['hora'], p['num']))
    return {'nombre': '', 'lugar': ' · '.join(lugares), 'piscina': piscina, 'sesiones': [], 'pruebas': pruebas, 'origen': 'web-pdf'}


def estado_de(c, hoy):
    if c['desde'] > hoy.isoformat():
        return 'proxima'
    if c['hasta'] < hoy.isoformat():
        return 'terminada'
    return 'en_curso'


def nuestros_de(ruta):
    """cronometro/nadadores.json → {(nombre normalizado, año): licencia}"""
    try:
        lista = json.load(open(ruta, encoding='utf-8'))['nadadores']
    except Exception:
        return {}
    return {(norm(n['n']), int(n['y'])): str(n['id']) for n in lista if n.get('n') and n.get('y')}


def construir(hoy, nuestros, solo_resultados=False, previo=None):
    """Arma el contenido de directo.json. solo_resultados: no vuelve a leer el calendario (usa el de previo)."""
    if solo_resultados and previo:
        comps = [{k: v for k, v in c.items() if k != 'lenex'} for c in previo.get('competiciones', [])]
    else:
        comps, vistos, fallos = [], set(), set()
        anteriores = {c['id']: c for c in (previo or {}).get('competiciones', [])}
        for ruta, cat, ambito in CALENDARIOS:
            for anio in sorted({hoy.year, (hoy + timedelta(days=DESPUES)).year, (hoy - timedelta(days=ANTES)).year}):
                try:
                    pag = obtener(f'{FAN}{ruta}/eventosanual/{anio}/{cat}')
                except Exception as e:
                    print('Aviso calendario', ruta, anio, e, file=sys.stderr)
                    fallos.add(ambito)
                    continue
                for ev in eventos_calendario(pag, cat, ambito):
                    if ev['id'] in vistos:
                        continue
                    vistos.add(ev['id'])
                    if ev['hasta'] >= (hoy - timedelta(days=ANTES)).isoformat() and ev['desde'] <= (hoy + timedelta(days=DESPUES)).isoformat():
                        comps.append(ev)
        # si no se pudo leer el calendario de un ámbito, se conservan sus competiciones de la vez anterior (no desaparecen)
        for c in anteriores.values():
            if c.get('ambito') in fallos and c['id'] not in vistos and c['hasta'] >= (hoy - timedelta(days=ANTES)).isoformat():
                vistos.add(c['id'])
                comps.append({k: v for k, v in c.items() if k not in ('lenex', 'estado')})
        for c in comps:
            try:
                webs, c['docs'] = documentos(obtener(c['url']))
                c['web'], c['webs'] = (webs[0] if webs else None), webs
            except Exception as e:      # página del evento caída: se conservan las webs y los documentos que ya se conocían
                print('Aviso evento', c['url'], e, file=sys.stderr)
                ant = anteriores.get(c['id']) or {}
                c['web'] = c.get('web') or ant.get('web')
                c['webs'] = c.get('webs') or ant.get('webs') or ([c['web']] if c['web'] else [])
                c['docs'] = c.get('docs') or ant.get('docs') or []
    for c in comps:
        c['estado'] = estado_de(c, hoy)
        # los resultados se leen de la web de la competición (SPLASH); si aún no la hay, de las series en PDF
        webs = c.get('webs') or ([c['web']] if c.get('web') else [])
        if webs:
            try:
                if len(webs) > 1:            # varios grupos: los PDF de cada web (results.lxf sería solo de uno)
                    raise ValueError('varias webs')
                c['lenex'] = leer_lenex(obtener(webs[0] + 'results.lxf', binario=True, intentos=0), nuestros)
            except Exception as e:      # muchas competiciones no publican results.lxf: los PDF de cada prueba
                print('Sin results.lxf', webs[0], e, file=sys.stderr)
                ant = next((x.get('lenex') for x in (previo or {}).get('competiciones', []) if x.get('id') == c.get('id')), None)
                try:
                    c['lenex'] = leer_web_pdf(webs, nuestros, ant if ant and ant.get('origen') == 'web-pdf' else None)
                except Exception as e2:
                    print('Sin resultados todavía', webs[0], e2, file=sys.stderr)
        if not c.get('lenex') and c['estado'] != 'terminada' and c.get('docs'):
            series = leer_series_pdf(c['docs'], nuestros)
            if series:
                c['lenex'] = series
    comps.sort(key=lambda c: (c['desde'], c['titulo']))
    return {'competiciones': comps}


def main():
    ap = argparse.ArgumentParser()
    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap.add_argument('--salida', default=os.path.join(raiz, 'directo.json'))
    ap.add_argument('--nadadores', default=os.path.join(raiz, 'cronometro', 'nadadores.json'))
    ap.add_argument('--solo-resultados', action='store_true', help='no vuelve a leer el calendario de la FAN')
    a = ap.parse_args()
    previo = json.load(open(a.salida, encoding='utf-8')) if os.path.exists(a.salida) else None
    hoy = date.today()
    nuevo = construir(hoy, nuestros_de(a.nadadores), a.solo_resultados and previo is not None, previo)
    if previo and {k: v for k, v in previo.items() if k != 'actualizado'} == nuevo:
        print('Directo: sin cambios')
        return
    nuevo['actualizado'] = datetime.now().strftime('%Y-%m-%dT%H:%M')
    with open(a.salida, 'w', encoding='utf-8') as f:
        json.dump(nuevo, f, ensure_ascii=False, separators=(',', ':'))
    n = sum(1 for c in nuevo['competiciones'] if c.get('lenex'))
    print(f"Directo: {len(nuevo['competiciones'])} competiciones ({n} con resultados) → {a.salida} ({os.path.getsize(a.salida) / 1e3:.0f} KB)")


if __name__ == '__main__':
    main()

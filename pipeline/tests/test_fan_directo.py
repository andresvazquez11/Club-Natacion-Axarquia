import io
import json
import os
import sys
import unittest
import zipfile
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import fan_directo as F

CAL = """<div id='jev_maincal'><ul class='ev_ul'>
<li class='ev_td_li' style="border-color:#0505fa;"> Viernes, 09 Enero 2026 - Sábado, 10 Enero 2026 <br/>
<a class="ev_link_row" href="/index.php/natacion/ctos-andalucia/eventodetalle/2906/66/campeonato" title="x"> Campeonato FAN Invierno piscina 50</a> :: Ctos.</li>
<li class='ev_td_li'> Sábado, 24 Octubre 2026 08:00 - 18:00 <br/>
<a class="ev_link_row" href="/index.php/natacion/eventos-provinciales/calendario-malaga/eventodetalle/3220/77/1-jornada"> 1ª Jornada Liga &amp; más.</a></li>
</ul></div>"""

EVENTO = """<p><a href="/index.php/component/phocadownload/category/174-archivos?download=20387:series">Series FAN Grupo 1.</a></p>
<p><a href="https://fanatacion.es/resultados/malaga/2526/PBA/FINAL_PBA/index.html">WEB CAMPEONATO</a></p>"""

LENEX = """<?xml version="1.0" encoding="UTF-8"?>
<LENEX version="3.0"><MEETS><MEET name="Jornada" city="MALAGA" course="SCM">
<SESSIONS><SESSION date="2026-10-18" number="1" name="1a"><EVENTS>
<EVENT eventid="10" number="1" gender="F" daytime="10:00" status="OFFICIAL"><SWIMSTYLE distance="50" stroke="FREE" relaycount="1"/>
<AGEGROUPS><AGEGROUP agemin="10" agemax="11"><RANKINGS><RANKING place="1" resultid="100"/><RANKING place="2" resultid="101"/></RANKINGS></AGEGROUP></AGEGROUPS>
<HEATS><HEAT heatid="1000" number="1"/><HEAT heatid="1001" number="2"/></HEATS></EVENT>
</EVENTS></SESSION></SESSIONS>
<CLUBS>
<CLUB name="C.N. Axarquia"><ATHLETES>
<ATHLETE firstname="Lucía" lastname="Romero Gil" birthdate="2015-03-01" gender="F" license="1"><RESULTS>
<RESULT eventid="10" resultid="100" heatid="1001" lane="4" swimtime="00:00:35.20" entrytime="00:00:36.00"><SPLITS><SPLIT distance="25" swimtime="00:00:16.90"/></SPLITS></RESULT>
</RESULTS></ATHLETE>
<ATHLETE firstname="Ana" lastname="Nueva" birthdate="2015-01-01" gender="F" license="2"><RESULTS>
<RESULT eventid="10" resultid="102" heatid="1000" lane="3" swimtime="00:00:00.00"/>
</RESULTS></ATHLETE></ATHLETES></CLUB>
<CLUB name="C.N. Mijas"><ATHLETES>
<ATHLETE firstname="Eva" lastname="Sol" birthdate="2014-05-05" gender="F" license="3"><RESULTS>
<RESULT eventid="10" resultid="101" heatid="1001" lane="5" swimtime="00:00:36.10"/>
</RESULTS></ATHLETE></ATHLETES></CLUB>
</CLUBS></MEET></MEETS></LENEX>""".encode('utf-8')


def zip_de(xml):
    b = io.BytesIO()
    with zipfile.ZipFile(b, 'w') as z:
        z.writestr('results.lef', xml)
    return b.getvalue()


class TestDirecto(unittest.TestCase):
    def test_calendario(self):
        ev = F.eventos_calendario(CAL, 66, 'Andalucía')
        self.assertEqual([(e['id'], e['desde'], e['hasta']) for e in ev], [(2906, '2026-01-09', '2026-01-10'), (3220, '2026-10-24', '2026-10-24')])
        self.assertEqual(ev[1]['titulo'], '1ª Jornada Liga & más')
        self.assertTrue(ev[1]['url'].startswith('https://www.fan.es/index.php/'))

    def test_documentos_y_web_campeonato(self):
        web, docs = F.documentos(EVENTO)
        self.assertEqual(web, ['https://fanatacion.es/resultados/malaga/2526/PBA/FINAL_PBA/'])
        self.assertEqual(docs[0]['t'], 'Series FAN Grupo 1')
        self.assertTrue(docs[0]['url'].startswith('https://www.fan.es/index.php/component/phocadownload'))

    def test_tiempos(self):
        self.assertEqual(F.cs_de('00:01:05.32'), 6532)
        self.assertEqual(F.cs_de('00:00:31.02'), 3102)       # «.02» son 2 centésimas
        self.assertEqual(F.postas({50: 2635, 100: 5188, 150: 7675}, 10160, 50), [2635, 2553, 2487, 2485])
        self.assertEqual(F.postas({50: 2635}, 10160, 50), [2635, None, None, None])
        self.assertIsNone(F.cs_de('00:00:00.00'))
        self.assertIsNone(F.cs_de(''))

    def test_lenex_series_puestos_y_nuestros(self):
        L = F.leer_lenex(zip_de(LENEX), {('lucia romero gil', 2015): '6313922'})
        self.assertEqual((L['lugar'], L['piscina']), ('MALAGA', '25 m'))
        p = L['pruebas'][0]
        self.assertEqual((p['nombre'], p['sexo'], p['nadadas']), ('50 Libre', 'F', 2))
        self.assertEqual([(f['serie'], f['calle'], f['n']) for f in p['filas']], [(1, 3, 'Ana Nueva'), (2, 4, 'Lucía Romero Gil'), (2, 5, 'Eva Sol')])
        lucia = p['filas'][1]
        self.assertEqual((lucia['t'], lucia['puesto'], lucia['cat'], lucia['rfen'], lucia['parc']), (3520, 1, '10-11 años', '6313922', [1690]))
        self.assertEqual(p['filas'][0]['rfen'], '?')     # del club pero sin emparejar con la web
        self.assertIsNone(p['filas'][2]['rfen'])        # de otro club
        self.assertIsNone(p['filas'][0]['t'])           # aún sin nadar

    def test_lenex_relevistas(self):
        xml = b"""<?xml version="1.0" encoding="UTF-8"?>
<LENEX version="3.0"><MEETS><MEET name="Clubes" city="MALAGA" course="SCM">
<SESSIONS><SESSION date="2026-10-18" number="1"><EVENTS>
<EVENT eventid="20" number="17" gender="M" daytime="13:36"><SWIMSTYLE distance="50" stroke="FREE" relaycount="4"/></EVENT>
</EVENTS></SESSION></SESSIONS>
<CLUBS><CLUB name="C.N. Axarquia"><ATHLETES>
<ATHLETE athleteid="1" firstname="Miguel Angel" lastname="Chica Mata" birthdate="2009-01-01"/>
<ATHLETE athleteid="2" firstname="Carlos" lastname="Ramirez Porras" birthdate="2009-01-01"/>
<ATHLETE athleteid="3" firstname="Luis" lastname="Anaya Carrion" birthdate="2010-01-01"/>
<ATHLETE athleteid="4" firstname="Ivan" lastname="Barranquero Barba" birthdate="2009-01-01"/>
</ATHLETES><RELAYS><RELAY gender="M" number="1"><RESULTS>
<RESULT eventid="20" resultid="9" lane="6" swimtime="00:01:41.60"><SPLITS>
<SPLIT distance="50" swimtime="00:00:26.35"/><SPLIT distance="100" swimtime="00:00:51.88"/><SPLIT distance="150" swimtime="00:01:16.75"/></SPLITS>
<RELAYPOSITIONS><RELAYPOSITION athleteid="4" number="4"/><RELAYPOSITION athleteid="1" number="1"/>
<RELAYPOSITION athleteid="2" number="2"/><RELAYPOSITION athleteid="3" number="3"/></RELAYPOSITIONS>
</RESULT></RESULTS></RELAY></RELAYS></CLUB></CLUBS></MEET></MEETS></LENEX>"""
        L = F.leer_lenex(zip_de(xml), {('carlos ramirez porras', 2009): '111'})
        f = L['pruebas'][0]['filas'][0]
        self.assertEqual((L['pruebas'][0]['nombre'], f['n'], f['t'], f['rfen']), ('4x50 Libre', 'C.N. Axarquia (relevo)', 10160, 'club'))
        self.assertEqual([(r['n'], r['nac'], r['rfen'], r['t']) for r in f['rel']],
                         [('Miguel Angel Chica Mata', 2009, '?', 2635), ('Carlos Ramirez Porras', 2009, '111', 2553),
                          ('Luis Anaya Carrion', 2010, '?', 2487), ('Ivan Barranquero Barba', 2009, '?', 2485)])
        self.assertNotIn('_dist', L['pruebas'][0])

    def test_lenex_con_entidades_se_rechaza(self):
        with self.assertRaises(ValueError):
            F.leer_lenex(zip_de(b'<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]><LENEX/>'), {})

    def test_estado(self):
        hoy = date(2026, 10, 24)
        self.assertEqual(F.estado_de({'desde': '2026-10-24', 'hasta': '2026-10-24'}, hoy), 'en_curso')
        self.assertEqual(F.estado_de({'desde': '2026-10-31', 'hasta': '2026-11-01'}, hoy), 'proxima')
        self.assertEqual(F.estado_de({'desde': '2026-10-18', 'hasta': '2026-10-18'}, hoy), 'terminada')


SERIES = '''Splash Meet Manager, 11.85476 Registered to Andalucía 22/10/2026 10:59 - Página 1
2 - FAN 24/10/2026
9:00 Apertura Instalación
Prueba 17 Fem., 50m Libre Benjamin 2017
24/10/2026 - 9:52 Lista de salida
AN
Serie 1 de 2
3 KABANOVA, Ekaterina 17 C.N. Mijas NT
4 LASIERRA FERNANDEZ, Ana Lourdes17 C.N. Axarquia 1:03.33 25m
Prueba 17, Fem., 50m Libre
Serie 2 de 2
4 ROMERO GIL, Lucía 15 C.N. Axarquia 41.01 25m
Prueba 23 Fem., 4 x 50m Espalda Benjamin 2016-2017
24/10/2026 - 10:29 Lista de salida
Serie 1 de 1
2 C.N. Axarquia 10 C.N. Axarquia 3:16.87 25m
'''


class TestSeriesPdf(unittest.TestCase):
    def test_lista_de_salida(self):
        P = F.leer_series_texto(SERIES, 'FAN Grupo 1', {('lucia romero gil', 2015): '6313922'})
        self.assertEqual([(p['num'], p['nombre'], p['sexo'], p['hora'], p['fecha'], p['sesion']) for p in P],
                         [(17, '50 Libre', 'F', '09:52', '2026-10-24', 'FAN Grupo 1'), (23, '4x50 Espalda', 'F', '10:29', '2026-10-24', 'FAN Grupo 1')])
        f = P[0]['filas']
        self.assertEqual([(x['serie'], x['calle'], x['n'], x['nac'], x['ins'], x['rfen']) for x in f], [
            (1, 3, 'Ekaterina Kabanova', 2017, None, None),
            (1, 4, 'Ana Lourdes Lasierra Fernandez', 2017, 6333, '?'),          # del club, sin emparejar con la web
            (2, 4, 'Lucía Romero Gil', 2015, 4101, '6313922')])                  # la prueba sigue en otra página
        self.assertEqual((P[1]['filas'][0]['n'], P[1]['filas'][0]['rfen']), ('C.N. Axarquia (relevo)', 'club'))

    def test_tiempos_de_texto(self):
        self.assertEqual(F.cs_texto('1:03.33'), 6333)
        self.assertEqual(F.cs_texto('49.88'), 4988)
        self.assertIsNone(F.cs_texto('NT'))


class TestArchivarParciales(unittest.TestCase):
    def d(self, filas, nombre='200 Libre'):
        return {'competiciones': [{'id': 7, 'titulo': 'Jornada', 'desde': '2026-10-18', 'lenex': {'lugar': 'MALAGA', 'piscina': '25 m',
                'pruebas': [{'nombre': nombre, 'sexo': 'M', 'fecha': '2026-10-18', 'filas': filas}]}}]}

    def test_guarda_solo_carreras_del_club_con_parciales(self):
        a = F.archivar_parciales(self.d([
            {'rfen': '1', 't': 16054, 'parc': [3626, 7838, 12043], 'puesto': 60, 'serie': 2, 'ins': 15947},   # sin el final: se añade
            {'rfen': '2', 't': 9000, 'parc': [4000, 9000]},                                                     # con el final
            {'rfen': None, 't': 9000, 'parc': [4000, 9000]},                                                    # de otro club
            {'rfen': '3', 't': 9000, 'parc': None}, {'rfen': '4', 't': None, 'parc': [4000]},
            {'rfen': '5', 't': 9000, 'parc': [5000, 4000], 'estado': ''}, {'rfen': '6', 't': 9000, 'parc': [4000], 'estado': 'DSQ'}]))
        self.assertEqual(a['c'], {'7': ['Jornada', '2026-10-18', 'MALAGA', '25m']})
        self.assertEqual(a['n']['1'], [[7, '2026-10-18', '200 Libre', 'M', 16054, [3626, 7838, 12043, 16054], 60, 2, 15947, None]])
        self.assertEqual(a['n']['2'][0][5], [4000, 9000])
        self.assertEqual(sorted(a['n']), ['1', '2'])

    def test_conserva_lo_anterior_y_no_duplica(self):
        a = F.archivar_parciales(self.d([{'rfen': '1', 't': 9000, 'parc': [4000], 'serie': 1}], '100 Libre'))
        a = F.archivar_parciales({'competiciones': []}, a)                 # la competición ya no está en el directo
        a = F.archivar_parciales(self.d([{'rfen': '1', 't': 8990, 'parc': [4000], 'serie': 1}], '100 Libre'), a)   # tiempo corregido
        self.assertEqual([x[4] for x in a['n']['1']], [8990])

    def test_ganador_de_su_serie(self):
        a = F.archivar_parciales(self.d([{'rfen': '1', 't': 9000, 'parc': [4000], 'serie': 1},
                                         {'rfen': None, 'n': 'Eva Sol', 't': 8500, 'parc': [3900, 8500], 'serie': 1},
                                         {'rfen': None, 'n': 'Otra', 't': 8000, 'parc': [3800], 'serie': 2}], '100 Libre'))
        self.assertEqual(a['n']['1'][0][9], ['Eva', [3900, 8500]])

    def test_relevos_fuera(self):
        self.assertEqual(F.archivar_parciales(self.d([{'rfen': '1', 't': 9000, 'parc': [4000]}], '4x50 Libre'))['n'], {})


class TestGuardarCarreras(unittest.TestCase):
    def comp(self, estado='terminada', filas=None):
        filas = filas or [{'n': 'Eva Sol', 'club': 'C.N. Axarquia', 'nac': 2014, 't': 7000, 'parc': [3400, 7000], 'puesto': 1, 'serie': 0, 'calle': 0, 'rfen': '1'},
                          {'n': 'Ana Mar', 'club': 'Otro', 'nac': 2015, 't': 7200, 'parc': [3500, 7200], 'puesto': 2, 'serie': 0, 'calle': 0, 'rfen': None}]
        return {'competiciones': [{'id': 9, 'titulo': 'Jornada', 'desde': '2026-10-24', 'estado': estado, 'web': 'https://x/FAN_1/',
                'lenex': {'lugar': 'Torre', 'piscina': '25 m', 'pruebas': [
                    {'id': 'FAN 1-22', 'num': 22, 'nombre': '100 Libre', 'sexo': 'M', 'sesion': 'FAN 1', 'categoria': 'Alevín', 'fecha': '2026-10-24', 'filas': filas},
                    {'id': 'FAN 1-5', 'num': 5, 'nombre': '4x50 Libre', 'sexo': 'M', 'sesion': 'FAN 1', 'filas': []}]}}]}

    def test_guarda_con_serie_y_calle_y_una_sola_vez(self):
        import tempfile
        d, tmp = self.comp(), tempfile.mkdtemp()
        antes = json.dumps(d, sort_keys=True)
        fn = lambda w, num, grupo, nuestros=None: {(F.norm('Eva Sol'), 2014): (4, 2), (F.norm('Ana Mar'), 2015): (4, 5)}
        self.assertEqual(F.guardar_carreras(d, tmp, None, fn), [9])
        x = json.load(open(os.path.join(tmp, '9.json')))
        self.assertEqual(len(x['pruebas']), 1)                                   # el relevo no se guarda
        self.assertEqual(x['pruebas'][0]['filas'][0], [4, 2, 'Eva Sol', 'C.N. Axarquia', 2014, 7000, [3400, 7000], 1, '', '1'])
        self.assertEqual(json.load(open(os.path.join(tmp, 'indice.json'))), {'9': ['Jornada', '2026-10-24', 'Torre', '25m', 1]})
        self.assertEqual(json.dumps(d, sort_keys=True), antes)                   # directo.json no cambia
        self.assertEqual(F.guardar_carreras(d, tmp, None, fn), [])               # ya guardada: no se reescribe

    def test_sin_lista_de_salida_se_reintenta_y_no_guarda_las_no_terminadas(self):
        import tempfile
        tmp = tempfile.mkdtemp()
        self.assertEqual(F.guardar_carreras(self.comp(), tmp, None, lambda *a, **k: (_ for _ in ()).throw(OSError('sin red'))), [])
        self.assertFalse(os.path.exists(os.path.join(tmp, '9.json')))
        self.assertEqual(F.guardar_carreras(self.comp('en_curso'), tmp, None, lambda *a, **k: {}), [])


class TestCompletarSeries(unittest.TestCase):
    def prueba(self):
        return {'id': 'FAN 1-22', 'nombre': '100 Libre', 'filas': [{'n': 'Eva Sol', 'nac': 2014, 't': 7000, 'serie': 0, 'calle': 0, 'ins': None},
                                                                    {'n': 'Ana Mar', 'nac': 2015, 't': 7100, 'serie': 0, 'calle': 0, 'ins': None}]}

    def test_copia_de_la_version_anterior_sin_pedir_nada(self):
        previa = {'filas': [{'n': 'Eva Sol', 'nac': 2014, 'serie': 4, 'calle': 2, 'ins': 7200}]}
        p = F.completar_series(self.prueba(), previa, lambda: self.fail('no debía pedir la lista de salida'))
        self.assertEqual([(f['serie'], f['calle'], f['ins']) for f in p['filas']], [(4, 2, 7200), (0, 0, None)])

    def test_sin_version_anterior_pide_la_lista_de_salida_y_si_falla_sigue(self):
        p = F.completar_series(self.prueba(), None, lambda: {(F.norm('Ana Mar'), 2015): (3, 5)})
        self.assertEqual([(f['serie'], f['calle']) for f in p['filas']], [(0, 0), (3, 5)])
        def cae():
            raise OSError('sin red')
        self.assertEqual(F.completar_series(self.prueba(), None, cae)['filas'][0]['serie'], 0)

    def test_relevos_no_se_tocan(self):
        r = {'id': 'x', 'nombre': '4x50 Libre', 'filas': [{'n': 'C.N. X (relevo)', 'nac': None, 't': 1, 'serie': 0}]}
        self.assertEqual(F.completar_series(r, None, lambda: self.fail('no'))['filas'][0]['serie'], 0)


if __name__ == '__main__':
    unittest.main()

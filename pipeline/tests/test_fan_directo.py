import io
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


if __name__ == '__main__':
    unittest.main()

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
        self.assertEqual(web, 'https://fanatacion.es/resultados/malaga/2526/PBA/FINAL_PBA/')
        self.assertEqual(docs[0]['t'], 'Series FAN Grupo 1')
        self.assertTrue(docs[0]['url'].startswith('https://www.fan.es/index.php/component/phocadownload'))

    def test_tiempos(self):
        self.assertEqual(F.cs_de('00:01:05.32'), 6532)
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

    def test_lenex_con_entidades_se_rechaza(self):
        with self.assertRaises(ValueError):
            F.leer_lenex(zip_de(b'<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]><LENEX/>'), {})

    def test_estado(self):
        hoy = date(2026, 10, 24)
        self.assertEqual(F.estado_de({'desde': '2026-10-24', 'hasta': '2026-10-24'}, hoy), 'en_curso')
        self.assertEqual(F.estado_de({'desde': '2026-10-31', 'hasta': '2026-11-01'}, hoy), 'proxima')
        self.assertEqual(F.estado_de({'desde': '2026-10-18', 'hasta': '2026-10-18'}, hoy), 'terminada')


if __name__ == '__main__':
    unittest.main()

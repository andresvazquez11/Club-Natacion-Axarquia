import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import fan_directo as F

DATOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'datos')
# texto real de un ResultList de SPLASH (1ª Jornada Liga PBA Málaga, 24/10/2026, prueba 16)
RES16 = open(os.path.join(DATOS, 'fan_resultlist_16.txt'), encoding='utf-8').read()


class TestResultadosPdf(unittest.TestCase):
    def test_lee_puestos_tiempos_y_parciales(self):
        nuestros = {(F.norm('Thomas Capelli'), 2014): '6200999'}
        [p] = F.leer_resultados_texto(RES16, 'Torre Del Mar', nuestros)
        self.assertEqual((p['num'], p['nombre'], p['sexo'], p['fecha'], p['hora']), (16, '200 Estilos', 'M', '2026-10-24', '09:49'))
        self.assertEqual(len(p['filas']), 5)
        f = p['filas'][0]
        self.assertEqual((f['puesto'], f['n'], f['nac'], f['club'], f['t'], f['rfen']), (1, 'Thomas Capelli', 2014, 'C.N. Axarquia', 16387, '6200999'))
        self.assertEqual(f['parc'], [3438, 7695, 12905, 16387])
        self.assertEqual(p['filas'][4]['rfen'], '?')          # del club pero sin emparejar con la web
        self.assertIsNone(p['filas'][1]['rfen'])              # de otro club
        self.assertEqual(p['nadadas'], 5)
        self.assertEqual(p['src'], 'res')

    def test_descalificados_y_relevos(self):
        txt = ('Prueba 30 Fem., 50m Braza Benjamín\n24/10/2026 - 11:05 Resultados\n'
               '1. PEREZ LOPEZ, Ana 16 C.N. Axarquia 48.10 5,00 -\n'
               'RUIZ GIL, Marta 16 C.N. Mijas DSQ\n'
               'Prueba 40 Mixto, 4 x 50m Libre Alevín\n24/10/2026 - 12:30 Resultados\n'
               '1. C.N. Axarquia 2:20.50 10,00 -\n2. C.N. Mijas 2:25.00 8,00 -\n')
        b, r = F.leer_resultados_texto(txt, 'S', {})
        self.assertEqual([(x['n'], x['t'], x['estado']) for x in b['filas']], [('Ana Perez Lopez', 4810, ''), ('Marta Ruiz Gil', None, 'DSQ')])
        self.assertEqual(b['nadadas'], 2)
        self.assertEqual((r['nombre'], r['sexo']), ('4x50 Libre', 'X'))
        self.assertEqual([(x['n'], x['t'], x['rfen']) for x in r['filas']], [('C.N. Axarquia (relevo)', 14050, 'club'), ('C.N. Mijas (relevo)', 14500, None)])

    def test_relevistas(self):
        # texto real: dos relevistas por línea, por columnas (1.ª línea postas 1 y 3; 2.ª, 2 y 4); a veces el año va pegado
        with open(os.path.join(os.path.dirname(__file__), 'datos', 'fan_resultlist_relevo.txt'), encoding='utf-8') as fh:
            est, lib = F.leer_resultados_texto(fh.read(), 'M', {('carlos ramirez porras', 2009): '111'})
        ax = est['filas'][0]
        self.assertEqual((ax['n'], ax['t'], ax['puesto']), ('C.N. Axarquia (relevo)', 24712, 4))
        self.assertEqual([(r['n'], r['nac'], r['t'], r['rfen']) for r in ax['rel']],
                         [('Javier Diaz Guerra', 2010, 6501, '?'), ('Luis Anaya Carrion', 2010, 6281, '?'),
                          ('Carlos Ramirez Porras', 2009, 6316, '111'), ('Miguel Angel Chica Mata', 2009, 5614, '?')])
        self.assertTrue(all(r['rfen'] is None for r in est['filas'][1]['rel']))      # de otro club
        self.assertEqual([(r['n'], r['nac'], r['t']) for r in lib['filas'][0]['rel']],
                         [('Adrian Fikry Reina', 2006, 2497), ('Marcos Honorato Lopez', 2006, 2295),
                          ('Francisco Sanjorge Nodar', 1996, 2471), ('Samuel Maldonado Alcantara', 2010, 2449)])

    def test_cabecera_de_la_web(self):
        html = '<style>x{}</style><h1>LIGA</h1> Piscina Corta (25m) <b>TORRE DEL MAR</b>  (ESP) 24/10/2026 Resultados'
        self.assertEqual(F.cabecera_web(html), ('Torre Del Mar', '24/10/2026', '25 m'))


class TestVariasWebs(unittest.TestCase):
    def test_documentos_devuelve_todas_las_webs(self):
        h = ('<a href="https://fanatacion.es/resultados/malaga/2627/PBA/1_LIGA_PBA/FAN_1/">G1</a>'
             '<a href="https://fanatacion.es/resultados/malaga/2627/PBA/1_LIGA_PBA/FAN_2/index.html">G2</a>'
             '<a href="https://fanatacion.es/resultados/malaga/2627/PBA/1_LIGA_PBA/IMPULSO">G3</a>'
             '<a href="https://fanatacion.es/resultados/malaga/2627/PBA/1_LIGA_PBA/FAN_1/">otra vez</a>')
        webs, _ = F.documentos(h)
        self.assertEqual([w.rsplit('/', 2)[-2] for w in webs], ['FAN_1', 'FAN_2', 'IMPULSO'])
        self.assertEqual([F.etiqueta_web(w) for w in webs], ['FAN 1', 'FAN 2', 'Impulso'])


class TestSinConexion(unittest.TestCase):
    def test_si_falla_la_fan_se_conserva_lo_anterior(self):
        from datetime import date
        previo = {'competiciones': [{'id': 7, 'titulo': 'Liga', 'ambito': 'Málaga', 'desde': '2026-10-24', 'hasta': '2026-10-24',
                                     'url': 'https://www.fan.es/x/eventodetalle/7/77/liga', 'web': 'https://fanatacion.es/resultados/x/', 'webs': ['https://fanatacion.es/resultados/x/'], 'docs': []}]}
        orig = (F.obtener, F.leer_web_pdf)
        def caido(url, binario=False, intentos=3):
            raise RuntimeError('sin conexión')
        F.obtener, F.leer_web_pdf = caido, lambda web, nuestros, previo=None: None
        try:
            out = F.construir(date(2026, 10, 24), {}, previo=previo)
        finally:
            F.obtener, F.leer_web_pdf = orig
        [c] = out['competiciones']
        self.assertEqual((c['id'], c['web'], c['estado']), (7, 'https://fanatacion.es/resultados/x/', 'en_curso'))


if __name__ == '__main__':
    unittest.main()


class TestVolcarYProvisionales(unittest.TestCase):
    def _d(self):
        fila = lambda n, t, rfen=None, nac=2015: {'n': n, 't': t, 'estado': '', 'rfen': rfen, 'nac': nac, 'puesto': None}
        return {'competiciones': [{'id': 9, 'titulo': 'Liga', 'lenex': {'piscina': '25 m', 'lugar': 'Torre Del Mar', 'pruebas': [
            {'sesion': 'FAN 1', 'nombre': '50 Libre', 'sexo': 'M', 'fecha': '2026-10-24', 'filas': [fila('A', 3327, '1'), fila('B', 3200)]},
            {'sesion': 'FAN 2', 'nombre': '50 Libre', 'sexo': 'M', 'fecha': '2026-10-24', 'filas': [fila('C', 3100), fila('D', None)]},
        ]}}]}

    def test_grupos_terminados(self):
        from fan_directo import grupos_terminados
        self.assertEqual(grupos_terminados(self._d()), ['9|FAN 1'])   # FAN 2 aún a medias
        d = self._d(); d['competiciones'][0]['lenex']['pruebas'][1]['filas'][1].update(t=3500, rfen='2')
        self.assertEqual(grupos_terminados(d), ['9|FAN 1', '9|FAN 2'])

    def test_marcas_provisionales(self):
        from generar import marcas_directo
        base = {'profile_id': 1, 'nombre': 'X', 'genero': 'M', 'fecha_nacimiento': 2015, 'club': 'C.N. AXARQUIA', 'estilo': '50 Libre',
                'date': '01/10/2026', 'id_tipo_piscina': '25m', 'record_mundo': 1990, 'valor_original': 3400}
        n = marcas_directo([base], self._d())
        self.assertEqual(len(n), 1)
        self.assertEqual((n[0]['value'], n[0]['date'], n[0]['cpos'], n[0]['cn']), ('00:00:33.27', '24/10/2026', 3, 3))   # suma los dos grupos
        self.assertIn('provisional', n[0]['competition_name'])
        oficial = dict(base, date='24/10/2026')                    # ya publicada por la RFEN: no se duplica
        self.assertEqual(marcas_directo([base, oficial], self._d()), [])

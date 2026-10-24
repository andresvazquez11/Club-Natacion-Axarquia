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

    def test_cabecera_de_la_web(self):
        html = '<style>x{}</style><h1>LIGA</h1> Piscina Corta (25m) <b>TORRE DEL MAR</b>  (ESP) 24/10/2026 Resultados'
        self.assertEqual(F.cabecera_web(html), ('Torre Del Mar', '24/10/2026', '25 m'))


class TestSinConexion(unittest.TestCase):
    def test_si_falla_la_fan_se_conserva_lo_anterior(self):
        from datetime import date
        previo = {'competiciones': [{'id': 7, 'titulo': 'Liga', 'ambito': 'Málaga', 'desde': '2026-10-24', 'hasta': '2026-10-24',
                                     'url': 'https://www.fan.es/x/eventodetalle/7/77/liga', 'web': 'https://fanatacion.es/resultados/x/', 'docs': []}]}
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

import json
import os
import sys
import tempfile
import unittest
from datetime import date, datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import toca_leer as T

D = {'competiciones': [{'desde': '2026-10-31', 'hasta': '2026-11-01'}, {'desde': '2026-11-29', 'hasta': '2026-11-29'}]}


class TestTocaLeer(unittest.TestCase):
    def test_con_competicion_se_lee_siempre(self):
        self.assertTrue(T.toca(D, datetime(2026, 10, 30, 9, 23)))     # víspera
        self.assertTrue(T.toca(D, datetime(2026, 10, 31, 9, 13)))     # primer día
        self.assertTrue(T.toca(D, datetime(2026, 11, 1, 22, 53)))     # último día
        self.assertTrue(T.toca(D, datetime(2026, 11, 2, 9, 3)))       # día siguiente

    def test_sin_competicion_solo_la_pasada_de_cada_hora(self):
        self.assertFalse(T.toca(D, datetime(2026, 11, 7, 10, 13)))
        self.assertFalse(T.toca(D, datetime(2026, 11, 7, 10, 0)))
        self.assertFalse(T.toca(D, datetime(2026, 11, 7, 10, 43)))    # el reloj propio de GitHub (:43) no cuenta
        self.assertTrue(T.toca(D, datetime(2026, 11, 7, 10, 40)))     # Cloudflare, de viernes a domingo
        self.assertTrue(T.toca(D, datetime(2026, 11, 5, 10, 41)))     # entre semana

    def test_sin_datos_se_lee(self):
        self.assertTrue(T.toca(None, datetime(2026, 11, 7, 10, 13)))
        self.assertTrue(T.toca({}, datetime(2026, 11, 7, 10, 13)))

    def test_fechas_raras_no_rompen(self):
        self.assertFalse(T.toca({'competiciones': [{'desde': 'x'}, {'desde': '2026-11-29', 'hasta': 'mal'}, {}]}, datetime(2026, 11, 7, 10, 13)))

    def test_salida_para_github(self):
        d = tempfile.mkdtemp(); f = os.path.join(d, 'out')
        T.main(['--salida', f])
        self.assertIn(open(f).read().strip(), ('toca=si', 'toca=no'))


if __name__ == '__main__':
    unittest.main()

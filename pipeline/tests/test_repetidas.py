import sys, os, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import generar as G


class TestRepetidas(unittest.TestCase):
    def test_misma_marca_con_dos_fechas_se_cuenta_una_vez(self):
        h = [['2026-01-24', 13291, '50m', '3ª Jornada Campeonato Andalucía Clubes - Málaga', 'X'],
             ['2026-02-26', 13291, '50m', '3ª Jornada Campeonato Andalucía Clubes - Piscina 50 M.', 'X'],
             ['2026-05-09', 12970, '25m', '5ª Jornada Campeonato Andalucía Clubes', 'X']]
        self.assertEqual([x[0] for x in G.quitar_repetidas(h)], ['2026-01-24', '2026-05-09'])

    def test_marcas_iguales_en_otra_piscina_o_otra_competicion_se_respetan(self):
        h = [['2026-01-24', 13291, '50m', '3ª Jornada Campeonato', 'X'], ['2026-02-26', 13291, '25m', '3ª Jornada Campeonato', 'X'],
             ['2026-03-01', 13291, '50m', 'Trofeo Ciudad de Mijas', 'X'], ['2026-06-30', 13291, '50m', '3ª Jornada Campeonato', 'X']]
        self.assertEqual(len(G.quitar_repetidas(h)), 4)           # 25 m, otra competición y más de 60 días: no son repetidas


if __name__ == '__main__':
    unittest.main()

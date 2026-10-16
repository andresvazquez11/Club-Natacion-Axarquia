import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import historial as H
import generar as G


def fila(pid, cs, nac, club='C.N. AXARQUIA', fecha='10/03/2024', genero='F'):
    return {'profile_id': pid, 'valor_original': cs, 'fecha_nacimiento': str(nac), 'club': club,
            'id_tipo_piscina': '25m', 'estilo': '50 Braza', 'genero': genero, 'date': fecha,
            'nombre': 'X', 'parcial': False}


class TestEdades(unittest.TestCase):
    def test_mejor_por_nadador_y_edad(self):
        filas = [
            fila('A', 3900, 2012), fila('A', 3842, 2012, fecha='01/05/2024'),   # 12 años, dos marcas del mismo nadador
            fila('B', 3800, 2012),
            fila('C', 3000, 2012, club='OTRO CLUB'),
        ]
        r = H.marcas_club_edades({'2324': filas})
        self.assertEqual(r, {'F|E12|50 Braza|25m': [['B', 3800], ['A', 3842]]})


def nad(pid, y, cs, pool='25m', g='F'):
    return {'id': pid, 'g': g, 'y': y, 'n': pid, 'ev': [{'e': '50 Braza', 'cs': cs, 'pool': pool}]}


def hist_de(*nads, fecha='2026-03-10'):
    return {(n['id'], '50 Braza'): [(fecha, n['ev'][0]['cs'], n['ev'][0]['pool'], 0, 0, 0, 0, 0, False)] for n in nads}


class TestPuestosClub(unittest.TestCase):
    def test_hoy(self):
        a, b, c = nad('A', 2014, 3842), nad('B', 2014, 3800), nad('C', 2014, 3900)
        G.puestos_club([a, b, c], hist_de(a, b, c), {})
        self.assertEqual(a['ev'][0]['cl']['hoy'], [2, 3])

    def test_historico_sin_duplicar(self):
        a = nad('A', 2014, 3842)
        G.puestos_club([a], hist_de(a), {'F|E12|50 Braza|25m': [['X', 3700], ['A', 3842]]})
        self.assertEqual(a['ev'][0]['cl']['hi'], [2, 2, 12])

    def test_otra_piscina_no_cuenta(self):
        a, b = nad('A', 2014, 3842), nad('B', 2014, 3000, pool='50m')
        G.puestos_club([a, b], hist_de(a, b), {})
        self.assertEqual(a['ev'][0]['cl']['hoy'], [1, 1])

    def test_sin_datos_no_hay_cl(self):
        a = nad('A', 2014, 3842)
        G.puestos_club([a], {}, {})
        self.assertEqual(a['ev'][0]['cl'], {'hoy': [1, 1]})


if __name__ == '__main__':
    unittest.main()

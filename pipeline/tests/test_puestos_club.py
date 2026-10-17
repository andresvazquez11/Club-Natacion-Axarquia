import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import historial as H
import generar as G


def fila(pid, cs, nac, club='C.N. AXARQUIA', fecha='10/03/2024', genero='F', nombre='X'):
    return {'profile_id': pid, 'valor_original': cs, 'fecha_nacimiento': str(nac), 'club': club,
            'id_tipo_piscina': '25m', 'estilo': '50 Braza', 'genero': genero, 'date': fecha,
            'nombre': nombre, 'parcial': False}


class TestEdades(unittest.TestCase):
    def test_mejor_por_nadador_y_edad(self):
        filas = [
            fila('A', 3900, 2012, nombre='ANA  RUIZ'), fila('A', 3842, 2012, fecha='01/05/2024', nombre='ANA  RUIZ'),   # 12 años, dos marcas del mismo nadador
            fila('B', 3800, 2012, nombre='BEA SOTO'),
            fila('C', 3000, 2012, club='OTRO CLUB'),
        ]
        r = H.marcas_club_edades({'2324': filas})
        # [pid, cs, nombre]: el nombre sirve para enseñar a los antiguos nadadores en el histórico de «En el club»
        self.assertEqual(r, {'F|E12|50 Braza|25m': [['B', 3800, 'Bea Soto'], ['A', 3842, 'Ana Ruiz']]})


class TestExtractoClub(unittest.TestCase):
    def test_solo_marcas_del_club(self):
        import construir_historial as C
        filas = [fila('A', 3900, 2012), fila('C', 3000, 2012, club='OTRO CLUB'), fila('D', 3100, 2012, club=None)]
        self.assertEqual([r['profile_id'] for r in C.solo_club(filas)], ['A'])

    def test_records_guardan_diez(self):
        filas = [fila(f'P{i}', 3800 + i, 2012) for i in range(12)]
        r = H.marcas_club_records({'2324': filas}, top=10)
        self.assertEqual(len(r['F|E12|50 Braza|25m']), 10)


def nad(pid, y, cs, pool='25m', g='F'):
    return {'id': pid, 'g': g, 'y': y, 'n': pid, 'ev': [{'e': '50 Braza', 'cs': cs, 'pool': pool}]}


def hist_de(*nads, fecha='2026-03-10'):
    return {(n['id'], '50 Braza'): [(fecha, n['ev'][0]['cs'], n['ev'][0]['pool'], 0, 0, 0, 0, 0, False)] for n in nads}


WR = {'F': {'50 Braza': {'25m': 2900, '50m': 3000}}}     # 25 m → 50 m: × 3000/2900


class TestPuestosClub(unittest.TestCase):
    def test_hoy(self):
        a, b, c = nad('A', 2014, 3842), nad('B', 2014, 3800), nad('C', 2014, 3900)
        G.puestos_club([a, b, c], hist_de(a, b, c), {}, wr=WR)
        self.assertEqual(a['ev'][0]['cl']['hoy'], [2, 3])

    def test_historico_sin_duplicar(self):
        a = nad('A', 2014, 3842)
        G.puestos_club([a], hist_de(a), {'F|E12|50 Braza|25m': [['X', 3700], ['A', 3842]]}, wr=WR)
        self.assertEqual(a['ev'][0]['cl']['hi'], [2, 2, 12])

    def test_otra_piscina_se_convierte(self):
        # A: 38.42 en 25 m ≈ 39.74 en 50 m; B: 39.00 en 50 m → B va por delante
        a, b = nad('A', 2014, 3842), nad('B', 2014, 3900, pool='50m')
        G.puestos_club([a, b], hist_de(a, b), {}, wr=WR)
        self.assertEqual(a['ev'][0]['cl']['hoy'], [2, 2])
        self.assertEqual(b['ev'][0]['cl']['hoy'], [1, 2])

    def test_historico_junta_las_dos_piscinas(self):
        a = nad('A', 2014, 3842)
        base = {'F|E12|50 Braza|25m': [['X', 3700]], 'F|E12|50 Braza|50m': [['X', 3750], ['Y', 4000]]}
        r = G.puestos_club([a], hist_de(a), base, wr=WR)
        self.assertEqual(a['ev'][0]['cl']['hi'], [2, 3, 12])
        # [pid, equivalente en 50 m, marca real, piscina real]: de X cuenta su mejor equivalente (la de 50 m)
        self.assertEqual(r['clh']['F|E12|50 Braza'], [['X', 3750, 3750, '50m'], ['A', 3974, 3842, '25m'], ['Y', 4000, 4000, '50m']])

    def test_sin_historial_usa_su_marca(self):
        a = nad('A', 2014, 3842)
        G.puestos_club([a], {}, {}, wr=WR)
        self.assertEqual(a['ev'][0]['cl'], {'hoy': [1, 1]})

    def test_devuelve_nombres_de_antiguos(self):
        a = nad('A', 2014, 3842)
        r = G.puestos_club([a], hist_de(a), {'F|E12|50 Braza|25m': [['X', 3700], ['A', 3900]]}, {'X': 'Ana Ruiz', 'A': 'Yo'}, wr=WR)
        self.assertEqual([x[:2] for x in r['clh']['F|E12|50 Braza']], [['X', 3828], ['A', 3974]])
        self.assertEqual(r['cln'], {'X': 'Ana Ruiz'})          # solo los que no son nadadores actuales

    def test_nombre_de_la_base_si_no_se_conoce(self):
        a = nad('A', 2014, 3842)
        base = {'F|E12|50 Braza|25m': [['X', 3700, 'Ana Ruiz'], ['Z', 3800, 'Eva Gil']], 'F|E12|50 Braza|50m': [['W', 4000]]}
        r = G.puestos_club([a], hist_de(a), base, {'Z': 'Eva Gil Mora'}, wr=WR)
        self.assertEqual(a['ev'][0]['cl']['hi'], [3, 4, 12])
        # `nombres` manda; si falta, el de la base; la entrada antigua sin nombre ([pid, cs]) sigue funcionando
        self.assertEqual(r['cln'], {'X': 'Ana Ruiz', 'Z': 'Eva Gil Mora'})


if __name__ == '__main__':
    unittest.main()

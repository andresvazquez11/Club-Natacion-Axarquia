import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import historial as H


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


if __name__ == '__main__':
    unittest.main()

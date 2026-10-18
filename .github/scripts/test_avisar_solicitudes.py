import unittest
from avisar_solicitudes import pendientes, cuerpo


class TestAvisos(unittest.TestCase):
    def test_solo_pendientes_sin_avisar_por_antiguedad(self):
        docs = [('admin@x.com', {'admin': True}), ('ok@x.com', {'aprobado': True}), ('fuera@x.com', {'bloqueado': True}),
                ('ya@x.com', {'avisado': True, 'alta': 1}), ('b@x.com', {'nombre': 'Bea', 'alta': 20}), ('a@x.com', {'nombre': 'Ana', 'alta': 10})]
        self.assertEqual([c for c, _ in pendientes(docs)], ['a@x.com', 'b@x.com'])

    def test_cuerpo(self):
        t = cuerpo([('a@x.com', {'nombre': 'Ana'})])
        self.assertIn('Una persona ha pedido acceso', t)
        self.assertIn('Ana — a@x.com', t)
        self.assertIn('/cronometro/', t)
        self.assertIn('2 personas han', cuerpo([('a@x.com', {}), ('b@x.com', {})]))


if __name__ == '__main__':
    unittest.main()

#!/usr/bin/env python3
"""
Descarga COMPLETA (sin límite top-100) de los rankings RFEN de la temporada 25-26
para los años de nacimiento 2010-2017, con provincia/federación de cada nadador.
Se guarda en RAW_2526/<genero>_<estilo>_<año>.json para el análisis de inicio de temporada 26-27.

Uso:  python3 descargar_2526_completo.py [--temporada 2627]
"""
import os, sys, json, time, warnings
warnings.filterwarnings('ignore')
import requests

API_URL  = 'https://apirfen.federatio.com/ranking'
API_AUTH = (os.environ['RFEN_USER'], os.environ['RFEN_PASS'])   # secretos del repo
TEMPORADA = sys.argv[sys.argv.index('--temporada') + 1] if '--temporada' in sys.argv else '2526'
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR  = os.environ.get('CNA_RAW_OUT', os.path.join(BASE_DIR, f'RAW_{TEMPORADA}'))
ESTILOS  = {'libre': '4', 'espalda': '5', 'braza': '3', 'mariposa': '7', 'estilos': '6'}
AÑOS     = range(2010, 2019)
CAMPOS   = ['profile_id', 'nombre', 'fecha_nacimiento', 'genero', 'club', 'provincia',
            'id_federacion', 'estilo', 'value', 'valor_original', 'record_mundo',
            'id_tipo_piscina', 'id_tipo_crono', 'competition_name', 'location', 'date', 'parcial',
            'id_competicion', 'posicion']


def llamar(estilo_id, genero, año):
    params = {
        'x_ESTILO': estilo_id, 'x_DISTANCIA': '', 'x_ID_TIPO_PISCINA': '',
        'x_ID_TIPO_CRONO': '', 'x_GENERO': genero, 'x_ID_TIPO_LICENCIA': '1',
        'x_TEMPORADA': TEMPORADA, 'x_ID_FEDERACION': '', 'x_ID_CLUB': '',
        'x_ANO_NACIMIENTO': str(año), 'x_ANO_NACIMIENTO_FIN': str(año),
        'x_ID_NACIONALIDAD': 'Todas', 'distinta': '1',
        'incluir_todas_distancias': 'true', 'incluir_todos_cronos': 'incluir_todos_cronos',
        'mejorMarca': 'true', 'NUM_RESULTADOS': '50000',
    }
    for intento in range(3):
        try:
            r = requests.get(API_URL, params=params, auth=API_AUTH, timeout=180)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            print(f'reintento {intento+1} ({e})', end=' ', flush=True)
            time.sleep(3)
    raise RuntimeError('fallo API')


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for año in AÑOS:
        for g in ('M', 'F'):
            for nombre, eid in ESTILOS.items():
                ruta = os.path.join(OUT_DIR, f'{g}_{nombre}_{año}.json')
                if os.path.exists(ruta):
                    continue
                print(f'{año} {g} {nombre}...', end=' ', flush=True)
                datos = llamar(eid, g, año)
                datos = [{k: d.get(k) for k in CAMPOS} for d in datos]
                with open(ruta, 'w', encoding='utf-8') as f:
                    json.dump(datos, f, ensure_ascii=False)
                print(len(datos))
                time.sleep(0.5)
    print('OK →', OUT_DIR)


if __name__ == '__main__':
    main()

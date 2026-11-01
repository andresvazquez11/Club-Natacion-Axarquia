"""¿Toca leer la FAN ahora? Lo pregunta el proceso «Directo FAN» antes de hacer nada pesado.
Cloudflare lo dispara cada 10 minutos de viernes a domingo, haya competición o no. Con competición (la de hoy, ayer o mañana)
se lee siempre; sin ella, solo en la pasada de cada hora (minutos 40 a 42: calendario, series y webs nuevas).
Imprime «si» o «no»; con --salida FICHERO lo escribe también como toca=si|no (GITHUB_OUTPUT)."""
import json
import os
import sys
from datetime import date, datetime, timedelta

VENTANA_HORARIA = range(40, 43)     # minuto de la pasada horaria (Cloudflare :40, entre semana :41)
MARGEN = timedelta(days=1)


def hay_competicion(directo, hoy):
    """¿Alguna competición empieza a lo sumo mañana y no terminó antes de ayer?"""
    for c in (directo or {}).get('competiciones', []):
        try:
            desde, hasta = date.fromisoformat(c['desde']), date.fromisoformat(c['hasta'])
        except (KeyError, ValueError, TypeError):
            continue
        if desde - MARGEN <= hoy <= hasta + MARGEN:
            return True
    return False


def toca(directo, ahora):
    """directo: contenido de directo.json (None si no se pudo leer); ahora: datetime en hora de Madrid."""
    if not directo or hay_competicion(directo, ahora.date()):
        return True
    return ahora.minute in VENTANA_HORARIA


def main(argv):
    try:
        directo = json.load(open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'directo.json'), encoding='utf-8'))
    except (OSError, ValueError):
        directo = None
    r = 'si' if toca(directo, datetime.now()) else 'no'
    print(r)
    if '--salida' in argv:
        with open(argv[argv.index('--salida') + 1], 'a') as f:
            f.write(f'toca={r}\n')


if __name__ == '__main__':
    main(sys.argv[1:])

#!/bin/bash
# Publica la versión nueva de cna-consola (los secretos y datos ya puestos se conservan). Lo ejecutas TÚ.
set -e
cd "$(dirname "$0")"
FW="$HOME/Desktop/CNA CLAUDE/cronometraje-automatico/consola-firmware/consola_crono/secrets.h"
echo "== Pruebas (con un Firestore simulado)"; TZ=Europe/Madrid node test.mjs
read -r -p "Voy a PUBLICAR la nueva versión de 'cna-consola' (entrenador elegido en la consola + enlace de familias con cron cada minuto). ¿Seguir? (s/N) " R
[ "$R" = "s" ] || { echo "Cancelado."; exit 0; }
npx wrangler deploy --keep-vars
URL=$(sed -n 's/.*CONSOLA_URL *"\(.*\)".*/\1/p' "$FW"); CLAVE=$(sed -n 's/.*CONSOLA_CLAVE *"\(.*\)".*/\1/p' "$FW")
sleep 3
echo -n "  /ping con clave (200): "; curl -s -o /dev/null -w "%{http_code}\n" -H "X-Clave: $CLAVE" "$URL/ping"
echo -n "  entrenadores: "; curl -s -H "X-Clave: $CLAVE" "$URL/equipos" | python3 -c "import json,sys; d=json.load(sys.stdin); print(', '.join(e['nombre'] for e in d['entrenadores']))"
echo "Hecho. Ahora sube el programa a la consola (consola-firmware/subir.sh)."

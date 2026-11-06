#!/bin/bash
# Publica el servicio cna-consola en Cloudflare, le pone sus secretos y deja la consola configurada.
# Lo ejecutas TÚ (inicias sesión en tu Cloudflare y das el visto bueno a publicar). Antes necesitas la clave de la
# cuenta de servicio de Firebase (ver LEEME.md, paso 1).   Uso:  ./configurar.sh
set -e
cd "$(dirname "$0")"
FW="$HOME/Desktop/CNA CLAUDE/cronometraje-automatico/consola-firmware/consola_crono"

echo "== 1/5  Cuenta de Cloudflare"
npx --yes wrangler whoami 2>&1 | grep -qi "logged in\|You are logged" || npx wrangler login

echo; echo "== 2/5  Clave de la cuenta de servicio de Firebase"
read -r -p "Arrastra aquí el archivo .json descargado y pulsa Intro: " SA
SA="${SA//\'/}"; SA="${SA% }"
[ -f "$SA" ] || { echo "No encuentro ese archivo."; exit 1; }
python3 -c "import json,sys; d=json.load(open(sys.argv[1])); assert d['type']=='service_account' and d['project_id']=='cronometro-cna', 'No es la clave del proyecto cronometro-cna'; print('Cuenta:', d['client_email'])" "$SA"

echo; echo "== Datos del entrenador (las sesiones de la consola salen a su nombre, para que la app y la página de las familias las recojan)"
read -r -p "Correo de Google con el que entras al cronómetro: " CORREO
read -r -p "Nombre del entrenador tal como sale en el cronómetro: " NOMBRE
[ -n "$CORREO" ] && [ -n "$NOMBRE" ] || { echo "Faltan datos."; exit 1; }

echo; echo "== 3/5  Publicar el servicio (queda sin clave: rechaza a todos hasta el paso 4)"
read -r -p "Voy a PUBLICAR 'cna-consola' en tu Cloudflare. ¿Seguir? (s/N) " R
[ "$R" = "s" ] || { echo "Cancelado."; exit 0; }
OUT=$(npx wrangler deploy --var "COACH_EMAIL:$CORREO" --var "COACH_NAME:$NOMBRE" 2>&1 | tee /dev/tty)
URL=$(printf %s "$OUT" | grep -o 'https://[A-Za-z0-9.-]*workers\.dev' | head -1)
[ -n "$URL" ] || { echo "No pude leer la dirección. Cópiala a mano en secrets.h."; exit 1; }

echo; echo "== 4/5  Secretos"
CLAVE=$(openssl rand -base64 48 | tr -d '/+=\n' | cut -c1-40)
printf %s "$CLAVE" | npx wrangler secret put CONSOLA_CLAVE
npx wrangler secret put FIREBASE_SA < "$SA"

echo; echo "== 5/5  Configurar la consola y comprobar"
mkdir -p "$FW"
printf '#define CONSOLA_URL   "%s"\n#define CONSOLA_CLAVE "%s"\n' "$URL" "$CLAVE" > "$FW/secrets.h"
chmod 600 "$FW/secrets.h"
echo "Escrito $FW/secrets.h"
sleep 3
echo -n "  sin clave (debe ser 401): ";  curl -s -o /dev/null -w "%{http_code}\n" "$URL/ping"
echo -n "  con clave (debe ser 200): ";  curl -s -o /dev/null -w "%{http_code}\n" -H "X-Clave: $CLAVE" "$URL/ping"
echo -n "  equipos y nadadores: ";       curl -s -H "X-Clave: $CLAVE" "$URL/equipos" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d['equipos']),'equipos,',len(d['nadadores']),'nadadores')"
echo; echo "Hecho. Ahora sube el programa a la consola (./subir.sh). Puedes BORRAR el .json de la cuenta de servicio de tu Mac."

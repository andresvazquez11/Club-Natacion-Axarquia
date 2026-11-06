# Servicio de la consola (cna-consola)

Intermediario entre la consola del cronómetro y Firestore (proyecto `cronometro-cna`). Se configura **una sola vez**.

## Rutas (todas piden la cabecera `X-Clave`)
| Ruta | Qué hace |
|---|---|
| `GET /ping` | Comprueba clave y conexión |
| `GET /equipos` | Equipos y nadadores, con los nombres **sin tildes** |
| `POST /sesion` | Guarda un entrenamiento y sus resultados (`sesiones` y `resultados`, con `origen: 'consola'`). Reenviar la misma sesión no duplica nada |

Solo existen esas tres rutas: aunque se pierda la consola, con su clave no se puede leer ni borrar nada más.

## Pasos (los que tienes que hacer tú)
1. **Cuenta de servicio de Firebase con permisos mínimos** (2 minutos, en el navegador):
   1. <https://console.cloud.google.com/iam-admin/serviceaccounts?project=cronometro-cna> → **Crear cuenta de servicio** → nombre `consola` → **Crear y continuar**.
   2. Rol: **Usuario de Cloud Datastore** (*Cloud Datastore User*) → **Listo**.
   3. Entra en la cuenta `consola` → pestaña **Claves** → **Agregar clave → Crear clave nueva → JSON**. Se descarga un `.json`.
2. En una terminal: `cd ~/Desktop/CNA-trabajo/consola-sync/consola-worker && ./configurar.sh`
   Te pide iniciar sesión en Cloudflare (si hace falta), el `.json` y un «sí» antes de publicar. Genera la clave de la consola, la guarda como secreto y escribe `secrets.h` en la carpeta del programa de la consola.
3. Sube el programa a la consola (`../../../CNA CLAUDE/.../consola-firmware/subir.sh`). En **AJUSTES** pon la WiFi y pulsa **SINCRONIZAR**.
4. Borra el `.json` de tu Mac.

## Seguridad
- La clave de la consola y la cuenta de servicio son **secretos de Cloudflare**; no están en el repositorio. La consola solo lleva su clave.
- Si se pierde una consola: `npx wrangler secret put CONSOLA_CLAVE` con otra clave y ya no entra.
- La cuenta de servicio solo tiene rol de Datastore (no administra el proyecto).
- El servicio valida todo lo que recibe: estilo, distancias, tiempos razonables, y que cada nadador sea del equipo indicado.

## Pruebas
`node test.mjs` (con un Firestore simulado; no toca internet).
**Sin probar todavía** contra la base real ni con la app de entrenadores: la primera sesión real conviene mirarla en la web (aparece con coach «Consola» y nota «Tomado con la consola») y borrarla si algo no cuadra.

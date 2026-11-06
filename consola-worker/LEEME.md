# Servicio de la consola (cna-consola)

Intermediario entre la consola del cronómetro y Firestore (proyecto `cronometro-cna`). Se configura **una sola vez**.

## Rutas (todas piden la cabecera `X-Clave`)
| Ruta | Qué hace |
|---|---|
| `GET /ping` | Comprueba clave y conexión |
| `GET /equipos` | Equipos y nadadores, con los nombres **sin tildes** |
| `POST /enlace` | Enlace de familias: **crear** (de un entrenador o de todos), **estado** y **cerrar** (borra la copia pública: el enlace deja de funcionar al instante). Caduca solo a las 6 h |
| `POST /ops` | Una operación de un entrenamiento: salida (crea la sesión), llegada (un tiempo), corregir (quita uno y pone otro), fin, o deshacer salida. La consola manda una por cada llegada, **al momento**. Cada operación usa los mismos ids: reenviar no duplica |

Solo existen esas tres rutas: aunque se pierda la consola, con su clave no se puede leer ni borrar nada más.

## Pasos (los que tienes que hacer tú)
1. **Cuenta de servicio de Firebase con permisos mínimos** (2 minutos, en el navegador):
   1. <https://console.cloud.google.com/iam-admin/serviceaccounts?project=cronometro-cna> → **Crear cuenta de servicio** → nombre `consola` → **Crear y continuar**.
   2. Rol: **Usuario de Cloud Datastore** (*Cloud Datastore User*) → **Listo**.
   3. Entra en la cuenta `consola` → pestaña **Claves** → **Agregar clave → Crear clave nueva → JSON**. Se descarga un `.json`.
2. En una terminal: `cd ~/Desktop/CNA-trabajo/consola-sync/consola-worker && ./configurar.sh`
   Te pide iniciar sesión en Cloudflare (si hace falta), el `.json`, tu correo y nombre de entrenador, y un «sí» antes de publicar. Genera la clave de la consola, la guarda como secreto y escribe `secrets.h` en la carpeta del programa de la consola.
3. Sube el programa a la consola (`../../../CNA CLAUDE/.../consola-firmware/subir.sh`). En **AJUSTES** pon la WiFi y pulsa **SINCRONIZAR**.
4. Borra el `.json` de tu Mac.

## Entrenador y enlace de familias, desde la consola
- **SESION → Entrenador:** la consola elige a nombre de quién salen las sesiones (lista de entrenadores aprobados de la base). Varios entrenadores pueden compartir la misma consola.
- **AJUSTES → ENLACE FAMILIAS:** eliges de quién son los entrenos (o todos) y ACTIVAR: sale un **QR** que las familias escanean en las gradas. DESACTIVAR borra la copia pública y el enlace deja de funcionar. Si no se desactiva, caduca a las 6 h.
- El servidor mantiene ese enlace al día él solo (al momento con cada llegada de la consola y cada minuto con lo que tomen los móviles): **ya no depende de ningún móvil**. La copia pública no lleva correos, solo nombres, series y tiempos, igual que la de la app.
- Publicar la versión nueva: `./publicar.sh` (te pide confirmar).

## Cómo llega a la página de las familias (enlace de la app, sin cambios)
La consola escribe en `sesiones` y `resultados` **a nombre del entrenador** (su correo) y con la marca `mod` que usa la app. La app del móvil del entrenador (si está abierta y con el enlace de las familias activo) ve esos tiempos en directo y actualiza la copia `directo_pub` que lee la página de las familias, igual que con los tiempos que toma ella misma. **Si el móvil tiene la app cerrada, la página de las familias no se actualiza.**

## Seguridad
- La clave de la consola y la cuenta de servicio son **secretos de Cloudflare**; no están en el repositorio. La consola solo lleva su clave.
- Si se pierde una consola: `npx wrangler secret put CONSOLA_CLAVE` con otra clave y ya no entra.
- La cuenta de servicio solo tiene rol de Datastore (no administra el proyecto).
- El servicio valida todo lo que recibe: estilo, distancias, tiempos razonables, y que cada nadador sea del equipo indicado.

## Pruebas
`node test.mjs` (con un Firestore simulado; no toca internet).
**Sin probar todavía** contra la base real ni con la app de entrenadores: la primera sesión real conviene mirarla en la web (aparece con coach «Consola» y nota «Tomado con la consola») y borrarla si algo no cuadra.

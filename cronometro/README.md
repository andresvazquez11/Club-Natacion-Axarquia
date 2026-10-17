# Cronómetro Natación · CN Axarquía

Cronómetro de entrenamiento para los entrenadores del Club Natación Axarquía.

- Salida común por tandas, llegada individual por nadador y parciales opcionales cada 50 m.
- Calles que se arman con tarjetas arrastrables y que se recuerdan para la siguiente sesión.
- Historial, evolución por nadador y exportación de resultados.
- Se instala en el móvil como una app ("Añadir a pantalla de inicio") y sigue funcionando con mala cobertura en la piscina.

Vive dentro de la web de estadísticas del club (carpeta `cronometro/` de este repositorio) y se publica con ella en **GitHub Pages**: <https://andresvazquez11.github.io/Club-Natacion-Axarquia/cronometro/>. Los datos de entrenamiento se guardan en **Firebase (Firestore)** —no en el repositorio— y solo entran las cuentas de Google dadas de alta como entrenadores.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La app completa |
| `firebase-config.js` | Configuración del proyecto de Firebase (no es secreta) |
| `firestore.rules` | Reglas de seguridad: quién puede leer y escribir |
| `manifest.webmanifest`, `sw.js`, `icons/` | Lo necesario para instalarla en el móvil y usarla sin conexión |
| `importar.html` | Herramienta para cargar los datos exportados del cronómetro anterior |
| `nadadores.json` | Lista ligera del club (licencia RFEN, nombre, categoría). Por ahora es una copia fija; la actualización diaria desde `pipeline/generar.py` está pendiente |

Los datos exportados del cronómetro anterior contienen nombres y tiempos de nadadores: se guardan fuera del repositorio (`~/Desktop/cronometro-natacion/datos-exportados/`) y nunca se suben.

## Puesta en marcha de Firebase (una sola vez)

1. Entra en <https://console.firebase.google.com> con la cuenta de Google del club y pulsa **Crear proyecto** (por ejemplo `cronometro-cna`). Google Analytics no hace falta.
2. **Authentication** → *Comenzar* → pestaña *Método de acceso* → **Google** → *Habilitar* → elige el correo de asistencia → *Guardar*.
3. **Authentication** → *Configuración* → *Dominios autorizados* → *Añadir dominio* → `andresvazquez11.github.io`.
4. **Firestore Database** → *Crear base de datos* → ubicación en Europa (por ejemplo `europe-southwest1`, Madrid) → *Modo de producción*.
5. **Firestore** → pestaña *Reglas* → borra lo que haya, pega el contenido de `firestore.rules` → *Publicar*.
6. **Firestore** → pestaña *Datos* → *Iniciar colección* → ID de colección `entrenadores` → ID de documento: **tu correo de Google en minúsculas** → añade los campos:
   - `admin` (boolean) = `true`
   - `nombre` (string) = tu nombre
7. ⚙️ **Configuración del proyecto** → *Tus apps* → icono **Web `</>`** → apodo `Cronómetro` (sin marcar Firebase Hosting) → *Registrar app*. Copia los valores de `firebaseConfig` en `firebase-config.js`.

## Unión con la web de estadísticas

- Cada nadador del cronómetro guarda su **licencia RFEN** (`rfen`), la misma con la que la web identifica su ficha.
- Desde la ficha de evolución del cronómetro, **Ver ficha de competición** abre `temporada.html#nadador/<licencia>` (la web de estadísticas).
- El administrador, en **👥 Entrenadores → Sincronizar con Estadísticas**, trae los nadadores nuevos, los cambios de categoría y empareja por nombre a los que aún no tengan licencia. No borra a nadie.
- Pendiente: acceso **Cronómetro (entrenadores)** en el menú de la web de estadísticas.

## Migrar los datos del cronómetro anterior

1. Abre `https://andresvazquez11.github.io/Club-Natacion-Axarquia/cronometro/importar.html` y entra con tu cuenta (la que tiene `admin: true`).
2. Elige `~/Desktop/cronometro-natacion/datos-exportados/cronometro-export.json` (ya trae las licencias RFEN de los 121 nadadores). Por defecto se omiten los datos de prueba (`demo_…`).
3. Pulsa **Importar**. Se puede repetir sin duplicar nada.

## Dar acceso a otros entrenadores

En la app, el administrador ve el botón **👥 Entrenadores** en la pantalla principal y desde ahí añade o quita correos de Google. Solo esas cuentas pueden entrar.

## Publicar cambios

Al modificar la app, sube también la versión en `sw.js` (`const VERSION = 'crono-v2'`, etc.) para que los móviles que la tienen instalada descarguen la nueva versión.

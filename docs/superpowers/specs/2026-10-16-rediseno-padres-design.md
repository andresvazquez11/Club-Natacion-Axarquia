# Rediseño de la web del CNA: pensada para el padre, más estética y a pocos toques

Fecha: 2026-10-16 · Página: `club.html` (https://andresvazquez11.github.io/Club-Natacion-Axarquia/club.html)
Sistema visual: [`DESIGN.md`](../../../DESIGN.md) (colores, tipografía, iconos, fotos). Este documento dice **qué** se construye; `DESIGN.md` dice **cómo se ve**.
Bocetos aprobados en `.superpowers/brainstorm/18807-1792140059/content/` (`resumen-hijo.html`, `mapa.html`, `modos-v2.html`, `detalles-v3.html`, `fotos-v2.html`; para Club vale la foto de `fotos-ejemplos.html`).

## Por qué

La web tiene **toda** la información que hace falta y eso se queda. Los problemas son dos:

1. **Cuesta llegar a las cosas.** Hasta el responsable se pierde: muchas secciones y pestañas, páginas muy largas. Ejemplos reales: los relevos de su hijo, su puesto dentro del club y cuánto le falta para la mínima del Cto. de España llevan "un tiempo" (hoy están escondidos en la pestaña "Objetivos", tras mucho scroll).
2. **Se ha quedado atrás en lo estético.** Usa emojis y el modo acuático actual queda cargado, poco legible y "aniñado" para datos serios.

Quien más la usa es **un padre en el móvil que quiere ver a su hijo**. El entrenador la usa con una mirada general del club.

## Objetivos

- Al abrir, el padre ve **el resumen de su hijo**: lo bueno primero, luego lo que mejorar, luego sus últimas competiciones.
- **Cualquier dato del hijo a 1 toque** desde su pantalla; cualquier dato de la web a 2–3 toques como mucho.
- Que se sienta **natación de verdad y seria**: agua, fotos reales del club, iconos sobrios.
- Todo **legible** en los dos modos.

## No objetivos

- No se quitan datos ni cálculos (rankings, puntos AQUA, mínimas, clasificación al Cto. de Andalucía, relevos, récords, historia, comparar). Solo cambia **dónde están y cómo se presentan**.
- No cambia el origen de los datos (RFEN) ni el proceso de actualización.
- No hay fotos por nadador ni cuentas de usuario.

## Antiobjetivos (sería un fracaso aunque funcione)

- Que parezca infantil o de dibujos.
- Texto difícil de leer sobre agua o fotos.
- Que un dato que hoy existe deje de encontrarse.
- Confundir **ranking** (puesto que cambia cada semana) con **campeonato** (resultado de una competición).
- Fotos donde se reconozca la cara de un nadador en una pantalla que no es la suya ("Mi nadador" es igual para todos).

## Restricciones

- La web se genera: fuentes en `pipeline/web/` (`plantilla.html`, `estilos.css`, `comunes.js`, `agua.js`, `app.js`, `graficos.js`, `vistas/*.js`) → `pipeline/generar.py` → `club.html` (un solo archivo con los datos incrustados, ~7,6 MB). Publicada en GitHub Pages: todo estático, sin servidor.
- Las rutas son por `#hash` (`route()` en la plantilla). Enlaces antiguos deben seguir funcionando (ya hay redirecciones de pestañas antiguas en `vistaFicha`; mantener ese criterio).
- "Mi nadador" ya existe como estrella guardada en el dispositivo (`ESTRELLA_LS`, ruta `#benicio`, `vistaElegir`). El modo se guarda en `localStorage` `cna_modo`.
- Móvil primero; también debe verse bien en escritorio.
- Fotos optimizadas (≤ 200 KB, ~1400 px); sin fuentes externas.

## Lo decidido

### Mapa: 4 secciones + buscador

Barra inferior (móvil) / lateral (escritorio): **Mi nadador · Club · Campeonatos · Rankings**. Buscador de nadadores siempre arriba.

| Hoy | Pasa a |
|---|---|
| Inicio | se reparte: números del club y "Esta semana" → **Club**; "Elige a tu hijo" → **Mi nadador** |
| Club (Nadadores, Relevos, Récords, Historia) | **Club**, con portada y los 4 como accesos |
| Campeonatos | **Campeonatos**, igual de contenido, con portada |
| ⭐ Mi nadador / Benicio (Resumen, Pruebas, Evolución, Ranking, Objetivos, Comparar) | **Mi nadador**: resumen + 8 accesos directos |
| Rankings | **Rankings**, igual, pero abierto ya en el sexo y año del hijo elegido |

### Mi nadador (pantalla principal del padre)

De arriba abajo:

1. **Portada** con la foto genérica (gorro del CNA de espaldas, sin cara), igual para todos. Encima, fundido: avatar con iniciales (aro amarillo), antetítulo "Mi nadador/a", nombre, categoría · nº pruebas, botón **Cambiar**.
2. **Logros** en fila deslizable: podios en campeonatos (relleno, oro/plata/bronce) y top de ranking España/Andalucía y nº1 de Málaga (borde fino). Mismo criterio que los `logros` actuales de `vistaFicha`.
3. **Su mejor momento:** la marca más destacada, grande, con cuánto ha mejorado, la prueba (con franja de color de estilo), piscina y fecha, y sus puestos en España / Andalucía / Málaga.
4. **Dónde destaca:** frases cortas en lenguaje normal, en positivo.
5. **Para seguir mejorando:** frases cortas sobre **datos** (mínimas que faltan, pruebas sin nadar, pruebas de menos nivel), en tono animador. No sobre técnica.
6. **Accesos directos (1 toque cada uno):** Marcas · Evolución · Rankings · Cto. España · Cto. Andalucía · Sus relevos · En el club · Comparar.
7. **Últimas competiciones** (3), con el nivel marcado y un enlace a todas sus marcas.

Las frases de 4 y 5 salen de la función `analisis(s)` que ya existe (puntos fuertes / a mejorar); se reescriben como frases más cortas y se eligen las más relevantes (máx. 3 por bloque).

Los accesos llevan a lo que hoy existe:

| Acceso | Contenido actual que muestra |
|---|---|
| Marcas | pestaña Pruebas |
| Evolución | pestaña Evolución (historial) |
| Rankings | pestaña Ranking de la ficha (dónde está hoy + semana a semana) |
| Cto. España | mínimas del Cto. de España (hoy dentro de Objetivos). Solo si aplica a su categoría |
| Cto. Andalucía | "¿Entra en el Cto. de Andalucía?" (hoy dentro de Objetivos). Solo si aplica |
| Sus relevos | **nuevo enfoque**: los relevos de **su categoría**; si él entra en alguno, aparece destacado; si no, se muestra **cuánto le falta** para quitarle el puesto al más lento de ese relevo |
| En el club | **nuevo**: por cada prueba que ha nadado, dos datos. **Hoy:** su puesto entre los nadadores del CNA de su mismo sexo y año ("2º de 6 del CNA nacidos en 2014 en 50 Braza"). **Histórico:** dónde quedaría su mejor marca entre todas las marcas de nadadores del CNA de su mismo sexo **a la misma edad**, desde la temporada 13-14 ("4ª mejor marca del CNA a los 12 años"). Datos: historial del club (`historial_base.json.gz`, por temporada y nadador). Misma piscina que la marca comparada |
| Comparar | comparar con otros nadadores (ya existe) |

Los accesos que no aplican a ese nadador no se muestran (como hoy la pestaña Objetivos).

**Dónde va el resto del Resumen actual** (nada desaparece):

| Hoy en el Resumen (`tabResumen`, `pintarAnalisis`) | Pasa a |
|---|---|
| 8 KPI con su ventana de detalle (`abrirKpiFicha`) | sus datos alimentan "Logros" y "Su mejor momento"; las ventanas de detalle se abren desde ahí |
| "Próximos objetivos" | dentro de "Para seguir mejorando" |
| "Perfil" por estilo y distancia, "Actividad" (pruebas por mes) y la lista completa de competiciones | dentro de **Marcas** |
| "Su evolución" y "Comparado con los demás" (historial.json) | dentro de **Evolución** |

**La ficha de cualquier otro nadador** (buscador, Club → Nadadores, Rankings: `#nadador/<id>`) usa **la misma pantalla** que "Mi nadador": misma portada genérica, logros, mejor momento y accesos. En lugar de "Cambiar" muestra "Marcar como mi nadador". En la barra se ilumina la sección desde la que se llegó (Club o Rankings).

Si todavía no hay nadador elegido, "Mi nadador" muestra el selector (`vistaElegir`) con la misma estética.

### Club (vista general / entrenador)

Portada con foto (mariposa de frente con el gorro del CNA), título "Club Natación Axarquía" y fecha de actualización; "El club en números" (los KPI que hoy están en Inicio); "Esta semana"; accesos: Nadadores · Relevos · Récords · Historia. El resto de bloques de Inicio (últimos top-10, el club frente a otros clubes, nadadores por categoría, últimas mejores marcas) quedan dentro de Club, debajo.

### Campeonatos y Rankings

Mismo contenido que hoy, con portada de foto (Campeonatos: el agua rompiendo) y la nueva estética. Rankings abre en el sexo y año del hijo elegido.

### Estética

Todo según `DESIGN.md`:

- **Modo por defecto "Agua clara"**; el botón cambia al **modo acuático nuevo** (sustituye al actual de `agua.js`): agua más real (azulejos que se doblan con el agua, reflejos finos, línea negra del carril o foto real de agua), **sin gotas ni corcheras de colores**, y datos siempre sobre paneles oscuros casi opacos.
- Logo real del CNA (`logo_cna.png`). Amarillo del logo como único acento.
- Iconos de línea propios en vez de emojis, en toda la web.
- Estilos: franja de color, sin icono.
- Niveles: bandera de España, bandera de Andalucía, punto azul + "Málaga".
- Ranking (borde fino + barras) ≠ Campeonato (relleno + copa, oro/plata/bronce si es podio).

### Fotos

De la carpeta `~/Desktop/fotos entreno CNA/` (uso aprobado por el club):

| Uso | Archivo |
|---|---|
| Mi nadador (genérica, sin cara) | `WhatsApp Image 2026-05-17 at 18.32.30 (2).jpeg` |
| Club | `WhatsApp Image 2026-05-17 at 18.31.04.jpeg` |
| Campeonatos | `WhatsApp Image 2026-05-17 at 18.29.36 (1).jpeg` |
| Fondo del modo acuático (agua, sin personas) | `WhatsApp Image 2026-05-17 at 18.30.05.jpeg` |
| Reserva (Rankings u otras portadas) | `… 18.30.04.jpeg` (crol, gorro), `… 18.29.36.jpeg` (braza, gorro), `… 18.30.36 (1).jpeg` (mariposa) |

### Otras decisiones

- **Un solo nadador guardado** por dispositivo (como hoy, `ESTRELLA_LS`). "Cambiar" vuelve al selector.
- **Insignias:** se mantienen, **rediseñadas** con iconos de línea y la estética nueva (sin emojis). Van en "Mi nadador", debajo de las últimas competiciones.
- **Manual de uso:** fuera de este trabajo. Se rehace cuando el rediseño esté confirmado. Mientras tanto, el enlace "Manual de uso" sigue en la cabecera o el pie.

## Lo que queda al constructor

- Distribución en escritorio (barra lateral, ancho máximo, columnas), siempre que se respeten las 4 secciones y la jerarquía de "Mi nadador".
- Dibujo final de los iconos de línea (la familia está en `DESIGN.md`; los bocetos tienen una primera versión).
- Textos exactos de las frases de "Dónde destaca" / "Para seguir mejorando" y qué 3 elegir, siempre en positivo y sobre datos.
- Cómo se implementa el agua del modo acuático (SVG/canvas o foto real), cumpliendo legibilidad y `prefers-reduced-motion`.
- Animaciones y transiciones (sobrias).
- Cómo mantener los enlaces antiguos (`#inicio`, `#benicio`, `#nadador/…/objetivos`, etc.) redirigiendo a su nuevo sitio.

### Decisiones mías (a revisar)

- Si no hay nadador elegido, la web abre en **Club** (vista general); con nadador elegido abre en **Mi nadador**.
- Tipografía del sistema (sin fuentes externas), como hoy.
- Fotos de portada solo en móvil y escritorio como cabecera; nunca detrás de tablas.
- "En el club" compara marcas **de la misma piscina** (25 m con 25 m, 50 m con 50 m); "a la misma edad" = misma edad de temporada que usa la RFEN (año de la temporada − año de nacimiento).
- La ficha de cualquier nadador usa la misma pantalla que "Mi nadador".
- El resto del Resumen actual se reparte entre Marcas y Evolución (tabla de arriba).

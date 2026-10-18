# Cronómetro: nuevo inicio, reloj de sesión y mejoras de piscina

Fecha: 18 oct 2026 · App: `cronometro/index.html` (un solo archivo, JS sin dependencias, Firebase)

## Por qué

El entrenador usa el móvil con una mano, en la piscina. Hoy el inicio enseña la lista de equipos del club, con la que no puede hacer nada útil. Los cuatro botones de arriba (Historial, Evolución, Estadísticas, Entrenadores) confunden, sobre todo Estadísticas frente a Historial. El flujo real es: colocar a los nadadores en las calles, empezar, tomar tiempos y ver al final un resumen de lo que se hizo. Al día siguiente, decidir si se repite o se cambia.

Éxito: al abrir la app, en un toque empieza el entreno o ve qué se hizo ayer. Encuentra un entreno antiguo por estilo y distancia. Durante la sesión sabe cuánto tiempo llevan nadando.

Anti-objetivos (sería un fracaso aunque funcione):
- Más toques que hoy para empezar una sesión.
- Que algo de lo nuevo estorbe o tape los botones de SALIDA y llegada.
- Perder o mezclar datos reales con los de simulación.
- Romper la web de estadísticas, que lee las mismas colecciones.

## 1. Navegación: barra de pestañas abajo (decidido: opción A)

Una barra fija abajo con cuatro pestañas: **Entrenar · Historial · Nadadores · Web club**. Se oculta en la pantalla de tomar tiempos (`en-curso`) y en la de preparar calles, para no restar espacio.

- **Web club** abre `../temporada.html#mi`. Sustituye a «Estadísticas».
- Desaparecen los botones de arriba. El menú «⋯» arriba a la derecha guarda: Entrenadores (solo administradores, con el aviso 🔔 de solicitudes), cambiar nombre y Salir.
- El aviso 🔔 de solicitudes pendientes sigue visible en Entrenar para el administrador.

## 2. Pestaña Entrenar (el inicio)

De arriba abajo:
1. «Hola, {nombre}» y la fecha de hoy.
2. Botón grande **▶ Nuevo entrenamiento**, con una línea que dice qué calles va a usar (la plantilla de la última vez, como hoy hace `plantillaUsable()`).
3. Si hay entrenos preparados (punto 6): una lista corta «Preparados», y al tocar uno se empieza con él.
4. Tarjeta **Último entrenamiento** del entrenador:
   - Grupo, día y hora.
   - Las **pruebas por series, bien visibles** (pedido expreso): «Serie 1 · Libre 50 — Serie 2 · Espalda 50 — Serie 3 · Libre 100».
   - Series, nadadores, tiempos, y tiempo nadando (punto 4).
   - Mejor del día (el tiempo más rápido de la prueba más nadada) y cuántos mejoraron su mejor marca de entreno.
   - Botón **Repetir este entreno**: arranca con las mismas calles y con la prueba de la serie 1. Si ese entreno estaba preparado como plan, repite el plan entero.
   - Al tocar la tarjeta se abre el resumen completo que ya existe (`renderResultados`, con su PDF).
5. Se quita la lista de equipos del club y «Mis grupos» del inicio. Crear o borrar grupos propios pasa a la pestaña Nadadores.

## 3. Pestaña Historial

- Filtros arriba con chips de **estilo** (Libre, Espalda, Braza, Mariposa) y de **distancia** (las de `DISTS`). Se combinan.
- Sin filtros, la lista muestra **entrenos completos**, separados por meses («Octubre 2026»). Cada fila empieza por la **fecha completa y destacada** (pedido expreso): «Viernes 17 oct 2026 · 17:30». Debajo van el grupo, las pruebas por series, la duración y la etiqueta «Simulación» si la tiene.
- Con un filtro, la lista muestra **solo las series que coinciden**, no el entreno entero (confirmado). Cada fila es «Viernes 17 oct · Alevín · Serie 2 · Espalda 50», con los tiempos de esa serie ordenados del más rápido al más lento y una 🏅 a quien mejoró. Un toque abre el entreno completo.
- Alcance: los entrenos del propio entrenador, como hoy (`mySes()`). La web de estadísticas ya muestra los de todos los entrenadores en la ficha de cada nadador; eso se mantiene.

## 4. Reloj de sesión (tiempo nadando)

En la pantalla de tomar tiempos, arriba y grande, un reloj que **suma solo el tiempo en el agua** (confirmado):
- En cada serie arranca con la primera SALIDA y se para cuando llega el último nadador de esa serie (cuando `rondaTerminada()` pasa a verdadero).
- En el descanso entre series se queda quieto y en gris. Con la primera SALIDA de la siguiente serie sigue sumando desde donde lo dejó.
- Deshacer una llegada que reabre la serie vuelve a ponerlo en marcha desde la hora de esa llegada deshecha.
- Se guarda en la sesión (`nadandoMs`, y por serie `series[ronda].ms` o equivalente) y sale en el resumen, en el PDF, en el texto exportado y en la tarjeta del inicio.
- Las sesiones antiguas, que no lo tienen, lo calculan si se puede (de la primera salida a la última llegada de cada serie, a partir de los resultados). Si no se puede, no se muestra.

## 5. Marca en el momento

Al registrar una llegada, se compara al instante con:
- su **mejor tiempo de entreno** anterior en la misma prueba (`mejorEntrenoPrevio`), y
- su **mejor marca de competición** en equivalente de 25 m (`mejorCompeticion`).

Si lo mejora, la fila del nadador lo indica con 🏅 y un texto corto («mejor entreno» o «¡marca de competición!»). La tarjeta del recién llegado lo muestra el tiempo que sigue en su sitio (`RECIENTE_MS`), y la fila de Llegados lo conserva. Vibración un poco más larga. Nunca tapa los botones.

## 6. Preparar el entreno en casa (planes)

- Desde Entrenar, «Preparar entreno»: grupo, calles (el mismo tablero de tarjetas arrastrables), y una lista de series con estilo, distancia, parciales y, si se quiere, ciclo (punto 7) y repeticiones.
- Se guarda como **plan** en una colección nueva `planes`. Hay que añadirla a las reglas de Firestore, a `limpiarDoc` y a la lista de colecciones del importador.
- En la piscina, al empezar desde un plan, la pantalla de fin de serie ofrece **«Siguiente serie: Espalda 50»** en un toque, en lugar del formulario de nueva serie. Se puede cambiar o saltar.
- El plan no se borra al usarse, así sirve para repetirlo.

## 7. Salidas por ciclo

Para series tipo «4×50 salida cada 1:10»:
- Al preparar la serie (en el plan o en la nueva serie) se puede poner un **ciclo** en segundos.
- Tras la primera SALIDA, en la tarjeta de salida se ve una cuenta atrás hasta la siguiente. A los 5 s suena un pitido corto y en 0 un pitido largo y vibración (Web Audio, sin archivos).
- **Interruptor «Salida automática»** (decidido por el entrenador) junto al campo del ciclo, en la nueva serie y en el plan, y también accesible durante la serie:
  - **Encendido:** al llegar a 0 la SALIDA se registra sola, con la hora exacta del 0, para los nadadores que tocan (respeta «no sale»). Pitido largo y vibración. La siguiente cuenta atrás empieza sola, hasta que no quede nadie por salir.
  - **Apagado (manual):** solo suenan los avisos y el entrenador toca SALIDA como hoy. La cuenta atrás se reinicia desde cada SALIDA tocada.
  - Por defecto, apagado. Se recuerda la última elección.
- Mientras corre una salida automática, un botón visible **Pausar ciclo** la detiene (por ejemplo, si alguien se retrasa) y pasa a manual.

## 8. Notas rápidas por nadador

- Un toque largo en la tarjeta o en la fila de un nadador (en el agua o en Llegados) abre un campo corto («viraje lento»).
- Se guarda en el resultado de esa serie (campo `nota`, máximo 200 caracteres, escapado al pintarlo). Si el nadador aún no ha llegado, se guarda al llegar.
- Sale en el resumen, en el PDF y en la ficha de entrenos del nadador de la web de estadísticas (`pintarEntrenosNadador`), que solo ven los entrenadores.

## 9. Pantalla siempre encendida

Ya existe (`pedirWakeLock` en la pantalla de tomar tiempos y al volver a la app). Comprobar que también se pide en preparar calles y durante la cuenta atrás del ciclo, y mostrar un aviso discreto si el móvil no lo permite.

## 10. Asistencia

- Al empezar, todos los nadadores colocados en calles cuentan como **presentes**.
- En la pantalla de preparar y en el resumen hay una lista «¿Quién más vino?» con los demás del grupo, para marcar a quien vino aunque no nade ninguna serie (lesionado, solo técnica).
- Se guarda en la sesión como `presentes: [nId]`. La web de estadísticas (`entGrupo`) pasa a calcular la asistencia con `presentes` cuando existe, y con los tiempos cuando no.

## 11. Pestaña Nadadores

- Chips de categoría arriba (de `nadadores.json`/equipos del club), con la última elegida recordada.
- Lista de nadadores con el número de entrenos. Al tocar uno se abre su evolución: la pantalla actual `evolucion-nad`, más un enlace a su ficha completa en la web (`../temporada.html#nadador/<rfen>/entrenos`).
- Abajo, «Mis grupos propios»: crear y borrar, lo que hoy está en el inicio.

## Restricciones

- Todo sigue en `cronometro/index.html`, sin dependencias nuevas, con el estilo y el código que ya tiene.
- Datos de menores: nada de nombres en el repositorio ni en archivos de prueba que se suban.
- Lo que se pinta desde Firestore se escapa siempre (`esc`). Los campos nuevos se normalizan en `limpiarDoc` (números como números, textos recortados).
- La simulación sigue marcada y se puede borrar sin tocar lo real. Los campos nuevos de la sesión no deben perder `sim`.
- Subir la versión del service worker (`sw.js`) en cada publicación.
- La web de estadísticas solo cambia en lo justo: notas y asistencia (puntos 8 y 10). Sus tests deben seguir pasando y se añaden los de lo nuevo.

## Decisiones mías (revisables)

- La barra de pestañas se oculta al tomar tiempos y al preparar calles.
- «Mejor del día» = el tiempo más rápido de la prueba más nadada en ese entreno.
- El Historial sigue mostrando solo los entrenos propios. Los de todos se ven en la web.
- Los planes son personales de cada entrenador.
- La asistencia por defecto = quien está en una calle.
- Las notas las ven todos los entrenadores aprobados, igual que los tiempos.

## Lo que queda a quien lo construya

El diseño visual concreto (siguiendo el estilo oscuro actual y el boceto A), los nombres de funciones, cómo partir el trabajo en pasos y en qué orden publicarlo.

- El tiempo que se fija con el ciclo es el tiempo **entre salidas** dentro de una serie («cada 1:10»).
- La salida automática empieza apagada y se recuerda la última elección. Siempre hay un botón para pausarla.

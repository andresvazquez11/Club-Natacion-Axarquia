# Cronómetro: nuevo inicio, reloj de sesión y mejoras — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehacer la navegación del cronómetro (pestañas abajo, inicio con el último entreno, Historial filtrable por series, pestaña Nadadores) y añadir reloj de tiempo nadando, marca en el momento, salidas por ciclo con modo automático, planes preparados, notas por nadador y asistencia.

**Architecture:** La app sigue siendo `cronometro/index.html` (JS plano, Firebase compat). La lógica nueva sin DOM va a un archivo nuevo `cronometro/logica.js`, cargado con `<script src>` antes del script principal y probado con `node --test` en un contexto vm, igual que hace la web de estadísticas con `pipeline/web/tests/cargar.mjs`. La web de estadísticas solo cambia para notas y asistencia.

**Tech Stack:** JS sin dependencias, Firebase compat 10.12.2 (Firestore), Web Audio, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-18-cronometro-inicio-y-mejoras-design.md`

## Global Constraints

- Todo sin dependencias nuevas. Nada de nombres de nadadores reales en el repositorio ni en tests (usar «Ana», «Beto», ids inventados).
- Todo lo que viene de Firestore se pinta con `esc()` (cronómetro) o `esc()` de `comunes.js` (web).
- Campos nuevos normalizados en `limpiarDoc` al leer: números finitos o `null`, textos recortados a 200 caracteres, listas de ids solo con `/^[A-Za-z0-9_-]{1,64}$/`.
- No se pierde `sim: true` de una sesión: las escrituras nuevas sobre `sesiones` usan `update()` con campos concretos, nunca `set()` del documento entero.
- `cronometro/sw.js`: subir `VERSION` (`crono-v7` en la primera publicación) y añadir `'logica.js'` a `CARCASA`.
- La barra de pestañas no aparece en las pantallas `preparar` ni `en-curso`.
- Tests de la web: `node --test pipeline/web/tests/*.test.mjs` (hoy 54 en verde) deben seguir en verde, incluido el de «sin emojis» de la web.
- Tests del cronómetro: `node --test cronometro/tests/*.test.mjs`.
- Simulación: los datos de prueba siguen marcados y el borrado del importador no se toca, salvo para añadir la colección `planes` a lo que borra por `sim_`.

## Review Focus

1. **Recargar la página a mitad de entreno:** el reloj nadando debe recuperarse de `ses.nado` y no ponerse a cero ni contar el descanso. Test: `msNadando` con tramos abiertos y cerrados (Task 1); en la Task 4, al reconstruir `SA` se leen los tramos de la sesión.
2. **Salida automática con «no sale» o calles ya vacías:** al llegar a 0 no debe salir nadie que esté marcado «no sale», y cuando no quede nadie por salir el ciclo se para solo. Test: `cicloEstado` con `quedan=false` devuelve `toca:false` (Task 1); comprobación manual en la Task 6.
3. **Deshacer la última llegada de una serie ya terminada:** el reloj vuelve a correr desde el inicio del tramo (su `fin` vuelve a `null`). Test: `cerrarTramo`/`reabrirTramo` (Task 1).
4. **Filtro del Historial con sesiones antiguas sin estilo en cada tiempo:** las series deben salir con el estilo y la distancia de la sesión (como hace `resCombo`). Test: `seriesFiltradas` con un resultado sin `estilo` (Task 1).
5. **Notas con HTML o muy largas:** se recortan a 200 y se escapan en el cronómetro, en el PDF y en la web. Test: `limpiarDoc('resultados', {nota:'<b>'+'x'.repeat(300)})` (Task 1) y `entTiempos` con nota (Task 8).

---

### Task 0: Banco de pruebas visual (solo en scratchpad, nunca se sube)

**Files:**
- Create (scratchpad, fuera del repo): `<scratchpad>/crono-local/` con una copia de `cronometro/` y un `firebase-mock.js` que sustituye a los tres scripts de gstatic.

- [ ] **Step 1:** El mock imita lo que usa la app: `firebase.initializeApp`, `firebase.auth()` (usuario fijo aprobado y admin, `onAuthStateChanged`, `signOut`), `firebase.firestore()` con `collection(c).doc(id?)` → `{id, set, update, delete, get, onSnapshot}`, `collection(c).onSnapshot`, `.get()`, `batch()` y `enablePersistence()`. Datos en memoria, con 2 equipos, 8 nadadores inventados y 3 sesiones con tiempos de dos estilos.
- [ ] **Step 2:** Un `index.html` del scratchpad carga `firebase-mock.js` en lugar de gstatic. Añadir una entrada temporal a `.claude/launch.json` (`python3 -m http.server`) y abrirla con `preview_start`.
- [ ] **Step 3:** Comprobar que la app actual arranca y que se ve el inicio de hoy. Esta copia se refresca desde `cronometro/` al final de cada tarea para revisarla a simple vista.

### Task 1: `logica.js` con las funciones puras y sus tests

**Files:**
- Create: `cronometro/logica.js`
- Create: `cronometro/tests/cargar.mjs` (como `pipeline/web/tests/cargar.mjs`, cargando desde `cronometro/`)
- Create: `cronometro/tests/logica.test.mjs`
- Modify: `cronometro/index.html` (quitar `limpiarDoc` de la línea ~298; añadir `<script src="logica.js"></script>` tras `firebase-config.js`)
- Modify: `cronometro/sw.js` (`CARCASA` + `'logica.js'`)

**Interfaces (Produces):**
- `limpiarDoc(col: string, d: object) -> object` — lo de hoy, más:
  - sesiones: `nado` → lista de `{r:int>0, ini:number, fin:number|null}` (descarta entradas inválidas); `presentes` → lista de ids válidos; `planId` → id válido o `null`.
  - resultados: `nota` → texto ≤200 o `null`.
  - planes: `nombre` ≤200; `eqId` id o `null`; `calles` → `[{nombre ≤200, nIds:[id]}]`; `series` → `[{estilo∈ESTILOS|null, dist:num|null, parciales:bool, ciclo:int seg|null, auto:bool}]`.
- `msNadando(tramos: {ini, fin|null}[], ahora: number) -> number` — suma de `(fin ?? ahora) - ini`.
- `abrirTramo(tramos, r, t) -> tramos` (nuevo `{r, ini:t, fin:null}` solo si la ronda `r` no tiene tramo).
- `cerrarTramo(tramos, r, t) -> tramos` (pone `fin=t` al tramo de `r`).
- `reabrirTramo(tramos, r) -> tramos` (pone `fin=null` al tramo de `r`).
- `cicloEstado(tUlt: number, cicloS: number, ahora: number, quedan: boolean) -> {restaMs:number, aviso:boolean, toca:boolean}` — `aviso` cuando quedan ≤5000 ms y >0; `toca` cuando `restaMs<=0 && quedan`.
- `seriesFiltradas(sesiones, resultados, {estilo, dist}) -> [{ses, ronda, estilo, dist, res:[resultados ordenados por ms]}]` — una entrada por (sesión, ronda) que encaja con el filtro; estilo y distancia de cada resultado como `resCombo` (si no tiene, los de la sesión); ordenado por `ses.fecha` descendente.
- `porMes(sesiones) -> [{clave:'2026-10', titulo:'Octubre 2026', sesiones:[...]}]`, de más reciente a más antiguo.
- `fechaLarga(ts) -> 'Viernes 17 oct 2026 · 17:30'`.
- `marcaDe(c: {difComp, difEnt}) -> 'comp'|'entreno'|null` — `'comp'` si `difComp<0`, si no `'entreno'` si `difEnt<0`.

- [ ] **Step 1: Write the failing tests** in `cronometro/tests/logica.test.mjs`:
  - `msNadando([{ini:0,fin:60000},{ini:100000,fin:null}], 130000) === 90000`
  - `cerrarTramo(abrirTramo([],1,1000),1,61000)` → `[{r:1,ini:1000,fin:61000}]`; `abrirTramo` dos veces en la misma ronda no duplica; `reabrirTramo(...,1)[0].fin === null`.
  - `cicloEstado(0, 70, 66000, true)` → `{restaMs:4000, aviso:true, toca:false}`; `cicloEstado(0,70,70000,true).toca === true`; `cicloEstado(0,70,70000,false).toca === false`.
  - `seriesFiltradas`: sesión `s1` libre 50 con un resultado sin estilo (ronda 1) y otro espalda 50 (ronda 2); el filtro `{estilo:'libre', dist:50}` devuelve solo `[s1, ronda 1]`; `{estilo:'espalda'}` sin distancia devuelve la ronda 2; los tiempos salen ordenados de menor a mayor.
  - `porMes` con sesiones de octubre y septiembre → `['Octubre 2026','Septiembre 2026']`.
  - `fechaLarga(new Date(2026,9,17,17,30).getTime()) === 'Viernes 17 oct 2026 · 17:30'`.
  - `marcaDe({difComp:-0.2,difEnt:-1}) === 'comp'`, `marcaDe({difComp:0.5,difEnt:-0.1}) === 'entreno'`, `marcaDe({difComp:null,difEnt:null}) === null`.
  - `limpiarDoc('resultados', {nota:'<b>'+'x'.repeat(300), ronda:'2'}).nota.length === 200`; `limpiarDoc('sesiones', {nado:[{r:1,ini:5,fin:null},{r:'x'}], presentes:['a','<x>'], sim:true})` → `nado` con 1 tramo, `presentes:['a']`, y `sim` sigue siendo `true`.
- [ ] **Step 2:** Run `node --test cronometro/tests/*.test.mjs` → FAIL (no existe `logica.js`).
- [ ] **Step 3:** Implementar `logica.js` (mueve `ESTILOS` allí si `limpiarDoc` lo necesita y dejarlo accesible como global, sin declararlo dos veces).
- [ ] **Step 4:** Run the tests → PASS. Comprobar que `index.html` sigue arrancando en la Task 0.
- [ ] **Step 5: Commit** `git add cronometro/logica.js cronometro/tests cronometro/index.html cronometro/sw.js && git commit -m "Cronómetro: lógica sin DOM en logica.js, con tests"`

### Task 2: Pestañas, menú «⋯», Entrenar y Nadadores

**Files:**
- Modify: `cronometro/index.html` — `renderHome` (~1178), `renderPantalla` (~1160), acciones (~1950), CSS.

**Interfaces:**
- Consumes: `fechaLarga`, `seriesDe`, `comparaciones`, `marcaDe` (Task 1 / existentes).
- Produces: `route.screen` nuevos `'nadadores'` (lista); `'home'` pasa a ser «Entrenar». `renderTabs(activa: 'home'|'historial'|'nadadores') -> string`. `ultimoEntreno() -> {ses, series, nads, nTiempos, mejor:{n, ms, ev}|null, mejoran:int}|null` (de `mySes()`, la más reciente con tiempos). Acción `repetir-entreno` (data-ses).

- [ ] **Step 1:** `renderTabs` fija abajo (Entrenar · Historial · Nadadores · Web club → `<a href="../temporada.html#mi">`), añadida al final de `home`, `historial`, `hist-det`, `nadadores`, `evolucion-nad`; padding inferior del contenido para que no la tape. Nunca en `preparar`/`en-curso`.
- [ ] **Step 2:** Menú «⋯» (botón arriba a la derecha en `home`, abre un panel simple): Entrenadores (si `soyAdmin()`), Cambiar nombre (acción `cambiar-nombre` existente), Salir. El aviso 🔔 de solicitudes sigue en `home`.
- [ ] **Step 3:** `renderHome`: saludo + fecha; «▶ Nuevo entrenamiento» y la línea de plantilla (como hoy); tarjeta Último entrenamiento con las pruebas por series en primera línea («Serie 1 · Libre 50 — Serie 2 · Espalda 50»), luego series/nadadores/tiempos/tiempo nadando (si `ses.nado`), mejor del día y «⬆ N mejoran su marca», etiqueta Simulación si `esSim`; toque → `hist-det`; botón «Repetir este entreno» → `navPreparar(eqId)` con las calles de esa sesión (de `S.grupos`/`S.gnads`) y `PS.estilo/dist/parciales` de la serie 1. Quitar del inicio las listas de equipos, «Mis grupos» y el campo de crear grupo.
- [ ] **Step 4:** `route.screen 'nadadores'`: chips de categoría (equipos `shared`, el último elegido en `localStorage 'crono_cat'` con try/catch); lista de nadadores con nº de entrenos (de `S.resultados`), toque → `evolucion-nad` (existente) que añade el enlace «Ficha completa en la web» a `../temporada.html#nadador/<rfen>/entrenos` si tiene `rfen`. Abajo, «Mis grupos propios» con lo que se quitó del inicio (crear/borrar).
- [ ] **Step 5:** Quitar `evolucion` (la lista vieja) de la navegación; `evolucion-nad` vuelve con «← Nadadores».
- [ ] **Step 6:** Verificar en la Task 0 a 375 px: pestañas visibles en las 4 pantallas y ocultas al preparar y al cronometrar; «Repetir» abre preparar con las calles; sin errores en consola.
- [ ] **Step 7: Commit** `"Cronómetro: pestañas abajo, inicio con el último entreno y pestaña Nadadores"`

### Task 3: Historial con filtros y vista por series

**Files:** Modify `cronometro/index.html` — `renderHistorial` (~1724), acciones.

**Interfaces:** Consumes `seriesFiltradas`, `porMes`, `fechaLarga`, `comparaciones`, `marcaDe`. Produces `route.filtro = {estilo|null, dist|null}` (recordado en `localStorage 'crono_hist'`), acciones `hist-estilo`, `hist-dist`.

- [ ] **Step 1:** Chips arriba: estilos (`ESTILOS`) y distancias (`DISTS`); tocar el activo lo quita.
- [ ] **Step 2:** Sin filtro: `porMes(mySes())`, cabecera por mes, cada fila con `fechaLarga` en negrita como primera línea, luego grupo · pruebas por series · duración (tiempo nadando si hay, si no `min`) · etiqueta Simulación.
- [ ] **Step 3:** Con filtro: `seriesFiltradas(mySes(), S.resultados, filtro)`; cada bloque «fechaLarga corta · grupo · Serie N · Espalda 50» y sus tiempos de más rápido a más lento, 🏅 si `marcaDe(comparaciones(...))`; toque en la cabecera → `hist-det`. Mensaje si no hay ninguna.
- [ ] **Step 4:** Verificar en la Task 0 con las 3 sesiones de prueba: filtro libre muestra solo esas series; quitar filtro vuelve a los entrenos completos.
- [ ] **Step 5: Commit** `"Cronómetro: historial por meses y filtro por estilo y distancia que muestra solo esas series"`

### Task 4: Reloj de tiempo nadando

**Files:** Modify `cronometro/index.html` — `buildSA` (~726), `salidaTanda` (~765), `llegoNad` (~785), `deshacerLlegada` (~903), `startClock` (~613), `renderEnCurso` (~1490), `renderResultados`, `exportar`, `generarPDF`, `DB` (nuevo método).

**Interfaces:** Consumes `abrirTramo`, `cerrarTramo`, `reabrirTramo`, `msNadando`. Produces `SA.nado` (lista de tramos), `DB.guardarNado(sesId, nado)` (`update({nado})` y el mismo cambio en `S.sesiones`), `nadoTxt(ses) -> string|''`.

- [ ] **Step 1:** `buildSA` toma `SA.nado` de `ses.nado || []`.
- [ ] **Step 2:** En `salidaTanda`, si `SA.nSalida` era 0 en esta ronda → `abrirTramo(SA.nado, SA.ronda, t)` y guardar. En `llegoNad`, si tras la llegada `rondaTerminada()` → `cerrarTramo(..., t)` con la hora real de llegada y guardar. En `deshacerLlegada` que deja la ronda abierta → `reabrirTramo` y guardar.
- [ ] **Step 3:** Reloj grande en `.ec-top`: `<span class="live-nado">` actualizado en `startClock` con `msNadando(SA.nado, now)`; en gris (`.parado`) cuando el tramo de la ronda está cerrado o no ha empezado.
- [ ] **Step 4:** «Tiempo nadando: 23:41» en `renderResultados` (stat), en el texto exportado y en el PDF (fila de info) cuando `ses.nado` tiene tramos; nada si no.
- [ ] **Step 5:** Verificar en la Task 0: 2 series con descanso; el reloj no corre en el descanso; recargar a mitad de serie y el reloj sigue bien; deshacer la última llegada lo reanuda.
- [ ] **Step 6: Commit** `"Cronómetro: reloj de tiempo nadando por series, guardado en la sesión"`

### Task 5: Marca en el momento

**Files:** Modify `cronometro/index.html` — `llegoNad`, `renderSwCard` (~1567), fila de Llegados en `renderEnCurso`, CSS.

**Interfaces:** Consumes `comparaciones(nId, estilo, dist, ms, resId, hasta)`, `marcaDe`. Produces `rec.marca: 'comp'|'entreno'|null` en cada llegada.

- [ ] **Step 1:** En `llegoNad`, tras guardar: `rec.marca = SA.estilo && SA.dist ? marcaDe(comparaciones(a.nId, SA.estilo, SA.dist, ms, resId, Date.now())) : null`; si hay marca, `navigator.vibrate([60,40,60])`.
- [ ] **Step 2:** La tarjeta reciente y la fila de Llegados muestran `🏅 ¡marca de competición!` o `🏅 mejor entreno`, en una línea pequeña que no cambia el alto de los botones.
- [ ] **Step 3:** Verificar en la Task 0 con un nadador con marca previa de entreno: al llegar más rápido aparece la medalla; más lento, nada.
- [ ] **Step 4: Commit** `"Cronómetro: aviso de mejor marca al llegar"`

### Task 6: Salidas por ciclo con modo automático

**Files:** Modify `cronometro/index.html` — `renderNuevaSerie` (~1655), `renderPreparar` (~1451), `iniciarSesion`, `repetirSerie`, `startClock`, tarjeta de salida en `renderEnCurso`, acciones; nuevo bloque de audio.

**Interfaces:** Consumes `cicloEstado`. Produces `SA.ciclo: int seg|null`, `SA.auto: boolean`, `SA.avisado: number` (nSalida para la que ya sonó el aviso de 5 s), `pitido(ms: number, hz: number)`, `desbloquearAudio()` (crea el `AudioContext` en el primer toque de SALIDA), `localStorage 'crono_auto'` = última elección del interruptor.

- [ ] **Step 1:** En preparar y en nueva serie: campo «Ciclo (seg)» (vacío = sin ciclo; acepta `70` o `1:10`) y el interruptor «Salida automática» (por defecto el valor de `crono_auto`, si no apagado). `repetirSerie(cfg)` acepta `cfg.ciclo` y `cfg.auto`.
- [ ] **Step 2:** En `startClock`, si `SA.ciclo && SA.nSalida>0`: `e = cicloEstado(SA.tUltSalida, SA.ciclo, now, quedanPorSalir())`; `e.aviso` y no avisado → `pitido(120, 880)` una vez; `e.toca` → si `SA.auto` llamar a `salidaTanda(SA.tUltSalida + SA.ciclo*1000)` (hora exacta del 0; el antirrebote de 800 ms no aplica a esta llamada) + `pitido(500, 660)` + vibración; si manual, solo `pitido(500,660)` una vez por salida.
- [ ] **Step 3:** En la tarjeta de salida: cuenta atrás grande («0:07») y, en automático, botón «Pausar ciclo» (pone `SA.auto=false`) y un interruptor para volver a encenderlo.
- [ ] **Step 4:** Verificar en la Task 0 con ciclo 15 s y 3 nadadores por calle: en automático salen solos a los 15 y 30 s, respetando «no sale», y se para al no quedar nadie; en manual solo pita.
- [ ] **Step 5: Commit** `"Cronómetro: salidas por ciclo con aviso y modo automático"`

### Task 7: Planes preparados

**Files:** Modify `cronometro/index.html` (DB, `S.planes`, conexión de colecciones, pantalla `plan`, `renderHome`, `renderResumenRonda` ~1604, `iniciarSesion`), `cronometro/firestore.rules` (añadir `'planes'`), `cronometro/importar.html` (`CAMPOS.planes = ['coach','ts','nombre','eqId','calles','series']`, `planes` en el borrado por `sim_`).

**Interfaces:** Consumes el tablero de calles (`renderBoard`, `PS`), `repetirSerie(cfg)`, `limpiarDoc('planes', …)`. Produces `DB.guardarPlan(plan) -> id`, `DB.borrarPlan(id)`, `misPlanes() -> plan[]` (del entrenador), `route.screen 'plan'` (crear/editar), `SA.plan` (plan en uso) y `SA.planIdx` (serie del plan en curso), `ses.planId`.

- [ ] **Step 1:** Pantalla `plan`: nombre, grupo, calles con el mismo tablero que preparar, y la lista de series (estilo, distancia, parciales, ciclo, automática) con añadir/quitar/subir/bajar. Guardar → `planes`.
- [ ] **Step 2:** En Entrenar: «Preparar entreno» y la lista «Preparados» (nombre, nº de series); tocar uno → `iniciarSesion` con sus calles y su serie 1, guardando `planId` en la sesión; mantener pulsado → editar o borrar.
- [ ] **Step 3:** Fin de serie con plan: botón principal «Siguiente serie: Espalda 50» → `repetirSerie(plan.series[planIdx+1])`; se puede cambiar o saltar; tras la última, «Plan terminado».
- [ ] **Step 4:** Publicar las reglas nuevas en la consola de Firebase (pedir confirmación al usuario antes; es la base de datos real).
- [ ] **Step 5:** Verificar en la Task 0 un plan de 3 series de punta a punta.
- [ ] **Step 6: Commit** `"Cronómetro: preparar el entreno en casa y seguirlo serie a serie"`

### Task 8: Notas rápidas por nadador

**Files:** Modify `cronometro/index.html` (pulsación larga en tarjeta y fila de Llegados, `DB.guardarNota(resId, nota)` con `update({nota})`, resumen, texto, PDF); `pipeline/web/vistas/entrenamientos.js` (`entTiempos` pasa `nota`; `pintarEntrenosNadador` la muestra); `pipeline/web/tests/entrenamientos.test.mjs`; `cronometro/importar.html` (`'nota'` en `CAMPOS.resultados`).

**Interfaces:** Produces `t.nota: string|null` en `entTiempos` (recortada a 200).

- [ ] **Step 1: Failing test** en la web: `entTiempos` con `nota:'<b>viraje</b>'` devuelve `nota === '<b>viraje</b>'` (el escape se hace al pintar) y una nota de 300 caracteres llega con 200.
- [ ] **Step 2:** Run `node --test pipeline/web/tests/*.test.mjs` → FAIL; implementar; → PASS.
- [ ] **Step 3:** Cronómetro: pulsación de 600 ms sin moverse sobre la tarjeta (en el agua) o la fila (llegado) abre un `prompt` corto; si aún no llegó, la nota se guarda en `a.nota` y se escribe al llegar. Mostrar «📝 viraje lento» en resumen, PDF y texto. La pulsación larga no debe marcar llegada ni parcial.
- [ ] **Step 4:** Web: en la tabla de la ficha, una línea pequeña con la nota bajo la fecha, escapada con `esc`.
- [ ] **Step 5: Commit** `"Notas rápidas por nadador en el cronómetro y en la ficha de entrenos"`

### Task 9: Asistencia

**Files:** Modify `cronometro/index.html` (preparar: «¿Quién más vino?»; resumen: editar presentes; `iniciarSesion` guarda `presentes`), `pipeline/web/vistas/entrenamientos.js` (`entGrupo`), tests de la web, `cronometro/importar.html` (`'presentes'`, `'nado'`, `'planId'` en `CAMPOS.sesiones`).

**Interfaces:** Changes `entGrupo(T, sesiones = [])`: una sesión cuenta como asistida por un nadador si tiene tiempos en ella **o** su `nId` está en `ses.presentes`; los nadadores listados siguen siendo los que aparecen en `T`. `pintarEntrenamientos` llama `entGrupo(F, ENT.datos.sesiones)`.

- [ ] **Step 1: Failing test:** con `D` de los tests, `s2.presentes = ['a','b']` → `b` pasa a 2 sesiones y 100 % de asistencia; sin `presentes`, igual que hoy.
- [ ] **Step 2:** Run → FAIL; implementar; → PASS (todos los de la web).
- [ ] **Step 3:** Cronómetro: `presentes` = nadadores en calles al empezar + los marcados en «¿Quién más vino?» (lista del grupo con casillas, plegada por defecto); editable desde el resumen con `update({presentes})`.
- [ ] **Step 4: Commit** `"Asistencia: quién vino aunque no nade, en el cronómetro y en la web"`

### Task 10: Pantalla encendida, publicación y comprobación en línea

**Files:** Modify `cronometro/index.html` (`pedirWakeLock` también en `preparar` y `plan`; aviso discreto si `!('wakeLock' in navigator)`), `cronometro/sw.js` (`VERSION = 'crono-v7'`).

- [ ] **Step 1:** Run `node --test cronometro/tests/*.test.mjs` y `node --test pipeline/web/tests/*.test.mjs` → todo PASS; extraer los scripts en línea de `index.html` e `importar.html` y `node --check`.
- [ ] **Step 2:** Recorrer en la Task 0 a 375 px: inicio, repetir, plan con ciclo automático, notas, marca, historial filtrado, resumen y PDF. Sin errores en consola.
- [ ] **Step 3:** Enseñar al usuario el diff completo y esperar su visto bueno antes de subir.
- [ ] **Step 4:** `git push`, lanzar `actualizar-temporada.yml` y comprobar en línea que `cronometro/` sirve `logica.js` y `crono-v7`, y que `temporada.html` lleva los cambios de notas y asistencia.
- [ ] **Step 5:** Quitar la entrada temporal de `.claude/launch.json`.

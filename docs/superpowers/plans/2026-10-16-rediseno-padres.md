# Rediseño "pensado para el padre" — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehacer la web `club.html` / `temporada.html` con 4 secciones, "Mi nadador" como pantalla principal (resumen + 8 accesos a 1 toque), la estética de `DESIGN.md` (Agua clara + modo acuático nuevo, iconos de línea, fotos reales) y el acceso nuevo "En el club" (puesto hoy e histórico), sin perder ningún dato.

**Architecture:** Se mantiene el montaje actual: `pipeline/web/*` → `montar_html()` de `pipeline/generar.py` → un HTML con `DATA` incrustado; navegación por `#hash` en `app.js`. Lo único nuevo en datos es `e.cl` (puestos en el club) que calcula `generar.py` a partir de una base nueva `pipeline/edades_base.json.gz`. Las piezas puras de JS (iconos, etiquetas de nivel, rutas, accesos, mejor momento) se separan en funciones globales probadas con `node --test` cargando los archivos en un `vm`.

**Tech Stack:** Python 3.12 (`unittest`, sin dependencias nuevas), HTML/CSS/JS sin librerías, `node --test` (Node ≥ 20) para JS puro, `playwright-cli` para la verificación visual.

**Spec:** `docs/superpowers/specs/2026-10-16-rediseno-padres-design.md` · **Sistema visual:** `DESIGN.md` (colores, tamaños y reglas exactas; las tareas no los repiten).

## Global Constraints

- No se quita ningún dato ni cálculo; solo cambia dónde está y cómo se ve.
- Sin dependencias nuevas: ni librerías JS, ni fuentes externas, ni paquetes Python.
- 4 secciones: **Mi nadador · Club · Campeonatos · Rankings** + buscador siempre arriba.
- Modo por defecto "Agua clara"; modo acuático con botón; se guarda en `localStorage` `cna_modo` (`'clara'` | `'acuatico'`).
- Texto nunca directamente sobre agua o foto; los datos van sobre superficie sólida.
- Ningún emoji como icono en la interfaz; iconos de línea de `DESIGN.md` §6.
- Estilos sin icono: franja de color de `DESIGN.md` §3.
- Niveles: bandera España, bandera Andalucía, **punto azul `#2E86C9` + "Málaga"**.
- Ranking (borde fino + icono barras) ≠ Campeonato (relleno + copa; oro/plata/bronce si es podio).
- Un solo nadador guardado por dispositivo (`ESTRELLA_LS = 'cna_estrella'`).
- "Mi nadador" usa la misma foto genérica para todos; nunca fotos por nadador.
- Fotos ≤ 200 KB, ~1400 px de ancho.
- Respetar `prefers-reduced-motion` (el agua no se mueve).
- Enlaces antiguos siguen funcionando (redirigen a su nuevo sitio).
- El manual (`manual.pdf`) queda fuera; su enlace se mantiene.

## Review Focus

- **Nadador con pocas o ninguna marca** (o sin top ni podios): la pantalla no se rompe; bloques vacíos se ocultan o dicen "Todavía…". → Tarea 6 (`mejorMomento` con `ev: []`) y Tarea 7.
- **Nadador que no es Alevín / sin relevos en su categoría**: no aparecen los accesos "Cto. España" / "Cto. Andalucía" / "Sus relevos" que no aplican. → Tarea 5 (`accesosDe`).
- **Enlaces viejos y sin nadador elegido**: `#inicio`, `#benicio` sin estrella, `#nadador/<id>/objetivos`, `#benicio/pruebas` llevan a su sitio nuevo, nunca a una pantalla en blanco. → Tarea 4 (`resolverRuta`).
- **`localStorage` bloqueado** (modo privado): la web abre en Agua clara sin errores. → Tarea 3 (`leerModo`).
- **Pantalla estrecha (320 px) y nombres largos**: sin desplazamiento horizontal; el nombre parte en dos líneas. → Tarea 10 (verificación a 320 px).

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `pipeline/historial.py` | + `marcas_club_edades()` (base histórica por edad) |
| `pipeline/construir_historial.py` | + opción `--solo-edades` que escribe `pipeline/edades_base.json.gz` |
| `pipeline/generar.py` | + `puestos_club()` → `e['cl']`; `JS_ORDEN` con `iconos.js` y `vistas/accesos.js` |
| `pipeline/tests/test_puestos_club.py` | pruebas Python (`unittest`) |
| `pipeline/web/tests/cargar.mjs` | carga archivos JS en un `vm` con un `DATA` de prueba |
| `pipeline/web/tests/*.test.mjs` | pruebas JS (`node --test`) |
| `pipeline/web/iconos.js` | sprite SVG de iconos de línea, `ico()`, `franja()`, `estiloDe()` |
| `pipeline/web/comunes.js` | + `nivelHTML()`, `badgeRanking()`, `badgeCto()`, `MA_DOT`; modo `leerModo()`/`guardarModo()` |
| `pipeline/web/estilos.css` | reescrito con los tokens de `DESIGN.md` (dos modos) |
| `pipeline/web/agua.js` | reescrito: fondo del modo acuático nuevo |
| `pipeline/web/plantilla.html` | cabecera (logo, buscador, modo) y barra de 4 secciones |
| `pipeline/web/app.js` | `resolverRuta()` + `route()` con las secciones nuevas |
| `pipeline/web/vistas/accesos.js` | `accesosDe()`, `mejorMomento()`, `frasesCortas()` (lógica pura de "Mi nadador") |
| `pipeline/web/vistas/ficha.js` | pantalla de nadador nueva + sub-pantallas de cada acceso |
| `pipeline/web/vistas/club.js` | Club con portada; absorbe lo de Inicio |
| `pipeline/web/vistas/inicio.js` | se elimina (su contenido pasa a `club.js`) |
| `pipeline/web/vistas/campeonatos.js`, `rankings.js`, `elegir.js`, `historial.js`, `comparar.js`, `comparativa.js` | estética nueva, sin emojis |
| `img/` (raíz del repo) | `mi-nadador.jpg`, `club.jpg`, `campeonatos.jpg`, `agua.jpg` |

Trabajar en la rama `rediseno-padres` (crearla desde `main` antes de la Tarea 1).

---

### Task 1: Base histórica del club por edad

**Files:**
- Modify: `pipeline/historial.py` (junto a `marcas_club_records`, ~l. 662)
- Modify: `pipeline/construir_historial.py`
- Create: `pipeline/tests/__init__.py`, `pipeline/tests/test_puestos_club.py`
- Create (generado y commiteado): `pipeline/edades_base.json.gz`

**Interfaces:**
- Produces: `marcas_club_edades(filas_por_temporada: dict[str, list], club_match='AXARQ') -> dict[str, list[list]]` con claves `'g|E{edad}|prueba|piscina'` y valor `[[pid, cs], …]` = la mejor marca de **cada** nadador distinto del club a esa edad, ordenadas por `cs`. Edad federativa igual que `marcas_club_records`.
- Produces: archivo `pipeline/edades_base.json.gz` con ese dict (temporadas cerradas `H.TEMPORADAS[:-1]`).

- [ ] **Step 1: Prueba que falla** — `TestEdades.test_mejor_por_nadador_y_edad`: con filas sintéticas (mismo `profile_id` dos marcas a 12 años en 50 Braza 25m, otro nadador una marca; un tercero de otro club) espera `{'F|E12|50 Braza|25m': [['B', 3800], ['A', 3842]]}` y que no aparezca el de otro club ni la clave por categoría (`F|ALE|…`).
- [ ] **Step 2:** `cd pipeline && python3 -m unittest tests.test_puestos_club -v` → FAIL (`AttributeError: marcas_club_edades`).
- [ ] **Step 3:** Implementar `marcas_club_edades` reutilizando `marcas_club_records(..., top=None)` (aceptar `top=None` = sin recorte) y quedándose solo con claves `E…` y `[pid, cs]`.
- [ ] **Step 4:** Repetir el comando → PASS.
- [ ] **Step 5:** Añadir a `construir_historial.py` el argumento `--solo-edades` que solo escribe `edades_base.json.gz` (gzip nivel 9, como las otras bases). Ejecutar: `python3 pipeline/construir_historial.py "$HOME/Desktop/Estadisticas club natacion Axarquia RFEN" --solo-edades` → imprime nº de claves y tamaño (esperado < 1 MB) y el archivo existe.
- [ ] **Step 6: Commit** `feat: base histórica del club por edad (edades_base.json.gz)`

### Task 2: Puestos en el club (`e.cl`)

**Files:**
- Modify: `pipeline/generar.py` (nueva función junto a `records_club`, llamada antes de crear `data`)
- Test: `pipeline/tests/test_puestos_club.py`

**Interfaces:**
- Consumes: `edades_base.json.gz` (Task 1), `swimmers` y `hist` de `main()` (mismo formato que usa `records_club`: `hist[(pid, ev)] = [(fecha_iso, cs, piscina, …, x[8]=parcial)]`).
- Produces: `puestos_club(swimmers, hist, base) -> None`, que escribe en cada evento `e` de `s['ev']`: `e['cl'] = {'hoy': [pos, n], 'hi': [pos, n, edad]}` (o sin la clave que no tenga datos). Ambas comparan **en la piscina de `e['pool']`** y con **la mejor marca de cada nadador distinto** (él incluido una vez).
  - `hoy`: entre nadadores actuales del club con mismo `g` e `y`.
  - `hi`: base de su `g|E{edad}|ev|pool` (edad federativa de la fecha de su mejor marca) + marcas actuales del club a esa edad.

- [ ] **Step 1: Pruebas que fallan**
  - `test_hoy`: 3 nadadoras F 2014 con 50 Braza 25m `3842/3800/3900` → la de 3842 tiene `cl['hoy'] == [2, 3]`.
  - `test_historico_sin_duplicar`: base `{'F|E12|50 Braza|25m': [['X', 3700], ['A', 3842]]}` donde `A` es la propia nadadora → `cl['hi'] == [2, 2, 12]` (no se cuenta dos veces).
  - `test_otra_piscina_no_cuenta`: una marca de 50m de otra nadadora no altera `hoy` de una prueba en 25m.
- [ ] **Step 2:** `cd pipeline && python3 -m unittest tests.test_puestos_club -v` → FAIL.
- [ ] **Step 3:** Implementar `puestos_club` y llamarla en `main()` con `H.cargar('pipeline/edades_base.json.gz')` (si no existe, `{}`; entonces solo `hoy`).
- [ ] **Step 4:** Pruebas → PASS. Generar en local (ver Task 10, paso 1) → sin errores y `grep -c '"cl":' club.html` > 0.
- [ ] **Step 5: Commit** `feat: puesto del nadador en el club, hoy e histórico`

### Task 3: Banco de pruebas JS, iconos, niveles y modo

**Files:**
- Create: `pipeline/web/tests/cargar.mjs`, `pipeline/web/tests/comunes.test.mjs`
- Create: `pipeline/web/iconos.js`
- Modify: `pipeline/web/comunes.js`, `pipeline/generar.py` (`JS_ORDEN`: `iconos.js` justo después de `comunes.js`)

**Interfaces:**
- Produces (tests): `cargar(archivos: string[], data: object, {ls?: Map|null}) -> vm.Context` — crea contexto con `DATA`, `window`, `document` mínimos y `localStorage` (si `ls === null`, `localStorage` lanza al usarse).
- Produces (`iconos.js`): `ICONOS: string` (sprite `<svg><defs><symbol id="i-…">…`) con los iconos de `DESIGN.md` §6: `nadador, crono, tendencia, barras, meta, carriles, relevo, grupo, balanza, medalla, copa, diana, lupa, gota, historia, flecha-atras`; `ico(nombre: string, cls = '') -> string` (`<svg class="ico ${cls}"><use href="#i-${nombre}"/></svg>`); `estiloDe(ev: string) -> 'libre'|'espalda'|'braza'|'mariposa'|'estilos'`; `franja(ev) -> string` (`<i class="franja e-${estiloDe(ev)}"></i>`).
- Produces (`comunes.js`): `MA_DOT` (span del punto azul), `nivelHTML(lv: 'es'|'an'|'ma') -> string` (FLAG_ES / FLAG_AN / MA_DOT); `badgeRanking(lv, pos, ev) -> string` (clase `bdg rk`, icono `barras`, texto `"${pos}º ranking ${nombre} · ${ev}"`); `badgeCto(lv, pos, ev) -> string` (clase `bdg ch p1|p2|p3|px`, icono `copa`, texto `"${pos}º Cto. ${nombre} · ${ev}"`, `nombre` = `España`/`Andalucía`); `leerModo() -> 'clara'|'acuatico'` (migra `'agua'`→`'acuatico'`, `'normal'`→`'clara'`; cualquier error → `'clara'`); `guardarModo(m)`.

- [ ] **Step 1: Pruebas que fallan** (`comunes.test.mjs`, contexto con `comunes.js` + `iconos.js` y un `DATA` mínimo `{swimmers:[], cats:[], lists:{}}`):
  - `estiloDe('200 Estilos') === 'estilos'`, `estiloDe('50 Braza') === 'braza'`.
  - `badgeRanking('es', 8, '50 Braza')` contiene `bdg rk`, `#i-barras`, `8º ranking España · 50 Braza`.
  - `badgeCto('an', 2, '100 Braza')` contiene `bdg ch p2` y `2º Cto. Andalucía`; `badgeCto('es', 7, 'x')` contiene `px`.
  - `nivelHTML('ma')` contiene `Málaga` y no contiene `<svg class="flag"`.
  - `leerModo()` con `ls = new Map([['cna_modo','agua']])` → `'acuatico'`; con `ls = null` → `'clara'`.
- [ ] **Step 2:** `node --test pipeline/web/tests/` → FAIL.
- [ ] **Step 3:** Implementar. Dibujar los iconos en rejilla 24, trazo 1.75 (los de `.superpowers/brainstorm/18807-1792140059/content/modos-v2.html` son la primera versión). El sprite se inserta una vez en `plantilla.html` (ver Task 4).
- [ ] **Step 4:** `node --test pipeline/web/tests/` → PASS.
- [ ] **Step 5: Commit** `feat: iconos de línea, etiquetas de nivel y modo`

### Task 4: Navegación de 4 secciones y rutas

**Files:**
- Modify: `pipeline/web/plantilla.html`, `pipeline/web/app.js`, `pipeline/generar.py` (`JS_ORDEN`: quitar `vistas/inicio.js`)
- Test: `pipeline/web/tests/rutas.test.mjs`

**Interfaces:**
- Consumes: `ico()`, `ICONOS` (Task 3), `BEN`, `SW`.
- Produces: `resolverRuta(hash: string, ben: object|null, sw: object) -> {sec: 'nadador'|'club'|'campeonatos'|'rankings'|'comparar'|'elegir', id?: string, sub: string, params: object, redirigir?: string}`.
  - Sub-pantallas de nadador: `resumen` (por defecto), `marcas`, `evolucion`, `ranking`, `espana`, `andalucia`, `relevos`, `club`.
  - Rutas de nadador: `#mi` (el elegido) y `#nadador/<id>`. Equivalencias: `#benicio…` → `#mi…`; `pruebas`→`marcas`; `historial`/`evolucion`→`evolucion`; `rivales`→`ranking`; `minimas`→`espana`; `andalucia`→`andalucia`; `objetivos`→`espana` si es Alevín, si no `andalucia`.
  - `#inicio` o vacío → `#mi` si hay nadador elegido, si no `#club`. `#mi` sin nadador → `elegir`.

- [ ] **Step 1: Pruebas que fallan** (`rutas.test.mjs`):
  - `resolverRuta('', null, SW).sec === 'club'`; `resolverRuta('', BEN, SW).sec === 'nadador'`.
  - `resolverRuta('#benicio/pruebas', BEN, SW)` → `sec 'nadador'`, `sub 'marcas'`, `redirigir '#mi/marcas'`.
  - `resolverRuta('#nadador/7/objetivos', null, SW)` con `SW['7'].cat === 'BEN'` → `sub 'andalucia'`; con `'ALE'` → `sub 'espana'`.
  - `resolverRuta('#mi', null, SW).sec === 'elegir'`; `resolverRuta('#nadador/999', null, SW).sec === 'club'`.
- [ ] **Step 2:** `node --test pipeline/web/tests/` → FAIL.
- [ ] **Step 3:** Implementar `resolverRuta` en `app.js` y hacer que `route()` lo use (si `redirigir`, `history.replaceState` y seguir). Plantilla: insertar `ICONOS` una vez al principio de `<body>` (desde `app.js` al arrancar); cabecera fija con logo `logo_cna.png`, buscador (el actual) y botón de modo (`gota` + "Acuático"/"Claro"); barra inferior (< 900 px) / lateral (≥ 900 px) con `nadador` Mi nadador · `grupo` Club · `copa` Campeonatos · `barras` Rankings. En `#nadador/<id>` se ilumina la sección de origen (Club por defecto, Rankings si se llegó desde ahí). Enlace "Manual de uso" en el pie de la barra lateral y en Club. Aplicar `leerModo()` a `<html>` antes de pintar.
- [ ] **Step 4:** `node --test pipeline/web/tests/` → PASS.
- [ ] **Step 5: Commit** `feat: 4 secciones y rutas con redirección de enlaces antiguos`

### Task 5: Estilos y fotos

**Files:**
- Modify (reescribir): `pipeline/web/estilos.css`, `pipeline/web/agua.js`
- Create: `img/mi-nadador.jpg`, `img/club.jpg`, `img/campeonatos.jpg`, `img/agua.jpg`

**Interfaces:**
- Produces (clases CSS que usan las vistas): `html.clara` / `html.acuatico`; `.portada` (+ `style="--foto:url(img/…)"`), `.portada-tit`, `.card`, `.h` (etiqueta de sección), `.num-xl`, `.mejora`, `.logros`, `.bdg.rk`, `.bdg.ch.p1|p2|p3|px`, `.accesos` (rejilla 4 col; `.accesos.dos` 2 col), `.acc`, `.franja.e-libre|e-espalda|e-braza|e-mariposa|e-estilos`, `.ma-dot`, `.lista` / `.lista > .fila`, `.vacio`, `.volver`.
- Produces (`agua.js`): `pintarAgua()` que en `html.acuatico` dibuja el fondo (azulejos refractados + reflejos + línea de carril, o `img/agua.jpg` con velo) y no anima con `prefers-reduced-motion`. Sin gotas ni corcheras.

- [ ] **Step 1:** Fotos: desde `~/Desktop/fotos entreno CNA/` (nombres exactos en la spec, § Fotos) con `sips -Z 1400 -s formatOptions 60 <origen> --out img/<destino>.jpg`; comprobar `du -k img/*.jpg` ≤ 200 cada una (bajar calidad si no).
- [ ] **Step 2:** Reescribir `estilos.css` con los tokens de `DESIGN.md` §2–§9 como variables en `html.clara` y `html.acuatico`. Mantener las reglas de tablas→tarjetas (< 760 px), barra lateral (≥ 900 px) y zonas táctiles de 44 px del CSS actual.
- [ ] **Step 3:** Reescribir `agua.js` (`pintarAgua`) y el botón de modo con `leerModo/guardarModo`.
- [ ] **Step 4:** Verificación rápida: generar (Task 10, paso 1) y capturar `#club` en los dos modos a 375 px (Task 10, paso 2) → fondo correcto en cada modo y texto legible sobre paneles.
- [ ] **Step 5: Commit** `feat: estética Agua clara y modo acuático nuevo, fotos del club`

### Task 6: Lógica pura de "Mi nadador"

**Files:**
- Create: `pipeline/web/vistas/accesos.js` (en `JS_ORDEN` antes de `vistas/ficha.js`)
- Test: `pipeline/web/tests/accesos.test.mjs`

**Interfaces:**
- Consumes: `relevosDe(s)`, `analisis(s)`, `minimasDe(s)`, `DATA.claves_by` (existentes en `ficha.js`/`comunes.js`).
- Produces:
  - `accesosDe(s) -> Array<[sub, etiqueta, icono]>` en este orden: `['marcas','Marcas','crono']`, `['evolucion','Evolución','tendencia']`, `['ranking','Rankings','barras']`, `['espana','Cto. España','meta']` (solo si `s.cat === 'ALE'`), `['andalucia','Cto. Andalucía','carriles']` (solo si `DATA.claves_by[s.id]`), `['relevos','Sus relevos','relevo']` (solo si hay relevos en su categoría, `REL.cats` con `key === s.cat`), `['club','En el club','grupo']`, `['comparar','Comparar','balanza']`.
  - `mejorMomento(s) -> {e, cs, pool, fecha, mejora, rk} | null`: la prueba con mejor puesto en el ranking de España de su año (`e.rk.y.es[0]`); empate o sin ranking → más `pts`. `mejora` = centésimas ganadas frente a su mejor marca anterior en la misma piscina (`null` si no hay anterior). `null` si `s.ev` está vacío.
  - `frasesCortas(lista: Array<[icono, html]>, max = 3) -> Array<[icono, html]>`: las `max` primeras, quitando los emojis de icono (se sustituyen por el icono de línea equivalente: `🥇`→`medalla`, `🏆`→`copa`, `📈`→`tendencia`, `🎯`→`diana`, `⚠️`/`🆕`/`📏`/`🔻`→`diana`, `💎`→`medalla`, bandera → se mantiene).

- [ ] **Step 1: Pruebas que fallan**
  - `accesosDe` de un Benjamín sin claves ni relevos → `['marcas','evolucion','ranking','club','comparar']`.
  - `accesosDe` de un Alevín con claves y relevos → 8 elementos en el orden de arriba.
  - `mejorMomento({ev: []}) === null`.
  - `mejorMomento` con dos pruebas (`es` 8º y 30º) elige la del 8º; con historial `[4000, 3842]` en 25m da `mejora === 158`.
  - `frasesCortas` de 5 frases devuelve 3 y ninguna con emoji (`/\p{Extended_Pictographic}/u`).
- [ ] **Step 2:** `node --test pipeline/web/tests/` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `node --test pipeline/web/tests/` → PASS.
- [ ] **Step 5: Commit** `feat: accesos, mejor momento y frases de Mi nadador`

### Task 7: Pantalla del nadador (resumen)

**Files:**
- Modify: `pipeline/web/vistas/ficha.js` (`vistaFicha` y `tabResumen`; se quitan las pestañas `nav.tabs`)
- Modify: `pipeline/web/vistas/elegir.js` (selector con la estética nueva)

**Interfaces:**
- Consumes: `resolverRuta` (`sub`), `accesosDe`, `mejorMomento`, `frasesCortas`, `badgeRanking`, `badgeCto`, `nivelHTML`, `franja`, `ico`.
- Produces: `vistaFicha(app, s, sub, params)` — `sub === 'resumen'` pinta, en este orden (spec § Mi nadador): portada `img/mi-nadador.jpg` con avatar de iniciales, antetítulo, nombre, `catAnyo(s)` · nº pruebas, botón **Cambiar** (si es el elegido) o **Marcar como mi nadador** (si no y `ESTRELLA_ELEGIBLE`); fila de logros (mismos criterios que los `logros` actuales: `badgeCto` para `DATA.destacados`, `badgeRanking` para top-10 España y nº1 Málaga); tarjeta "Su mejor momento" (`mejorMomento`; puestos `es/an/ma` con `nivelHTML`); "Dónde destaca" y "Para seguir mejorando" (`frasesCortas(analisis(s).F)` / `.M`); rejilla `accesosDe(s)` → enlaces a `fichaHref(s, sub)` (comparar → `#comparar?ids=${s.id}`); "Últimas competiciones" (3, con nivel); "Insignias" redibujadas con `ico()` (mismas reglas que hoy); "Su ventana de detalle" de los KPI accesible al tocar los logros (`abrirKpiFicha`).
  - `fichaHref(s, sub)` pasa a devolver `#mi/<sub>` para el elegido y `#nadador/<id>/<sub>` para el resto.

- [ ] **Step 1:** Implementar el resumen. Bloques sin datos se ocultan; si el nadador no tiene marcas: tarjeta `.vacio` "Todavía no tiene marcas esta temporada".
- [ ] **Step 2:** Generar y capturar `#mi` de un Alevín con podios y de un nadador con 1 prueba (Task 10, pasos 1–2) → orden de bloques igual que el boceto `resumen-hijo.html`, sin emojis, accesos correctos.
- [ ] **Step 3: Commit** `feat: pantalla Mi nadador con resumen y accesos`

### Task 8: Sub-pantallas de los accesos

**Files:**
- Modify: `pipeline/web/vistas/ficha.js`, `pipeline/web/vistas/historial.js`
- Test: `pipeline/web/tests/accesos.test.mjs` (`textoClub`)

**Interfaces:**
- Consumes: pestañas actuales `tabPruebas`, `tabHistorial`/`pintarHistorial`, `tabRankingFicha`, `tabMinimas`, `pintarClasif`, `relevosFicha`/`relevosDe`, `pintarAnalisis`, y `e.cl` (Task 2).
- Produces: cada `sub` con cabecera `.volver` ("‹ Nombre") que vuelve a `fichaHref(s)`:
  - `marcas` = `tabPruebas` + "Perfil" (por estilo y distancia) + "Actividad" + lista completa de competiciones (lo que hoy está en `tabResumen`).
  - `evolucion` = historial + "Su evolución" y "Comparado con los demás" (`pintarAnalisis`).
  - `ranking` = `tabRankingFicha`. `espana` = mínimas. `andalucia` = `pintarClasif`.
  - `relevos` = todos los relevos de su categoría (`relevosDe`), destacando los que es titular y, en el resto, "le faltan X s" (`gap`), como hoy `relevosFicha` pero con la estética nueva.
  - `club` = lista por prueba (con `franja`) usando `textoClub(e) -> {hoy: string|null, hi: string|null}`: `hoy` = `"${p}º de ${n} del CNA nacidos|nacidas en ${s.y}"` ("nacidas" si `s.g === 'F'`), `hi` = `"${p}ª mejor marca del CNA a los ${edad} años"`. Pie: "Histórico desde la temporada 13-14 · misma piscina".

- [ ] **Step 1: Prueba que falla:** `textoClub` con `e.cl = {hoy:[2,6], hi:[4,31,12]}` y `s = {g:'F', y:2014}` → `{hoy:'2º de 6 del CNA nacidas en 2014', hi:'4ª mejor marca del CNA a los 12 años'}`; con `e.cl` ausente → `{hoy:null, hi:null}`. (Femenino: "nacidas".)
- [ ] **Step 2:** `node --test pipeline/web/tests/` → FAIL. **Step 3:** implementar `textoClub` y las sub-pantallas. **Step 4:** → PASS.
- [ ] **Step 5:** Generar y recorrer los 8 accesos de un Alevín (Task 10, paso 2): cada uno abre en 1 toque y "‹" vuelve al resumen.
- [ ] **Step 6: Commit** `feat: sub-pantallas de Mi nadador y En el club`

### Task 9: Club, Campeonatos, Rankings y limpieza de emojis

**Files:**
- Modify: `pipeline/web/vistas/club.js`, `campeonatos.js`, `rankings.js`, `comparar.js`, `comparativa.js`, `historial.js`
- Delete: `pipeline/web/vistas/inicio.js` (mover su contenido a `club.js`)
- Test: `pipeline/web/tests/sin-emojis.test.mjs`

**Interfaces:**
- Produces: `vistaClub(app, p)` con portada `img/club.jpg` ("Temporada 26-27" / "Club Natación Axarquía" / fecha), "El club en números" (KPI de la actual `vistaInicio`), `estaSemanaCard`, accesos `.accesos.dos` (Nadadores · Relevos · Récords · Historia → pestañas actuales de Club) y debajo los demás bloques de Inicio (últimos top-10, el club frente a otros clubes, nadadores por categoría, últimas mejores marcas). `vistaCampeonatos` con portada `img/campeonatos.jpg` y podios con `badgeCto`. `vistaRankings` sin cambios de lógica (ya filtra por `BEN`), con estética nueva y `nivelHTML`.

- [ ] **Step 1: Prueba que falla:** `sin-emojis.test.mjs` lee todos los `pipeline/web/**/*.js` y `plantilla.html`, quita comentarios (`/* */`, `//`) y exige 0 coincidencias de `/\p{Extended_Pictographic}/u` en lo que queda (las banderas son SVG, no emoji).
- [ ] **Step 2:** `node --test pipeline/web/tests/` → FAIL (lista de archivos con emojis).
- [ ] **Step 3:** Rehacer Club/Campeonatos/Rankings y sustituir cada emoji de la interfaz por `ico()` / `nivelHTML()` / texto.
- [ ] **Step 4:** `node --test pipeline/web/tests/` → PASS.
- [ ] **Step 5: Commit** `feat: Club, Campeonatos y Rankings con la estética nueva; sin emojis`

### Task 10: Verificación completa y entrega

**Files:** ninguno nuevo (solo regenerados para publicar).

- [ ] **Step 1: Generar en local** (sin descargar la 26-27):
  ```bash
  T=$(mktemp -d); CNA_BASE=pipeline/base_2526.json.gz CNA_NEW=/nonexistent CNA_OUT=$T/temporada.html python3 pipeline/generar.py && cp -R img logo_cna.png manual.pdf "$T"/ && (cd "$T" && python3 -m http.server 8765 >/dev/null 2>&1 &)
  ```
  Esperado: sin errores; `$T/club.html` y `$T/temporada.html` existen.
- [ ] **Step 2: Capturas** con `playwright-cli` (`open http://localhost:8765/club.html`, `resize`, `screenshot`) de `#club`, `#mi` (tras elegir un Alevín), sus 8 accesos, `#campeonatos`, `#rankings`, en **Agua clara y Acuático**, a **320, 375 y 1280 px**. Para cada una: `playwright-cli eval "document.documentElement.scrollWidth <= innerWidth"` → `true`, y consola sin errores.
- [ ] **Step 3: Enlaces antiguos** en el navegador: `#inicio`, `#benicio`, `#benicio/pruebas`, `#nadador/<id>/objetivos` → llegan a su sitio nuevo.
- [ ] **Step 4: Pruebas:** `node --test pipeline/web/tests/` y `cd pipeline && python3 -m unittest discover -v` → todo PASS.
- [ ] **Step 5:** Añadir `.superpowers/` a `.gitignore`. Commit, `git push -u origin rediseno-padres` y abrir PR a `main` (al fusionar, el workflow regenera `club.html`/`temporada.html` con datos reales). Tras fusionar: lanzar el workflow y revisar la página publicada a 375 px.

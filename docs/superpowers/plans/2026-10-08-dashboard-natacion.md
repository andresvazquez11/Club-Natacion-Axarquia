# Dashboard de natación — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehacer `temporada.html` como un dashboard tipo app (5 secciones, ficha de atleta con pestañas, estilo «Agua vibrante», primero para el móvil) sin perder datos.

**Architecture:** `generar.py` sigue calculando `DATA` igual. Solo cambia `cats`, que pasa a ser por categoría con los dos sexos. La plantilla monolítica se divide en `pipeline/web/`: `plantilla.html`, `estilos.css` y un JS por responsabilidad. `generar.py` los une en un único HTML. La navegación usa enlaces `#`.

**Tech Stack:** Python 3 (generador) y HTML/CSS/JS sin librerías, con gráficos SVG hechos a mano.

**Spec:** `docs/superpowers/specs/2026-10-08-dashboard-natacion-design.md`

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `pipeline/web/plantilla.html` | Esqueleto: barra lateral/inferior, contenedor `#app`, modal; marcadores `/*__CSS__*/`, `/*__JS__*/`, `/*__DATA__*/null` |
| `pipeline/web/estilos.css` | Tema Agua vibrante (variables), layout responsive, componentes (card, kpi, chip, tabs, tablas→tarjetas) |
| `pipeline/web/comunes.js` | Constantes y utilidades: `MINIMAS`, `LV`, `SW`, `fmt`, `dfmt`, `dtag`, `posB`, `esc`, `club`, `spark`, `chips()` de filtros |
| `pipeline/web/graficos.js` | `evoChart(rows)`, `barras(arr)`, modal de evolución `openEvo` / `closeEvo` |
| `pipeline/web/vistas/inicio.js` | `vistaInicio(app)` |
| `pipeline/web/vistas/club.js` | `vistaClub(app, params)`: categoría, filtros sexo/año, buscador, tarjetas, clubes rivales |
| `pipeline/web/vistas/campeonatos.js` | `vistaCampeonatos(app, params)`: top-10 con filtros y medallero |
| `pipeline/web/vistas/ficha.js` | `vistaFicha(app, s, tab)`: cabecera y pestañas Resumen/Pruebas/Evolución/Rivales/Mínimas/Cto. Andalucía |
| `pipeline/web/vistas/rankings.js` | `vistaRankings(app, params)`: buscador de rankings |
| `pipeline/web/app.js` | Router (`#inicio`, `#club/ALE?g=M&y=2015`, `#campeonatos`, `#benicio/pestaña`, `#nadador/<id>/pestaña`, `#rankings`), navegación activa y arranque |
| `pipeline/generar.py` | `cats` combinadas por categoría; `montar_html()` une los archivos web |

## Tareas

### Tarea 1: Generador — categorías combinadas y montaje de la web
- [ ] En `generar.py`, construir `cats_out` como lista por categoría (`{key:'ALE', label, yrs, ids:[ambos sexos]}`) en el orden Benjamín → Junior.
- [ ] Añadir `montar_html()`: lee `web/plantilla.html` y sustituye `/*__CSS__*/` por `estilos.css`, y `/*__JS__*/` por la concatenación ordenada de `comunes.js`, `graficos.js`, `vistas/*.js` y `app.js`. Inserta `DATA`.
- [ ] Verificar: `python3 pipeline/generar.py` genera el HTML sin errores.

### Tarea 2: Estilos «Agua vibrante»
- [ ] `estilos.css` con variables, degradado de fondo, tarjetas de cristal, barra lateral (≥ 900 px) y barra inferior fija (< 900 px), tablas que pasan a tarjetas (< 760 px), chips con desplazamiento lateral y zonas táctiles de 44 px.

### Tarea 3: Utilidades y gráficos
- [ ] Llevar a `comunes.js` y `graficos.js` las funciones existentes (fmt, dtag, posB, evoChart, openEvo…), adaptando los colores al tema.

### Tarea 4: Router y vistas Inicio, Club, Campeonatos, Rankings
- [ ] `app.js` con `route()` sobre `location.hash`, `hashchange` y botón atrás.
- [ ] Inicio, Club (filtros sexo/año, buscador, tarjetas), Campeonatos (filtros y medallero) y Rankings.

### Tarea 5: Ficha de atleta con pestañas (incluida la de Benicio)
- [ ] Pasar el contenido actual de `benicio()`, `swimmerDetail()`, `claves()` y `rivalCols()` a las pestañas.
- [ ] Mínimas solo en Alevín; Cto. Andalucía solo para Benicio.

### Tarea 6: Verificación y publicación
- [ ] Generar con los datos reales y revisar a 375, 768 y 1280 px: sin desplazamiento horizontal, sin errores en consola, enlaces directos y botón atrás.
- [ ] Quitar `pipeline/temporada_2627_template.html` (sustituida por `pipeline/web/`).
- [ ] Commit, push, lanzar el workflow y comprobar la página publicada.

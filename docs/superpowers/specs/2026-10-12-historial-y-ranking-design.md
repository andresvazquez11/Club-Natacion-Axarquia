# Historial de 6 temporadas e histórico del ranking — Diseño

**Fecha:** 2026-10-12 · aprobado por el usuario en el chat.

## Objetivo

1. **Historial de 6 temporadas** (2021-22 a 2026-27) de los nadadores actuales del club, con un análisis automático de su evolución en la ficha de cada nadador.
2. **Histórico del ranking**: en qué puesto estuvo cada nadador cada semana. Se reconstruye hacia atrás con las fechas de las marcas y se guarda una «foto» semanal hacia delante.

## Datos de partida (comprobados)

- La API de la RFEN da todas las temporadas: `x_TEMPORADA` = 2122, 2223, 2324, 2425, 2526, 2627.
- Cada marca trae fecha, competición, piscina y `profile_id`. El `profile_id` identifica al nadador aunque haya cambiado de club, así que el historial incluye marcas con clubes anteriores.

## 1. Historial

**Por nadador y temporada:** mejor marca por prueba (25 m y 50 m por separado y en conjunto), puntos World Aquatics, puesto entre los nacidos en su año en Málaga, Andalucía y España, competiciones y nº de pruebas.

**Ficha → pestaña «Historial»:**
- **Por temporada:** chips para elegir temporada; tabla de sus pruebas con marca, fecha, puntos y puestos de esa temporada.
- **Evolución total:** chips de prueba; gráfico con la mejor marca de cada temporada (por piscina); tabla prueba × temporada con la mejora de un año a otro; nivel medio (pts) por temporada.
- **Análisis** (texto generado por reglas a partir de los datos, en `historial.py`):
  - temporadas con marcas y primera temporada;
  - temporada de mayor salto (nivel medio de sus 3 mejores pruebas en pts) y prueba con la mayor mejora;
  - cambio de estilo principal (el de más puntos en cada temporada) y de distancia máxima nadada;
  - progresión de ranking en España en su mejor prueba («120º → 6º»);
  - tendencia de la última temporada completa (pruebas que mejoró / estancadas) y comparación de la 26-27 con la 25-26.

## 2. Histórico del ranking

- **Dos modos** (el usuario eligió los dos):
  - **Temporada:** igual que el oficial de la RFEN, solo marcas desde el 1 de septiembre.
  - **12 meses:** mejor marca de los últimos 365 días.
- **Cálculo:** cada domingo W, puesto del nadador = 1 + nadadores (mismo sexo, año y nivel) con mejor marca hasta W menor que la suya. También se guarda el total.
- **Niveles:** España, Andalucía y Málaga. Pruebas: todas en las que el nadador tiene marca.
- **Reconstrucción hacia atrás:** todas las semanas de la 25-26 y de la 26-27 hasta hoy (el modo 12 meses usa también la 24-25).
- **Hacia delante:** cada ejecución semanal añade o actualiza la semana actual en `historico_ranking.json`. Las semanas ya guardadas no se recalculan, así se conservan aunque la RFEN cambie datos.
- **Ficha → pestaña «Ranking»:** selector de prueba, nivel y modo; gráfico del puesto en el tiempo (1º arriba) con bandas de sector (top-10, top-25, primera mitad); cambios de la última semana.
- **Correo semanal:** las mayores subidas y bajadas del club en el ranking de España (modo temporada).

## Arquitectura

- `pipeline/historial.py`: carga temporadas, calcula el historial por nadador, el análisis y las fotos semanales del ranking.
- **Temporadas cerradas (21-22 a 24-25):** se precalculan una vez en local (`construir_historial.py`) en `pipeline/historial_base.json.gz`, solo para los nadadores del club con sus puestos ya calculados. Si se suman nadadores nuevos, se vuelve a ejecutar ese script.
- **25-26 y 26-27:** se calculan en cada ejecución. En la nube, el workflow descarga ahora también la 25-26, necesaria para el modo 12 meses y para la reconstrucción.
- **Salida:** `historial.json` junto a `temporada.html`. La página lo carga solo al abrir las pestañas Historial o Ranking, así la carga inicial no pesa más. Si se abre la copia del Escritorio sin conexión, esas dos pestañas muestran un aviso.
- `historico_ranking.json` (en el repo): fotos semanales acumuladas.

## Fuera de alcance

- Nadadores que ya no están en el club.
- Temporadas anteriores a 2021-22.

## Ampliación (12/10/2026)

- **25-26 cerrada:** se guarda en `historial_base.json.gz` y `marcas_2526.json.gz`; la nube ya no la descarga. La temporada RFEN va de octubre a septiembre.
- **Clasificación al Campeonato de Andalucía Alevín** (circulares FAN NAT.10/26 y NAT.13/26): ranking territorial por año de la suma de puntos AQUA; invierno con 100 MA+ES+BR+LI desde el 01/01/2026 y verano (2015) con 100 MA+ES+BR y 200 LI desde el 01/09/2026; corte en el puesto 120. El Campeonato de España Alevín 2027 aún no tiene normativa publicada.
- **Análisis:** lo bueno / a mejorar / comparación (percentil en España de su sexo y año, progresión frente a la mediana y puesto entre sus compañeros del club).
- **Piscinas:** botón Separadas · Todo a 50 m · Todo a 25 m (equivalencia por puntos World Aquatics).
- **Nadador estrella:** `temporada.html` con Benicio fijo; `club.html` para compartir, donde cada familia elige (se guarda en el dispositivo; acepta `?nadador=ID`).

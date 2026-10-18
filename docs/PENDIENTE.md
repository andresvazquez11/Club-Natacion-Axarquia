# Estado del trabajo — web del club (18/10/2026)

> **Para Claude (en el Mac o en la nube):** no hay tareas pendientes de la lista de Andrés. Esto es lo último que se hizo,
> por si hay que retomarlo. Andrés no es técnico: háblale en español, con pasos claros y cortos.

Repositorio: `andresvazquez11/Club-Natacion-Axarquia` · web: https://andresvazquez11.github.io/Club-Natacion-Axarquia/club.html
La web se genera con `pipeline/generar.py` y se publica con el workflow `.github/workflows/actualizar-temporada.yml`.

## Hecho y publicado
- **En el club**: cada prueba abre el ranking interno del club (hoy = su año; histórico = a su edad desde la 13-14), con 25 y 50 m juntas
  (equivalente en 50 m, como Relevos) y los nombres de los antiguos nadadores.
- **Extracto del club en GitHub** (`pipeline/club_historico.json.gz`): ya no hace falta el Mac para los récords ni el histórico.
- **Récords**: 3 mejores a la vista y top-10 desplegable; selector "25 y 50 m juntas" (por defecto) / "Solo 50 m" / "Solo 25 m".
- **Ranking desde la ficha**: pulsar un puesto (logros, "Su mejor momento", Marcas, Rankings, ventana de detalle) abre ese ranking
  (`abrirRankingFicha` en `vistas/ficha.js`); desde la línea, "Ver competición". Ventanas encadenadas con "‹ Volver" (`abrirVentana` en `graficos.js`).
- **Volver** dentro del nadador: a la pantalla de la que se llegó (`apuntarNav` / `pilaNav` en `app.js`).
- **Visitas (GoatCounter, cuenta `andresvazquez11`)**: una visita por sección (`seccionVisita` en `app.js`). No cuentan `temporada.html`
  ni los dispositivos marcados con `club.html?no-contar` (`?contar` lo deshace). En esos dispositivos aparece "Ver visitas".
  El panel solo lo ve Andrés con su contraseña.
- **Manual** (`docs/manual/manual.html` → `manual.pdf`): al día. Se regenera con `node docs/manual/capturas.mjs <carpeta> [URL]`.

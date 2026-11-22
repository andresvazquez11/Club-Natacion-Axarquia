# Estado del trabajo — web del club (22/11/2026)

> **Para Claude:** Andrés no es técnico: háblale en español, con pasos claros y cortos.

## Rediseño «Familias | Completa» (hecho y publicado, 22/11/2026)
Propuesta y diagnóstico: `docs/propuesta-vista-familias.md`. Interruptor **Familias | Completa** (`VISTA` en `comunes.js`, se guarda en `cna_vista`; por defecto Familias).
- **Fase 1:** pestañas de la ficha arriba (`fichaTabsHTML`), «Cómo va» (`fraseProgreso`), «Competiciones» (antes «Calendario»), marca real como número grande, buscador visible, banner de competición con acceso a «Seguir a un nadador» (`dirBannerHoy`).
- **Fase 2:** ficha Familias: Resumen, Resultados (`competicionesDe`), Marcas, Progreso. La vista Completa es la ficha de siempre.
- **Fase 3:** barra inferior Mi nadador · Club · Competiciones · Rankings; Campeonatos pasa al Club; Competiciones con pestañas En directo / Resultados / Próximas; Club para familias; «Entrenador» solo en Completa (enlace «Abrir el modo entrenador» al pie del Club).
- **Fase 4:** lenguaje de Familias (`LENGUAJE_FAMILIAS` en `app.js`: Cto.→Campeonato, pts→puntos, top-10→10 primeros…; no toca la vista Completa), botón «Glosario» (`abrirGlosario`) y pantalla «Cargando…».
- **Directo:** photo finish arreglado (`data-car-clave`), historial de la prueba bajo cada resultado (`vistas/prueba-historia.js`) y explicación de la inscripción (marca de otra piscina).
- Peso de la página: 8,6 MB sin comprimir, ~1,6 MB por la red (el código son solo 187 KB; el resto son datos). No se tocó: partir los datos obligaba a reescribir ficha y rankings por muy poco ahorro.

## Hecho antes
Repositorio: `andresvazquez11/Club-Natacion-Axarquia` · web: https://andresvazquez11.github.io/Club-Natacion-Axarquia/club.html
La web se genera con `pipeline/generar.py` y se publica con el workflow `.github/workflows/actualizar-temporada.yml`.

### Hecho y publicado (18/10/2026)
- **En el club**: cada prueba abre el ranking interno del club (hoy = su año; histórico = a su edad desde la 13-14), con 25 y 50 m juntas
  (equivalente en 50 m, como Relevos) y los nombres de los antiguos nadadores.
- **Extracto del club en GitHub** (`pipeline/club_historico.json.gz`): ya no hace falta el Mac para los récords ni el histórico.
- **Récords**: 3 mejores a la vista y top-10 desplegable; selector "25 y 50 m juntas" (por defecto) / "Solo 50 m" / "Solo 25 m".
- **Ranking desde la ficha**: pulsar un puesto (logros, "Su mejor momento", Marcas, Rankings, ventana de detalle) abre ese ranking
  (`abrirRankingFicha` en `vistas/ficha.js`); desde la línea, "Ver competición". Ventanas encadenadas con "‹ Volver" (`abrirVentana` en `graficos.js`).
- **Volver** dentro del nadador: a la pantalla de la que se llegó (`apuntarNav` / `pilaNav` en `app.js`).
- **Visitas (GoatCounter, cuenta `andresvazquez11`)**: una visita por sección (`seccionVisita` en `app.js`). No cuentan `temporada.html`
  ni los dispositivos marcados con `club.html?no-contar` (`?contar` lo deshace). El enlace a las estadísticas
  NO está en la web: va solo en el correo de cada actualización.
  El panel solo lo ve Andrés con su contraseña.
- **Manual** (`docs/manual/manual.html` → `manual.pdf`): al día. Se regenera con `node docs/manual/capturas.mjs <carpeta> [URL]`.

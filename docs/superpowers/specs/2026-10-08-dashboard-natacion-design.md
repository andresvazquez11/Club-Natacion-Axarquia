# Rediseño del informe de natación como dashboard — Diseño

**Fecha:** 2026-10-08
**Página:** https://andresvazquez11.github.io/Club-Natacion-Axarquia/temporada.html

## Problema

El informe actual (`temporada.html`) tiene todos los datos que se necesitan, pero cuesta encontrar las cosas:

- todo está en una sola página larga con dos vistas;
- en el móvil hay tablas anchas que no caben en pantalla;
- la información está mezclada (KPIs, campeonatos, categorías, Benicio, rankings).

## Objetivo

Convertir el informe en un **dashboard** fácil de navegar, sobre todo en el móvil, sin perder ningún dato de los que hay hoy. La actualización semanal automática y el correo siguen funcionando igual.

## Decisiones tomadas (con el usuario)

- **Estructura A + C:** navegación tipo app (menú lateral en el ordenador, barra de iconos fija abajo en el móvil) y una **ficha de atleta con pestañas** para cada nadador.
- **Estilo visual «Agua vibrante»:** fondo con degradado azul piscina (`#023e8a → #0077b6 → #00b4d8`), tarjetas de cristal (blanco translúcido con borde), acentos amarillos (`#ffd60a`) y texto blanco.
- **Categorías con los dos sexos juntos** y filtros de Sexo (Todos · ♂ · ♀) y Año (Todos · cada año de la categoría).

## Secciones

Cada sección es una pantalla con su propio enlace (`#inicio`, `#club`, `#campeonatos`, `#benicio`, `#rankings`, y `#nadador/<id>` para cualquier ficha), así se puede compartir directamente.

### 🏠 Inicio (`#inicio`, pantalla por defecto)
- 4 KPIs del club: nadadores en ranking, pruebas en top-10 de España (su año), podios de Andalucía (su año) y nº1 de Málaga (su año).
- Aviso de actualización: fecha y número de marcas de la 26-27.
- Tarjeta de Benicio: sus 3 mejores puestos en España y un botón «Ver ficha».
- Últimos top-10 en campeonatos (5 más recientes), con enlace a Campeonatos.
- Nadadores por categoría (barras); al pulsar una se abre esa categoría en Club.

### 👥 Club (`#club`)
- Botones de categoría: Benjamín · Alevín · Infantil · Junior (ambos sexos juntos).
- Filtros: Sexo (Todos/♂/♀) y Año (Todos/cada año), y buscador por nombre.
- Lista de nadadores en tarjetas: nombre, año, sexo, mejor prueba con su marca y puestos en Málaga, Andalucía y España **entre los de su mismo sexo y año**. Ordenada por suma de los 3 mejores puntos.
- Clubes rivales de la categoría por nivel. Con el filtro de sexo en «Todos» se suman los dos sexos.
- Al pulsar un nadador se abre su ficha de atleta (`#nadador/<id>`).

### 🏆 Campeonatos (`#campeonatos`)
- Top-10 en el Campeonato de España y en los Campeonatos de Andalucía (incluidas las fases de zona; quedan fuera las jornadas de liga de clubes).
- Filtros: categoría, sexo y nivel (España/Andalucía).
- Medallero del club: oros, platas y bronces por nadador en esos campeonatos.
- Cada fila abre la evolución de esa prueba.

### ⭐ Benicio (`#benicio`) y ficha de atleta de cualquier nadador
Cabecera: nombre, año, categoría y año dentro de ella, y chips con sus mejores logros (top-10 de España, campeonatos, nº1 de Málaga).

Pestañas (en el móvil se deslizan con el dedo):
1. **Resumen:** KPIs, puntos fuertes y a mejorar, perfil por estilo y por distancia, actividad (pruebas por mes y competiciones).
2. **Pruebas:** de mejor a peor (puesto relativo en España en su año), cada una con marca, fecha, piscina, puesto en la competición, puntos y puestos en Málaga, Andalucía y España. Interruptor «su año / categoría completa».
3. **Evolución:** selector de prueba y gráfico con todas las marcas (tiempos altos arriba, ★ = mejor marca personal), con la tabla de marcas debajo.
4. **Rivales:** por prueba, top-10 de Málaga, Andalucía y España con la diferencia en segundos. Interruptor «su año / categoría completa».
5. **Mínimas:** mínimas del Campeonato de España Alevín 2026 (tabla A de 50 m y tabla B de 25 m; columna según su año). Solo en la categoría Alevín.
6. **Cto. Andalucía:** las 4 pruebas clave (100 libre, braza, mariposa y espalda) con sus referencias. Solo en la ficha de Benicio.

La ficha de Benicio y la de cualquier nadador son el mismo componente; Benicio solo tiene además la pestaña 6 y un acceso directo en la navegación.

### 📊 Rankings (`#rankings`)
- Selectores: prueba, ámbito (año de nacimiento o categoría), sexo y nivel (Málaga, Andalucía o España).
- Lista con puesto, nadador, club, año, marca, fecha, piscina y puntos. Los nadadores del club van resaltados.
- Los rankings siempre van separados por sexo.

## Comportamiento en el móvil (prioritario)

- Barra de navegación fija abajo con 5 iconos; la sección activa se resalta en amarillo.
- Nada de desplazamiento horizontal en la página: las tablas anchas se convierten en **tarjetas** en pantallas de menos de 760 px.
- Filtros como «chips» que se desplazan de lado dentro de su propia fila.
- La evolución de una prueba se abre a pantalla completa.
- Zonas táctiles de al menos 44 px.

## Arquitectura técnica

- **Salida:** sigue siendo un único `temporada.html` (también funciona abierto desde el Escritorio).
- **Fuentes divididas** para que sean mantenibles (hoy la plantilla es un único archivo de 570 líneas):
  - `pipeline/web/plantilla.html`: estructura y navegación;
  - `pipeline/web/estilos.css`: tema «Agua vibrante» y diseño adaptable;
  - `pipeline/web/app.js`: navegación por enlaces `#`, estado de filtros y arranque;
  - `pipeline/web/vistas/*.js`: un archivo por sección (`inicio.js`, `club.js`, `campeonatos.js`, `ficha.js`, `rankings.js`) más `graficos.js` y `comunes.js`.
- `generar.py` une todos estos archivos en el HTML final e inserta `DATA`. No cambia el cálculo de los datos, salvo por dos añadidos:
  - `medallero`, que se deriva de `destacados`;
  - en las categorías, la lista conjunta de ambos sexos (`cats` pasa a ser por categoría, con `ids` de los dos sexos).
- Las mínimas siguen en el código del cliente, como ahora.
- Sin librerías externas: los gráficos son SVG hechos a mano, como los actuales. Fuentes del sistema.

## Fuera del alcance

- Cambios en la descarga de la RFEN, la actualización automática o el correo.
- Datos nuevos que no estén ya en `DATA`.

## Pruebas y verificación

- Generar el HTML con los datos reales y revisarlo en el navegador a 375 px (móvil), 768 px (tableta) y 1280 px (ordenador).
- Comprobar que no hay desplazamiento horizontal en ninguna sección a 375 px.
- Comprobar que funcionan los enlaces directos (`#benicio`, `#nadador/<id>`) y el botón atrás del navegador.
- Comprobar que no hay errores en la consola.
- Comprobar que el workflow de GitHub Actions genera la página nueva sin errores.

# Traspaso de trabajo — web del club (17/10/2026)

> **Para Claude en el Mac de Andrés:** lee este archivo entero antes de hacer nada.
> Andrés no es técnico: háblale en español, con pasos claros y cortos. Muéstrale el resultado
> (capturas a 375 px) antes de publicar.

## Dónde estamos

Repositorio: `andresvazquez11/Club-Natacion-Axarquia` · web: https://andresvazquez11.github.io/Club-Natacion-Axarquia/club.html
La web se genera con `pipeline/generar.py` y se publica sola con el workflow `.github/workflows/actualizar-temporada.yml`
(se puede lanzar a mano con "Run workflow").

### Ya publicado en `main` (16/10)
- "En el club" (Mi nadador → En el club): cada prueba se pulsa y abre el ranking interno del club (hoy = su año; histórico = a su misma edad desde la 13-14).
- Historia del club: al pulsar un punto de la gráfica, la tarjeta de la temporada queda bien colocada (`irAElemento` en `comunes.js`).
- Contador de visitas GoatCounter (`plantilla.html`, cuenta `andresvazquez11`, la misma que la web de coches).
- Manual rehecho: `docs/manual/manual.html` → `manual.pdf` con `node docs/manual/capturas.mjs <carpeta> [URL]` (necesita playwright en Node).

### Hecho pero SIN publicar: rama `en-el-club-dos-piscinas`
"En el club" junta las piscinas de 25 y 50 m como Relevos: compara el equivalente en 50 m (récords del mundo, puntos World Aquatics)
y enseña la marca real con su piscina. Motivo: Benicio salía "1º de 1" en 100 Mariposa porque él nadó en 50 m y su compañero José Conejero en 25 m.
- Código: `puestos_club()` en `pipeline/generar.py`, `mejorClub/rankingClubHoy/rankingClubHist` en `pipeline/web/vistas/accesos.js`, `subClub/subClubDetalle` en `pipeline/web/vistas/ficha.js`.
- Pruebas: pasan (`node --test pipeline/web/tests/*.test.mjs` y `cd pipeline && python3 -m unittest discover`).
- **Falta verlo funcionando:** generar en local, revisar a 375 px `temporada.html#mi/club` y `#mi/club?ev=100%20Mariposa` (Benicio ya no debe salir "1º de 1"), y luego fusionar en `main`.

Generar en local sin descargar nada:
```bash
T=$(mktemp -d); CNA_BASE=pipeline/base_2526.json.gz CNA_NEW=/nonexistent CNA_OUT=$T/temporada.html python3 pipeline/generar.py \
  && cp -R img logo_cna.png manual.pdf "$T"/ && (cd "$T" && python3 -m http.server 8765)
git checkout historico_ranking.json.gz   # la generación local lo modifica: no subirlo
```

## Pendiente (lo que pidió Andrés)

### 1. Nombres de los antiguos nadadores en el histórico de "En el club"
`pipeline/edades_base.json.gz` solo guarda `[pid, cs]`, sin nombre. Hoy los nombres salen de `records_base` y `comparables_base`
(función `nombres_club()` en `generar.py`) y faltan unos 160 de 374 → aparecen como "Exnadador del club".

Hacer:
1. En `pipeline/historial.py`, `marcas_club_edades()`: guardar también el nombre → `[pid, cs, nombre]`
   (`marcas_club_records` ya lo trae en `m[3]`). Ajustar `TestEdades` en `pipeline/tests/test_puestos_club.py`.
2. En `generar.py`, `puestos_club()`: leer las entradas de la base como `q, cs, *resto` y usar `resto[0]` como nombre en `cln` si no está.
3. Regenerar con las carpetas RAW del escritorio:
   `python3 pipeline/construir_historial.py "$HOME/Desktop/Estadisticas club natacion Axarquia RFEN" --solo-edades`
4. Comprobar que ya no sale "Exnadador del club" (o casi nunca).

### 2. Subir a GitHub lo necesario para no depender del Mac
Andrés quiere que todo esté en GitHub. Las carpetas RAW completas pesan mucho (GitHub no acepta archivos de más de 100 MB),
así que **no subirlas tal cual**. Propuesta: un extracto solo con las marcas del club de las temporadas cerradas
(`pipeline/club_historico.json.gz`: filas de `RAW_1314…RAW_2526` cuyo `club` contiene `AXARQ`, con los campos de `descargar.py`).
Con él se pueden recalcular en GitHub `records_base` y `edades_base` (ambos solo usan marcas del club).
Comprobar el tamaño antes de subirlo (debería ser de pocos MB).

### 3. Récords del club: top-10 desplegable
En Club → Récords (`clubRecords` en `pipeline/web/vistas/club.js`), cada prueba muestra hoy los 3 mejores.
Andrés quiere: la misma línea con los 3 mejores, y al pulsarla que se despliegue (colapsable) con los **10 mejores**.
- `records_club()` en `generar.py` corta a 3 y `records_base.json.gz` se generó con `top=3` (`construir_historial.py`, línea ~88):
  regenerar con `top=10` y subir el corte de `records_club` a 10.
- La página solo pinta los 3 primeros en la línea; los 10 dentro del desplegable (como las listas `rkFila` de una línea).

### 4. Después
- Actualizar el manual (apartado "En el club": piscinas juntas; apartado "Récords": top-10 desplegable) y regenerar `manual.pdf`.
- Fusionar en `main`, lanzar el workflow "Actualizar informe temporada 26-27" y revisar la web publicada a 375 px.

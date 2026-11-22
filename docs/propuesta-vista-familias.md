# Revisión de la web de estadísticas con ojos de padre o madre

Fecha: 22/11/2026 · Hecha recorriendo la web real en un móvil (430 px) pantalla por pantalla, con el caso de Alexis González García y la competición del 21/11.

## 1. Cómo es la web hoy, en números

| Pantalla | Largo en móvil |
|---|---|
| Club (portada) | 5,2 pantallas |
| Club → Nadadores | 7,3 |
| Ficha del nadador → Resumen | 4,7 |
| Ficha → Marcas | 4,6 |
| Ficha → Temporadas | 6,2 |
| Ficha → Cto. España / Andalucía | 5,6 |
| Campeonatos | 3,3 |
| Rankings | 2,9 |
| Competición (todas las pruebas) | 6,8 |

- 5 secciones en la barra inferior, 8 apartados dentro de cada ficha, 120 nadadores, 13 archivos de pantalla y un glosario de términos técnicos.
- La página pesa 8,6 MB (1,6 MB comprimida): en un móvil con poca cobertura en la grada tarda en abrir.

## 2. Las cinco preguntas de una familia y lo que cuesta responderlas

| Pregunta | Dónde está hoy | Problema |
|---|---|---|
| ¿Cómo le fue ayer a mi hijo/a? | 4 sitios distintos: Resumen → «Su última carrera» (solo UNA prueba), Resumen → «Últimas competiciones» (3 líneas, casi al final), Marcas → «Competiciones → Recientes» (texto largo cortado), botón «Calendario» → competición → elegir nadador | No hay un sitio único. Para ver todas las pruebas del día con tiempo, puesto, foto finish e historial hay que saberse el camino |
| ¿Ha mejorado? | «Su mejor momento», «Su evolución» (con pastillas por prueba), «Temporadas», «Marcas» | Cuatro lugares con gráficos distintos; ninguno dice en una frase «ha bajado X s este año» |
| ¿Cuándo nada y en qué calle? | «Competiciones» dentro de Marcas y el botón «Calendario» | En Marcas el aviso «series aún no publicadas» se repite 6 veces y empuja las marcas hacia abajo |
| ¿Cómo está frente a los demás? | Rankings, Cto. España, Cto. Andalucía, insignias de la cabecera, «Dónde destaca», «En el club» | Cinco formas de decir lo mismo con otras palabras (Málaga / Andalucía / España, top-8, presencias, nivel) |
| ¿Qué tiene que mejorar? | «Para seguir mejorando», «Próximos objetivos» | Texto largo y técnico («Rivales de Málaga a menos de 1 s: …») |

## 3. Lo que hace que alguien se pierda (hallazgos)

1. **La competición tiene cuatro nombres.** El botón de arriba dice «Calendario» (pero ahí están los resultados y el directo), la portada del Club lo llama «Competiciones», la barra inferior tiene «Cptos.» (que son las medallas del club, otro tema) y la ficha tiene su propia tarjeta «Competiciones». Son cuatro lugares para una sola cosa.
2. **Los accesos a las secciones de la ficha están escondidos.** Marcas, Temporadas, Rankings, Relevos, En el club y Comparar son seis botones pequeños que aparecen **después de dos pantallas** de scroll, tras «Su última carrera». Quien no baja no sabe que existen.
3. **La ficha del nadador es un muro de tarjetas.** El Resumen tiene ~11 tarjetas seguidas (mejor momento, evolución, última carrera, accesos, suma de puntos, dónde destaca, para seguir mejorando, objetivos, últimas competiciones, insignias…) sin jerarquía: todas pesan lo mismo.
4. **Se enseñan tiempos que nunca ocurrieron.** En Marcas, con la opción por defecto «Todas juntas», el número grande es una conversión (por ejemplo «≈ 2:04.34» para un 200 Libre de 50 m). Una madre ve un tiempo que su hijo no hizo y no lo entiende. (Ya nos pasó hoy con la inscripción 2:08 frente a 2:09.)
5. **Lenguaje de federación, no de familia.** «Cto.», «pts World Aquatics», «top-8», «presencias», «nivel medio», «mediana», «caída», «constancia», «frente a su inscripción», «parcial», «Todas juntas / Solo 25 m». Hay 15 sitios con «Cto.» y un glosario con el «?» pequeño para explicarlo: señal de que el texto ya necesita explicación.
6. **La portada del Club está pensada para el club, no para la familia.** «El club frente a los demás clubes», tabla de clubes, «top-10 del ranking de Andalucía (su año)» y gráficos de tendencia ocupan 5 pantallas. Lo que una familia busca (buscar a su hijo/a, resultado de ayer, próxima competición) está repartido dentro.
7. **El buscador es pequeño y el texto está cortado** («Busca a un nadador d…»). Es la acción número 1 de cualquier visita nueva.
8. **Muchos «Ver detalle ›» y flechas sin pista de qué hay detrás.** Lo vimos hoy: el botón de foto finish y el historial existían pero estaban detrás de un toque sin ninguna señal.
9. **La barra inferior fija tapa contenido y «Entrenador» es un 5.º botón** que una familia no necesita.
10. **Carga pesada.** 8,6 MB al abrir; en datos móviles en una piscina se nota.

## 4. Propuesta: dos vistas, el mismo dato

Un interruptor visible arriba (no escondido): **«Familias | Completa»**. Se recuerda en el dispositivo.

### Vista «Familias» (por defecto)
Principio: **cada pantalla responde a una pregunta, en el orden en que una familia la hace**, con frases y sin siglas. Todo lo demás está a un toque en «Ver todo el detalle», que abre la información de la vista Completa de esa misma tarjeta. No se pierde ningún dato.

**Ficha del nadador (4 pestañas visibles arriba, fijas):** Resumen · Resultados · Marcas · Progreso

1. **Resumen**
   - Cabecera: nombre, categoría, «Este es mi nadador».
   - **«Su última competición»** (tarjeta principal): nombre y fecha, y una fila por prueba con tiempo, un icono ✓ / ▲ / ▼ frente a su mejor marca en esa piscina, puesto en su serie, y los botones **Foto finish** e **Historial de la prueba**.
   - **«Su próxima competición»**: día, hora, serie y calle (o «series aún sin publicar», una sola vez).
   - **«Cómo va»**: una frase y un gráfico simple («en 50 Braza ha bajado 6,4 s desde enero»).
   - **«Sus mejores marcas»**: una línea por prueba con la marca **real**, la piscina y una sola etiqueta de posición («7º de Málaga»).
   - Logros/insignias abajo (motivan).
2. **Resultados**: todas sus competiciones, la más reciente arriba, cada una con sus pruebas desplegables (lo que hoy está repartido en cuatro sitios).
3. **Marcas**: tabla simple por prueba con marca real; el conversor 25↔50 m queda solo en Completa.
4. **Progreso**: la evolución por prueba y por temporada con la frase resumen.

**Competiciones (una sola entrada)**: «Competiciones» sustituye a «Calendario» y a «Cptos.»: Próximas · En directo · Resultados. El medallero del club pasa a Club.

**Club (Familias)**: un buscador grande «¿A quién buscas?», «Resultados de la última competición» y «Próxima competición». Las tablas de clubes, rankings y números del club se mueven a Completa.

**Barra inferior (4):** Mi nadador · Competiciones · Club · Rankings. «Entrenador» pasa al menú de arriba.

### Vista «Completa» (la profesional)
Es la web de hoy, con tres mejoras: los accesos a las secciones arriba como pestañas, el glosario siempre a mano y la conversión entre piscinas claramente marcada como «equivalente». Aquí viven Cto. España/Andalucía, Rankings por nivel, puntos World Aquatics, parciales, comparar, relevos y el modo entrenador.

### Lenguaje (Familias)
| Hoy | Familias |
|---|---|
| Cto. Andalucía | Campeonato de Andalucía |
| Frente a su inscripción | Con el tiempo con el que venía inscrito |
| pts World Aquatics | Puntos (escala internacional) — solo en Completa |
| Todas juntas / Solo 25 m | Se quita; marcas reales con su piscina |
| top-8, presencias, nivel medio | Se quitan; «7º de Málaga» |
| Calendario | Competiciones |

## 5. Plan por fases (cambios pequeños, con vista previa antes de publicar)

**Fase 1 — arreglos rápidos (1 sesión, sin cambiar el diseño):**
1. Accesos de la ficha (Marcas, Temporadas…) como pestañas fijas **arriba**.
2. «Calendario» → «Competiciones» y un único lugar para los resultados.
3. En Marcas: la tarjeta de competiciones colapsada (próxima + «ver todas»).
4. Marca real como número grande; la conversión en pequeño con «equivalente».
5. Buscador más grande y con el texto completo.
6. Frase única de progreso en el Resumen.

**Fase 2 — vista Familias de la ficha** (Resumen, Resultados, Marcas, Progreso) + interruptor.
**Fase 3 — Competiciones unificadas y Club para familias.**
**Fase 4 — lenguaje y limpieza** (siglas, glosario, peso de la página).

## 6. Decisiones que necesito de Andrés
1. ¿Los nombres «Familias» y «Completa» te gustan?
2. ¿La vista por defecto para quien entra por primera vez es «Familias»?
3. ¿Aceptas quitar «Entrenador» de la barra inferior (pasa al menú de arriba)?
4. ¿Empezamos por la Fase 1?

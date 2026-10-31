# Comparativa: demo Swimstone vs. nuestro cronómetro (31/10/2026)

> **Para Claude (nube o Mac):** esto es el análisis hecho en una sesión previa. Andrés no es técnico: háblale en español, claro y corto.
> Demo analizada: https://swim.xavieridoux.com/demo/?lang=en (app `Swimstone` + módulo `chrono.js`). Solo se inspeccionó; no se copió código.
> Siguiente paso: que Andrés elija qué ideas de la lista quiere y se implementan de una en una (cambio → verificar → publicar). Recuerda subir `VERSION` en `cronometro/sw.js` al cambiar la app.

## Qué es la demo
Swimstone es una app de **club completa** (entrenador, nadador y padre) y su cronómetro (`chrono.js`) es un **módulo de hardware**: se conecta por cable USB/Serie o Bluetooth a un cronómetro físico de pulsadores ("Swim Chrono Pro", ESP32). Recibe los toques (START/LAP) en JSON y los vuelca en una tabla por calle/nadador.
Nuestro cronómetro es **software puro en el móvil** (salida por tandas, llegada por nadador, parciales de 50 m, relevos, rankings, PDF, offline, Firebase). Son enfoques distintos; ya tenemos cosas que la demo no enseña (relevos, comparación con rankings/competición del club, PDF, planes por grupo, papelera/recuperar sesión).

## Lo que tiene la demo y nosotros no
### Alta utilidad / poco esfuerzo
1. **Brazadas y frecuencia de brazada** (cuenta de brazadas opcional por largo → ciclos/min y distancia por ciclo). Hoy no registramos brazadas.
2. **Análisis de ritmo con picos**: detecta parciales anómalos frente a la mediana vecina y los clasifica (bajón, remontada, final fuerte, "fade"); informa si fue *negative split*, parejo o *positive split* (1.ª mitad vs 2.ª). Tenemos `ratioMitades`/`analisisEntreno`, pero no el gráfico con picos numerados ni la etiqueta de causa.
3. **Adelantamientos en la calle** (▲ adelanto / ▼ me adelantan) marcados sobre la gráfica de parciales, y animación de la calle vista desde arriba.
4. **Sugerencias automáticas tras el test** ("el próximo test: 0,5–1 s más rápido por 100 en la 2.ª mitad", "no sigas a más de 2 largos…").
5. **Objetivo de parcial cada 100 m cantado desde el borde** ("Set a target split every 100 and call it from the deck"): ritmo objetivo con avisos.

### Alta utilidad / esfuerzo medio
6. **Reparar tiempos mal pulsados**: partir un tiempo en 2 o 3 (pulsación olvidada), fusionar con el siguiente/anterior (doble pulsación), borrar, "reparar fila"; las celdas dudosas se marcan en rojo ("celdas rojas por revisar"). Nosotros solo tenemos deshacer.
7. **Salida cada X (send-off) / rota con semáforo**: "una repetición = …", inicio de cada repetición a intervalo fijo; ya tenemos `rota`, pero la demo lo cruza con el total automático (suma de tiempos / valor del crono / a mano).
8. **Historial del cronómetro por dispositivo** con resincronización tras cortes (secuencia `seq`, "traer histórico"), útil si se pierde cobertura.
9. **Modo "carrera"** con análisis por largo: salida/subacuática, viraje, ritmo de brazada, mapa de la carrera, avisos (p. ej. "la subacuática se acorta", "viraje más lento").

### Más allá del cronómetro (app de club)
10. **Carga de entrenamiento** (RPE × minutos, ACWR 7/28 días, monotonía, forma/TSB) y **RPE planificado vs sentido**; **bienestar matinal** (sueño, estrés, dolor).
11. **Asistencia** de las últimas 4 semanas por nadador (con barras y % ) — nosotros tenemos `renderAsistencia`, pero sin ese porcentaje a 4 semanas.
12. **Objetivos por nadador**, cuenta atrás a la competición principal y calendario.
13. **Tres perfiles** (entrenador / nadador / padre) con su propia vista, notificaciones push, mensajes, documentos, QR de invitación y **bilingüe ES/EN** (nuestra app solo está en español).
14. **IA para planificar** sesiones/temporadas (desactivada en la demo) y **gimnasio** con fichas de ejercicios y vídeos.
15. **Demo interactiva** con datos ficticios y barra para cambiar de rol — buena para enseñar el sistema a otros clubes/padres sin tocar datos reales (nosotros ya generamos capturas ficticias para el manual).

## Lo que ya tenemos y la demo no destaca
Relevos con equipos y mejor previo, comparación con la mejor marca de competición/ranking del club, exportación PDF con gráfica de ritmo, pitido/vibración/wake-lock, papelera y recuperar sesión, importación del cronómetro anterior, unión con la web de estadísticas (licencia RFEN).

## Propuesta de orden
1. Brazadas opcionales por largo + frecuencia (1)
2. Reparar pulsaciones (partir/fusionar/marcar rojo) (6)
3. Gráfica de parciales con picos y etiqueta *negative/positive split* (2) + sugerencia automática (4)
4. Ritmo objetivo con aviso cada 100 m (5)
5. Más adelante: carga RPE y asistencia % (10–11), perfil padres/nadadores bilingüe (13)

## Hecho (31/10/2026): teclado / botonera
`cronometro/index.html` (sección «Teclado / botonera»), `sw.js` → `crono-v23-2`. En la pantalla En curso:
**1-6** = toque de esa calle (parcial o llegada del siguiente nadador de la calle; en relevos, la posta) · **Espacio / Intro / 0** = SALIDA · **Retroceso / Supr / .** = deshacer el último toque.
Valen teclados USB (Android) y Bluetooth (Android e iPhone). No actúan si se escribe en un campo. Sin probar aún con teclado real en piscina; la lógica está comprobada con simulación.
Siguiente: probar con una botonera de unos 15-30 €; si falta pantalla propia, valorar el aparato con ESP32.

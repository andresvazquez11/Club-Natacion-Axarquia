---
version: 1
name: CNA-design
description: Sistema visual del Club Natación Axarquía. Web de estadísticas para padres y entrenadores que se siente "dentro de una piscina", pero con la seriedad de una web de competición. Modo por defecto "Agua clara" (luminoso, turquesa, tarjetas tipo cristal) y modo opcional "Acuático" (piscina real de noche, paneles oscuros legibles). El amarillo del logo es el único acento cálido.
---

# DESIGN.md · Club Natación Axarquía

Este archivo describe **cómo se ve** todo lo del CNA (la web de estadísticas y cualquier pieza nueva).
Un agente o diseñador que lo lea debe poder construir una pantalla nueva que parezca del club sin preguntar.

## 1. Tema visual

- **Sensación:** estar en el mundo de la natación — agua, luz, carriles, gorro del club.
- **Tono:** serio y elegante. Son datos de competición; nada de dibujos ni de aire infantil.
- **Regla de oro:** el agua y las fotos van **de fondo y en portadas**; los datos van **siempre sobre una superficie limpia** con buen contraste. Nunca texto directamente sobre agua o sobre una foto.
- **Prohibido:** emojis como iconos, dibujos de nadadores, gotas o burbujas encima del contenido, corcheras de colores decorativas, sombras pesadas, más de un color de acento cálido.

## 2. Dos modos

| | Agua clara (botón «Claro») | Acuático (por defecto) |
|---|---|---|
| Idea | Agua turquesa a pleno sol | Piscina de competición, agua profunda |
| Fondo | degradado `#6fd6ec → #a8e9f6 → #e6f9fd → #f7fdff` (de arriba a abajo), con reflejos de luz muy suaves arriba | azulejos del fondo vistos a través del agua (juntas dobladas), reflejos de luz finos, **línea negra del carril**; base `#05365f → #032a4d`. Puede ser una foto real de agua optimizada |
| Superficie de datos | blanco 84 % + desenfoque, borde `#dff3f8` | `rgba(3,22,44,.82)` + desenfoque, borde `rgba(255,255,255,.08)` |
| Texto principal | `#08303c` | `#eaf6ff` |
| Texto secundario | `#3d6976` | `#bcd8ea` |
| Etiquetas de sección | `#2a6f82` | `#8fd0f2` |
| Números grandes | `#0a5fe0` | `#ffffff` |
| Enlaces / iconos activos | `#0a6cff` | `#8fd0f2` (activo en barra: `#ffd400`) |
| Barra inferior | blanco 96 % | `rgba(2,16,32,.95)` |

El modo elegido se recuerda en el dispositivo; sin elección, se abre en Acuático. En Acuático, cada toque dibuja dos ondas y unas gotitas que salpican (`salpicar` en `agua.js`, por encima del contenido y sin recibir toques). Con `prefers-reduced-motion` el agua no se mueve ni salpica.

## 3. Color

- **Acento del club:** amarillo `#ffd400` (sale del logo). Solo para lo importante: botón de modo, podios, top de España/Andalucía, aro del avatar. Nunca para fondos grandes.
- **Mejora / positivo:** `#0a7a43` sobre `#dcf7ea` (claro) · `#5ee6a8` sobre `rgba(52,211,153,.15)` (acuático).
- **A mejorar / aviso:** `#b07800` (claro) · `#ffd400` (acuático).
- **Color de cada estilo** (franja vertical de 4 × 14 px junto al nombre de la prueba):

  | Libre | Espalda | Braza | Mariposa | Estilos |
  |---|---|---|---|---|
  | `#0a6cff` | `#0f9d8a` | `#e0861a` | `#8b3fd9` | `#475569` (acuático `#94a3b8`) |

- **Podios en campeonatos** (relleno de la etiqueta): oro `#ffe066 → #f2c200`, plata `#eef1f4 → #c9d1d9`, bronce `#f2c19a → #d48b55`; otro puesto: `#0a5fe0` con texto blanco (acuático `#8fd0f2` con texto `#05365f`).

## 4. Niveles: España, Andalucía, Málaga

- **España:** bandera dibujada (rojo `#AA151B` / amarillo `#F1BF00` / rojo), 18 × 12 px.
- **Andalucía:** bandera dibujada (verde `#007A3D` / blanco / verde), 18 × 12 px.
- **Málaga:** **punto azul** `#2E86C9` + la palabra "Málaga". Sin bandera ni escudo.
- Las banderas son SVG propios (no emoji: en Windows el emoji 🇪🇸 sale como «ES»).

### Ranking ≠ Campeonato (siempre distinguibles)

| | Ranking (cambia cada semana) | Campeonato (resultado de una competición) |
|---|---|---|
| Forma | etiqueta con **borde fino** (`1.5px #b9dbe6`; acuático `rgba(255,255,255,.22)`), fondo blanco/transparente | etiqueta **rellena** (oro/plata/bronce o azul) |
| Icono | barras de ranking | copa |
| Texto | "8º ranking España · 50 Braza" | "2º Cto. Andalucía · 100 Braza" |

## 5. Tipografía

- Familia del sistema: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif` (sin fuentes externas).
- Todos los tiempos y números con `font-variant-numeric: tabular-nums`.

| Uso | Tamaño | Peso | Extra |
|---|---|---|---|
| Número protagonista (mejor marca) | 38–40 px | 800 | `letter-spacing:-.03em` |
| Título de pantalla | 24–26 px | 800 | |
| Nombre del nadador | 21–26 px | 800 | |
| Etiqueta de sección | 11 px | 800 | MAYÚSCULAS, `letter-spacing:.04em` |
| Antetítulo ("Mi nadador", "Temporada 26-27") | 10 px | 800 | MAYÚSCULAS, `letter-spacing:.14em` |
| Texto de tarjeta | 11.5–13 px | 400 / 700 para lo destacado | |
| Barra inferior | 9.5 px | 700 | |

## 6. Iconos

- **Línea**, rejilla de 24 px, trazo 1.75 px, puntas y uniones redondeadas, `fill:none`, color heredado.
- Familia: nadador (Mi nadador), cronómetro (marcas), tendencia (evolución), barras (rankings), bandera de meta (mínimas/objetivo), carriles, flechas de relevo, grupo (club), balanza (comparar), medalla (destaca), copa (campeonatos), diana (a mejorar), lupa, gota (cambio de modo), reloj con flecha (historia).
- **Los estilos no llevan icono:** se marcan con la franja de color (§3).

## 7. Fotos

- Fotos reales del club (carpeta "fotos entreno CNA"), **preferiblemente donde se ve el gorro del CNA**.
- **Solo en portadas** (cabecera de sección, ~250–300 px de alto en móvil), con degradado que funde la foto con el fondo hacia abajo y el título encima de la zona fundida.
- **"Mi nadador" usa una foto genérica igual para todos, sin cara** (gorro del CNA de espaldas). Nunca fotos personales por nadador.
- Asignación actual: Mi nadador → gorro de espaldas junto a la corchera · Club → mariposa de frente · Campeonatos → el agua rompiendo con el gorro · fondo del modo acuático → agua rompiendo de cerca (sin personas).
- Optimizadas (≤ 200 KB cada una, ~1400 px de ancho); nunca detrás de datos.

## 8. Formas y espacio

- Radios: tarjetas 16 px · accesos directos 14 px · etiquetas y botones redondos 99 px · banderas 2 px.
- Margen lateral en móvil 14 px; separación entre tarjetas 10 px; padding de tarjeta 12 px.
- Sombra solo en claro y muy suave: `0 4px 18px rgba(8,80,110,.08)`.

## 9. Componentes clave

- **Cabecera:** logo real del CNA (redondo, 34 px) + buscador + botón de modo.
- **Tarjeta "Su mejor momento":** número protagonista + píldora de mejora + prueba con franja de estilo + niveles con bandera.
- **Listas "Dónde destaca" / "Para seguir mejorando":** icono de línea o bandera a la izquierda, frase normal con lo importante en negrita, separadores finos.
- **Accesos directos:** rejilla de 4 columnas (2 en Club), icono + nombre corto.
- **Barra inferior:** 4 secciones con icono de línea; la activa en azul (claro) o amarillo (acuático).

# Cartel LED de piscina · notas del proyecto

Resumen de la investigación (noviembre 2026) para mostrar en la piscina los tiempos del cronómetro del entrenador. **Los precios son orientativos**: salen de tiendas internacionales (muchas en USD o con envío desde fuera de España) y no están confirmados con IVA y envío a España.

## Idea general

```
Móvil del entrenador (app Cronómetro CN Axarquía)
        │  serie en curso (calle, nombre, tiempo) — WiFi del móvil o Bluetooth
        ▼
Controlador ESP32-S3 ──► Paneles LED P5 (HUB75) ◄── Batería LiFePO4 12 V + conversor a 5 V
        ▲
        │  UART (3 hilos) o ESP-NOW
ESP32 original + mando PS4 (telemando de la pantalla)
```

- La app del cronómetro (`cronometro/`) ya existe. **El firmware del ESP32 y el envío de la serie desde la app están por programar.**
- Librería de paneles: [ESP32-HUB75-MatrixPanel-DMA](https://github.com/mrcodetastic/ESP32-HUB75-MatrixPanel-DMA) (texto fijo y scroll).
- Ejemplo de ESP32-S3 con web propia para cambiar texto, color y velocidad: [Robojax](https://robojax.com/tutorial_view.php?id=831).
- Conexión móvil → pantalla: lo más sencillo es que el controlador se una al punto de acceso WiFi del móvil. Con iPhone no sirve el Bluetooth directo desde el navegador, así que habría que usar WiFi.

## Cuántos paneles

Módulo estándar de exterior: 320×160 mm, 64×32 píxeles, punto de 5 mm (P5). Tamaños de letra y distancias de lectura: estimaciones con una regla práctica, no medidas.

| Opción | Módulos | Tamaño | Qué muestra | Letra | Se lee hasta |
|---|---|---|---|---|---|
| **A. Todos a la vez (recomendada)** | 8 (2×4) | 64×64 cm | 8 nadadores fijos: `3 GARCIA 1:05.32` | ~60 mm | ~15–20 m |
| **B. Mínima** | 4 (2×2) | 64×32 cm | 8 filas pequeñas o 4 con scroll | ~35 mm | ~10 m |
| **C. Scroll** | 4 (4×1) | 128×16 cm | Una línea grande que desplaza la serie | ~80 mm | ~20–25 m |

## Lista de compra y enlaces

- **Paneles P5 exterior IP65, 64×32:** [Toolboom 7200 nt](https://toolboom.com/en/indoor-led-module-p5-rgb-smd-320-160-mm-64-32-dots-ip65-7200-nt/), ~18 USD/u., 45 W máx. por módulo. Ficha de otro proveedor: [P5 outdoor SMD2727](https://eagerled.com/Standard%20module/320x160mm%20Module%20Specification/P5%20Outdoor%20SMD2727%20320x160mm%20LED%20Module%20Specification.pdf).
- **Alternativa interior (solo piscina cubierta y seca):** [Waveshare P4 64×32](https://www.voelkner.de/products/7563772/WaveShare-RGB-Full-Color-LED-Matrix-Panel-64x32-Pixels-4mm-Pitch.html), 30 € con IVA.
- **Controlador:** [Waveshare ESP32-S3-RGB-Matrix](https://spotpear.com/shop/ESP32-S3-RGB-Matrix-240MHz-2.4GHz-32MB-Flash-16MB-PSRAM.html), ~27 USD ([Electrokit](https://www.electrokit.com/en/esp32-s3-driver-board-for-64x64px-rgb-led-matrixes), sin stock). Alternativa: [kit M-1 con WLED](https://thepihut.com/products/m-1-led-matrix-kit).
- **Batería LiFePO4 12 V 20 Ah:** [Eco-worthy (eBay.de) 79,99 €](https://www.ebay.de/itm/285559902097) · [Sefepoder (Desertcart.es) 146 €](https://www.desertcart.es/products/652014214-sefepoder-12v-20ah-lithium-lifepo4-deep-cycle-battery-4000-cycles.md).
- **Conversor 12 V → 5 V, 20 A, impermeable:** [WEHO](https://www.wehopower.com/es/product/wide-input-12v-24v-to-5v-20a-100w-dc-to-dc-converter/) · [Zaitronics IP67](https://zaitronics.com.au/products/12v-to-5v-20a-dc-dc-buck-converter-voltage-reducer-module-ip67) · [Fruugo](https://www.fruugo.pt/dcdc-buck-converter-12v-to-5v-20a-current-output-step-down-voltage-regulator-module/p-458422076-966030296) (40–69 €).
- **Sin enlace aún:** cargador de LiFePO4, fusible y cables, marco/caja y trípode.

## Presupuesto estimado

| Concepto | B / C (4 módulos) | A (8 módulos) |
|---|---|---|
| Paneles P5 exterior (con envío e IVA) | 100–140 € | 200–280 € |
| Controlador ESP32-S3 | 30–40 € | 30–40 € |
| Batería LiFePO4 (20 Ah / 30 Ah) | 80–146 € | 150–200 € |
| Conversor 5 V 20 A (1 / 2 unidades) | 40–69 € | 80–140 € |
| Cargador LiFePO4, fusible, cables | 40–60 € | 40–60 € |
| Marco, caja y trípode | 40–80 € | 60–100 € |
| **Total** | **~330–535 €** | **~560–820 €** |

## Notas técnicas

- **Autonomía (estimada):** 4 módulos ≈ 50 W (≈3 h con 20 Ah); 8 módulos ≈ 100 W (batería de 30 Ah para 3 h). Hay que limitar el brillo por software para no pasar de los 100 W de cada conversor de 20 A.
- **Piscina cubierta o descubierta:** sin decidir. Cubierta permite menos brillo; en ambos casos conviene IP65 por humedad y cloro. La batería debe ir fuera de salpicaduras.
- **Aspecto:** marco o bisel negro de aluminio, lámina de acrílico ahumado por delante (contraste y protección), visera contra el sol, caja estanca para batería y electrónica con conector rápido e interruptor general, soporte tipo caballete. Suma unos 60–100 €.
- **Enlace de Amazon (`B0HF4JHKJL`):** no se pudo leer (Amazon bloquea la lectura automática). Pendiente de confirmar con título y características: conector HUB75, módulo 64×32, exterior IP65, brillo en nits, escaneo 1/8 o 1/4, alimentación 5 V.

## Mando de PS4

- El DualShock 4 usa Bluetooth clásico. El **ESP32-S3 no lo tiene** (solo BLE); solo el ESP32 original lo soporta ([FAQ de Bluepad32](https://bluepad32.readthedocs.io/en/latest/FAQ/)). Librería: [Bluepad32](https://github.com/ricardoquesada/bluepad32).
- No hace falta cambiar el S3 que ya funciona. Opciones para añadir botones:
  1. **Botones físicos cableados** a pines libres del S3 (5–15 €, lo más fiable).
  2. **Mando casero** con otro ESP32 y botones por ESP-NOW (~10 €).
  3. **Mando de PS4 con puente**: un ESP32 original (~5–8 €) empareja el mando y pasa las órdenes al S3 por UART.
  4. **El propio móvil** como botonera por WiFi (0 €, para probar).
- **Conexión entre ambos ESP32 (opción 3):** por cable con UART, 3 hilos (TX→RX, GND, y 5 V opcional); ambos a 3,3 V, sin conversor, 10–20 cm dentro de la caja estanca. Inalámbrica con ESP-NOW también es posible, pero comparte radio con el Bluetooth del ESP32 original y hay que probarla.
- Propuesta de botones del mando: ✕ siguiente serie · ○ serie anterior · ▲ fijo/scroll · □ limpiar · cruceta ↑/↓ scroll · ←/→ cambiar de página (más de 8 nadadores) · L1/R1 brillo −/+ · Options encender/apagar.
- El retraso del Bluetooth (decenas de ms) hace que el mando sirva mejor para **mostrar y navegar** que para cronometrar; los tiempos se siguen tomando en el móvil.

## Pendiente de decidir

1. Qué placa controladora tiene exactamente (nombre o enlace) para fijar los pines libres.
2. Cómo funciona ahora (Arduino, WLED u otro) y si ya muestra los tiempos de la app.
3. Qué deben hacer los botones: lista de acciones, y si habrá un botón por calle para parar tiempos.
4. Piscina cubierta o descubierta, número de calles y distancia de lectura.
5. Opción final de paneles (A, B o C) y proveedor.

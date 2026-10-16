/* Iconos de línea (DESIGN.md §6): rejilla 24, trazo 1.75, puntas y uniones redondas, sin relleno.
   El sprite se inserta una vez en la página; se usan con ico('nombre'). */
const ICONOS = (() => {
  const dibujos = {
    'nadador': '<circle cx="17" cy="6" r="2"/><path d="M3 13l5-3 3 2 4-3"/><path d="M2 18c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1"/>',
    'crono': '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M10 2h4M12 2v3"/>',
    'tendencia': '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    'barras': '<path d="M4 20V12h4v8M10 20V6h4v14M16 20v-5h4v5"/>',
    'meta': '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    'carriles': '<path d="M3 6h18M3 12h18M3 18h18"/><circle cx="6" cy="6" r="1"/><circle cx="12" cy="6" r="1"/><circle cx="18" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>',
    'relevo': '<path d="M4 8h12l-3-3M20 16H8l3 3"/>',
    'grupo': '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.5c3 0 6 1.8 6 5"/>',
    'balanza': '<path d="M12 3v18M5 7l-3 6h6zM19 7l-3 6h6zM5 7h14"/>',
    'medalla': '<path d="M8 3l4 6 4-6"/><circle cx="12" cy="15" r="5"/><path d="M12 13v4"/>',
    'copa': '<path d="M7 4h10v5a5 5 0 01-10 0zM7 6H4a3 3 0 003 4M17 6h3a3 3 0 01-3 4M12 14v4M8 20h8"/>',
    'diana': '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8"/>',
    'lupa': '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    'gota': '<path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z"/>',
    'historia': '<path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    'flecha-atras': '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  };
  const trazo = 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
    Object.entries(dibujos).map(([n, d]) => `<symbol id="i-${n}" viewBox="0 0 24 24" ${trazo}>${d}</symbol>`).join('') +
    '</defs></svg>';
})();
const ico = (nombre, cls = '') => `<svg class="ico ${cls}"><use href="#i-${nombre}"/></svg>`;

/* Estilo de una prueba ('100 Espalda' → 'espalda'); da la franja de color de DESIGN.md §3 */
const estiloDe = ev => {
  const e = String(ev).toLowerCase();
  return e.includes('espalda') ? 'espalda' : e.includes('braza') ? 'braza' : e.includes('mariposa') ? 'mariposa'
    : e.includes('estilos') ? 'estilos' : 'libre';
};
const franja = ev => `<i class="franja e-${estiloDe(ev)}"></i>`;

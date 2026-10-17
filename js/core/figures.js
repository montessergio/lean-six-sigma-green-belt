/**
 * figures.js — Figuras SVG generadas desde datos (sin imágenes binarias).
 *
 * Cada figura es una función (params) → SVGElement registrada en FIGURAS. Para agregar
 * una figura nueva basta con añadirla al registro; el contenido la invoca por nombre:
 *   { "tipo": "figura", "figura": "campana", "params": { "mu": 50, "sigma": 4 } }
 */
import { s } from './dom.js';
import { COLOR } from './config.js';
import { normalPdf, normalSf } from '../lib/stats.js';

let contador = 0;
const idUnico = (pref) => `${pref}-${++contador}`;

const rad = (g) => (g * Math.PI) / 180;
const pt = (r, g) => [r * Math.cos(rad(g)), r * Math.sin(rad(g))];
const f = (n) => Math.round(n * 100) / 100;

/** Parte un texto en líneas de a lo sumo `max` caracteres. */
function partir(texto, max) {
  const lineas = [];
  let actual = '';
  for (const palabra of String(texto).split(/\s+/)) {
    if (actual && `${actual} ${palabra}`.length > max) {
      lineas.push(actual);
      actual = palabra;
    } else actual = actual ? `${actual} ${palabra}` : palabra;
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/** Texto multilínea centrado en (x, y). */
function textoMulti(x, y, lineas, { tam = 13, color = COLOR.blanco, peso = 500, interlinea = 1.25, ancla = 'middle', familia } = {}) {
  const t = s('text', { x, y: y - ((lineas.length - 1) * tam * interlinea) / 2, 'text-anchor': ancla, 'dominant-baseline': 'central', fill: color, 'font-size': tam, 'font-weight': peso, 'font-family': familia ?? 'Inter, system-ui, sans-serif' });
  lineas.forEach((l, i) => t.appendChild(s('tspan', { x, dy: i === 0 ? 0 : tam * interlinea, texto: l })));
  return t;
}

/* ------------------------------------------------------------------ */
/* Rueda DMAIC (identidad de la portada)                                */
/* ------------------------------------------------------------------ */

const FASES_RUEDA = [
  { id: 'definir', texto: 'Definir', color: '#4a79c9' },
  { id: 'medir', texto: 'Medir', color: '#2e75b6' },
  { id: 'analizar', texto: 'Analizar', color: '#c2570c' },
  { id: 'mejorar', texto: 'Mejorar', color: '#2a8c82' },
  { id: 'controlar', texto: 'Controlar', color: '#8a8a8a' },
];

/**
 * Cinco flechas curvas de trazo fino alrededor de «DMAIC», como en la portada del libro.
 * params: { color, trazo, resaltar (id de fase), etiquetas (bool), centro (texto) }
 */
function rueda({ color = '#b2b8b8', trazo = 1.6, resaltar = null, etiquetas = true, centro = 'DMAIC', relleno = 'rgba(178,184,184,0.03)' } = {}) {
  const base = idUnico('rueda');
  const R = 236;
  const r = 184;
  const rMed = (R + r) / 2;
  const barba = 15;
  const svg = s('svg', { viewBox: '-290 -290 580 580', role: 'img', 'aria-label': 'Ciclo DMAIC: Definir, Medir, Analizar, Mejorar, Controlar', class: 'figura-rueda' });
  FASES_RUEDA.forEach((fase, i) => {
    const centroGrados = -90 + 72 * i;
    const a0 = centroGrados - 33;
    const aBase = centroGrados + 21;
    const aPunta = centroGrados + 34;
    const [x1, y1] = pt(R, a0);
    const [x2, y2] = pt(R, aBase);
    const [x3, y3] = pt(R + barba, aBase);
    const [x4, y4] = pt(rMed, aPunta);
    const [x5, y5] = pt(r - barba, aBase);
    const [x6, y6] = pt(r, aBase);
    const [x7, y7] = pt(r, a0);
    const d = `M${f(x1)} ${f(y1)} A${R} ${R} 0 0 1 ${f(x2)} ${f(y2)} L${f(x3)} ${f(y3)} L${f(x4)} ${f(y4)} L${f(x5)} ${f(y5)} L${f(x6)} ${f(y6)} A${r} ${r} 0 0 0 ${f(x7)} ${f(y7)} Z`;
    const activa = resaltar === fase.id;
    svg.appendChild(s('path', { d, fill: activa ? fase.color : relleno, stroke: activa ? fase.color : color, 'stroke-width': trazo, 'stroke-linejoin': 'round' }));
    if (!etiquetas) return;
    // Texto sobre el arco: en la mitad inferior se invierte el sentido para que se lea derecho.
    const abajo = Math.sin(rad(centroGrados)) > 0.35;
    const tam = 21;
    const radioTexto = abajo ? rMed + tam * 0.34 : rMed - tam * 0.34;
    const aIni = centroGrados - 30;
    const aFin = centroGrados + 18;
    const [ax, ay] = pt(radioTexto, abajo ? aFin : aIni);
    const [bx, by] = pt(radioTexto, abajo ? aIni : aFin);
    const idArco = `${base}-${fase.id}`;
    svg.appendChild(s('path', { id: idArco, d: `M${f(ax)} ${f(ay)} A${f(radioTexto)} ${f(radioTexto)} 0 0 ${abajo ? 0 : 1} ${f(bx)} ${f(by)}`, fill: 'none', stroke: 'none' }));
    const t = s('text', { fill: activa ? '#fff' : color, 'font-family': 'Montserrat, Inter, sans-serif', 'font-size': tam, 'letter-spacing': '1.6', 'font-weight': 500 });
    const tp = s('textPath', { href: `#${idArco}`, startOffset: '50%', 'text-anchor': 'middle' });
    tp.textContent = fase.texto;
    t.appendChild(tp);
    svg.appendChild(t);
  });
  if (centro) {
    svg.appendChild(s('text', { x: 0, y: 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: color, 'font-family': 'Montserrat, Inter, sans-serif', 'font-size': 46, 'font-weight': 700, texto: centro }));
  }
  return svg;
}

/* ------------------------------------------------------------------ */
/* Sello dorado                                                         */
/* ------------------------------------------------------------------ */

function sello({ arriba = 'CASO APLICADO', abajo = 'LABORATORIOS INTERACTIVOS', simbolo = 'σ' } = {}) {
  const base = idUnico('sello');
  const svg = s('svg', { viewBox: '-110 -110 220 220', role: 'img', 'aria-label': `Sello: ${arriba} ${abajo}`, class: 'figura-sello' });
  svg.appendChild(s('circle', { r: 104, fill: '#917843' }));
  svg.appendChild(s('circle', { r: 104, fill: 'none', stroke: '#b99b57', 'stroke-width': 1.2, opacity: 0.5 }));
  svg.appendChild(s('circle', { r: 64, fill: 'none', stroke: '#16181a', 'stroke-width': 1.6 }));
  const rTexto = 83;
  svg.appendChild(s('path', { id: `${base}-a`, d: `M${-rTexto} 0 A${rTexto} ${rTexto} 0 0 1 ${rTexto} 0`, fill: 'none' }));
  svg.appendChild(s('path', { id: `${base}-b`, d: `M${-(rTexto + 9)} 0 A${rTexto + 9} ${rTexto + 9} 0 0 0 ${rTexto + 9} 0`, fill: 'none' }));
  const estilo = { fill: '#15181a', 'font-family': 'Montserrat, Inter, sans-serif', 'font-size': 12.5, 'font-weight': 700, 'letter-spacing': '1.5' };
  const ta = s('text', estilo);
  const pa = s('textPath', { href: `#${base}-a`, startOffset: '50%', 'text-anchor': 'middle' });
  pa.textContent = arriba;
  ta.appendChild(pa);
  const tb = s('text', estilo);
  const pb = s('textPath', { href: `#${base}-b`, startOffset: '50%', 'text-anchor': 'middle' });
  pb.textContent = abajo;
  tb.appendChild(pb);
  svg.append(ta, tb);
  svg.appendChild(s('text', { x: 0, y: 4, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#15181a', 'font-family': 'Georgia, "Times New Roman", serif', 'font-size': 82, 'font-weight': 700, texto: simbolo }));
  return svg;
}

/* ------------------------------------------------------------------ */
/* Campana normal con la regla empírica                                 */
/* ------------------------------------------------------------------ */

/**
 * Distribución normal con bandas ±1σ, ±2σ, ±3σ sombreadas.
 * params: { mu, sigma, bandas:[1,2,3], decimales, unidad }
 */
function campana({ mu = 0, sigma = 1, bandas = [1, 2, 3], decimales = 0, unidad = '' } = {}) {
  const W = 760;
  const H = 330;
  const m = { l: 30, r: 30, t: 24, b: 70 };
  const ancho = W - m.l - m.r;
  const alto = H - m.t - m.b;
  const zMax = 4;
  const X = (z) => m.l + ((z + zMax) / (2 * zMax)) * ancho;
  const Y = (z) => m.t + alto - (normalPdf(z) / normalPdf(0)) * alto * 0.96;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Distribución normal con la regla empírica 68-95-99.7' });
  const yBase = m.t + alto;
  const pasos = 160;
  const trozo = (z0, z1) => {
    let d = `M${f(X(z0))} ${f(yBase)}`;
    for (let i = 0; i <= pasos; i++) {
      const z = z0 + ((z1 - z0) * i) / pasos;
      d += ` L${f(X(z))} ${f(Y(z))}`;
    }
    return `${d} L${f(X(z1))} ${f(yBase)} Z`;
  };
  const opacidad = { 1: 0.5, 2: 0.3, 3: 0.16 };
  [...bandas].sort((a, b) => b - a).forEach((k) => {
    svg.appendChild(s('path', { d: trozo(-k, k), fill: COLOR.teal, 'fill-opacity': opacidad[k] ?? 0.2, stroke: 'none' }));
  });
  let curva = '';
  for (let i = 0; i <= 200; i++) {
    const z = -zMax + (2 * zMax * i) / 200;
    curva += `${i === 0 ? 'M' : 'L'}${f(X(z))} ${f(Y(z))} `;
  }
  svg.appendChild(s('path', { d: curva, fill: 'none', stroke: COLOR.blanco, 'stroke-width': 2 }));
  svg.appendChild(s('line', { x1: m.l, x2: W - m.r, y1: yBase, y2: yBase, stroke: COLOR.linea2, 'stroke-width': 1.2 }));
  const fmt = (v) => `${v.toFixed(decimales)}${unidad}`;
  for (let k = -3; k <= 3; k++) {
    svg.appendChild(s('line', { x1: X(k), x2: X(k), y1: yBase, y2: yBase + 6, stroke: COLOR.gris }));
    svg.appendChild(s('text', { x: X(k), y: yBase + 22, 'text-anchor': 'middle', fill: COLOR.gris, 'font-size': 12, 'font-family': 'JetBrains Mono, monospace', texto: k === 0 ? 'μ' : `${k > 0 ? '+' : '−'}${Math.abs(k)}σ` }));
    svg.appendChild(s('text', { x: X(k), y: yBase + 40, 'text-anchor': 'middle', fill: '#fff', 'font-size': 13, 'font-weight': 600, 'font-family': 'JetBrains Mono, monospace', texto: fmt(mu + k * sigma) }));
  }
  const etiquetas = { 1: '≈ 68 %', 2: '≈ 95 %', 3: '≈ 99.7 %' };
  const alturas = { 1: yBase - alto * 0.5, 2: yBase - alto * 0.2, 3: yBase - alto * 0.05 };
  bandas.forEach((k) => {
    const yFlecha = alturas[k] ?? yBase - 20;
    svg.appendChild(s('line', { x1: X(-k) + 2, x2: X(k) - 2, y1: yFlecha, y2: yFlecha, stroke: '#fff', 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: 0.7 }));
    svg.appendChild(s('text', { x: X(0), y: yFlecha - 6, 'text-anchor': 'middle', fill: '#fff', 'font-size': 13, 'font-weight': 700, 'font-family': 'JetBrains Mono, monospace', texto: `μ ± ${k}σ  ${etiquetas[k] ?? ''}` }));
  });
  return svg;
}

/* ------------------------------------------------------------------ */
/* Desplazamiento de 1.5σ: corto plazo vs largo plazo                   */
/* ------------------------------------------------------------------ */

/** params: { nivel (σ de corto plazo), desplazamiento } */
function curvaSigma({ nivel = 6, desplazamiento = 1.5 } = {}) {
  const W = 760;
  const H = 300;
  const m = { l: 24, r: 24, t: 30, b: 54 };
  const ancho = W - m.l - m.r;
  const alto = H - m.t - m.b;
  const zMin = -4.2;
  const zMax = nivel + 1.6;
  const X = (z) => m.l + ((z - zMin) / (zMax - zMin)) * ancho;
  const yBase = m.t + alto;
  const Y = (z, mu) => yBase - normalPdf(z, mu, 1) * (alto / normalPdf(0)) * 0.95;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Curva de corto plazo y curva de largo plazo desplazada 1.5 sigmas hacia el límite de especificación' });
  const traza = (mu, color, ancho2, dash) => {
    let d = '';
    for (let i = 0; i <= 240; i++) {
      const z = zMin + ((zMax - zMin) * i) / 240;
      d += `${i === 0 ? 'M' : 'L'}${f(X(z))} ${f(Y(z, mu))} `;
    }
    return s('path', { d, fill: 'none', stroke: color, 'stroke-width': ancho2, 'stroke-dasharray': dash ?? null });
  };
  // Cola de largo plazo más allá del límite
  const limite = nivel;
  let cola = `M${f(X(limite))} ${f(yBase)}`;
  for (let i = 0; i <= 60; i++) {
    const z = limite + ((zMax - limite) * i) / 60;
    cola += ` L${f(X(z))} ${f(Y(z, desplazamiento))}`;
  }
  cola += ` L${f(X(zMax))} ${f(yBase)} Z`;
  svg.appendChild(s('path', { d: cola, fill: COLOR.coral, 'fill-opacity': 0.85 }));
  svg.appendChild(traza(0, COLOR.gris, 1.8, '5 4'));
  svg.appendChild(traza(desplazamiento, COLOR.teal, 2.2));
  svg.appendChild(s('line', { x1: m.l, x2: W - m.r, y1: yBase, y2: yBase, stroke: COLOR.linea2 }));
  svg.appendChild(s('line', { x1: X(limite), x2: X(limite), y1: m.t - 6, y2: yBase + 4, stroke: COLOR.ambar, 'stroke-width': 1.6 }));
  svg.appendChild(s('text', { x: X(limite) - 6, y: m.t + 6, 'text-anchor': 'end', fill: COLOR.ambar, 'font-size': 12, 'font-weight': 700, 'font-family': 'JetBrains Mono, monospace', texto: `LSE = ${nivel}σ` }));
  for (const z of [0, desplazamiento]) {
    svg.appendChild(s('line', { x1: X(z), x2: X(z), y1: yBase - 6, y2: yBase + 6, stroke: z === 0 ? COLOR.gris : COLOR.teal, 'stroke-width': 1.5 }));
  }
  svg.appendChild(s('text', { x: X(0), y: yBase + 24, 'text-anchor': 'middle', fill: COLOR.gris, 'font-size': 12, 'font-family': 'JetBrains Mono, monospace', texto: 'media de corto plazo' }));
  svg.appendChild(s('text', { x: X(desplazamiento) + 4, y: yBase + 42, 'text-anchor': 'start', fill: COLOR.teal, 'font-size': 12, 'font-family': 'JetBrains Mono, monospace', texto: `media de largo plazo (+${desplazamiento}σ)` }));
  const dpmo = normalSf(nivel - desplazamiento) * 1e6;
  const txt = dpmo >= 1000 ? Math.round(dpmo).toLocaleString('en-US') : dpmo.toFixed(dpmo >= 100 ? 0 : 1);
  svg.appendChild(s('text', { x: X(limite) + 10, y: yBase - 34, 'text-anchor': 'start', fill: COLOR.coral, 'font-size': 14, 'font-weight': 700, 'font-family': 'JetBrains Mono, monospace', texto: `≈ ${txt} DPMO` }));
  return svg;
}

/* ------------------------------------------------------------------ */
/* Árbol CTQ                                                            */
/* ------------------------------------------------------------------ */

/**
 * params: { necesidad, impulsores: [{ texto, ctq }] }  (tres niveles, de izquierda a derecha)
 */
function arbol({ voz = '', necesidad = '', impulsores = [] } = {}) {
  const n = Math.max(impulsores.length, 1);
  const filaH = 86;
  const H = Math.max(190, n * filaH + 44);
  const W = 820;
  const cajaW = 220;
  const xs = [0, 300, 600].map((x) => x + 0);
  const svg = s('svg', { viewBox: `-10 0 ${W} ${H}`, role: 'img', 'aria-label': 'Árbol CTQ: necesidad, impulsores y CTQ medibles' });
  const cabeceras = ['NECESIDAD DEL CLIENTE', 'IMPULSOR (DRIVER)', 'CTQ MEDIBLE'];
  cabeceras.forEach((t, i) => svg.appendChild(s('text', { x: xs[i] + cajaW / 2, y: 14, 'text-anchor': 'middle', fill: COLOR.gris, 'font-size': 10.5, 'font-weight': 700, 'letter-spacing': '1.6', 'font-family': 'Inter, sans-serif', texto: t })));
  const caja = (x, y, h, lineas, borde, relleno = '#0f1819') => {
    svg.appendChild(s('rect', { x, y, width: cajaW, height: h, rx: 7, fill: relleno, stroke: borde, 'stroke-width': 1.4 }));
    svg.appendChild(textoMulti(x + cajaW / 2, y + h / 2, lineas, { tam: 12.5 }));
  };
  const yCentro = (i) => 34 + i * filaH + (filaH - 10) / 2;
  const yMedio = 34 + ((n - 1) * filaH) / 2 + (filaH - 10) / 2;
  const hNec = 70;
  caja(xs[0], yMedio - hNec / 2, hNec, partir(necesidad || voz, 26), COLOR.azul);
  impulsores.forEach((imp, i) => {
    const yc = yCentro(i);
    const h = 60;
    svg.appendChild(s('path', { d: `M${xs[0] + cajaW} ${yMedio} C${xs[0] + cajaW + 40} ${yMedio}, ${xs[1] - 40} ${yc}, ${xs[1]} ${yc}`, fill: 'none', stroke: COLOR.linea2, 'stroke-width': 1.5 }));
    caja(xs[1], yc - h / 2, h, partir(imp.texto, 26), COLOR.violeta);
    svg.appendChild(s('path', { d: `M${xs[1] + cajaW} ${yc} H${xs[2]}`, fill: 'none', stroke: COLOR.linea2, 'stroke-width': 1.5 }));
    caja(xs[2], yc - h / 2, h, partir(imp.ctq, 26), COLOR.teal);
  });
  return svg;
}

/* ------------------------------------------------------------------ */
/* Símbolos de diagrama de flujo (ISO 5807, M3A §2)                     */
/* ------------------------------------------------------------------ */

function simbolosFlujo() {
  const svg = s('svg', { viewBox: '0 0 760 150', role: 'img', 'aria-label': 'Símbolos básicos de un diagrama de flujo: inicio/fin, proceso, decisión y datos' });
  const items = [
    { x: 10, nombre: 'Inicio / fin', forma: (x) => s('rect', { x, y: 30, width: 130, height: 56, rx: 28, fill: '#0f1819', stroke: COLOR.teal, 'stroke-width': 1.6 }) },
    { x: 200, nombre: 'Proceso', forma: (x) => s('rect', { x, y: 30, width: 130, height: 56, rx: 4, fill: '#0f1819', stroke: COLOR.azul, 'stroke-width': 1.6 }) },
    { x: 390, nombre: 'Decisión', forma: (x) => s('path', { d: `M${x + 65} 22 L${x + 130} 58 L${x + 65} 94 L${x} 58 Z`, fill: '#0f1819', stroke: COLOR.ambar, 'stroke-width': 1.6 }) },
    { x: 580, nombre: 'Datos / registro', forma: (x) => s('path', { d: `M${x + 20} 30 H${x + 140} L${x + 120} 86 H${x} Z`, fill: '#0f1819', stroke: COLOR.violeta, 'stroke-width': 1.6 }) },
  ];
  for (const it of items) {
    svg.appendChild(it.forma(it.x));
    svg.appendChild(s('text', { x: it.x + 65, y: 128, 'text-anchor': 'middle', fill: COLOR.gris, 'font-size': 13, 'font-family': 'Inter, sans-serif', texto: it.nombre }));
  }
  return svg;
}

/* ------------------------------------------------------------------ */
/* SIPOC (M3A §1)                                                       */
/* ------------------------------------------------------------------ */

/**
 * Cinco columnas: proveedores → entradas → proceso (pasos numerados) → salidas → clientes.
 * params: { proveedores:[], entradas:[], pasos:[], salidas:[], clientes:[] }  (listas de texto)
 */
function sipoc({ proveedores = [], entradas = [], pasos = [], salidas = [], clientes = [] } = {}) {
  const columnas = [
    { titulo: 'S · PROVEEDORES', items: proveedores, color: COLOR.violeta },
    { titulo: 'I · ENTRADAS', items: entradas, color: COLOR.azul },
    { titulo: 'P · PROCESO', items: pasos, color: COLOR.teal, numerar: true },
    { titulo: 'O · SALIDAS', items: salidas, color: COLOR.ambar },
    { titulo: 'C · CLIENTES', items: clientes, color: COLOR.coral },
  ];
  const colW = 150;
  const hueco = 28;
  const W = colW * 5 + hueco * 4;
  const filaH = 48;
  const cajaH = 40;
  const filas = Math.max(1, ...columnas.map((c) => c.items.length));
  const H = 38 + filas * filaH;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Diagrama SIPOC: proveedores, entradas, proceso, salidas y clientes' });
  columnas.forEach((col, c) => {
    const x = c * (colW + hueco);
    svg.appendChild(s('text', { x: x + colW / 2, y: 14, 'text-anchor': 'middle', fill: col.color, 'font-size': 10.5, 'font-weight': 700, 'letter-spacing': '1.4', 'font-family': 'Inter, sans-serif', texto: col.titulo }));
    if (!col.items.length) {
      svg.appendChild(s('rect', { x, y: 30, width: colW, height: cajaH, rx: 6, fill: 'none', stroke: COLOR.linea2, 'stroke-dasharray': '4 4' }));
      svg.appendChild(s('text', { x: x + colW / 2, y: 30 + cajaH / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: COLOR.gris, 'font-size': 11, 'font-family': 'Inter, sans-serif', texto: '(sin capturar)' }));
    }
    col.items.forEach((texto, i) => {
      const y = 30 + i * filaH;
      if (col.numerar && i > 0) svg.appendChild(s('path', { d: `M${x + colW / 2} ${y - (filaH - cajaH)} V${y}`, stroke: col.color, 'stroke-width': 1.4, opacity: 0.8 }));
      svg.appendChild(s('rect', { x, y, width: colW, height: cajaH, rx: 6, fill: '#0f1819', stroke: col.color, 'stroke-width': 1.3 }));
      const lineas = partir(texto, col.numerar ? 17 : 21).slice(0, 2);
      const largo = partir(texto, col.numerar ? 17 : 21).length > 2;
      if (largo) lineas[1] = `${lineas[1].slice(0, Math.max(0, lineas[1].length - 1))}…`;
      svg.appendChild(textoMulti(x + (col.numerar ? colW / 2 + 9 : colW / 2), y + cajaH / 2, lineas, { tam: 11.5 }));
      if (col.numerar) {
        svg.appendChild(s('circle', { cx: x + 17, cy: y + cajaH / 2, r: 10, fill: 'none', stroke: col.color, 'stroke-width': 1.3 }));
        svg.appendChild(s('text', { x: x + 17, y: y + cajaH / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: col.color, 'font-size': 11, 'font-weight': 700, 'font-family': 'JetBrains Mono, monospace', texto: String(i + 1) }));
      }
    });
    if (c < 4) {
      const xf = x + colW + hueco / 2;
      const yf = 30 + (filas * filaH - (filaH - cajaH)) / 2;
      svg.appendChild(s('path', { d: `M${xf - 4} ${yf - 7} L${xf + 4} ${yf} L${xf - 4} ${yf + 7}`, fill: 'none', stroke: COLOR.gris, 'stroke-width': 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    }
  });
  return svg;
}

/* ------------------------------------------------------------------ */
/* Registro                                                             */
/* ------------------------------------------------------------------ */

export const FIGURAS = {
  rueda,
  sello,
  campana,
  'curva-sigma': curvaSigma,
  arbol,
  'simbolos-flujo': simbolosFlujo,
  sipoc,
};

/** Crea una figura por nombre; si no existe devuelve un SVG con un aviso legible. */
export function crearFigura(nombre, params = {}) {
  const generador = FIGURAS[nombre];
  if (!generador) {
    const svg = s('svg', { viewBox: '0 0 400 60' });
    svg.appendChild(s('text', { x: 10, y: 34, fill: COLOR.coral, 'font-size': 14, texto: `Figura desconocida: «${nombre}»` }));
    return svg;
  }
  return generador(params);
}

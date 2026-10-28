/**
 * figures.js — Figuras SVG generadas desde datos (sin imágenes binarias).
 *
 * Cada figura es una función (params) → SVGElement registrada en FIGURAS. Para agregar
 * una figura nueva basta con añadirla al registro; el contenido la invoca por nombre:
 *   { "tipo": "figura", "figura": "campana", "params": { "mu": 50, "sigma": 4 } }
 */
import { s } from './dom.js';
import { COLOR, COLOR_6M } from './config.js';
import { CATEGORIAS_6M } from '../lib/analizar.js';
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
  const cajaW = 220;
  const xs = [0, 300, 600];
  const W = xs[2] + cajaW + 20; // cabe la última caja con su trazo y un margen a cada lado
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
  // Cada texto se parte en líneas; si alguno necesita tres, todas las cajas crecen para no recortar nada.
  const MAX_LINEAS = 3;
  const partidas = columnas.map((col) => col.items.map((t) => partir(t, col.numerar ? 17 : 21)));
  const lineasMax = Math.min(MAX_LINEAS, Math.max(2, ...partidas.flat().map((l) => l.length)));
  const cajaH = lineasMax > 2 ? 54 : 40;
  const filaH = cajaH + 8;
  const filas = Math.max(1, ...columnas.map((c) => c.items.length));
  const H = 38 + filas * filaH;
  const svg = s('svg', { viewBox: `-2 -2 ${W + 4} ${H + 4}`, role: 'img', 'aria-label': 'Diagrama SIPOC: proveedores, entradas, proceso, salidas y clientes' });
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
      const todas = partidas[c][i];
      const lineas = todas.slice(0, lineasMax);
      if (todas.length > lineasMax) lineas[lineasMax - 1] = `${lineas[lineasMax - 1].slice(0, Math.max(0, lineas[lineasMax - 1].length - 1))}…`;
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
/* Ishikawa (M6 §2): espina de pescado con las 6M                        */
/* ------------------------------------------------------------------ */

/** Recorta a `max` líneas; si sobra texto, la última termina en «…» (el texto completo queda en el tooltip). */
function recortarLineas(texto, ancho, max) {
  const todas = partir(texto, ancho);
  const lineas = todas.slice(0, max);
  if (todas.length > max) lineas[max - 1] = `${lineas[max - 1].replace(/[\s.,;:]*$/, '').slice(0, Math.max(1, ancho - 1))}…`;
  return lineas;
}

/**
 * Espina de pescado: tres categorías (M) arriba de la espina y tres abajo, cada una con sus causas, y el efecto en la
 * cabeza. params: { efecto, causas: [{ categoria, causa, votos? }] } con categoria ∈ CATEGORIAS_6M. Con votos, van entre
 * paréntesis junto a cada causa y la(s) más votada(s) se resaltan en ámbar. Una M sin causas se rotula «sin causas».
 */
function ishikawa({ efecto = '', causas = [] } = {}) {
  const TAM = 12.5;
  const LH = 15;
  const CHARS = 24;
  const MAX_LINEAS = 3;
  const W = 880;
  const X_CABEZA = 716;
  const J = [245, 470, 695]; // dónde cada hueso toca la espina (los de arriba y los de abajo comparten x)
  const ETIQ_H = 26;
  const ETIQ_W = 124;
  const lista = (causas ?? [])
    .filter((c) => CATEGORIAS_6M.includes(c?.categoria) && String(c?.causa ?? '').trim())
    .map((c) => ({ categoria: c.categoria, causa: String(c.causa).trim(), votos: Number.isFinite(c.votos) ? c.votos : null }));
  const hayVotos = lista.some((c) => c.votos !== null);
  const maximo = Math.max(0, ...lista.map((c) => c.votos ?? 0));
  const ramas = CATEGORIAS_6M.map((nombre) => ({
    nombre,
    causas: lista.filter((c) => c.categoria === nombre).map((c) => {
      const lineas = recortarLineas(c.causa, CHARS, MAX_LINEAS);
      return { ...c, lineas, alto: lineas.length * LH + 10 };
    }),
  }));
  const contenido = Math.max(0, ...ramas.map((r) => r.causas.reduce((a, c) => a + c.alto, 0)));
  const hB = Math.max(120, contenido + 26); // alto de cada hueso (igual en las seis M)
  const dx = Math.min(50, Math.round(hB * 0.25));
  const y0 = ETIQ_H + hB; // y de la espina
  const H0 = 2 * y0;
  const H = H0 + (hayVotos ? 24 : 6);
  const resumen = `${lista.length} causas en las 6M`;
  const svg = s('svg', { viewBox: `-6 -2 ${W + 8} ${H + 4}`, role: 'img', 'aria-label': `Diagrama de Ishikawa (6M) del efecto «${efecto || 'sin definir'}»: ${resumen}` });
  const FUENTE = 'Inter, system-ui, sans-serif';

  // Espina y cabeza
  svg.appendChild(s('line', { x1: 14, y1: y0, x2: X_CABEZA - 12, y2: y0, stroke: COLOR.gris, 'stroke-width': 2.6, 'stroke-linecap': 'round' }));
  svg.appendChild(s('path', { d: `M${X_CABEZA} ${y0} L${X_CABEZA - 15} ${y0 - 7.5} L${X_CABEZA - 15} ${y0 + 7.5} Z`, fill: COLOR.gris }));
  const lineasEfecto = recortarLineas(String(efecto).trim() || '(escribe el efecto)', 15, 6);
  const hCabeza = Math.max(84, lineasEfecto.length * 17 + 30);
  const wCabeza = W - X_CABEZA - 2;
  svg.appendChild(s('text', { x: X_CABEZA + wCabeza / 2, y: y0 - hCabeza / 2 - 9, 'text-anchor': 'middle', fill: COLOR.gris, 'font-size': 10, 'font-weight': 700, 'letter-spacing': '1.6', 'font-family': FUENTE, texto: 'EFECTO (PROBLEMA)' }));
  svg.appendChild(s('rect', { x: X_CABEZA, y: y0 - hCabeza / 2, width: wCabeza, height: hCabeza, rx: 9, fill: '#0f1819', stroke: COLOR.blanco, 'stroke-width': 1.8 }));
  svg.appendChild(textoMulti(X_CABEZA + wCabeza / 2, y0, lineasEfecto, { tam: 13.5, peso: 600, interlinea: 1.25 }));

  // Las seis ramas
  ramas.forEach((rama, k) => {
    const arriba = k < 3;
    const xj = J[k % 3];
    const yExt = arriba ? ETIQ_H : y0 + hB;
    const xExt = xj - dx;
    const color = COLOR_6M[rama.nombre] ?? COLOR.gris;
    const vacia = rama.causas.length === 0;
    const xHueso = (y) => xj - dx * (Math.abs(y - y0) / hB);
    svg.appendChild(s('line', { x1: xj, y1: y0, x2: xExt, y2: yExt, stroke: COLOR.gris, 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0.8 }));
    const yEtiq = arriba ? 0 : yExt;
    svg.appendChild(s('rect', { x: xExt - ETIQ_W / 2, y: yEtiq, width: ETIQ_W, height: ETIQ_H, rx: 6, fill: '#0f1819', stroke: color, 'stroke-width': 1.7, opacity: vacia ? 0.6 : 1 }));
    svg.appendChild(s('text', { x: xExt, y: yEtiq + ETIQ_H / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: color, 'font-size': 12.5, 'font-weight': 700, 'font-family': FUENTE, texto: rama.nombre }));
    if (vacia) {
      const yv = arriba ? y0 - hB / 2 : y0 + hB / 2;
      svg.appendChild(s('text', { x: xHueso(yv) - 14, y: yv, 'text-anchor': 'end', 'dominant-baseline': 'central', fill: COLOR.gris, 'font-size': TAM, 'font-style': 'italic', 'font-family': FUENTE, opacity: 0.8, texto: 'sin causas' }));
      return;
    }
    let y = (arriba ? ETIQ_H : y0) + 13; // arriba y abajo se lee de arriba hacia abajo, en el orden capturado
    for (const c of rama.causas) {
      const yc = y + c.alto / 2;
      const xb = xHueso(yc);
      const destacada = hayVotos && maximo > 0 && c.votos === maximo;
      svg.appendChild(s('line', { x1: xb - 18, y1: yc, x2: xb, y2: yc, stroke: COLOR.gris, 'stroke-width': 1.2, opacity: 0.65 }));
      const t = s('text', { x: xb - 22, y: yc - ((c.lineas.length - 1) * LH) / 2, 'text-anchor': 'end', 'dominant-baseline': 'central', fill: destacada ? COLOR.ambar : COLOR.blanco, 'font-size': TAM, 'font-weight': destacada ? 700 : 500, 'font-family': FUENTE });
      c.lineas.forEach((l, i) => t.appendChild(s('tspan', { x: xb - 22, dy: i === 0 ? 0 : LH, texto: l })));
      if (c.votos !== null) t.appendChild(s('tspan', { fill: COLOR.ambar, 'font-family': 'JetBrains Mono, ui-monospace, monospace', 'font-weight': 700, texto: ` (${c.votos})` }));
      t.appendChild(s('title', { texto: `${c.causa}${c.votos !== null ? ` · ${c.votos} ${c.votos === 1 ? 'voto' : 'votos'}` : ''} · ${rama.nombre}` }));
      svg.appendChild(t);
      y += c.alto;
    }
  });
  if (hayVotos) {
    svg.appendChild(s('text', { x: 4, y: H0 + 17, fill: COLOR.gris, 'font-size': 11, 'font-family': FUENTE, texto: '(n) = votos del equipo · en ámbar, la causa más votada: es la primera que hay que verificar con datos.' }));
  }
  svg.style.setProperty('--ancho-min', '640px'); // en un laboratorio angosto la figura se desplaza en vez de encogerse hasta ser ilegible (labs.css)
  return svg;
}

/* ------------------------------------------------------------------ */
/* 5 Porqués (M6 §3): de la causa aparente a la causa raíz              */
/* ------------------------------------------------------------------ */

/**
 * Cadena vertical: problema → ¿por qué? 1 … n → causa raíz. A la derecha, cómo se verificó cada respuesta.
 * params: { problema, pasos: [{ respuesta, evidencia?, verificada? ('Sí'|'No') }], causaRaiz?, categoria? }
 * Las verificadas llevan borde verde continuo y marca de verificación; las demás, borde ámbar punteado.
 */
function porques({ problema = '', pasos = [], causaRaiz = '', categoria = '' } = {}) {
  const W = 810;
  const CAJA_W = 500;
  const EV_X = 526;
  const LH = 16;
  const CHARS = 62;
  const MAX_LINEAS = 3;
  const GAP = 36;
  const FUENTE = 'Inter, system-ui, sans-serif';
  const usados = (pasos ?? []).filter((p) => String(p?.respuesta ?? '').trim());
  const filas = [];
  if (String(problema).trim()) filas.push({ clase: 'problema', etiqueta: 'PROBLEMA', color: COLOR.coral, lineas: recortarLineas(String(problema).trim(), CHARS, MAX_LINEAS) });
  usados.forEach((p, i) => filas.push({
    clase: 'paso', n: i + 1, color: p.verificada === 'Sí' ? COLOR.verde : COLOR.ambar, verificada: p.verificada === 'Sí',
    lineas: recortarLineas(String(p.respuesta).trim(), CHARS, MAX_LINEAS), evidencia: String(p.evidencia ?? '').trim(),
  }));
  if (String(causaRaiz).trim()) filas.push({ clase: 'raiz', etiqueta: 'CAUSA RAÍZ', color: COLOR.teal, lineas: recortarLineas(String(causaRaiz).trim(), CHARS, MAX_LINEAS), categoria: String(categoria ?? '').trim() });
  const medidas = filas.map((f) => {
    const etiq = f.etiqueta ? 19 : 0;
    return { ...f, etiq, alto: Math.max(44, etiq + f.lineas.length * LH + 18) };
  });
  const H = medidas.reduce((a, f) => a + f.alto, 0) + GAP * Math.max(0, medidas.length - 1) + 6;
  const svg = s('svg', { viewBox: `-4 -2 ${W + 8} ${Math.max(60, H) + 4}`, role: 'img', 'aria-label': `Cadena de porqués: ${usados.length} ${usados.length === 1 ? 'paso' : 'pasos'} del problema a la causa raíz` });
  let y = 0;
  medidas.forEach((f, i) => {
    if (i > 0) {
      const xa = 30;
      svg.appendChild(s('line', { x1: xa, y1: y - GAP + 2, x2: xa, y2: y - 7, stroke: COLOR.gris, 'stroke-width': 1.5 }));
      svg.appendChild(s('path', { d: `M${xa - 5} ${y - 9} L${xa} ${y - 1} L${xa + 5} ${y - 9} Z`, fill: COLOR.gris }));
      svg.appendChild(s('text', { x: xa + 14, y: y - GAP / 2, 'dominant-baseline': 'central', fill: COLOR.gris, 'font-size': 11, 'font-style': 'italic', 'font-family': FUENTE, texto: f.clase === 'raiz' ? 'Conclusión' : `¿Por qué? ${f.n}` }));
    }
    const grueso = f.clase === 'raiz' ? 2.4 : 1.6;
    svg.appendChild(s('rect', { x: 0, y, width: CAJA_W, height: f.alto, rx: 8, fill: f.clase === 'raiz' ? 'rgba(44,209,182,0.08)' : '#0f1819', stroke: f.color, 'stroke-width': grueso, 'stroke-dasharray': f.clase === 'paso' && !f.verificada ? '6 4' : null }));
    if (f.etiqueta) svg.appendChild(s('text', { x: 16, y: y + 14, fill: f.color, 'font-size': 10, 'font-weight': 700, 'letter-spacing': '1.6', 'font-family': FUENTE, texto: f.etiqueta }));
    svg.appendChild(textoMulti(16, y + f.etiq + (f.alto - f.etiq) / 2, f.lineas, { tam: 12.5, ancla: 'start', peso: f.clase === 'raiz' ? 600 : 500, interlinea: 1.28 }));
    const yc = y + f.alto / 2;
    if (f.clase === 'paso') {
      const xm = EV_X + 9;
      svg.appendChild(s('circle', { cx: xm, cy: yc, r: 8, fill: 'none', stroke: f.color, 'stroke-width': 1.5, 'stroke-dasharray': f.verificada ? null : '3 2.5' }));
      if (f.verificada) svg.appendChild(s('path', { d: `M${xm - 4} ${yc} L${xm - 1} ${yc + 3.2} L${xm + 4.2} ${yc - 3.4}`, fill: 'none', stroke: f.color, 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      const evid = f.evidencia ? recortarLineas(f.evidencia, 36, 3) : [f.verificada ? '(sin evidencia escrita)' : '¿cómo se verificaría?'];
      const t = s('text', { x: EV_X + 26, y: yc - ((evid.length) * 14) / 2 + 4, 'dominant-baseline': 'central', 'font-family': FUENTE });
      t.appendChild(s('tspan', { x: EV_X + 26, fill: f.color, 'font-size': 11, 'font-weight': 700, texto: f.verificada ? 'Verificada' : 'Sin verificar' }));
      evid.forEach((l) => t.appendChild(s('tspan', { x: EV_X + 26, dy: 14, fill: f.evidencia ? COLOR.blanco : COLOR.gris, 'font-size': 11, 'font-style': f.evidencia ? null : 'italic', texto: l })));
      svg.appendChild(t);
    } else if (f.clase === 'raiz' && f.categoria) {
      svg.appendChild(s('text', { x: EV_X + 4, y: yc, 'dominant-baseline': 'central', fill: COLOR.teal, 'font-size': 11, 'font-weight': 700, 'font-family': FUENTE, texto: `Categoría: ${f.categoria}` }));
    }
    y += f.alto + GAP;
  });
  svg.style.setProperty('--ancho-min', '560px');
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
  ishikawa,
  porques,
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

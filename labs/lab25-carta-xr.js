/**
 * LAB 25 · Carta de control X̄-R
 *
 * Guía: M10 §1 y §2 (variación común y especial; cartas X̄ y R; tres reglas de causas especiales; excluir el subgrupo 12 y
 * recalcular) · plantilla Excel «Carta X-R» · ejercicios 1, 3 y 4 y pregunta 5 del examen del módulo.
 *   La carta R vigila la dispersión dentro de los subgrupos y la X̄ el movimiento de su promedio; se leen juntas y la R va primero,
 *   porque los límites de la X̄ salen de R̄:
 *     X̄:  LSC = X̿ + A₂·R̄    LIC = X̿ − A₂·R̄           R:  LSC = D₄·R̄    LIC = D₃·R̄
 *   Tres formas de capturar: las mediciones de cada subgrupo (como la plantilla; el laboratorio saca X̄ y R), la media y el rango
 *   de cada subgrupo (como la tabla de la guía) o solo X̿ y R̄ (los ejercicios). Reglas de la guía: 1 punto fuera de ±3σ; 2 de 3
 *   puntos seguidos más allá de 2σ del mismo lado; 9 seguidos del mismo lado de la línea central. La plantilla de Excel solo
 *   cuenta los puntos fuera de límites (regla 1): el laboratorio deja elegir.
 *   Excluir subgrupos: tras identificar y corregir una causa especial se quita el subgrupo y se recalculan los límites con los
 *   demás (la guía excluye el 12). El laboratorio muestra la primera pasada (todos los subgrupos) y la final (sin los excluidos).
 * Función pura de los datos capturados; la interfaz solo pinta lo que devuelve calcular().
 *
 * Presets: guía (15 subgrupos de media y rango; excluye el 12), plantilla Excel (25 × 5 mediciones; solo regla 1), y los ejercicios
 * 1 y 4 y la pregunta 5 del examen (solo X̿, R̄ y n). La guía publica solo la media y el rango de cada subgrupo, no las mediciones.
 */
import { COLOR } from '../js/core/config.js';
import { corto, entero, num, plural } from '../js/core/format.js';
import { cartaXR, constantesXR, leerSubgrupos, limitesXR, resumenSubgrupos, subgruposDeResumen, textoSenales } from '../js/lib/controlar.js';

const XB = 'X̄'; // X̄: media de un subgrupo
const GRAN = 'X̄̄'; // X̄̄: gran promedio, como en la plantilla
const RB = 'R̄'; // R̄: rango promedio
const MAX_SUBGRUPOS = 30;
const MODOS = ['resumen', 'mediciones', 'limites'];

const limpio = (t) => String(t ?? '').replace(/[<>]/g, '');
const fmt = (x) => num(x, 3);
const fmtCero = (x) => (x === 0 ? '0' : fmt(x)); // el límite inferior de R vale 0 con n ≤ 6
const listaCitada = (nombres, max = 4) => {
  const citados = nombres.slice(0, max);
  if (nombres.length > max) citados.push(`${nombres.length - max} más`);
  return citados.length > 1 ? `${citados.slice(0, -1).join(', ')} y ${citados[citados.length - 1]}` : citados[0] ?? '';
};
const subgrupos = (indices) => (indices.length === 1 ? `el subgrupo ${indices[0]}` : `los subgrupos ${listaCitada(indices.map(String), 6)}`);

/* ------------------------------------------------------------------ datos ------------------------------------------------------------------ */

// Guía M10 §2: 15 subgrupos de n = 5 de fuerza de engarzado (N), con el poka-yoke y la instrucción ya en operación. El 12 es el que
// marca †: un cambio de rollo de terminales sin verificar.
const GUIA_MEDIAS = [176.1, 176.26, 176.52, 175.12, 175.58, 175.48, 175.62, 176.28, 176.62, 176.76, 176.5, 171.54, 175.9, 176.4, 176.28];
const GUIA_RANGOS = [1.9, 3.7, 2.3, 4.1, 3.3, 4.2, 4.1, 2.7, 4.2, 5.7, 3.1, 2.8, 2.2, 3.9, 5.2];
const GUIA_RESUMEN = GUIA_MEDIAS.map((media, i) => ({ media, rango: GUIA_RANGOS[i] }));

// Hoja «Carta X-R» de la plantilla: n = 5 y 25 subgrupos (columnas X1 a X5).
const EXCEL_XR = [
  [169.7, 170.6, 169.7, 169.6, 168.9], [169.7, 171.3, 170.5, 171.2, 170.3], [170.5, 170.2, 168, 171, 170.6], [170.6, 168, 167.9, 168.9, 169.4],
  [170.4, 169.9, 170.6, 169.2, 170.4], [170.5, 169.2, 172.1, 170.7, 171.4], [169.3, 169.1, 169.6, 169.9, 170.8], [170.3, 169.5, 168.9, 169.4, 171.5],
  [169, 170.3, 170.5, 168.2, 170.1], [171.6, 167.6, 169.6, 169.9, 169], [170.6, 169.9, 168.2, 171, 170.8], [171.1, 171.7, 170.4, 170.1, 168.4],
  [170.7, 169.3, 169.5, 168.5, 168.8], [169.4, 171.5, 167.6, 168.3, 170.3], [171.7, 170.7, 167.7, 167, 170.4], [169.1, 168.7, 171.2, 171.3, 170.2],
  [173.9, 174.1, 175.5, 174.3, 174.2], [170.7, 168.1, 171.5, 171.1, 170.6], [167.6, 169.2, 171, 167.8, 169.8], [171.2, 168.4, 171.9, 170.7, 169.8],
  [170.4, 170.8, 170.1, 171.4, 169.2], [169.5, 171.3, 170, 168.9, 171.1], [171.8, 169.5, 168.3, 169.8, 169.8], [169.6, 171.7, 168.8, 171.5, 168.5],
  [169.1, 170.8, 171.4, 171, 170.4],
];
const MEDICIONES_EXCEL = EXCEL_XR.map((fila) => Object.fromEntries(fila.map((v, j) => [`x${j + 1}`, v])));
const filasVacias = (k) => Array.from({ length: k }, () => ({}));

// Todas las entradas, en este orden (n antes que la tabla de mediciones, cuyas columnas dependen de n); cada preset cambia lo suyo.
const BASE = { modo: 'resumen', n: '5', mediciones: filasVacias(5), resumen: filasVacias(5), gran: NaN, rbar: NaN, excluir: '', reglas: 'tres' };

/* ------------------------------------------------------------------ textos ------------------------------------------------------------------ */

const umbralDe = (n, activas = new Set()) => {
  const c = constantesXR(n);
  return {
    titulo: 'Cómo se lee una carta X̄-R',
    filas: [
      { rango: 'La carta R va primero', texto: `La R vigila la variación dentro de los subgrupos y los límites de la ${XB} se calculan con ${RB}: si la R tiene una señal, los límites de la ${XB} no son confiables y esa causa se revisa antes (guía M10 §2).` },
      { rango: 'Regla 1', texto: 'Un punto cae fuera de los límites de control (±3σ). Es la única regla que cuenta la plantilla de Excel.', activa: activas.has(1) },
      { rango: 'Regla 2', texto: 'Dos de tres puntos consecutivos caen más allá de 2σ, del mismo lado de la línea central. Aquí σ es un tercio de la distancia entre la línea central y el límite de control.', activa: activas.has(2) },
      { rango: 'Regla 3', texto: 'Nueve puntos consecutivos caen del mismo lado de la línea central: una tendencia sostenida que ningún punto individual delata (guía M10 §2, ejercicio 3).', activa: activas.has(3) },
      {
        rango: `Constantes, n = ${n}`,
        texto: `A₂ = ${c.A2} · D₃ = ${c.D3} · D₄ = ${c.D4}. ${XB}: ${GRAN} ± A₂·${RB}. R: LSC = D₄·${RB} y LIC = D₃·${RB}${c.D3 === 0 ? ' (con n ≤ 6, D₃ = 0: un rango no puede ser negativo)' : ''}.`,
      },
      { rango: 'Excluir un subgrupo', texto: 'Solo después de identificar y corregir su causa especial; entonces los límites se recalculan con los demás (la guía excluye el subgrupo 12, un cambio de rollo sin verificar). Sin causa asignable, el punto sigue siendo parte del proceso.' },
      { rango: '20 a 25 subgrupos', texto: 'La plantilla pide de 20 a 25 subgrupos para límites definitivos; con menos, los límites son preliminares. Una señal no confirma por sí sola una causa: investiga.' },
    ],
  };
};

const supuestoDe = (n) => ({
  titulo: 'Supuesto del método',
  texto:
    'Cada subgrupo debe reunir piezas hechas en condiciones casi iguales y cercanas en el tiempo, de modo que la variación dentro del subgrupo sea la común y las diferencias entre subgrupos revelen los cambios. ' +
    'Las constantes A₂, D₃ y D₄ suponen mediciones independientes y de forma aproximadamente normal. ' +
    'Los límites de control salen de los datos del proceso, no de la especificación del cliente: no son límites de tolerancia y un proceso puede estar bajo control y aun así producir piezas fuera de especificación. ' +
    'Y una señal no confirma por sí sola una causa especial: hay que investigarla (5 Porqués, LAB 16).',
  estado: 'informativo',
  detalle: `Constantes para n = ${n}: A₂ = ${constantesXR(n).A2}, D₃ = ${constantesXR(n).D3}, D₄ = ${constantesXR(n).D4}.`,
});

const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/* ------------------------------------------------------------------ gráficas ------------------------------------------------------------------ */

/** Una carta de control: línea de puntos, límites, línea central, señales y puntos excluidos. */
function cartaPlotly({ id, titulo, etiquetaY, nombreSerie, nombreCentro, puntos, valorDe, senalesDe, lim, primera, desdeCero, zonas }) {
  const xs = puntos.map((p) => p.indice);
  const x0 = Math.min(...xs) - 0.5;
  const x1 = Math.max(...xs) + 0.5;
  const recta = (y) => ({ x: [x0, x1], y: [y, y] });
  const hover = puntos.map((p) => {
    const senales = senalesDe(p);
    return [
      `<b>Subgrupo ${p.indice}</b>`,
      `${nombreSerie} = ${fmt(valorDe(p))}`,
      p.excluido ? 'Excluido del cálculo de los límites' : senales.length ? `Señal: ${textoSenales(senales, valorDe(p), lim)}` : 'En control',
    ].join('<br>');
  });
  const datos = [];
  if (primera) {
    datos.push({
      type: 'scatter', mode: 'lines', name: 'Límites con todos los subgrupos', x: [x0, x1, null, x0, x1], y: [primera.lsc, primera.lsc, null, primera.lic, primera.lic], connectgaps: false,
      line: { color: COLOR.violeta, width: 1.4, dash: 'dot' }, hoverinfo: 'skip',
    });
  }
  if (zonas) {
    datos.push({
      type: 'scatter', mode: 'lines', name: 'Zonas ±2σ (regla 2)', x: [x0, x1, null, x0, x1], y: [lim.cl + 2 * lim.sigma, lim.cl + 2 * lim.sigma, null, lim.cl - 2 * lim.sigma, lim.cl - 2 * lim.sigma], connectgaps: false,
      line: { color: COLOR.gris, width: 1, dash: 'dot' }, opacity: 0.7, hoverinfo: 'skip',
    });
  }
  datos.push({ type: 'scatter', mode: 'lines', name: `LSC ${fmt(lim.lsc)}`, ...recta(lim.lsc), line: { color: COLOR.coral, width: 1.6, dash: 'dash' }, hoverinfo: 'skip' });
  datos.push({ type: 'scatter', mode: 'lines', name: `LIC ${fmtCero(lim.lic)}`, ...recta(lim.lic), line: { color: COLOR.coral, width: 1.6, dash: 'dash' }, hoverinfo: 'skip' });
  datos.push({ type: 'scatter', mode: 'lines', name: `${nombreCentro} ${fmt(lim.cl)}`, ...recta(lim.cl), line: { color: COLOR.ambar, width: 1.5 }, hoverinfo: 'skip' });
  datos.push({
    type: 'scatter', mode: 'lines+markers', name: nombreSerie, x: xs, y: puntos.map(valorDe), line: { color: COLOR.teal, width: 1.6 },
    marker: { color: COLOR.teal, size: 7, line: { color: '#0a1011', width: 1 } }, customdata: hover, hovertemplate: '%{customdata}<extra></extra>',
  });
  const conSenal = puntos.filter((p) => !p.excluido && senalesDe(p).length);
  if (conSenal.length) {
    datos.push({
      type: 'scatter', mode: 'markers', name: 'Señal de causa especial', x: conSenal.map((p) => p.indice), y: conSenal.map(valorDe),
      marker: { symbol: 'diamond', size: 12, color: COLOR.coral, line: { color: '#0a1011', width: 1 } }, customdata: conSenal.map((p) => hover[puntos.indexOf(p)]), hovertemplate: '%{customdata}<extra></extra>',
    });
  }
  const excluidos = puntos.filter((p) => p.excluido);
  if (excluidos.length) {
    datos.push({
      type: 'scatter', mode: 'markers', name: 'Excluido (causa corregida)', x: excluidos.map((p) => p.indice), y: excluidos.map(valorDe),
      marker: { symbol: 'circle-open', size: 13, color: COLOR.blanco, line: { width: 2 } }, customdata: excluidos.map((p) => hover[puntos.indexOf(p)]), hovertemplate: '%{customdata}<extra></extra>',
    });
  }
  const k = xs.length ? Math.max(...xs) : 0;
  return {
    id, titulo, ancha: true,
    datos,
    layout: {
      xaxis: { title: { text: 'Subgrupo' }, range: [x0, x1], tick0: 0, dtick: k > 20 ? 5 : 1, zeroline: false },
      yaxis: { title: { text: etiquetaY }, rangemode: desdeCero ? 'tozero' : 'normal', zeroline: false },
      margin: { l: 64, r: 24, t: 40, b: 52 },
    },
    respaldo: {
      columnas: ['Subgrupo', nombreSerie, 'LIC', nombreCentro, 'LSC', 'Estado'],
      filas: puntos.map((p) => [
        String(p.indice), fmt(valorDe(p)), fmtCero(lim.lic), fmt(lim.cl), fmt(lim.lsc),
        p.excluido ? 'excluido' : senalesDe(p).length ? textoSenales(senalesDe(p), valorDe(p), lim) : 'en control',
      ]),
    },
  };
}

/* ------------------------------------------------------------------ laboratorio ------------------------------------------------------------------ */

export default function lab25() {
  const presets = [
    {
      id: 'guia', etiqueta: 'Guía M10 §2: 15 subgrupos de fuerza de engarzado (n = 5), sin el subgrupo 12',
      ayuda: `La tabla de la guía: la media y el rango de cada subgrupo. Con los 15, el subgrupo 12 (171.54 N) cae bajo el LIC; la guía encontró su causa (un cambio de rollo de terminales sin verificar), lo excluyó y recalculó con los 14 restantes: ${GRAN} = 176.10, ${RB} = 3.61, LSC = 178.19 y LIC = 174.02. Borra el 12 de «Subgrupos que se excluyen» para ver la primera pasada. La guía publica solo la media y el rango, no las mediciones.`,
      valores: { ...BASE, resumen: GUIA_RESUMEN, excluir: '12' },
    },
    {
      id: 'excel', etiqueta: 'Plantilla Excel «Carta X-R»: 25 subgrupos de 5 mediciones (solo la regla 1)',
      ayuda: `Las 125 mediciones de la hoja, con la regla que ella aplica: ${GRAN} = 170.122, ${RB} = 2.756, LSC X̄ = 171.713 y LIC X̄ = 168.532. Un punto sale: el subgrupo 17 (media 174.4, sobre el LSC). Escribe 17 en «Subgrupos que se excluyen» para recalcular o cambia a «las tres reglas» para ver si las reglas 2 y 3 encuentran algo más (aquí no).`,
      valores: { ...BASE, modo: 'mediciones', mediciones: MEDICIONES_EXCEL, reglas: 'una' },
    },
    {
      id: 'ej1', etiqueta: `Guía M10, ejercicio 1: ${GRAN} = 50 y ${RB} = 4 con n = 5`,
      ayuda: 'Con las constantes del módulo (A₂ = 0.577, D₃ = 0, D₄ = 2.114): LSC X̄ = 52.308, LIC X̄ = 47.692, LSC R = 8.456 y LIC R = 0.',
      valores: { ...BASE, modo: 'limites', gran: 50, rbar: 4 },
    },
    {
      id: 'ej4', etiqueta: `Guía M10, ejercicio 4 (sin resolver): ${GRAN} = 75 y ${RB} = 6 con n = 4`,
      ayuda: 'Subgrupos de 4 (A₂ = 0.729). Calcula tú los límites a mano y compáralos con lo que muestra el laboratorio; la clave de la guía está en el Apéndice C.',
      valores: { ...BASE, modo: 'limites', n: '4', gran: 75, rbar: 6 },
    },
    {
      id: 'examen5', etiqueta: `Examen M10, pregunta 5: ${GRAN} = 60 y ${RB} = 5 con n = 5`,
      ayuda: 'Pregunta de opción múltiple del examen del módulo: el LSC de la carta X̄.',
      valores: { ...BASE, modo: 'limites', gran: 60, rbar: 5 },
    },
  ];

  const mediaDeFila = (estado, fila) => {
    const s = resumenSubgrupos([fila], Number(estado.n)).subgrupos[0];
    return s ? corto(s.media, 3) : '';
  };
  const rangoDeFila = (estado, fila) => {
    const s = resumenSubgrupos([fila], Number(estado.n)).subgrupos[0];
    return s ? corto(s.rango, 3) : '';
  };

  return {
    id: 'lab25',
    numero: '25',
    modulo: 'M10',
    titulo: 'Carta de control X̄-R',
    resumen: 'Construye las cartas X̄ y R de un dato continuo medido en subgrupos: límites con A₂, D₃ y D₄, las tres reglas de causas especiales y el recálculo de los límites al excluir un subgrupo cuya causa ya se corrigió.',
    panelAncho: true,
    entradas: [
      {
        id: 'modo', tipo: 'opcion', etiqueta: 'Qué vas a capturar', valor: 'resumen',
        opciones: [
          { valor: 'resumen', texto: 'La media y el rango de cada subgrupo (como la guía)', ayuda: 'La tabla de la guía M10 §2: una fila por subgrupo con su media y su rango.' },
          { valor: 'mediciones', texto: 'Las mediciones de cada subgrupo (como la plantilla)', ayuda: 'Una fila por subgrupo con sus n mediciones; el laboratorio calcula la media y el rango de cada una.' },
          { valor: 'limites', texto: `Solo ${GRAN} y ${RB} (para calcular los límites)`, ayuda: 'Para los ejercicios: dados el gran promedio, el rango promedio y n, calcula los cuatro límites de control.' },
        ],
      },
      {
        id: 'n', tipo: 'opcion', etiqueta: 'Tamaño del subgrupo (n)', valor: '5',
        opciones: Array.from({ length: 9 }, (_, i) => ({ valor: String(i + 2), texto: String(i + 2) })),
        ayuda: 'Piezas medidas en cada subgrupo, de 2 a 10 (la tabla de constantes de la guía y de la plantilla). La guía y la plantilla usan 5.',
      },
      {
        id: 'mediciones', tipo: 'tabla', etiqueta: 'Mediciones de cada subgrupo (una fila por subgrupo)', visibleSi: (e) => e.modo === 'mediciones',
        columnas: (estado) => {
          const k = Number(estado.n);
          return [
            ...Array.from({ length: Number.isInteger(k) && k >= 2 && k <= 10 ? k : 5 }, (_, j) => ({ id: `x${j + 1}`, etiqueta: `X${j + 1}`, tipo: 'numero', ancho: '66px' })),
            { id: 'media', etiqueta: XB, tipo: 'fijo', ancho: '70px', ayuda: 'Media del subgrupo (solo si tiene sus n mediciones).', texto: mediaDeFila },
            { id: 'rango', etiqueta: 'R', tipo: 'fijo', ancho: '56px', ayuda: 'Rango del subgrupo: la medición mayor menos la menor.', texto: rangoDeFila },
          ];
        },
        filas: filasVacias(5), filaNueva: {}, minFilas: 2, maxFilas: MAX_SUBGRUPOS, filasVacias: 5, etiquetaAgregar: '+ Subgrupo',
        ayuda: `Hasta ${MAX_SUBGRUPOS} subgrupos (la plantilla trae 25). Un subgrupo cuenta solo si tiene sus n mediciones. Las columnas siguen a «Tamaño del subgrupo».`,
      },
      {
        id: 'resumen', tipo: 'tabla', etiqueta: 'Media y rango de cada subgrupo', visibleSi: (e) => e.modo === 'resumen',
        columnas: [
          { id: 'media', etiqueta: `Media (${XB})`, tipo: 'numero', ancho: '110px', ayuda: 'Media de las n mediciones del subgrupo.' },
          { id: 'rango', etiqueta: 'Rango (R)', tipo: 'numero', min: 0, ancho: '110px', ayuda: 'Medición mayor menos medición menor del subgrupo (no puede ser negativo).' },
        ],
        filas: GUIA_RESUMEN, filaNueva: { media: NaN, rango: NaN }, minFilas: 2, maxFilas: MAX_SUBGRUPOS, filasVacias: 5, etiquetaAgregar: '+ Subgrupo',
        ayuda: `Hasta ${MAX_SUBGRUPOS} subgrupos. Ejemplo: los 15 subgrupos de la guía M10 §2 (fuerza de engarzado, en N).`,
      },
      {
        id: 'gran', tipo: 'numero', etiqueta: `${GRAN} (gran promedio)`, visibleSi: (e) => e.modo === 'limites', ancho: '110px',
        ayuda: 'El promedio de las medias de todos los subgrupos: la línea central de la carta X̄.',
      },
      {
        id: 'rbar', tipo: 'numero', etiqueta: `${RB} (rango promedio)`, visibleSi: (e) => e.modo === 'limites', min: 0, ancho: '110px',
        ayuda: 'El promedio de los rangos de todos los subgrupos: la línea central de la carta R.',
      },
      {
        id: 'excluir', tipo: 'texto', etiqueta: 'Subgrupos que se excluyen (con su causa especial ya corregida)', visibleSi: (e) => e.modo !== 'limites', valor: '12', marcador: 'Por ejemplo: 12 o 12, 17',
        ayuda: 'Números de subgrupo separados por comas. Se excluyen del cálculo de los límites, no de la gráfica. Déjalo vacío para calcular con todos. Excluye solo lo que ya tiene causa identificada y corregida: la guía excluye el 12 (un cambio de rollo de terminales sin verificar).',
      },
      {
        id: 'reglas', tipo: 'opcion', etiqueta: 'Reglas de causas especiales', valor: 'tres', visibleSi: (e) => e.modo !== 'limites',
        opciones: [
          { valor: 'tres', texto: 'Las tres reglas de la guía', ayuda: 'Regla 1 (fuera de ±3σ), regla 2 (dos de tres más allá de 2σ) y regla 3 (nueve seguidos del mismo lado).' },
          { valor: 'una', texto: 'Solo la regla 1 (como la plantilla de Excel)', ayuda: 'Solo cuenta los puntos fuera de los límites de control, que es lo que hace la hoja «Carta X-R».' },
        ],
      },
    ],
    presets,
    umbral: umbralDe(5),
    supuesto: supuestoDe(5),
    preguntas: [
      'Con los 15 subgrupos de la guía, el 12 sale bajo el LIC. Antes de excluirlo, ¿qué evidencia pedirías para afirmar que fue una causa especial (el cambio de rollo) y no una variación común poco frecuente? ¿Qué harías si no encuentras ninguna causa?',
      'Quita el 12 de «Subgrupos que se excluyen» y compara las dos pasadas: ¿cuánto se estrechan los límites? ¿Qué riesgo corre un equipo que repite el recálculo hasta que ningún punto sale?',
      'Con el preset de la plantilla, cambia el tamaño de subgrupo de 5 a 3 sin tocar los datos. ¿Qué pasa con los límites de la carta X̄ y con el LSC de la carta R? ¿Por qué cambian aunque las mediciones sean las mismas?',
      'Captura nueve medias seguidas por encima de la línea central sin que ninguna cruce el LSC (ejercicio 3 de la guía). ¿Qué regla lo detecta y cuál no? ¿Qué buscarías en la línea de engarzado?',
      'Los límites de control no son los límites de especificación (≥ 173 N). ¿Puede un proceso estar bajo control estadístico y producir piezas fuera de especificación? ¿Y estar fuera de control con todas las piezas dentro de tolerancia? ¿Qué decisión tomarías en cada caso?',
    ],

    calcular(e) {
      const aviso = [];
      const n = Number(e.n);
      const constantes = constantesXR(n);
      if (!constantes) {
        return {
          aviso: ['El tamaño del subgrupo debe ser un entero de 2 a 10.'], umbral: umbralDe(5), supuesto: supuestoDe(5),
          vacio: 'Elige el tamaño del subgrupo (n) para obtener las constantes A₂, D₃ y D₄.',
          semaforos: [{ nombre: 'Datos', estado: 'sin-datos', texto: 'Falta el tamaño del subgrupo.' }],
        };
      }
      const modo = MODOS.includes(e.modo) ? e.modo : 'resumen';
      const reglas = e.reglas === 'una' ? [1] : [1, 2, 3];
      const sinDatos = (texto) => ({
        aviso, umbral: umbralDe(n), supuesto: supuestoDe(n), vacio: texto,
        semaforos: [{ nombre: 'Datos', estado: 'sin-datos', texto: 'Faltan datos para calcular los límites.' }],
      });

      /* ---- solo X̿ y R̄: los límites de los ejercicios ---- */
      if (modo === 'limites') {
        const l = limitesXR(e.gran, e.rbar, n);
        if (!l) {
          if (Number.isFinite(e.rbar) && e.rbar < 0) aviso.push('El rango promedio no puede ser negativo.');
          return sinDatos(`Captura ${GRAN} y ${RB} de subgrupos de tamaño ${n} para calcular los cuatro límites de control.`);
        }
        const salidas = [
          { id: 'gran', etiqueta: `${GRAN} (gran promedio)`, valor: corto(l.xbb, 3), color: 'azul', nota: 'línea central de la carta X̄' },
          { id: 'rbar', etiqueta: `${RB} (rango promedio)`, valor: corto(l.rb, 3), color: 'azul', nota: 'línea central de la carta R' },
          { id: 'lsc-x', etiqueta: `LSC ${XB}`, valor: fmt(l.lscX), color: 'coral', nota: `${GRAN} + A₂·${RB} = ${corto(l.xbb, 3)} + ${l.A2} × ${corto(l.rb, 3)}` },
          { id: 'lic-x', etiqueta: `LIC ${XB}`, valor: fmt(l.licX), color: 'coral', nota: `${GRAN} − A₂·${RB} = ${corto(l.xbb, 3)} − ${l.A2} × ${corto(l.rb, 3)}` },
          { id: 'lsc-r', etiqueta: 'LSC R', valor: fmt(l.lscR), color: 'coral', nota: `D₄·${RB} = ${l.D4} × ${corto(l.rb, 3)}` },
          { id: 'lic-r', etiqueta: 'LIC R', valor: fmtCero(l.licR), color: 'coral', nota: l.D3 === 0 ? 'D₃ = 0 con n ≤ 6' : `D₃·${RB} = ${l.D3} × ${corto(l.rb, 3)}` },
        ];
        const semaforos = [
          {
            nombre: `Límites de la carta ${XB}`, estado: 'informativo',
            texto: `Con n = ${n} (A₂ = ${l.A2}), la banda de la media va de ${fmt(l.licX)} a ${fmt(l.lscX)}: ${GRAN} ± ${fmt(l.A2 * l.rb)} (A₂·${RB}). Son los límites de control del proceso, no la tolerancia del cliente.`,
          },
          {
            nombre: 'Límite inferior de la carta R', estado: 'informativo',
            texto: l.D3 === 0
              ? `Con n = ${n}, D₃ = 0: el límite inferior de R es 0 porque un rango no puede ser negativo, así que solo un rango demasiado grande es señal. Desde n = 7, D₃ > 0 y un rango demasiado pequeño también sale de control.`
              : `Con n = ${n}, D₃ = ${l.D3}: el límite inferior de R es ${fmt(l.licR)}. Un rango menor que eso también es señal de que algo cambió.`,
          },
        ];
        const tablas = [{
          titulo: 'Límites de control',
          columnas: ['Línea', 'Fórmula', { t: 'Valor', num: true }],
          filas: [
            [GRAN, 'dato', { texto: corto(l.xbb, 3), num: true }], [RB, 'dato', { texto: corto(l.rb, 3), num: true }],
            [`LSC ${XB}`, `${GRAN} + A₂·${RB}`, { texto: fmt(l.lscX), num: true, formula: true }], [`LIC ${XB}`, `${GRAN} − A₂·${RB}`, { texto: fmt(l.licX), num: true, formula: true }],
            ['LSC R', `D₄·${RB}`, { texto: fmt(l.lscR), num: true, formula: true }], ['LIC R', `D₃·${RB}`, { texto: fmtCero(l.licR), num: true, formula: true }],
          ],
          pie: `Constantes para n = ${n}: A₂ = ${l.A2}, D₃ = ${l.D3} y D₄ = ${l.D4} (tabla de la guía y de la plantilla).`,
        }];
        return { aviso, salidasColumnas: 2, salidas, semaforos, umbral: umbralDe(n), supuesto: supuestoDe(n), tablas };
      }

      /* ---- con subgrupos: las cartas completas ---- */
      const { subgrupos: lista, incompletas } = modo === 'mediciones' ? resumenSubgrupos(e.mediciones, n) : subgruposDeResumen(e.resumen);
      if (incompletas) {
        aviso.push(
          modo === 'mediciones'
            ? `${plural(incompletas, 'fila')} con mediciones pero sin las ${n} del subgrupo: ${incompletas === 1 ? 'se ignoró' : 'se ignoraron'} (un subgrupo necesita sus ${n} mediciones).`
            : `${plural(incompletas, 'fila')} sin media o sin rango, o con un rango negativo: ${incompletas === 1 ? 'se ignoró' : 'se ignoraron'}.`
        );
      }
      const { indices, ignoradas } = leerSubgrupos(e.excluir);
      if (ignoradas.length) aviso.push(`No se entendió «${limpio(ignoradas.join(' '))}» en los subgrupos que se excluyen: escribe números de subgrupo separados por comas (por ejemplo «12, 17»).`);
      if (lista.length < 2) return sinDatos('Captura al menos dos subgrupos completos para calcular los límites de control.');
      const c = cartaXR(lista, { n, excluir: indices, reglas });
      if (!c.valido) return sinDatos('Excluiste todos los subgrupos: deja al menos uno para calcular los límites.');
      if (c.sinEncontrar.length) aviso.push(`Subgrupos por excluir que no existen o no tienen datos completos (se ignoraron): ${c.sinEncontrar.join(', ')}.`);

      const f = c.final;
      const l = f.limites;
      const hayExclusion = c.excluidos.length > 0;
      const sx = f.puntos.filter((p) => p.senalesX.length);
      const sr = f.puntos.filter((p) => p.senalesR.length);
      const limX = { cl: l.xbb, lsc: l.lscX, lic: l.licX, sigma: l.sigmaX };
      const limR = { cl: l.rb, lsc: l.lscR, lic: l.licR, sigma: l.sigmaR };
      const citarX = (p) => `${p.indice} (${textoSenales(p.senalesX, p.media, limX)})`;
      const citarR = (p) => `${p.indice} (${textoSenales(p.senalesR, p.rango, limR)})`;
      const reglasActivas = new Set([...sx.flatMap((p) => p.senalesX), ...sr.flatMap((p) => p.senalesR)]);
      const descripcionReglas = reglas.length === 1 ? 'regla 1' : 'reglas 1, 2 y 3';

      /* ---- salidas ---- */
      const salidas = [
        { id: 'subgrupos', etiqueta: 'Subgrupos usados', valor: `${entero(c.usados)} de ${entero(c.total)}`, color: 'teal', nota: `n = ${n}${hayExclusion ? ` · sin ${subgrupos(c.excluidos)}` : ''}` },
        { id: 'gran', etiqueta: `${GRAN} (gran promedio)`, valor: fmt(l.xbb), color: 'azul', nota: 'línea central de la carta X̄' },
        { id: 'rbar', etiqueta: `${RB} (rango promedio)`, valor: fmt(l.rb), color: 'azul', nota: 'línea central de la carta R' },
        { id: 'lsc-x', etiqueta: `LSC ${XB}`, valor: fmt(l.lscX), color: 'coral', nota: `${GRAN} + A₂·${RB}, con A₂ = ${l.A2}` },
        { id: 'lic-x', etiqueta: `LIC ${XB}`, valor: fmt(l.licX), color: 'coral', nota: `${GRAN} − A₂·${RB}` },
        { id: 'lsc-r', etiqueta: 'LSC R', valor: fmt(l.lscR), color: 'coral', nota: `D₄·${RB}, con D₄ = ${l.D4}` },
        { id: 'lic-r', etiqueta: 'LIC R', valor: fmtCero(l.licR), color: 'coral', nota: l.D3 === 0 ? 'D₃ = 0 con n ≤ 6' : `D₃·${RB}, con D₃ = ${l.D3}` },
        {
          id: 'senales-x', etiqueta: `Puntos con señal en ${XB}`, valor: String(sx.length), color: sx.length ? 'coral' : 'verde',
          nota: sx.length ? listaCitada(sx.map(citarX), 3) : `${descripcionReglas}: sin señales`,
        },
        {
          id: 'senales-r', etiqueta: 'Puntos con señal en R', valor: String(sr.length), color: sr.length ? 'coral' : 'verde',
          nota: sr.length ? listaCitada(sr.map(citarR), 3) : `${descripcionReglas}: sin señales`,
        },
      ];

      /* ---- semáforos ---- */
      const semaforos = [];
      semaforos.push(
        sr.length
          ? {
            nombre: 'Carta R (dispersión)', estado: 'critico',
            texto: `${listaCitada(sr.map(citarR))}: la variación dentro de los subgrupos no es estable. Los límites de la ${XB} salen de ${RB}, así que no son confiables mientras la carta R tenga señales: revisa primero esa causa (guía M10 §2).`,
          }
          : { nombre: 'Carta R (dispersión)', estado: 'cumple', texto: `La carta R no muestra señales (${descripcionReglas}): la dispersión es estable y los límites de la ${XB}, que dependen de ${RB}, son confiables.` }
      );
      if (sx.length) {
        const hayRegla1 = sx.some((p) => p.senalesX.includes(1));
        semaforos.push({
          nombre: `Carta ${XB} (centro)`, estado: hayRegla1 ? 'critico' : 'atencion',
          texto: `${listaCitada(sx.map(citarX))}: el centro del proceso ${hayRegla1 ? 'se salió de lo habitual' : 'se está moviendo aunque ningún punto cruce un límite'}. ${hayExclusion ? 'Con los límites ya recalculados, ' : ''}Una señal no confirma por sí sola una causa: investiga (5 Porqués, LAB 16) antes de decidir qué hacer con el subgrupo.`,
        });
      } else {
        semaforos.push({ nombre: `Carta ${XB} (centro)`, estado: 'cumple', texto: `Ninguna media da señal (${descripcionReglas}): el centro del proceso es estable en estos subgrupos.` });
      }
      if (hayExclusion) {
        const sinSenal = c.excluidos.filter((i) => {
          const p = c.primera.puntos.find((q) => q.indice === i);
          return p && !p.senalesX.length && !p.senalesR.length;
        });
        const primeraX = c.primera.puntos.filter((p) => p.senalesX.length);
        const primeraR = c.primera.puntos.filter((p) => p.senalesR.length);
        const vistoAntes = [...primeraX.map((p) => `el subgrupo ${p.indice} en la carta ${XB}`), ...primeraR.map((p) => `el subgrupo ${p.indice} en la carta R`)];
        semaforos.push(
          sinSenal.length
            ? {
              nombre: 'Subgrupos excluidos', estado: 'atencion',
              texto: `Excluiste ${subgrupos(sinSenal)}, pero con todos los subgrupos no daba ninguna señal. Sin una causa especial identificada y corregida, quitar un punto solo estrecha los límites y esconde la variación real del proceso.`,
            }
            : {
              nombre: 'Subgrupos excluidos', estado: 'informativo',
              texto: `Con los ${c.total} subgrupos, la primera pasada marcaba ${vistoAntes.length ? listaCitada(vistoAntes) : 'ningún punto'}. Los límites finales se calcularon sin ${subgrupos(c.excluidos)}. Excluir solo corresponde si la causa ya se identificó y se corrigió; el laboratorio no puede saberlo.`,
            }
        );
      }
      if (reglas.length === 1) {
        const completo = cartaXR(lista, { n, excluir: indices, reglas: [1, 2, 3] });
        const extras = completo.final.puntos.filter((p) => [...p.senalesX, ...p.senalesR].some((r) => r !== 1));
        semaforos.push(
          extras.length
            ? {
              nombre: 'Reglas 2 y 3 (no aplicadas)', estado: 'atencion',
              texto: `Con las tres reglas aparecerían señales que la regla 1 deja pasar: ${listaCitada(extras.map((p) => `${p.indice} (${[...(p.senalesX.length ? [`${XB}: regla ${p.senalesX.join(' y ')}`] : []), ...(p.senalesR.length ? [`R: regla ${p.senalesR.join(' y ')}`] : [])].join('; ')})`))}. Cambia a «las tres reglas» para verlas.`,
            }
            : { nombre: 'Reglas 2 y 3 (no aplicadas)', estado: 'informativo', texto: 'Con las tres reglas no aparecería ninguna señal adicional en estos datos. La plantilla de Excel solo cuenta los puntos fuera de límites; las reglas 2 y 3 detectan cambios pequeños pero sostenidos.' }
        );
      }
      semaforos.push(
        c.usados >= 20
          ? { nombre: 'Número de subgrupos', estado: 'cumple', texto: `${entero(c.usados)} subgrupos: dentro de los 20 a 25 que pide la plantilla para límites definitivos.` }
          : { nombre: 'Número de subgrupos', estado: 'atencion', texto: `${entero(c.usados)} subgrupos usados: la plantilla pide de 20 a 25 para límites definitivos. Con menos, trata los límites como preliminares.` }
      );

      /* ---- gráficas ---- */
      const graficas = [
        cartaPlotly({
          id: 'carta-r', titulo: 'Carta R: la dispersión dentro de cada subgrupo (se revisa primero)', etiquetaY: 'Rango (R)', nombreSerie: 'R', nombreCentro: RB,
          puntos: f.puntos, valorDe: (p) => p.rango, senalesDe: (p) => p.senalesR, lim: limR, desdeCero: true, zonas: reglas.length > 1,
          primera: hayExclusion ? { lsc: c.primera.limites.lscR, lic: c.primera.limites.licR } : null,
        }),
        cartaPlotly({
          id: 'carta-x', titulo: `Carta ${XB}: el promedio de cada subgrupo`, etiquetaY: `Media (${XB})`, nombreSerie: XB, nombreCentro: GRAN,
          puntos: f.puntos, valorDe: (p) => p.media, senalesDe: (p) => p.senalesX, lim: limX, desdeCero: false, zonas: reglas.length > 1,
          primera: hayExclusion ? { lsc: c.primera.limites.lscX, lic: c.primera.limites.licX } : null,
        }),
      ];

      /* ---- tablas ---- */
      const chip = (senales, valor, lim, excluido) => (excluido ? { estado: 'informativo', texto: 'Excluido' } : senales.length ? { estado: senales.includes(1) ? 'critico' : 'atencion', texto: mayuscula(textoSenales(senales, valor, lim)) } : { estado: 'cumple', texto: 'En control' });
      const tablas = [
        {
          titulo: 'Límites de control',
          columnas: ['Línea', 'Fórmula', { t: 'Valor', num: true }],
          filas: [
            [GRAN, `promedio de las ${entero(c.usados)} medias`, { texto: fmt(l.xbb), num: true, formula: true }],
            [RB, `promedio de los ${entero(c.usados)} rangos`, { texto: fmt(l.rb), num: true, formula: true }],
            [`LSC ${XB}`, `${GRAN} + A₂·${RB}`, { texto: fmt(l.lscX), num: true, formula: true }],
            [`LIC ${XB}`, `${GRAN} − A₂·${RB}`, { texto: fmt(l.licX), num: true, formula: true }],
            ['LSC R', `D₄·${RB}`, { texto: fmt(l.lscR), num: true, formula: true }],
            ['LIC R', `D₃·${RB}`, { texto: fmtCero(l.licR), num: true, formula: true }],
          ],
          pie: `Constantes para n = ${n}: A₂ = ${l.A2}, D₃ = ${l.D3} y D₄ = ${l.D4} (tabla de la guía y de la plantilla).`,
        },
        {
          titulo: 'Subgrupo por subgrupo',
          columnas: [{ t: '#', num: true }, { t: XB, num: true }, { t: 'R', num: true }, `Carta ${XB}`, 'Carta R'],
          filas: f.puntos.map((p) => [
            { texto: String(p.indice), num: true }, { texto: fmt(p.media), num: true }, { texto: fmt(p.rango), num: true },
            chip(p.senalesX, p.media, limX, p.excluido), chip(p.senalesR, p.rango, limR, p.excluido),
          ]),
          resaltar: f.puntos.map((p, i) => (p.senalesX.length || p.senalesR.length || p.excluido ? i : -1)).filter((i) => i >= 0),
          pie: `Con ${reglas.length === 1 ? 'la regla 1' : 'las tres reglas'}. Resaltados: los subgrupos con señal y los excluidos del cálculo de los límites.`,
        },
      ];
      if (hayExclusion) {
        const p = c.primera.limites;
        const textoPrimera = (puntos, clave, valorDe, lim) => (puntos.filter((q) => q[clave].length).map((q) => `${q.indice} (${textoSenales(q[clave], valorDe(q), lim)})`).join(', ') || 'ninguna');
        tablas.push({
          titulo: 'Primera pasada frente a límites finales',
          columnas: ['Cálculo', { t: `Con los ${c.total} subgrupos`, num: true }, { t: `Sin ${subgrupos(c.excluidos)}`, num: true }],
          filas: [
            [GRAN, { texto: fmt(p.xbb), num: true, formula: true }, { texto: fmt(l.xbb), num: true, formula: true }],
            [RB, { texto: fmt(p.rb), num: true, formula: true }, { texto: fmt(l.rb), num: true, formula: true }],
            [`LSC ${XB}`, { texto: fmt(p.lscX), num: true, formula: true }, { texto: fmt(l.lscX), num: true, formula: true }],
            [`LIC ${XB}`, { texto: fmt(p.licX), num: true, formula: true }, { texto: fmt(l.licX), num: true, formula: true }],
            ['LSC R', { texto: fmt(p.lscR), num: true, formula: true }, { texto: fmt(l.lscR), num: true, formula: true }],
            [`Señales en ${XB}`, textoPrimera(c.primera.puntos, 'senalesX', (q) => q.media, { cl: p.xbb, lsc: p.lscX, lic: p.licX }), sx.length ? sx.map(citarX).join(', ') : 'ninguna'],
            ['Señales en R', textoPrimera(c.primera.puntos, 'senalesR', (q) => q.rango, { cl: p.rb, lsc: p.lscR, lic: p.licR }), sr.length ? sr.map(citarR).join(', ') : 'ninguna'],
          ],
          pie: 'La primera pasada es la que encuentra la causa especial; los límites finales son los que se usan para vigilar el proceso en adelante.',
        });
      }

      return { aviso, salidasColumnas: 2, salidas, semaforos, umbral: umbralDe(n, reglasActivas), supuesto: supuestoDe(n), graficas, tablas };
    },
  };
}
